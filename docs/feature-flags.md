# Feature flags

Use **Vercel Flags** for Multiply. The project is already hosted on Vercel and its linked team is on Hobby. As checked on October 12, 2026, Hobby includes 100 flags and 10,000 flag requests per billing cycle. The current [Vercel pricing documentation](https://vercel.com/docs/flags/vercel-flags/limits-and-pricing) lists Pro usage at $0.03 per 1,000 requests. Requests are not page views: page rendering, API calls, and practice polling can each read flag configuration. Monitor usage before relying on this for heavier traffic.

A centralized environment-variable boolean is the smallest alternative and costs no flag-service requests, but every toggle needs a redeploy. A custom database table allows runtime toggles but requires permissions, caching, management UI, and failure handling. Supabase can host such a table, and its [feature-flag middleware](https://supabase.com/docs/reference/middleware/middleware-withfeatureflag) accepts your own `check` callback. Multiply uses Nhost, so adding Supabase solely for flags would introduce another backend. Vercel gives us runtime toggles, environment separation, and a dashboard in the service we already use.

## Current flag

| Key | Development | Preview | Production | Failure fallback |
| --- | --- | --- | --- | --- |
| `child-practice-links` | On | On | Off | Off |

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
