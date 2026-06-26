import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
  ChannelType,
  TextChannel,
} from 'discord.js';
import { addSubscription, removeSubscription, getSubscriptionsByGuild } from '../db/database';

export const data = new SlashCommandBuilder()
  .setName('boosts')
  .setDescription('Subscribe this server to live boostagram alerts for a podcast feed')
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Start receiving live boostagram alerts for a feed')
      .addStringOption((opt) =>
        opt.setName('feed_url').setDescription('RSS feed URL').setRequired(true)
      )
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Channel to post boostagram alerts in')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Stop boostagram alerts for a feed')
      .addStringOption((opt) =>
        opt.setName('feed_url').setDescription('RSS feed URL to stop watching').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('List all boostagram watches for this server')
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

    const botMember = interaction.guild?.members.me;
    if (!botMember || !channel.permissionsFor(botMember)?.has('SendMessages')) {
      await interaction.reply({
        content: `❌ I don't have permission to post in ${channel}.`,
        ephemeral: true,
      });
      return;
    }

    addSubscription(interaction.guildId, feedUrl, channel.id, 'BOOSTAGRAM');
    await interaction.reply({
      content: `✅ Now watching **${feedUrl}** for live boostagrams.\nAlerts will be posted in ${channel}.\n\n⚡ Boostagrams are polled every 60 seconds via Alby. Make sure your \`ALBY_ACCESS_TOKEN\` is configured.`,
    });

    console.log(`[Boosts] Guild ${interaction.guildId} subscribed to BOOSTAGRAM for ${feedUrl} -> #${channel.name}`);
    return;
  }

  if (sub === 'remove') {
    const feedUrl = interaction.options.getString('feed_url', true).trim();
    removeSubscription(interaction.guildId, feedUrl, 'BOOSTAGRAM');
    await interaction.reply({ content: `✅ Stopped boostagram alerts for **${feedUrl}**.` });
    return;
  }

  if (sub === 'list') {
    const subs = getSubscriptionsByGuild(interaction.guildId).filter((s) => s.alert_type === 'BOOSTAGRAM');

    if (subs.length === 0) {
      await interaction.reply({ content: 'No boostagram watches set up. Use `/boosts add` to start.', ephemeral: true });
      return;
    }

    const lines = subs.map((s) => `• <#${s.channel_id}> → \`${s.feed_url}\``).join('\n');
    await interaction.reply({ content: `**Boostagram watches for this server:**\n${lines}`, ephemeral: true });
  }
}
