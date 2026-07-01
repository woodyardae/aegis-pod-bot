# Aether Station Taxonomy

Scope: taxonomy for user-created and pre-seeded Aether stations. Aether stations are published as valid Podcasting 2.0 feeds (`medium=musicL` for music-list stations, ordered `<podcast:remoteItem>` pointers). Two playback modes per station: SYNCED (virtual radio, wall-clock position = epoch + sum-of-prior-durations) and ON-DEMAND (playlist). Original feeds are never mutated. Value routing forwards sats to each original creator plus a station-owner curation cut.

Sources used:
- Podcast Index categories: https://github.com/Podcastindex-org/docs-categories (`categories.txt`)
- Wavlake genre taxonomy: https://github.com/wavlake/genre-list
- Podcast Index API: https://podcastindex-org.github.io/docs-api/ (spec source: https://github.com/Podcastindex-org/docs-api)

---

## 1. Station / Playlist Type Tree

Four orthogonal axes classify every station. A concrete station is one selection per axis (Mode x Content x Curation x Time). Leaf types below are the combinations that actually ship or that users can create; not every cell in the 2x4x4x4 grid is meaningful, so only viable leaves are enumerated.

### Axis A: Mode
- **Synced Radio**: wall-clock position computed from `epoch + sum(prior item durations) mod total`. All listeners hear the same item at the same instant. No seek. Feed carries a synchronization anchor (epoch) plus ordered durations.
- **On-Demand Playlist**: ordered list, listener controls position, seek and skip allowed. Standard `medium=musicL` / playlist feed.

### Axis B: Content
- **Podcast** (`medium=podcast` sources): talk, spoken-word, episodic.
- **Music** (`medium=music` sources): Wavlake feeds and RSS music feeds. Station itself is `medium=musicL`.
- **Video** (`medium=video` / `medium=film` sources): video remoteItems.
- **Mixed**: heterogeneous sources across media. Station declared `medium=mixed` where the client supports it; otherwise defaults to the dominant medium with per-item medium hints.

### Axis C: Curation
- **Human-curated**: a station owner hand-picks and orders remoteItems.
- **Auto-generated (charts/trending)**: item list computed from an external signal (PI trending, recency). No human ordering.
- **Algorithmic (value-ranked)**: item list ordered by a value signal (sats streamed per listener-hour). Recomputed on cadence.
- **Collaborative**: multiple named contributors can add/remove items; owner holds final publish authority and the curation value split.

### Axis D: Time
- **Evergreen**: static until the owner edits. No auto-regen.
- **Daily auto-regen**: item list recomputed once per 24h.
- **Weekly auto-regen**: recomputed once per 7 days.
- **Live-event-tied**: window bound to an external event (e.g. a scheduled live show block); regen triggered by event start/stop.

### Leaf Types

| Leaf name | Mode | Content | Curation | Time | Description | Who creates | Auto-gen cadence |
|---|---|---|---|---|---|---|---|
| Flagship Synced Station | Synced | Podcast/Music/Mixed | Human | Evergreen | Hand-curated virtual radio channel around a theme. Sequenced for flow. | Aether team (launch) or verified curators | None (manual edits) |
| Curator Playlist | On-Demand | any | Human | Evergreen | Ordered playlist a user assembles and publishes. | Any user | None |
| Collab Playlist | On-Demand | any | Collaborative | Evergreen | Shared playlist with multiple contributors, one owner. | User owner + invited contributors | None |
| Top 10 This Week | On-Demand | Podcast/Music | Auto (trending) | Weekly | Ranked chart of the week's strongest items in a genre. | System | Weekly (Mon 00:00 UTC) |
| Daily Trending Radio | Synced | Podcast/Music | Auto (trending) | Daily | Synced channel seeded from PI trending, refreshed nightly. | System | Daily (00:00 UTC) |
| New & Noteworthy | On-Demand | Podcast/Music | Auto (recency + quality gate) | Daily | Recently added feeds meeting quality criteria. | System | Daily |
| Most Valued | On-Demand | Podcast/Music | Algorithmic (value-ranked) | Weekly | Items ranked by sats streamed per listener-hour. | System | Weekly |
| Daily Recap Reel | Synced | Mixed | Auto (highlights) | Daily | Short auto-assembled reel of the day's highlights. | System | Daily |
| Genre Firehose | On-Demand | Music | Auto (recency) | Daily | All new music in a genre, newest first. | System | Daily |
| Live-Event Channel | Synced | Mixed | Human | Live-event-tied | Temporary synced channel around a scheduled event window. | Curator | Event start/stop trigger |

