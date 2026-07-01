# AETHER Pre-Seed Grant Design

Mechanism to grant new Aether accounts a small starting balance of sats so they can stream value immediately, before they have funded a wallet. Modeled on how Fountain and similar value4value apps onboard listeners with seed sats.

## 0. What real apps do (grounding)

- Fountain seeds new accounts so users can start without funding a wallet first. Per Fountain's own onboarding material, "there's no need to fund your wallet directly to get started"; new users stack sats by listening and reuse them on other features, and Fountain "would seed your account with sats just for listening." Earning is tiered (start at a basic rate, earn more by contributing). Sources: https://support.fountain.fm/article/59-how-earning-works-on-fountain and https://blog.fountain.fm/p/fountain-0-4-0
- Fountain's original wallet was CUSTODIAL (app holds the Lightning balance), which is what makes a seed grant trivial: crediting an internal ledger, not an on chain / channel operation.
- Alby built Nostr Wallet Connect (NWC), the standard for connecting an external Lightning wallet (custodial Alby, or self custodial node) to an app over a permissioned connection. Podcast apps (e.g. Castamatic 12.5) let users "Connect NWC Wallet" by pasting a connection URI or scanning a QR, then stream value from THEIR OWN wallet. Sources: https://nostr-wallet-connect.getalby.com/about and https://castamatic.com/jekyll/2026/02/21/nwc/

Takeaway: seed grants live naturally in a CUSTODIAL model (credit a house held internal balance). Non-custodial users bring their own funded wallet via NWC and generally do not need a grant; if we grant them anything it is a real outbound payment, which is more expensive and abusable.

## 1. Grant mechanism

### Grant size

Small, enough for a meaningful first session of streaming plus a boost, not enough to be worth farming.

- Default grant: **2,000 sats** per verified new account.
- Rationale: streaming is tiny per interval. At a common ~10 sats/min stream rate, 2,000 sats funds ~200 minutes of listening, several sessions, and leaves room for a first boost (a few hundred sats). Large enough to experience value4value end to end (see creators actually get paid), small enough that a farmed account nets trivial value after anti abuse gating.
- Make it a config value, not a constant. House can tune per cohort / campaign.

### Funding source

A single **house wallet** (custodial Lightning balance controlled by Aether). Grants are an internal LEDGER credit against a house funded pool, not an on chain transaction per user. Actual Lightning payments only occur when the user streams/boosts, at which point Aether's custodial node pays out from the house liquidity. This is the Fountain shaped model and keeps per grant cost at zero until the sats actually move.

- Maintain a monthly grant budget cap on the house pool. When exhausted, new signups get a "grants temporarily paused" state (still usable if they fund their own wallet).

### Anti-abuse

Seed sats are free money, so gate hard:

- One grant per verified identity. Identity = one of: verified email + phone, or a linked external account (e.g. a Nostr pubkey with some history, or an OAuth identity). Bare email alone is too cheap.
- Device / IP heuristics: cap grants per device fingerprint and per IP block per rolling window to blunt scripted signups.
- The grant is **spend restricted**, not withdrawable: it can only be STREAMED to creators or BOOSTED, never withdrawn to an external wallet. This is the single most important anti abuse control. A farmer cannot convert grants to cash; the sats can only flow to creators (which is the point). Withdrawal is unlocked only after the user funds their own balance, and only the user funded portion is withdrawable (segregate granted vs funded balances in the ledger).
- Velocity limits on boosts from granted balance (e.g. no single boost may drain the whole grant to one recipient the user controls; cap boost size from granted funds).
- Optional: require a minimal engagement action (listen for N minutes) before the grant unlocks, mirroring Fountain's "earn by listening" so the grant rewards real use.

### Expiry / clawback

