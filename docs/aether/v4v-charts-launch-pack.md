# V4V Charts Launch Pack: Top 10 Day-1 Shortlist

Launch-ready subset of the 20-chart catalog in `v4v-charts-catalog.md`. This pack exists to answer one question for planning: which charts can ship on day one with the Podcast Index API access that is now live, and which are blocked on Aether accumulating its own value-routing telemetry. Mechanics, formulas, and anti-gaming notes for each chart are defined once in `v4v-charts-catalog.md`; this file does not restate them, it sequences them for launch.

## Top 10, ranked by launch priority

| Rank | Chart | Catalog ref | Data source | Cadence | Confidence | Telemetry dependency |
|---|---|---|---|---|---|---|
| 1 | The Sat Hot 100 (global) | C1 | `GET /podcasts/trending?max=100&since={now-7d}&lang=en` | Daily | High (PI trending is live and stable) | None. PI-servable today. |
| 2 | The Value Hot 100 | C4 | `/podcasts/trending` ∩ `/podcasts/bytag?podcast-value=true` | Daily | High | None. Value-GATED by membership, not by sats; the honest cold-start "value chart." |
| 3 | New & Noteworthy (global + per genre) | C6 (= launch-catalog A4) | `GET /recent/feeds?max=100&since={now-14d}` + quality gate | Daily | High (already specified, reused as-is) | None. |
| 4 | Music Top 100 | C5 | `/podcasts/bymedium?medium=music` ∩ `/podcasts/trending?cat=Music` | Daily | Medium-High (two-call intersection adds a failure mode vs single-endpoint charts) | None. |
| 5 | The Sat Hot 100: {Genre} | C2 (= launch-catalog A1/A2 generalized) | `/podcasts/trending?cat={PI cats}&since={now-7d}` per Aether genre | Weekly | High | None. Start with News & Politics, Tech, and the three Music genres; expand to all 17. |
| 6 | Trending Now Radio (synced) | C3 (= launch-catalog A3) | `/podcasts/trending?since={now-24h}` | Daily | High | None. Only chart in the day-1 set published as a SYNCED station rather than on-demand. |
| 7 | Fresh Drops (music, per genre) | C7 | `/recent/episodes` + `/podcasts/bymedium?medium=music` | Daily | Medium (recency + medium filter intersection, narrower verified precedent than C1/C6) | None. |
| 8 | Just Landed on Lightning | C8 | `/recent/feeds` ∩ `/podcasts/bytag?podcast-value=true` | Daily | Medium-High | None. Second value-gated cold-start board; ships alongside C4 as a pair (broad popularity-gated vs pure recency-gated). |
| 9 | Climbing the Charts | C14 | `/podcasts/trending` snapshot vs Aether-retained prior-day snapshot | Daily | Medium (day 1 = baseline capture only, no visible output; day 2 = first real chart) | Partial: needs one day of Aether-retained PI history, no sats data. |
| 10 | Daily Recap Reel | (= launch-catalog A6, derived) | Composite of C1/C6/C9-style climber detection, minus the sats-dependent climber component at launch | Daily | Medium (originally specified assuming Most Valued climbers exist; at launch, substitute Top 10 deltas + New & Noteworthy picks only, add sats-based climbers once C9 goes live) | Reduced scope at launch (no value-ledger climbers yet); full version needs AETHER-TELEMETRY. |

## Split: PI-API buildable now vs Aether-ledger required

**Ship at launch, zero Aether telemetry required (ranks 1-9 fully, rank 10 in reduced form):**
C1, C2, C3, C4, C5, C6, C7, C8, C14 (baseline capture day 1, live day 2), reduced-scope Daily Recap Reel.

**Do not ship at launch; require the Aether value-routing ledger to accrue data first (see `value-model.md` for the ledger's role in split computation):**
C9 Most Valued This Week, C10 The Sat Top 40, C11 Highest Paid Per Minute, C12 Whale Watch, C13 Rising on Lightning, C15 Breakout Debut, C16 Boostagram Top 40, C17 Crowd Favorites, C18 SuperFan Leaderboard.

Sequencing note: C13 and C15 need a full second comparison window before their first valid output (roughly 14 days for a 7-day-window velocity chart), so they lag the other telemetry-gated charts even after the ledger exists. C9/C10/C11/C16/C17 can go live as soon as their anti-noise floors clear, expected 1-2 weeks after streaming begins per `v4v-charts-catalog.md` section 4.

## Why this order

Ranks 1-3 are the highest-leverage, lowest-risk launch charts: single or near-single PI endpoint, no intersection logic, and C1/C4 together give the marquee "everything" board plus the value-flavored board on day one. Ranks 4-8 add breadth (music, per-genre, recency) at slightly higher implementation risk (multi-call intersections). Ranks 9-10 are included in the top 10 because they cost nothing extra to start capturing on day 1 (a snapshot job, a reduced-scope recap) even though their full value only appears on day 2 or once telemetry exists; deferring their setup would just delay when they can go live.
