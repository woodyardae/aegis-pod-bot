# AETHER Value Model

Value routing for published Aether stations. Stations are Podcasting 2.0 feeds (`medium=musicL`) whose items carry an ordered list of `<podcast:remoteItem>` pointers into original creator feeds. Value is routed with `<podcast:value>` plus per segment `<podcast:valueTimeSplit>` using REMOTE value blocks, so sats route to each original creator's own value block. The station owner injects themselves as an additional recipient (the curation cut). Original feeds are never mutated.

This document specifies the split math and the streaming mechanics, grounded in the podcast namespace spec.

## 0. Spec grounding (read this first)

Source: `podcast:valueTimeSplit` tag spec, podcast-namespace repo (`docs/tags/value-time-split.md`), mirrored at https://podcasting2.org/docs/podcast-namespace/tags/value-time-split and originally proposed in https://github.com/Podcastindex-org/podcast-namespace/discussions/512

The load bearing facts, quoted:

- `startTime` (required): "The time, in seconds, to stop using the currently active value recipient information and start using the value recipient information contained in this element."
- `duration` (required): "How many seconds the playback app should use this element's value recipient information before switching back to the value recipient information of the parent feed."
- `remoteStartTime` (optional, default 0): "The time in the remote item where the value split begins. Allows the timestamp to be set correctly in value metadata."
- `remotePercentage` (optional, default 100): "The percentage of the payment the remote recipients will receive if a `<podcast:remoteItem>` is present."
- A `valueTimeSplit` contains EITHER one or more `<podcast:valueRecipient>` tags OR exactly one `<podcast:remoteItem>` tag. Not both.
- Remote nesting rule: "If the remote value block contains any `<podcast:valueTimeSplit>` tags, they should be ignored... When referencing a remote value block, only the root level block splits should be used."

