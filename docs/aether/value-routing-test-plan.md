# AETHER Value Routing Test Plan

Goal: prove, before launch, that remote value routing and the curation-cut landing actually work in real players. Two things must be demonstrated end to end:

- (a) sats reach each ORIGINAL creator's remote value block, per segment, split by that creator's own internal percentages;
- (b) the STATION OWNER's curation cut lands in the station feed's local value block.

Consistent with value-model.md: default cut X = 5% (`remotePercentage="95"`), option (a) reading (`remotePercentage = 100 - X`, remote gets that portion, local keeps the rest), and the fallback ladder from that doc. The worked distribution used throughout this plan is the value-model.md example (3-recipient original block 50:30:20, X = 10, `remotePercentage="90"`):

```
A1 = 0.90 * 50% = 45%
A2 = 0.90 * 30% = 27%
A3 = 0.90 * 20% = 18%
station owner (local block) = 10%
                     total  = 100%
```

We test with X = 10 (not the 5% default) because 10 makes the arithmetic checkpoints unambiguous (45/27/18/10 are easy to eyeball in a ledger). The mechanism is identical for the 5% default.

## Players to test first (and why)

Pick the three players with the strongest EVIDENCE of remote valueTimeSplit / remoteItem music routing, because remote resolution (not plain V4V) is the capability Aether depends on.

1. **Fountain.** Named repeatedly as a Value Time Split early adopter and as a player that resolves music `remoteItem` routing (the Wavlake "songs played in compatible players like Fountain... 90% of boosts/streaming sats go directly to the artist" pattern names Fountain first). Strongest music + remote value routing evidence. Custodial wallet makes streaming observable. Sources: Blubrry value-time-split doc; Wavlake open-music post.
2. **CurioCaster.** Explicitly listed as an early adopter of valueTimeSplit ("early adopters... CurioCaster, Castamatic, Fountain, Podfans, Podfriend, Podverse") and as a V4V/boostagram player that pairs with an Alby wallet. Web based, which makes value-log observation and network inspection easier than native apps. Sources: Blubrry value-time-split doc; Alby V4V material.
3. **Podverse.** Named in the same valueTimeSplit early-adopter list AND in the Wavlake music-routing list ("Fountain, Podfans, Podverse"), plus it is open source with documented Alby streaming-sats integration, so behavior is inspectable and its boostagram/streaming records are well documented. Sources: Blubrry value-time-split doc; Podverse+Alby blog; Wavlake open-music post.

Why these three over the alternatives: they are the intersection of (named valueTimeSplit support) AND (named music/remoteItem routing) AND (observable wallet/ledger). Castamatic also supports valueTimeSplit and now NWC, and is a strong fourth if any of the above fails to resolve remote blocks. Breez, LNBeats, Podcast Guru have V4V but weaker public evidence of REMOTE valueTimeSplit resolution specifically, so they are compatibility-matrix subjects rather than first-line proof players.

CAVEAT to verify live during testing: public sources confirm these players support valueTimeSplit and music remoteItem routing, but do NOT independently confirm each one honors `remotePercentage` for the local-block curation split on a `musicL` station feed. That is exactly what this plan measures. Treat "resolves remote block" and "applies remotePercentage local cut correctly" as SEPARATE pass criteria per player.

## Test feeds

Three feeds under `docs/aether/feed-examples/` (two exist; add the control):

- (i) SYNCED station: `feed-examples/synced-radio-station.xml` (existing). `medium=musicL`, ordered `remoteItem`s, per-segment `valueTimeSplit` with `remoteItem` + `remotePercentage`, channel-level `<podcast:value>` as the local/fallback block holding the station owner. Position is wall-clock derived.
- (ii) ON-DEMAND playlist: `feed-examples/on-demand-playlist.xml` (existing). Same value structure, but active segment follows the listener playhead, not wall clock.
- (iii) LEGACY/control: `feed-examples/legacy-plain-no-vts.xml` (NEW, add). A plain feed with NO `valueTimeSplit`, only a channel/item-level `<podcast:value>`. Purpose: observe the fallback behavior (per value-model.md fallback ladder), confirming that a player with no remote-VTS support routes 100% to whatever single value block it sees, so we know the shape of graceful degradation.

For (i) and (ii), set every tested segment's `remotePercentage="90"` and use a 3-recipient remote block 50:30:20 so the expected split is exactly 45/27/18/10. Use RECEIVING wallets we control for A1, A2, A3, and the station owner, so we can read the ledger on the receive side.

## Test procedure (per player, per feed)

Setup (once per player):

1. Fund the player's sending wallet with a known balance (custodial in-app, or connect a controlled NWC/Alby wallet).
2. Set a KNOWN streaming rate (for example 100 sats/min) so expected per-minute amounts are round numbers.
3. Stand up four receiving Lightning addresses/nodes we control: `recv-A1`, `recv-A2`, `recv-A3`, `recv-station`. Put A1/A2/A3 in the original (remote) feed's value block at splits 50/30/20; put `recv-station` in the station feed's local `<podcast:value>`.