- Unused grant expires **30 days** after issuance. Unspent granted sats are clawed back to the house pool (ledger reversal, no on chain cost).
- Partial spend: only the unspent remainder is clawed back.
- Expiry resets nothing; one grant per identity remains one grant. Expiry just returns idle house liquidity to the pool.
- Notify the user a few days before expiry ("your welcome sats expire soon, stream them to a creator").

## 2. Custodial vs non-custodial

Two supported paths. The grant only applies cleanly to the custodial path.

### Custodial (default for new users)

- Aether holds the balance in an internal ledger backed by a house Lightning node.
- Grant = ledger credit. Cheap, instant, reversible, spend restrictable. This is what makes the seed grant viable.
- User streams/boosts; Aether's node pays creators from house liquidity, debiting the user's ledger balance.
- Trade off: users trust Aether with custody of granted (and later, funded) sats. Acceptable for small balances and the exact model Fountain used to bootstrap.

### Non-custodial (bring your own wallet via NWC)

- User connects an external Lightning wallet (self custodial node, or custodial Alby) using an NWC connection URI (paste or QR), same UX as Castamatic's "Connect NWC Wallet."
- Payments stream directly from the user's wallet; Aether never holds funds.
- Grant handling: a house seed grant to a non-custodial wallet would be a REAL outbound Lightning payment per user (costly, hard to claw back, easy to farm). So: **non-custodial users are NOT granted seed sats by default.** They already brought funds; the grant's purpose (let a broke new user experience value4value) does not apply.
- If a promo grant to non-custodial users is ever wanted, issue it as a claimable Lightning offer / LNURL-withdraw with strict per identity single use, and accept the higher abuse surface. Keep this off by default.

### Integration notes

- NWC is the standard interop layer for the non-custodial path; use it rather than a bespoke connector. It gives permissioned, revocable spend access to the user's wallet.
- Alby (custodial or self custodial) is a natural default suggestion for users who have no wallet yet and want non-custodial without running a node.
- Keep granted and funded balances segregated in the custodial ledger so withdrawal rules and clawback apply only to the correct bucket.

## 3. New user flow: signup to first boost

1. Signup. Collect identity strong enough to gate a grant (verified email + phone, or linked Nostr/OAuth identity).
2. Wallet choice:
   - "Start instantly" -> custodial balance created (default, recommended for newcomers).
   - "Connect my wallet" -> NWC connect flow (paste URI / scan QR). Skips the grant.
3. Grant issuance (custodial path only): after identity + device/IP checks pass, credit 2,000 granted sats (spend restricted, 30 day expiry). Show a welcome card: "2,000 welcome sats to stream to creators. Stream or boost them within 30 days."
4. Optional unlock gate: if enabled, grant activates after the user listens N minutes (mirrors Fountain "earn by listening"), reinforcing real use before spend.
5. First stream: user plays an Aether station. Streaming sats flow per segment to creators + station cut (see value-model.md), debited from the granted balance.
6. First boost: user boosts a segment. Boost draws from granted balance (subject to per boost cap from granted funds), routes to the currently active recipient set. This is the "aha" moment; the user sees creators get paid with sats they never had to buy.
7. Conversion: once granted sats run low, prompt to fund the custodial balance (Lightning deposit) or connect an external wallet via NWC. Funded balance is withdrawable; granted balance never was.

## 4. Open questions / blockers

- Custody / regulatory: holding user balances (custodial model) may carry money transmission / KYC implications depending on jurisdiction and balance sizes. Small welcome grants are low risk, but funded custodial balances at scale need legal review. Flagged, not resolved here.
- House liquidity: streaming pays creators from house Lightning liquidity in real time; the node needs enough outbound channel capacity to cover concurrent streaming from granted balances. Capacity planning is an ops dependency, not a design blocker.
- Grant abuse economics: final grant size and identity bar should be tuned against observed farming once live. 2,000 sats + spend restriction + single identity is a conservative start.
- Non-custodial promo grants are deliberately out of scope by default because of cost and abuse; revisit only if there is a concrete campaign need.
