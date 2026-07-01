import { agoraRoomManager } from './agora-room';

export interface ScheduledItem {
  id: string;
  title: string;
  feedUrl: string;
  episodeGuid: string;
  startTime: number; // Epoch timestamp (ms)
  duration: number;  // Duration in milliseconds
}

interface CacheEntry {
  data: ScheduledItem[];
  expiresAt: number;
}

/**
 * Horai (Scheduler & Automation Coordinator) Module
 * Part of the Air/Mechanics family: manages scheduling timelines, metadata caching, and automated room triggers.
 */
class HoraiScheduler {
  private schedules = new Map<string, ScheduledItem[]>();
  private scheduleCache = new Map<string, CacheEntry>();
  
  public cacheHits = 0;
  public cacheMisses = 0;
  private cacheTtlMs = 10000; // 10s TTL for validation testing

  /**
   * Adds an item to the linear playout schedule for a specific room.
   */
  public addScheduledItem(roomId: string, item: ScheduledItem): void {
    const list = this.schedules.get(roomId) ?? [];
    list.push(item);
    // Sort chronological by start time
    list.sort((a, b) => a.startTime - b.startTime);
    this.schedules.set(roomId, list);
    
    // Invalidate the cache for this room
    this.scheduleCache.delete(roomId);
    
    console.log(`[Horai] Scheduled item "${item.title}" in room "${roomId}" at ${new Date(item.startTime).toISOString()}`);
  }

  /**
   * Looks up what is currently scheduled to play at a specific timestamp.
   */
  public getScheduledItem(roomId: string, timestamp: number = Date.now()): ScheduledItem | null {
    const list = this.schedules.get(roomId);
    if (!list || list.length === 0) return null;

    // Find the item whose active interval [startTime, startTime + duration] covers the timestamp
    const active = list.find(item => {
      const endTime = item.startTime + item.duration;
      return timestamp >= item.startTime && timestamp <= endTime;
    });

    return active ?? null;
  }

  /**
   * Cache-backed lookup of upcoming items starting after the given timestamp.
   */
  public getUpcomingSchedule(roomId: string, timestamp: number = Date.now(), limit = 5): ScheduledItem[] {
    const cacheKey = `${roomId}_${limit}`;
    const cached = this.scheduleCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      this.cacheHits++;
      return cached.data;
    }

    this.cacheMisses++;
    const list = this.schedules.get(roomId) ?? [];
    const upcoming = list
      .filter(item => item.startTime > timestamp)
      .slice(0, limit);

    this.scheduleCache.set(cacheKey, {
      data: upcoming,
      expiresAt: Date.now() + this.cacheTtlMs
    });

    return upcoming;
  }

  /**
   * Tick automation function: updates the associated Agora room based on the schedule at the given timestamp.
   * Auto-transitions tracks on time and handles room opening/playback changes.
   */
  public checkPlayout(roomId: string, timestamp: number = Date.now()): void {
    const activeItem = this.getScheduledItem(roomId, timestamp);
    
    if (activeItem) {
      let room = agoraRoomManager.getRoom(roomId);
      if (!room) {
        console.log(`[Horai] Timetable active. Auto-opening Agora room for "${activeItem.title}"`);
        room = agoraRoomManager.initializeEpisodeRoom(
          roomId,
          activeItem.feedUrl,
          activeItem.episodeGuid,
          activeItem.title
        );
      }

      // Sync the room properties with the active scheduled item
      if (room.feedUrl !== activeItem.feedUrl || room.episodeGuid !== activeItem.episodeGuid) {
        console.log(`[Horai] Timetable event transition: advancing to track "${activeItem.title}"`);
        agoraRoomManager.syncRoomWithSchedule(roomId);
      } else if (!room.isPlaying) {
        // If room is initialized but not playing, start it
        agoraRoomManager.startRoomPlayback(roomId);
      }
    } else {
      // No active scheduled item
      const room = agoraRoomManager.getRoom(roomId);
      if (room && room.isPlaying) {
        console.log(`[Horai] Timetable event finished. Stopping room playback.`);
        agoraRoomManager.stopRoomPlayback(roomId);
      }
    }
  }

  /**
   * Gets the complete list of scheduled items for a room.
   */
  public getRoomSchedule(roomId: string): ScheduledItem[] {
    return this.schedules.get(roomId) ?? [];
  }

  /**
   * Clears all scheduled events for a room.
   */
  public clearRoomSchedule(roomId: string): void {
    this.schedules.delete(roomId);
    this.scheduleCache.delete(roomId);
    console.log(`[Horai] Cleared all scheduled events for room "${roomId}"`);
  }
}

export const horaiScheduler = new HoraiScheduler();
