import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
} from 'discord.js';
import { scanFeed } from '../modules/feed-scanner';
import { buildStatusEmbed } from '../embeds/embeds';
import { getCachedStatus, setCachedStatus } from '../db/database';
import type { FeedScanResult } from '../modules/feed-scanner';

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Show the Podcasting 2.0 compliance status card for a podcast feed')
  .setContexts(InteractionContextType.Guild)
  .addStringOption((opt) =>
    opt
      .setName('feed_url')
      .setDescription('The RSS feed URL of the podcast')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const feedUrl = interaction.options.getString('feed_url', true).trim();

  // Basic URL validation
  try {
    const parsed = new URL(feedUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      await interaction.reply({ content: '❌ Feed URL must use `http://` or `https://`', ephemeral: true });
      return;
    }
  } catch {
    await interaction.reply({ content: '❌ Invalid feed URL. Please provide a full RSS URL.', ephemeral: true });
    return;
  }

  // Defer — scan can take a few seconds
  await interaction.deferReply();

  try {
    // Check cache first (1h TTL per database.ts)
    let result = getCachedStatus(feedUrl) as FeedScanResult | null;

    if (!result) {
      result = await scanFeed(feedUrl);
      setCachedStatus(feedUrl, result);
    }

    const embed = buildStatusEmbed(result);
    await interaction.editReply({ embeds: [embed] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[/status] Error scanning ${feedUrl}: ${msg}`);
    await interaction.editReply({
      content: `❌ Failed to scan feed: \`${msg.slice(0, 200)}\`\n\nMake sure the URL is a valid RSS feed.`,
    });
  }
}
