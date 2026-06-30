import { type Client } from 'discord.js';

export interface AgoraListener {
  userId: string;
  username: string;
  nostrPubkey?: string;
  walletAddress?: string; // WebLN/Lightning wallet destination
  lastObservedPositionMs?: number; // Position last reported by listener
}

export type AgoraRoomEvent =
  | { type: 'JOIN'; listener: AgoraListener }
  | { type: 'LEAVE'; userId: string }
  | { type: 'PLAY'; hostPositionMs: number; hostUserId: string }
  | { type: 'PAUSE'; hostPositionMs: number; hostUserId: string }
  | { type: 'SEEK'; hostPositionMs: number; hostUserId: string }
  | { type: 'TRACK_CHANGE'; feedUrl: string; episodeGuid: string; episodeTitle: string };

export interface AgoraRoom {
  roomId: string; // Maps to Discord Guild/Channel ID or unique room identifier
  feedUrl: string;
  episodeGuid: string;
  episodeTitle: string;
  isPlaying: boolean;
  startedAt: number;
  listeners: AgoraListener[];
  hostUserId: string | null;
  playbackPositionMs: number; // Host's reported position
  playbackLastUpdatedAt: number; // Epoch timestamp of report
  playbackRate: number; // Speed multiplier, default 1.0
}

/**
 * Agora (Listening Room) Module Manager
 * Part of the Polis/People family: coordinates shared live listening and shared identity/wallet states.
 */
class AgoraRoomManager {
  private rooms = new Map<string, AgoraRoom>();
  private eventListeners = new Map<string, Array<(event: AgoraRoomEvent, room: AgoraRoom) => void>>();

  /**
   * Register event listener for a room.
   */
  public onEvent(roomId: string, callback: (event: AgoraRoomEvent, room: AgoraRoom) => void): void {
    const list = this.eventListeners.get(roomId) ?? [];
    list.push(callback);
    this.eventListeners.set(roomId, list);
  }

  /**
   * Emit event to registered listeners.
   */
  private emitEvent(roomId: string, event: AgoraRoomEvent, room: AgoraRoom): void {
    const list = this.eventListeners.get(roomId);
    if (list) {
      for (const cb of list) {
        try {
          cb(event, room);
        } catch (err) {
          console.error(`[Agora] Error in event listener callback for room "${roomId}":`, err);
        }
      }
    }
  }

  /**
   * Initializes a listening room for an announced episode.
   * Called by the feed/announcer path (Keryx) on new episode detection.
   */
  public initializeEpisodeRoom(
    roomId: string,
    feedUrl: string,
    episodeGuid: string,
    episodeTitle: string
  ): AgoraRoom {
    const room: AgoraRoom = {
      roomId,
      feedUrl,
      episodeGuid,
      episodeTitle,
      isPlaying: false,
      startedAt: Date.now(),
      listeners: [],
      hostUserId: null,
      playbackPositionMs: 0,
      playbackLastUpdatedAt: Date.now(),
      playbackRate: 1.0,
    };
    this.rooms.set(roomId, room);
    console.log(`[Agora] Initialized listening room "${roomId}" for episode "${episodeTitle}"`);
    
    // Initialize Rhema floor state for this room
    const { rhemaFloorManager } = require('./rhema-floor');
    rhemaFloorManager.getOrCreateFloorState(roomId);
    
    return room;
  }

  /**
   * Allows a user with an identity/wallet to join a listening room.
   */
  public joinRoom(roomId: string, listener: AgoraListener): AgoraRoom {
    let room = this.rooms.get(roomId);
    if (!room) {
      // Create an ad-hoc room if not already initialized
      room = this.initializeEpisodeRoom(roomId, 'https://example.com/feed.xml', 'adhoc-guid', 'Ad-hoc Broadcast');
    }

    // Set host if room has no host
    if (room.hostUserId === null) {
      room.hostUserId = listener.userId;
      console.log(`[Agora] Assigned host for room "${roomId}" to "${listener.username}" (ID: ${listener.userId})`);
    }

    // Prevent duplicate user entries
    const existingIndex = room.listeners.findIndex(l => l.userId === listener.userId);
    const updatedListener = {
      ...listener,
      lastObservedPositionMs: listener.lastObservedPositionMs ?? 0
    };

    if (existingIndex !== -1) {
      room.listeners[existingIndex] = updatedListener; // Update identity
    } else {
      room.listeners.push(updatedListener);
    }

    console.log(`[Agora] Listener "${listener.username}" (Wallet: ${listener.walletAddress || 'none'}) joined room "${roomId}"`);
    this.emitEvent(roomId, { type: 'JOIN', listener: updatedListener }, room);
    return room;
  }

  /**
   * Removes a user from a listening room.
   */
  public leaveRoom(roomId: string, userId: string): AgoraRoom | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.listeners = room.listeners.filter(l => l.userId !== userId);
    console.log(`[Agora] Listener with ID "${userId}" left room "${roomId}"`);

    // Reassign host if host is leaving
    if (room.hostUserId === userId) {
      room.hostUserId = room.listeners.length > 0 ? room.listeners[0].userId : null;
      console.log(`[Agora] Host left room "${roomId}". New host: "${room.hostUserId || 'none'}"`);
    }

