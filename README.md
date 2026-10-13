# Multiply!

Multiply helps kids practice multiplication and lets parents follow the whole family's progress. The experience is playful, mobile-friendly, and focused on practice, visible rewards, and learning individual facts. The canonical site is [playmultiply.com](https://playmultiply.com).

This is the running source of truth for product behavior, durable decisions, and maintenance. Update the relevant section when behavior changes; keep detailed plans, review reports, screenshots, and completed rollout narratives in Git history rather than adding another document. [Feature flag operations](docs/feature-flags.md) is the one separate runbook required by [AGENTS.md](AGENTS.md). Source and migrations define implemented behavior; deployment and dashboard state must be checked separately.

## Product and learning rules

- Parents manage multiple players and assign multiplication ranges through 15 × 15. Players choose Practice or Challenge and either multiple-choice or typed answers. Practice supports 1–10 minute sessions; Challenge covers a selected set of questions. Practice has no competitive round score, but both activities earn XP.
- Each correct answer earns **1 XP**. First mastery of a fact earns **25 XP once**. A completed typed Challenge with at least **80% correct earns 5 bonus XP**; partial rounds, multiple choice, and Practice do not qualify. The database determines awards, and retries cannot pay twice.
- **Family rank follows lifetime XP**, including players without mastery. Equal XP shares competition rank (1, 1, 3). A one-player family gets a personal goal without a synthetic scored rival.
- **Mastery and levels follow the player's assigned range.** A fact needs at least five responses and at least 80% correct among the latest responses, up to ten. Mastery treats reversed equations as separate facts. Session selections do not change the assigned-range denominator.
- Levels are Starter (0%), Explorer (10%), Builder (25%), Expert (50%), and Math Genius (100%). Badges derive from saved mastery, including existing players' history. They are current levels, not permanent achievements: review evidence or range changes can lower a level, but earned XP does not decrease. There is no badge-specific database ledger.
- Varied-fact streaks recognize five different correct facts without a mistake. Repeats and reversed equations preserve the run without increasing it; a mistake resets the current run but retains the best. Runs persist across saved rounds, have a maximum of 120 unordered facts, and add no XP. Concurrent rounds use server save order; old history is not used to invent streaks.
- Answer feedback advances after five seconds, with immediate Next and pause/resume controls. Hidden tabs pause the countdown; reduced motion uses discrete fill steps. This reviews submitted answers and does not time thinking or reward speed. In-game rewards remain pending until saved.

Scoring references: [progression](lib/progression.js), [streaks](lib/streaks.js), and [database migrations](nhost/migrations/default).

## Families, access, and saved progress

Each parent account retains its owned family when joining another. Owners create/cancel seven-day email-bound invitations and remove invited parents; both parents can edit players and save games. Acceptance requires the invited verified email. The [invitation function](functions/family-invitation.js) sends via Brevo when configured, with a copyable one-time link if email is unavailable. Nhost Auth separately handles verification/reset emails.

When enabled, **Settings → Kids’ practice links** creates a revocable link for one player. Children can practice and see family XP/mastery summaries, but cannot switch players, edit assignments, manage parents, or read siblings' answer histories. Anyone holding the link can practice as that child. Only the secret's hash is stored server-side; replacing or disabling a link revokes access while preserving learning history. Copy the secret when created.

Child secrets stay in the URL fragment (`/play#play=…`), outside navigation URLs and referrer headers. Practice uses same-origin `/api/practice`, which forwards token-checked operations to Nhost without parent credentials. Create links on the canonical domain and allow that domain on children's devices. Loading and saving need internet; this is not offline gameplay.

The family RPC checks membership and locks the family before changes. Per-player writes and server-validated session appends protect concurrent parent updates. Durable game receipts prevent duplicate XP even after sessions leave the 200-session display history; receipts are not pruned. The durable-XP migration preserves an opening balance and marks existing mastery as already rewarded because capped history cannot reconstruct every past award.

Completed unsaved games remain in account/family/game-scoped or per-link browser outboxes across reloads. Only acknowledged games are removed; cached profiles are never authoritative. If assignments shrink while a child round is pending, the server rejects out-of-range results and the child can explicitly discard that round and load updated tables.

## Website, routes, and installation

| Entry | Behavior |
| --- | --- |
| `/` | Public homepage when enabled; original app when the landing flag is off |
| `/play` | Family game, authentication, player selection, and activities |
| `/play?signup=1` | Signup for signed-out visitors; game for signed-in parents |
| `/login` | Authentication, then `/play` |
| `/#play=…` or `/?invite=…` | Browser replacement to `/play`, preserving the secret/invitation |
| Existing standalone parent shortcut at `/` | Compatibility entry opens `/play` |

The homepage shows the product through a playable sample, three-step introduction, conditional parent-to-child handoff, grouped features, family progress, and signup. Keep previews truthful, clearly illustrative, readable on mobile, and free of real family data. The sample awards only local sample XP; it neither claims new mastery from one answer nor calls game services or persists sessions. Prefer concise visual demonstrations, one full family leaderboard, static readable handoff frames, visible mobile Sign in, and continuous keyboard focus. Child-link promotion requires both child access and showcase flags.