Leaf naming rule for user-created stations: `{content}-{mode}` internal type tag, e.g. `music-synced`, `podcast-ondemand`. Auto-gen stations carry an additional `regen:{cadence}` tag consumed by the scheduler.

### 1a. Container and execution reality (what ships now vs what needs an extension)

The Mode axis (Synced vs On-Demand) describes the listener experience. It hides a more important engineering distinction: WHICH namespace container carries the station, and WHERE the experience executes. Classifying by that shows what is launch-ready on today's spec versus what depends on a namespace extension or Aether's own client.

| Station family | Container | Native on today's spec? | What it needs beyond the feed |
|---|---|---|---|
| On-demand playlist | `musicL` feed, ordered `<podcast:remoteItem>` (whole items) | Yes, fully | Nothing. Any PC2.0 list player renders and queues it. |
| Chart / auto-gen station | same `musicL` feed, remoteItem set recomputed on cadence | Yes, fully | Nothing. Every chart in section 3 is just an auto-regenerated list feed. |
| Synced radio (whole items) | `musicL` feed + external anchor/position math | Partial | Wall-clock position computed by Aether's client (Gap 1). Degrades to an ordered list in foreign players. |
| Synced radio with clips/segues | above + sub-item time ranges | No | `remoteItem` `startTime`/`duration` extension (Gap 2), or Aether re-hosting media (avoid). |
| True live event | `<podcast:liveItem>` + a real stream | Yes, different feature | Actual broadcast infrastructure. This is the ONLY correct use of `liveItem`; it is not the synced-radio container. |

Key point for curation value: a PURE reference list feed routes value to each original creator's own block, and the station owner is invisible to the value flow, so the curation cut is NOT expressible in a pure list feed alone. The cut requires Aether to sit in the playback/value path (per-segment `valueTimeSplit` on played items, or an app-side split in Aether's own client). See `./value-model.md` for the mechanism and the trade-offs. This is why "aggregate by reference" and "aggregator takes a cut" are in tension and the resolution is an architecture choice, not a feed tag.

The `Live-Event Channel` leaf in the table above is the one type that maps to `<podcast:liveItem>`. All other synced leaves are `musicL` feeds positioned by Aether's client, not `liveItem`s.

---

## 2. Genre Tree (Aether-facing, < 20 top-level)

Users pick from a simplified top-level set. Each Aether genre maps to (a) a set of Podcast Index categories from `categories.txt` and (b) a set of Wavlake music genres, so a single Aether genre can span both podcast and music content. Under 20 top-level genres keeps browse cognitively cheap; the full PI category set and Wavlake genres remain as internal facets for filtering.

### Full source lists (for reference)

