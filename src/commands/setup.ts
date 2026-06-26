import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ComponentType,
  type TextChannel,
  type ModalSubmitInteraction,
} from 'discord.js';
import { scanFeed } from '../modules/feed-scanner';
import { addSubscription } from '../db/database';

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Launch the interactive Aegis Pod setup wizard for this server')
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: '❌ This command must be run inside a Discord server.', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00D4AA) // Aegis Teal
    .setTitle('🛰️ Aegis Pod Setup Wizard')
    .setDescription(
      `Welcome! This wizard will guide you through connecting your podcast RSS feed to your Discord channels.\n\n` +
      `**What you'll do:**\n` +
      `1. Enter your podcast RSS feed URL.\n` +
      `2. Choose channels for new episode alerts and live boostagram zaps.\n\n` +
      `Click the **Start Setup** button below to begin.`
    )
    .setFooter({ text: 'Aegis OS Onboarding' })
    .setTimestamp();

  const startBtn = new ButtonBuilder()
    .setCustomId('start_setup')
    .setLabel('Start Setup')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(startBtn);

  const response = await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });

  // Create button collector
  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 60_000,
  });

  collector.on('collect', async (btnInteraction) => {
    if (btnInteraction.customId === 'start_setup') {
      // 1. Show Modal for RSS URL input
      const modal = new ModalBuilder()
        .setCustomId('setup_modal')
        .setTitle('Podcast RSS Setup');

      const rssInput = new TextInputBuilder()
        .setCustomId('rss_url')
        .setLabel('Podcast RSS Feed URL')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://example.com/podcast.xml')
        .setRequired(true);

      const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(rssInput);
      modal.addComponents(firstActionRow);

      await btnInteraction.showModal(modal);
      
      // Stop collector since modal is shown
      collector.stop();

      // Wait for Modal Submit
      try {
        const modalSubmit = await interaction.awaitModalSubmit({
          filter: (m) => m.customId === 'setup_modal' && m.user.id === interaction.user.id,
          time: 120_000,
        });

        await handleModalSubmit(modalSubmit, guild.id);
      } catch (err) {
        console.error('[Setup] Wizard modal submission timed out or failed:', err);
      }
    }
  });
}

async function handleModalSubmit(interaction: ModalSubmitInteraction, guildId: string): Promise<void> {
  const feedUrl = interaction.fields.getTextInputValue('rss_url').trim();

  // Validate URL
  try {
    const parsed = new URL(feedUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      await interaction.reply({ content: '❌ Feed URL must use `http://` or `https://`', ephemeral: true });
      return;
    }
  } catch {
    await interaction.reply({ content: '❌ Invalid URL. Please start the setup again and enter a valid RSS URL.', ephemeral: true });
    return;
  }

  // Defer while we scan the feed to verify it is valid
  await interaction.deferReply({ ephemeral: true });

  let feedTitle = 'your podcast';
  try {
    const scanResult = await scanFeed(feedUrl);
    feedTitle = scanResult.title;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await interaction.editReply({
      content: `❌ Could not read RSS feed: \`${msg.slice(0, 150)}\`\nMake sure the feed URL is a valid XML RSS feed.`,
    });
    return;
  }

  // 2. Feed validated! Ask user to select channels
  const embed = new EmbedBuilder()
    .setColor(0x00D4AA)
    .setTitle('📖 Step 2: Configure Channels')
    .setDescription(
      `Successfully loaded **${feedTitle}**!\n\n` +
      `Now, select the Discord channels where you want to route alerts.\n` +
      `*   **Episode Alerts:** Pings when new episodes drop.\n` +
      `*   **Boostagram Alerts:** Streams live Lightning zaps/comments.`
    );

  const episodeChannelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('episode_channel')
    .setPlaceholder('Select Channel for Episode Announcements')
    .addChannelTypes(ChannelType.GuildText);

  const boostsChannelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('boosts_channel')
    .setPlaceholder('Select Channel for Live Boostagrams')
    .addChannelTypes(ChannelType.GuildText);

  const row1 = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(episodeChannelSelect);
  const row2 = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(boostsChannelSelect);

  const saveBtn = new ButtonBuilder()
    .setCustomId('save_channels')
    .setLabel('Save Settings')
    .setStyle(ButtonStyle.Success)
    .setDisabled(true); // Enabled once selections are made

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(saveBtn);

  const response = await interaction.editReply({
    embeds: [embed],
    components: [row1, row2, row3],
  });

  // Track select states
  let selectedEpisodeChannelId: string | null = null;
  let selectedBoostsChannelId: string | null = null;

  const selectCollector = response.createMessageComponentCollector({
    time: 120_000,
  });

  selectCollector.on('collect', async (menuInteraction) => {
    if (menuInteraction.isChannelSelectMenu()) {
      const channelId = menuInteraction.values[0];
      if (menuInteraction.customId === 'episode_channel') {
        selectedEpisodeChannelId = channelId;
      } else if (menuInteraction.customId === 'boosts_channel') {
        selectedBoostsChannelId = channelId;
      }

      // Update button status
      const isConfigured = !!selectedEpisodeChannelId || !!selectedBoostsChannelId;
      saveBtn.setDisabled(!isConfigured);

      await menuInteraction.update({
        components: [row1, row2, row3],
      });
    }

    if (menuInteraction.isButton() && menuInteraction.customId === 'save_channels') {
      selectCollector.stop();

      // 3. Save to database
      const summaryLines: string[] = [];
      
      if (selectedEpisodeChannelId) {
        addSubscription(guildId, feedUrl, selectedEpisodeChannelId, 'NEW_EPISODE');
        summaryLines.push(`📢 **Episode Alerts:** <#${selectedEpisodeChannelId}>`);
      }

      if (selectedBoostsChannelId) {
        addSubscription(guildId, feedUrl, selectedBoostsChannelId, 'BOOSTAGRAM');
        summaryLines.push(`⚡ **Boostagram Alerts:** <#${selectedBoostsChannelId}>`);
      }

      const successEmbed = new EmbedBuilder()
        .setColor(0x00D4AA)
        .setTitle('✅ Configuration Saved!')
        .setDescription(
          `Aegis Pod Bot is now wired to your podcast:\n` +
          `**Feed:** \`${feedUrl}\`\n\n` +
          summaryLines.join('\n') +
          `\n\n*To verify channel permissions, run \`/verify\` at any time.*`
        )
        .setFooter({ text: 'Aegis OS Onboarding Complete' });

      await menuInteraction.update({
        embeds: [successEmbed],
        components: [],
      });
    }
  });
}
