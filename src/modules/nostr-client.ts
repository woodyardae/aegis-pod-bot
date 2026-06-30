import WebSocket from 'ws';

// ─── Bech32 & TLV Decoder ──────────────────────────────────────────────────

const ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const ALPHABET_MAP = new Map(ALPHABET.split('').map((c, i) => [c, i]));

function decodeBech32(bechString: string): { hrp: string; data: Uint8Array } {
  const p = bechString.lastIndexOf('1');
  if (p < 1 || p + 7 > bechString.length) {
    throw new Error('Invalid Bech32 string format');
  }
  const hrp = bechString.substring(0, p);
  const dataPart = bechString.substring(p + 1);
  const values: number[] = [];
  for (const c of dataPart) {
    const val = ALPHABET_MAP.get(c);
    if (val === undefined) {
      throw new Error(`Invalid Base32 character: ${c}`);
    }
    values.push(val);
  }
  
  // Convert 5-bit values to 8-bit bytes (dropping the 6-character checksum at the end)
  const bytes = convertBits(values.slice(0, -6), 5, 8, false);
  return { hrp, data: bytes };
}

function convertBits(data: number[], fromWidth: number, toWidth: number, pad: boolean): Uint8Array {
  let acc = 0;
  let bits = 0;
  const result: number[] = [];
  const maxv = (1 << toWidth) - 1;
  const max_acc = (1 << (fromWidth + toWidth - 1)) - 1;
  for (const value of data) {
    acc = ((acc << fromWidth) | value) & max_acc;
    bits += fromWidth;
    while (bits >= toWidth) {
      bits -= toWidth;
      result.push((acc >> bits) & maxv);
    }
  }
  const remaining = acc & ((1 << bits) - 1);
  if (pad) {
    if (bits > 0) {
      result.push((remaining << (toWidth - bits)) & maxv);
    }
  } else if (bits >= fromWidth || (remaining << (toWidth - bits)) & maxv) {
    throw new Error('Invalid padding during bit conversion');
  }
  return new Uint8Array(result);
}

function parseNevent(bytes: Uint8Array): string {
  let index = 0;
  while (index < bytes.length) {
    const type = bytes[index++];
    const len = bytes[index++];
    const value = bytes.subarray(index, index + len);
    index += len;
    if (type === 0) {
      // Type 0 is the 32-byte event ID hex
      return Buffer.from(value).toString('hex');
    }
  }
  throw new Error('Nevent TLV structure does not contain a type 0 event ID');
}

/**
 * Decodes a Nostr URI (note1... or nevent1...) to its 32-byte hex ID.
 */
export function getNostrEventHexId(uri: string): string {
  const cleanUri = uri.startsWith('nostr:') ? uri.substring(6) : uri;
  if (cleanUri.startsWith('note1')) {
    const { hrp, data } = decodeBech32(cleanUri);
    if (hrp !== 'note') throw new Error('Expected note HRP');
    return Buffer.from(data).toString('hex');
  } else if (cleanUri.startsWith('nevent1')) {
    const { hrp, data } = decodeBech32(cleanUri);
    if (hrp !== 'nevent') throw new Error('Expected nevent HRP');
    return parseNevent(data);
  } else {
    // If it's already a 64-character hex string, return it
    if (/^[0-9a-fA-F]{64}$/.test(cleanUri)) {
      return cleanUri.toLowerCase();
    }
    throw new Error(`Unsupported Nostr URI format: ${uri}`);
  }
}

// ─── Nostr Relay Client ─────────────────────────────────────────────────────

export interface NostrComment {
  id: string;
  pubkey: string;
  authorName: string;
  authorAvatar: string | null;
  content: string;
  createdAt: number;
}

const DEFAULT_RELAYS = [
  'wss://nos.lol',
  'wss://relay.damus.io',
  'wss://relay.snort.social'
];

/**
 * Connects to public Nostr relays, queries replies to the event ID,
 * and fetches commenter profiles.
 */
export function fetchNostrComments(eventHexId: string, relays: string[] = DEFAULT_RELAYS): Promise<NostrComment[]> {
  return new Promise((resolve) => {
    const commentsMap = new Map<string, any>();
    const profilesMap = new Map<string, any>();
    const activeConnections: WebSocket[] = [];
    let finishedCount = 0;

    const timeout = setTimeout(() => {
      cleanupAndResolve();
    }, 4000); // 4 seconds query timeout

    function cleanupAndResolve() {
      clearTimeout(timeout);
      activeConnections.forEach(ws => {
        try { ws.close(); } catch (e) {}
      });

      // Map profiles to comments
      const results: NostrComment[] = Array.from(commentsMap.values()).map(c => {
        const profile = profilesMap.get(c.pubkey) || {};
        return {
          id: c.id,
          pubkey: c.pubkey,
          authorName: profile.display_name || profile.name || `${c.pubkey.substring(0, 8)}...`,
          authorAvatar: profile.picture || null,
          content: c.content,
          createdAt: c.created_at
        };
      });

      // Sort by chronological order (oldest first for comment threads)
      results.sort((a, b) => a.createdAt - b.createdAt);
      resolve(results);
    }

    relays.forEach(relayUrl => {
      const ws = new WebSocket(relayUrl, {
        handshakeTimeout: 3000
      });
      activeConnections.push(ws);

      const subId = 'sub_' + Math.random().toString(36).substring(2, 9);
      const profileSubId = 'sub_prof_' + Math.random().toString(36).substring(2, 9);
      let closed = false;

      ws.on('open', () => {
        // Query kind 1 replies tagging our root event
        const filter = {
          kinds: [1],
          '#e': [eventHexId]
        };
        ws.send(JSON.stringify(['REQ', subId, filter]));
      });

      ws.on('message', (rawData) => {
        if (closed) return;
        try {
          const message = JSON.parse(rawData.toString());
          if (!Array.isArray(message)) return;

          const [type, responseSubId, event] = message;

          if (type === 'EVENT') {
            if (responseSubId === subId && event && event.kind === 1) {
              // Store comment
              if (!commentsMap.has(event.id)) {
                commentsMap.set(event.id, event);
                
                // Fetch this author's profile dynamically in the same session
                const profFilter = {
                  kinds: [0],
                  authors: [event.pubkey]
                };
                ws.send(JSON.stringify(['REQ', profileSubId, profFilter]));
              }
            } else if (responseSubId === profileSubId && event && event.kind === 0) {
              // Store profile details
              try {
                const profile = JSON.parse(event.content);
                profilesMap.set(event.pubkey, profile);
              } catch (e) {}
            }
          } else if (type === 'EOSE') {
            // End of subscription events
            if (responseSubId === subId) {
              // We got all historical comments, we can stop querying comments from this relay
              ws.send(JSON.stringify(['CLOSE', subId]));
            }
          }
        } catch (e) {}
      });

      ws.on('error', () => {
        // Fail silently and continue with other relays
        handleConnectionFinish();
      });

      ws.on('close', () => {
        handleConnectionFinish();
      });

      function handleConnectionFinish() {
        if (closed) return;
        closed = true;
        finishedCount++;
        if (finishedCount >= relays.length) {
          cleanupAndResolve();
        }
      }
    });
  });
}
