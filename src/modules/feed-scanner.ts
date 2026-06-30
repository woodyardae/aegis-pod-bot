import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['podcast:valueRecipient', 'podcast:person', 'item', 'podcast:socialInteract'].includes(name),
});

const FEED_FETCH_TIMEOUT_MS = 15_000;

/**
 * Fetches and parses an RSS feed URL.
 * Returns the raw channel object or throws.
 */
async function fetchFeedChannel(feedUrl: string): Promise<RawChannel> {
  const response = await axios.get(feedUrl, {
    headers: {
      'User-Agent': 'AegisPodBot/0.1 (+https://aegis-os.io; Podcasting2.0)',
      'Accept': 'text/xml, application/rss+xml, application/xml, */*',
    },
    timeout: FEED_FETCH_TIMEOUT_MS,
    responseType: 'text',
  });

  const xmlData: string = response.data;
  const jsonObj = parser.parse(xmlData) as { rss?: { channel?: RawChannel } };

  if (!jsonObj.rss?.channel) {
    throw new Error('Invalid RSS structure — no channel found');
  }

  return jsonObj.rss.channel;
}

// ─── PC2.0 Scorer ──────────────────────────────────────────────────────────
// Extracted from aegis-os/server.js /api/scan endpoint — same scoring logic,
// now a pure function on a parsed channel object.

export interface PC20Scores {
  v4v: number;       // 0-100
  community: number; // 0-100
  technical: number; // 0-100
  omni: number;      // 0-100 (average of the three)
}

export interface PC20Tags {
  value: boolean;
  valueRecipient: boolean;
  valueTimeSplit: boolean;
  person: boolean;
  podroll: boolean;
  socialInteract: boolean;
  locked: boolean;
  podping: boolean;
  integrity: boolean;
  transcript: boolean;
  funding: boolean;
}

export interface FeedScanResult {
  title: string;
  description: string;
  image: string | null;
  medium: string;
  language: string | null;
  link: string | null;
  scores: PC20Scores;
  tags: PC20Tags;
  latestEpisode: LatestEpisode | null;
  feedUrl: string;
}

export interface LatestEpisode {
  title: string;
  guid: string;
  pubDate: string | null;
  enclosureUrl: string | null;
  duration: number | null;
  image: string | null;
}

function cap100(n: number): number {
  return Math.min(100, Math.max(0, n));
}

function extractLatestEpisode(items: RawItem[]): LatestEpisode | null {
  const first = items.find((i) => i != null);
  if (!first) return null;

  const enclosure = first.enclosure;
  const enclosureUrl = typeof enclosure === 'object' && enclosure !== null
    ? (enclosure as Record<string, unknown>)['@_url'] as string ?? null
    : null;

  return {
    title: typeof first.title === 'string' ? first.title : String(first.title ?? 'Untitled'),
    guid: typeof first.guid === 'string'
      ? first.guid
      : (typeof first.guid === 'object' && first.guid !== null
          ? ((first.guid as Record<string, unknown>)['#text'] as string ?? String(Date.now()))
          : String(first.guid ?? Date.now())),
    pubDate: typeof first.pubDate === 'string' ? first.pubDate : null,
    enclosureUrl,
    duration: first['itunes:duration'] != null ? parseInt(String(first['itunes:duration']), 10) || null : null,
    image: typeof first['podcast:image'] === 'object' && first['podcast:image'] !== null
      ? (first['podcast:image'] as Record<string, unknown>)['@_href'] as string ?? null
      : null,
  };
}

/**
 * Scores a parsed RSS channel for Podcasting 2.0 compliance.
 * Pure function — no I/O.
 * Extracted from aegis-os/server.js /api/scan scoring logic.
 */
