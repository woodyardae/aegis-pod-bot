# AETHER Player Compatibility Matrix

Which podcast players can actually EXECUTE Aether's value routing. The gating capability is REMOTE valueTimeSplit (resolving another feed's value block at playback time and applying `remotePercentage`), because Aether stations route sats to original creators' remote blocks per segment (see value-model.md). Plain V4V is necessary but not sufficient.

Confidence key: HIGH = named in multiple sources for that specific capability. MED = supports the general feature but the specific remote/music behavior is inferred, not directly confirmed. UNKNOWN = no reliable public confirmation found; must be tested live (do not assume).

Sources drawn on: Blubrry Value Time Split doc (podcasting 2.0 early-adopter list), Wavlake open-music post (music remoteItem routing player list), Alby V4V/value-time-split blog material, Podverse+Alby streaming-sats blog, Castamatic NWC release note, general podcastindex.org/apps V4V app listings. Where a cell is UNKNOWN it means those sources did not confirm it; it is not a claim of absence.

## Matrix

| Player | V4V / value streaming | valueTimeSplit | REMOTE valueTimeSplit (matters for Aether) | medium=musicL / music handling | remoteItem / playlist handling | Notes / confidence |
|---|---|---|---|---|---|---|
| Fountain | Yes (HIGH) | Yes (HIGH) | Likely yes (MED-HIGH) | Yes, music-native (HIGH) | Yes, resolves music remoteItem (HIGH) | Named first for Wavlake music routing (~90% to artist); valueTimeSplit early adopter. Confirm remotePercentage local-cut behavior live. |
| Podverse | Yes (HIGH) | Yes (HIGH) | Likely yes (MED) | Yes (MED-HIGH) | Yes (MED) | valueTimeSplit early adopter + in Wavlake music-routing list; open source, documented Alby streaming. Best for inspection. |
| CurioCaster | Yes (HIGH) | Yes (HIGH) | Likely yes (MED) | Yes (MED) | Yes (MED) | Explicit valueTimeSplit early adopter; V4V + Alby wallet. Web app, easy to observe. Remote music cut unconfirmed. |
| Breez | Yes (HIGH) | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | Well-known V4V/podcast app (self-custodial Lightning), but no source confirms valueTimeSplit or remote resolution. Test before relying. |
| LNBeats | Yes (HIGH) | UNKNOWN | UNKNOWN | Music-oriented (MED) | Likely (MED) | Music/V4V focused (Wavlake-adjacent ecosystem), so music+remoteItem plausible, but valueTimeSplit support not confirmed in sources. UNKNOWN on the gating capability. |
| Castamatic | Yes (HIGH) | Yes (HIGH) | Likely yes (MED) | UNKNOWN | UNKNOWN | valueTimeSplit early adopter; added NWC (12.5) for any NWC wallet. Strong V4V; music/remote-music handling unconfirmed. Good fourth test candidate. |
| Podcast Guru | Yes (HIGH) | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | Listed among V4V/boostagram + live-item players; no confirmation of valueTimeSplit or remote resolution. Treat gating capability as UNKNOWN. |
| Podcat | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | No reliable public V4V/valueTimeSplit confirmation found in sources consulted. Fully UNKNOWN; must be tested. |
| Overcast | No V4V (HIGH) | No (HIGH) | No (HIGH) | No music-list routing (HIGH) | Ignores (HIGH) | Baseline no-V4V player. Renders feed as a normal podcast; streams no sats. Graceful-degradation reference: zero routing. |
| Apple Podcasts | No V4V (HIGH) | No (HIGH) | No (HIGH) | No (HIGH) | Ignores PC2.0 value tags (HIGH) | Baseline no-V4V player. Reads standard RSS only; ignores all `podcast:value*`. Reference for "feed still valid, no sats move." |

## Reading the matrix

Aether's value routing WORKS TODAY only on players that resolve REMOTE valueTimeSplit and apply `remotePercentage`. On current evidence that is the Fountain / Podverse / CurioCaster cluster (the three named as valueTimeSplit adopters that also appear in music remoteItem routing lists). Those are the launch-critical targets and the first-line proof players in value-routing-test-plan.md. Castamatic is a strong fourth (confirmed valueTimeSplit + NWC) pending confirmation of music-remote handling.

The middle tier (Breez, LNBeats, Podcast Guru) has real V4V streaming but UNKNOWN status on the one capability that matters, remote valueTimeSplit resolution. Do not assume they route to original creators per segment; each must be tested. If they only do base V4V, they exhibit the fallback failure mode from value-model.md: sats go to whatever single `<podcast:value>` block they see, which on an Aether station is the local block, so the station owner silently collects 100% and creators get nothing. That is the danger case, and it is precisely the middle tier where it is most likely.

The baseline tier (Overcast, Apple Podcasts) is the honest floor: no V4V at all. The feed is still spec-valid RSS/`musicL`, so it renders as a curated list and simply moves no sats. This is fully graceful degradation (nobody is mis-paid; nothing is paid) and is the reference behavior against which the "danger case" fallback is contrasted.

Net: value routing is real but narrow. Aether should launch pointing users at the Fountain/Podverse/CurioCaster cluster, prove routing there per the test plan, and treat every UNKNOWN cell as "route-to-station-fallback until proven otherwise."

## Facts not verified

- No source directly confirms that Fountain/Podverse/CurioCaster apply `remotePercentage` to keep the local-block curation cut on a `musicL` station feed (they confirm remote music routing generally). This is the key thing the test plan measures.
- Breez, Podcast Guru, Podcat, LNBeats: valueTimeSplit and remote-resolution status UNKNOWN from public sources; marked as such rather than guessed.
- Version sensitivity: player support changes by release (e.g. Castamatic gained NWC in 12.5). Matrix reflects best available evidence as of research date and must be re-checked against current app versions before launch.
