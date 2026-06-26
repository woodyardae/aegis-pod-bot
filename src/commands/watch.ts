import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
  ChannelType,
  TextChannel,
} from 'discord.js';
import { addSubscription, removeSubscription, getSubscriptionsByGuild } from '../db/database';

export const data = new SlashCommandBuilder()
  .setName('watch')
  .setDescription('Subscribe this server to new episode announcements for a podcast feed')
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Start watching a feed for new episodes')
      .addStringOption((opt) =>
        opt.setName('feed_url').setDescription('RSS feed URL').setRequired(true)
      )
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Channel to post new episode announcements in')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Stop watching a feed for new episodes')
      .addStringOption((opt) =>
        opt.setName('feed_url').setDescription('RSS feed URL to unwatch').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('List all watched feeds for this server')
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: '❌ This command must be used in a server.', ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'add') {
    const feedUrl = interaction.options.getString('feed_url', true).trim();
    const channel = interaction.options.getChannel('channel', true) as TextChannel;

    // URL validation
    try {
      const parsed = new URL(feedUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        await interaction.reply({ content: '❌ Feed URL must use `http://` or `https://`', ephemeral: true });
        return;
      }
    } catch {
      await interaction.reply({ content: '❌ Invalid feed URL.', ephemeral: true });
      return;
    }

    // Check bot can post to the channel
    const botMember = interaction.guild?.members.me;
    if (!botMember || !channel.permissionsFor(botMember)?.has('SendMessages')) {
      await interaction.reply({
        content: `❌ I don't have permission to post in ${channel}. Please give me Send Messages permission there.`,
        ephemeral: true,
      });
      return;
    }

    addSubscription(interaction.guildId, feedUrl, channel.id, 'NEW_EPISODE');
    await interaction.reply({
      content: `✅ Now watching **${feedUrl}** for new episodes.\nAnnouncements will be posted in ${channel}.`,
      ephemeral: false,
    });

    console.log(`[Watch] Guild ${interaction.guildId} subscribed to NEW_EPISODE for ${feedUrl} -> #${channel.name}`);
    return;
  }

  if (sub === 'remove') {
    const feedUrl = interaction.options.getString('feed_url', true).trim();
    removeSubscription(interaction.guildId, feedUrl, 'NEW_EPISODE');
    await interaction.reply({
      content: `✅ Stopped watching **${feedUrl}** for new episodes.`,
    });
    return;
  }

  if (sub === 'list') {
    const subs = getSubscriptionsByGuild(interaction.guildId).filter((s) => s.alert_type === 'NEW_EPISODE');

    if (subs.length === 0) {
      await interaction.reply({ content: 'No episode watches set up yet. Use `/watch add` to get started.', ephemeral: true });
      return;
    }

    const lines = subs.map((s) => `• <#${s.channel_id}> → \`${s.feed_url}\``).join('\n');
    await interaction.reply({
      content: `**Episode watches for this server:**\n${lines}`,
      ephemeral: true,
    });
  }
}