    // Clean up Choros messages and Rhema floor if the room is empty
    if (room.listeners.length === 0) {
      const { chorosChatManager } = require('./choros-chat');
      const { rhemaFloorManager } = require('./rhema-floor');
      chorosChatManager.clearRoomMessages(roomId);
      rhemaFloorManager.clearFloor(roomId);
    }

    this.emitEvent(roomId, { type: 'LEAVE', userId }, room);
    return room;
  }

  /**
   * Explicitly sets host for a room.
   */
  public setHost(roomId: string, hostUserId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Verify host is in listener list
    const exists = room.listeners.some(l => l.userId === hostUserId);
    if (exists) {
      room.hostUserId = hostUserId;
      console.log(`[Agora] Host updated for room "${roomId}" to "${hostUserId}"`);
    }
  }

  /**
   * Update playback status and position. Host is source of truth.
   */
  public updatePlaybackState(roomId: string, hostUserId: string, isPlaying: boolean, positionMs: number): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (room.hostUserId !== hostUserId) {
      console.warn(`[Agora] Unauthorized playback update attempt in room "${roomId}" by non-host "${hostUserId}"`);
      return;
    }

    room.isPlaying = isPlaying;
    room.playbackPositionMs = positionMs;
    room.playbackLastUpdatedAt = Date.now();

    const eventType = isPlaying ? 'PLAY' : 'PAUSE';
    this.emitEvent(roomId, { type: eventType, hostPositionMs: positionMs, hostUserId }, room);
  }

  /**
   * Perform seek to a new playback position. Host only.
   */
  public hostSeek(roomId: string, hostUserId: string, positionMs: number): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (room.hostUserId !== hostUserId) {
      console.warn(`[Agora] Unauthorized seek attempt in room "${roomId}" by non-host "${hostUserId}"`);
      return;
    }

    room.playbackPositionMs = positionMs;
    room.playbackLastUpdatedAt = Date.now();

    console.log(`[Agora] Host "${hostUserId}" seeked to ${positionMs}ms in room "${roomId}"`);
    this.emitEvent(roomId, { type: 'SEEK', hostPositionMs: positionMs, hostUserId }, room);
  }

  /**
   * Get extrapolated current playback position using host's last report.
   */
  public getExtrapolatedPlaybackPosition(roomId: string): number {
    const room = this.rooms.get(roomId);
    if (!room) return 0;

    if (!room.isPlaying) {
      return room.playbackPositionMs;
    }

    const elapsed = Date.now() - room.playbackLastUpdatedAt;
    return room.playbackPositionMs + Math.round(elapsed * room.playbackRate);
  }

  /**
   * Listener reports their current local position.
   */
  public listenerReportPosition(roomId: string, userId: string, positionMs: number): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const listener = room.listeners.find(l => l.userId === userId);
    if (listener) {
      listener.lastObservedPositionMs = positionMs;
    }
  }

  /**
   * Converges listener position to host's extrapolated position.
   * Returns host's extrapolated position which listener should sync to.
   */
  public syncListenerPosition(roomId: string, userId: string): number {
    const hostPos = this.getExtrapolatedPlaybackPosition(roomId);
    this.listenerReportPosition(roomId, userId, hostPos);
    return hostPos;
  }

  /**
   * Fetches room state.
   */
  public getRoom(roomId: string): AgoraRoom | null {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Starts room audio playback (backwards-compatible wrapper).
   */
  public startRoomPlayback(roomId: string): AgoraRoom | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    if (room.hostUserId) {
      this.updatePlaybackState(roomId, room.hostUserId, true, room.playbackPositionMs);
    } else {
      room.isPlaying = true;
      room.playbackLastUpdatedAt = Date.now();
    }
    return room;
  }

  /**
   * Stops room audio playback (backwards-compatible wrapper).
   */
  public stopRoomPlayback(roomId: string): AgoraRoom | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    if (room.hostUserId) {
      this.updatePlaybackState(roomId, room.hostUserId, false, room.playbackPositionMs);
    } else {
      room.isPlaying = false;
    }
    return room;
  }

  /**
   * Syncs the room playback state with the Horai schedule.
   * If a scheduled item is active, updates currentEpisodeGuid and episodeTitle.
   */
  public syncRoomWithSchedule(roomId: string): AgoraRoom | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const { horaiScheduler } = require('./horai-scheduler');
    const scheduled = horaiScheduler.getScheduledItem(roomId, Date.now());
    if (scheduled) {
      if (room.feedUrl !== scheduled.feedUrl || room.episodeGuid !== scheduled.episodeGuid) {
        room.feedUrl = scheduled.feedUrl;
        room.episodeGuid = scheduled.episodeGuid;
        room.episodeTitle = scheduled.title;
        room.playbackPositionMs = 0;
        room.playbackLastUpdatedAt = Date.now();
        console.log(`[Agora] Synced room "${roomId}" with Horai schedule. Track changed: "${scheduled.title}"`);
        this.emitEvent(roomId, {
          type: 'TRACK_CHANGE',
          feedUrl: scheduled.feedUrl,
          episodeGuid: scheduled.episodeGuid,
          episodeTitle: scheduled.title
        }, room);
      }
      room.isPlaying = true;
    } else {
      room.isPlaying = false;
    }
    return room;
  }

  /**
   * Lists all active rooms.
   */
  public getActiveRooms(): AgoraRoom[] {
    return Array.from(this.rooms.values());
  }
}

export const agoraRoomManager = new AgoraRoomManager();
export type { AgoraRoomManager as AgoraRoomManagerClass };