The critical semantic, confirmed in the proposal discussion (#512): **remotePercentage is a PORTION of the segment total, not additive.** When `remotePercentage="95"`, 95% of the segment's sats go to the remote block's recipients (split among themselves by their own percentages) and the remaining 5% stays with the LOCAL value block (the parent feed's `<podcast:value>`, i.e. the station feed's own `<podcast:value>`). The remote block and the local block partition 100% of the segment between them at the ratio `remotePercentage : (100 - remotePercentage)`.

This partition is the entire lever we have. Everything below follows from it.

## 1. Curation cut math

An original creator's `<podcast:value>` block has N recipients whose `split` values sum to some total (conventionally 100). The station owner wants a curation cut of X% (worked example: X = 10, a 3 recipient original block).

Worked example original block (Feed A, episode ep-X):

```
recipient A1  split=50
recipient A2  split=30
recipient A3  split=20
```

Interpreted as fractions of the remote block: A1=50%, A2=30%, A3=20%.

### Option (a): station takes X% first, remainder passes pro-rata to the original block

Target end state for a 10% cut:

```
station owner        10.0%   of segment
A1  50% of remaining 90% =  45.0%
A2  30% of remaining 90% =  27.0%
A3  20% of remaining 90% =  18.0%
                    total = 100.0%
```

The original recipients keep their RELATIVE proportions (50:30:20) but their absolute shares shrink to 90% of what they were. Sum is exactly 100%.

### Option (b): station is additive on top, originals keep absolute shares

Target end state:

```
A1  50.0%
A2  30.0%
A3  20.0%
station owner  X% on top
```

For the station to get a separate 10% "on top" while A1..A3 keep their full absolute 50/30/20, the denominator must exceed 100. Either the total pool is 110 units (A gets 100/110 = 90.9% collectively, station 10/110 = 9.09%), or the originals literally keep 100% and the station's cut is drawn from somewhere else. There is no "somewhere else" in a single stream, so additive necessarily renormalizes down to a 100% pool anyway, landing back at numbers close to option (a) but with the station's effective take defined against a 110 base.

### Which is natively expressible

`valueTimeSplit` gives us exactly ONE knob at the segment level: `remotePercentage`, which partitions the segment between the referenced remote block and the local (station feed's own) `<podcast:value>` block. The remote block is the original creator's untouched value block (we cannot subdivide inside it, and by the nesting rule we cannot reach into its own splits or its valueTimeSplits). The local block is the station feed's `<podcast:value>`, which we DO control and can populate with the station owner as a recipient.

Map this onto the two options:

- Set `remotePercentage = 100 - X`. Then:
  - The original block collectively receives `(100 - X)%` of the segment, divided internally by ITS OWN splits (50:30:20 untouched, relative proportions preserved).
  - The local block (station owner) receives `X%` of the segment.

For X = 10, `remotePercentage="90"`:

```
remote block gets 90% of segment, split 50:30:20 internally:
  A1 = 0.90 * 50% = 45.0%
  A2 = 0.90 * 30% = 27.0%
  A3 = 0.90 * 20% = 18.0%
local block (station owner) = 10.0%
                      total = 100.0%
```

That is EXACTLY option (a). The relative proportions of the original recipients are preserved, their absolute shares scale by `(100 - X)/100`, and the station owner takes X% off the top. This falls straight out of a single `remotePercentage` value with zero manipulation of the original feed.

Option (b) is NOT natively expressible. `remotePercentage` only ever partitions a single 100% segment pool; it cannot create a >100% denominator. To approximate additive you would have to redefine the local block to hold both the station cut and "phantom" copies of the originals, which means mutating / duplicating the original recipients into the station feed. That violates the "original feeds are never mutated" rule (you would be copying their value block rather than referencing it) and breaks the moment an original creator changes their splits.

### Recommendation

**Use option (a), implemented as `remotePercentage = 100 - X`.**

Reasons, tied to what the spec actually supports:

1. It is the ONLY option the single `remotePercentage` knob expresses natively. One attribute, no feed mutation, originals referenced by `remoteItem` and left untouched.
2. Original recipients' RELATIVE splits are automatically preserved because the remote block is divided by its own internal percentages. If a creator later changes their splits, our station feed needs no edit; the change is honored at resolve time.
3. The station owner's cut sits in the LOCAL block, which is the station feed's own `<podcast:value>`. That is the one block we legitimately own and control.
4. It sums to exactly 100% with no renormalization ambiguity for players.

Cost of option (a) that must be stated plainly: the curation cut is taken FROM the creators' share, not added beside it. A 10% cut means creators collectively receive 90% of what a direct listen would have paid them. This is a curation tax, honestly labeled. If the product wants creators to receive their full amount and listeners to pay extra, that is a payment amount decision (listener boosts a larger total), not a split decision, and the split still uses option (a) on whatever total flows.

### Default cut and configurability

- Default curation cut: **X = 5%** (`remotePercentage="95"`). Low enough to read as a fair curation fee rather than a middleman toll, consistent with the low single digit "app fee" conventions in the value4value ecosystem.
- Configurable per station: **yes**, bounded. Allow the station owner to set X in `[0, 20]`. Below 0 is nonsensical; above 20 starts starving creators and invites listener backlash. Enforce the bound at publish time. X = 0 (`remotePercentage="100"`, the spec default) is a valid "no cut" pure passthrough station.
- The chosen X is realized purely as the per segment `remotePercentage` value in the published feed, so changing the cut is a republish, not a schema change.

## 2. Streaming mechanics

### Segment layout in the station feed

Each station feed item enumerates its programme as a sequence of `valueTimeSplit` blocks, one per scheduled segment, laid end to end on the item's local timeline. Concrete two segment example (Feed A ep-X for 237s, then Feed B ep-Y for 180s), 5% default cut:

```xml
<item>
  <!-- station feed's own value block: the LOCAL block.
       Station owner is the recipient here; this is where the cut lands. -->
  <podcast:value type="lightning" method="keysend">
    <podcast:valueRecipient name="Station Owner"
        type="node" address="<station-node-pubkey>" split="100"/>
  </podcast:value>

  <podcast:valueTimeSplit startTime="0" duration="237"
      remoteStartTime="0" remotePercentage="95">
    <podcast:remoteItem feedGuid="<A-guid>" itemGuid="<epX-guid>" medium="music"/>
  </podcast:valueTimeSplit>

  <podcast:valueTimeSplit startTime="237" duration="180"
      remoteStartTime="0" remotePercentage="95">
    <podcast:remoteItem feedGuid="<B-guid>" itemGuid="<epY-guid>" medium="music"/>
  </podcast:valueTimeSplit>
</item>
```

How the boundaries encode:

- `startTime` places each segment on the station item's own clock (0s, then 237s...). It is cumulative sum of prior durations, matching the SYNCED position rule (position = epoch + sum of prior durations).
- `duration` is the played length of that segment.
- `remoteStartTime` is the offset INTO the original remote item where playback begins (0 if the segment plays the remote track from its start). It exists so value metadata timestamps line up with the remote item, not to move the station side boundary.
- At `startTime + duration` the active split ends and, absent another split, playback falls back to the parent item's `<podcast:value>` (the local station block). Because our splits are laid contiguously, the next segment's split takes over immediately at the boundary.

### Computing the current recipient set at wall clock time T

SYNCED mode (virtual radio):

1. Compute station position `p = (T - epoch) mod total_cycle_duration` (wall clock maps to a position in the programme; total_cycle_duration = sum of all segment durations).
2. Find the segment S whose `[startTime, startTime + duration)` contains `p`.
3. Resolve S's `remoteItem` to the original feed's ROOT `<podcast:value>` block (ignore any valueTimeSplit children of that remote block, per the nesting rule).
4. Recipient set for the current instant:
   - remote recipients, each scaled by `remotePercentage/100` times their own internal split;
   - plus the local station recipient(s) scaled by `(100 - remotePercentage)/100`.
5. Stream sats each interval (typically every ~60s) to that set until `p` crosses into the next segment, then recompute.

ON-DEMAND mode (playlist): identical except `p` is the LISTENER'S playhead into the concatenated programme, not a function of wall clock. The listener can pause, seek, and scrub; the active segment follows their playhead. Everything downstream (steps 2 through 5) is the same. The only difference is the source of `p`.

The split MATH is identical in both modes. Only the position function differs (wall clock vs playhead).

### Few players implement remote valueTimeSplit (known risk) and graceful degradation

Reality: as of now, most podcast apps do NOT honor remote `valueTimeSplit` with `remoteItem` resolution. Support for even basic `valueTimeSplit` is thin, and the remote referenced variant (resolve another feed's value block at playback time) is thinner still.

Degradation ladder, best to worst, and where the sats go:

1. Full support: player resolves each `remoteItem`, applies `remotePercentage`, streams to originals + station cut per segment. Correct.
2. Player honors `valueTimeSplit` structurally but does NOT resolve remote value blocks: it sees a split it cannot resolve. Behavior is app specific; a careful app falls back to the parent item `<podcast:value>` for that segment, meaning ALL sats for that segment go to the STATION OWNER (the local block), and creators get nothing for that segment. This is the dangerous failure mode, the station silently collects 100%.
3. Player ignores `valueTimeSplit` entirely and streams to the item level `<podcast:value>`: again 100% to the station owner, creators get nothing.
4. Player does no value streaming at all: no sats move.

Mitigations, given the product will not fix third party players:

- Make the station feed's own `<podcast:value>` honest about degradation. Do NOT put only the station owner in the local block if we want creators protected under fallback. Option: in the local block, list creators as a courtesy fallback so a degrading player still spreads sats. This complicates the clean option (a) math, so treat it as a publish time toggle ("protect creators on fallback"), off by default for simplicity, documented as a known limitation.
- Prefer directing listeners to a known compliant player for launch and track which players resolve remote valueTimeSplit.
- Instrument: if we run a value receiving endpoint, we can observe whether sats arrive with correct per segment attribution and detect fallback collection.

State plainly in product docs: correct per creator routing depends on player support for remote `valueTimeSplit`, which is not yet widespread. Where it is absent, sats default to the station's local value block. This is a spec ecosystem limitation, not a bug in the feed.

## 3. Protocol / layer ownership

Value4value has two distinct layers, and Aether owns only one of them. Being precise about the boundary explains why player support is the gating risk (section 2) rather than a feed-authoring problem we can fix.

### The declaration layer (the PC2.0 feed) — Aether owns this

The RSS feed DECLARES intent. `<podcast:value>`, `<podcast:valueRecipient>`, `<podcast:valueTimeSplit>`, `remoteItem`, and `remotePercentage` are static data: they say "during this segment, this remote block should get this share and the local block should get the rest." The feed carries no money and executes nothing. It is a specification of who SHOULD be paid.

Aether, as the feed publisher, owns this layer completely and unilaterally:

- it composes the ordered `remoteItem` list,
- it emits one `valueTimeSplit` per segment with `remotePercentage = 100 - X`,
- it places the station owner in the station feed's local `<podcast:value>` (the curation cut),
- it never mutates original feeds; it only references them.

Everything Aether controls is a DECLARATION. The declaration is correct and complete regardless of any player.

### The execution layer (the player's wallet / value engine) — the listener's player owns this

The actual sat routing happens entirely inside the listener's app. At playback the player's value engine must: compute the current position, find the active segment, RESOLVE each `remoteItem` to the referenced feed's root value block (a live fetch), apply `remotePercentage` to partition the segment between remote and local blocks, and then send Lightning payments to every resolved recipient at the streaming cadence. None of this is in the feed; all of it is player behavior.

This is why player support is the gating risk. Aether can declare a perfect split and still have zero creators paid correctly, because the entity that EXECUTES the declaration is software Aether does not control. The compatibility matrix (player-compatibility-matrix.md) is a map of which execution engines honor the remote part of the declaration.

### Where WebLN fits vs app-side / NWC V4V

The execution layer needs to spend from a wallet. There are two common wiring patterns, and they are both execution-side, not declaration-side:

- App-side custodial / NWC: the player holds or is connected to a wallet and pays directly. Custodial players (Fountain-style) debit an internal balance. NWC (Nostr Wallet Connect) lets a player stream from an EXTERNAL wallet (self-custodial node or custodial Alby) over a permissioned connection (Castamatic-style "Connect NWC Wallet"). This is the dominant pattern for mobile V4V players and for Aether's own custodial grant flow (see preseeding-grant-design.md).
- WebLN: a browser-side bridge (a `window.webln` provider, e.g. an Alby extension) that lets a WEB player request payments from the user's browser wallet. It is the web equivalent of the same execution role: the page asks, the wallet provider signs and sends. Relevant for web players like CurioCaster.

Both WebLN and NWC/app-side wallets are just HOW the execution layer obtains spending authority. Neither changes the declaration. A player can have a perfectly wired wallet (WebLN or NWC) and STILL not resolve remote valueTimeSplit, in which case it pays the wrong recipient set from a correctly funded wallet. Wallet wiring and value-tag resolution are independent capabilities.

### Tie-back to the fallback ladder

Because Aether owns declaration but not execution, the fallback ladder in section 2 is entirely a property of the execution layer:

- a player that resolves remote valueTimeSplit executes the declaration faithfully (correct 45/27/18/10-style split);
- a player with a funded wallet but no remote resolution executes a DIFFERENT, degraded interpretation (pays the single local block it understands, so the station owner collects 100%);
- a no-V4V player executes nothing (Overcast / Apple Podcasts: feed still valid, no sats move).

Same declaration, three execution outcomes. Aether's leverage is limited to (1) making the declaration correct, (2) shaping the local/fallback block honestly so degradation is less harmful, and (3) steering listeners toward execution engines proven to honor remote resolution. It cannot force any player to execute the split it declared.

## 4. Canonical architecture: app-side execution

Sections 1-3 establish that Aether owns declaration (the feed) but not execution (the player's wallet), and that a PURE reference feed cannot carry a curation cut because the station owner is invisible to the value flow unless Aether sits in the playback path. This section resolves that: **Aether's canonical architecture executes value routing, wall-clock sync, and clipping inside Aether's own client, against the listener's own non-custodial wallet.** The published feed remains the portable fallback for every other player.

### The model

1. **Non-custodial wallet.** The listener connects their own Lightning wallet to the Aether client via NWC (Nostr Wallet Connect) or a browser WebLN provider (e.g. an Alby extension). Aether never holds a balance and never touches the funds; it only sends the connected wallet payment instructions. This removes custodial exposure entirely for the connected-wallet path (see `preseeding-grant-design.md` for the separate, deliberately custodial pre-seed grant, which is a distinct, small, spend-restricted balance, not general custody of listener funds).
2. **App-side sync.** The Aether client computes `position(now) = (now - anchorEpoch) mod totalCycleDuration` itself (SYNCED mode) or tracks the listener's playhead (ON-DEMAND mode), per section 2. This does not depend on any player capability; it is Aether's own code.
3. **App-side curation cut.** As each segment plays, the Aether client itself computes the split (`remotePercentage = 100 - X` against the resolved remote value block, per section 1) and streams sats directly: `X%` to the station owner, the remainder to the original creators' own recipients, in their own proportions. The cut is not left to a third-party player's willingness to resolve `valueTimeSplit`; Aether's client always applies it.
4. **App-side clipping.** Where a station entry is a partial play (see the sub-item clipping proposal in `./podcast-schedule-proposal-draft.md` and the TOS guardrails in `./pc20-namespace-capability-map.md`), the Aether client streams only the declared range and computes sats only for that window, live, rather than serving a pre-cut re-hosted file.
5. **Feed fallback in non-Aether players.** The published PC2.0 feed is unchanged by this architecture: it still declares `remoteItem` order, `medium=musicL`, and per-segment `valueTimeSplit` exactly as in `feed-examples/`. A listener using Podverse, CurioCaster, or any other PC2.0 app gets the degradation ladder from section 2: full remote-value resolution if the player supports it, channel-level fallback (100% to the station's local block) if it does not, or plain audio with no value routing if the player has no V4V at all. Aether's own app is simply the ONE player guaranteed to execute the full declaration correctly, because Aether wrote it.

### Tradeoff: app-side vs feed-path/re-host vs hybrid

| | App-side (Aether client executes) | Feed-path / re-host (cut rides on `valueTimeSplit` in Aether-served items) | Hybrid (both) |
|---|---|---|---|
| Custody | None. Listener's own wallet (NWC/WebLN); Aether never holds general funds. | None required by the split itself, but re-hosting audio typically means Aether also proxies bandwidth/CDN costs. | Same as app-side for the app path; feed path unchanged. |
| Curation cut reliability | Always lands; Aether's own code executes it every time. | Only lands in players that resolve remote `valueTimeSplit` (UNCONFIRMED per app, section 3) or that stream from Aether-hosted items at all. | Lands reliably in Aether's app; best-effort elsewhere. |
| Player-support dependency | None. Full experience does not depend on any third-party player's spec support. | High. Gated on `player-compatibility-matrix.md`; most players today do not resolve the remote case correctly. | Reduced but not eliminated for non-Aether players. |
| Content rights / TOS exposure | Low for whole-item playback; clipping exposure is scoped to Aether's own live-stream-and-clip behavior (see clipping guardrails). | Higher: re-hosting/transcoding another creator's media to attach a local value block breaks "pointers, not copies" and touches source TOS/licensing regardless of clipping. | Carries the feed-path's rights exposure in addition to app-side's. |
| Build cost | Requires shipping and maintaining an Aether client (mobile/web) that does sync + split + wallet wiring. | Lower app burden, but the underlying re-hosting infrastructure (storage, bandwidth, rights clearance) is itself substantial and ongoing. | Highest: both an app and re-hosting infra to build and maintain. |
| Reach without an Aether app | None; a listener without the Aether client gets the degraded feed experience only (no cut, ordered playback). | Some, in the subset of players that both resolve remote `valueTimeSplit` correctly AND are willing to stream Aether-hosted enclosures. | Same reach as feed-path for non-Aether players, plus full experience in Aether's app. |
| Recommendation | **Canonical model.** Resolves custody, cut reliability, and clipping exposure together without depending on ecosystem adoption. | Not recommended as primary; the re-hosting requirement conflicts with the never-mutate/never-copy posture stated throughout this doc set. | Not justified at launch: the added re-hosting infra and rights exposure buy only marginal reach in players whose remote-value support is unverified anyway. Revisit if interop testing (`value-routing-test-plan.md`) proves strong multi-player support. |

### Worked example: sats/min with the curation cut, app-side

Listener streams at 100 sats/minute inside the Aether app, listening to a segment whose original creator value block is A1=50/A2=30/A3=20, at the default 5% cut (`remotePercentage="95"`):

```
Per minute, streamed by the Aether client from the listener's own wallet:
  A1 (creator)         0.95 * 50% = 47.5 sats/min
  A2 (creator)         0.95 * 30% = 28.5 sats/min
  A3 (creator)         0.95 * 20% = 19.0 sats/min
  Station owner (cut)  0.05       =  5.0 sats/min
                        total     = 100.0 sats/min
```

Over a 10-minute segment: A1 = 475, A2 = 285, A3 = 190, station = 50, total = 1,000 sats. The Aether client computes and sends all four payments directly from the listener's connected wallet at the streaming cadence; no party other than the listener's own wallet ever custodies the funds. If the same listener instead used a non-Aether player that does not resolve remote `valueTimeSplit`, the same 1,000 sats over 10 minutes would go entirely to whatever single value block that player sees (typically the station's local block, per the section 2 fallback ladder), and creators would receive nothing for that stretch. That contrast is the concrete case for the canonical model.

## 5. Open spec ambiguities

- The two mirror sources phrase `remotePercentage` slightly differently (one reads "additive on top"). The proposal (#512) and the primary tag doc are clear it is a PORTION of the segment (remote gets X%, local keeps 100 - X%). We build on the portion reading. If a specific target player implements the additive reading, our cut math inverts; verify against the actual player before launch.
- The spec does not define behavior when `remotePercentage` is present alongside child `valueRecipient` tags (spec says EITHER remoteItem OR valueRecipients, not both), so the "put station owner in the local block" approach relies on the parent item `<podcast:value>` for the local share, NOT on mixing recipients into the split. Keep them separate.
- Fallback routing on unresolved remote blocks is not standardized. "Falls back to parent value" is the natural reading but not guaranteed across apps.
