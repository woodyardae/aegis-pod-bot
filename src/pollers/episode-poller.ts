import { type Client, type TextChannel } from 'discord.js';
import { getAllWatchedFeeds, getSubscribersByFeed, isEpisodeSeen, markEpisodeSeen } from '../db/database';
import { scanFeed } from '../modules/feed-scanner';
import { buildEpisodeEmbed } from '../embeds/embeds';

const POLL_INTERVAL_MS = parseInt(process.env.EPISODE_POLL_INTERVAL_MS ?? '600000', 10); // 10 min default

// Track consecutive failures per feed — for admin DM after 3 failures
const failureCount = new Map<string, number>();
const MAX_FAILURES_BEFORE_DM = 3;

/**
 * Poll all watched feeds for new episodes.
 * Posts episode embeds to the subscribed channels.
 * On 3 consecutive failures, DMs the guild owner instead of posting to channel.
 */
async function pollEpisodes(client: Client): Promise<void> {
  const feeds = getAllWatchedFeeds('NEW_EPISODE');
  if (feeds.length === 0) return;

  for (const feedUrl of feeds) {
    try {
      const result = await scanFeed(feedUrl);
      const ep = result.latestEpisode;

      if (!ep || !ep.guid) continue;

      if (isEpisodeSeen(feedUrl, ep.guid)) {
        // Reset failure count on successful scan
        failureCount.set(feedUrl, 0);
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
        try {
          const channel = await client.channels.fetch(sub.channel_id) as TextChannel | null;
          if (channel?.isTextBased()) {
            await channel.send({ embeds: [embed] });
          }
        } catch (channelErr: unknown) {
          const { telemetry } = await import('../modules/telemetry');
          telemetry.categorizeAndRecord(channelErr, `episode-poller send channel ${sub.channel_id}`);
          const msg = channelErr instanceof Error ? channelErr.message : String(channelErr);
          console.error(`[EpisodePoller] Failed to post to channel ${sub.channel_id}: ${msg}`);
        }
      }
    } catch (err: unknown) {
      const { telemetry } = await import('../modules/telemetry');
      telemetry.categorizeAndRecord(err, `episode-poller scan ${feedUrl}`);
      const msg = err instanceof Error ? err.message : String(err);
      const current = (failureCount.get(feedUrl) ?? 0) + 1;
      failureCount.set(feedUrl, current);

      console.error(`[EpisodePoller] Scan failed for ${feedUrl} (failure ${current}/${MAX_FAILURES_BEFORE_DM}): ${msg}`);

      if (current >= MAX_FAILURES_BEFORE_DM) {
        // DM guild owners — fail closed, do NOT post error to channel
        await notifyAdmins(client, feedUrl, msg);
        failureCount.set(feedUrl, 0); // Reset so we don't spam
      }
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
