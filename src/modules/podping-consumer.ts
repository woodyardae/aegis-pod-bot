import WebSocket from 'ws';
import { isEpisodeSeen, markEpisodeSeen } from '../db/database';

const AEGIS_OS_WS_URL = process.env.AEGIS_OS_WS_URL ?? 'ws://67.205.162.200:3000';
const RECONNECT_DELAY_MS = 10_000;

export interface PodpingEvent {
  feedUrl: string;
  title: string | null;
  image: string | null;
  description: string | null;
}

export type PodpingCallback = (event: PodpingEvent) => Promise<void>;

/**
 * Connects to the aegis-os WebSocket server and listens for live podping events.
 *
 * aegis-os broadcasts DROP_BLOB messages whenever it detects a new podping on
 * the Hive blockchain. Each drop includes: url, title, image, description.
 *
 * On reconnect, we re-subscribe immediately to avoid gaps.
 * This is the "free" episode detection path — zero additional polling cost
 * because aegis-os is already watching the blockchain.
 */
export function startPodpingConsumer(callback: PodpingCallback): void {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect(): void {
    console.log(`[PodpingConsumer] Connecting to aegis-os stream at ${AEGIS_OS_WS_URL}`);

    ws = new WebSocket(AEGIS_OS_WS_URL);

    ws.on('open', () => {
      console.log('[PodpingConsumer] Connected to aegis-os live stream');
    });

    ws.on('message', async (rawData: WebSocket.RawData) => {
      try {
        const data = JSON.parse(rawData.toString()) as AegisWsMessage;

        if (data.type === 'DROP_BLOB' && Array.isArray(data.drops)) {
          for (const drop of data.drops) {
            if (!drop.url) continue;

            const event: PodpingEvent = {
              feedUrl: drop.url,
              title: drop.title ?? null,
              image: drop.image ?? null,
              description: drop.description ?? null,
            };

            // Use a synthetic GUID based on URL + current hour to avoid
            // flooding if the same feed pings multiple times in an hour.
            // The episode poller uses real GUIDs for accurate dedup.
            const syntheticGuid = `podping-${drop.url}-${Math.floor(Date.now() / 3_600_000)}`;

            if (!isEpisodeSeen(drop.url, syntheticGuid)) {
              markEpisodeSeen(drop.url, syntheticGuid);
              void callback(event);
            }
          }
        }
      } catch (err: unknown) {
        const { telemetry } = await import('./telemetry');
        telemetry.categorizeAndRecord(err, 'podping-consumer message parse');
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[PodpingConsumer] Message parse error: ${msg}`);
      }
    });

    ws.on('error', (err: Error) => {
      import('./telemetry').then(({ telemetry }) => {
        telemetry.categorizeAndRecord(err, 'podping-consumer websocket error');
      });
      console.error(`[PodpingConsumer] WebSocket error: ${err.message}`);
    });

    ws.on('close', (code: number, reason: Buffer) => {
      import('./telemetry').then(({ telemetry }) => {
        telemetry.categorizeAndRecord(
          new Error(`WebSocket closed (${code}): ${reason.toString() || 'no reason'}`),
          'podping-consumer websocket close'
        );
      });
      console.warn(`[PodpingConsumer] Disconnected (${code}: ${reason.toString() || 'no reason'}). Reconnecting in ${RECONNECT_DELAY_MS / 1000}s...`);
      ws = null;
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, RECONNECT_DELAY_MS);
      }
    });
  }

  connect();
}

// ─── aegis-os WebSocket message types ────────────────────────────────────

interface AegisDrop {
  url?: string;
  title?: string;
  image?: string;
  description?: string;
  isCompliant?: boolean;
  baseline?: unknown;
  spawnParams?: unknown;
  activeTags?: string[];
}

interface AegisWsMessage {
  type: 'DROP_BLOB' | 'INITIAL_STREAM' | 'JACKPOT_UPDATE' | 'RESET_CARGO';
  drops?: AegisDrop[];
  stream?: AegisDrop[];
  jackpot?: number;
}
