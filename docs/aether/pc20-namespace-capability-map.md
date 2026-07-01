# PC2.0 Namespace Capability Map (AEGIS AETHER)

Definitive reference on what the Podcasting 2.0 namespace gives us today versus what AEGIS AETHER must build externally. Ground truth for the Aether product: user-created, publishable scheduled feeds in two modes (SYNCED virtual radio and ON-DEMAND playlist), published as valid PC2.0 `medium=musicL` feeds with ordered `<podcast:remoteItem>` pointers and value routing to original creators.

Spec source: the live namespace document at `https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md` and the per-tag files under `docs/tags/` in that repo (fetched 2026-07-01). Where a claim could not be verified from a live fetch, it is flagged inline.

---

## 1. WHAT WE USE

### 1.1 Summary tier table

| Tag | Version / status | Role in Aether | Player support tier |
|-----|------------------|----------------|---------------------|
| `<podcast:remoteItem>` | Stable, in 1.0 spec | The ordered pointers that ARE the station body | Widely supported by PC2.0 apps that consume `musicL`/`publisher` feeds; patchy in legacy apps |
| `<podcast:medium>` (`musicL`) | Stable, in 1.0 spec | Declares the feed as a curated List of remote items | Recognized by PC2.0-aware apps; ignored (degrades to plain items) elsewhere |
| `<podcast:value>` | Stable, widely deployed | Base value block per channel/item | Widely supported (V4V is the flagship PC2.0 feature) |
| `<podcast:valueTimeSplit>` | Stable in spec, newer feature | Time-boxed switch of recipients per segment | Newer / patchy: a named short list of apps only (see 3) |
| `<podcast:valueTimeSplit>` + nested `<podcast:remoteItem>` (remote value routing) | In spec, least-deployed variant | Routes sats to each original creator's own value block per segment | Uncertain / patchy: spec exists, real-world implementation is thin (see 3) |
| `<podcast:chapters>` | Stable, widely deployed | Episode-level chapter/clip metadata (per enclosure) | Widely supported |
| `<podcast:liveItem>` | Stable, moderately deployed | Live/scheduled-stream item (NOT a wall-clock scheduler) | Moderate; growing |

### 1.2 `<podcast:remoteItem>`

Purpose (spec): "provides a way to 'point' to another feed or an `<item>` in another feed in order to obtain some sort of data." This is the load-bearing tag for Aether: a published station is an ordered list of these.

Attributes:

| Attribute | Required | Notes |
|-----------|----------|-------|
| `feedGuid` | Yes | The `<podcast:guid>` of the remote feed being pointed to. |
| `feedUrl` | No | URL of the remote feed. Fallback when `feedGuid` cannot be resolved. "If both are present and the app is capable the `feedGuid` should be resolved and used." |
| `itemGuid` | No | The `<guid>` of the specific `<item>` in the remote feed. Present when pointing at one track rather than a whole feed. |
| `medium` | No | The `<podcast:medium>` type of the remote feed (e.g. `music`). |
| `title` | No | Free string title for display without a remote lookup. Useful so a station renders track names even if the app does not resolve the pointer. |

No time-range attributes: `remoteItem` has NO `startTime`, `endTime`, `offset`, or `duration`. It references a WHOLE feed or a WHOLE item and cannot address a sub-range (clip) of the target media. This is the root of gap 2 in section 2. Allowed parents per `docs/tags/remote-item.md` are `<channel>`, `<podcast:podroll>`, `<podcast:valueTimeSplit>`, `<podcast:publisher>` only; `liveItem` is NOT a permitted parent, so "a liveItem holding a list of remoteItems" is not a spec-sanctioned construction.

Aether usage: ordered `<podcast:remoteItem>` children at channel level, each carrying `feedGuid` + `itemGuid` + `title`, define playback order. Order in the XML is the playlist order. We never mutate the remote feeds.

Source: `docs/tags/remote-item.md`.

### 1.3 `<podcast:medium>` and the `musicL` List convention

Allowed medium values (core): `podcast` (default), `music`, `video`, `film`, `audiobook`, `newsletter`, `blog`, `publisher`, `course`, plus `mixed`.

