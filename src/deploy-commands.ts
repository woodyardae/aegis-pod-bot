/**
 * Discord slash command registration script.
 * Run this ONCE to register commands globally (or per-guild for faster dev updates).
 *
 * Usage:
 *   npm run deploy-commands
 *
 * Requires: DISCORD_TOKEN and DISCORD_CLIENT_ID in .env
 */
import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import * as statusCmd        from './commands/status';
import * as watchCmd         from './commands/watch';
import * as boostsCmd        from './commands/boosts';
import * as earningsCmd      from './commands/earnings';
import * as verifyCmd        from './commands/verify';
import * as setupCmd         from './commands/setup';
import * as setupChannelsCmd from './commands/setup-channels';
import * as agoraCmd         from './commands/agora';

const TOKEN     = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error('[FATAL] DISCORD_TOKEN and DISCORD_CLIENT_ID must be set in .env');
  process.exit(1);
}

const commands = [statusCmd, watchCmd, boostsCmd, earningsCmd, verifyCmd, setupCmd, setupChannelsCmd, agoraCmd].map((cmd) =>
  cmd.data.toJSON()
);

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log(`[Deploy] Registering ${commands.length} slash commands globally...`);
    const data = await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    ) as unknown[];
    console.log(`[Deploy] Successfully registered ${data.length} commands.`);
    console.log('[Deploy] Commands:');
    for (const cmd of commands) {
      console.log(`  /${cmd.name} — ${cmd.description}`);
    }
  } catch (err) {
    console.error('[Deploy] Failed to register commands:', err);
    process.exit(1);
  }
})();
