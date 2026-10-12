# Answer countdown and varied-fact streaks

Practice and challenge feedback use the same five-second countdown. The Next question button fills from left to right and advances automatically; the final challenge answer opens results and saves the round. Players can advance immediately or pause/resume the countdown. Hidden tabs pause the countdown and fill. Reduced-motion preferences use five discrete fill steps. This timer reviews an already-submitted answer; it does not limit thinking time or change XP based on speed.

A badge appears at five different correct multiplication facts without a mistake. Further new facts grow the run. Correct repeats preserve the run but do not increase it, including reversed equations such as 3×4 and 4×3. A mistake clears the current run but preserves the personal best. Repeating the same five problems across rounds cannot inflate the count. To grow a streak after finishing one table, practice another table. A run can contain at most the 120 unordered facts in the supported 1–15 multiplication grid.

The current and best streak persist per player across saved practice and challenge rounds, across parent devices, and through child links. During play, the badge previews the run and marks answered progress as pending until the server saves it. Streak tracking starts with future saved rounds; historical session order is not used to invent achievements. Failed completed saves use the existing outbox and can be retried without replaying streak changes. Concurrent rounds are processed in server save order, rather than guessing the order of individual answers on different devices.

Streaks do not add XP bonuses in this version. Correct-answer XP and first-mastery XP remain unchanged, and family ranks still measure assigned-range mastery. Recognition rewards varied practice without creating an additional incentive to farm a small problem set.

## Deployment

Migration `nhost/migrations/default/20261012000000_varied_fact_streaks/up.sql` adds a private streak ledger and records streaks only when the existing family RPC appends a validated, receipted game. The parent snapshot returns saved streaks; the child snapshot includes only the linked player's streak. No new GraphQL permissions or frontend secrets are needed. Nhost's connected GitHub deployment applies the migration automatically when these changes reach its deployment branch.

The rollback restores the previous snapshot functions and removes the trigger and empty ledger. It refuses to discard recorded streak achievements; preserve or reconcile those before rolling back after gameplay.

## Verification

`npm test` checks varied facts, repeat and reversal handling, mistake resets, personal-best preservation, and progression across rounds. Database and Hasura integration checks cover authoritative updates, unchanged XP, late retry protection, parent visibility, private child snapshots, and settings preservation. Build verification uses `npm run build -- --webpack` because this workspace's Turbopack build cannot bind its internal worker port.

Local Chromium verification covered the five-second challenge countdown, left-to-right button fill, pause/resume, hidden-tab pause, final-answer auto-save, practice auto-advance, the five-fact badge, repeat protection, saved best after a mistake, failed-save recovery after reload, and layout at 320px without horizontal overflow. The recovery check completed without page errors.