List variants: "each medium also has a counterpart 'list' variant, where the original medium name is suffixed by the letter 'L' to indicate that it is a 'List' of that type of content." So `musicL`, `podcastL`, `audiobookL`, etc.

List semantics (spec): "A 'list' medium feed should not be expected to have regular `<item>`'s. Rather, a 'List' feed is intended to exclusively contain one or more `<podcast:remoteItem>`'s." `mixed` (as a List) allows aggregating different medium types in one feed.

Aether usage: a SYNCED or ON-DEMAND station is a `musicL` feed (or `mixed`/`musicL` when it blends podcast segments and music). The body is remote items, not local enclosures. This is exactly the shape the spec intends for curated lists, which is why Aether stations degrade gracefully: a non-PC2.0 app that ignores `medium` still sees a feed, and PC2.0 apps that understand `musicL` render the curated list.

Source: `docs/tags/medium.md`.

### 1.4 `<podcast:value>` and `<podcast:valueRecipient>`

`<podcast:value>` attributes:

| Attribute | Required | Notes |
|-----------|----------|-------|
| `type` | Yes | Service slug of the crypto/protocol layer (e.g. `lightning`). |
| `method` | Yes | Transport mechanism (e.g. `keysend`). |
| `suggested` | No | Suggested per-payment amount (e.g. `0.00000005000`). |

Parent: `<channel>` or `<item>`. Contains one or more `<podcast:valueRecipient>`.

`<podcast:valueRecipient>` attributes:

| Attribute | Required | Notes |
|-----------|----------|-------|
| `type` | Yes | Address type: `node` (Lightning node pubkey) or `lnaddress` (Lightning Address). |
| `address` | Yes | The receiving address (hex pubkey for `node`, Lightning Address for `lnaddress`). |
| `split` | Yes | Number of shares. Distribution is proportional to the sum of all splits. |
| `name` | Recommended | Free-form label for the recipient. |
| `customKey` | No | Custom record key sent with the payment. |
| `customValue` | No | Value paired with `customKey`. |
| `fee` | No | Boolean; assumed `false` if absent. Marks a fee recipient. |

Aether usage: the base `<podcast:value>` on the channel is the station-owner curation split fallback. Per-segment routing to the original creators is done with `valueTimeSplit` (below).

Sources: `docs/tags/value.md`, `docs/tags/value-recipient.md`.

### 1.5 `<podcast:valueTimeSplit>` (including remote value routing)

Purpose: time-based switching of value recipients during playback, "a combination of the concept of soundbite and remoteItem where a start time and a duration is supplied with alternative value recipients."

Attributes:

| Attribute | Required | Default | Notes |
|-----------|----------|---------|-------|
| `startTime` | Yes | N/A | Seconds into the enclosure at which to stop using the currently active recipients and start using this element's recipients. |
| `duration` | Yes | N/A | How many seconds to use this element's recipients before switching back to the parent feed's recipients. |
| `remoteStartTime` | No | 0 | The time in the remote item where the value split begins, so payment metadata timestamps are correct. |
| `remotePercentage` | No | 100 | Percentage of the payment the remote recipients receive when a nested `<podcast:remoteItem>` is present. Clamped to 0..100. |

Node content: the element must contain EITHER one or more `<podcast:valueRecipient>` (locally specified) OR exactly one `<podcast:remoteItem>` (the remote-value case).

Remote value routing (the mechanism Aether depends on):
- When a `<podcast:valueTimeSplit>` nests a `<podcast:remoteItem>`, the payment for that time window is routed to the REMOTE feed's own value block, taking `remotePercentage` of the payment.
- Spec constraint: "Only the root level block splits should be used and any `<podcast:valueTimeSplit>` children are to be ignored" in the resolved remote feed. That is, we route to the remote's channel-level `<podcast:value>`, not recursively into its own time splits.
- The remaining share (100 minus `remotePercentage`) stays with the parent feed's recipients, which is exactly the hook for the station-owner curation cut.

Aether usage: for each segment (one remote item in the ordered list, positioned on a synthetic combined timeline), emit a `valueTimeSplit` with the segment's `startTime`/`duration`, a nested `remoteItem` pointing at the original track's feed (so its creators are paid), a `remotePercentage` below 100, and the residual routed to the station owner via the parent value block. This is how sats reach each original creator per segment while the station owner takes an ADDITIONAL curation cut without ever mutating the original feeds. See `feed-examples/synced-radio-station.xml` and `feed-examples/on-demand-playlist.xml`.

