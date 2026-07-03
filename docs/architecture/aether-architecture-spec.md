# Aegis Aether — Architecture Specification v1

> Operator-grade reference. Do not edit locked decisions without HUB sign-off.

---

## 1. System Overview

Aegis Aether is a Podcasting 2.0 synchronized listening and value-routing platform. It runs as a Discord bot with an embedded web dashboard, a playout scheduler, and real-time Lightning payment streams. Aether shares a common open-feed infrastructure layer with STAX-CHEF (recipe platform) through 6 thin shared packages. The bot process hosts all modules in a single Node.js runtime; modules communicate via in-process method calls and a SQLite state store (Mneme).

Primary capabilities: live synchronized listening rooms, RSS episode announcements, boostagram ingestion, value split routing, voice floor control, and a public web dashboard.

---

## 2. Module Map

Full canonical table: `docs/architecture/module-naming-map.md`

| Greek Name | Code File(s) | Role |
|---|---|---|
| Keryx | `episode-poller`, `feed-scanner` | RSS polling, episode herald |
| Pneuma | `boost-poller`, `boostagram-poller` | Satoshi streams, boostagrams |
| Horai | `horai-scheduler` | Playout schedule, track transitions |
| Agora | `agora-room` | Listening room, sync state |
| Asphaleia | `telemetry` | Health, diagnostics, `/health` |
| Polis | *(agora-room identity layer)* | Listener presence, wallet identity |
| Akroasis | `dashboard/server` + `public/` | Dashboard, public API, web player |
| Rhema | `rhema-floor` | Voice floor, mic queue |
| Choros | `choros-chat` | Synchronized text chat |
| Noos | `nostr-client` | Nostr protocol transport |
| Mouseion | `podcast-index-client` | PodcastIndex discovery |
| Skopos | `podping-consumer` | Real-time feed-ping watcher |
| Chrysos | `payment-provider` + `providers/` | Payment abstraction (Alby, mock) |
| Mneme | `db/database` | Persistent state (SQLite) |

---

## 3. Shared Infrastructure Layer

**Locked decision:** 6 thin shared packages are the exclusive cross-product boundary between Aether and STAX-CHEF.

```
aegis-pod-bot (Aether)          stax-chef
      │                               │
      └──────── shared packages ──────┘
         feed-transport-core
         timeline-media-core
         value-routing-core
         creator-identity-core
         discovery-core
         local-sync-core
```

Each package is thin: interfaces and serialization only — no business logic. Aether implements, STAX-CHEF consumes. No direct imports between product repos.

**Boundary rule:** Code that serves only Aether stays in `aegis-pod-bot`. Code that must work identically in both products goes in the relevant shared package.

---

## 4. IR Contracts

Intermediate Representations are defined spec-level here. Implementation lives in `feed-transport-core` and `timeline-media-core`.

**FeedEnvelope** — normalized feed container after parsing:
```
FeedEnvelope {
  feedUrl: string
  title: string
  medium: "podcast" | "music" | "musicL" | "recipe"
  episodes: EpisodeItem[]
  valueBlock?: ValueBlock
  rawNamespaceAttrs: Record<string, unknown>
}
```

**MediaAsset** — single playable media item:
```
MediaAsset {
  guid: string
  enclosureUrl: string
  durationMs: number
  chaptersUrl?: string
  transcriptUrl?: string
  valueBlock?: ValueBlock
}
```

**Timeline** — ordered sequence of MediaAssets with absolute epoch anchor:
```
Timeline {
  stationId: string
  syncEpoch: number          // wall-clock ms epoch; 0 = on-demand
  loopDurationMs: number
  segments: MediaAsset[]
}
```

**TimelineCue** — playhead event emitted by Horai at segment boundaries:
```
TimelineCue {
  stationId: string
  segmentIndex: number
  offsetMs: number           // ms into current segment
  wallClockMs: number
  driftMs: number            // client-reported drift; 0 = server-emitted
}
```

---

## 5. Aether-First Directive

**Locked decision:** Shared IRs (FeedEnvelope, MediaAsset, Timeline, TimelineCue) must be implemented in Aether first before STAX-CHEF consumes them.

Rationale: Aether is the primary product. Shared abstractions must be proven in production before STAX-CHEF depends on them. No exceptions without HUB approval.

Enforcement: PRs that add IR fields consumed only by STAX-CHEF are blocked until the field ships in Aether.

---

## 6. Cook-Along Bridge

**Locked decision:** The same RSS feed item is interpreted differently by each product — Aether hears an audio episode; STAX-CHEF sees recipe steps.

Implementation: `feed-transport-core` parses a single `FeedEnvelope`. The `medium` field routes the envelope:
- `medium: "podcast" | "music" | "musicL"` → Aether pipeline (Keryx → Horai → Agora)
- `medium: "recipe"` → STAX-CHEF pipeline

**Locked constraint:** `recipe:` namespace is separate from `podcast:` — recipes must never masquerade as a PC2.0 `medium` type.

**Locked constraint:** `valueTimeSplit` is first-party only. External app support is "No support, yet."

---

## 7. Phase Sequence

| Phase | Module(s) | Deliverable | Status |
|---|---|---|---|
| Alpha | Keryx, Pneuma, Asphaleia | Episode poller, boost ingestion, telemetry | built |
| Beta | Horai, Agora, Rhema | Scheduler, listening rooms, floor control | built |
| MVP | Choros, Akroasis, Polis | Chat, dashboard, identity layer | in-progress |
| V1 | Noos, Skopos, Mouseion | Nostr transport, podping, discovery | built |
| V1.1 | Chrysos, Mneme hardening | Payment abstraction, DB migration layer | planned |
| Shared | feed-transport-core, timeline-media-core | IR contracts (Aether-First) | planned |
| Bridge | Cook-Along Bridge | STAX-CHEF feed-transport-core consumer | planned |

---

## 8. Open Questions (HUB Decisions)

1. **Polis extraction:** When does `AgoraListener` identity leave `agora-room.ts` and become its own module? Threshold for extraction?
2. **musicL standardization:** Submit `podcast:medium=musicL` + `syncEpoch`/`loopDuration` to Podcast Standards Project now or after MVP ships?
3. **valueTimeSplit external:** What is the trigger condition to lift "No support, yet" for third-party apps?
4. **Mneme schema versioning:** Adopt a migration tool (Drizzle, Prisma, or raw SQL migrations) before V1.1 or stay with manual SQL?
5. **Noos relay list:** Who owns the canonical Nostr relay list? Config file, environment variable, or Akroasis admin panel?
6. **Skopos fallback:** If `aegis-os` WebSocket is unreachable, does Skopos fall back to Keryx scheduled polling or hard-fails?
7. **Chrysos provider registry:** Is the provider list static (env var switch) or should Akroasis expose a runtime toggle?
8. **Shared package publishing:** Are the 6 thin packages published to npm (private registry) or consumed as local workspace packages?
