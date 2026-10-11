# Shared parent access

Each login keeps an owned family. Joining an invitation adds access to another family; it never moves or combines the accepting parent's existing players. Owners can create or cancel seven-day email-bound invitations and remove invited parents. Both parents can edit players and record games. The invitation recipient must sign in with the verified email named in the invitation. Invitations are shared manually using a link; the app does not send invitation emails.

## Deploy

The migration and Hasura metadata must be applied before deploying the frontend.

1. Export the production database and Hasura metadata as a recovery backup. Pause gameplay during the rollout and require already-open browsers to refresh when complete. Old clients write entire `multiply_profiles` documents; those writes must stop before copying profiles. Applying the new metadata disables their writes, so old tabs must not continue playing during this transition.
2. Apply `nhost/migrations/default/20261011000000_shared_families/up.sql` through the normal Nhost migration workflow. The migration copies every complete legacy profile JSON without trimming history or rebuilding cumulative stats. Legacy profile rows remain intact for recovery.
3. Set `HASURA_METADATA_URL` to the project's Hasura endpoint ending in `/v1/metadata`, and set `HASURA_GRAPHQL_ADMIN_SECRET` in the deployment environment. Run `node scripts/apply-family-metadata.mjs`. This exports current metadata, adds the family RPC and its empty return table, and removes the `user` role's legacy profile writes. It preserves the existing Nhost auth/storage tables, sources, relationships, and unrelated permissions. Concurrent metadata edits cause the apply to fail rather than overwrite them.
4. Deploy the new frontend, resume gameplay, and refresh existing clients. Verify using two distinct accounts: invite, accept with the verified email, start games on both devices, edit a player, switch families, remove the invited parent, and confirm access is revoked while history remains.

The repository previously contained only a profile metadata fragment, without a complete Nhost metadata export. **Do not apply the repository fragments as a wholesale metadata replacement.** Use the merge script or merge these fragments into a fresh project metadata export. No role receives direct write access to family tables. The result table is physically empty and has an always-false insertion constraint; returned RPC rows are filtered to the authenticated caller.

Rollback is deliberately blocked once family data differs from legacy profiles or an invited member exists. Restore/reconcile from a backup instead of silently dropping games or shared access. Untrack the family function and result table before applying `down.sql`, and restore the backed-up profile write permissions only when returning to the old frontend.

## Persistence

`multiply_family_action` is a tracked Hasura mutation with an injected session argument. Every operation checks membership and locks the family row before changing players, games, invitations, or membership. A player save updates one player only. A completed game appends one session and increments its individual fact counters on the server; it cannot overwrite the other parent's snapshot. The server derives accuracy and score from the submitted answers. Expected permission and validation failures return a caller-filtered error envelope so their messages remain usable with Hasura developer mode disabled; the client turns these into typed errors. Failed operations roll back before producing that envelope.

Game IDs are idempotency keys. The receipt table retains them even after a game leaves the 200-session display history, preventing delayed retries from double-counting cumulative progress. Receipt storage therefore grows with completed games; no pruning is currently performed.

Invitation secrets contain two independently generated random UUIDs and are returned only once. The database stores their SHA-256 hashes. A replacement invitation revokes the previous link for that email. Accepted, canceled, expired, or revoked links cannot grant access again. Removing a member also revokes unaccepted invitations for their email.

The browser keeps only account-scoped family selection and completed games awaiting a save. Each pending game has its own user/family/game key, so simultaneous tabs cannot overwrite each other's retries. Loading a family restores pending games, and a successful save removes only the acknowledged game. No cached profile is loaded or written back as authoritative data. Internet access is required to load a family; an already-completed game's pending results can survive reload until the connection returns.

## Verify locally

With a local PostgreSQL 18 Docker container available:

```sh
PG_CONTAINER=multiply-family-pg node tests/run-family-database.mjs
npm test
npm run test:api
```

The database runner creates and removes its own disposable database; it does not touch application fixtures. Its SQL assertions cover exact migration, new-user defaults, member isolation, owner-only management, email verification, replacement/canceled/expired invitations, retained original families, independent player writes, idempotent retries beyond the history cap, cumulative stats, and immediate access removal.

`npm test` checks metadata preservation and per-game outbox recovery across tabs, accounts, and families. `npm run test:api` creates its own disposable PostgreSQL 18 and Hasura 2.48.10 containers and network, then removes them. Docker must be running; the images must be available or downloadable. It verifies real JWT identity injection, restricted GraphQL schema, ten simultaneous game writes, concurrent player additions, invitation acceptance, original-family preservation, duplicate retries, and revoked access. Hasura development mode is disabled to verify that expected errors work without internal database diagnostics.

For a disposable local auth/Hasura environment the client supports optional `NEXT_PUBLIC_NHOST_AUTH_URL` and `NEXT_PUBLIC_NHOST_GRAPHQL_URL` overrides. Production uses the configured Nhost subdomain and region as before. Public environment values must be set before building Next.js.

Local browser verification covered owner-created links, accepting as a second parent, viewing shared players, a failed game save followed by reload and retry, cross-parent visibility of the recovered game exactly once, access removal, and recovery of the invited parent's original family. These checks used a seeded local authentication fixture with real PostgreSQL and Hasura.

## Production rollout — October 10, 2026

The migration and merged metadata are applied to the linked Nhost project, and the frontend is live at [Multiply](https://multiply-five-indol.vercel.app). Vercel deployment `dpl_2R3KtHpnNk12LebC528sHAcjzzz1` was built as a staged production deployment and promoted after backend checks. Refresh any already-open app tabs before playing.

Database, profile, metadata, and catalog-state recovery backups are stored locally in `/Users/dericcain/.codex/backups/multiply/2026-10-10-shared-families` with restricted filesystem permissions. Hasura reports consistent metadata. Migration `20261011000000` is recorded as applied and clean in its CLI catalog state. Production Nhost uses `auth.users.email_verified`; the migration and integration fixtures use that database column.

Two temporary accounts signed in through real Nhost authentication. Live browser checks exercised creating and accepting an invitation, viewing shared players, completing and saving practice, and owner removal. Live API checks verified ten concurrent game writes, duplicate retry idempotence, concurrent player edits, owner-only invitations, retained original families, canceled/reused invitation rejection, and blocked reads/writes after removal. Temporary accounts and their data were removed afterward. Invitation links remain manually shared; email delivery was not exercised.

Function configuration and metadata merge behavior follow the official [Hasura function reference](https://hasura.io/docs/2.0/api-reference/syntax-defs/#function-configuration) and [metadata format](https://hasura.io/docs/2.0/migrations-metadata-seeds/metadata-format/).
