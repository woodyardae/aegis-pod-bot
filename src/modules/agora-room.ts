import { type Client } from 'discord.js';

export interface AgoraListener {
  userId: string;
  username: string;
  nostrPubkey?: string;
  walletAddress?: string; // WebLN/Lightning wallet destination
}

export interface AgoraRoom {
  roomId: string; // Maps to Discord Guild/Channel ID or unique room identifier
  feedUrl: string;
  episodeGuid: string;
  episodeTitle: string;
  isPlaying: boolean;
  startedAt: number;
  listeners: AgoraListener[];
}

/**
 * Agora (Listening Room) Module Manager
 * Part of the Polis/People family: coordinates shared live listening and shared identity/wallet states.
 */
class AgoraRoomManager {
  private rooms = new Map<string, AgoraRoom>();

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
    };
    this.rooms.set(roomId, room);
    console.log(`[Agora] Initialized listening room "${roomId}" for episode "${episodeTitle}"`);
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

    // Prevent duplicate user entries
    const existingIndex = room.listeners.findIndex(l => l.userId === listener.userId);
    if (existingIndex !== -1) {
      room.listeners[existingIndex] = listener; // Update identity
    } else {
      room.listeners.push(listener);
    }

    console.log(`[Agora] Listener "${listener.username}" (Wallet: ${listener.walletAddress || 'none'}) joined room "${roomId}"`);
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
    return room;
  }

  /**
   * Fetches room state.
   */
  public getRoom(roomId: string): AgoraRoom | null {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Starts room audio playback.
   */
  public startRoomPlayback(roomId: string): AgoraRoom | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.isPlaying = true;
    room.startedAt = Date.now();
    console.log(`[Agora] Playback started in room "${roomId}"`);
    return room;
  }

  /**
   * Stops room audio playback.
   */
  public stopRoomPlayback(roomId: string): AgoraRoom | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.isPlaying = false;
    console.log(`[Agora] Playback stopped in room "${roomId}"`);
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
      room.feedUrl = scheduled.feedUrl;
      room.episodeGuid = scheduled.episodeGuid;
      room.episodeTitle = scheduled.title;
      room.isPlaying = true;
      console.log(`[Agora] Synced room "${roomId}" with Horai active schedule item: "${scheduled.title}"`);
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
