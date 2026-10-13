# Feature flags

Use **Vercel Flags** for Multiply. The project is already hosted on Vercel and its linked team is on Hobby. As checked on October 12, 2026, Hobby includes 100 flags and 10,000 flag requests per billing cycle. The current [Vercel pricing documentation](https://vercel.com/docs/flags/vercel-flags/limits-and-pricing) lists Pro usage at $0.03 per 1,000 requests. Requests are not page views: page rendering, API calls, and practice polling can each read flag configuration. Monitor usage before relying on this for heavier traffic.

A centralized environment-variable boolean is the smallest alternative and costs no flag-service requests, but every toggle needs a redeploy. A custom database table allows runtime toggles but requires permissions, caching, management UI, and failure handling. Supabase can host such a table, and its [feature-flag middleware](https://supabase.com/docs/reference/middleware/middleware-withfeatureflag) accepts your own `check` callback. Multiply uses Nhost, so adding Supabase solely for flags would introduce another backend. Vercel gives us runtime toggles, environment separation, and a dashboard in the service we already use.

## Current flags

| Key | Development | Preview | Production | Failure fallback |
| --- | --- | --- | --- | --- |
| `child-practice-links` | On | On | Off | Off |
| `landing-page` | On | On | On | Off |
| `mastery-badges` | On | On | On | Off |
| `practice-link-showcase` | On | On | Off | Off |

[Manage child practice links in Vercel](https://vercel.com/deric-cains-projects-8a553f23/multiply/flag/child-practice-links).

This flag controls the parent’s Kids’ practice links settings, direct `#play` entry, practice load/save API, parent link-management API, and player manifest/installation flow. When off, child entry shows a paused message and valid API requests return `503` with `FEATURE_DISABLED`, `Retry-After: 60`, and `Cache-Control: no-store`, before making any Nhost call. Existing links, learning history, and pending rounds are preserved. Already-open clients can show the previous UI until refreshed; the server checks every API request again.

The new integration must be deployed before the live app honors this flag. Changing the dashboard flag does not change already-deployed code that predates the integration. The existing [child-link backend migrations and permissions](child-practice-links.md#rollout) must also be installed before enabling child access.

## Implementation

Declare flags only in `lib/flags.ts`, using `flags/next`, the `@flags-sdk/vercel` adapter, and `defaultValue: false`. The root server layout evaluates at request time, then supplies only resolved booleans through `FeatureFlagsProvider`. SDK credentials stay on the server; children make no browser requests to the flag provider. App API routes evaluate independently so old pages cannot bypass a disabled rollout.

Authorization remains separate: Nhost still checks parent membership and child bearer tokens. The Vercel flag covers the app’s routes, not direct calls to the Nhost GraphQL RPCs. Turning it off pauses the app feature; it does not revoke a bearer token or remove Hasura permissions. Disable an individual child’s link before pausing the rollout if their underlying access must also be revoked. A future service-level emergency switch would need enforcement inside Nhost as well.

The local Vercel Toolbar and authenticated `/.well-known/vercel/flags` discovery endpoint support Flags Explorer. Overrides use the SDK’s encrypted, signed cookie and require `FLAGS_SECRET`; there is no plain URL/localStorage override. Never put `FLAGS_SECRET`, `VERCEL_OIDC_TOKEN`, or `FLAGS` in a `NEXT_PUBLIC_*` variable.

## Operations

Verify the linked project before any flag mutation:

```sh
vercel project inspect --non-interactive
vercel flags inspect child-practice-links --non-interactive
```

Toggle the Production rollout without redeploying the integrated app:

```sh
vercel flags enable child-practice-links --environment production --non-interactive
vercel flags disable child-practice-links --environment production --non-interactive
```

Enabling Production is a release decision and requires the user’s explicit instruction. Dashboard changes propagate through the provider cache; refresh the page to obtain updated client booleans, and allow propagation time before checking a toggle.

For local development:

```sh
vercel env pull .env.local --environment development --non-interactive
npm run dev
```

The pull supplies a local OIDC token and `FLAGS_SECRET`. Deployed apps receive Vercel OIDC automatically. `.env*.local` and `.vercel/` are ignored by Git. `AGENTS.md` is no longer ignored, so the default-off feature policy can be committed with the repository.

## Verification

`npm test` mocks only the provider decision to verify enabled operations, disabled direct API requests, provider-failure fallback, authenticated parent forwarding, and retained Hasura membership errors. Existing player-manifest and practice tests explicitly run with the flag enabled; they do not depend on network access or real flag credentials. The production build checks server/client boundaries and includes dynamic app rendering so the flag is not frozen at build time.

Local browser checks verified the real Development flag enables parent link creation and child entry against disposable PostgreSQL/Hasura services. An SDK-authenticated disabled override hid the parent controls, kept normal parent gameplay available, showed paused child entry, and returned `FEATURE_DISABLED` from all three app APIs. Production stayed off throughout these checks.

## Released features

The typed challenge XP bonus is unconditional at the user's request. Its temporary `typed-challenge-bonus` flag has been removed from code and Vercel. Completing a typed challenge with at least 80% correct earns 5 bonus XP; partial rounds, multiple choice, and practice do not. The database computes eligibility and retains the award in the session receipt so retries cannot pay twice. `20261012010000_typed_challenge_bonus` was applied to the linked production Nhost project on October 12, 2026 and recorded as clean; historical sessions receive no retroactive award. Parent and child authorization and challenge validation remain in place. Database coverage is in `tests/typed-challenge-database.sql`.

Production verification confirmed the unconditional 5 XP bonus and idempotent receipt retry in a transaction that rolled back all test data. Hasura metadata is consistent. The prior function and migration catalog are backed up locally in `/Users/dericcain/.codex/backups/multiply/2026-10-12-typed-challenge-bonus`.

## Public landing page

`landing-page` controls the new public homepage at `/` and its landing-specific SEO/social metadata. Development, Preview, and Production are On; provider-failure fallback is Off (verified October 13, 2026). It is evaluated on the server at request time. The root layout passes the resolved booleans through `FeatureFlagsProvider`; the server page renders the marketing composition only when enabled. When disabled, ordinary root visitors get the existing application. `/play`, `/login`, legacy entry compatibility, and canonical link generation remain available regardless of the landing rollout: these preserve existing app behavior and are not new backend features.

[Manage the landing page in Vercel](https://vercel.com/deric-cains-projects-8a553f23/multiply/flag/landing-page). Toggle with `vercel flags enable landing-page --environment preview --non-interactive` (or `disable`). Production enablement requires an explicit release instruction. All demonstrations are local sample interfaces, with no player sessions, persistence, auth, or game-service requests. The page introduces no app API routes. Static preview assets do not expose family data.

`practice-link-showcase` controls the responsive parent-to-child section inside the enabled landing page. It has the same On Development/Preview, Off Production, and Off failure defaults. [Manage the showcase in Vercel](https://vercel.com/deric-cains-projects-8a553f23/multiply/flag/practice-link-showcase). Toggle with `vercel flags enable practice-link-showcase --environment preview --non-interactive` (or `disable`). The server renders it only when both `practice-link-showcase` and `child-practice-links` are enabled. A missing configuration or provider failure for either leaves the showcase hidden. This presentation dependency does not change child API gates, permissions, or backing services. Preview can test it independently of Production using the SDK’s signed, authorized overrides, with both flags enabled.

As verified on October 13, 2026, Production has `landing-page` and `mastery-badges` On; `practice-link-showcase` and `child-practice-links` remain Off. A direct deployed practice load request returned `503 FEATURE_DISABLED`, and the public page omitted the showcase. To release child access and its homepage demonstration, deploy the integrated app and backend migrations, then enable both child and showcase flags only with explicit release approval. No Production flag settings were changed during the refinement.


The [landing page implementation and verification notes](landing-page.md) cover route migration, installed shortcuts, sample data, and browser evidence. `npm test` covers all three flags’ enabled/disabled decisions and provider failures, legacy URL routing, canonical links, and manifests. Existing API tests retain enabled/disabled/provider-failure coverage for direct child requests.

## Mastery badges

`mastery-badges` adds the five SVG badges to player selection, family standings, and activity/results mastery cards. An expandable badge shelf shows all five levels with clear unlocked/current/locked labels. Development, Preview, and Production are **On**; provider-failure fallback is **Off** (verified October 13, 2026).

[Manage mastery badges in Vercel](https://vercel.com/deric-cains-projects-8a553f23/multiply/flag/mastery-badges). Toggle with `vercel flags enable mastery-badges --environment preview --non-interactive` (or `disable`). Production requires an explicit release instruction and deployment of this integration.

Existing players receive their current badge and all lower-level badges immediately from their saved, assigned-range mastery. No new game, backfill job, migration, XP bonus, or client storage is needed. Refreshing or opening another device recomputes the same badges from authoritative saved progress. Badges follow the existing current-level rules: review evidence or expanding the assigned range can reduce the currently unlocked set. This is not a permanent historical achievement ledger.

The server evaluates the flag in the root layout and passes only its boolean through `FeatureFlagsProvider`. All badge UI is gated, including the public homepage’s sample Builder artwork. Disabling badges preserves the numerical mastery preview. This is a presentation feature with no badge API, backing service, or writes. Existing family/practice/manifest APIs and their authorization and flags remain independent; disabling badges does not disable ordinary progress saves. Child standings render badges from the existing family-only count/total summaries without requesting other players’ answer histories. Pending rounds use saved mastery until the server confirms the save. No database rollout dependency.

Verification: all five levels appeared from seeded historical evidence before playing; parent player selection and child standings showed matching badges; a saved child round retained the correct results badge. An SDK-signed disabled override removed badge images and the shelf while retaining the existing level display. Browser checks passed at 320, 390, and 768px with no horizontal overflow. All 48 tests and the production build passed. Provider-decision and failure-fallback coverage is in `tests/feature-flags.test.mjs`. Visual evidence and details are in [the badge integration notes](design/mastery-badges/integration.md).
