# Backend on Vercel: hosting, API, realtime, anti-cheat, economy

Plan for v2 (quest `v2-backend-online-platform`), t475, 2026-11-19. Research only: nothing built, no accounts made. Prices were read on the vendors' pages on 2026-11-19 and are linked in [Sources](#sources). Cost rows marked *est.* are my arithmetic on top of those prices, not quotes.

## TL;DR

- Web build and API on **Vercel Pro** (one project: static `dist/` + `/api` Functions), **Neon Postgres + Drizzle**, **Upstash Redis** for boards and presence, **Vercel Blob** for input tapes and ghosts, **Better Auth** with guest-first accounts.
- Race traffic stays **P2P** (trystero, already built, zero server cost). Ranked rooms later run on a **Cloudflare Durable Object** relay. Vercel Functions now do WebSockets, but a room can't be pinned to one instance and connections drop at max duration, so they are wrong for a 20 Hz room.
- Leaderboards get **server re-sim of an input tape**: the sim is pure TS and already uses its own deterministic maths (`src/sim-math.ts`). About $0.05 per 1,000 verified solo runs *est.*
- Credits stay earn-only and local for guests. Real money never buys credits. Money buys server-held entitlements.
- The single-player bundle keeps zero hard backend dependency: portals (CrazyGames, Poki) need it, and they force their own login.
- Portal ads need no backend at all. Ship them before v2.0.

## What's there today

