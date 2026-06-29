import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
} from 'discord.js';
import { agoraRoomManager } from '../modules/agora-room';
import { buildAgoraRoomEmbed } from '../embeds/embeds';

export const data = new SlashCommandBuilder()
  .setName('agora')
  .setDescription('Control or check the live Agora Listening Room')
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) =>
    sub.setName('status').setDescription('Show the current Agora Listening Room status')
  )
  .addSubcommand((sub) =>
    sub
      .setName('join')
      .setDescription('Join the listening room presence list with optional V4V details')
      .addStringOption((opt) =>
        opt
          .setName('nostr_pubkey')
          .setDescription('Your Nostr pubkey (hex or npub)')
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName('wallet_address')
          .setDescription('Your Lightning wallet address (LNURL/email)')
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('leave').setDescription('Leave the listening room presence list')
  )
  .addSubcommand((sub) =>
    sub.setName('start').setDescription('Start room audio playback (Host only)')
  )
  .addSubcommand((sub) =>
    sub.setName('stop').setDescription('Stop room audio playback (Host only)')
  )
  .addSubcommand((sub) =>
    sub
      .setName('seek')
      .setDescription('Seek to a specific playback position (Host only)')
      .addIntegerOption((opt) =>
        opt
          .setName('position_seconds')
          .setDescription('Position to seek to in seconds')
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();
  const userId = interaction.user.id;
  const username = interaction.user.username;

  if (sub === 'status') {
    const room = agoraRoomManager.getRoom(guildId);
    if (!room) {
      await interaction.reply({
        content: '📻 No active Agora Listening Room in this server. Use `/agora join` to initialize one.',
        ephemeral: true,
      });
      return;
    }
    const pos = agoraRoomManager.getExtrapolatedPlaybackPosition(guildId);
    const embed = buildAgoraRoomEmbed(room, pos);
    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (sub === 'join') {
    const nostrPubkey = interaction.options.getString('nostr_pubkey') ?? undefined;
    const walletAddress = interaction.options.getString('wallet_address') ?? undefined;

    const room = agoraRoomManager.joinRoom(guildId, {
      userId,
      username,
      nostrPubkey,
      walletAddress,
    });

    const pos = agoraRoomManager.getExtrapolatedPlaybackPosition(guildId);
    const embed = buildAgoraRoomEmbed(room, pos);
    await interaction.reply({
      content: `✅ Successfully joined the Agora Listening Room presence list!`,
      embeds: [embed],
    });
    return;
  }

  if (sub === 'leave') {
    const room = agoraRoomManager.leaveRoom(guildId, userId);
    if (!room) {
      await interaction.reply({ content: '❌ Room not found.', ephemeral: true });
      return;
    }
    await interaction.reply({ content: `👋 Left the presence list.` });
    return;
  }

  if (sub === 'start') {
    const room = agoraRoomManager.getRoom(guildId);
    if (!room) {
      await interaction.reply({ content: '❌ No active room found.', ephemeral: true });
      return;
    }
    if (room.hostUserId !== userId) {
      await interaction.reply({
        content: `❌ Only the host (<@${room.hostUserId || ''}>) can start playback.`,
        ephemeral: true,
      });
      return;
    }
    agoraRoomManager.updatePlaybackState(guildId, userId, true, room.playbackPositionMs);
    await interaction.reply({ content: `🟢 Started room playback.` });
    return;
  }

  if (sub === 'stop') {
    const room = agoraRoomManager.getRoom(guildId);
    if (!room) {
      await interaction.reply({ content: '❌ No active room found.', ephemeral: true });
      return;
    }
    if (room.hostUserId !== userId) {
      await interaction.reply({
        content: `❌ Only the host (<@${room.hostUserId || ''}>) can stop playback.`,
        ephemeral: true,
      });
      return;
    }
    agoraRoomManager.updatePlaybackState(guildId, userId, false, room.playbackPositionMs);
    await interaction.reply({ content: `🔴 Stopped room playback.` });
    return;
  }

  if (sub === 'seek') {
    const seconds = interaction.options.getInteger('position_seconds', true);
    const room = agoraRoomManager.getRoom(guildId);
    if (!room) {
      await interaction.reply({ content: '❌ No active room found.', ephemeral: true });
      return;
    }
    if (room.hostUserId !== userId) {
      await interaction.reply({
        content: `❌ Only the host (<@${room.hostUserId || ''}>) can seek.`,
        ephemeral: true,
      });
      return;
    }
    agoraRoomManager.hostSeek(guildId, userId, seconds * 1000);
    await interaction.reply({ content: `⏭️ Seeked to \`${seconds}s\`.` });
    return;
  }
}