Podcast Index flat categories (`categories.txt`): Arts, Books, Design, Fashion, Beauty, Food, Performing, Visual, Business, Careers, Entrepreneurship, Investing, Management, Marketing, Non-Profit, Comedy, Interviews, Improv, Stand-Up, Education, Courses, How-To, Language, Learning, Self-Improvement, Fiction, Drama, History, Health, Fitness, Alternative Medicine, Mental, Nutrition, Sexuality, Kids, Family, Parenting, Pets, Animals, Stories, Leisure, Animation, Manga, Automotive, Aviation, Crafts, Games, Hobbies, Home, Garden, Video-Games, Music, Commentary, News, Daily, Entertainment, Government, Politics, Buddhism, Christianity, Hinduism, Islam, Judaism, Religion, Spirituality, Science, Astronomy, Chemistry, Earth, Life, Mathematics, Natural, Nature, Physics, Social, Society, Culture, Documentary, Personal, Journals, Philosophy, Places, Travel, Relationships, Sports, Baseball, Basketball, Cricket, Fantasy, Football, Golf, Hockey, Rugby, Running, Soccer, Swimming, Tennis, Volleyball, Wilderness, Wrestling, Technology, True Crime, TV, Film, After-Shows, Reviews.

Wavlake primary music categories (`genre-list`): Africa, Alternative, Asia, Blues, Caribbean, Children's Music, Classical, Comedy, Country, Dance/EDM, Easy Listening, Electronic, Hip-Hop/Rap, Holiday, Inspirational (Christian & Gospel), Instrumental, Jazz, Latino, New Age, Pop, R&B/Soul, Reggae, Rock, Singer/Songwriter, Soundtrack, Spoken Word, Tex-Mex/Tejano, Vocal, World.

### Simplified Aether genre tree (17 top-level)

| Aether genre | Maps from PI categories | Maps from Wavlake genres |
|---|---|---|
| News & Politics | News, Daily, Politics, Government, Commentary | — |
| Tech | Technology, Science (Astronomy, Chemistry, Earth, Life, Mathematics, Physics), Video-Games | — |
| Business & Money | Business, Careers, Entrepreneurship, Investing, Management, Marketing, Non-Profit | — |
| Comedy | Comedy, Improv, Stand-Up | Comedy |
| True Crime | True Crime | — |
| Society & Culture | Social, Society, Culture, Documentary, Personal, Journals, Philosophy, Places, Relationships, Religion (Buddhism, Christianity, Hinduism, Islam, Judaism), Spirituality | Spoken Word |
| Education | Education, Courses, How-To, Language, Learning, Self-Improvement | — |
| Health & Wellness | Health, Fitness, Alternative Medicine, Mental, Nutrition, Sexuality | New Age |
| Arts & Design | Arts, Books, Design, Fashion, Beauty, Food, Performing, Visual, Crafts | — |
| Stories & Fiction | Fiction, Drama, Stories, Fantasy | Soundtrack |
| Kids & Family | Kids, Family, Parenting, Pets, Animals, Animation, Manga | Children's Music |
| Sports | Sports, Baseball, Basketball, Cricket, Football, Golf, Hockey, Rugby, Running, Soccer, Swimming, Tennis, Volleyball, Wrestling, After-Shows | — |
| Leisure & Hobbies | Leisure, Games, Hobbies, Home, Garden, Automotive, Aviation, Travel, Wilderness, Nature, Natural | — |
| TV & Film | TV, Film, Entertainment, Reviews | — |
| Music: Electronic & Dance | Music | Dance/EDM, Electronic |
| Music: Rock & Pop | Music | Rock, Pop, Alternative, Singer/Songwriter, Vocal, Easy Listening |
| Music: Roots & World | Music | Blues, Country, Jazz, R&B/Soul, Reggae, Hip-Hop/Rap, Classical, Instrumental, Latino, Tex-Mex/Tejano, Caribbean, Africa, Asia, World, Holiday, Inspirational (Christian & Gospel) |

Notes on mapping decisions:
- PI `Music` category is a single flat label with no sub-genre; all music sub-classification comes from the Wavlake genre facet, so the three `Music:` top-level genres are driven entirely by Wavlake genres while all still tagging PI `Music`.
- Wavlake `Comedy` and `Spoken Word` fold into the podcast-side genres (Comedy, Society & Culture) rather than a music genre, since they behave as talk content.
- Roots & World is deliberately broad to keep top-level count under 20; it can split later (Jazz/Classical vs Hip-Hop/R&B vs Global) once catalog depth justifies it.

