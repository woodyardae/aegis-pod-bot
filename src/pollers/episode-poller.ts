import { type Client, type TextChannel } from 'discord.js';
import {
  getAllWatchedFeeds,
  getSubscribersByFeed,
  isEpisodeSeen,
  markEpisodeSeen,
  isEpisodeAnnounced,
  markEpisodeAnnounced
} from '../db/database';
import { scanFeed } from '../modules/feed-scanner';
import { buildEpisodeEmbed } from '../embeds/embeds';
import { telemetry } from '../modules/telemetry';

const POLL_INTERVAL_MS = parseInt(process.env.EPISODE_POLL_INTERVAL_MS ?? '1800000', 10); // 30 min default

// Track consecutive failures per feed — for admin DM after 3 failures
const failureCount = new Map<string, number>();
const MAX_FAILURES_BEFORE_DM = 3;

// Concurrency lock to prevent duplicate scans running in parallel
const inProgressScans = new Set<string>();

/**
 * Helper to scan RSS feed with exponential backoff retries.
 */
async function scanFeedWithRetry(feedUrl: string, retries = 3, delayMs = 1500): Promise<any> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await scanFeed(feedUrl);
    } catch (err: any) {
      attempt++;
      if (attempt >= retries) throw err;
      const backoff = delayMs * Math.pow(2, attempt - 1);
      console.warn(
        `[EpisodePoller] Scan failed for ${feedUrl} (attempt ${attempt}/${retries}). ` +
        `Retrying in ${backoff}ms... Error: ${err.message}`
      );
      await new Promise(resolve => setTimeout(resolve, backoff));
    }
  }
}

/**
 * Poll all watched feeds for new episodes.
 * Posts episode embeds to the subscribed channels.
 * On 3 consecutive failures, DMs the guild owner instead of posting to channel.
 */
async function pollEpisodes(client: Client): Promise<void> {
  // Record heartbeat for Asphaleia observability
  telemetry.recordHeartbeat('episode-poller');

  const feeds = getAllWatchedFeeds('NEW_EPISODE');
  if (feeds.length === 0) return;

  for (const feedUrl of feeds) {
    // Skip if this feed URL is currently being scanned
    if (inProgressScans.has(feedUrl)) {
      console.log(`[EpisodePoller] Scan already in progress for ${feedUrl}, skipping parallel run.`);
      continue;
    }

    inProgressScans.add(feedUrl);

    try {
      // Scan feed with backoff retry
      const result = await scanFeedWithRetry(feedUrl);
      const ep = result.latestEpisode;

      if (!ep || !ep.guid) {
        inProgressScans.delete(feedUrl);
        continue;
      }

      if (isEpisodeSeen(feedUrl, ep.guid)) {
        // Reset failure count on successful scan
        failureCount.set(feedUrl, 0);
        
        // Still verify channel-level announcements in case a previous run sent embeds to only some channels
        const subscribers = getSubscribersByFeed(feedUrl, 'NEW_EPISODE');
        await announceToSubscribers(client, subscribers, feedUrl, ep, result);
        
        inProgressScans.delete(feedUrl);
        continue;
      }

      // New episode!
      markEpisodeSeen(feedUrl, ep.guid);
      failureCount.set(feedUrl, 0);

      console.log(`[EpisodePoller] New episode detected: "${ep.title}" from ${result.title}`);

      // Wire to Agora Listening Room (Polis Family)
      const { agoraRoomManager } = await import('../modules/agora-room');
      const subscribers = getSubscribersByFeed(feedUrl, 'NEW_EPISODE');
      for (const sub of subscribers) {
        agoraRoomManager.initializeEpisodeRoom(
          sub.guild_id,
          feedUrl,
          ep.guid,
          ep.title
        );
      }

      await announceToSubscribers(client, subscribers, feedUrl, ep, result);

    } catch (err: unknown) {
      telemetry.categorizeAndRecord(err, `episode-poller scan ${feedUrl}`);
      telemetry.recordModuleFailure('episode-poller', err);
      
      const msg = err instanceof Error ? err.message : String(err);
      const current = (failureCount.get(feedUrl) ?? 0) + 1;
      failureCount.set(feedUrl, current);

      console.error(`[EpisodePoller] Scan failed for ${feedUrl} (failure ${current}/${MAX_FAILURES_BEFORE_DM}): ${msg}`);

      if (current >= MAX_FAILURES_BEFORE_DM) {
        // DM guild owners — fail closed, do NOT post error to channel
        await notifyAdmins(client, feedUrl, msg);
        failureCount.set(feedUrl, 0); // Reset so we don't spam
      }
    } finally {
      inProgressScans.delete(feedUrl);
    }
  }
}

