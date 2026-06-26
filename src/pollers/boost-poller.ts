import { type Client, type TextChannel } from 'discord.js';
import { getAllWatchedFeeds, getSubscribersByFeed, getCachedStatus } from '../db/database';
import { startBoostagramPoller, type NormalizedBoostagram } from '../modules/boostagram-poller';
import { buildBoostEmbed } from '../embeds/embeds';
import { lookupByFeedUrl } from '../modules/podcast-index-client';

// Cache show titles to avoid repeated Podcast Index lookups
const showTitleCache = new Map<string, string>();

async function getShowTitle(feedUrl: string): Promise<string> {
  if (showTitleCache.has(feedUrl)) return showTitleCache.get(feedUrl)!;
  try {
    const feed = await lookupByFeedUrl(feedUrl);
    if (feed?.title) {
      showTitleCache.set(feedUrl, feed.title);
      return feed.title;
    }
  } catch (err) {
    console.warn(`[BoostPoller] Podcast Index lookup failed for ${feedUrl}, trying database cache...`);
  }

  // Fallback to SQLite cache
  try {
    const cached = getCachedStatus(feedUrl) as any;
    if (cached?.title) {
      showTitleCache.set(feedUrl, cached.title);
      return cached.title;
    }
  } catch (err) {
    // Ignore cache read errors
  }

  return feedUrl;
}

/**
 * Start the boost poller.
 * When a new boostagram arrives, dispatches embeds to all subscribed channels.
 */
export function startBoostPoller(client: Client): NodeJS.Timer {
  return startBoostagramPoller(
    () => getAllWatchedFeeds('BOOSTAGRAM'),
    async (boost: NormalizedBoostagram) => {
      const showTitle = await getShowTitle(boost.feedUrl);
      const embed = buildBoostEmbed({
        feedUrl: boost.feedUrl,
        showTitle,
        senderAlias: boost.senderAlias,
        amountSats: boost.amountSats,
        message: boost.message,
        appName: boost.appName,
        episodeTitle: boost.episodeTitle,
        receivedAt: boost.receivedAt,
      });

      const subscribers = getSubscribersByFeed(boost.feedUrl, 'BOOSTAGRAM');
      for (const sub of subscribers) {
        try {
          const channel = await client.channels.fetch(sub.channel_id) as TextChannel | null;
          if (channel?.isTextBased()) {
            await channel.send({ embeds: [embed] });
          }
        } catch (err: unknown) {
          const { telemetry } = await import('../modules/telemetry');
          telemetry.categorizeAndRecord(err, `boost-poller send channel ${sub.channel_id}`);
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[BoostPoller] Failed to post to channel ${sub.channel_id}: ${msg}`);
        }
      }
    }
  );
}
