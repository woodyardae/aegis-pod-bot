# Aether launches today on existing PC2.0 primitives

`<podcast:schedule>` is a future standardization target, not a launch dependency. Everything Aether needs to ship, both SYNCED virtual radio and ON-DEMAND playlists, is already expressible in the current namespace. The one thing the namespace does not give us, a shared wall-clock position across a list of remote items, is confirmed missing (`./pc20-namespace-capability-map.md` section 2) and is computed app-side. Published feeds remain valid PC2.0 and degrade gracefully everywhere.

## Which existing primitives carry the launch

| Need | Primitive that satisfies it today | Status |
|------|-----------------------------------|--------|
| Ordered station body | `<podcast:remoteItem>` (order in XML == playback order) | Stable, in 1.0 spec |
| "This feed is a curated list, not local episodes" | `<podcast:medium>musicL</podcast:medium>` (List convention) | Stable, in 1.0 spec |
| Pay each original creator per segment | `<podcast:valueTimeSplit>` + nested `<podcast:remoteItem>` (remote value routing) | In spec; leading V4V players progressively implementing |
| Station-owner curation cut | Residual `<podcast:valueRecipient>` on the parent value block (an ADDITIONAL recipient) | Stable |
| Base fallback routing | Channel-level `<podcast:value>` | Widely supported |

Detail and citations for each are in `./pc20-namespace-capability-map.md` section 1. The remote-value `valueTimeSplit` case is spec-correct but its per-app support is UNCONFIRMED pending live testing (section 3); Aether's posture is to emit spec-correct feeds regardless of player uptake and keep a sane channel-level fallback so base-V4V players still route something.

The `remoteItem` ordering plus the `musicL` List convention is exactly the shape the spec intends for curated lists ("a 'List' feed is intended to exclusively contain one or more `<podcast:remoteItem>`'s"). Aether is not bending the namespace to fit; it is using it as designed. The two worked feeds prove the shape: `./feed-examples/synced-radio-station.xml` and `./feed-examples/on-demand-playlist.xml`.

## What Aether builds externally (substituting for the missing schedule tag)

The namespace has no field for anchor epoch, sync mode, or repeat cadence. Aether supplies those in its own layer:

1. Anchor epoch, mode, and cadence live in Aether's backend / feed-generation service, not in the feed.
2. Durations are resolved server-side. A remote item's real length is known only after resolving the remote feed, so Aether resolves each pointer to get the audio URL and duration, then sums them into a total cycle length.
3. Wall-clock position is computed app-side by the Aether client:

   ```
   position(now) = (now - anchorEpoch) mod totalCycleDuration
   ```

   mapped to the item whose cumulative duration range contains that offset, then seeked to the remainder. This makes "the same track at the same second for everyone" a property enforced by client math, not by any feed tag. No broadcast infrastructure is involved.

4. The feed Aether publishes stays a plain, valid PC2.0 `musicL` List. The sync inputs never appear in it (there is nowhere to put them yet), so a third-party player sees only an ordered list of remote items with value routing.

ON-DEMAND mode needs even less: it is the same feed shape with no shared clock, so Aether does not compute a position at all; the client plays the list top to bottom at the listener's pace.

## How published feeds degrade gracefully

A player that knows nothing about Aether's sync layer still gets a correct, useful feed:

- A PC2.0-aware app that understands `musicL` renders the ordered curated list and plays every track in order.
- A player that ignores `<podcast:medium>` falls back to treating the feed as ordinary items; it still has titles (each `remoteItem` carries a `title`) and enclosures on the per-segment items.
- Value routing degrades in tiers: a full V4V + remote-value player pays each creator per segment and the owner the residual; a base-V4V player pays the channel-level fallback block; a non-V4V player simply plays audio. Nothing breaks.

The only thing a non-Aether player loses is clock alignment: it plays the tracks in order but not necessarily the same second as everyone else. That is a graceful loss of a premium behavior, not a broken feed. This matches Aether's stated guarantee of graceful degradation in any PC2.0 player.

## Why standardizing later is an upgrade, not a prerequisite

Shipping first and standardizing second is the right sequence:

- Aether needs zero third-party adoption to deliver synced playback. The sync math runs in the Aether client, so the experience is complete for Aether listeners on day one.
- `<podcast:schedule>` (`./podcast-schedule-proposal-draft.md`) standardizes the inputs Aether already computes: anchor, mode, cadence. Its payoff is INTEROPERABILITY, letting other players reproduce the synced position from the feed alone. That is additive value on top of a working product, not a gate in front of it.
- Arriving at the PC2.0 community with a working reference app is stronger than arriving with a spec alone. Launching on existing primitives produces exactly that proof-of-use, which is the framing in `./schedule-namespace-pr-description.md`.
- The proposal is designed to be backward-compatible and namespaced (see the proposal draft's graceful-degradation section), so adopting it later requires no change to feeds already in the wild beyond adding one channel-level element.

Launch depends on `remoteItem`, `musicL`, and `value`/`valueTimeSplit`, all of which exist now. `<podcast:schedule>` is the interoperability upgrade we pursue after Aether is live and interop-tested.

## Cross-references

- Capability + gap analysis: `./pc20-namespace-capability-map.md`
- Proposed tag spec: `./podcast-schedule-proposal-draft.md`
- PR cover text (draft, not to be opened yet): `./schedule-namespace-pr-description.md`
- Worked feeds: `./feed-examples/synced-radio-station.xml`, `./feed-examples/on-demand-playlist.xml`
