import { EmbedBuilder, Colors } from 'discord.js';
import { type FeedScanResult } from '../modules/feed-scanner';
import { THEMES } from './themes';

function formatDiscordTimestamp(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const parsed = Date.parse(dateStr);
  if (isNaN(parsed)) return dateStr;
  const unixSecs = Math.floor(parsed / 1000);
  return `<t:${unixSecs}:F> (<t:${unixSecs}:R>)`;
}

function getOmniColor(omni: number): number {
  if (omni >= 80) return 0x00D4AA; // Aegis Teal (Excellent)
  if (omni >= 50) return 0x3A7CA5; // Blue (Good)
  if (omni >= 20) return 0x6B5B95; // Muted Violet (Basic)
  return 0x4A4A6A; // Dim Purple-Grey (Poor)
}

function getOmniLabel(omni: number): string {
  if (omni >= 90) return '🎯 Elite V4V Compliance';
  if (omni >= 70) return '📈 Healthy Compliance';
  if (omni >= 40) return '⚙️ Basic Namespace Compliance';
  return '⚠️ Needs Optimization';
}

function tag(present: boolean): string {
  return present ? '✅' : '❌';
}

function scoreBar(score: number): string {
  const filled = Math.round(score / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${score}`;
}

/**
 * Build the Podcasting 2.0 Status Card embed.
 * Displayed in response to /status [feed_url].
 */
export function buildStatusEmbed(result: FeedScanResult): EmbedBuilder {
  const omni = result.scores.omni;
  const color = getOmniColor(omni);
  const label = getOmniLabel(omni);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${result.title}`)
    .setURL(result.link ?? result.feedUrl)
    .setFooter({ text: `PC2.0 Status • aegis-os.io • Feed: ${result.feedUrl}` })
    .setTimestamp();

  if (result.image) {
    embed.setThumbnail(result.image);
  }

  if (result.description) {
    embed.setDescription(
      result.description.length > 200
        ? result.description.slice(0, 197) + '...'
        : result.description
    );
  }

  // Omni Score headline
  embed.addFields({
    name: label,
    value: `\`${scoreBar(omni)}\``,
    inline: false,
  });

  // Score breakdown
  embed.addFields(
    { name: '⚡ V4V',       value: `\`${scoreBar(result.scores.v4v)}\``,       inline: true },
    { name: '👥 Community', value: `\`${scoreBar(result.scores.community)}\``, inline: true },
    { name: '🔧 Technical', value: `\`${scoreBar(result.scores.technical)}\``, inline: true },
  );

  // Namespace tag badges
  const { tags } = result;
  embed.addFields({
    name: '🏷️ Podcasting 2.0 Namespace Tags',
    value: [
      `${tag(tags.value)} \`podcast:value\`          ${tag(tags.valueRecipient)} \`podcast:valueRecipient\``,
      `${tag(tags.valueTimeSplit)} \`podcast:valueTimeSplit\`  ${tag(tags.person)} \`podcast:person\``,
      `${tag(tags.podroll)} \`podcast:podroll\`        ${tag(tags.socialInteract)} \`podcast:socialInteract\``,
      `${tag(tags.transcript)} \`podcast:transcript\`    ${tag(tags.funding)} \`podcast:funding\``,
      `${tag(tags.locked)} \`podcast:locked\`          ${tag(tags.podping)} \`podcast:podping\``,
      `${tag(tags.integrity)} \`podcast:integrity\``,
    ].join('\n'),
    inline: false,
  });

  // Medium + latest episode
  embed.addFields({
    name: '📻 Medium',
    value: `\`${result.medium}\``,
    inline: true,
  });

  if (result.latestEpisode) {
    const ep = result.latestEpisode;
    embed.addFields({
      name: '🎙️ Latest Episode',
      value: ep.title.length > 80 ? ep.title.slice(0, 77) + '...' : ep.title,
      inline: true,
    });
    if (ep.pubDate) {
      const ts = formatDiscordTimestamp(ep.pubDate);
      embed.addFields({
        name: '📅 Published',
        value: ts ?? ep.pubDate,
        inline: true,
      });
    }
  }

  return embed;
}

/**
 * Build a new episode announcement embed.
 */