Test 1: SYNCED station (feed i)

1. Subscribe to `synced-radio-station.xml`. Confirm the app renders it as an ordered `musicL` list.
2. Begin playback; let a single segment (the one with the 50:30:20 remote block, `remotePercentage="90"`) stream for a measured 10 minutes = 1,000 sats total at 100 sats/min.
3. Expected receive-side ledger after 10 min on that segment:

   ```
   recv-A1       450 sats   (45%)
   recv-A2       270 sats   (27%)
   recv-A3       180 sats   (18%)
   recv-station  100 sats   (10%)
   total       1,000 sats
   ```

4. Cross a segment boundary; confirm the active recipient set switches to the NEXT segment's remote block and the station cut persists (10% of the new segment still lands at `recv-station`).

Test 2: ON-DEMAND playlist (feed ii)

Same as Test 1 but drive position with the playhead: play, pause, SEEK backward into the first segment, resume. Confirm the active recipient set follows the playhead (seeking back re-activates segment 1's remote block) and the 45/27/18/10 split holds for time actually played. This proves the position-function difference (playhead vs wall clock) does not change the split math.

Test 3: LEGACY/control (feed iii)

1. Play the plain feed for 10 min at 100 sats/min.
2. Expected: 100% (1,000 sats) to the single `<podcast:value>` block; no per-segment remote routing. This documents the fallback shape and confirms the player is streaming at all.
3. Then, on feeds (i)/(ii), if a player produces the Test-3 shape (everything to ONE block) instead of 45/27/18/10, that player does NOT resolve remote valueTimeSplit and is exhibiting the value-model.md fallback failure mode. Record which block it dumped into (station local block = station silently collects 100%).

## Verification / observation methods

Read routing from BOTH sides, do not trust the sending UI alone:

- Receive-side ledger (primary proof): each of `recv-A1/A2/A3/station` is a wallet/node we own. Sum received per address over the measured window and compare to 450/270/180/100. This is the ground truth for "sats reached each remote block" and "cut landed."
- Boostagram / TLV records: trigger a BOOST during the segment (not just streaming). Boosts carry TLV metadata (podcast, episode, sender, value). Inspect the received boostagram record to confirm the boost routed to the active segment's remote recipients + station, with correct proportions. Boostagram records are the clearest per-event attribution.
- Player value logs: where available (Podverse is open source; CurioCaster is web-inspectable) capture the app's value/streaming log or network requests to see the recipient set the app COMPUTED for the active segment, independent of what actually settled. This separates "computed the split right" from "payment failed in transit."
- Reconciliation: settled receive-side totals should equal computed player-side splits should equal the arithmetic 45/27/18/10. A mismatch localizes the fault (computation vs settlement vs no-resolution).

## Pass / fail criteria

For a player to PASS as Aether-capable:

- PASS-(a) remote routing: over the measured window, `recv-A1:recv-A2:recv-A3` receive in 45:27:18 ratio (allow small rounding/fee tolerance, for example +/- a couple of percent absolute), proving each original creator's remote block was resolved and paid per segment.
- PASS-(b) cut landing: `recv-station` receives the 10% local-block share (100 of 1,000 sats in the example) concurrently with the remote payments.
- PASS-boundary: at a segment boundary the recipient set switches to the next remote block with the cut preserved.
- FAIL modes: (1) all sats to one block (no remote resolution -> fallback); (2) remote paid but cut missing (player ignores local block during split); (3) cut paid but remote unresolved (player paid only the local/fallback); (4) nothing streamed (no V4V).

## Metrics table (signal that proves routing worked, per player)

| Player | Primary proof signal | Secondary signal | Expected PASS observation | Notes / confidence |
|---|---|---|---|---|
| Fountain | Receive-side ledger at recv-A1/A2/A3/station | Boostagram TLV on a boost | 450/270/180/100 over 10 min @100 s/min | Strongest music remoteItem routing evidence; confirm remotePercentage cut lands (unverified for local-block split) |
| CurioCaster | Web network inspection of value calls + receive-side ledger | Player value log in browser | Same 45/27/18/10 ratio; recipient set visible in requests | Web app eases observation; valueTimeSplit adopter, confirm remote music routing live |
| Podverse | Receive-side ledger + open-source value log | Streaming-sats record via Alby integration | Same ratio; app-computed split matches settlement | Open source + documented Alby streaming; best for computed-vs-settled reconciliation |
| Control (any of above on feed iii) | Receive-side ledger shows 1,000 to single block | n/a | 100% to one block, no per-segment routing | Establishes fallback shape baseline |

Launch gate: at least ONE first-line player must fully PASS (a)+(b)+boundary on BOTH feed (i) and feed (ii). If zero players pass the cut-landing criterion, the curation-cut model does not execute in the wild and the value-model.md fallback risk is realized; escalate before launch.