Source: `docs/tags/value-time-split.md`.

### 1.6 `<podcast:chapters>` and clips (episode-level)

Attributes:

| Attribute | Required | Notes |
|-----------|----------|-------|
| `url` | Yes | URL of the chapters file. |
| `type` | Yes | MIME type; JSON preferred (`application/json+chapters`). |

The linked JSON format supports at least `startTime`, `title`, `img`, `url` per chapter (full field set defined in `jsonChapters.md`; not re-fetched here).

Scope note: chapters/clips are EPISODE-level (they mark positions inside a single enclosure). They are NOT a cross-item scheduler and cannot express a wall-clock timeline across multiple remote items. Aether may use chapters inside a single stitched segment, but they do not solve station-level sync.

Source: `docs/tags/chapters.md`.

### 1.7 `<podcast:liveItem>`

Attributes:

| Attribute | Required | Notes |
|-----------|----------|-------|
| `status` | Yes | One of `pending`, `live`, `ended`. The authoritative signal; `live` means the stream is on air. |
| `start` | Yes | ISO8601 timestamp the stream "should" begin. |
| `end` | Recommended | ISO8601 timestamp the stream "should" end. |

Structure mirrors a normal `<item>` but for live streams. Spec caveat: "start and end attributes denote when the live stream 'should' start and end. But, real life dictates that those times might not be adhered to." A robust live item carries `<podcast:alternateEnclosure>`/`<enclosure>` plus `<podcast:contentLink>` for fallback.

Why this is NOT our scheduler: `liveItem` announces a single upcoming or in-progress STREAM with a real broadcast source. It has one `start`/`end` per item, no repeat cadence, no notion of "position = epoch + sum of prior durations," and it presumes actual streaming infrastructure. Aether SYNCED mode has no broadcast infra: every listener computes the same wall-clock position from a shared anchor and the ordered items' durations. `liveItem` is the closest existing tag and still does not express that. Source: `docs/tags/live-item.md`.

---

## 2. WHAT IS MISSING (our moat)

Confirmed from a full-text search of the live `docs/1.0.md` (fetched 2026-07-01): the terms `schedule`, `epoch`, `wall-clock`, `cadence`, and `recurring` return NO results. There is:

- no `<podcast:schedule>` tag,
- no epoch / anchor-time field,
- no duration-sum or "current position" mechanism,
- no repeat/cadence attribute anywhere in the namespace.

The only time-bearing tags are: `valueTimeSplit` (payment timing WITHIN one enclosure), `chapters`/clips (marks WITHIN one enclosure), and `liveItem` (`start`/`end` for one live stream). None expresses a synthetic, shared, wall-clock timeline computed across a list of remote items.

Why this forces external sync: Aether SYNCED mode defines each listener's playback position as

```
position(now) = (now - anchorEpoch) mod totalCycleDuration
```

resolved against the ordered items' cumulative durations. The namespace has no field to carry `anchorEpoch`, no field to declare the mode (synced vs on-demand), and no field for repeat cadence. So Aether must:

1. Store the anchor epoch, mode, and cadence in its OWN backend / feed-generation layer.
2. Compute cumulative durations itself (durations of remote items are known only after resolving each remote feed, so this is server-side work).
3. Emit a standard `musicL` feed that any PC2.0 player renders as an ordered list. The "it's the same track at the same second for everyone" behavior is enforced by Aether's player/client math, not by any feed tag.

This gap IS the moat: the open ecosystem gives us portable value routing and portable ordered lists, but the wall-clock sync layer is ours to build and, later, to standardize (see file 4, the `<podcast:schedule>` proposal draft).

### Gap 2: no sub-item clipping of a remote item

There is a SECOND, more fundamental gap, surfaced when evaluating whether time-synced radio could be modeled more natively (e.g. as a `liveItem` aggregating `remoteItem`s). The namespace cannot express "play only the range from `t0` to `t1` of that remote track/episode." Concretely:

- `<podcast:remoteItem>` has no `startTime` / `endTime` / `offset` / `duration`. It is whole-item only (section 1.2).
- `<podcast:valueTimeSplit>` DOES carry `startTime` / `duration` / `remoteStartTime`, but it governs VALUE ROUTING (who is paid during a window), not media playback. `remoteStartTime` attributes value to an offset of the remote content; it does not instruct a player to play that slice. Nothing fetches and renders remote media from a `valueTimeSplit`.
- `<podcast:chapters>` and soundbite/clip carry time ranges, but only against the item's OWN enclosure, never a remote file.

So partial plays, segues, crossfades, and "top of the hour" fractional plays over remote pointers are not expressible today. This matters because it is the difference between a station that can only concatenate WHOLE remote items and a station that can program like real radio. Two consequences follow:

1. `liveItem` does not rescue this. It has one `start`/`end` for the whole window, no per-segment timing, presumes a live stream enclosure (broadcast infra Aether designed away), and does not even permit `remoteItem` children per the parent list in section 1.2. Using it fits WORSE, not more natively.
2. The clean native fix is a small extension: optional `startTime` + `duration` on `remoteItem` (or a companion element) so a pointer can address a slice. This is a smaller, more reviewable ask than overloading `liveItem`, and it composes with the `<podcast:schedule>` proposal. See `../podcast-schedule-proposal-draft.md`.

Escape hatch and its cost: Aether could server-side stitch segments into a single real enclosure and use local `chapters`, but that re-hosts / transcodes other creators' media, which breaks the "pointers, not copies" rule and carries licensing / host-TOS exposure. It is a fallback of last resort, not the model.

---

## 2a. CLIPPING POLICY: TOS AND RIGHTS GUARDRAILS

Gap 2 (above) establishes that sub-item clipping of a remote item is a namespace extension, not something available today. Even once the `remoteItem` `startTime`/`duration` extension exists (or if Aether implements clipping app-side ahead of any namespace change, per `./value-model.md` section 4), clipping touches rights and hosting-TOS territory that whole-item `remoteItem` playback does not. This section is the policy Aether applies regardless of implementation mechanism.

The distinction that matters: playing a WHOLE remote item end to end is the sanctioned V4V model every source in this catalog already expects (a listen is a listen). Playing only a SLICE of someone else's hosted media is a different act: it changes what portion of their content is consumed, may separate a track/segment from surrounding context the creator intended, and touches the hosting platform's terms of service around how its media may be fetched and presented.

### Clipping policy by source type

| Source type | Definition | Clipping status | Rationale |
|---|---|---|---|
| Opted-in Aether-native creators | Creators who publish through or explicitly register with Aether and opt into clip-eligible playback (e.g. via a station-owner or creator-facing setting) | **ALLOWED** | Explicit, revocable consent from the rights holder is the only condition under which slicing someone else's media by default is acceptable. |
| Permissive-licensed sources | Feeds carrying a clear open license (e.g. Creative Commons variants that permit derivative/partial use) or a platform whose own terms explicitly permit third-party partial playback (verify per platform; do not assume) | **CAUTION** | License permits it in principle, but license terms vary (attribution, non-derivative clauses, commercial-use restrictions) and must be checked per source before enabling. Treat as allowed only after a specific license-term review, not as a blanket category. |
| Unknown third-party sources | Any feed where no explicit clip consent or verified permissive license exists (the default state for most of the open podcast/music ecosystem, including the flagship anchors in `launch-catalog.md`) | **PROHIBITED** | No consent basis. Whole-item `remoteItem` playback remains fully allowed for these sources (that is the sanctioned model); only sub-range extraction is blocked. |

### No silent re-hosting without a rights policy

Independent of the clipping question: Aether does not re-host, transcode, or permanently store a copy of another creator's media without an explicit rights policy covering that action. The architecture in `./value-model.md` section 4 (app-side execution) is deliberately designed so that even clipping happens by streaming the source live and presenting only the declared range, not by producing and serving a stored, pre-cut file. If a future implementation needs a stored derivative (for latency, reliability, or format normalization), that requires: (a) confirming the source falls in the ALLOWED or reviewed-CAUTION tier above, (b) a retention/deletion policy tied to the original creator's ability to revoke consent, and (c) attribution preserved in whatever is stored. Silent re-hosting outside these conditions is out of scope for Aether and is explicitly called out here so it is never treated as an implementation detail to be decided later without rights review.