export function buildEpisodeEmbed(opts: {
  showTitle: string;
  showImage: string | null;
  showUrl: string | null;
  episodeTitle: string;
  episodeGuid: string;
  pubDate: string | null;
  enclosureUrl: string | null;
  duration: number | null;
  episodeImage: string | null;
  feedUrl: string;
  tags?: Partial<{ value: boolean; transcript: boolean; chapters: boolean }>;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x00D4AA) // Aegis teal
    .setTitle(`🎙️ New Episode: ${opts.episodeTitle.length > 100 ? opts.episodeTitle.slice(0, 97) + '...' : opts.episodeTitle}`)
    .setFooter({ text: `${opts.showTitle} • aegis-os.io` })
    .setTimestamp();

  const thumb = opts.episodeImage ?? opts.showImage;
  if (thumb) embed.setThumbnail(thumb);
  if (opts.showUrl) embed.setURL(opts.showUrl);

  if (opts.enclosureUrl) {
    embed.addFields({ name: '🎧 Listen', value: `[Direct Link](${opts.enclosureUrl})`, inline: true });
  }

  if (opts.duration && opts.duration > 0) {
    let durationValue = '';
    const hours = Math.floor(opts.duration / 3600);
    const mins = Math.floor((opts.duration % 3600) / 60);
    const secs = opts.duration % 60;
    if (hours > 0) {
      durationValue = `${hours}h ${mins}m ${secs}s`;
    } else {
      durationValue = `${mins}m ${secs}s`;
    }
    embed.addFields({ name: '⏱️ Duration', value: durationValue, inline: true });
  }

  if (opts.pubDate) {
    const ts = formatDiscordTimestamp(opts.pubDate);
    embed.addFields({ name: '📅 Published', value: ts ?? opts.pubDate, inline: true });
  }

  // V4V badge if enabled
  if (opts.tags?.value) {
    embed.addFields({ name: '⚡ V4V Enabled', value: 'This episode supports Value 4 Value', inline: false });
  }

  return embed;
}

/**
 * Build a boostagram live-feed card embed.
 */
export function buildBoostEmbed(opts: {
  feedUrl: string;
  showTitle: string;
  senderAlias: string | null;
  amountSats: number;
  message: string | null;
  appName: string | null;
  episodeTitle: string | null;
  receivedAt: Date;
  theme?: string;
}): EmbedBuilder {
  // Color scales with amount depending on selected theme
  let color: number;
  const activeTheme = opts.theme && THEMES[opts.theme] ? THEMES[opts.theme] : null;

  if (activeTheme) {
    if (opts.amountSats >= 100_000)      color = activeTheme.whale;
    else if (opts.amountSats >= 10_000)  color = activeTheme.high;
    else if (opts.amountSats >= 1_000)   color = activeTheme.medium;
    else                                 color = activeTheme.small;
  } else {
    // Default Aegis theme colors
    if (opts.amountSats >= 100_000)      color = 0xF1C40F; // Whale Tier: Vibrant Gold
    else if (opts.amountSats >= 10_000)  color = 0x00E6B4; // High Tier: Aegis Teal
    else if (opts.amountSats >= 1_000)   color = 0x9B59B6; // Medium Tier: Royal Purple
    else                                 color = 0x5865F2; // Small Tier: Discord Blurple
  }

  const sender = opts.senderAlias ?? 'Anonymous Booster';
  const satsFormatted = opts.amountSats.toLocaleString();

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`⚡ ${satsFormatted} sats from ${sender}`)
    .setFooter({ text: `${opts.showTitle} • aegis-os.io${opts.appName ? ` • via ${opts.appName}` : ''}` })
    .setTimestamp(opts.receivedAt);

  if (opts.message) {
    embed.setDescription(`> ${opts.message.length > 500 ? opts.message.slice(0, 497) + '...' : opts.message}`);
  }

  if (opts.episodeTitle) {
    embed.addFields({ name: '🎙️ Episode', value: opts.episodeTitle, inline: false });
  }

  return embed;
}

/**
 * Build a V4V Earnings Summary embed.
 */
export function buildEarningsEmbed(opts: {
  feedUrl: string;
  showTitle: string;
  periodLabel: string;
  totalSats: number;
  boostCount: number;
  topBoosters: Array<{ alias: string; totalSats: number }>;
  topEpisode: string | null;
  avgBoostSats: number;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0xF0C040) // gold
    .setTitle(`📊 V4V Earnings: ${opts.showTitle}`)
    .setDescription(
      `Period: **${opts.periodLabel}**\n` +
      `> ⚠️ *Best-effort view based on what this bot has observed. The wallet is the authoritative ledger.*`
    )
    .setFooter({ text: 'aegis-os.io • V4V Earnings Summary' })
    .setTimestamp();

  embed.addFields(
    { name: '⚡ Total Sats Observed', value: opts.totalSats.toLocaleString(), inline: true },
    { name: '🚀 Boost Count',         value: String(opts.boostCount),          inline: true },
    { name: '📈 Avg Boost',           value: `${Math.round(opts.avgBoostSats).toLocaleString()} sats`, inline: true },
  );

  if (opts.topBoosters.length > 0) {
    const lines = opts.topBoosters
      .slice(0, 5)
      .map((b, i) => `${i + 1}. **${b.alias}** — ${b.totalSats.toLocaleString()} sats`);
    embed.addFields({ name: '🏆 Top Boosters', value: lines.join('\n'), inline: false });
  }

  if (opts.topEpisode) {
    embed.addFields({ name: '🎙️ Most Boosted Episode', value: opts.topEpisode, inline: false });
  }

  if (opts.totalSats === 0) {
    embed.addFields({
      name: '📭 No Boosts Observed',
      value: 'No boostagrams have been recorded for this period. Make sure the bot is watching this feed with `/boosts`.',
      inline: false,
    });
  }

  return embed;
}