export function scoreChannel(channel: RawChannel, feedUrl: string): FeedScanResult {
  const tags: PC20Tags = {
    value: false,
    valueRecipient: false,
    valueTimeSplit: false,
    person: false,
    podroll: false,
    socialInteract: false,
    locked: false,
    podping: false,
    integrity: false,
    transcript: false,
    funding: false,
  };

  const scores: PC20Scores = { v4v: 0, community: 0, technical: 0, omni: 0 };

  const items: RawItem[] = Array.isArray(channel.item)
    ? channel.item
    : channel.item != null ? [channel.item as RawItem] : [];

  // ── V4V Track ────────────────────────────────────────────────────────────
  if (channel['podcast:value']) {
    tags.value = true;
    scores.v4v += 20;

    const val = channel['podcast:value'] as Record<string, unknown>;
    const recipients = val['podcast:valueRecipient'];
    if (recipients != null && (Array.isArray(recipients) ? recipients.length > 0 : true)) {
      tags.valueRecipient = true;
      scores.v4v += 30;
    }
  }

  let hasItemOverrides = false;
  for (const item of items) {
    if (!item) continue;
    if (item['podcast:value']) hasItemOverrides = true;
    if (item['podcast:valueTimeSplit']) {
      tags.valueTimeSplit = true;
      scores.v4v += 50;
    }
    if (item['podcast:transcript']) tags.transcript = true;
    if (item['podcast:integrity']) tags.integrity = true;
  }

  if (hasItemOverrides && scores.v4v >= 50) scores.v4v += 50;

  // V4V Music check
  const medium = String(channel['podcast:medium'] ?? 'podcast');
  if (medium === 'music' && channel['podcast:remoteItem']) {
    scores.v4v += 30;
  }

  // ── Community Track ───────────────────────────────────────────────────────
  if (channel['podcast:person']) {
    tags.person = true;
    scores.community += 30;
    const persons = Array.isArray(channel['podcast:person'])
      ? channel['podcast:person']
      : [channel['podcast:person']];
    const hasHref = (persons as Array<Record<string, unknown>>).some((p) => !!p['@_href']);
    if (hasHref) scores.community += 30;
  }
  if (channel['podcast:podroll']) {
    tags.podroll = true;
    scores.community += 20;
  }
  if (channel['podcast:socialInteract']) {
    tags.socialInteract = true;
    scores.community += 20;
  }
  if (channel['podcast:funding']) {
    tags.funding = true;
  }

  // ── Technical Track ───────────────────────────────────────────────────────
  if (feedUrl.startsWith('https://')) scores.technical += 20;
  if (channel['podcast:locked']) {
    tags.locked = true;
    scores.technical += 20;
  }
  if (channel['podcast:podping']) {
    tags.podping = true;
    scores.technical += 30;
  }
  if (tags.integrity) scores.technical += 30;

  // ── Transcript (bonus technical) ──────────────────────────────────────────
  if (tags.transcript) scores.technical += 10;

  // ── Cap + Omni ────────────────────────────────────────────────────────────
  scores.v4v = cap100(scores.v4v);
  scores.community = cap100(scores.community);
  scores.technical = cap100(scores.technical);
  scores.omni = Math.floor((scores.v4v + scores.community + scores.technical) / 3);

  // ── Image resolution (channel > itunes:image > null) ─────────────────────
  let image: string | null = null;
  if (typeof channel.image === 'object' && channel.image !== null) {
    image = (channel.image as Record<string, unknown>).url as string ?? null;
  } else if (typeof channel['itunes:image'] === 'object' && channel['itunes:image'] !== null) {
    image = (channel['itunes:image'] as Record<string, unknown>)['@_href'] as string ?? null;
  } else if (typeof channel['podcast:image'] === 'object' && channel['podcast:image'] !== null) {
    image = (channel['podcast:image'] as Record<string, unknown>)['@_href'] as string ?? null;
  }

  return {
    title: String(channel.title ?? 'Unknown Podcast'),
    description: String(channel.description ?? channel['itunes:summary'] ?? ''),
    image,
    medium,
    language: typeof channel.language === 'string' ? channel.language : null,
    link: typeof channel.link === 'string' ? channel.link : null,
    scores,
    tags,
    latestEpisode: extractLatestEpisode(items),
    feedUrl,
  };
}

/**
 * High-level: fetch a feed URL and return its full PC2.0 scan result.
 */
export async function scanFeed(feedUrl: string): Promise<FeedScanResult> {
  const channel = await fetchFeedChannel(feedUrl);
  return scoreChannel(channel, feedUrl);
}