/**
 * Direct channel delivery helper with explicit channel-level deduplication.
 */
async function announceToSubscribers(
  client: Client,
  subscribers: any[],
  feedUrl: string,
  ep: any,
  result: any
): Promise<void> {
  const embed = buildEpisodeEmbed({
    showTitle: result.title,
    showImage: result.image,
    showUrl: result.link,
    episodeTitle: ep.title,
    episodeGuid: ep.guid,
    pubDate: ep.pubDate,
    enclosureUrl: ep.enclosureUrl,
    duration: ep.duration,
    episodeImage: ep.image,
    feedUrl,
    tags: { value: result.tags.value, transcript: result.tags.transcript },
  });

  for (const sub of subscribers) {
    // Check channel-level cursor dedupe
    if (isEpisodeAnnounced(sub.channel_id, feedUrl, ep.guid)) {
      continue;
    }

    // Add delay between announcements to avoid Discord rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      const channel = await client.channels.fetch(sub.channel_id) as TextChannel | null;
      if (channel?.isTextBased()) {
        await channel.send({ embeds: [embed] });
        
        // Persist last-announced cursor
        markEpisodeAnnounced(sub.channel_id, feedUrl, ep.guid);
        console.log(`[EpisodePoller] Announced "${ep.title}" to channel ${sub.channel_id}`);
      }
    } catch (channelErr: unknown) {
      telemetry.categorizeAndRecord(channelErr, `episode-poller send channel ${sub.channel_id}`);
      const msg = channelErr instanceof Error ? channelErr.message : String(channelErr);
      console.error(`[EpisodePoller] Failed to post to channel ${sub.channel_id}: ${msg}`);
    }
  }
}

/**
 * DM guild owners when a feed fails repeatedly.
 * Fail closed: errors are DM'd to server admin, never posted to channel.
 */
async function notifyAdmins(client: Client, feedUrl: string, errorMsg: string): Promise<void> {
  const subscribers = getSubscribersByFeed(feedUrl, 'NEW_EPISODE');
  const notifiedGuilds = new Set<string>();

  for (const sub of subscribers) {
    if (notifiedGuilds.has(sub.guild_id)) continue;
    notifiedGuilds.add(sub.guild_id);

    try {
      const guild = await client.guilds.fetch(sub.guild_id);
      const owner = await guild.fetchOwner();
      await owner.send(
        `⚠️ **Aegis Pod Bot Warning**\n` +
        `I've failed ${MAX_FAILURES_BEFORE_DM} times to scan this feed:\n\`${feedUrl}\`\n\n` +
        `Error: \`${errorMsg.slice(0, 200)}\`\n\n` +
        `Please check the feed URL is still valid. I'll keep retrying.`
      );
    } catch {
      // Can't DM owner — nothing we can do, log only
      console.warn(`[EpisodePoller] Could not DM owner of guild ${sub.guild_id}`);
    }
  }
}

/**
 * Start the episode poller.
 * Runs immediately, then on POLL_INTERVAL_MS cadence.
 */
export function startEpisodePoller(client: Client): NodeJS.Timer {
  console.log(`[EpisodePoller] Starting — polling every ${POLL_INTERVAL_MS / 1000}s`);

  void pollEpisodes(client); // Run immediately
  return setInterval(() => void pollEpisodes(client), POLL_INTERVAL_MS);
}