---

## 3. REMOTE VALUE ROUTING REALITY CHECK

Two distinct capabilities must not be conflated:

1. `valueTimeSplit` with LOCAL recipients (switch to a named local `valueRecipient` for a window).
2. `valueTimeSplit` with a nested `remoteItem` (remote value routing: pull the target feed's own value block and pay it `remotePercentage`). Aether's per-creator routing depends on capability 2.

### Apps that implement valueTimeSplit (capability 1) today

Named as early adopters in the Alby launch writeup and corroborated across sources:

| App | Version cited | Source |
|-----|---------------|--------|
| Castamatic | v8.7.6 | Alby blog |
| CurioCaster | (adopter) | Alby blog |
| Fountain | 0.8 Beta | Alby blog |
| Podfans | (adopter) | Alby blog |
| Podfriend | (adopter) | Alby blog |
| Podverse | (adopter) | Alby blog |

Sources: Alby "Value Time Split" writeup (`https://getalby.com/blog/value-time-split-the-latest-innovation-in-podcasting-2-0/`, originally `blog.getalby.com`), Blubrry's VTS explainer (`https://blubrry.com/support/podcasting-2-0-introduction/value-time-split/`), the namespace tag page (`https://podcasting2.org/docs/podcast-namespace/tags/value-time-split`). The canonical app matrix is `https://podcasting2.org/apps`.

### Honest risk statement

The spec for remote value routing exists and is clear, but real-world player implementation is thin. This is a known PC2.0 pattern: a tag ships in the namespace well before broad player support. Specifically:

- The apps above are documented as supporting `valueTimeSplit` generally. I could NOT verify from a live source that each of them correctly implements the REMOTE case (nested `remoteItem` + `remotePercentage`, resolving the remote feed's root value block and honoring the "ignore the remote's own valueTimeSplit children" rule). Treat capability 2 support as UNCONFIRMED per app pending live testing.
- CurioCaster (web) and Podverse are the most likely to handle resolution of remote items well because both are heavy consumers of `remoteItem`/`publisher` feeds, but this is an inference, not a verified test result.
- Fountain and Castamatic are the strongest music-V4V clients, so they are the priority targets for Aether interop testing.

Recommended posture for Aether:
- Design feeds so they are CORRECT per spec regardless of player uptake (nested remoteItem, explicit `remotePercentage`, station owner as an additional parent-feed recipient for the residual).
- Add a graceful fallback: the channel-level `<podcast:value>` should itself be sane (station owner + a default split) so that a player supporting only base V4V still routes SOMETHING sensibly rather than nothing.
- Maintain an internal interop matrix and run live send-a-sat tests against Fountain, CurioCaster, Podverse, Castamatic before claiming per-creator routing works end to end. Do not assert to users that "every player pays each artist" until tested; the accurate claim today is "spec-correct routing that the leading V4V players are progressively implementing."

Uncertainties I could not resolve live:
- Whether a published, unofficial test matrix exists that specifically exercises remote-value `valueTimeSplit` per app (search surfaced the general adopter list, not a remote-value conformance table).
- Current (2026) versions of each app and whether newer releases changed remote-value behavior. Versions cited above are from the original launch writeup and may be stale.

---

## 4. CROSS-REFERENCES

- Worked SYNCED station feed: `./feed-examples/synced-radio-station.xml` (3 items, `musicL`, ordered remote items, `valueTimeSplit` remote routing, curation cut).
- Worked ON-DEMAND playlist feed: `./feed-examples/on-demand-playlist.xml` (5 items, mixed podcast + Wavlake music, per-item splits, curation cut).
- New-tag proposal that standardizes the missing sync layer: `../podcast-schedule-proposal-draft.md` (`<podcast:schedule>`: anchor epoch, mode, cadence).

Spec sources (fetched 2026-07-01): `https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md` and per-tag files `docs/tags/{remote-item,medium,value,value-recipient,value-time-split,chapters,live-item}.md`. `https://podcastindex.org/namespace/1.0` returned HTTP 403 on live fetch and was not usable as a source.
