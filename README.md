---
category: software
project: aegis-pod-bot
status: active
tags:
  - podcasting2
  - v4v
  - discord
  - boostagram
  - lightning
updated_at: "2026-06-26"
---

# aegis-pod-bot ⚡🎙️

> The Podcasting 2.0 / V4V Discord Bot — part of the Aegis OS ecosystem.

A Discord bot that surfaces live Podcasting 2.0 activity inside your podcast community server:
- 🎙️ **Episode Announcer** — auto-posts new episodes the moment they drop
- ⚡ **Boostagram Live Feed** — real-time Lightning boost alerts in your server
- 📊 **V4V Earnings Summary** — daily/weekly/monthly earnings overview
- 🏆 **PC2.0 Status Card** — full Podcasting 2.0 compliance scorecard for any feed

> [!IMPORTANT]
> **🤖 FOR AI AGENTS:** This repository is governed by the STAX Operating System. Read `ops/` before taking any action.

## Slash Commands

| Command | Description |
|---|---|
| `/status [feed_url]` | PC2.0 compliance status card for any podcast feed (leave empty for system diagnostics) |
| `/watch add [feed_url] [#channel]` | Subscribe to new episode announcements |
| `/watch remove [feed_url]` | Unsubscribe |
| `/watch list` | List all episode watches |
| `/boosts add [feed_url] [#channel]` | Subscribe to live boostagram alerts |
| `/boosts remove [feed_url]` | Unsubscribe |
| `/boosts list` | List all boostagram watches |
| `/earnings [feed_url] [period]` | V4V earnings summary (day/week/month) |
| `/verify` | Run permission audits, connection connectivity, and check feed status |
| `/setup` | Launch the step-by-step interactive onboarding setup wizard |
| `/setup-channels` | Auto-generate a secure read-only `Aegis Podcasting` category and channels |

## Quick Start

### 1. Prerequisites
- Node.js >= 20
- A Discord bot application ([Developer Portal](https://discord.com/developers))
- A Podcast Index API key ([podcastindex.org/developer](https://podcastindex.org/developer))
- (Optional) An Alby access token for boostagram polling ([getalby.com](https://getalby.com))

### 2. Discord Bot Invite & Minimal Scopes
To adhere to the **least-privilege model**, do NOT request Administrator privileges. In the Discord Developer Portal under **OAuth2 > URL Generator**, configure:
* **Scopes:** `bot`, `applications.commands`
* **Bot Permissions:**
  * **Text Permissions:** `Send Messages`, `Embed Links`, `Read Messages/View Channels`
  
Use the generated URL to invite the bot to your guild.

### 3. Install

```bash
git clone https://github.com/woodyardae/aegis-pod-bot.git
cd aegis-pod-bot
npm install
```

### 3. Configure

```bash
cp .env.example .env
# Edit .env with your tokens
```

Required env vars:
- `DISCORD_TOKEN` — from Discord Developer Portal
- `DISCORD_CLIENT_ID` — from Discord Developer Portal
- `PODCAST_INDEX_API_KEY` + `PODCAST_INDEX_API_SECRET` — from podcastindex.org/developer

Optional:
- `ALBY_ACCESS_TOKEN` — for boostagram polling (without this, `/boosts` will not receive live alerts)
- `AEGIS_OS_WS_URL` — WebSocket URL for live podping events (default: aegis-os on chantecler-01)

### 4. Build and Register Commands

```bash
npm run build
npm run deploy-commands
```

### 5. Run

```bash
npm start
# or for development:
npm run dev
```

## Architecture

```
aegis-pod-bot  →  Podcast Index API   (feed lookup, search)
               →  RSS feeds           (episode polling)
               →  Alby API            (boostagram polling)
               →  aegis-os WebSocket  (live podping events)
               →  SQLite              (guild subscriptions, dedup cache)
```

**Core data principles:**
- Wallets own balances. The bot is transport/presentation only — never custody.
- Podcast Index / feed owners own feed truth. Bot reflects, never authors.
- Fail closed on payment ambiguity: boostagrams with zero or negative amounts are silently dropped and logged.
- Least privilege: bot reads from APIs only. No write access to any external service.

## Part of Aegis OS

| Repo | Role |
|---|---|
| `aegis-os` | The Open Podcast Operating System — data backend, PC2.0 scorer, Alby integration |
| `aegis-pod-bot` | This repo — Discord community integration layer |
| `podping.alpha` | Rust P2P gossip podping node — Phase 2+ live event source |

## License

Apache-2.0
