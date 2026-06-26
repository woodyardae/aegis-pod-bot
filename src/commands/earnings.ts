import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
} from 'discord.js';
import { getBoostSummary, getBoostagramsSince } from '../db/database';
import { buildEarningsEmbed } from '../embeds/embeds';
import { lookupByFeedUrl } from '../modules/podcast-index-client';

type Period = 'day' | 'week' | 'month';

function periodToSince(period: Period): Date {
  const now = new Date();
  switch (period) {
    case 'day':   return new Date(now.getTime() - 86_400_000);
    case 'week':  return new Date(now.getTime() - 604_800_000);
    case 'month': return new Date(now.getTime() - 2_592_000_000);
  }
}

function periodLabel(period: Period): string {
  switch (period) {
    case 'day':   return 'Last 24 Hours';
    case 'week':  return 'Last 7 Days';
    case 'month': return 'Last 30 Days';
  }
}

export const data = new SlashCommandBuilder()
  .setName('earnings')
  .setDescription('Show a V4V earnings summary for a podcast feed (best-effort, observed by bot)')
  .setContexts(InteractionContextType.Guild)
  .addStringOption((opt) =>
    opt.setName('feed_url').setDescription('RSS feed URL').setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName('period')
      .setDescription('Time period to summarize')
      .setRequired(false)
      .addChoices(
        { name: 'Last 24 Hours', value: 'day' },
        { name: 'Last 7 Days',   value: 'week' },
        { name: 'Last 30 Days',  value: 'month' },
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const feedUrl = interaction.options.getString('feed_url', true).trim();
  const period = (interaction.options.getString('period') ?? 'week') as Period;

  try {
    new URL(feedUrl);
  } catch {
    await interaction.reply({ content: '❌ Invalid feed URL.', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const since = periodToSince(period);
  const summary = getBoostSummary(feedUrl, since);
  const boosts = getBoostagramsSince(feedUrl, since);

  // Aggregate top boosters — aliases are anonymized as-provided by sender
  const boosterMap = new Map<string, number>();
  for (const b of boosts) {
    const alias = b.sender_alias ?? 'Anonymous';
    boosterMap.set(alias, (boosterMap.get(alias) ?? 0) + b.amount_sats);
  }
  const topBoosters = [...boosterMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([alias, totalSats]) => ({ alias, totalSats }));

  // Top episode (most boosted)
  const episodeMap = new Map<string, number>();
  for (const b of boosts) {
    if (b.episode_title) {
      episodeMap.set(b.episode_title, (episodeMap.get(b.episode_title) ?? 0) + b.amount_sats);
    }
  }
  const topEpisode = [...episodeMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Try to get show title from Podcast Index (best effort, non-blocking)
  let showTitle = feedUrl;
  try {
    const feed = await lookupByFeedUrl(feedUrl);
    if (feed?.title) showTitle = feed.title;
  } catch {
    // Non-critical — use feedUrl as fallback
  }

  const avgBoostSats = summary.count > 0 ? summary.totalSats / summary.count : 0;

  const embed = buildEarningsEmbed({
    feedUrl,
    showTitle,
    periodLabel: periodLabel(period),
    totalSats: summary.totalSats,
    boostCount: summary.count,
    topBoosters,
    topEpisode,
    avgBoostSats,
  });

  await interaction.editReply({ embeds: [embed] });
}
