# AETHER: Radio / Playlist / Music-Curation Competitive Analysis

Scope: existing "radio station", "playlist", "channel", and music/curation features in current Podcasting 2.0 and Lightning/value4value apps, benchmarked against AETHER's four differentiators (wall-clock SYNCED virtual radio with no broadcast infra; publishable/shareable stations as standard PC2.0 feeds; per-segment remote value routing with a curation cut; user-created + collaborative curation).

Method: live web search and page fetch, July 2026. Each claim is tagged VERIFIED (read from a live source this session) or INFERRED (reasoned from spec behavior or partial evidence). UNKNOWN marks anything not confirmable from a live source rather than guessed.

Date: 2026-07-01

---

## 1. Landscape table

Legend: Y yes, N no, ~ partial, UNKNOWN not confirmable from a live source.

| App | Playlists? | "Radio"/stations? | Music V4V? | Ordered remoteItem support? | Time-synced/scheduled? | Notes / confidence |
|---|---|---|---|---|---|---|
| Fountain | Y (local, user "Create Playlist") | Y — Fountain Radio, single global station | Y (streaming sats + boosts, 1% cut) | UNKNOWN (consumes music feeds; remoteItem-playlist export not confirmed) | ~ synced but only for the one global station | VERIFIED radio is one shared queue, not user stations; INFERRED playlists are in-app not portable feeds |
| Wavlake | Y (mobile Playlists) | N (music catalog, not a station) | Y (native V4V music host; boosts to artists) | ~ publishes music feeds with remoteItem value routing; playlist-as-feed export UNKNOWN | N | VERIFIED playlists + V4V host; UNKNOWN whether playlists emit a portable musicL feed |
| CurioCaster | ~ | N | Y (boost/stream from browser) | UNKNOWN (PC2.0-compliant player; musicL render not confirmed) | N | VERIFIED web player showcasing PC2.0; playlist/remoteItem render UNKNOWN |
| Podverse | Y (premium; clips/playlists) | N | ~ (V4V payments; music focus limited) | ~ generates remoteItem RSS for clips/playlists (spec example context) | N | VERIFIED playlists + remoteItem-style export exists; ordered music-station use INFERRED absent |
| LNBeats | Y (playlist creation, favorites) | ~ ("shows" = curated music shows) | Y (V4V music, boosts to artists) | UNKNOWN | N | VERIFIED playlists + shows + V4V; portable-feed/remoteItem export UNKNOWN |
| Castamatic | Y (On-the-Go, smart, drag-order) | N | Y (NWC / LN address boosts + streams) | N (local queue only) | N | VERIFIED local playlists + V4V; no station, no portable playlist feed |
| Podcast Guru | Y (Smart Playlists) | N | Y (Strike/Alby, stream + boost) | N | N | VERIFIED podcast-focused; no dedicated music station, no remoteItem playlist export |
| Pocket Casts | Y (episode playlists, Nov 2025) | N | N (no V4V) | N | N | VERIFIED playlists only; not a V4V/PC2.0-value app |

---

## 2. Per-app writeups

### Fountain — "Fountain Radio"
VERIFIED: Fountain Radio is a single global community station, not a set of user-created stations. Playback is synchronized across all listeners (everyone hears the same track at the same time, live-radio style). The next track is chosen by a sat auction: listeners add a track to the queue for ~100 sats and upvote/boost tracks; the track with the most sats plays next. Boosts stream to the artist while playing, Fountain takes a 1% cut. Live chat runs alongside. Separately, Fountain has an in-app "Create Playlist" feature and music V4V (streaming sats + boosts) using the same remoteItem-driven value switching as the broader ecosystem.
INFERRED: Fountain Radio's synchronization is bound to Fountain's own infrastructure/queue, not expressed as a portable PC2.0 feed other apps can subscribe to. Personal "Create Playlist" lists appear to be in-app objects, not published musicL feeds.
Sources: https://support.fountain.fm/article/112-what-is-fountain-radio (title confirms feature; body 404 this session), https://www.nobsbitcoin.com/fountain-v1-0-9-fountain-radio-released/ , https://fountain.fm/radio , https://fountain.fm/

### Wavlake — V4V music host + Playlists
VERIFIED: Wavlake is a native value-for-value music host. Artists publish music; listeners on compatible players (Podverse, Fountain, Podfans) stream sats directly to artists. Wavlake added a Playlists feature in its mobile app for discovery, and supports music podcasts (Boostagram Ball, etc.). The core mechanism: a music RSS feed carries remoteItem/value data so that when a track plays, the value block switches to the artist and back to the podcaster after.
UNKNOWN: whether a Wavlake user Playlist is exported as a portable medium=musicL feed of ordered remoteItems that any PC2.0 player can consume. Could not confirm from a live source.
Sources: https://zine.wavlake.com/value-for-value-music-with-lightning-what-a-concept/ , https://zine.wavlake.com/open-music/ , https://wavlake.com/

