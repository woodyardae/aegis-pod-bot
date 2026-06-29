import express from 'express';
import session from 'express-session';
import createSqliteStore from 'connect-sqlite3';
import axios from 'axios';
import { Client, TextChannel } from 'discord.js';
import * as path from 'path';
import {
  getSubscriptionsByGuild,
  addSubscription,
  removeSubscriptionById,
  updateSubscriptionById,
  getChapterMetadata,
  setChapterMetadata,
  isCommentPushed,
  markCommentPushed
} from '../db/database';
import { getEpisodesList } from '../modules/feed-scanner';
import { getNostrEventHexId, fetchNostrComments } from '../modules/nostr-client';
import { buildNostrCommentEmbed } from '../embeds/embeds';

const SQLiteStore = createSqliteStore(session);

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DASHBOARD_REDIRECT_URI = process.env.DASHBOARD_REDIRECT_URI;
const SESSION_SECRET = process.env.DASHBOARD_SESSION_SECRET ?? 'aegis-secret-key-1337';
const PORT = parseInt(process.env.DASHBOARD_PORT ?? process.env.PORT ?? '3050', 10);

export function startDashboardServer(client: Client): express.Application {
  const app = express();

  app.use(express.json());

  // Configure SQLite stateful session store
  app.use(
    session({
      store: new SQLiteStore({
        db: 'sessions.db',
        dir: './data',
      }) as any,
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    })
  );

  // Serve static public assets
  const publicPath = path.join(__dirname, 'public');
  app.use(express.static(publicPath));

  // ─── Middleware ────────────────────────────────────────────────────────────

  const authRequired = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const sess = req.session as any;
    if (!sess.userId) {
      return res.status(401).json({ error: 'Unauthorized: Login required' });
    }
    next();
  };

  const verifyGuildAccess = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const sess = req.session as any;
    const { guildId } = req.params;
    if (!sess.managedGuildIds || !sess.managedGuildIds.includes(guildId)) {
      return res.status(403).json({ error: 'Forbidden: You do not manage this server' });
    }
    next();
  };

  // ─── API Routes ────────────────────────────────────────────────────────────

  // Initiate Discord OAuth2 Flow
  app.get('/api/auth/login', (req, res) => {
    if (!DISCORD_CLIENT_ID || !DASHBOARD_REDIRECT_URI) {
      return res.status(500).send('Server configuration error: OAuth credentials missing.');
    }
    const state = Math.random().toString(36).substring(2);
    (req.session as any).oauthState = state;

    const authorizeUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(
      DASHBOARD_REDIRECT_URI
    )}&response_type=code&scope=identify%20guilds&state=${state}`;

    res.redirect(authorizeUrl);
  });

  // OAuth2 Callback Handler
  app.get('/api/auth/callback', async (req, res) => {
    const { code, state } = req.query;
    const sess = req.session as any;

    if (!code || state !== sess.oauthState) {
      return res.status(400).send('OAuth callback verification failed: invalid state or code.');
    }

    try {
      if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !DASHBOARD_REDIRECT_URI) {
        throw new Error('OAuth configuration variables are not set.');
      }

      // Exchange authorization code for tokens
      const tokenResponse = await axios.post(
        'https://discord.com/api/oauth2/token',
        new URLSearchParams({
          client_id: DISCORD_CLIENT_ID,
          client_secret: DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code: code as string,
          redirect_uri: DASHBOARD_REDIRECT_URI,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const { access_token, token_type } = tokenResponse.data;

      // Fetch user profile
      const userResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: { Authorization: `${token_type} ${access_token}` },
      });

      // Save user state in session
      sess.userId = userResponse.data.id;
      sess.username = `${userResponse.data.username}${
        userResponse.data.discriminator && userResponse.data.discriminator !== '0'
          ? '#' + userResponse.data.discriminator
          : ''
      }`;
      sess.avatar = userResponse.data.avatar;
      sess.accessToken = access_token;
      sess.tokenType = token_type;

      // Pre-fetch managed guilds to store in session for authorization
      const guildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `${token_type} ${access_token}` },
      });

      const adminGuilds = guildsResponse.data.filter((g: any) => {
        const perms = BigInt(g.permissions);
        const MANAGE_GUILD = BigInt(0x20);
        const ADMINISTRATOR = BigInt(0x8);
        return (perms & MANAGE_GUILD) === MANAGE_GUILD || (perms & ADMINISTRATOR) === ADMINISTRATOR;
      });

      sess.managedGuildIds = adminGuilds.map((g: any) => g.id);

      res.redirect('/');
    } catch (err: any) {
      console.error('[Dashboard] OAuth2 Callback Error:', err.response?.data || err.message || err);
      res.status(500).send('Authentication failed.');
    }
  });

  // Get current logged in user details
  app.get('/api/auth/user', (req, res) => {
    const sess = req.session as any;
    if (!sess.userId) {
      return res.json({ loggedIn: false });
    }
    res.json({
      loggedIn: true,
      user: {
        id: sess.userId,
        username: sess.username,
        avatarUrl: sess.avatar
          ? `https://cdn.discordapp.com/avatars/${sess.userId}/${sess.avatar}.png`
          : null,
      },
    });
  });

  // Logout route
  app.get('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('[Dashboard] Session destroy failed:', err);
      }
      res.redirect('/');
    });
  });

  // List user's servers where they have ManageGuild permissions
  app.get('/api/guilds', authRequired, async (req, res) => {
    const sess = req.session as any;
    try {
      const guildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `${sess.tokenType} ${sess.accessToken}` },
      });

      const adminGuilds = guildsResponse.data.filter((g: any) => {
        const perms = BigInt(g.permissions);
        const MANAGE_GUILD = BigInt(0x20);
        const ADMINISTRATOR = BigInt(0x8);
        return (perms & MANAGE_GUILD) === MANAGE_GUILD || (perms & ADMINISTRATOR) === ADMINISTRATOR;
      });

      // Update session cache in case permissions changed
      sess.managedGuildIds = adminGuilds.map((g: any) => g.id);

      const results = adminGuilds.map((g: any) => {
        const isBotPresent = client.guilds.cache.has(g.id);
        const inviteUrl = isBotPresent
          ? null
          : `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&permissions=3072&scope=bot%20applications.commands&guild_id=${g.id}&disable_guild_select=true`;

        return {
          id: g.id,
          name: g.name,
          iconUrl: g.icon
            ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`
            : null,
          botPresent: isBotPresent,
          inviteUrl,
        };
      });

      res.json(results);
    } catch (err: any) {
      console.error('[Dashboard] Fetch guilds failed:', err.message);
      res.status(500).json({ error: 'Failed to retrieve servers list.' });
    }
  });

  // Get active text channels for a guild (where bot has permissions to send messages)
  app.get('/api/guilds/:guildId/channels', authRequired, verifyGuildAccess, async (req, res) => {
    const { guildId } = req.params;
    const guild = client.guilds.cache.get(guildId as string);
    if (!guild) {
      return res.status(404).json({ error: 'Bot is not in this server.' });
    }

    try {
      const channels = guild.channels.cache
        .filter((c) => c.isTextBased())
        .map((c) => ({
          id: c.id,
          name: c.name,
        }));
      res.json(channels);
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve channels.' });
    }
  });

  // Get subscriptions for a specific server
  app.get('/api/guilds/:guildId/subscriptions', authRequired, verifyGuildAccess, (req, res) => {
    const { guildId } = req.params;
    try {
      const subs = getSubscriptionsByGuild(guildId as string);
      res.json(subs);
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve subscriptions.' });
    }
  });

  // Create a new subscription
  app.post('/api/guilds/:guildId/subscriptions', authRequired, verifyGuildAccess, async (req, res) => {
    const { guildId } = req.params;
    const { feedUrl, channelId, alertType, alias, minBoostSats, theme } = req.body;

    if (!feedUrl || !channelId || !alertType) {
      return res.status(400).json({ error: 'Missing required subscription fields: feedUrl, channelId, alertType' });
    }

    if (alertType !== 'NEW_EPISODE' && alertType !== 'BOOSTAGRAM') {
      return res.status(400).json({ error: 'alertType must be either NEW_EPISODE or BOOSTAGRAM' });
    }

    // Verify channel exists in the guild and is text-based
    const guild = client.guilds.cache.get(guildId as string);
    if (!guild) {
      return res.status(400).json({ error: 'Bot is not in this server' });
    }
    const channel = guild.channels.cache.get(channelId);
    if (!channel || !channel.isTextBased()) {
      return res.status(400).json({ error: 'Invalid channel ID specified' });
    }

    try {
      addSubscription(
        guildId as string,
        feedUrl,
        channelId,
        alertType,
        alias || null,
        minBoostSats || 0,
        theme || 'aegis'
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to add subscription' });
    }
  });

  // Update an existing subscription
  app.put('/api/guilds/:guildId/subscriptions/:subscriptionId', authRequired, verifyGuildAccess, async (req, res) => {
    const { guildId, subscriptionId } = req.params;
    const { channelId, minBoostSats, theme } = req.body;

    if (!channelId || minBoostSats === undefined || !theme) {
      return res.status(400).json({ error: 'Missing update fields: channelId, minBoostSats, theme' });
    }

    const subId = parseInt(subscriptionId as string, 10);
    if (isNaN(subId)) {
      return res.status(400).json({ error: 'Invalid subscription ID' });
    }

    // Verify channel exists in the guild and is text-based
    const guild = client.guilds.cache.get(guildId as string);
    if (!guild) {
      return res.status(400).json({ error: 'Bot is not in this server' });
    }
    const channel = guild.channels.cache.get(channelId);
    if (!channel || !channel.isTextBased()) {
      return res.status(400).json({ error: 'Invalid channel ID specified' });
    }

    try {
      updateSubscriptionById(subId, guildId as string, channelId, minBoostSats, theme);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update subscription' });
    }
  });

  // Delete a subscription
  app.delete('/api/guilds/:guildId/subscriptions/:subscriptionId', authRequired, verifyGuildAccess, (req, res) => {
    const { guildId, subscriptionId } = req.params;

    const subId = parseInt(subscriptionId as string, 10);
    if (isNaN(subId)) {
      return res.status(400).json({ error: 'Invalid subscription ID' });
    }

    try {
      removeSubscriptionById(subId, guildId as string);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete subscription' });
    }
  });

  // Get list of episodes for a feed
  app.get('/api/guilds/:guildId/episodes', authRequired, verifyGuildAccess, async (req, res) => {
    const feedUrl = req.query.feedUrl as string | undefined;
    if (!feedUrl || typeof feedUrl !== 'string') {
      return res.status(400).json({ error: 'Missing feedUrl query parameter' });
    }
    try {
      const list = await getEpisodesList(feedUrl);
      res.json(list);
    } catch (err: any) {
      console.error('[Dashboard] Error fetching episodes list:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch episodes list' });
    }
  });

  // Get chapters for an episode and merge with database custom metadata
  app.get('/api/guilds/:guildId/episodes/:episodeGuid/chapters', authRequired, verifyGuildAccess, async (req, res) => {
    const { episodeGuid } = req.params as { episodeGuid: string };
    const { feedUrl, chaptersUrl } = req.query as { feedUrl?: string; chaptersUrl?: string };
    if (!feedUrl || typeof feedUrl !== 'string') {
      return res.status(400).json({ error: 'Missing feedUrl query parameter' });
    }

    try {
      let chaptersList: any[] = [];
      let version = '1.2.0';

      if (chaptersUrl && typeof chaptersUrl === 'string') {
        const response = await axios.get(chaptersUrl, { timeout: 8000 });
        if (response.data && Array.isArray(response.data.chapters)) {
          chaptersList = response.data.chapters;
          if (response.data.version) {
            version = response.data.version;
          }
        }
      }

      const customMeta = getChapterMetadata(feedUrl, episodeGuid);
      const customMetaMap = new Map(customMeta.map(m => [m.chapter_index, m]));

      const mergedChapters = chaptersList.map((chap, index) => {
        const meta = customMetaMap.get(index);
        return {
          ...chap,
          customLinkTitle: meta?.link_title ?? null,
          customLinkUrl: meta?.link_url ?? null,
          customNotes: meta?.notes ?? null,
        };
      });

      res.json({ version, chapters: mergedChapters });
    } catch (err: any) {
      console.error('[Dashboard] Error fetching/merging chapters:', err.message);
      res.status(500).json({ error: err.message || 'Failed to fetch chapters' });
    }
  });

  // Save custom metadata for an episode's chapter
  app.post('/api/guilds/:guildId/episodes/:episodeGuid/chapters/:chapterIndex/metadata', authRequired, verifyGuildAccess, (req, res) => {
    const { episodeGuid, chapterIndex } = req.params as { episodeGuid: string; chapterIndex: string };
    const { feedUrl, linkTitle, linkUrl, notes } = req.body;

    if (!feedUrl || typeof feedUrl !== 'string') {
      return res.status(400).json({ error: 'Missing feedUrl in request body' });
    }

    const idx = parseInt(chapterIndex, 10);
    if (isNaN(idx)) {
      return res.status(400).json({ error: 'Invalid chapterIndex' });
    }

    try {
      setChapterMetadata(feedUrl, episodeGuid, idx, linkTitle || null, linkUrl || null, notes || null);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Dashboard] Error saving chapter metadata:', err);
      res.status(500).json({ error: err.message || 'Failed to save chapter metadata' });
    }
  });

  // Get Nostr comments for an episode
  app.get('/api/guilds/:guildId/episodes/:episodeGuid/comments', authRequired, verifyGuildAccess, async (req, res) => {
    const { guildId, episodeGuid } = req.params as { guildId: string; episodeGuid: string };
    let { feedUrl, nostrUri } = req.query as { feedUrl?: string; nostrUri?: string };

    try {
      if (!nostrUri && feedUrl && typeof feedUrl === 'string') {
        const episodes = await getEpisodesList(feedUrl);
        const ep = episodes.find(e => e.guid === episodeGuid);
        if (ep && ep.socialInteract) {
          const nostrConfig = ep.socialInteract.find(
            si => si.protocol === 'nostr' || si.uri?.includes('note1') || si.uri?.includes('nevent1')
          );
          if (nostrConfig) {
            nostrUri = nostrConfig.uri;
          }
        }
      }

      if (!nostrUri || typeof nostrUri !== 'string') {
        return res.json([]);
      }

      const hexId = getNostrEventHexId(nostrUri);
      const comments = await fetchNostrComments(hexId);

      const results = comments.map(c => ({
        ...c,
        pushed: isCommentPushed(guildId, c.id)
      }));

      res.json(results);
    } catch (err: any) {
      console.error('[Dashboard] Error fetching Nostr comments:', err.message);
      res.status(500).json({ error: err.message || 'Failed to fetch comments' });
    }
  });

  // Push a Nostr comment to Discord
  app.post('/api/guilds/:guildId/episodes/:episodeGuid/comments/:commentId/push', authRequired, verifyGuildAccess, async (req, res) => {
    const { guildId, episodeGuid, commentId } = req.params as { guildId: string; episodeGuid: string; commentId: string };
    const { feedUrl, episodeTitle, showTitle, authorName, authorAvatar, content, pubkey, createdAt } = req.body;

    if (!feedUrl) {
      return res.status(400).json({ error: 'Missing feedUrl in request body' });
    }
    if (!authorName || !content || !pubkey) {
      return res.status(400).json({ error: 'Missing Nostr comment fields (authorName, content, pubkey)' });
    }

    try {
      const subs = getSubscriptionsByGuild(guildId);
      let sub = subs.find(s => s.feed_url === feedUrl);
      if (!sub && subs.length > 0) {
        sub = subs[0];
      }
      if (!sub) {
        return res.status(400).json({ error: 'No subscription channel configured for this server.' });
      }

      const channelId = sub.channel_id;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        return res.status(404).json({ error: 'Bot is not in this server.' });
      }
      const channel = guild.channels.cache.get(channelId);
      if (!channel || !channel.isTextBased()) {
        return res.status(400).json({ error: 'Alert channel is not text-based or is invalid.' });
      }

      const embed = buildNostrCommentEmbed({
        showTitle: showTitle || sub.alias || 'Podcast',
        episodeTitle: episodeTitle || 'Unknown Episode',
        authorName,
        authorAvatar: authorAvatar || null,
        content,
        pubkey,
        createdAt: parseInt(createdAt, 10) || Math.floor(Date.now() / 1000)
      });

      await (channel as TextChannel).send({ embeds: [embed] });
      markCommentPushed(guildId, commentId);

      res.json({ success: true });
    } catch (err: any) {
      console.error('[Dashboard] Error pushing Nostr comment to Discord:', err);
      res.status(500).json({ error: err.message || 'Failed to push comment' });
    }
  });


  // Get public Agora room details (now playing, presence, next-up)
  app.get('/api/public/rooms/:roomId', async (req, res) => {
    const { roomId } = req.params;
    try {
      const { agoraRoomManager } = await import('../modules/agora-room');
      const { horaiScheduler } = await import('../modules/horai-scheduler');

      const room = agoraRoomManager.getRoom(roomId);
      if (!room) {
        return res.status(404).json({ error: 'Agora room is not active.' });
      }

      const extrapolatedPositionMs = agoraRoomManager.getExtrapolatedPlaybackPosition(roomId);
      const upcoming = horaiScheduler.getUpcomingSchedule(roomId, Date.now(), 3);

      res.json({
        roomId: room.roomId,
        feedUrl: room.feedUrl,
        episodeGuid: room.episodeGuid,
        episodeTitle: room.episodeTitle,
        isPlaying: room.isPlaying,
        startedAt: room.startedAt,
        hostUserId: room.hostUserId,
        listeners: room.listeners,
        extrapolatedPositionMs,
        upcoming,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch public room state' });
    }
  });

  // System Health observability endpoint (Asphaleia)
  app.get('/health', (req, res) => {
    try {
      const { telemetry } = require('../modules/telemetry');
      const report = telemetry.getHealthReport();
      
      // Return 200 for healthy, 503 for degraded or down
      const statusCode = report.status === 'HEALTHY' ? 200 : 503;
      res.status(statusCode).json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to generate health report' });
    }
  });

  // Fallback for Single Page App router

  app.get('*all', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Dashboard] Embedded Web Dashboard listening on port ${PORT}`);
  });

  return app;
}
