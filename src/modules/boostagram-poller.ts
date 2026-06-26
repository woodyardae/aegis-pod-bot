import axios from 'axios';
import { insertBoostagram } from '../db/database';

const ALBY_API_BASE = 'https://api.getalby.com';
const ALBY_TOKEN = process.env.ALBY_ACCESS_TOKEN;
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

// Track last-seen invoice created_at per feed to avoid re-fetching old ones
const lastSeenTimestamps: Map<string, number> = new Map();

/**
 * Parse Alby invoice metadata to extract Podcasting 2.0 boostagram fields.
 * Alby stores TLV metadata in the invoice's comment or metadata fields.
 * This is best-effort parsing — fail-closed on amount.
 */
function parseAlbyInvoice(invoice: AlbyInvoice, feedUrl: string): NormalizedBoostagram | null {
  // Fail-closed: amount must be a positive integer
  const amountMsat = invoice.amount;
  if (!amountMsat || amountMsat <= 0) {
    console.warn(`[BoostagramPoller] Skipping invoice with invalid amount: ${amountMsat} msat (hash: ${invoice.payment_hash})`);
    return null;
  }

  const amountSats = Math.floor(amountMsat / 1000);
  if (amountSats <= 0) {
    console.warn(`[BoostagramPoller] Skipping invoice with sub-1-sat amount: ${amountMsat} msat`);
    return null;
  }

  // Attempt to parse TLV metadata (Podcasting 2.0 keysend TLV 7629169)
  let senderAlias: string | null = null;
  let message: string | null = null;
  let appName: string | null = null;
  let episodeTitle: string | null = null;
  let episodeGuid: string | null = null;

  if (invoice.metadata) {
    try {
      const meta = typeof invoice.metadata === 'string'
        ? JSON.parse(invoice.metadata)
        : invoice.metadata;

      senderAlias = meta.sender_name ?? meta.podcast_sender_name ?? null;
      message = meta.message ?? meta.boost_message ?? null;
      appName = meta.app_name ?? meta.podcast_app ?? null;
      episodeTitle = meta.episode ?? meta.podcast_episode ?? null;
      episodeGuid = meta.episode_guid ?? null;
    } catch {
      // Non-JSON metadata — treat as plain message
      message = typeof invoice.metadata === 'string' ? invoice.metadata : null;
    }
  }

  // Fallback: use comment as message if no parsed message
  if (!message && invoice.comment) {
    message = invoice.comment;
  }

  return {
    feedUrl,
    paymentHash: invoice.payment_hash ?? null,
    senderAlias,
    amountSats,
    message,
    appName,
    episodeTitle,
    episodeGuid,
    receivedAt: new Date(invoice.settled_at ? invoice.settled_at * 1000 : Date.now()),
  };
}

/**
 * Poll Alby API for incoming settled invoices for a given feed.
 * Returns only new boostagrams since last poll for this feed.
 *
 * NOTE: This is a simplified polling approach. In a production system
 * with high boost volume, Alby webhooks would be more efficient.
 * For MVP, polling at 60s intervals is correct and keeps auth simple.
 */
async function pollAlbyForFeed(feedUrl: string, callback: BoostagramCallback): Promise<void> {
  if (!ALBY_TOKEN) {
    console.warn('[BoostagramPoller] ALBY_ACCESS_TOKEN not configured — skipping Alby polling');
    return;
  }

  const since = lastSeenTimestamps.get(feedUrl) ?? Math.floor(Date.now() / 1000) - 3600; // Default: last hour

  try {
    const response = await axios.get(`${ALBY_API_BASE}/invoices/incoming`, {
      headers: {
        'Authorization': `Bearer ${ALBY_TOKEN}`,
        'Content-Type': 'application/json',
      },
      params: {
        // Filter by settled invoices only
        q: feedUrl, // Alby supports filtering by memo/metadata content
        per_page: 50,
      },
      timeout: 10_000,
    });

    const invoices: AlbyInvoice[] = Array.isArray(response.data) ? response.data : [];

    // Filter to invoices settled after our last-seen timestamp
    const newInvoices = invoices.filter((inv) => {
      const settledAt = inv.settled_at ?? 0;
      return inv.settled && settledAt > since;
    });

    if (newInvoices.length === 0) return;

    // Update timestamp to most recent invoice
    const maxTimestamp = Math.max(...newInvoices.map((inv) => inv.settled_at ?? 0));
    lastSeenTimestamps.set(feedUrl, maxTimestamp);

    for (const invoice of newInvoices) {
      const boost = parseAlbyInvoice(invoice, feedUrl);
      if (!boost) continue; // fail-closed: skip invalid amounts

      // Persist to cache (dedup by payment_hash)
      const isNew = insertBoostagram(boost);
      if (isNew) {
        await callback(boost);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[BoostagramPoller] Alby poll failed for ${feedUrl}: ${msg}`);
    // Do not throw — poller should continue for other feeds
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
      await pollAlbyForFeed(feedUrl, callback);
    }
  };

  // Run immediately, then on interval
  void run();
  return setInterval(run, POLL_INTERVAL_MS);
}

// ─── Alby API types (partial — only fields we use) ───────────────────────

interface AlbyInvoice {
  payment_hash?: string;
  amount: number;          // millisatoshis
  settled: boolean;
  settled_at?: number;     // unix timestamp
  comment?: string;
  metadata?: string | Record<string, unknown>;
  memo?: string;
  expires_at?: number;
}