/**
 * Build the Bot's Internal System Health and Telemetry Embed.
 * Displayed in response to /status with no arguments.
 */
export function buildBotStatusEmbed(opts: {
  uptimeSeconds: number;
  totalSubscribers: number;
  totalEpisodesSeen: number;
  totalBoostsCached: number;
  metrics: Array<{
    code: string;
    count: number;
    lastOccurrence: string | null;
    lastMessage: string | null;
  }>;
}): EmbedBuilder {
  const uptimeMins = Math.floor(opts.uptimeSeconds / 60);
  const uptimeHours = Math.floor(uptimeMins / 60);
  const uptimeDays = Math.floor(uptimeHours / 24);

  const uptimeStr = uptimeDays > 0
    ? `${uptimeDays}d ${uptimeHours % 24}h ${uptimeMins % 60}m`
    : uptimeHours > 0
      ? `${uptimeHours}h ${uptimeMins % 60}m ${opts.uptimeSeconds % 60}s`
      : `${uptimeMins}m ${opts.uptimeSeconds % 60}s`;

  const embed = new EmbedBuilder()
    .setColor(0x3A7CA5) // Aegis Blue
    .setTitle('🛰️ Aegis Pod Bot — System Health & Telemetry')
    .setFooter({ text: 'aegis-os.io • System Health Diagnostics' })
    .setTimestamp();

  // Statistics Breakdown
  embed.addFields(
    { name: '⏱️ System Uptime',    value: `\`${uptimeStr}\``,                     inline: true },
    { name: '👥 Subscriptions',    value: `\`${opts.totalSubscribers} active\``,  inline: true },
    { name: '📚 Episode Watchlist', value: `\`${opts.totalEpisodesSeen} items\``,   inline: true },
  );

  embed.addFields({
    name: '⚡ observed V4V Volume',
    value: `\`${opts.totalBoostsCached} boostagrams in local cache\``,
    inline: false
  });

  // Error Taxonomy / Operational Exceptions
  const failedMetrics = opts.metrics.filter((m) => m.count > 0);
  if (failedMetrics.length === 0) {
    embed.addFields({
      name: '🛡️ Operational Status',
      value: '✅ **Zero exceptions recorded** since starting. All pollers, parsers, and channels are fully operational.',
      inline: false
    });
  } else {
    const lines = failedMetrics.map((m) => {
      const lastTime = m.lastOccurrence ? new Date(m.lastOccurrence).toLocaleTimeString() : 'unknown';
      return `❌ **${m.code}**: \`${m.count}\` incidents (last at ${lastTime})\n> *Last error: ${m.lastMessage?.slice(0, 80) ?? 'none'}*`;
    });
    embed.addFields({
      name: '⚠️ Operational Exceptions (Telemetry)',
      value: lines.join('\n\n'),
      inline: false
    });
  }

  return embed;
}

/**
 * Build a Nostr comment push card embed.
 */
export function buildNostrCommentEmbed(opts: {
  showTitle: string;
  episodeTitle: string;
  authorName: string;
  authorAvatar: string | null;
  content: string;
  pubkey: string;
  createdAt: number;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x7F3E98) // Nostr purple style
    .setTitle(`💬 Nostr Comment from ${opts.authorName}`)
    .setDescription(
      opts.content.length > 800
        ? `> ${opts.content.slice(0, 797)}...`
        : `> ${opts.content}`
    )
    .setFooter({ text: `via Nostr • ${opts.showTitle}` })
    .setTimestamp(new Date(opts.createdAt * 1000));

  if (opts.authorAvatar) {
    embed.setThumbnail(opts.authorAvatar);
  }

  embed.addFields({
    name: '🎙️ Episode',
    value: opts.episodeTitle,
    inline: false,
  });

  return embed;
}

