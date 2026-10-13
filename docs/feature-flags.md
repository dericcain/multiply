# Feature flag operations

[README](../README.md) is the product and decisions source of truth. This runbook covers the Vercel rollout controls required by [AGENTS.md](../AGENTS.md).

## Flags and boundaries

All declarations in [lib/flags.ts](../lib/flags.ts) default to **false**, including missing configuration and provider failures. The table was checked through read-only `vercel flags inspect` on **October 13, 2026 (CDT)** against the linked Multiply project. Values can change; inspect the project again before relying on them.

| Key | Development | Preview | Production | Scope / dependencies |
| --- | --- | --- | --- | --- |
| `child-practice-links` | On | On | On | Parent link controls, child entry, practice load/save, link-management API, and player manifests. Requires child-link/standings migrations and merged public-role metadata. |
| `landing-page` | On | On | On | Public homepage and its SEO/social metadata. Off restores the original app at `/`; `/play`, `/login`, and legacy entry compatibility remain available. No new backend dependency. |
| `mastery-badges` | On | On | On | Player cards, standings, activity/results shelf, and homepage sample artwork. Off preserves numerical progress and gameplay. No badge API, migration, or writes. |
| `practice-link-showcase` | On | On | On | Homepage handoff demonstration. Requires both `landing-page` and `child-practice-links`; no independent API or writes. |

New user-facing features start with Production off and Development/Preview enabled for verification. Production enablement requires the user's explicit release instruction. The typed-Challenge bonus is unconditional by an explicit release decision; its temporary flag was removed.

Player links are released in Production under the existing `child-practice-links` key. The owner enabled player access and explicitly requested homepage promotion; `practice-link-showcase` is now enabled in Production too. `app/page.tsx` continues to require `practice-link-showcase && child-practice-links` under the landing flag, so pausing player access also hides the showcase. Keep existing technical flag keys and API paths stable when using the user-facing name **Player links**. The app flags do not revoke direct backend access or existing bearer links.

## Implementation and authorization

Declare named kebab-case flags centrally using `flags/next`, the Vercel adapter, a description, and `defaultValue: false`. Evaluate on the server at request time; pass only booleans through `FeatureFlagsProvider`. Each implementing API route must evaluate independently, including secondary flows such as player manifests. An already-open page can show old UI until refreshed, but every API request checks again.

When child access is off, valid app API requests return `503 FEATURE_DISABLED`, `Retry-After: 60`, and `Cache-Control: no-store` before calling Nhost. Links, history, and pending rounds are preserved. Gate every UI entry point and all backing operations; disabled features must not perform writes or call their service.

Flags control rollout, not authorization. Nhost still checks parent membership and child tokens. **The app flag does not block direct Nhost RPC calls or revoke bearer links.** Disable individual links before pausing rollout when underlying access must also be revoked. A backend emergency switch would need enforcement inside Nhost.

Only SDK-signed, authorized Flags Explorer overrides are supported. The authenticated `/.well-known/vercel/flags` endpoint and local Vercel Toolbar support discovery. Do not add query-string/localStorage bypasses or expose `FLAGS_SECRET`, `VERCEL_OIDC_TOKEN`, or `FLAGS` in public environment variables.

## Inspect and toggle

Use the linked [Multiply Vercel project](https://vercel.com/deric-cains-projects-8a553f23/multiply). Verify the target first:

```sh
vercel project inspect --non-interactive
vercel flags inspect child-practice-links --non-interactive
```

Enable or disable the chosen key in the intended environment, for example:

```sh
vercel flags enable child-practice-links --environment preview --non-interactive
vercel flags disable child-practice-links --environment preview --non-interactive
```

Use `--environment production` only for an explicitly authorized release. Changes propagate through provider caches; allow propagation and refresh clients before verification. Integrated code and the [backend prerequisites](../README.md#development-and-deployment) must be deployed first. Releasing the child-link homepage demonstration requires both child and showcase flags.

For local development:

```sh
vercel env pull .env.local --environment development --non-interactive
npm run dev
```

The pull supplies local OIDC credentials and `FLAGS_SECRET`; Vercel deployments receive OIDC automatically. Keep `.env*.local` and `.vercel/` untracked. Monitor flag usage in Vercel: server renders, API calls, and polling can each request configuration. Consult current provider pricing instead of relying on old limits recorded in Git history.

## Verification and retirement

`npm test` covers enabled/disabled decisions, provider failures, and direct child API gates while retaining authentication and membership checks. `npm run build` checks server/client boundaries and dynamic rendering. For rollout verification, test the actual Development/Preview configuration and SDK-authorized disabled overrides; verify direct APIs, paused child entry, retained parent gameplay/data, and all combinations of dependent flags. Recheck the dashboard and deployed behavior before recording a Production state change.

After a feature is fully released and no longer needs its rollback switch, remove the temporary flag and dead branches and update this table. Keep detailed verification evidence in the PR or Git history.
