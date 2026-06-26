import axios from 'axios';
import { type PaymentProvider } from '../payment-provider';
import { type NormalizedBoostagram } from '../boostagram-poller';

const ALBY_API_BASE = 'https://api.getalby.com';

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

export class AlbyProvider implements PaymentProvider {
  public readonly name = 'Alby API';
  private readonly token: string | undefined;

  constructor(token?: string) {
    this.token = token ?? process.env.ALBY_ACCESS_TOKEN;
  }

  public async pollNewBoosts(feedUrl: string, sinceTimestamp: number): Promise<NormalizedBoostagram[]> {
    if (!this.token) {
      console.warn('[AlbyProvider] ALBY_ACCESS_TOKEN not configured — cannot poll Alby invoices');
      return [];
    }

    try {
      const response = await axios.get(`${ALBY_API_BASE}/invoices/incoming`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        params: {
          q: feedUrl, // Alby filters by memo/metadata query string
          per_page: 50,
        },
        timeout: 10_000,
      });

      const invoices: AlbyInvoice[] = Array.isArray(response.data) ? response.data : [];

      // Filter settled invoices newer than target timestamp
      const newInvoices = invoices.filter((inv) => {
        const settledAt = inv.settled_at ?? 0;
        return inv.settled && settledAt > sinceTimestamp;
      });

      const normalized: NormalizedBoostagram[] = [];

      for (const invoice of newInvoices) {
        const boost = this.parseInvoice(invoice, feedUrl);
        if (boost) {
          normalized.push(boost);
        }
      }

      return normalized;
    } catch (err: unknown) {
      const { telemetry } = await import('../telemetry');
      telemetry.categorizeAndRecord(err, `AlbyProvider poll ${feedUrl}`);
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[AlbyProvider] Failed to poll incoming invoices for ${feedUrl}: ${msg}`);
      return [];
    }
  }

  /**
   * Parse Alby invoice metadata into normalized boostagram fields.
   * Fail-closed: returns null if amount is missing or invalid.
   */
  private parseInvoice(invoice: AlbyInvoice, feedUrl: string): NormalizedBoostagram | null {
    const amountMsat = invoice.amount;
    if (!amountMsat || amountMsat <= 0) {
      return null;
    }

    const amountSats = Math.floor(amountMsat / 1000);
    if (amountSats <= 0) {
      return null;
    }

    // TLV metadata extraction (Podcasting 2.0 keysend TLV 7629169)
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
        message = typeof invoice.metadata === 'string' ? invoice.metadata : null;
      }
    }

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
}
