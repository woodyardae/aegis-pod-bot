export interface ChorosMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  timestamp: number;
}

/**
 * Choros (Chat Module)
 * Part of the Polis/People family: manages synchronized chat channels within the Agora Listening Room.
 */
class ChorosChatManager {
  private messages = new Map<string, ChorosMessage[]>();

  /**
   * Sends/stores a message in the Agora room chat channel.
   * TODO: Bind to Discord gateway channel message creation or Nostr relay publication.
   */
  public sendMessage(roomId: string, userId: string, username: string, content: string): ChorosMessage {
    const msg: ChorosMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      roomId,
      userId,
      username,
      content,
      timestamp: Date.now()
    };

    const roomMsgs = this.messages.get(roomId) ?? [];
    roomMsgs.push(msg);
    this.messages.set(roomId, roomMsgs);

    console.log(`[Choros] Message from "${username}" in room "${roomId}": ${content}`);
    return msg;
  }

  /**
   * Retrieves messages sent during the active listening session.
   * TODO: Implement database lookup for chat persistence/history logs.
   */
  public getRoomMessages(roomId: string): ChorosMessage[] {
    return this.messages.get(roomId) ?? [];
  }

  /**
   * Clears messages for a room session.
   */
  public clearRoomMessages(roomId: string): void {
    this.messages.delete(roomId);
    console.log(`[Choros] Cleared all chat messages for room "${roomId}"`);
  }
}

export const chorosChatManager = new ChorosChatManager();
export type { ChorosChatManager as ChorosChatManagerClass };