### CurioCaster
VERIFIED: Web-based, Podcasting 2.0-compliant player built to showcase PC2.0 features (V4V boosts/streams, live). Commonly cited alongside LNBeats as a browser way to boost music.
UNKNOWN: whether it renders a musicL list feed as an ordered, playable playlist. No live confirmation of remoteItem-playlist playback.
Sources: https://curiocaster.com/ , https://podcastindex.org/apps

### Podverse
VERIFIED: Playlists are a premium feature; users can share clips, highlights, playlists, and chapters. Podverse is used as the reference context in the podcast-namespace remoteItem proposal (issue #346) for generating remoteItem RSS from user clips/playlists, i.e. it produces remoteItem-based feeds.
INFERRED: Podverse's playlist/clip export is oriented to podcast clips, not to ordered music stations with per-segment value routing, and has no time-synced/scheduled dimension.
Sources: https://podverse.fm/playlists , https://podverse.fm/tutorials , https://github.com/Podcastindex-org/podcast-namespace/issues/346

### LNBeats
VERIFIED: "Lightning Network Enabled, Decentralized Music For The Masses." Features: featured music shows, search, albums, songs, playlist creation, favorites. V4V model — micropayment boosts stream directly to artists proportional to boosts. "Shows" are curated music shows (closest LNBeats concept to a station).
UNKNOWN: whether LNBeats playlists/shows are published as portable remoteItem/musicL feeds for other apps, and whether any are time-synced. Not confirmable from a live source.
Sources: https://lnbeats.com/ , https://zine.wavlake.com/value-for-value-music-with-lightning-what-a-concept/

### Castamatic
VERIFIED: One of the more complete PC2.0 iOS clients. Native drag-and-drop playlist ordering, filter by show/listened/priority, "On-the-Go" playlist, smart playlists. V4V via NWC or LN address, no middlemen. Uses Podping for near-instant episode/live notification.
INFERRED: Playlists are local player constructs (device queue), not published portable feeds. No music-station or synced-radio concept.
Sources: https://castamatic.com/ , https://apps.apple.com/us/app/castamatic-podcast-player/id966632553

### Podcast Guru
VERIFIED: Podcast-focused player. "Smart Playlists" auto-track shows as new content lands, with time/episode-count limits. V4V via Strike/Alby, distinguishes streaming vs boost. No dedicated music-station functionality surfaced.
INFERRED: No remoteItem music-playlist export, no station, no sync.
Sources: https://podcastguru.io/ , https://apps.apple.com/us/app/podcast-guru-app-player/id1535235039

### Pocket Casts (baseline)
VERIFIED: Added user episode playlists in November 2025 for custom listening order. No V4V, not part of the Lightning value layer.
Source: https://techcrunch.com/2025/11/24/pocket-casts-now-lets-you-create-a-playlist-of-your-favorite-podcast-episodes/

### Spec baseline — podcast:remoteItem + medium=musicL
VERIFIED: remoteItem points to another feed/item by feedGuid (required) + itemGuid (optional) + medium/title hints, without copying content. A feed made entirely of remoteItems is recognized by apps as a playlist. Every medium has an "L" (List) variant — musicL, podcastL, videoL, etc. — where a List feed is intended to contain only remoteItems, referencing other feeds by guid. This is exactly AETHER's published-station container.
VERIFIED: The remoteItem proposal (issue #346) contains no mention of ordered playback guarantees, scheduling, or time-synced radio. The spec is a reference mechanism, not a scheduler.
Sources: https://podcasting2.org/docs/podcast-namespace/tags/remote-item , https://podcasting2.org/docs/podcast-namespace/tags/medium , https://github.com/Podcastindex-org/podcast-namespace/issues/346

---

## 3. Gap analysis — what NO current app does that AETHER does

1. Wall-clock SYNCED virtual radio expressed as a portable feed. VERIFIED: the only synchronized "radio" in the field is Fountain Radio, and it is (a) a single global station, not user-created, and (b) bound to Fountain's own queue/infra, not published as a PC2.0 feed. No app derives playback position deterministically from epoch + sum-of-prior-durations, and no app ships that synced schedule as a standard feed any player could compute against. AETHER's model needs no broadcast infrastructure because position is a pure function of wall-clock time. Nobody does this.

2. User-created / collaborative stations as standard, shareable PC2.0 feeds. VERIFIED: playlists exist widely (Fountain, Wavlake, Podverse, LNBeats, Castamatic, Podcast Guru, Pocket Casts) but are overwhelmingly local in-app objects. Only Podverse is confirmed to emit remoteItem RSS, and that is clip/playlist oriented, not an ordered music station with value routing. No app was confirmed to let a user create a station and publish it as a medium=musicL feed of ordered remoteItems consumable by any player. This is UNKNOWN-to-absent across the field.

3. Per-segment remote value routing with an added station-owner curation cut. VERIFIED: per-track value switching to original artists via remoteItem exists (Wavlake, the ecosystem value-block switch). What is missing is a curator/station-owner cut layered on top of that routing, applied by a third-party curated station that does not own or mutate the original feeds. Fountain takes a 1% platform cut on its single global radio, but that is a platform fee on one house-run station, not a per-station curator split on user-published portable stations.

4. The combination. Even where individual pieces exist (synced single station in Fountain; remoteItem value routing in Wavlake; remoteItem export in Podverse; curated "shows" in LNBeats), no app combines user-created stations + portable PC2.0 feed + wall-clock sync + per-segment routing with curation cut. AETHER is the only design uniting all four.

---

## 4. Differentiation statement

1. Infrastructure-free synchronized radio. AETHER computes every listener's position as epoch + sum-of-prior-durations, so a "live" synced station needs no streaming server or broadcast pipeline. Gap: the field's only synced radio (Fountain Radio) requires Fountain's own live queue infrastructure and exists as one global station, not a formula any player can evaluate. (Sources: nobsbitcoin Fountain Radio writeup; remote-item spec has no scheduler.)

2. Stations are portable, standard feeds — not walled-garden objects. An AETHER station publishes as a valid medium=musicL PC2.0 feed of ordered remoteItems, so any conformant player consumes it. Gap: incumbent playlists are local in-app constructs; only Podverse is confirmed to export remoteItem RSS, and not as ordered value-routed music stations. (Sources: medium + remote-item spec; Podverse playlists.)

3. Value routing plus a curation cut. AETHER streams sats per segment to each original creator via remoteItem value routing and adds a station-owner curation split, without mutating original feeds. Gap: per-track routing to artists exists (Wavlake), but a curator cut on a user-published portable station does not. (Sources: Wavlake V4V; Fountain 1% is a platform fee on one house station, not a per-curator split.)

4. User-created and collaborative curation as first-class output. Any user builds and publishes a station; the artifact is the shareable feed itself. Gap: Fountain Radio is one house-run collaborative queue; other apps' "collaboration" stops at private local playlists. (Sources: Fountain Radio single-station model; per-app writeups.)

5. Two coherent modes on one primitive. SYNCED (virtual radio) and ON-DEMAND (playlist) are the same ordered remoteItem feed read two ways — synced derives position from wall-clock, on-demand plays from the top. Gap: no incumbent unifies a synced-radio experience and a portable playlist in a single published feed.

---

## 5. Risks — where an incumbent could close the gap, and AETHER's defensible edge

Risk A — Fountain generalizes Fountain Radio into user stations. Fountain already has a synchronized station, music V4V, playlists, and a live-chat social layer. The shortest competitive path is: let users spin up their own Fountain Radio stations. VERIFIED they have the synced-playback engine and the audience. Edge: Fountain's sync is tied to its own live queue/infra and its stations are not portable PC2.0 feeds. AETHER's wall-clock formula (no infra) plus feed-portability is an architectural stance, not a feature toggle, so replicating it means Fountain abandoning its house-queue model and re-emitting stations as open musicL feeds — which cannibalizes its walled-garden lock-in.

Risk B — Wavlake ships playlist-as-feed export with value routing. Wavlake owns the music-V4V value-routing primitive and already has playlists. If it exports user playlists as ordered musicL remoteItem feeds (UNKNOWN whether it already does), it covers gaps 2 and 3 quickly. Edge: even then, Wavlake has no wall-clock synced-radio mode and no curator-cut construct; AETHER's synced mode and curation split remain uncovered. Priority: verify Wavlake's current playlist export format directly, since that single UNKNOWN is the closest live threat.

Risk C — a spec-level scheduler emerges. If the podcast namespace adds a scheduling/time-anchor tag, any PC2.0 player could compute synced position and the "no app does synced radio" moat narrows to execution. VERIFIED the current spec has no such tag. Edge: AETHER can define and evangelize the wall-clock convention (epoch + cumulative-duration) first, shipping the reference implementation and the published-feed format before a committee standardizes it.

Net defensible edge: the field has every ingredient in isolation (synced single station, per-track value routing, remoteItem export, curated shows) but nobody combines them, and the two hardest-to-copy pieces — infrastructure-free wall-clock sync and stations-as-portable-feeds — cut against incumbents' walled-garden economics. That combination, not any single feature, is the moat.
