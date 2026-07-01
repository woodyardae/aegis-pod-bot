# Aether Launch Catalog

Concrete pre-made stations to ship at launch: hand-curated flagship stations plus auto-generated daily/weekly chart stations. Each flagship anchors on real value-enabled feeds where a GUID could be verified from a live RSS source. Any feed whose GUID could not be verified from a live source is marked PLACEHOLDER and must be resolved (via `GET /podcasts/byfeedurl` or `/search/byterm`) before publish.

GUID verification method: fetched the actual RSS feed and read the `<podcast:guid>` element. Feeds behind Cloudflare / 403 to the fetcher are marked PLACEHOLDER even when the show is known real.

## Verified feed GUIDs (source of truth for flagships)

| Show | Feed URL | podcast:guid | Verified | Value block |
|---|---|---|---|---|
| No Agenda Show | https://feeds.noagendaassets.com/noagenda.xml (via feed.nashownotes.com/rss.xml) | `856cd618-7f34-57ea-9b84-3600f1f65e7f` | VERIFIED | lightning / keysend |
| Boostagram Ball | https://mp3s.nashownotes.com/bballrss.xml | `6dfbd8e4-f9f3-5ea1-98a1-574134999b3b` | VERIFIED | lightning / keysend |
| Mere Mortals In Motion | https://serve.podhome.fm/rss/085201db-4757-41d2-bfb6-0ca3739ae6c8 | `085201db-4757-41d2-bfb6-0ca3739ae6c8` | VERIFIED | lightning / keysend |
| Value 4 Value (Mere Mortals) | https://serve.podhome.fm/rss/80662af1-0d5f-5f3d-bd9b-ca5b29d68cf5 | `80662af1-0d5f-5f3d-bd9b-ca5b29d68cf5` | VERIFIED | lightning / keysend |
| Cherry On Top (Wavlake music album, example artist feed) | https://www.wavlake.com/feed/music/d0efe4fb-714e-4ea1-a6b4-422842262cf2 | `b55c93d2-4571-55fd-9562-7966beaa7ea2` (track itemGuid `729ff127-1fcc-4086-8e67-4386e87ac585`) | VERIFIED | lightning (Wavlake) |
| Podcasting 2.0 (Adam Curry & Dave Jones) | https://feeds.podcastindex.org/pc20.xml | `917393e3-1b1e-5cef-ace4-edaa54e1f810` | GUID from podnews.net/podcast/i4ji5; feed itself 403-blocks the fetcher, so treat as SECONDARY-VERIFIED, confirm via `/podcasts/byfeedurl` before publish | lightning / keysend (per show docs) |

---

## 4. Launch Catalog

### Flagship hand-curated stations

**F1. Value-for-Value Cornerstone**
- Mode: On-Demand playlist
- Genre: News & Politics / Tech (talk)
- Description: The canonical value4value talk shows that bootstrapped the ecosystem. The station that explains why Aether exists.
- Source feeds: No Agenda (`856cd618-7f34-57ea-9b84-3600f1f65e7f`, VERIFIED); Podcasting 2.0 (`917393e3-1b1e-5cef-ace4-edaa54e1f810`, SECONDARY-VERIFIED); Value 4 Value (`80662af1-0d5f-5f3d-bd9b-ca5b29d68cf5`, VERIFIED)
- Auto-regen: none (evergreen; latest-episode pointers refreshed manually)

**F2. Boostagram Radio (music)**
- Mode: Synced radio
- Genre: Music: Rock & Pop / Roots & World (mixed music)
- Description: Continuous value4value music channel with per-track wallet switching, modeled on Boostagram Ball's format. Sats follow the currently playing artist.
- Source feeds: Boostagram Ball (`6dfbd8e4-f9f3-5ea1-98a1-574134999b3b`, VERIFIED) as seed; Cherry On Top Wavlake album (`b55c93d2-4571-55fd-9562-7966beaa7ea2`, VERIFIED) plus additional Wavlake albums (PLACEHOLDER, resolve via `/podcasts/bymedium?medium=music`)
- Auto-regen: none (curated rotation; can be upgraded to weekly refresh post-launch)

