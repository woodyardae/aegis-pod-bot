export interface ScheduledItem {
  id: string;
  title: string;
  feedUrl: string;
  episodeGuid: string;
  startTime: number; // Epoch timestamp (ms)
  duration: number;  // Duration in milliseconds
}

/**
 * Horai (Scheduler & Automation Coordinator) Module
 * Part of the Air/Mechanics family: manages scheduling timelines, metadata caching, and automated room triggers.
 */
class HoraiScheduler {
  private schedules = new Map<string, ScheduledItem[]>();

  /**
   * Adds an item to the linear playout schedule for a specific room.
   */
  public addScheduledItem(roomId: string, item: ScheduledItem): void {
    const list = this.schedules.get(roomId) ?? [];
    list.push(item);
    // Sort chronological by start time
    list.sort((a, b) => a.startTime - b.startTime);
    this.schedules.set(roomId, list);
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
    console.log(`[Horai] Cleared all scheduled events for room "${roomId}"`);
  }
}

export const horaiScheduler = new HoraiScheduler();
