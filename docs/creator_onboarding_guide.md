# Aegis Pod Bot — Creator Server Onboarding Guide

⚡🎙️ Welcome to the Aegis Pod Bot! This guide helps you set up your Discord server for automated Podcasting 2.0 episode announcements and live V4V boostagram feeds.

---

## 1. Create Your Channels

For a clean community layout, we recommend creating a dedicated category called **Aegis Podcasting** containing these three channels:

1.  📢 `#new-episodes` — Target channel for episode announcements.
2.  ⚡ `#boostagrams` — Target channel for live zaps/boosts and listener comments.
3.  📊 `#v4v-stats` — Channel to check periodic summaries (or you can run this command in a private admin-only channel).

> [!TIP]
> **Automated Channel Generation:** You can save time by running `/setup-channels`. The bot will automatically generate the `Aegis Podcasting` category and the channels, applying the correct read-only permissions for your members.

---

## 2. Invite the Bot (Least Privilege)

To protect your server's security, Aegis Pod Bot operates on a **least-privilege model**. It does **NOT** require the "Administrator" permission. 

### Invite URL Generation
1.  Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2.  Select your bot application, then click **OAuth2 > URL Generator**.
3.  Under **Scopes**, check:
    *   `bot`
    *   `applications.commands`
4.  Under **Bot Permissions** (in the Text Permissions column), check:
    *   `Read Messages/View Channels`
    *   `Send Messages`
    *   `Embed Links`
5.  Copy the generated URL and use it to add the bot to your server.

---

## 3. Configure Channel Subscriptions

Once the bot is in your server, you can configure the channel subscriptions either via the interactive wizard (recommended) or using individual slash commands:

### A. Recommended: Use the Onboarding Wizard
To configure your feed and channels in a single step, simply run:
```
/setup
```
The bot will launch a popup modal requesting your podcast's RSS feed URL, followed by select menus to choose your announcement and boostagram channels.

### B. Alternative: Configure Commands Manually
If you prefer to configure feeds manually, use these individual slash commands:

#### 1. Subscribe to Episode Alerts
```
/watch add feed_url: https://yourpodcast.com/rss.xml channel: #new-episodes
```

#### 2. Subscribe to Live Boostagrams
```
/boosts add feed_url: https://yourpodcast.com/rss.xml channel: #boostagrams
```
*(Note: Live boostagrams require setting up the `ALBY_ACCESS_TOKEN` in the bot's environment).*

---

## 4. Run the `/verify` Command

To verify that everything is configured correctly:
1.  In any channel, type `/verify`.
2.  The bot checks:
    *   Each active subscription.
    *   Target channel visibility and bot permissions (`View Channel`, `Send Messages`, `Embed Links`).
    *   HTTP connectivity from our servers to your podcast's RSS feed.
3.  The command returns a clean, detailed checklist embed:
    *   🟢 **Green** — Ready to go.
    *   🟡 **Yellow** — Channel permissions are correct, but connection to the RSS feed failed or timed out.
    *   🔴 **Red** — The bot cannot read or post to the configured channel. Check channel overrides.

---

## 5. View V4V Analytics & Health

*   **V4V Summaries:** Run `/earnings feed_url: <url> period: week` to see aggregated zaps, top boosters, and average zap sizes observed by the bot.
*   **System Diagnostics:** Run `/status` (with no arguments) to view system diagnostics, uptime, and operational telemetry.