**F3. New Music Discovery**
- Mode: On-Demand playlist
- Genre: Music (all three music top-levels)
- Description: Rotating showcase of independent value4value musicians from Wavlake and RSS music feeds.
- Source feeds: Cherry On Top (`b55c93d2-4571-55fd-9562-7966beaa7ea2`, VERIFIED); further Wavlake albums PLACEHOLDER (resolve via `/podcasts/bymedium?medium=music`)
- Auto-regen: none at launch (evergreen); candidate for weekly refresh

**F4. Mere Mortals Mix**
- Mode: On-Demand playlist
- Genre: Society & Culture / Education
- Description: The Mere Mortals family of shows in one place, showing multi-feed curation across one creator's network.
- Source feeds: Mere Mortals In Motion (`085201db-4757-41d2-bfb6-0ca3739ae6c8`, VERIFIED); Value 4 Value (`80662af1-0d5f-5f3d-bd9b-ca5b29d68cf5`, VERIFIED)
- Auto-regen: none

**F5. Podcasting 2.0 Deep Cuts**
- Mode: Synced radio
- Genre: Tech (talk)
- Description: Synced channel of Podcasting 2.0 and value4value builder talk. Same item plays for everyone, radio-style.
- Source feeds: Podcasting 2.0 (`917393e3-1b1e-5cef-ace4-edaa54e1f810`, SECONDARY-VERIFIED); No Agenda (`856cd618-7f34-57ea-9b84-3600f1f65e7f`, VERIFIED)
- Auto-regen: none

**F6. Lightning Talk (news + commentary)**
- Mode: On-Demand playlist
- Genre: News & Politics
- Description: Value-enabled independent news and commentary. Anchored on No Agenda, expanded with additional value-enabled news feeds.
- Source feeds: No Agenda (`856cd618-7f34-57ea-9b84-3600f1f65e7f`, VERIFIED); additional news feeds PLACEHOLDER (resolve via `/search/byterm?q=news&val=lightning`)
- Auto-regen: none

**F7. Sats & Strings (acoustic/singer-songwriter)**
- Mode: Synced radio
- Genre: Music: Rock & Pop (Singer/Songwriter facet)
- Description: Mellow value4value singer-songwriter channel.
- Source feeds: Cherry On Top (`b55c93d2-4571-55fd-9562-7966beaa7ea2`, VERIFIED); further Wavlake singer-songwriter albums PLACEHOLDER (resolve via `/podcasts/bymedium?medium=music` filtered by Wavlake genre)
- Auto-regen: none

Flagship count: 7 hand-curated stations.

### Auto-generated chart stations (pre-seeded, self-updating)

**A1. Top 10 This Week: Tech**
- Mode: On-Demand; Genre: Tech
- Source: `/podcasts/trending?cat=Technology,Science,Video-Games&since={now-7d}&max=50`
- Auto-regen: weekly (Mon 00:00 UTC)

**A2. Top 10 This Week: News & Politics**
- Mode: On-Demand; Genre: News & Politics
- Source: `/podcasts/trending?cat=News,Daily,Politics,Government,Commentary&since={now-7d}`
- Auto-regen: weekly

**A3. Daily Trending Radio (global)**
- Mode: Synced; Genre: Mixed
- Source: `/podcasts/trending?max=50&since={now-24h}&lang=en`
- Auto-regen: daily (00:00 UTC)

**A4. New & Noteworthy (global)**
- Mode: On-Demand; Genre: Mixed
- Source: `/recent/feeds?max=100&since={now-14d}&lang=en`, gated: >=3 episodes, has value block, has artwork + description
- Auto-regen: daily

**A5. Most Valued This Week**
- Mode: On-Demand; Genre: Mixed (also per-genre variants)
- Source: internal Aether value-streaming ledger (sats per listener-hour); metadata resolved via `/podcasts/byfeedid`
- Auto-regen: weekly

**A6. Daily Recap Reel**
- Mode: Synced; Genre: Mixed
- Source: derived from A1-A5 outputs + ledger climber detection
- Auto-regen: daily (runs after A3/A4/A5 complete)

Auto-gen count: 6 self-updating chart stations.

Launch total: 7 flagship + 6 auto-gen = 13 pre-seeded stations.

---

## 5. Podcast Index API Capability Map

