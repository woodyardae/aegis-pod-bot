# Aegis Aether — Greek Naming & Module Code Map

This document establishes the canonical mapping between the Aegis Greek naming schema modules and the actual directories/files in both the open core (`aegis-os`) and bot integration (`aegis-pod-bot`) repositories.

---

## 1. System Parent & Product Umbrella

### Aegis
*   **Role:** Parent brand for the podcasting / V4V product line.
*   **Repository Scope:** Umbrella scope covering both repos.
*   **Code Map:**
    *   `C:\dev\repos\aegis-os\`
    *   `C:\dev\repos\aegis-pod-bot\`

### Aegis Aether
*   **Role:** The main product broadcast medium; live scheduled V4V radio + listening platform.
*   **Code Map:**
    *   `aegis-os`: [server.js](file:///C:/dev/repos/aegis-os/server.js) (core backend WebSocket broadcasts & API routing)
    *   `aegis-pod-bot`: [server.ts](file:///C:/dev/repos/aegis-pod-bot/src/dashboard/server.ts) (embedded dashboard control server)

---

## 2. AIR / MECHANICS Family (Invisible Infrastructure)

### Horai
*   **Role:** Scheduling, caching, and automation engine.
*   **Code Map:**
    *   `aegis-os`: `reaper.js` (feed entity harvesting and caching)
    *   `aegis-pod-bot`: [database.ts](file:///C:/dev/repos/aegis-pod-bot/src/db/database.ts) (local caching tables), `src/modules/horai-scheduler.ts` [UNBUILT / STUB PLANNED]

### Pneuma
*   **Role:** V4V payment processing, invoice generation, boosts, and value flow splits.
*   **Code Map:**
    *   `aegis-os`: `api.js` (invoice generation & keysend handling), `server.js` (`/api/boost` ledger splits)
    *   `aegis-pod-bot`: [boost-poller.ts](file:///C:/dev/repos/aegis-pod-bot/src/pollers/boost-poller.ts) (polling Alby/payment APIs), [payment-provider.ts](file:///C:/dev/repos/aegis-pod-bot/src/modules/payment-provider.ts)

### Asphaleia
*   **Role:** System health, observability, error telemetry, and reliability monitoring.
*   **Code Map:**
    *   `aegis-pod-bot`: [telemetry.ts](file:///C:/dev/repos/aegis-pod-bot/src/modules/telemetry.ts)

---

## 3. POLIS / PEOPLE Family (Civic Gathering)

### Agora
*   **Role:** The live listening room where people gather to attend broadcasts in real time.
*   **Code Map:**
    *   `aegis-pod-bot`: `src/modules/agora-room.ts` [UNBUILT / SKELETON PLANNED]

### Akroasis
*   **Role:** Listener-side presentation layer (visual dashboard player, chat view).
*   **Code Map:**
    *   `aegis-os`: `frontend/` folder (HTML/JS WebLN player assets)
    *   `aegis-pod-bot`: [index.html](file:///C:/dev/repos/aegis-pod-bot/src/dashboard/public/index.html) and [app.js](file:///C:/dev/repos/aegis-pod-bot/src/dashboard/public/app.js) (embedded dashboard visual player interface)

### Choros
*   **Role:** The public chat channel(s) and bridged social feeds.
*   **Code Map:**
    *   `aegis-pod-bot`: [nostr-client.ts](file:///C:/dev/repos/aegis-pod-bot/src/modules/nostr-client.ts) (fetching public Nostr comments & replies)

### Rhema
*   **Role:** The speaking floor and host microphone/voice packet controls.
*   **Code Map:**
    *   **Status:** [UNBUILT] (Will map to `src/modules/rhema-floor.ts` for voice stage channel interactions)

### Ekklesia
*   **Role:** Polling, interactive voting splits, and audience feedback aggregation.
*   **Code Map:**
    *   **Status:** [UNBUILT] (Will map to `src/modules/ekklesia-votes.ts` for micropayment routing/polls)

### Boule
*   **Role:** Delegated moderation (reviewing feedback, filtering comments, and routing pushed alerts).
*   **Code Map:**
    *   `aegis-pod-bot`: [server.ts](file:///C:/dev/repos/aegis-pod-bot/src/dashboard/server.ts) (moderator `/push` endpoint), [embeds.ts](file:///C:/dev/repos/aegis-pod-bot/src/embeds/embeds.ts) (`buildNostrCommentEmbed`)

### Koinon
*   **Role:** Membership, subscription, and server/guild onboarding records.
*   **Code Map:**
    *   `aegis-pod-bot`: [database.ts](file:///C:/dev/repos/aegis-pod-bot/src/db/database.ts) (`guild_subscriptions` table checks and helpers)

### Keryx
*   **Role:** Announcements and automated episode notification dispatcher.
*   **Code Map:**
    *   `aegis-pod-bot`: [episode-poller.ts](file:///C:/dev/repos/aegis-pod-bot/src/pollers/episode-poller.ts) (polling episode feed releases), [watch.ts](file:///C:/dev/repos/aegis-pod-bot/src/commands/watch.ts) (subscribing announcers)
