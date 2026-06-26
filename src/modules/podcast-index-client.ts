import * as crypto from 'crypto';
import axios from 'axios';

const BASE_URL = 'https://api.podcastindex.org/api/1.0';

// Fail fast if credentials not present at startup
const API_KEY = process.env.PODCAST_INDEX_API_KEY;
const API_SECRET = process.env.PODCAST_INDEX_API_SECRET;

if (!API_KEY || !API_SECRET) {
  console.warn('[PodcastIndexClient] WARNING: PODCAST_INDEX_API_KEY or PODCAST_INDEX_API_SECRET missing from env');
}

/**
 * Build the required auth headers for Podcast Index API.
 * SHA-1(key + secret + epoch_seconds)
 * Extracted directly from aegis-os/api.js — same implementation.
 */
function getAuthHeaders(): Record<string, string> {
  const apiHeaderTime = Math.floor(Date.now() / 1000).toString();
  const data4Hash = (API_KEY ?? '') + (API_SECRET ?? '') + apiHeaderTime;
  const hash = crypto.createHash('sha1').update(data4Hash).digest('hex');

  return {
    'X-Auth-Date': apiHeaderTime,
    'X-Auth-Key': API_KEY ?? '',
    'Authorization': hash,
    'User-Agent': 'AegisPodBot/0.1 (+https://aegis-os.io; Podcasting2.0)',
  };
}

/**
 * Fetch from Podcast Index API.
 * Returns the parsed JSON body or null on error.
 */
export async function fetchFromIndex(endpoint: string): Promise<unknown> {
  const url = `${BASE_URL}${endpoint}`;
  try {
    const response = await axios.get(url, {
      headers: getAuthHeaders(),
      timeout: 10_000,
    });
    return response.data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[PodcastIndexClient] Error fetching ${url}: ${msg}`);
    return null;
  }
}

/**
 * Search Podcast Index by term.
 */
export async function searchByTerm(query: string): Promise<PodcastIndexFeed[]> {
  const data = await fetchFromIndex(`/search/byterm?q=${encodeURIComponent(query)}`) as PodcastIndexSearchResult | null;
  if (data?.status === 'true' && Array.isArray(data.feeds)) {
    return data.feeds;
  }
  return [];
}

/**
 * Lookup a feed by its RSS URL.
 */
export async function lookupByFeedUrl(feedUrl: string): Promise<PodcastIndexFeed | null> {
  const data = await fetchFromIndex(`/podcasts/byfeedurl?url=${encodeURIComponent(feedUrl)}`) as PodcastIndexFeedResult | null;
  if (data?.feed) {
    return data.feed;
  }
  return null;
}

/**
 * Get recent episodes for a feed by feed ID.
 */
export async function getEpisodesByFeedUrl(feedUrl: string, max = 5): Promise<PodcastIndexEpisode[]> {
  const data = await fetchFromIndex(`/episodes/byfeedurl?url=${encodeURIComponent(feedUrl)}&max=${max}`) as PodcastIndexEpisodesResult | null;
  if (data?.items && Array.isArray(data.items)) {
    return data.items;
  }
  return [];
}

// ─── Type Definitions ──────────────────────────────────────────────────────

export interface PodcastIndexFeed {
  id: number;
  title: string;
  url: string;
  originalUrl?: string;
  link?: string;
  description?: string;
  author?: string;
  ownerName?: string;
  image?: string;
  artwork?: string;
  lastUpdateTime?: number;
  lastCrawlTime?: number;
  lastParseTime?: number;
  lastGoodHttpStatusTime?: number;
  lastHttpStatus?: number;
  contentType?: string;
  itunesId?: number;
  generator?: string;
  language?: string;
  explicit?: boolean;
  type?: number;
  medium?: string;
  dead?: number;
  episodeCount?: number;
  crawlErrors?: number;
  parseErrors?: number;
  categories?: Record<string, string>;
  locked?: number;
  podcastGuid?: string;
  podcastIndexUrl?: string;
  value?: {
    model?: { type?: string; method?: string; suggested?: string };
    destinations?: Array<{ name?: string; address?: string; type?: string; split?: number; fee?: boolean; customKey?: string; customValue?: string }>;
  };
  funding?: { url?: string; message?: string };
}

export interface PodcastIndexEpisode {
  id: number;
  title: string;
  link?: string;
  description?: string;
  guid: string;
  datePublished?: number;
  datePublishedPretty?: string;
  dateCrawled?: number;
  enclosureUrl?: string;
  enclosureType?: string;
  enclosureLength?: number;
  duration?: number;
  explicit?: number;
  episode?: number;
  episodeType?: string;
  season?: number;
  image?: string;
  feedItunesId?: number;
  feedUrl?: string;
  feedImage?: string;
  feedId?: number;
  feedTitle?: string;
  feedLanguage?: string;
  chaptersUrl?: string;
  transcriptUrl?: string;
  transcripts?: Array<{ url?: string; type?: string }>;
  soundbite?: { startTime?: number; duration?: number; title?: string };
  soundbites?: Array<{ startTime?: number; duration?: number; title?: string }>;
  persons?: Array<{ id?: number; name?: string; role?: string; group?: string; href?: string; img?: string }>;
  socialInteract?: Array<{ uri?: string; protocol?: string; accountId?: string; accountUrl?: string; priority?: number }>;
  value?: unknown;
}

interface PodcastIndexSearchResult {
  status: string;
  feeds: PodcastIndexFeed[];
  count?: number;
  description?: string;
}

interface PodcastIndexFeedResult {
  feed: PodcastIndexFeed;
  status: string;
  description?: string;
}

interface PodcastIndexEpisodesResult {
  items: PodcastIndexEpisode[];
  status: string;
  count?: number;
  description?: string;
}
