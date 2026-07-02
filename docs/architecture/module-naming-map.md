# Aegis Aether — Module Naming Map

Canonical mapping of Greek module names to code identifiers, roles, and build status.
Source of truth for naming in all specs, docs, and PRs.

---

## Module Table

| Greek Name | English Code Name | Role | Status |
|---|---|---|---|
| **Keryx** | `episode-poller` / `feed-scanner` | RSS feed poller; discovers and announces new episodes to Discord | built |
| **Pneuma** | `boost-poller` / `boostagram-poller` | Satoshi stream poller; ingests boostagrams and live payment events | built |
| **Horai** | `horai-scheduler` | Playout scheduler; coordinates track transitions and cache sync across nodes | built |
| **Agora** | `agora-room` | Listening room engine; shared playback state, presence vectors, floor control | built |
| **Asphaleia** | `telemetry` | Health telemetry and diagnostics; `/health` endpoints, error taxonomy | built |
| **Polis** | *(identity layer — `agora-room`)* | Listener presence, wallet mapping, and user identity within rooms | in-progress |
| **Akroasis** | `dashboard/server` + `dashboard/public/` | Public-facing dashboard, API endpoints, and web player view | built |
| **Rhema** | `rhema-floor` | Voice floor controller; mic queue management, active speaker gating | built |
| **Choros** | `choros-chat` | Synchronized text chat layer; Discord/Nostr pubsub gateway, timestamped messages | built |
| **Noos** | `nostr-client` | Nostr protocol transport; bech32 decode, relay connection, zap reception | built |
| **Mouseion** | `podcast-index-client` | PodcastIndex API client; feed discovery and external directory lookup | built |
| **Skopos** | `podping-consumer` | Real-time feed-ping watcher; WebSocket consumer for live episode update signals | built |
| **Chrysos** | `payment-provider` + `providers/` | Payment abstraction layer; unified interface over Alby and mock providers | built |
| **Mneme** | `db/database` | Persistent state store; episode dedup, boostagram cache, session data | built |

---

## Notes

- **Keryx** spans two files: `episode-poller.ts` (scheduled Discord announcements) and `feed-scanner.ts` (raw RSS parsing). Both are sub-components of the same herald role.
- **Polis** has no dedicated file yet; its responsibilities currently live inside `agora-room.ts` (the `AgoraListener` identity type and wallet map). Planned extraction in a future module.
- **Noos** (nostr-client) serves both Pneuma (zap/boost signals) and Choros (Nostr-pubsub chat relay). It is infrastructure shared across two modules.
- **Skopos** connects to the `aegis-os` WebSocket bridge; distinct from Keryx's scheduled RSS poll — Skopos reacts, Keryx probes.
- **Chrysos** providers (Alby, mock) live under `src/modules/providers/` and are injected into Pneuma at runtime.

---

## Locked Confirmed Mappings

These five were locked prior to this document and must not be renamed:

| Greek Name | Code Name |
|---|---|
| Keryx | episode-poller |
| Pneuma | boost-poller |
| Asphaleia | telemetry |
| Horai | horai-scheduler |
| Agora | agora-room (listening-room) |
