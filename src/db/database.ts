/**
 * SQLite database layer using sql.js (pure WebAssembly — no native compile required).
 *
 * sql.js loads the WASM binary, then provides a synchronous in-memory database.
 * We persist to disk manually after each write operation.
 *
 * All writes are synchronous and fail-closed.
 * See schema comments for data ownership and authority notes.
 */
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = process.env.DB_PATH ?? './data/bot.db';
const STATUS_CACHE_TTL_MS = parseInt(process.env.STATUS_CACHE_TTL_MS ?? '3600000', 10);

// Ensure data directory exists
const dataDir = path.dirname(path.resolve(DB_PATH));
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let SQL: SqlJsStatic;
let db: Database;

/** Initialize sql.js and open (or create) the database file. */
export async function initDb(): Promise<void> {
  SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON;');
  createSchema();
  persist(); // Initial persist to create file
}

/** Persist in-memory database to disk. Call after every write. */
function persist(): void {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ─── Schema ────────────────────────────────────────────────────────────────

function createSchema(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS guild_subscriptions (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id       TEXT NOT NULL,
      feed_url       TEXT NOT NULL,
      channel_id     TEXT NOT NULL,
      alert_type     TEXT NOT NULL CHECK(alert_type IN ('NEW_EPISODE', 'BOOSTAGRAM')),
      alias          TEXT,
      min_boost_sats INTEGER NOT NULL DEFAULT 0,
      theme          TEXT NOT NULL DEFAULT 'aegis',
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(guild_id, feed_url, alert_type)
    );

    CREATE TABLE IF NOT EXISTS episode_seen (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      feed_url     TEXT NOT NULL,
      episode_guid TEXT NOT NULL,
      seen_at      TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(feed_url, episode_guid)
    );

    -- IMPORTANT: This table is best-effort observation only.
    -- The wallet is the authoritative ledger. This table is NOT authoritative.
    CREATE TABLE IF NOT EXISTS boostagram_cache (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      feed_url       TEXT NOT NULL,
      payment_hash   TEXT UNIQUE,
      sender_alias   TEXT,
      amount_sats    INTEGER NOT NULL CHECK(amount_sats > 0),
      message        TEXT,
      app_name       TEXT,
      episode_title  TEXT,
      episode_guid   TEXT,
      received_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS status_cache (
      feed_url    TEXT PRIMARY KEY,
      result_json TEXT NOT NULL,
      cached_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chapter_metadata (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      feed_url      TEXT NOT NULL,
      episode_guid  TEXT NOT NULL,
      chapter_index INTEGER NOT NULL,
      link_title    TEXT,
      link_url      TEXT,
      notes         TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(feed_url, episode_guid, chapter_index)
    );

    CREATE TABLE IF NOT EXISTS pushed_comments (
      guild_id      TEXT NOT NULL,
      event_id      TEXT NOT NULL,
      pushed_at     TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (guild_id, event_id)
    );

    CREATE INDEX IF NOT EXISTS idx_subscriptions_guild ON guild_subscriptions(guild_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_feed  ON guild_subscriptions(feed_url);
    CREATE INDEX IF NOT EXISTS idx_boosts_feed         ON boostagram_cache(feed_url);
    CREATE INDEX IF NOT EXISTS idx_boosts_received     ON boostagram_cache(received_at);
    CREATE INDEX IF NOT EXISTS idx_chapters_feed_guid  ON chapter_metadata(feed_url, episode_guid);
  `);

  // Dynamic migration: add columns to guild_subscriptions if they don't exist
  try {
    const info = db.exec("PRAGMA table_info(guild_subscriptions);");
    let hasAlias = false;
    let hasMinBoostSats = false;
    let hasTheme = false;
    if (info.length > 0) {
      const nameIndex = info[0].columns.indexOf('name');
      if (nameIndex !== -1) {
        hasAlias = info[0].values.some((row) => row[nameIndex] === 'alias');
        hasMinBoostSats = info[0].values.some((row) => row[nameIndex] === 'min_boost_sats');
        hasTheme = info[0].values.some((row) => row[nameIndex] === 'theme');
      }
    }
    if (!hasAlias) {
      console.log("[DB] Migrating: Adding 'alias' column to 'guild_subscriptions' table...");
      db.run("ALTER TABLE guild_subscriptions ADD COLUMN alias TEXT;");
    }
    if (!hasMinBoostSats) {
      console.log("[DB] Migrating: Adding 'min_boost_sats' column to 'guild_subscriptions' table...");
      db.run("ALTER TABLE guild_subscriptions ADD COLUMN min_boost_sats INTEGER NOT NULL DEFAULT 0;");
    }
    if (!hasTheme) {
      console.log("[DB] Migrating: Adding 'theme' column to 'guild_subscriptions' table...");
      db.run("ALTER TABLE guild_subscriptions ADD COLUMN theme TEXT NOT NULL DEFAULT 'aegis';");
    }
  } catch (err) {
    console.error("[DB] Failed to run migration check for setting columns:", err);
  }
}

// ─── Guild Subscriptions ────────────────────────────────────────────────────

export interface GuildSubscription {
  id: number;
  guild_id: string;
  feed_url: string;
  channel_id: string;
  alert_type: 'NEW_EPISODE' | 'BOOSTAGRAM';
  alias: string | null;
  min_boost_sats: number;
  theme: string;
  created_at: string;
}

export function addSubscription(
  guildId: string,
  feedUrl: string,
  channelId: string,
  alertType: 'NEW_EPISODE' | 'BOOSTAGRAM',
  alias?: string | null,
  minBoostSats?: number,
  theme?: string,
): void {
  db.run(
    `INSERT OR REPLACE INTO guild_subscriptions (guild_id, feed_url, channel_id, alert_type, alias, min_boost_sats, theme)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [guildId, feedUrl, channelId, alertType, alias ?? null, minBoostSats ?? 0, theme ?? 'aegis'],
  );
  persist();
}

export function removeSubscription(
  guildId: string,
  feedUrl: string,
  alertType: 'NEW_EPISODE' | 'BOOSTAGRAM',
): void {
  db.run(
    `DELETE FROM guild_subscriptions WHERE guild_id = ? AND feed_url = ? AND alert_type = ?`,
    [guildId, feedUrl, alertType],
  );
  persist();
}

export function removeSubscriptionById(id: number, guildId: string): void {
  db.run(
    `DELETE FROM guild_subscriptions WHERE id = ? AND guild_id = ?`,
    [id, guildId],
  );
  persist();
}

export function updateSubscriptionById(
  id: number,
  guildId: string,
  channelId: string,
  minBoostSats: number,
  theme: string,
): void {
  db.run(
    `UPDATE guild_subscriptions
     SET channel_id = ?, min_boost_sats = ?, theme = ?
     WHERE id = ? AND guild_id = ?`,
    [channelId, minBoostSats, theme, id, guildId],
  );
  persist();
}

function rowsFromResult<T>(result: ReturnType<Database['exec']>): T[] {
  if (!result.length || !result[0].values.length) return [];
  const { columns, values } = result[0];
  return values.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj as T;
  });
}

export function getSubscribersByFeed(feedUrl: string, alertType: string): GuildSubscription[] {
  const result = db.exec(
    `SELECT * FROM guild_subscriptions WHERE feed_url = ? AND alert_type = ?`,
    [feedUrl, alertType],
  );
  return rowsFromResult<GuildSubscription>(result);
}

export function getSubscriptionsByGuild(guildId: string): GuildSubscription[] {
  const result = db.exec(
    `SELECT * FROM guild_subscriptions WHERE guild_id = ?`,
    [guildId],
  );
  return rowsFromResult<GuildSubscription>(result);
}

export function getAllWatchedFeeds(alertType: string): string[] {
  const result = db.exec(
    `SELECT DISTINCT feed_url FROM guild_subscriptions WHERE alert_type = ?`,
    [alertType],
  );
  if (!result.length) return [];
  return result[0].values.map((row) => row[0] as string);
}

// ─── Episode Seen ───────────────────────────────────────────────────────────

export function markEpisodeSeen(feedUrl: string, guid: string): void {
  db.run(
    `INSERT OR IGNORE INTO episode_seen (feed_url, episode_guid) VALUES (?, ?)`,
    [feedUrl, guid],
  );
  persist();
}

export function isEpisodeSeen(feedUrl: string, guid: string): boolean {
  const result = db.exec(
    `SELECT 1 FROM episode_seen WHERE feed_url = ? AND episode_guid = ?`,
    [feedUrl, guid],
  );
  return result.length > 0 && result[0].values.length > 0;
}

// ─── Boostagram Cache ───────────────────────────────────────────────────────

export interface BoostagramRecord {
  id: number;
  feed_url: string;
  payment_hash: string | null;
  sender_alias: string | null;
  amount_sats: number;
  message: string | null;
  app_name: string | null;
  episode_title: string | null;
  episode_guid: string | null;
  received_at: string;
}

/**
 * Insert a boostagram record.
 * Fail-closed: amount_sats must be > 0 or the record is silently dropped.
 * Returns true if a new record was inserted (not a duplicate).
 */
export function insertBoostagram(record: {
  feedUrl: string;
  paymentHash: string | null;
  senderAlias: string | null;
  amountSats: number;
  message: string | null;
  appName: string | null;
  episodeTitle: string | null;
  episodeGuid: string | null;
}): boolean {
  if (!record.amountSats || record.amountSats <= 0) {
    console.warn(
      `[DB] Dropped boostagram with invalid amount: ${record.amountSats} sats (payment_hash: ${record.paymentHash})`,
    );
    return false;
  }

  // Check dedup first
  if (record.paymentHash) {
    const exists = db.exec(
      `SELECT 1 FROM boostagram_cache WHERE payment_hash = ?`,
      [record.paymentHash],
    );
    if (exists.length > 0 && exists[0].values.length > 0) return false;
  }

  db.run(
    `INSERT OR IGNORE INTO boostagram_cache
      (feed_url, payment_hash, sender_alias, amount_sats, message, app_name, episode_title, episode_guid)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.feedUrl,
      record.paymentHash,
      record.senderAlias,
      record.amountSats,
      record.message,
      record.appName,
      record.episodeTitle,
      record.episodeGuid,
    ],
  );
  persist();
  return true;
}

export function getBoostagramsSince(feedUrl: string, since: Date): BoostagramRecord[] {
  const result = db.exec(
    `SELECT * FROM boostagram_cache WHERE feed_url = ? AND received_at >= ? ORDER BY received_at DESC`,
    [feedUrl, since.toISOString()],
  );
  return rowsFromResult<BoostagramRecord>(result);
}

export function getBoostSummary(feedUrl: string, since: Date): { count: number; totalSats: number } {
  const result = db.exec(
    `SELECT COUNT(*) as count, COALESCE(SUM(amount_sats), 0) as total_sats
     FROM boostagram_cache WHERE feed_url = ? AND received_at >= ?`,
    [feedUrl, since.toISOString()],
  );
  if (!result.length || !result[0].values.length) return { count: 0, totalSats: 0 };
  const row = result[0].values[0];
  return { count: row[0] as number, totalSats: row[1] as number };
}

// ─── Status Cache ───────────────────────────────────────────────────────────

export function setCachedStatus(feedUrl: string, result: unknown): void {
  db.run(
    `INSERT OR REPLACE INTO status_cache (feed_url, result_json) VALUES (?, ?)`,
    [feedUrl, JSON.stringify(result)],
  );
  persist();
}

export function getCachedStatus(feedUrl: string): unknown | null {
  const result = db.exec(
    `SELECT result_json, cached_at FROM status_cache WHERE feed_url = ?`,
    [feedUrl],
  );
  if (!result.length || !result[0].values.length) return null;
  const row = result[0].values[0];
  const cachedAt = row[1] as string;
  const age = Date.now() - new Date(cachedAt).getTime();
  if (age > STATUS_CACHE_TTL_MS) return null;
  return JSON.parse(row[0] as string);
}

// ─── Diagnostics Helpers ───────────────────────────────────────────────────

export function getTotalSubscriptionsCount(): number {
  const result = db.exec(`SELECT COUNT(*) FROM guild_subscriptions`);
  if (!result.length || !result[0].values.length) return 0;
  return result[0].values[0][0] as number;
}

export function getTotalEpisodesSeenCount(): number {
  const result = db.exec(`SELECT COUNT(*) FROM episode_seen`);
  if (!result.length || !result[0].values.length) return 0;
  return result[0].values[0][0] as number;
}

export function getTotalBoostsCachedCount(): number {
  const result = db.exec(`SELECT COUNT(*) FROM boostagram_cache`);
  if (!result.length || !result[0].values.length) return 0;
  return result[0].values[0][0] as number;
}

// ─── Dashboard Helper Extensions ───────────────────────────────────────────

export interface ChapterMetadataRecord {
  id: number;
  feed_url: string;
  episode_guid: string;
  chapter_index: number;
  link_title: string | null;
  link_url: string | null;
  notes: string | null;
  created_at: string;
}

export function getChapterMetadata(feedUrl: string, episodeGuid: string): ChapterMetadataRecord[] {
  const result = db.exec(
    `SELECT * FROM chapter_metadata WHERE feed_url = ? AND episode_guid = ?`,
    [feedUrl, episodeGuid],
  );
  return rowsFromResult<ChapterMetadataRecord>(result);
}

export function setChapterMetadata(
  feedUrl: string,
  episodeGuid: string,
  chapterIndex: number,
  linkTitle: string | null,
  linkUrl: string | null,
  notes: string | null,
): void {
  db.run(
    `INSERT OR REPLACE INTO chapter_metadata (feed_url, episode_guid, chapter_index, link_title, link_url, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [feedUrl, episodeGuid, chapterIndex, linkTitle, linkUrl, notes],
  );
  persist();
}

export function isCommentPushed(guildId: string, eventId: string): boolean {
  const result = db.exec(
    `SELECT 1 FROM pushed_comments WHERE guild_id = ? AND event_id = ?`,
    [guildId, eventId],
  );
  return result.length > 0 && result[0].values.length > 0;
}

export function markCommentPushed(guildId: string, eventId: string): void {
  db.run(
    `INSERT OR IGNORE INTO pushed_comments (guild_id, event_id) VALUES (?, ?)`,
    [guildId, eventId],
  );
  persist();
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}