// ─── Internal raw RSS types ───────────────────────────────────────────────

interface RawChannel {
  title?: unknown;
  description?: unknown;
  'itunes:summary'?: unknown;
  link?: unknown;
  language?: unknown;
  image?: unknown;
  'itunes:image'?: unknown;
  'podcast:image'?: unknown;
  'podcast:value'?: unknown;
  'podcast:person'?: unknown;
  'podcast:podroll'?: unknown;
  'podcast:socialInteract'?: unknown;
  'podcast:locked'?: unknown;
  'podcast:podping'?: unknown;
  'podcast:funding'?: unknown;
  'podcast:medium'?: unknown;
  'podcast:remoteItem'?: unknown;
  item?: RawItem | RawItem[];
}

interface RawItem {
  title?: unknown;
  guid?: unknown;
  pubDate?: unknown;
  enclosure?: unknown;
  'itunes:duration'?: unknown;
  'podcast:image'?: unknown;
  'podcast:value'?: unknown;
  'podcast:valueTimeSplit'?: unknown;
  'podcast:transcript'?: unknown;
  'podcast:integrity'?: unknown;
  'podcast:chapters'?: unknown;
  'podcast:socialInteract'?: unknown;
  [key: string]: unknown;
}

// ─── Dashboard Show Episodes Fetcher ──────────────────────────────────────

export interface SocialInteractConfig {
  uri: string;
  protocol: string;
  accountId?: string;
}

export interface EpisodeDetail {
  title: string;
  guid: string;
  pubDate: string | null;
  enclosureUrl: string | null;
  duration: number | null;
  image: string | null;
  chaptersUrl: string | null;
  socialInteract: SocialInteractConfig[];
}

export async function getEpisodesList(feedUrl: string): Promise<EpisodeDetail[]> {
  const channel = await fetchFeedChannel(feedUrl);
  const items: RawItem[] = Array.isArray(channel.item)
    ? channel.item
    : channel.item != null ? [channel.item as RawItem] : [];

  return items.filter(Boolean).map((item) => {
    const enclosure = item.enclosure;
    const enclosureUrl = typeof enclosure === 'object' && enclosure !== null
      ? (enclosure as Record<string, unknown>)['@_url'] as string ?? null
      : null;

    const guid = typeof item.guid === 'string'
      ? item.guid
      : (typeof item.guid === 'object' && item.guid !== null
          ? ((item.guid as Record<string, unknown>)['#text'] as string ?? String(Date.now()))
          : String(item.guid ?? Date.now()));

    let chaptersUrl: string | null = null;
    if (typeof item['podcast:chapters'] === 'object' && item['podcast:chapters'] !== null) {
      chaptersUrl = (item['podcast:chapters'] as Record<string, unknown>)['@_url'] as string ?? null;
    }

    const socialInteract: SocialInteractConfig[] = [];
    if (item['podcast:socialInteract']) {
      const tags = Array.isArray(item['podcast:socialInteract'])
        ? item['podcast:socialInteract']
        : [item['podcast:socialInteract']];

      for (const t of tags) {
        if (typeof t === 'object' && t !== null) {
          const typedTag = t as Record<string, unknown>;
          const uri = typedTag['@_uri'] as string;
          const protocol = typedTag['@_protocol'] as string;
          if (uri && protocol) {
            socialInteract.push({
              uri,
              protocol,
              accountId: typedTag['@_accountId'] as string ?? undefined,
            });
          }
        }
      }
    }

    return {
      title: typeof item.title === 'string' ? item.title : String(item.title ?? 'Untitled'),
      guid,
      pubDate: typeof item.pubDate === 'string' ? item.pubDate : null,
      enclosureUrl,
      duration: item['itunes:duration'] != null ? parseInt(String(item['itunes:duration']), 10) || null : null,
      image: typeof item['podcast:image'] === 'object' && item['podcast:image'] !== null
        ? (item['podcast:image'] as Record<string, unknown>)['@_href'] as string ?? null
        : null,
      chaptersUrl,
      socialInteract,
    };
  });
}
