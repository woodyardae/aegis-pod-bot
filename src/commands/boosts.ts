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
      .addStringOption((opt) =>
        opt.setName('alias').setDescription('Optional nickname/alias for this podcast show').setRequired(false)
      )
      .addIntegerOption((opt) =>
        opt.setName('min_boost_sats').setDescription('Minimum sat threshold to trigger alerts (e.g. 500)').setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName('theme')
          .setDescription('Color theme style for alert cards')
          .setRequired(false)
          .addChoices(
            { name: 'Apple Classic Light', value: 'apple-classic-light' },
            { name: 'Apple Rose Light',    value: 'apple-rose-light' },
            { name: 'Apple Mint Light',    value: 'apple-mint-light' },
            { name: 'Apple Sand Light',    value: 'apple-sand-light' },
            { name: 'Apple Mono Light',    value: 'apple-mono-light' },
            { name: 'Apple Classic Dark',  value: 'apple-classic-dark' },
            { name: 'Apple Rose Dark',     value: 'apple-rose-dark' },
            { name: 'Apple Mint Dark',     value: 'apple-mint-dark' },
            { name: 'Apple Sand Dark',     value: 'apple-sand-dark' },
            { name: 'Apple Mono Dark',     value: 'apple-mono-dark' },
            { name: 'VS Light',            value: 'vs-light' },
            { name: 'GitHub Light',        value: 'github-light' },
            { name: 'Xcode Light',         value: 'xcode-light' },
            { name: 'IntelliJ Light',      value: 'intellij-light' },
            { name: 'Solarized Light',     value: 'solarized-light' },
            { name: 'VS Code Dark',        value: 'vscode-dark' },
            { name: 'GitHub Dark',         value: 'github-dark' },
            { name: 'One Dark',            value: 'one-dark' },
            { name: 'Solarized Dark',      value: 'solarized-dark' },
            { name: 'Monokai',             value: 'monokai' },
          )
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
    const alias = interaction.options.getString('alias')?.trim() ?? null;
    const minBoostSats = interaction.options.getInteger('min_boost_sats') ?? 0;
    const theme = interaction.options.getString('theme') ?? 'aegis';

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

    addSubscription(interaction.guildId, feedUrl, channel.id, 'BOOSTAGRAM', alias, minBoostSats, theme);
    const displayShowName = alias ? `**${alias}**` : `**${feedUrl}**`;
    let successContent = `✅ Now watching ${displayShowName} for live boostagrams.\nAlerts will be posted in ${channel}.`;
    if (minBoostSats > 0) {
      successContent += `\n*Filter:* Only posting alerts for boosts **>= ${minBoostSats.toLocaleString()} sats**.`;
    }
    if (theme !== 'aegis') {
      successContent += `\n*Theme:* Styled with **${theme}** palette.`;
    }
    successContent += `\n\n⚡ Boostagrams are polled every 60 seconds via Alby. Make sure your \`ALBY_ACCESS_TOKEN\` is configured.`;

    await interaction.reply({ content: successContent });

    console.log(`[Boosts] Guild ${interaction.guildId} subscribed to BOOSTAGRAM for ${feedUrl} (alias: ${alias}, minBoostSats: ${minBoostSats}, theme: ${theme}) -> #${channel.name}`);
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

    const lines = subs.map((s) => {
      const showName = s.alias ? `**${s.alias}** (\`${s.feed_url}\`)` : `\`${s.feed_url}\``;
      let details = '';
      if (s.min_boost_sats > 0 || (s.theme && s.theme !== 'aegis')) {
        const parts = [];
        if (s.min_boost_sats > 0) parts.push(`threshold: >= ${s.min_boost_sats.toLocaleString()} sats`);
        if (s.theme && s.theme !== 'aegis') parts.push(`theme: ${s.theme}`);
        details = ` [${parts.join(', ')}]`;
      }
      return `• <#${s.channel_id}> → ${showName}${details}`;
    }).join('\n');
    await interaction.reply({ content: `**Boostagram watches for this server:**\n${lines}`, ephemeral: true });
  }
}
