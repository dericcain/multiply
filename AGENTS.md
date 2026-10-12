<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Feature flags

- Put new user-facing features behind a named Vercel feature flag unless the user explicitly requests an immediate unconditional release. Routine bug fixes and refactors that preserve existing behavior do not need new flags.
- Declare flags centrally in `lib/flags.ts` using the Flags SDK and Vercel adapter. Use descriptive kebab-case keys, a description, and `defaultValue: false`; missing configuration or provider errors must leave unreleased features disabled.
- Register flags on the linked Multiply Vercel project. Default Production to off; enable Development/Preview for verification. Do not enable Production without the user's explicit release instruction.
- Evaluate flags on the server at request time. Pass evaluated booleans through `FeatureFlagsProvider`; do not expose provider credentials or implement browser/localStorage/query-string bypasses. Only the SDK’s signed, authorized Flags Explorer overrides are acceptable for preview testing.
- Gate both the feature's UI/entry points and every app API route that implements it, including secondary flows such as player manifests. A disabled feature must not call its backing service or perform writes. Preserve existing data when a flag is disabled.
- Flags control rollout, not authorization: retain all account, family membership, and player-token checks. If a backing service can be called directly, document its flag boundary and do not imply that a UI/app flag revokes backend access.
- Verify enabled, disabled, and provider-failure behavior, including direct API requests. Document the flag key, defaults, how to toggle it, and any rollout dependencies in `docs/feature-flags.md`.
- Remove temporary release flags and their dead branches after the feature is fully released and no longer needs a rollback switch.
