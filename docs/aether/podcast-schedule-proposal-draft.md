# Proposal draft: `<podcast:schedule>`  -  wall-clock scheduling for List feeds

Status: DRAFT for discussion (not yet submitted). Intended as a PC2.0 namespace PR / issue against `Podcastindex-org/podcast-namespace`. Reference implementation: AEGIS AETHER (synced virtual-radio and on-demand playlist feeds built on `medium=musicL` + ordered `<podcast:remoteItem>`).

## Motivation

The namespace lets a feed publish an ORDERED list of remote items (`medium=musicL`/`mixed`, `<podcast:remoteItem>`), and lets value route per segment (`<podcast:valueTimeSplit>` + remote value). What it does NOT provide is any way to say WHEN, on a shared wall clock, a listener should be positioned within that ordered list. A full-text search of the live namespace doc (`docs/1.0.md`, 2026-07-01) for `schedule`, `epoch`, `wall-clock`, `cadence`, `recurring` returns nothing. The only time-bearing tags are episode-internal (`valueTimeSplit`, `chapters`) or single-stream (`liveItem` with one `start`/`end`).

That gap forces every "virtual radio" style product to invent its own out-of-band mechanism to answer "what plays right now, and is it the same second for everyone." AEGIS AETHER computes

```
position(now) = (now - anchorEpoch) mod totalCycleDuration
```

against the cumulative durations of the ordered items. This is portable math, but the inputs (anchor time, mode, repeat cadence) have no home in the feed, so no third-party player can reproduce the synced experience from the feed alone. `<podcast:schedule>` standardizes those inputs so the ordered List a feed already publishes becomes reproducibly time-positionable by any conforming player.

`liveItem` is deliberately NOT a substitute: it announces a single live STREAM with real broadcast infrastructure, one `start`/`end`, no repeat, and no "position derived from item durations." `<podcast:schedule>` targets infra-free, deterministic, repeatable positioning over an existing item list.

## Proposed element

Channel-level element, at most one per feed. Applies to the ordered `<podcast:remoteItem>`/`<item>` list already present in a List feed.

```
<podcast:schedule
    mode="synced"
    anchor="2026-07-01T00:00:00Z"
    cadence="loop" />
```

### Attributes

| Attribute | Required | Type / values | Default | Description |
|-----------|----------|---------------|---------|-------------|
| `mode` | Yes | `synced` \| `ondemand` | none | `synced`: playback position is derived from `anchor` and item durations, identical for all listeners. `ondemand`: the list is an ordered playlist with no shared clock; players ignore `anchor`/`cadence` for positioning. |
| `anchor` | Yes when `mode="synced"` | ISO8601 timestamp (UTC recommended) | none | The wall-clock origin. At `anchor`, playback is at offset 0 of item 1. Positions for all later times are computed relative to this. |
| `cadence` | No | `loop` \| `once` \| RRULE-subset string | `loop` | How the timeline repeats. `loop`: the item list repeats end-to-end forever from `anchor`. `once`: after the list finishes, the schedule is inert (nothing "now-playing"). An RRULE-subset (e.g. `FREQ=DAILY`) MAY be used for feeds that restart the list on a calendar cadence. |
| `duration` | No | integer seconds | computed | Total cycle length. If omitted, players compute it by summing resolved item durations. Provided as an optimization / authority when the publisher has already resolved durations (Aether does this server-side). |
| `timezone` | No | IANA tz name | `UTC` | Only meaningful with calendar-style `cadence` (e.g. daily restart at local midnight). Ignored for `loop`/`once`. |

### Positioning algorithm (normative sketch)

For `mode="synced"`, `cadence="loop"`:

```
cycle      = duration (or sum of item durations)
offset     = (now - anchor) mod cycle          # seconds into the cycle
item, into = walk items accumulating durations until cumulative > offset
# => play `item`, seeked to `into` seconds
```

Durations come from each item's `<itunes:duration>` (or resolved remote item). Players that cannot resolve a remote item's duration SHOULD fall back to `ondemand` behavior for that feed rather than mis-position.

## Example usage

Synced station (loops forever from a fixed anchor):

```xml
<channel>
  <podcast:medium>musicL</podcast:medium>
  <podcast:schedule mode="synced" anchor="2026-07-01T00:00:00Z" cadence="loop" duration="671"/>
  <podcast:remoteItem feedGuid="c2f9...aaa1" itemGuid="track-aaa1-0001" medium="music" title="Neon Rain"/>
  <podcast:remoteItem feedGuid="d3a0...bbb2" itemGuid="track-bbb2-0002" medium="music" title="Chrome Horizon"/>
  <podcast:remoteItem feedGuid="e4b1...ccc3" itemGuid="track-ccc3-0003" medium="music" title="After Hours Transit"/>
</channel>
```

On-demand playlist (same List shape, no shared clock):

```xml
<channel>
  <podcast:medium>musicL</podcast:medium>
  <podcast:schedule mode="ondemand"/>
  <!-- ordered remoteItems ... -->
</channel>
```

## Backward compatibility and graceful degradation

- `<podcast:schedule>` is additive and namespaced. Any existing feed is unaffected; any player that does not recognize it simply ignores it and renders the underlying `musicL` List as an ordered playlist (the current behavior). No regression.
- A `synced` feed with no schedule-aware player degrades to an ordinary ordered list: the listener still hears every track in order, just not clock-aligned. This matches Aether's existing "graceful degradation in any PC2.0 player" guarantee.
- It composes with `<podcast:value>`/`<podcast:valueTimeSplit>`: scheduling positions playback; value routing pays creators per segment. The two are orthogonal and can be adopted independently.
- No change to `remoteItem`, `medium`, or value tags is required. This is purely a new positioning hint over data feeds already express.

## Open questions

1. Duration authority: trust publisher-supplied `duration`/`<itunes:duration>`, or require players to resolve remote items? Mismatches cause drift. A tolerance/resync rule may be needed.
2. Drift and clock skew: should the spec mandate periodic re-sync to server time, or leave it to the client? Aether re-derives position on each play/seek, which self-corrects, but a normative note would help interop.
3. Cadence scope: is an RRULE subset worth standardizing now, or ship `loop`/`once` first and defer calendar cadence to a later revision?
4. Live boundary: how should `<podcast:schedule>` interact with `<podcast:liveItem>` inside the same feed (e.g. a scheduled loop that yields to a live broadcast window)? Likely out of scope for v1; flag for future.
5. Placement: channel-level only (proposed), or also allow a per-item override for mid-list scheduled inserts? Channel-only keeps v1 simple.
6. Timezone semantics: confirm that `timezone` is only consulted for calendar cadences and never for `loop` positioning, to avoid ambiguity.

## Cross-references

- Capability gap this fills: `./pc20-namespace-capability-map.md` section 2 (WHAT IS MISSING).
- Reference feeds: `./feed-examples/synced-radio-station.xml`, `./feed-examples/on-demand-playlist.xml`.