---

## 3. Charts + Rankings Design

All auto-generated stations produce an ordered `<podcast:remoteItem>` list published as a normal Aether feed. Each has: a signal definition, a data source (PI API endpoint where applicable), an update cadence, and a computation for the remoteItem list. All PI calls require the standard auth headers (`X-Auth-Key`, `X-Auth-Date`, `Authorization` = sha1 of key+secret+date).

### Top 10 This Week (per genre)
- Signal: PI trending score within the genre's PI categories over a 7-day window. Trending is PI's own engagement-weighted signal (recent episode activity + feed popularity).
- Data source: `GET /podcasts/trending` with `cat={comma-joined PI categories for the Aether genre}`, `since={now-7d epoch}`, `max=50`, `lang=en`.
- Cadence: weekly, Monday 00:00 UTC.
- remoteItem computation: take trending feeds in rank order, dedupe by feed GUID, resolve each feed's latest published episode via `GET /episodes/byfeedid?id={feedid}&max=1&newest=1`, emit top 10 as `<podcast:remoteItem feedGuid=... itemGuid=...>`. If a feed has no value block, keep it (talk chart) but flag it non-value for the routing layer.

### New & Noteworthy (per genre)
- Signal: recency of first appearance in the index, gated by a quality filter. Criteria: feed added to PI within last 14 days, has >= 3 episodes, has a `podcast:value` block (so it can participate in value routing), non-empty artwork and description. This keeps out empty/abandoned feeds.
- Data source: `GET /recent/feeds` with `cat={PI categories}`, `max=100`, `since={now-14d epoch}`, `lang=en`; cross-check value support with `GET /podcasts/bytag?podcast-value=true` membership or per-feed `GET /value/byfeedid`.
- Cadence: daily.
- remoteItem computation: filter recent feeds by the quality gate, order newest-first, take latest episode per feed, emit up to 25 remoteItems.

### Most Valued (per genre + global)
- Signal: sats streamed per listener-hour, computed from Aether's own value-routing telemetry (not a PI endpoint). Per item: `total_sats_streamed / total_listener_hours` over the trailing 7 days. This normalizes for audience size so a small feed with intense support can rank.
- Data source: internal Aether value-streaming ledger (the same event stream that drives payout splitting). PI is used only to resolve display metadata via `GET /podcasts/byfeedid`.
- Cadence: weekly (also expose a rolling daily variant for the global board).
- remoteItem computation: aggregate streamed sats and listener-seconds per (feedGuid, itemGuid) from the ledger, compute sats/hour, drop items below a minimum listener-hour floor (anti-noise), rank desc, emit top 25. Only value-enabled items are eligible by construction.

### Daily Highlights / Recap Reel
- Signal: composite of the day's movement: new entries to any Top 10, biggest Most Valued climbers, and newly added New & Noteworthy picks.
- Data source: derived from the three charts above (already computed) plus the internal ledger for climber detection; no additional PI call beyond what the source charts made.
- Cadence: daily, generated after the daily charts finish (dependency-ordered in the scheduler). Re-gen trigger: completion of the daily New & Noteworthy and Most Valued jobs; if either fails, the reel reuses the prior day's list and logs a staleness flag.
- remoteItem computation: assemble a short synced reel (target ~10 items): 1 item from each active genre's Top 10 delta, top 3 Most Valued climbers, 2 newest New & Noteworthy. Published as a Synced station so all listeners share the reel timeline.

### Scheduler notes
- All auto-gen jobs write a new feed revision atomically; publish is a pointer swap so listeners never see a partial list.
- PI trending and recent endpoints are the only external dependencies; value-based charts depend only on internal telemetry, so they keep working if PI is briefly unavailable.
- Cadence times are UTC; per-genre jobs are staggered by a few minutes to spread PI request load.