Parent installation keeps manifest identity `/` and launches `/play`. Child manifests use a digest-based identity and omit `start_url` to retain the installing URL's fragment. Manifest requests/responses contain no bearer secret; there is no device-wide last-player selection. Legacy root entry compatibility remains necessary for older installed icons.

The production-only service worker caches an offline page and logo assets, not family data, auth responses, or app HTML. Installation requires HTTPS outside localhost. Chromium offers installation when supported; iOS uses Share → Add to Home Screen. Physical-device installation, reopening separate player icons, and light/dark icon appearance still need device verification; browser checks cannot establish those results. Old icons may need removal and reinstallation from the current link.

When changing icons, run `node scripts/generate-pwa-icons.mjs` and update icon URL versions together in `app/layout.tsx`, `lib/manifest.json`, and `public/sw.js`. Increment the worker cache version for precached asset changes; serve the worker with revalidation. Shared inputs stay at least 16px to avoid iPhone focus zoom, while the viewport remains scalable. Badge artwork lives in [public/badges](public/badges); keep readable level labels outside the SVGs.

## Development and deployment

Next.js App Router and React run on Vercel; Nhost provides authentication, PostgreSQL, Hasura RPCs, and the invitation function. This app requires a server runtime for its API routes; do not configure static export or publish the old `out/` directory. Read the installed Next.js guides identified in `AGENTS.md` before writing application code.

```sh
npm install
cp .env.example .env.local
npm run dev
```

Public Nhost subdomain/region settings are in [.env.example](.env.example). Optional `NEXT_PUBLIC_NHOST_AUTH_URL` and `NEXT_PUBLIC_NHOST_GRAPHQL_URL` support disposable local services and must be set before building. Pull Development flag credentials as described in the [runbook](docs/feature-flags.md). Keep `BREVO_API_KEY` server-side in Nhost's `global.environment`; never expose administrator or flag secrets through `NEXT_PUBLIC_*` variables.

Apply migrations in timestamp order and deploy the invitation function with the normal Nhost workflow. For a new backend or legacy upgrade, preserve these requirements:

1. Back up the database and current Hasura metadata. During the original shared-family migration, pause legacy clients that write whole profiles and require a refresh afterward; legacy profile rows are retained for recovery.
2. Apply the shared-family, durable-XP, child-link, child-standings, streak, and typed-challenge migrations from [nhost/migrations/default](nhost/migrations/default). Check the target's applied migration state rather than assuming repository code is deployed.
3. Run `node scripts/apply-family-metadata.mjs` with `HASURA_METADATA_URL` (ending in `/v1/metadata`) and `HASURA_GRAPHQL_ADMIN_SECRET`. It merges a fresh metadata export and preserves unrelated auth/storage metadata. **Never replace live metadata wholesale with repository fragments.** Family/link tables stay private; RPC result tables are physically empty.
4. Child access requires anonymous GraphQL's `public` role (`HASURA_GRAPHQL_UNAUTHORIZED_ROLE=public` for standalone Hasura). The practice RPC still requires a valid child token. Deploy the integrated frontend before enabling its flags.

Rollback is data-sensitive: the shared-family rollback refuses to discard diverged/shared family data, and streak rollback refuses to discard recorded achievements. Reconcile or restore backups instead of forcing destructive rollback; untrack family RPC metadata before returning to the legacy schema. Historical recovery locations and rollout evidence remain in Git history.

## Verification

```sh
npm test
npm run build
npm run test:api
```

Unit tests cover progression, outboxes, routing, manifests, metadata, and enabled/disabled/provider-failure flag behavior including direct APIs. API integration tests require Docker and create disposable PostgreSQL 18/Hasura 2.48.10 services to exercise real permissions, concurrency, revocation, and idempotent rewards. For an existing local PostgreSQL container, use `PG_CONTAINER=multiply-family-pg npm run test:database`; the runner creates its own disposable database. If the environment prevents Turbopack's worker port binding, use `npm run build -- --webpack`.

`MULTIPLY_BROWSER_FIXTURE=/tmp/multiply-browser-fixture.json npm run test:api` retains disposable services and writes a restricted browser fixture. Point the dev GraphQL override to its endpoint plus `/v1/graphql`; interrupt the runner to remove containers and delete the fixture afterward. Do not commit fixture credentials.

For UI changes, check narrow mobile layouts, keyboard focus, reduced motion, enabled/disabled flags, and save/retry flows as relevant. Record checks in the change/PR, not another permanent report. Existing browser evidence does not establish physical-device installation, a full accessibility audit, or conversion improvements.

## Decisions to retain

- **October 12, 2026:** Lifetime XP became the family ranking metric, superseding the earlier mastery-ranking plan. Mastery determines levels; streaks recognize varied practice without extra XP.
- **October 12, 2026:** The typed-Challenge bonus was explicitly released unconditionally; its temporary flag was removed. No retroactive bonus is awarded to old sessions.
- **October 13, 2026:** Homepage refinements favor fewer repeated demonstrations and readable static previews. Marketing for child links follows actual feature availability.
- **October 13, 2026:** Consolidate durable facts here, keep flag operations in one required runbook, and use Git history for superseded plans, image studies, and verification narratives. Update existing sections instead of appending a work diary. For old material, use `git log --all -- docs/` and `git show <commit>:docs/<file>`.
