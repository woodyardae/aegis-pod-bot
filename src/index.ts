import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Collection,
  type ChatInputCommandInteraction,
  type SlashCommandBuilder,
  Events,
} from 'discord.js';
import { initDb } from './db/database';


// ── Environment validation ──────────────────────────────────────────────────
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) {
  console.error('[FATAL] DISCORD_TOKEN is not set. Bot cannot start.');
  process.exit(1);
}

// ── Command registry ────────────────────────────────────────────────────────
import * as statusCmd        from './commands/status';
import * as watchCmd         from './commands/watch';
import * as boostsCmd        from './commands/boosts';
import * as earningsCmd      from './commands/earnings';
import * as verifyCmd        from './commands/verify';
import * as setupCmd         from './commands/setup';
import * as setupChannelsCmd from './commands/setup-channels';

interface BotCommand {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

const commands = new Collection<string, BotCommand>();
for (const cmd of [statusCmd, watchCmd, boostsCmd, earningsCmd, verifyCmd, setupCmd, setupChannelsCmd]) {
  commands.set(cmd.data.name, cmd as BotCommand);
}

// ── Discord client ──────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

// ── Pollers ─────────────────────────────────────────────────────────────────
import { startEpisodePoller } from './pollers/episode-poller';
import { startBoostPoller }   from './pollers/boost-poller';
import { startPodpingConsumer } from './modules/podping-consumer';
import { getAllWatchedFeeds, getSubscribersByFeed } from './db/database';
import { buildEpisodeEmbed } from './embeds/embeds';
import { scanFeed } from './modules/feed-scanner';
import type { TextChannel } from 'discord.js';

// ── Ready ────────────────────────────────────────────────────────────────────
client.on(Events.ClientReady, (c) => {
  console.log(`[Bot] Logged in as ${c.user.tag}`);
  console.log(`[Bot] Serving ${c.guilds.cache.size} guild(s)`);

  // Start episode poller (RSS poll every 10 min)
  startEpisodePoller(client);

  // Start boost poller (Alby API every 60s)
  startBoostPoller(client);

  // Start podping consumer (aegis-os WebSocket — live blockchain podpings)
  // When a podping fires for a watched feed, trigger an immediate scan
  startPodpingConsumer(async (event) => {
    const feedUrl = event.feedUrl;
    if (!getAllWatchedFeeds('NEW_EPISODE').includes(feedUrl)) return;

    console.log(`[PodpingConsumer] Live podping for watched feed: ${feedUrl}`);
    try {
      const result = await scanFeed(feedUrl);
      const ep = result.latestEpisode;
      if (!ep?.guid) return;

      // episode-poller handles dedup — if already seen, it's a no-op
      // We just trigger the poller logic inline here
      const { isEpisodeSeen, markEpisodeSeen } = await import('./db/database');
      if (isEpisodeSeen(feedUrl, ep.guid)) return;

      markEpisodeSeen(feedUrl, ep.guid);
      const embed = buildEpisodeEmbed({
        showTitle: result.title,
        showImage: result.image,
        showUrl: result.link,
        episodeTitle: ep.title,
        episodeGuid: ep.guid,
        pubDate: ep.pubDate,
        enclosureUrl: ep.enclosureUrl,
        duration: ep.duration,
        episodeImage: ep.image,
        feedUrl,
        tags: { value: result.tags.value },
      });

      const subscribers = getSubscribersByFeed(feedUrl, 'NEW_EPISODE');
      for (const sub of subscribers) {
        const channel = await client.channels.fetch(sub.channel_id).catch(() => null) as TextChannel | null;
        if (channel?.isTextBased()) {
          await channel.send({ content: '🛰️ *Live podping detected!*', embeds: [embed] });
        }
      }
    } catch (err) {
      console.error(`[PodpingConsumer] Failed to process live podping for ${feedUrl}:`, err);
    }
  });
});

// ── Interaction handler ───────────────────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) {
    console.warn(`[Bot] Unknown command: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (err: unknown) {
    const { telemetry } = await import('./modules/telemetry');
    telemetry.categorizeAndRecord(err, `command execute /${interaction.commandName}`);
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Bot] Error executing /${interaction.commandName}: ${msg}`);

    const reply = { content: '❌ Something went wrong. Please try again.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply).catch(() => null);
    } else {
      await interaction.reply(reply).catch(() => null);
    }
  }
});

// ── Process error guards ──────────────────────────────────────────────────────
process.on('unhandledRejection', (err) => {
  console.error('[Process] Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught exception:', err);
  process.exit(1);
});

// ── Connect ───────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('[Bot] Initializing database...');
  await initDb();
  console.log('[Bot] Database ready. Connecting to Discord...');
  await client.login(DISCORD_TOKEN);
}

void main();
