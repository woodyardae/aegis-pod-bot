# The Billboard Charts of V4V: Aether Chart/Ranking Station Catalog

Comprehensive catalog of chart and ranking station types Aether can ship. This builds directly on `launch-catalog.md` (sections A1-A6 auto-gen stations + section 5 Podcast Index API capability map) and `station-taxonomy.md` section 3 (Charts + Rankings Design). Where those docs already specify a chart (A1-A6 / Top 10 This Week / Most Valued / New & Noteworthy / Daily Recap Reel), this catalog references it by its existing name and does not redefine the mechanics; it extends the set to the full "Billboard of V4V" range.

Value model grounding is `value-model.md`: every Aether station is a `medium=musicL` feed of ordered `<podcast:remoteItem>` pointers with `valueTimeSplit` routing (`remotePercentage = 100 - X`, default X=5).

## 1. Intro: charts are auto-regen musicL list feeds

A chart on Aether is not a UI widget. It is a station feed. Concretely: an on-demand `medium=musicL` feed whose body is an ordered set of `<podcast:remoteItem feedGuid=... itemGuid=...>` pointers, where the ordering IS the chart. A scheduled job recomputes a ranked list on a cadence, resolves each ranked entity to a `remoteItem`, and atomically swaps the feed's item list (pointer swap, per `station-taxonomy.md` scheduler notes). Subscribers re-pull the feed and see the new ordering. No bespoke chart infrastructure: the chart is the recomputed `remoteItem` sequence in a normal PC2.0 feed.

Two knobs distinguish charts:

- What entity is ranked: tracks/episodes (an `itemGuid` within a `feedGuid`), shows/feeds (a `feedGuid`, resolved to its latest or top episode for the pointer), or artists (a creator across multiple feeds; ranked as a set, emitted as that artist's representative items).
- What signal drives the ranking. This is the taxonomy that organizes the whole catalog:

| Signal family | Question it answers | Canonical example | Primary data source |
|---|---|---|---|
| Popularity | What is many people engaging with right now? | PI trending | Podcast Index `/podcasts/trending` |
| Value | What are people paying the most for? | Wavlake Top 40 (sats earned) | AETHER-TELEMETRY (or EXTERNAL-AGGREGATOR) |
| Velocity | What is rising fastest (rate of change, not level)? | "Rising on Lightning" | AETHER-TELEMETRY delta, or PI trending delta |
| Recency | What is newest that is worth hearing? | New & Noteworthy | PI `/recent/feeds`, `/recent/episodes` |
| Editorial | What did a human/team choose to elevate? | Flagship stations | Aether curation (not a signal chart, listed for completeness) |
| Social / Boost | What is the crowd loudly endorsing with boosts + comments? | TrueFans Leaderboard, boostagram counts | AETHER-TELEMETRY (boost events) |
| Collaborative | What did a defined group vote/co-curate up? | Community-voted charts | AETHER-TELEMETRY (votes) or curator input |

Popularity, recency, and (partly) velocity are servable from the LIVE Podcast Index API today because PI computes its own engagement/trending signal and tracks feed addition dates. Value, boost/social, and collaborative signals require money-and-attention telemetry the PI API does not expose: PI returns feed and episode METADATA and its own trending SCORE, but it does not expose per-feed sats-streamed, boost totals, or listener-hours. Those are Aether's own value-routing ledger (see `value-model.md`) or a third-party V4V aggregator's data.

Signal-source reality check (VERIFIED from live sources):

- Wavlake Top 40 ranks tracks by sats earned over a rolling 7-day window, refreshed for daily freshness. Source: https://zine.wavlake.com/top-40/
- LNBeats surfaces a "Featured Top 100 Music Shows" list and aggregates music by querying the Podcast Index. Source: https://lnbeats.com/
- Fountain charts "are updated daily and show you the top results from the last 7 days" ("Hot on Fountain"). Source: https://fountain.fm/faq/discover and https://fountain.fm/charts
- TrueFans has a per-show Leaderboard: fans earn points/sats for activity (play, follow, share, boost); the top fan becomes "SuperFan" and receives a 1% split of the podcaster's earned sats while they stay active. Source: https://truefans.fm/ (see also the show-level Leaderboard tab, e.g. https://truefans.fm/sats-and-sounds)
- Podcast Index `/podcasts/trending` ranks by PI's own engagement signal; params `max` (default 40), `since` (default 15 min ago), `lang`, `cat`, `notcat`. Source: https://podcastindex-org.github.io/docs-api/

Everything marked PROPOSED below is Aether's design, not an existing product feature.

## 2. Full catalog, grouped by signal family

Naming convention: brand-worthy chart names, internal type tag `chart:{family}:{slug}` consumed by the scheduler. Every chart resolves to a `remoteItem` list by the same terminal step: take top N ranked entities, dedupe, resolve each to (feedGuid, itemGuid), emit ordered `<podcast:remoteItem>`. That terminal step is written once here and referenced as "STANDARD RESOLVE" per chart:

> STANDARD RESOLVE: for a ranked list of feeds, resolve each feed's target episode via `GET /episodes/byfeedid?id={feedid}&max=1&newest=1` (latest) or a pinned `itemGuid` for track-level charts; dedupe by feedGuid (or feedGuid+itemGuid for track charts); emit top N as ordered `<podcast:remoteItem feedGuid itemGuid medium>`. Non-value items are kept but flagged non-value for the routing layer.

### 2A. Popularity signals (PI-servable today)

**C1. The Sat Hot 100 (global)**
- Ranks: shows (feeds), resolved to latest episode. The flagship "everything" chart.
- Signal: PI trending score, global, trailing 7 days. PROPOSED framing on a VERIFIED PI signal.
- DATA SOURCE: `GET /podcasts/trending?max=100&since={now-7d}&lang=en`.
- Cadence: daily (00:00 UTC).
- Compute: take trending feeds rank-ordered, STANDARD RESOLVE, emit top 100. This is the launch-catalog A3 concept widened to a branded 100-slot global board.

**C2. The Sat Hot 100: {Genre} (per-genre)**
- Ranks: shows within one Aether genre.
- Signal: PI trending within the genre's PI categories, trailing 7 days. Extends launch-catalog A1/A2 (Top 10 Tech / News) to a full per-genre family across all 17 Aether genres in `station-taxonomy.md`.
- DATA SOURCE: `GET /podcasts/trending?cat={comma-joined PI cats for the Aether genre}&since={now-7d}&max=50&lang=en`.
- Cadence: weekly (Mon 00:00 UTC), matching A1/A2.
- Compute: STANDARD RESOLVE, emit top 10-25 per genre.

**C3. Trending Now Radio (synced, live pulse)**
- Ranks: shows, resolved to latest episode, sequenced as a synced channel.
- Signal: PI trending over the trailing 24h (short window = "what's hot today"). This is launch-catalog A3 (Daily Trending Radio) restated in the chart taxonomy.
- DATA SOURCE: `GET /podcasts/trending?max=50&since={now-24h}&lang=en`.
- Cadence: daily.
- Compute: STANDARD RESOLVE, order by trending rank, publish as SYNCED (shared wall-clock timeline per `station-taxonomy.md` Axis A).

**C4. The Value Hot 100 (popularity, value-gated)**
- Ranks: shows that carry a value block, ordered by PI trending.
- Signal: PI trending, filtered to value-enabled feeds only. This is the "popular AND payable" board and the closest PI-only proxy for a value chart before Aether has its own sats telemetry.
- DATA SOURCE: `GET /podcasts/trending?max=200&since={now-7d}&lang=en` intersected with value-enabled membership from `GET /podcasts/bytag?podcast-value=true&max=5000` (or per-candidate `GET /value/byfeedid`).
- Cadence: daily.
- Compute: keep only trending feeds present in the value-enabled set, STANDARD RESOLVE, emit top 100. Note: this ranks by POPULARITY among value feeds, not by sats. True sats ranking is C7/C8 (telemetry).

**C5. Music Top 100 (V4V music shows)**
- Ranks: music shows/albums (feeds with `medium=music`), by trending among music feeds.
- Signal: popularity within music medium. Directly mirrors LNBeats' "Featured Top 100 Music Shows" concept (VERIFIED LNBeats surfaces such a list; https://lnbeats.com/) but built from PI.
- DATA SOURCE: `GET /podcasts/bymedium?medium=music&max=1000` as the candidate pool, ranked by `GET /podcasts/trending?cat=Music&since={now-7d}&max=200`; intersect.
- Cadence: daily.
- Compute: intersect music-medium feeds with music-trending, STANDARD RESOLVE (track-level where album feeds expose a lead track), emit top 100.

### 2B. Recency signals (PI-servable today)

**C6. New & Noteworthy (per genre + global)** [existing: launch-catalog A4]
- Ranks: newly indexed feeds passing a quality gate, newest first.
- Signal: recency of first index appearance, gated (added within 14d, >=3 episodes, has value block, has artwork + description). VERIFIED-design in `station-taxonomy.md` section 3.
- DATA SOURCE: `GET /recent/feeds?max=100&since={now-14d}&lang=en&cat={PI cats}`, value cross-checked via `/podcasts/bytag?podcast-value=true` or `/value/byfeedid`.
- Cadence: daily.
- Compute: apply quality gate, order newest-first, latest episode per feed, emit up to 25.

**C7. Fresh Drops (music, per genre)**
- Ranks: new music tracks/albums, newest first (the "Genre Firehose" leaf in `station-taxonomy.md`).
- Signal: recency of new music-medium feeds/episodes.
- DATA SOURCE: `GET /recent/episodes?max=100` and `GET /recent/feeds?cat=Music&since={now-7d}` filtered to `medium=music` via `/podcasts/bymedium?medium=music`.
- Cadence: daily.
- Compute: newest-first, STANDARD RESOLVE at track level, emit up to 40 per music genre.

**C8. Just Landed on Lightning (recency, value-gated)**
- Ranks: brand-new VALUE-ENABLED feeds only.
- Signal: recency intersected with value support. A cold-start-friendly "value chart" that needs zero Aether telemetry: it ranks by NEWNESS among payable feeds, not by sats.
- DATA SOURCE: `GET /recent/feeds?max=200&since={now-14d}&lang=en` intersected with `GET /podcasts/bytag?podcast-value=true`.
- Cadence: daily.
- Compute: keep value-enabled recent feeds, order newest-first, STANDARD RESOLVE, emit top 25.

### 2C. Value signals (AETHER-TELEMETRY, telemetry-gated)

These are the true "Billboard of money." They rank by sats and cannot be served by the PI API. Source is Aether's value-routing ledger (`value-model.md`), the same event stream that drives payout splitting. PI is used only to resolve display metadata via `/podcasts/byfeedid` / `/podcasts/byguid`.

**C9. Most Valued This Week (per genre + global)** [existing: launch-catalog A5]
- Ranks: items (feedGuid+itemGuid) by sats per listener-hour.
- Signal: `total_sats_streamed / total_listener_hours` over trailing 7 days, with a minimum listener-hour floor (anti-noise). Normalizes for audience size so an intensely-supported small feed can rank. VERIFIED-design in `station-taxonomy.md` section 3.
- DATA SOURCE: AETHER-TELEMETRY (value ledger). Metadata via `/podcasts/byfeedid`.
- Cadence: weekly (plus rolling daily variant for the global board).
- Compute: aggregate sats and listener-seconds per (feedGuid, itemGuid), compute sats/hour, drop below floor, rank desc, emit top 25. Only value-enabled items are eligible by construction.

**C10. The Sat Top 40 (raw earnings, tracks)**
- Ranks: music tracks by total sats earned (not normalized).
- Signal: raw `total_sats_streamed` per track, trailing 7-day rolling window. This is the direct Aether analogue of the VERIFIED Wavlake Top 40 (sats earned, 7-day window, daily refresh; https://zine.wavlake.com/top-40/). C9 normalizes; C10 does not, so C10 favors already-large tracks (the true "chart-topper" board).
- DATA SOURCE: AETHER-TELEMETRY (value ledger, streaming sats + boosts per itemGuid).
- Cadence: daily (7-day rolling window), matching Wavlake's cadence.
- Compute: sum sats per (feedGuid, itemGuid) over 7 days, rank desc, emit top 40 as track-level `remoteItem`s.

**C11. Highest Paid Per Minute (value density)**
- Ranks: episodes/tracks by sats per minute of content consumed.
- Signal: `sats_streamed / content_minutes_streamed`. Rewards content that earns densely (a 3-minute track pulling big boosts outranks a 2-hour show earning the same total). Distinct from C9 (per listener-hour) because it normalizes by CONTENT time, not audience time.
- DATA SOURCE: AETHER-TELEMETRY.
- Cadence: weekly.
- Compute: sats / played-minutes per item, min-plays floor, rank desc, emit top 25.

**C12. Whale Watch (biggest single boosts)**
- Ranks: items by largest single boost received (peak, not sum).
- Signal: `max(single_boost_sats)` per item over trailing 7 days. Surfaces content that triggered a standout individual payment (a different signal from aggregate value: one 1M-sat boost).
- DATA SOURCE: AETHER-TELEMETRY (individual boost events).
- Cadence: daily.
- Compute: max single boost per (feedGuid, itemGuid), rank desc, emit top 25. High anti-gaming sensitivity (see section 5): a self-boost trivially games peak, so require distinct payer + display without payer identity.

### 2D. Velocity signals (mostly telemetry-gated; one PI proxy)

**C13. Rising on Lightning (value velocity)**
- Ranks: items by acceleration of sats, not level.
- Signal: week-over-week sats growth rate: `(sats_this_7d - sats_prev_7d) / max(sats_prev_7d, floor)`. Catches breakouts before they top C10. The V4V "Bubbling Under / fastest riser" board.
- DATA SOURCE: AETHER-TELEMETRY (needs two consecutive weekly windows, so telemetry-gated AND needs history accrued).
- Cadence: daily (rolling 7d vs prior 7d).
- Compute: compute growth rate per item, require a minimum absolute sats floor in the current window (so tiny bases do not produce infinite ratios), rank desc, emit top 25.

**C14. Climbing the Charts (popularity velocity, PI proxy)**
- Ranks: shows by rank improvement in PI trending vs prior snapshot.
- Signal: change in PI trending rank/score between two Aether-captured snapshots. PROPOSED, buildable from PI IF Aether stores prior trending snapshots (the PI API gives a point-in-time list; Aether must persist yesterday's to diff). Needs no sats telemetry, only Aether's own retained PI history.
- DATA SOURCE: `GET /podcasts/trending` snapshots (today vs stored yesterday). Diff computed in Aether.
- Cadence: daily.
- Compute: for feeds present in both snapshots, `rank_prev - rank_now` (positive = climbing), rank desc by climb, STANDARD RESOLVE, emit top 25.

**C15. Breakout Debut (new-entry velocity)**
- Ranks: items appearing on a value chart (C9/C10) for the FIRST time this period.
- Signal: first-appearance flag on the value boards, ordered by their debut value. The "highest debut" board.
- DATA SOURCE: AETHER-TELEMETRY (value ledger + chart-history table).
- Cadence: weekly (runs after C9/C10).
- Compute: diff current C9/C10 membership against prior period, keep new entrants, order by their current value, emit top 15.

### 2E. Social / Boost signals (AETHER-TELEMETRY, telemetry-gated)

Boosts carry money AND a message, so these blend value with social endorsement. PI does not expose boost data.

**C16. Boostagram Top 40 (most-boosted)**
- Ranks: items by count of distinct boost events (not sats total, count of boosts).
- Signal: number of distinct boostagrams received, trailing 7 days. Counting boosts (endorsement breadth) differs from summing sats (C10, endorsement depth): many small boosters vs a few whales.
- DATA SOURCE: AETHER-TELEMETRY (boost event stream). Optionally cross-referenceable with EXTERNAL-AGGREGATOR boost feeds (Helipad-style LND boost pollers; https://github.com/Podcastindex-org/helipad) for shows Aether does not yet route for.
- Cadence: daily.
- Compute: count distinct boost events per (feedGuid, itemGuid), require distinct-payer dedupe, rank desc, emit top 40.

**C17. Crowd Favorites (broadest support)**
- Ranks: items by number of DISTINCT supporters (unique payers), not boost count.
- Signal: `count(distinct payer)` per item, trailing 7 days. The strongest anti-whale, anti-sybil-resistant social board: it rewards breadth of unique support, so a single large payer counts once.
- DATA SOURCE: AETHER-TELEMETRY (payer-identified boost/stream events).
- Cadence: weekly.
- Compute: distinct-payer count per item, min-supporter floor, rank desc, emit top 25.

**C18. SuperFan Leaderboard (fans, not content)**
- Ranks: LISTENERS/fans by their contributed sats + activity, per show and globally.
- Signal: fan activity score (sats streamed + boosts + shares). Directly modeled on the VERIFIED TrueFans SuperFan mechanic (top fan by activity earns a 1% split; https://truefans.fm/). This is a leaderboard station variant: the "chart" ranks people, and can drive an Aether SuperFan reward split analogous to TrueFans.
- DATA SOURCE: AETHER-TELEMETRY (per-payer ledger).
- Cadence: weekly (rolling).
- Compute: sum fan activity score per payer per show, rank desc. Note: this is a leaderboard display + reward input, not a `remoteItem` music feed (it ranks fans, not tracks); ship it as a stats surface, optionally feeding a "Fan Picks" content chart (C19).

### 2F. Collaborative signals (telemetry/curator-gated)

**C19. Fan Picks (collaborative, community-voted)**
- Ranks: tracks by community up-votes / adds from a defined contributor set (the Collab Playlist leaf in `station-taxonomy.md`).
- Signal: count of adds/votes from named collaborators or, in the boost-as-vote variant, a small fixed-amount "vote boost". PROPOSED.
- DATA SOURCE: AETHER-TELEMETRY (vote/add events) plus curator input; no PI signal.
- Cadence: daily or on-edit.
- Compute: tally votes per track, rank desc, owner holds publish authority + curation split (`value-model.md` curation cut applies), emit top 25.

**C20. Curators' Choice (editorial cross-cut)**
- Ranks: tracks/shows chosen by verified curators, weighted by curator standing.
- Signal: editorial selection, optionally weighted by the curator's own SuperFan/curation track record. This is the editorial family, listed to complete the taxonomy: the Wavlake ecosystem explicitly treats curators (Boostagram Ball, Sidestream Music, UpBeats) as part of the value stream (VERIFIED; https://zine.wavlake.com/top-40/).
- DATA SOURCE: Aether curation (human) + optional AETHER-TELEMETRY weighting. No PI signal.
- Cadence: weekly / on-edit.
- Compute: gather curator picks, order by curator weight then recency, emit up to 40. (Flagship stations F1-F7 in `launch-catalog.md` are the pure-editorial instances of this family.)

Catalog size: 20 chart types (C1-C20) across 6 signal families (popularity, recency, value, velocity, social/boost, collaborative), plus editorial noted as the flagship family.

## 3. Can the PI API serve this today?

| # | Chart | Signal family | PI-servable today? | If not, what's needed |
|---|---|---|---|---|
| C1 | The Sat Hot 100 (global) | Popularity | YES | `/podcasts/trending` |
| C2 | The Sat Hot 100: {Genre} | Popularity | YES | `/podcasts/trending?cat=` |
| C3 | Trending Now Radio | Popularity | YES | `/podcasts/trending?since=now-24h` |
| C4 | The Value Hot 100 | Popularity (value-gated) | YES | `/podcasts/trending` ∩ `/podcasts/bytag?podcast-value=true` |
| C5 | Music Top 100 | Popularity | YES | `/podcasts/bymedium?medium=music` ∩ trending |
| C6 | New & Noteworthy | Recency | YES | `/recent/feeds` + quality gate |
| C7 | Fresh Drops (music) | Recency | YES | `/recent/episodes` + `/podcasts/bymedium` |
| C8 | Just Landed on Lightning | Recency (value-gated) | YES | `/recent/feeds` ∩ `/podcasts/bytag?podcast-value=true` |
| C9 | Most Valued This Week | Value | NO | AETHER-TELEMETRY (sats/listener-hour) |
| C10 | The Sat Top 40 | Value | NO | AETHER-TELEMETRY (raw sats/track) |
| C11 | Highest Paid Per Minute | Value | NO | AETHER-TELEMETRY (sats/content-minute) |
| C12 | Whale Watch | Value | NO | AETHER-TELEMETRY (single boost events) |
| C13 | Rising on Lightning | Velocity | NO | AETHER-TELEMETRY (two weekly windows) |
| C14 | Climbing the Charts | Velocity | PARTIAL | PI trending + Aether-retained prior snapshot |
| C15 | Breakout Debut | Velocity | NO | AETHER-TELEMETRY + chart history |
| C16 | Boostagram Top 40 | Social/Boost | NO | AETHER-TELEMETRY (boost events); EXTERNAL-AGGREGATOR (Helipad) optional |
| C17 | Crowd Favorites | Social/Boost | NO | AETHER-TELEMETRY (distinct payers) |
| C18 | SuperFan Leaderboard | Social/Boost | NO | AETHER-TELEMETRY (per-payer ledger) |
| C19 | Fan Picks | Collaborative | NO | AETHER-TELEMETRY (votes) + curator |
| C20 | Curators' Choice | Editorial | NO (human) | Aether curation |

PI-servable today: C1-C8 (8 charts, popularity + recency families, incl. two value-GATED-by-membership boards C4/C8 that still need no sats telemetry). C14 is PARTIAL (PI data plus Aether's own retained snapshots, no sats). Telemetry-gated: C9-C13, C15-C19 (9 charts). Curator/editorial: C20.

Note on the value-gated popularity/recency charts (C4, C8): these are the strategic bridge. They FEEL like value charts to users ("only payable shows") but rank by PI signals, so they ship day 1 with zero Aether telemetry. They are the honest cold-start substitute for the true sats boards until the ledger fills.

## 4. Cold-start note: day-1 vs telemetry-accrued

Day 1 (launch), before Aether has any listening or sat telemetry, buildable purely from the live PI API + Aether's own retained data:

- C1, C2, C3, C4, C5 (popularity, incl. value-gated C4 and music C5)
- C6, C7, C8 (recency, incl. value-gated C8)
- C14 becomes available on day 2 (needs one prior day's PI trending snapshot to diff; day 1 captures the baseline, day 2 produces the first climb chart)

Needs accumulated Aether telemetry (dark until the ledger has data):

- Immediately once streaming starts but noisy for ~1-2 weeks (need enough listener-hours to clear the anti-noise floors): C9, C10, C11, C16, C17, C18
- Needs a full second window before first valid output: C13, C15 (both diff current vs prior period; earliest valid output is after 2x the window, e.g. ~14 days for a 7-day-window velocity chart)
- C12 (Whale Watch) works as soon as one qualifying boost lands, but is only meaningful once boost volume is non-trivial

Collaborative/editorial (C19, C20) are gated on curator onboarding, not telemetry; C20 (editorial) can ship day 1 as the flagship stations already do (F1-F7).

Practical cold-start sequence: ship the PI-servable set at launch, run C14's baseline capture immediately, and keep the telemetry charts (C9-C13, C15-C18) defined-but-dark with a "warming up" placeholder that flips live once each chart's floor is cleared.

## 5. Anti-gaming notes (value/boost charts move real money)

Sats are money, so C9-C18 are attackable for financial or vanity gain. Threat classes and mitigations:

- Wash-streaming / self-boosting: an actor pays themselves (or a controlled counterparty) to inflate a track's sats and climb C9/C10/C12. Mitigations: (a) exclude payments where payer node == a recipient node in the item's value block (self-payment filter); (b) for C12 Whale Watch, require the top boost to come from a payer distinct from all recipients; (c) net-flow sanity: a track whose inbound sats are dominated by a single circular payer pair is down-weighted.
- Sybil breadth attacks: one actor spins up many wallets to fake "distinct supporters" on C17/C16. Mitigations: distinct-PAYER counting is necessary but not sufficient; add a minimum per-payer economic cost (sybil wallets still each spend real sats, so raise the min qualifying boost), rate-limit new-payer weight, and weight a payer's vote by their account age / cumulative history (a brand-new wallet counts less).
- Whale distortion: a single large payer dominates a raw-sats board (C10) and buys the #1 slot. Mitigation: this is WHY the catalog carries both raw (C10) and normalized boards. Feature C9 (per listener-hour) and C17 (distinct supporters) as the "fair" boards; label C10 explicitly as raw earnings so users read it correctly. Optionally cap any single payer's contribution to a track's charted total (e.g. one payer contributes at most K% of the sats that count toward ranking).
- Velocity ratio abuse: C13 (growth rate) is trivially gamed from a tiny base (1 sat to 1000 sats = 1000x). Mitigation: the absolute-sats floor in the current window (already specified in C13) plus a minimum prior-window base or a smoothing constant in the denominator.
- Boost-count farming: many 1-sat boosts to inflate C16. Mitigation: minimum qualifying boost amount to count, plus distinct-payer dedupe.
- Circular curation / self-dealing: on C19/C20 a curator elevates their own or a colluding creator's tracks to earn the curation split. Mitigation: exclude a curator's own value-block feeds from charts that pay that curator; log curator picks publicly for accountability.

Cross-cutting: publish the ranking window and floors (Wavlake's stated transparency posture; https://zine.wavlake.com/top-40/), keep an append-only audit of the events feeding each chart, and treat any chart that directly triggers a payout (e.g. a SuperFan split as in TrueFans, or a "top of chart" bonus) as higher-assurance: those get the strictest self-payment and sybil filters because gaming them pays out directly.

## 6. Recommended launch set (3-5 stations, day-1 buildable from PI API)

Consistent with `launch-catalog.md` (which already ships A1-A6): ship these five branded chart stations at launch, all servable from the live PI API with zero Aether telemetry.

1. C1 The Sat Hot 100 (global) — daily, `/podcasts/trending` global 7d. The marquee board; anchors the "Billboard of V4V" identity. Supersedes/rebrands launch-catalog A3's global concept.
2. C4 The Value Hot 100 — daily, trending ∩ value-enabled. The honest cold-start value chart: reads as a value board, needs no sats telemetry. Highest-leverage launch item.
3. C6 New & Noteworthy — daily, `/recent/feeds` + quality gate. Already specified as A4; ship as-is.
4. C5 Music Top 100 — daily, music-medium ∩ music-trending. Mirrors LNBeats' Top 100 Music Shows and gives the music side (F2/F3/F7 flagships) a living chart companion.
5. C2 The Sat Hot 100: {Genre} — weekly, per-genre trending. Ships as the A1/A2 family generalized to all 17 Aether genres; start with the 3-4 densest genres (News & Politics, Tech, and the three Music genres) and expand.

Hold for telemetry phase 2 (flip live as the ledger warms): C9 Most Valued This Week (already A5), C10 The Sat Top 40, C13 Rising on Lightning, C16 Boostagram Top 40, C18 SuperFan Leaderboard. Capture C14's baseline snapshot from day 1 so Climbing the Charts can go live on day 2.

---

Sources (VERIFIED live):
- Wavlake Top 40 (sats earned, 7-day window, daily freshness): https://zine.wavlake.com/top-40/
- LNBeats "Featured Top 100 Music Shows", PI-aggregated: https://lnbeats.com/
- Fountain charts (daily, top of last 7 days): https://fountain.fm/faq/discover ; https://fountain.fm/charts
- TrueFans per-show Leaderboard + SuperFan 1% split: https://truefans.fm/ ; https://truefans.fm/sats-and-sounds
- Podcast Index API (trending params, value filters): https://podcastindex-org.github.io/docs-api/
- Helipad (boost poller, EXTERNAL-AGGREGATOR reference for C16): https://github.com/Podcastindex-org/helipad
