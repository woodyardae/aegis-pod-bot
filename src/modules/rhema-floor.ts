export interface RhemaFloorState {
  roomId: string;
  activeSpeakerUserId: string | null;
  speakingRequestQueue: string[]; // Queue of userIds requesting mic access
  isMuted: boolean;
}

/**
 * Rhema (Speaking Floor & Microphone Controller) Module
 * Part of the Polis/People family: coordinates who has permission to speak in Agora Voice/Mic sessions.
 */
class RhemaFloorManager {
  private states = new Map<string, RhemaFloorState>();

  /**
   * Initializes or fetches floor state for a room.
   */
  public getOrCreateFloorState(roomId: string): RhemaFloorState {
    let state = this.states.get(roomId);
    if (!state) {
      state = {
        roomId,
        activeSpeakerUserId: null,
        speakingRequestQueue: [],
        isMuted: false
      };
      this.states.set(roomId, state);
    }
    return state;
  }

  /**
   * Listener requests microphone floor permission.
   * TODO: Wire up voice channel mute/unmute permission updates.
   */
  public requestSpeakingFloor(roomId: string, userId: string): void {
    const state = this.getOrCreateFloorState(roomId);
    if (!state.speakingRequestQueue.includes(userId) && state.activeSpeakerUserId !== userId) {
      state.speakingRequestQueue.push(userId);
      console.log(`[Rhema] User "${userId}" requested speaking floor in room "${roomId}"`);
    }
  }

  /**
   * Host grants microphone permission to a queued listener.
   * TODO: Bind to Discord GuildMember voice mute state commands.
   */
  public grantSpeakingFloor(roomId: string, userId: string): void {
    const state = this.getOrCreateFloorState(roomId);
    state.speakingRequestQueue = state.speakingRequestQueue.filter(id => id !== userId);
    state.activeSpeakerUserId = userId;
    console.log(`[Rhema] Speaking floor granted to user "${userId}" in room "${roomId}"`);
  }

  /**
   * Speaker releases the floor or host revokes it.
   */
  public releaseSpeakingFloor(roomId: string): void {
    const state = this.getOrCreateFloorState(roomId);
    const oldSpeaker = state.activeSpeakerUserId;
    state.activeSpeakerUserId = null;
    console.log(`[Rhema] Speaking floor released/revoked (previously held by user "${oldSpeaker || 'none'}") in room "${roomId}"`);
  }

  /**
   * Sets mute rule for the entire voice channel floor.
   */
  public setFloorMuteState(roomId: string, isMuted: boolean): void {
    const state = this.getOrCreateFloorState(roomId);
    state.isMuted = isMuted;
    console.log(`[Rhema] Floor mute state updated to ${isMuted} in room "${roomId}"`);
  }

  /**
   * Clears floor state.
   */
  public clearFloor(roomId: string): void {
    this.states.delete(roomId);
  }
}

export const rhemaFloorManager = new RhemaFloorManager();
export type { RhemaFloorManager as RhemaFloorManagerClass };