Base URL: `https://api.podcastindex.org/api/1.0`. Auth on every request: headers `X-Auth-Key` (API key), `X-Auth-Date` (unix seconds), `Authorization` (sha1 hex of `apiKey + apiSecret + authDate`), plus a `User-Agent`. Spec source: https://github.com/Podcastindex-org/docs-api. Rate limits are not published as numeric quotas in the OpenAPI spec; the index is a free community service and expects reasonable use with caching. Treat limits as undocumented and self-throttle (stagger jobs, cache category and feed metadata, prefer batch feed-id calls). No documented per-endpoint rate limit was found in the spec.

| Endpoint | Path | Key params | Powers |
|---|---|---|---|
| Categories list | `/categories/list` | `pretty` | Seeds the internal PI-category facet behind the Aether genre tree; run once, cache. |
| Search by term | `/search/byterm` | `q` (required), `val` (value type filter, e.g. `lightning`), `max` (<=1000), `aponly`, `clean`, `similar`, `fulltext` | Resolving PLACEHOLDER flagship feeds; value-enabled discovery via `val=lightning`; user search. |
| Search by title | `/search/bytitle` | `q` (required), `val`, `max`, `clean`, `similar`, `fulltext` | Exact-ish show lookup when adding a known show to a curated station. |
| Podcast by feed id | `/podcasts/byfeedid` | `id` (required, PI feed id) | Resolve display metadata for chart/ledger items keyed by feed id. |
| Podcast by GUID | `/podcasts/byguid` | `guid` (required, podcast:guid) | Resolve a remoteItem's feed metadata directly from its GUID (Aether stores GUIDs, not PI ids). |
| Podcasts by medium | `/podcasts/bymedium` | `medium` (required; `music`, `podcast`, `video`, `film`, `audiobook`, `blog`, `newsletter`), `max` | Populating music stations (F2/F3/F7) from `medium=music` feeds. |
| Podcasts by tag | `/podcasts/bytag` | `podcast-value` (bool), `podcast-valueTimeSplit` (bool), `max` (<=5000), `start_at` | Value-enabled-only filter: `podcast-value=true` gives feeds carrying a value block, used by New & Noteworthy quality gate and value discovery. |
| Trending | `/podcasts/trending` | `max`, `since` (epoch), `lang`, `cat` (comma list), `notcat` | Signal for Top 10 This Week (A1/A2) and Daily Trending Radio (A3). |
| Episodes by feed id | `/episodes/byfeedid` | `id` (required, comma-separated feed ids), `since`, `max`, `enclosure`, `newest`, `fulltext` | Resolve the latest/eligible episode itemGuid for each charted feed to build remoteItems. |
| Episodes by GUID | `/episodes/byguid` | `guid` (required, episode guid), `feedurl`, `feedid`, `podcastguid`, `fulltext` | Validate a specific episode remoteItem (feedGuid + itemGuid) when a curator pins one episode. |
| Value by feed id | `/value/byfeedid` | `id` (required) | Pull the value block (recipients, splits) for a feed to configure value routing and per-recipient forwarding. |
| Value by feed url | `/value/byfeedurl` | `url` (required) | Same as above keyed by URL; also used to confirm a PLACEHOLDER flagship's value block before publish. |
| Recent feeds | `/recent/feeds` | `max` (default 40), `since`, `lang`, `cat`, `notcat` | Source for New & Noteworthy (A4) recency signal. |
| Recent episodes | `/recent/episodes` | `max` (default 10), `excludeString`, `before`, `fulltext` | Optional freshness feed for daily reel candidate pool. |

Feature-to-endpoint summary:
- Value routing / payout splits: `/value/byfeedid`, `/value/byfeedurl`, `/podcasts/bytag?podcast-value=true`.
- Charts (trending): `/podcasts/trending`, `/recent/feeds`, `/recent/episodes`, resolved with `/episodes/byfeedid`.
- Catalog build & PLACEHOLDER resolution: `/search/byterm`, `/search/bytitle`, `/podcasts/byguid`, `/podcasts/byfeedid`, `/podcasts/bymedium`.
- Genre facet seeding: `/categories/list`.

Blockers / follow-ups:
- `/podcasts/byfeedurl` is referenced above for PLACEHOLDER resolution but was not individually confirmed in this pass; verify it exists in the current spec (the confirmed lookups are `/podcasts/byguid` and `/podcasts/byfeedid`). If absent, resolve PLACEHOLDERs via `/search/byterm` then `/podcasts/byguid`.
- No numeric rate limit is documented; implement client-side throttling and caching regardless.
