# Mastery badge integration

The five badges belong alongside mastery, separate from lifetime XP ranking:

- Player selection: a 64px badge on the right of each existing colorful player button.
- Activity and results: a 100px badge in a lavender spotlight above the existing mastery bar, with the current name and next-level goal. Math Genius gets a gold-tinted spotlight.
- Badge shelf: a keyboard-accessible native details control reveals the five badges, current highlight, and labeled future thresholds. It starts collapsed so practice remains easy to reach.
- Family standings: 48px badges sit between rank and player name, using exactly the same mastery calculation in parent and child views.

## Existing players

Saved mastery immediately recognizes the current badge and all levels below it. Starter is available to every player, including players with no recorded mastery. This derives from existing `playerProgress` and `rankStandings` calculations; it adds no database records or XP and does not reconstruct mastery from lifetime XP. Existing evidence requirements and assigned-table scope remain authoritative. As with current levels, unlocked badges can change when mastery or scope changes; permanent retained achievements would need a separate server ledger and explicit earning rules.

## Verification

A disposable local PostgreSQL/Hasura environment supplied five players with existing saved histories corresponding to Starter, Explorer, Builder, Expert, and Math Genius. Browser checks used actual app components and the server-evaluated Development flag, with an SDK-signed off override for disabled checks. No fixture or flag bypass is added to the product.

- Historical player cards showed the correct badges without playing.
- The expanded Expert shelf showed four unlocked levels and a locked Math Genius.
- No horizontal overflow at 320, 390, or 768px.
- Child load API returned one playable player and family summaries; all five standings badges appeared without sharing other players’ histories.
- A child practice round saved through the existing API and the result screen displayed the saved Expert badge.
- Disabled badge rollout hid every badge image and shelf, retained the existing level heading, and preserved gameplay.
- Unit suite: 48 passed, including enabled/disabled flag evaluation and provider failure.
- Production build passed with request-time flag evaluation on `/play`.

[Player selection](player-selection.png) · [In-game badge shelf](in-game.png)

Flag: `mastery-badges`. Development/Preview on, Production off, default/provider failure off. No new APIs or migrations. See [feature flag operations](../../feature-flags.md#mastery-badges).
