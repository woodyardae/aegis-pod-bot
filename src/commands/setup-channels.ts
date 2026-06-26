import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  type CategoryChannel,
  type TextChannel,
} from 'discord.js';
import { addSubscription } from '../db/database';
import { scanFeed } from '../modules/feed-scanner';

export const data = new SlashCommandBuilder()
  .setName('setup-channels')
  .setDescription('Autogenerate pre-configured Aegis Pod alert channels in this server')
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels | PermissionFlagsBits.ManageGuild)
  .addStringOption((opt) =>
    opt
      .setName('feed_url')
      .setDescription('Optional RSS feed URL to automatically subscribe the channels to')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: '❌ This command must be run inside a Discord server.', ephemeral: true });
    return;
  }

  const feedUrlRaw = interaction.options.getString('feed_url');
  let feedUrl: string | null = null;

  if (feedUrlRaw) {
    feedUrl = feedUrlRaw.trim();
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
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const botMember = guild.members.me ?? await guild.members.fetch(interaction.client.user.id);
    
    // Check if bot can manage channels/roles locally
    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.editReply({
        content: '❌ Bot is missing permission to `Manage Channels`. Please update the bot\'s server role permissions.',
      });
      return;
    }

    // 1. Resolve or Create Category Channel "Aegis Podcasting"
    let category = guild.channels.cache.find(
      (c) => c.name.toLowerCase() === 'aegis podcasting' && c.type === ChannelType.GuildCategory
    ) as CategoryChannel | undefined;

    if (!category) {
      console.log('[SetupChannels] Category "Aegis Podcasting" not found. Creating...');
      category = await guild.channels.create({
        name: 'Aegis Podcasting',
        type: ChannelType.GuildCategory,
      });
    }

    // 2. Resolve or Create Text Channels
    let episodeChannel = guild.channels.cache.find(
      (c) => c.name.toLowerCase() === 'new-episodes' && c.parentId === category?.id && c.type === ChannelType.GuildText
    ) as TextChannel | undefined;

    let boostsChannel = guild.channels.cache.find(
      (c) => c.name.toLowerCase() === 'boostagrams' && c.parentId === category?.id && c.type === ChannelType.GuildText
    ) as TextChannel | undefined;

    // Define standard permission overwrites
    // - Everyone: View Channel = true, Send Messages = false (Read-only alerts feed)
    // - Bot: View Channel = true, Send Messages = true, Embed Links = true
    const permissionOverwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.SendMessages],
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
      },
      {
        id: botMember.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ];

    if (!episodeChannel) {
      console.log('[SetupChannels] Creating "new-episodes" channel...');
      episodeChannel = await guild.channels.create({
        name: 'new-episodes',
        type: ChannelType.GuildText,
        parent: category.id,
        topic: '📢 Automated Podcasting 2.0 episode announcements and releases.',
        permissionOverwrites,
      });
    }

    if (!boostsChannel) {
      console.log('[SetupChannels] Creating "boostagrams" channel...');
      boostsChannel = await guild.channels.create({
        name: 'boostagrams',
        type: ChannelType.GuildText,
        parent: category.id,
        topic: '⚡ Real-time Lightning zaps, zapper zests, and comments from the value-stream.',
        permissionOverwrites,
      });
    }

    const summaryLines = [
      `📁 **Category:** <#${category.id}>`,
      `📢 **Episodes Channel:** <#${episodeChannel.id}>`,
      `⚡ **Boostagrams Channel:** <#${boostsChannel.id}>`,
    ];

    // 3. Optional direct subscription
    if (feedUrl) {
      let feedTitle = 'your podcast';
      try {
        const scanResult = await scanFeed(feedUrl);
        feedTitle = scanResult.title;

        // Save subscriptions to database
        addSubscription(guild.id, feedUrl, episodeChannel.id, 'NEW_EPISODE');
        addSubscription(guild.id, feedUrl, boostsChannel.id, 'BOOSTAGRAM');
        
        summaryLines.push(`🎙️ **Subscribed Feed:** \`${feedTitle}\` (\`${feedUrl.slice(0, 50)}...\`)`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        summaryLines.push(`⚠️ **Alert:** Channels created, but subscription failed: \`${msg.slice(0, 80)}\``);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x00D4AA) // Aegis Teal
      .setTitle('✅ Aegis Channels Successfully Generated!')
      .setDescription(
        `Pre-configured notification channels have been established in this server with strict read-only permissions for community members.\n\n` +
        summaryLines.join('\n') +
        `\n\n*Run \`/verify\` at any time to check permissions or connectivity.*`
      )
      .setFooter({ text: 'Aegis OS Onboarding' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (err: unknown) {
    const { telemetry } = await import('../modules/telemetry');
    telemetry.categorizeAndRecord(err, 'setup-channels command execute');
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[/setup-channels] Error creating channels: ${msg}`);
    await interaction.editReply({
      content: `❌ Failed to generate alert channels: \`${msg.slice(0, 150)}\``,
    });
  }
}
