# FAQ: Why Aether Launches Now, Without Namespace Changes

Quick-answer companion to the full explainer in `./launch-without-namespace-tag.md`. Read that file for detail and citations; this is the condensed Q&A for anyone (internal or external) who wants the answer fast.

**Q: Does Aether need a new PC2.0 namespace tag to launch?**
No. Ordered `remoteItem` playback, `medium=musicL` List feeds, and `value`/`valueTimeSplit` routing (including the remote-value case) already exist in the 1.0 spec and are sufficient to ship both SYNCED and ON-DEMAND stations today.

**Q: What's actually missing from the namespace, then?**
Two things, confirmed by live spec search (`./pc20-namespace-capability-map.md` section 2): (1) no shared wall-clock scheduling primitive, no anchor/epoch, mode, or cadence field; (2) no sub-item clipping, `remoteItem` cannot address a time range within a target item. Aether computes (1) app-side today and treats (2) as a future, separately-proposed extension.

**Q: If the namespace is missing pieces, why not wait for it to be fixed first?**
Because the missing pieces are inputs to a computation Aether already runs client-side. `position(now) = (now - anchorEpoch) mod totalCycleDuration` doesn't need a feed tag to execute; it needs the anchor, mode, and durations, which Aether stores and resolves itself. Waiting for the namespace to catch up would delay a product that already works.

**Q: Then what's the point of the `<podcast:schedule>` proposal (`./podcast-schedule-proposal-draft.md`) if we don't need it?**
Interoperability, not functionality. Today, only Aether's own client can reproduce the synced experience from a feed, because the sync inputs live in Aether's backend, not the feed. Standardizing them lets OTHER players reproduce that experience too. That's an upgrade layered on a working product, not a prerequisite for one.

**Q: Doesn't launching without the tag mean the feeds are non-standard or hacky?**
No. The published feeds are plain, valid `musicL` List feeds using `remoteItem` and `value`/`valueTimeSplit` exactly as specified. Nothing about them is a workaround; the ordering and value routing ARE the spec's intended shape for curated lists. The only thing NOT in the feed is the sync math, and that's true of every synced-radio-style product today, this isn't an Aether-specific gap.

**Q: What happens in a player that has never heard of Aether?**
Graceful degradation, by design (`./launch-without-namespace-tag.md` section "How published feeds degrade gracefully"): the list still plays in order, titles still render, and value routing falls back tier by tier (full remote-value routing, or a channel-level fallback block, or no V4V at all) depending on what that player supports. The only loss is clock alignment; nothing breaks.

**Q: Does app-side execution (see `./value-model.md` section 4) change this answer?**
It reinforces it. Wall-clock sync, the curation cut, and clipping all execute inside Aether's own client against the listener's own non-custodial wallet. That's a second, independent reason launch doesn't wait on the namespace or on third-party player adoption: the full experience is self-contained in software Aether controls.

**Q: When does the namespace proposal actually get submitted?**
After live interop testing (`./value-routing-test-plan.md`) confirms the existing remote-value `valueTimeSplit` path against real players. Arriving with a working reference implementation is a stronger position than arriving with a spec draft alone; see the internal reviewer note in `./schedule-namespace-pr-description.md`.

## Cross-references

- Full explainer: `./launch-without-namespace-tag.md`
- Gap analysis: `./pc20-namespace-capability-map.md`
- Proposed tag + clipping companion proposal: `./podcast-schedule-proposal-draft.md`
- Canonical execution architecture: `./value-model.md` section 4
- PR cover text (draft, not to be opened yet): `./schedule-namespace-pr-description.md`