| Area | Today | v2 fate |
|---|---|---|
| Hosting | GitHub Pages, `.github/workflows/deploy.yml`, `base: "./"` in `vite.config.ts`, 6.1 MB `dist/` | Vercel for web. Portals get the same static zip |
| Net | trystero 0.26 on its default **Nostr** signalling, Metered TURN (`src/net/ice.ts`), 20 Hz car packet (`HEARTBEAT_MS = 50`, ~90 B, `src/net/car-packet.ts`), `PROTOCOL = 3` | Keep for casual rooms. Signalling moves to our own relay (trystero's `relayConfig` / `createTopicStrategy`) |
| Saves | IndexedDB `harepin`: `series`, `ghosts`, `kv`, `wallet`, `replays` (`src/store/idb.ts`), plus 23 `localStorage` call sites | Stays the offline source. Accounts sync it up |
| Wallet | `credits` + `cars`, parsed as untrusted (`src/career/wallet.ts`) | Local for guests, server mirror for accounts |
| Daily board | peers swap times over P2P, best per name (`src/runs/daily-board.ts`) | Server board in Redis. The P2P board stays as the offline/portal fallback |
| Ghosts | poses at `GHOST_EVERY_MS` (`src/car/ghost.ts`) | Poses can't be verified. Add an **input tape** next to them |
| Determinism | fdlibm maths in `src/sim-math.ts` (commit `08a92bf`), used by car, AI, world. JS physics with it matched bit for bit across Bun, Node, Chrome, WebKit in the lockstep bench (`docs/plan/sim-performance.md` §3) | Base for re-sim. Whole-world, cross-engine identity is **not yet proven end to end** |

## 1. Hosting the static game

| | GitHub Pages (today) | Vercel Hobby | Vercel Pro | Cloudflare Workers static assets |
|---|---|---|---|---|
| Price | $0 | $0 | $20/mo per seat, $20 usage credit included | $0, or $5/mo Workers Paid |
| Commercial use (ads, store) | **No**: "not intended for or allowed to be used as a free web-hosting service" for an online business | **No**: "personal or non-commercial use" (Terms §4) | Yes | Yes |
| Bandwidth | 100 GB/mo soft | 100 GB/mo, hard cap, can't buy more | 1 TB/mo Fast Data Transfer, then from $0.15/GB | free and unlimited for static assets |
| Preview deploy per PR | no | yes | yes, with protection | yes |
| Same-origin API | no | yes | yes | yes |
| Custom domain | yes | yes | yes, plus a free first-year domain on paid Pro | yes |

Bandwidth per MAU *est.*: ~5 MB first load (the PWA caches it), plus ~5 MB for each release that touches assets, so ~10 MB/MAU/month.

| MAU | Transfer *est.* | GH Pages | Vercel | Cloudflare |
|---|---|---|---|---|
| 0 | ~0 | $0 | $0 Hobby (no ads allowed) / $20 Pro | $0 |
| 1k | ~10 GB | $0 | $20 Pro, inside the credit | $0-5 |
| 50k | ~500 GB | over the soft cap, and commercial anyway | $20 + inside the 1 TB | $5 |

Verdict: stay on Pages until the web build carries ads or a store, or until the API lands. Then move to Vercel Pro. Hobby is out the moment money is involved.

**Origin change loses local saves.** IndexedDB is per origin, and `lilbunnyrabbit.github.io` and the new domain are different origins. There are no real players yet, so a hard cut is fine. If that changes before the move: the old site exports its stores into a one-time `#import=` link to the new origin, the same untrusted parse as any load. Buy the domain first so this happens once.

**Portal builds:** same `vite build`, `base: "./"`, a `PORTAL` define that picks the identity adapter and ad SDK. The network layer sits behind one `Backend` interface whose offline implementation is what single player uses. No backend call is ever on the path to driving.

## 2. Backend on Vercel

| Need | Pick | Why | Price (2026-11-19) |
|---|---|---|---|
| API | Vercel Functions, Fluid compute, **Bun runtime** (Bun 1.4 is available in Functions) | Same origin, same TS, pure modules (`parse_wallet`, `sim/`, `car/`, `worldgen/`) import as-is | Pro: $0.60/1M invocations, Active CPU from $0.128/h, provisioned memory from $0.0106/GB-h. Max duration 300 s default, 800 s on Pro |
| DB | **Neon Postgres** via Vercel Marketplace + **Drizzle** | Branch per preview deploy. Scales to zero after 5 min | Free: 100 CU-h/project, 1 GB storage. Launch: $0.106/CU-h, $0.35/GB-mo, ~$15/mo for "intermittent load" |
| Boards, presence, rate limits | **Upstash Redis** (Marketplace) | ZSET per board, TTL keys for presence | Free 500k commands/mo, 256 MB. PAYG $0.20/100k commands |
| Tapes, ghosts, replays, design renders | **Vercel Blob** | Content-addressed, CDN-served | Pro from $0.023/GB-mo, $0.35/1M simple ops, $4.50/1M advanced ops |
| Auth | **Better Auth** | Open source, data in our own Postgres. `anonymous()` plugin with `onLinkAccount` gives guest-first then link. Custom sign-in for portal tokens. Auth.js is maintained by Better Auth since Sep 2025, and Better Auth joined Vercel 2026-07-07 | $0 |
| Payments (phase 4) | **Paddle** (merchant of record) | Handles VAT filing for a solo seller | 5% + 50¢ per checkout. Items under $10 need custom pricing |

Auth options compared:

| | Better Auth | Clerk | Auth.js |
|---|---|---|---|
| Guest then link | built in (`signIn.anonymous`, `onLinkAccount`) | possible, not first-class | hand-rolled |
| Portal JWT as identity (CrazyGames `getUserToken`, Poki token) | custom plugin, our code | custom flow against their user model | custom provider |
| Data location | our Neon | Clerk | our DB |
| Cost at 50k | $0 | free up to 50k MRU/app, then $0.02/MRU | $0 |
| Status | active | active | maintenance (security fixes) |

**Portal identity rule.** CrazyGames: "Logging out in the game and allowing login with external login options (e.g. Facebook, Google, email) is not allowed." Use their `userId` as the key and verify the token server-side. Poki: no email login, no Google or Facebook login, no in-app purchases, external servers only after approval. So an account is **one player row with several identities** (`guest`, `web` OAuth, `crazygames`, `poki`). Each portal build shows only its own sign-in.

### API surface (v2.0 to v2.1)

| Route | Does |
|---|---|
| `POST /api/auth/*` | Better Auth: guest, Discord/Google, portal token |
| `GET/PUT /api/save/:store` | Whole-store JSON with a version and `updated_at`. The server runs the same `parse_*` validator the client uses |
| `GET/PUT /api/profile` | name tag (`clean_name`), title, badge, tint |
| `POST /api/runs` | input tape + claim. Plausibility check now, re-sim queued |
| `GET /api/boards/:key?around=me` | Redis ZSET read, cached 10 s at the CDN |

## 3. Realtime multiplayer

The premise "Functions can't hold WebSockets" is out of date: Vercel WebSockets went GA on 2026-10-20. They still don't fit a race room:

| Fact (Vercel docs) | Effect on a room |
|---|---|
| "A single WebSocket connection is pinned to one Vercel Function instance" and reconnects "are not guaranteed to reach the same instance" | 8 cars land on up to 8 instances. Every packet then hops through Redis pub/sub |
| "WebSocket connections close when a Vercel Function reaches its maximum duration" (300 s, 800 s on Pro) | Endurance and lobbies drop mid-session |
| Billed as Function usage while open, plus transfer | Paying for idle lobbies |

The Redis hop for one 8-car room at 20 Hz is 160 publishes/s, about 576k commands per room-hour, about $1.15/room-hour on Upstash PAYG *est.* That rules it out.

A 2-8 car race at 20 Hz with the current ~90 B packet: each client sends 20 msg/s and receives 140 msg/s (~12.6 KB/s). A relay room carries ~160 msg/s in and ~360 MB/h out *est.*

| Option | Cost per room-hour *est.* | Latency vs today | Ops | Verdict |
|---|---|---|---|---|
| **Keep P2P** (trystero mesh) + own signalling + TURN | $0. TURN only for carrier-NAT pairs: Metered $0.40/GB over 150 GB on Growth ($99), Cloudflare TURN $0.05/GB | best: direct | existing code | **Casual rooms, keep** |
| **Cloudflare Durable Object relay** (PartyServer from `cloudflare/partykit`) | incoming msgs billed 20:1 → 8 req/s ≈ $0.004. Duration 128 MB × 3600 s ≈ $0.006. Egress free. ≈ **$0.01**. $5/mo account minimum | +1 relay hop, the object sits near the first joiner (+10-50 ms same continent, unverified) | one Worker, no servers | **Ranked rooms, signalling, presence** |
| Fly.io Bun relay | 512 MB machine $3.69/mo 24/7. Egress $0.02/GB → ~$0.007 | same as DO, pick a region | own server: deploys, health, regions | Fallback if DO pricing changes |
| Vercel WebSockets | ~$1.15 Redis + Function time | relay plus Redis hop | low | No, see above |
| Ably | MAU-priced: Free 500 MAU, Pro $29/mo per 1k MAU | relay | none | Too dear at 50k MAU |
| Pusher Channels | Sandbox 200k msgs/day, 100 connections. Startup $49/mo for 1M/day | relay | none | One 8-car race (~1,120 delivered msg/s) burns the sandbox day in ~3 min |
| Liveblocks | per-MAU, built for document sync | relay | none | Wrong tool |

**Recommendation:** P2P stays for casual and friend rooms. A Durable Object does three jobs:

1. **Signalling**, replacing public Nostr relays (trystero's self-hosted WebSocket strategy).
2. **Presence and invites** (WebSocket Hibernation API, so idle sockets cost no duration).
3. **Ranked rooms**: the relay forwards the 20 Hz packets, keeps each car's input tape, and posts it to `/api/runs` for re-sim after the flag.

It is a relay with validation, not an authoritative server sim. Running 8 cars at 360 Hz in a DO is ~8 × 11.4 µs × 360 ≈ 33 ms CPU per wall second *est.* That fits, but it adds a second sim host for little gain over post-race re-sim.

## 4. Anti-cheat for leaderboards

| Check | Catches | Cost | When |
|---|---|---|---|
| Plausibility: time ≥ route floor, speed ≤ car's top speed (`scripts/telemetry.ts` numbers), gates in order, pose step ≤ `TELEPORT_MPS` (`src/replay/run-tape.ts`), build PI legal for the class | edited times, teleports, impossible builds | µs | every submit |
| Rate and identity: one account, run count per day, sanitized like peer data | spam, sock puppets | Redis ops | every submit |
| **Re-sim the input tape** on the server, compare finish time and final-pose digest | speed hacks, physics edits, macro inputs that drive physically | below | every run that would enter a board's top 100, every season-star claim, every ranked race |
| Spot re-sim of random runs | slow drift in cheating | below | 1% |

Re-sim cost (Bun, JS physics on the real `World`: 11.4 µs per car-step, `docs/plan/sim-performance.md` §2):

| Run | Steps | CPU *est.* | Vercel cost per run *est.* | Per 1,000 runs |
|---|---|---|---|---|
| 3 min solo (daily, time trial) | 64,800 | ~0.74 s sim + world gen (cached per instance per daily) | ~$0.000045 | **~$0.05** |
| 3 min with a 7-car AI field | 8 cars | ~6 s + AI driver logic (unmeasured) | ~$0.0003 | ~$0.30 |

Prerequisites (new code, phase 2):

1. **Input tape:** per-step steer, throttle, brake, handbrake, nitro, shift and reset, run-length encoded on change. The tape also records rewinds: a rewind truncates it to the restored step. Expect a few KB per 3 min.
2. **Cross-engine proof:** one test drives a tape through the full `SimHost` in Bun, then in Chrome and WebKit through Playwright, and compares digests. The lockstep bench proved the car on a heightfield. It did not prove ramps, decks, water, collide, AI or worldgen. A miss means a false reject, so until it passes, re-sim flags and does not delete.
3. Version pin: the tape carries the build version and the kind `version`. The server keeps the last N sim builds or re-sims only on the current one, and the season boards reset on a sim change, as records do today.

## 5. Server-side economy

The premise "credits must move server-side" holds only if credits can be bought or affect others. Keep it so they can't:

| Thing | Guest (local) | Account | Why |
|---|---|---|---|
| Credits | IndexedDB `wallet`, as now | server mirror. The server grants payouts only from runs it accepted | Credits are earn-only: cheating them unlocks your own cosmetics and parts, nothing others pay for |
| Owned frames, bodies, parts, cosmetics bought with credits | local | server list | same |
| **Paid entitlements** (supporter pack, paid season track, cosmetic bundles) | never local-only. A signed list is cached for offline | server, from Paddle webhooks | money |
| Ranked results, season stars for boards | P2P-only board offline | server | others see them |
| Ghosts, replays | local | Blob for board ghosts only | storage |

Never sell credits or any premium currency. That keeps the economy local-safe and avoids a whole class of fraud and refund work. Performance parts stay earn-only, matching the quest's no-pay-to-win rule.

## 6. Data model sketch (Postgres, Drizzle)

| Table | Key columns |
|---|---|
| `players` | `id`, `created_at`, `name`, `tag` (`clean_name`), `title`, `badge`, `tint`, `flags` (banned, shadow) |
| `identities` | `player_id`, `kind` (`guest`/`discord`/`google`/`crazygames`/`poki`), `subject`, unique (`kind`, `subject`) |
| `saves` | `player_id`, `store` (`series`/`wallet`/`kv`/…), `version`, `body jsonb`, `updated_at`. Whole-store last-writer-wins with a version check |
| `wallets` | `player_id`, `credits`, `updated_at` (server truth for accounts) |
| `owned` | `player_id`, `kind` (`frame`/`body`/`part`/`paint`/`decal`/`neon`), `item`, `car`, `source` (`cup`/`credits`/`paid`/`season`/`import`), `at` |
| `builds` | `player_id`, `car`, `code` (the existing build code), `pi`, `name` |
| `runs` | `id`, `player_id`, `board_key` (`daily_key` shape), `ms`, `score`, `build_code`, `sim_version`, `tape_blob`, `status` (`claimed`/`verified`/`rejected`), `at` |
| `boards` | Redis ZSET `board:{key}` → `run_id`, mirrored to Postgres per season close |
| `seasons` | `n`, `starts_at` (28-day, `season_of`), `player_id`, `stars`, `paid_track` |
| `friends` | `a`, `b`, `state` (`pending`/`accepted`/`blocked`) |
| `rooms` | `id`, `kind` (`casual`/`ranked`), `class`, `map_code`, `status`. Live state sits in the DO, the row is for history |
| `purchases` | `id`, `player_id`, `paddle_txn`, `sku`, `status`, `at` → grants rows in `owned` |
| `designs` (phase 5) | `id`, `player_id`, `season`, `body_json`, `renders[]`, `status`, `votes` |

**Guest to account migration:**

1. A guest plays fully offline. On first sign-in the client uploads each IndexedDB store.
2. The server parses each store with the same pure validators (`parse_wallet` and friends).
3. Credits import once, capped by what the imported progress could have earned. Owned items import with `source = import`.
4. Later conflicts: the server wins for wallet and paid items. Whole-store saves use last-writer-wins with a prompt when both sides changed since the last sync.
5. On a portal, the Better Auth guest links to the portal identity instead (`onLinkAccount`).

## 7. Roadmap

Effort is agent-days with tests. Monthly cost is at ~1k MAU, with the 50k MAU figure in brackets, all *est.*

| Phase | Scope | Effort | $/mo | Risks |
|---|---|---|---|---|
| **0. Portal ads** (no backend) | CrazyGames + Poki SDKs behind one `Ads` interface: midgame between races, rewarded (a cosmetic re-roll or a bonus that is not performance). Portal zip build | 3-5 | $0 | portal QA rules, ad timing never mid-run (`Updater` busy gate) |
| **v2.0 Accounts + cloud save** | Vercel Pro project, domain, Neon + Drizzle, Better Auth (guest, Discord, Google, CrazyGames token), `/api/save`, `/api/profile`, `Backend` interface with an offline fallback, origin move | 8-12 | $20-25 [$60-100] | origin move loses local saves, save-merge bugs, portal token verify |
| **v2.1 Verified boards** | input tape, cross-engine digest test, `/api/runs`, re-sim function, Redis boards for daily, weekly and season, Blob board ghosts | 10-15 | +$0-5 [+$20-40] | determinism gaps → false rejects, tape size, sim version churn resets boards |
| **v2.2 Friends + presence + own signalling** | DO Worker: presence, invites, trystero relay strategy replacing Nostr. Friend list, join a friend's room | 8-12 | +$5 [+$5-10] | second vendor, `PROTOCOL` bump for signalling |
| **v2.3 Ranked rooms** | DO relay rooms, matchmaking by PI class, post-race re-sim, ranked boards | 15-25 | +$1 [+$10-20] | relay latency feel, quitters, small player pool → empty queues (fill with AI) |
| **v2.4 Store** | Paddle checkout, webhooks → `purchases`/`owned`, supporter pack, paid season track, signed offline entitlements. Web only (Poki forbids IAP) | 8-12 | fees only | VAT/refunds (Paddle handles), price under $10 needs custom pricing |
| **v2.5 Community designs** | body editor export (`?cars` viewer), submit, vote window per season, moderation | 12-20 | +$0-5 | abuse, IP/licence terms, sock-puppet votes |

Totals at 50k MAU (all phases) *est.*: Vercel $20 + $40-80 usage, Neon $30-70, Upstash $10-20, Cloudflare $5-15. That is **~$110-200/mo**, before Paddle fees.

## 8. Open decisions for the owner

| # | Decision | Options (lightest first) | Pick |
|---|---|---|---|
| 1 | Host | stay on Pages until money / **Vercel Pro** / Cloudflare-only (Workers + D1 + DO, $5/mo, one vendor, V8 like Chrome for re-sim) | **Vercel Pro + Cloudflare DO for realtime.** Cloudflare-only is the real alternative: cheaper and one vendor, but D1 instead of Postgres and weaker preview DX. Your call |
| 2 | When to move | now / at the first ads on web / at v2.0 | **At v2.0**, with a domain bought before |
| 3 | Auth | Better Auth / Clerk / Auth.js | **Better Auth** (guest + portal identities in our DB, $0) |
| 4 | Web sign-in methods | Discord / Google / email magic link / passkey | **Discord + Google**, no passwords |
| 5 | Realtime | keep P2P only / P2P + DO relay for ranked / everything relayed | **P2P casual + DO for signalling, presence, ranked** |
| 6 | Which runs get re-sim | all / board top-100 + season claims + 1% spot / plausibility only | **Top-100 + claims + 1% spot** |
| 7 | Credits | local for all / mirror for accounts / server-only | **Local for guests, server mirror for accounts. Never sold** |
| 8 | What money buys | supporter pack / paid season track / cosmetic bundles / "full game" unlock | **Supporter pack + paid season track first.** No full-game unlock: it splits portal and web players |
| 9 | Payments | Paddle (MoR) / Lemon Squeezy (MoR) / Stripe + own VAT | **Paddle** |
| 10 | Ads before backend | yes, phase 0 / wait for v2 | **Yes, phase 0** |

## Sources

All read 2026-11-19. The page's own last-updated date is given where it shows one.

- Vercel pricing: https://vercel.com/pricing
- Vercel limits (function duration), updated 2026-09-16: https://vercel.com/docs/limits
- Vercel Hobby plan, updated 2026-11-12: https://vercel.com/docs/plans/hobby
- Vercel fair use, updated 2026-11-12: https://vercel.com/docs/limits/fair-use-guidelines
- Vercel Terms §4 (Hobby non-commercial): https://vercel.com/legal/terms
- Vercel WebSockets, updated 2026-08-10: https://vercel.com/docs/functions/websockets
- Vercel WebSockets GA changelog (2026-10-20): https://vercel.com/changelog/websocket-support-is-now-generally-available
- Vercel Daemons (beta, no inbound traffic), 2026-10-15: https://vercel.com/kb/guide/vercel-daemons
- Neon pricing: https://neon.com/pricing
- Upstash Redis pricing: https://upstash.com/pricing/redis
- Cloudflare Durable Objects pricing, updated 2026-11-13: https://developers.cloudflare.com/durable-objects/platform/pricing/
- Cloudflare Workers pricing, updated 2026-11-18: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare TURN, updated 2026-09-25: https://developers.cloudflare.com/realtime/turn/
- PartyServer: https://github.com/cloudflare/partykit
- Fly.io pricing: https://docs.fly.io/about/pricing
- Metered TURN pricing: https://www.metered.ca/stun-turn
- Ably pricing: https://ably.com/pricing
- Pusher Channels pricing: https://pusher.com/channels/pricing/
- Clerk pricing: https://clerk.com/pricing
- Better Auth anonymous plugin: https://www.better-auth.com/docs/plugins/anonymous
- Auth.js joins Better Auth (Sep 2025): https://better-auth.com/blog/authjs-joins-better-auth
- Better Auth joins Vercel (2026-07-07): https://better-auth.com/blog/better-auth-joins-vercel
- Paddle pricing: https://www.paddle.com/pricing
- GitHub Pages limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- CrazyGames technical requirements: https://docs.crazygames.com/requirements/technical/
- CrazyGames account integration: https://docs.crazygames.com/requirements/account-integration/
- Poki SDK requirements (accounts, IAP, external servers): https://sdk.poki.com/requirements
- trystero 0.26 README (self-hosted relay strategy): `node_modules/trystero/README.md`
- In repo: `docs/plan/sim-performance.md` §2-3, `src/sim-math.ts`, `src/net/`, `src/store/idb.ts`, `src/career/wallet.ts`, `src/runs/daily-board.ts`
