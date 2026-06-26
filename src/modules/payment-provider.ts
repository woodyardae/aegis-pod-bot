import type { NormalizedBoostagram } from './boostagram-poller';

/**
 * Unified interface for V4V payment providers.
 * Part of Milestone B (Phase 16) - Payment Abstraction Layer.
 */
export interface PaymentProvider {
  /** Human-readable name of the payment provider */
  name: string;

  /**
   * Poll for new boostagrams/settled zaps for a given podcast feed.
   * 
   * @param feedUrl - The RSS URL of the podcast to query for
   * @param sinceTimestamp - Query invoices settled strictly after this Unix timestamp (seconds)
   * @returns List of normalized V4V boostagram payloads
   */
  pollNewBoosts(feedUrl: string, sinceTimestamp: number): Promise<NormalizedBoostagram[]>;
}
