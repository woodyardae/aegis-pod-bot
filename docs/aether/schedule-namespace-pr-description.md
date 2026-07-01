# PR description draft: add `<podcast:schedule>` for wall-clock positioning of List feeds

Status: DRAFT. Do NOT open this PR yet. This is the cover text for a future PR / RFC against `Podcastindex-org/podcast-namespace`. The spec write-up it references (`./podcast-schedule-proposal-draft.md`) and the reference feeds are still internal to AEGIS AETHER and want live interop testing before we engage the community.

---

## Title

`feat(namespace): add <podcast:schedule> for deterministic wall-clock positioning of List feeds`

## Summary (the problem)

The namespace lets a feed publish an ORDERED list of remote items (`medium=musicL`/`mixed` + `<podcast:remoteItem>`) and route value per segment (`<podcast:valueTimeSplit>` + remote value). It has no primitive for WHEN, on a shared wall clock, a listener should be positioned within that list.

This gap is verified, not assumed. A full-text search of the live `docs/1.0.md` (fetched 2026-07-01) for `schedule`, `epoch`, `wall-clock`, `cadence`, and `recurring` returns nothing. The only time-bearing tags are episode-internal (`valueTimeSplit`, `chapters`) or single-stream (`liveItem`, which carries one `start`/`end`, no repeat, and presumes real broadcast infrastructure). See `./pc20-namespace-capability-map.md` section 2 for the gap analysis.

Consequently every "virtual radio" style product invents its own out-of-band mechanism to answer "what plays right now, and is it the same second for everyone." That is portable math, but its inputs (anchor time, mode, repeat cadence) have no home in the feed, so no third-party player can reproduce a synced experience from the feed alone.

## What this PR adds

A single channel-level element, `<podcast:schedule>`, that standardizes the inputs needed to position a listener within an already-published ordered List:

- `mode` (`synced` | `ondemand`)
- `anchor` (ISO8601 origin; required when `mode="synced"`)
- `cadence` (`loop` | `once` | RRULE-subset; default `loop`)
- `duration` (optional total cycle seconds; else summed from item durations)
- `timezone` (optional; calendar cadences only)

For `mode="synced"`, playback position is `(now - anchor) mod cycle`, walked against cumulative item durations. Full normative sketch, attribute table, and examples are in `./podcast-schedule-proposal-draft.md`.

## Minimal spec-change summary

- Add `docs/tags/schedule.md` (new tag spec; body is the proposal draft).
- Add `<podcast:schedule>` to the tag index in `docs/1.0.md`.
- No changes to `remoteItem`, `medium`, `value`, or `valueTimeSplit`. This is purely additive; it introduces a new positioning hint over data feeds already express.

## Backward compatibility and graceful degradation

Additive and namespaced. Any existing feed is unaffected. A player that does not recognize `<podcast:schedule>` ignores it and renders the underlying `musicL` List as an ordinary ordered playlist, which is the current behavior. A `synced` feed in a non-schedule-aware player still plays every track in order, just not clock-aligned. No regression, no required changes to existing implementations.

It composes with value routing: scheduling positions playback, `<podcast:valueTimeSplit>` pays creators per segment. The two are orthogonal and adoptable independently.

## Reference application (proof of use)

AEGIS AETHER is a synced-radio / playlist product built on PC2.0 primitives. It already publishes valid `medium=musicL` feeds with ordered `<podcast:remoteItem>` pointers and per-segment remote value routing, and it computes wall-clock position app-side today (`position(now) = (now - anchorEpoch) mod totalCycleDuration`). `<podcast:schedule>` standardizes exactly the inputs Aether currently keeps in its own backend, so the tag ships with a working reference implementation rather than as a speculative primitive. Worked feeds: `./feed-examples/synced-radio-station.xml` (synced) and `./feed-examples/on-demand-playlist.xml` (on-demand). Aether does not depend on this tag to launch (see `./launch-without-namespace-tag.md`); the tag is an interoperability upgrade.

## Out of scope

- No changes to value / `valueTimeSplit` semantics.
- No new streaming/broadcast mechanism; `<podcast:schedule>` is infra-free positioning over an item list, distinct from `<podcast:liveItem>`.
- Interaction between `<podcast:schedule>` and `<podcast:liveItem>` in the same feed is deferred (flagged as a future question).
- Calendar-cadence RRULE support may be deferred to a later revision; `loop`/`once` are the v1 priority.

## Open questions / request for comment

1. Duration authority: trust publisher-supplied `duration`/`<itunes:duration>`, or require players to resolve remote items? Mismatches cause drift; a tolerance/resync rule may be needed.
2. Drift and clock skew: should the spec mandate periodic re-sync to server time, or leave it to the client?
3. Cadence scope: ship `loop`/`once` first and defer calendar cadence, or standardize an RRULE subset now?
4. Live boundary: how should `<podcast:schedule>` interact with `<podcast:liveItem>` (e.g. a scheduled loop yielding to a live window)?
5. Placement: channel-level only, or also a per-item override for mid-list scheduled inserts?

## Note to reviewers (internal, remove before opening)

This PR is a DRAFT and should NOT be opened yet. Before engaging the community: run live interop tests of the existing remote-value `valueTimeSplit` path against Fountain, CurioCaster, Podverse, and Castamatic (per-app support for the REMOTE-value variant is currently UNCONFIRMED, see `./pc20-namespace-capability-map.md` section 3), and confirm the reference feeds render and route as intended in at least two of those apps. The proposal stands on its own spec merits, but arriving with verified proof-of-use is stronger than arriving with a draft alone.
