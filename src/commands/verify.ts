import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  type TextChannel,
} from 'discord.js';
import { getSubscriptionsByGuild } from '../db/database';
import axios from 'axios';

export const data = new SlashCommandBuilder()
  .setName('verify')
  .setDescription('Verify channel permissions and V4V feed connectivity for server alerts')
  .setContexts(InteractionContextType.Guild);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: '❌ This command can only be used within a server.', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const guildId = guild.id;
  const subscriptions = getSubscriptionsByGuild(guildId);

  const embed = new EmbedBuilder()
    .setColor(0x3A7CA5) // Aegis Blue
    .setTitle('🛰️ Guild Alerts Configuration Verification')
    .setDescription(
      `Checking channel wiring and feed connectivity for **${guild.name}**...\n` +
      `Found **${subscriptions.length}** subscription(s) registered in this server.`
    )
    .setTimestamp();

  if (subscriptions.length === 0) {
    embed.addFields({
      name: '📭 No Subscriptions',
      value: 'Configure alerts first using `/watch add` or `/boosts add`.',
      inline: false,
    });
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Iterate over subscriptions and test each
  for (let i = 0; i < subscriptions.length; i++) {
    const sub = subscriptions[i];
    const alertLabel = sub.alert_type === 'NEW_EPISODE' ? '🎙️ Episode Alerts' : '⚡ Boostagram Feed';
    
    let channelStatus = 'Checking...';
    let feedStatus = 'Checking...';
    let channelOk = false;
    let feedOk = false;

    // 1. Check channel permissions
    try {
      const channel = await guild.channels.fetch(sub.channel_id).catch(() => null);
      if (!channel) {
        channelStatus = '❌ Channel not found in this server.';
      } else if (channel.type !== ChannelType.GuildText) {
        channelStatus = '❌ Target channel must be a standard text channel.';
      } else {
        const textChannel = channel as TextChannel;
        const botMember = guild.members.me ?? await guild.members.fetch(interaction.client.user.id).catch(() => null);
        
        if (!botMember) {
          channelStatus = '❌ Could not resolve bot member details.';
        } else {
          const perms = textChannel.permissionsFor(botMember);
          const hasView = perms.has(PermissionFlagsBits.ViewChannel);
          const hasSend = perms.has(PermissionFlagsBits.SendMessages);
          const hasEmbed = perms.has(PermissionFlagsBits.EmbedLinks);

          if (hasView && hasSend && hasEmbed) {
            channelStatus = `✅ Permissions OK (View, Send, Embed)`;
            channelOk = true;
          } else {
            const missing: string[] = [];
            if (!hasView) missing.push('`View Channel`');
            if (!hasSend) missing.push('`Send Messages`');
            if (!hasEmbed) missing.push('`Embed Links`');
            channelStatus = `❌ Missing Permissions: ${missing.join(', ')}`;
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      channelStatus = `❌ Error resolving channel: \`${msg}\``;
    }

    // 2. Check feed connectivity
    try {
      // Direct HEAD/GET check
      const response = await axios.head(sub.feed_url, { timeout: 5000 }).catch(() => null);
      if (response && response.status === 200) {
        feedStatus = '✅ Connection OK (HTTP 200)';
        feedOk = true;
      } else {
        // Fallback to GET in case HEAD is not allowed
        const getResponse = await axios.get(sub.feed_url, { timeout: 5000, headers: { 'Range': 'bytes=0-100' } }).catch(() => null);
        if (getResponse && getResponse.status >= 200 && getResponse.status < 400) {
          feedStatus = `✅ Connection OK (HTTP ${getResponse.status})`;
          feedOk = true;
        } else {
          feedStatus = `⚠️ Failed connection check (HTTP ${response?.status ?? getResponse?.status ?? 'timeout/error'})`;
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      feedStatus = `⚠️ URL Unreachable: \`${msg.slice(0, 100)}\``;
    }

    // Add field for this subscription
    const statusColor = (channelOk && feedOk) ? '🟢' : (channelOk || feedOk) ? '🟡' : '🔴';
    embed.addFields({
      name: `${statusColor} Sub #${sub.id}: ${alertLabel}`,
      value: 
        `**Feed:** \`${sub.feed_url.slice(0, 60)}${sub.feed_url.length > 60 ? '...' : ''}\`\n` +
        `**Channel:** <#${sub.channel_id}>\n` +
        `**Channel Status:** ${channelStatus}\n` +
        `**Connectivity:** ${feedStatus}`,
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}
