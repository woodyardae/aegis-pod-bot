import { insertBoostagram } from '../db/database';
import { type PaymentProvider } from './payment-provider';
import { AlbyProvider } from './providers/alby-provider';
import { MockProvider } from './providers/mock-provider';

const POLL_INTERVAL_MS = parseInt(process.env.BOOST_POLL_INTERVAL_MS ?? '60000', 10);

export interface NormalizedBoostagram {
  feedUrl: string;
  paymentHash: string | null;
  senderAlias: string | null;
  amountSats: number;
  message: string | null;
  appName: string | null;
  episodeTitle: string | null;
  episodeGuid: string | null;
  receivedAt: Date;
}

// Callback type: called for each NEW boostagram that hasn't been seen before
export type BoostagramCallback = (boost: NormalizedBoostagram) => Promise<void>;

// Track last-seen invoice settled timestamp (unix seconds) per feed to avoid re-fetching old ones
const lastSeenTimestamps: Map<string, number> = new Map();

// Resolve active provider based on environment config
const providerName = process.env.V4V_PROVIDER ?? 'alby';
let provider: PaymentProvider;

if (providerName.toLowerCase() === 'mock') {
  provider = new MockProvider();
} else {
  provider = new AlbyProvider();
}

console.log(`[PaymentAbstraction] Initialized V4V provider: "${provider.name}"`);

/**
 * Poll for incoming settled V4V boosts for a given feed URL.
 */
async function pollFeedBoosts(feedUrl: string, callback: BoostagramCallback): Promise<void> {
  const since = lastSeenTimestamps.get(feedUrl) ?? Math.floor(Date.now() / 1000) - 3600; // Default: last hour

  try {
    const boosts = await provider.pollNewBoosts(feedUrl, since);
    if (boosts.length === 0) return;

    // Filter out duplicates and get the max settled timestamp
    let maxTimestamp = since;

    for (const boost of boosts) {
      const settledSec = Math.floor(boost.receivedAt.getTime() / 1000);
      if (settledSec > maxTimestamp) {
        maxTimestamp = settledSec;
      }

      // Persist to local cache (dedup by payment_hash)
      // Fail-closed validation occurs inside insertBoostagram (amount > 0 check)
      const isNew = insertBoostagram(boost);
      if (isNew) {
        await callback(boost);
      }
    }

    lastSeenTimestamps.set(feedUrl, maxTimestamp);
  } catch (err: unknown) {
    const { telemetry } = await import('./telemetry');
    telemetry.categorizeAndRecord(err, `boostagram-poller poll ${feedUrl}`);
    console.error(`[BoostagramPoller] Poll error for ${feedUrl}:`, err);
  }
}

/**
 * Start the boostagram poller for all subscribed feeds.
 * Calls callback for every new, valid boostagram.
 *
 * @param getFeedUrls - Function returning current list of watched feeds
 * @param callback    - Called for each new boostagram
 */
export function startBoostagramPoller(
  getFeedUrls: () => string[],
  callback: BoostagramCallback,
): NodeJS.Timer {
  console.log(`[BoostagramPoller] Starting — polling every ${POLL_INTERVAL_MS / 1000}s`);

  const run = async () => {
    const feeds = getFeedUrls();
    if (feeds.length === 0) return;

    for (const feedUrl of feeds) {
      await pollFeedBoosts(feedUrl, callback);
    }
  };

  // Run immediately, then on interval
  void run();
  return setInterval(run, POLL_INTERVAL_MS);
}
