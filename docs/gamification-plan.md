# Gamification plan

Status: proposed product and scoring design, 2026-10-11. No application behavior has been changed.

## Product decision

Make two things immediately visible: effort earns XP, and family competition compares how much each player knows within their assigned skill range. Keep the current Multiply palette, rounded typography, and generous touch targets. Replace the expanded level catalog with visible progress and feedback at the moment of earning.

**XP is personal earned progress. Family rank is skill-range mastery percentage.** Do not rank family members by lifetime XP, total mastered facts, response speed, typing ability, age, or number of questions answered.

This separation is intentional. Unlimited points for every correct answer necessarily reward volume; those points cannot also be the measure of equal opportunity in family competition. The UI needs only two short labels: “XP” and “Mastered.”

## Evidence from the current product

The [supplied activity screenshot](design/gamification/current-activity.jpg) is the visual evidence for this review. The other findings below come from code inspection, not a captured live walkthrough.

1. Activity screen — needs improvement. Expanded “Levels and points” fills most of a mobile screen and pushes the activity choices below the fold. Eighteen milestones compete with the next action. A useful next-level progress indicator already exists, but the full catalog dominates when expanded.
2. Earning feedback — inconsistent in code. Practice says “No score,” although both practice and challenges contribute correct-answer XP and mastery. Rewards currently appear after saving a session rather than beside the answer.
3. Family standings — scoring needs correction. `familyStandings()` sorts total mastered facts, then XP. `playerProgress()` scans all 225 ordered facts regardless of a player's assigned range. A child assigned 25 facts and a child assigned 225 facts do not compete on equal terms.
4. XP — needs a durable earned total. Current XP is correct answers plus 25 times the number of *currently* mastered facts. When mastery drops, XP can drop; re-mastering can show another bonus. Reward totals can also disagree with the actual change in computed XP.
5. Identity — missing persistent XP in code. Player cards show level and mastered count; the header has only an initial avatar. Neither keeps XP beside the player's name throughout a session.
6. Scores — too many competing meanings in code. The leaderboard also shows personal-best challenge points and accuracy change; typed challenges receive a 25% score bonus. Avoid presenting these as additional family rankings.

Screenshot accessibility risks: small muted explanatory text and many similarly styled pills make scanning difficult. Contrast, keyboard access, screen-reader behavior, zoom, and reduced motion still need verification in the implemented flow. This is a screenshot review and code-based plan, not a full live accessibility audit.

## Fair family competition

For the first version, use the parent's assigned range as the comparison scope:

`mastery percentage = currently mastered assigned facts / all assigned facts × 100`

The initial scope is the existing ordered `maxTable × maxMultiplier` grid. Keep treating reversed multiplication facts as separate until the learning model is deliberately changed. Facts outside the assigned scope remain part of a player's learning history but do not increase family rank.

| Player | Assigned range | Mastered | Family score | Rank |
| --- | --- | --- | --- | --- |
| Joseph, age 7 | 1–5 × 1–5 | 20 / 25 | 80% | Joint 1st |
| Josiah, age 12 | 1–10 × 1–10 | 80 / 100 | 80% | Joint 1st |
| Ethan | 1–15 × 1–15 | 135 / 225 | 60% | 3rd |

Joseph and Josiah tie even if Josiah has four times as many mastered facts and substantially more XP. A larger question pool provides no ranking bonus.

Rules:

- Rank by the exact ratio, using cross multiplication to compare fractions; never use XP or total mastered facts to break a tie. Use stable name ordering only to lay out tied rows, without implying a winner.
- Display rounded percentages; when distinct ratios would display identically, expose one decimal or the fraction so the visible order makes sense. Exact equal ratios share a rank, with competition ranks such as 1, 1, 3.
- Use the same mastery evidence requirement for every player: at least five responses, at least 80% correct in the latest responses, up to ten. Preserve this rule initially; do not quietly weaken evidence for younger players.
- Session table selection and the “up to” slider must not change the leaderboard denominator. Selecting an easy table cannot turn a large assigned scope into a small one.
- Move skill-range editing behind a parent control. The current child-facing avatar opens a sheet that can edit the range; that cannot remain an unrestricted scoring control.
- Snapshot each player's assigned scope for a family competition period. Proposed default: one week in the family's configured timezone. The score is current mastery within that scope, including knowledge earned before the week; it is not “new facts this week.” Resetting the period does not wipe learning.
- Queue range changes for the next period. Show the parent the before/after percentage when scheduling a change. Keep history and XP. A child who advances must not appear to lose knowledge merely because the next scope grows.
- An empty or invalid scope has no rank. New players show “Getting started” until they have evidence; do not imply that no recorded evidence proves they know nothing. All players at 100% share the lead.
- Identify a range that is already comfortably mastered and prompt the parent to advance it. Do not automatically change a ranked scope mid-period.

Normalization removes the size advantage; it does not prove equally appropriate difficulty. Before declaring the system fair, check the actual seven- and twelve-year-old assignments. Use a short placement/review flow to suggest an appropriate range and confirm prior knowledge. Do not infer mastery merely from age or a parent's statement. Smaller scopes also produce larger percentage jumps; explain that to parents, rather than adding hidden age multipliers.

Keep the child-facing explanation to one line: **“Your tables. Same finish line.”** An optional parent/help view can show the 20/25 = 80/100 example.

## XP that is easy to earn and easy to trust

Keep the familiar rewards for the initial version:

- Correct answer in either activity: **+1 XP**.
- First time a fact is mastered: **+25 XP** once for that player and fact.
- Reviewing a mastered fact still earns answer XP. Re-mastering restores current mastery but does not pay the first-mastery bonus again.
- No XP deductions for wrong answers, lost mastery, missed days, or skill-range changes.
- No speed or typing multiplier in XP or family rank.

Example: eight correct answers and one newly mastered fact earn **33 XP**. The result shows `8 XP + 25 XP = 33 XP`, with a check icon for answers and a mastered-fact icon for the bonus. The 25 XP is included in the total, not presented as an extra amount to add again.

Do not add currencies, daily streak penalties, attendance requirements, or a badge collection in the first version. More questions can produce more personal XP, but cannot produce a family-ranking advantage unless they demonstrate mastery of the assigned scope.

The first correct answer should visibly earn something. Learning five facts currently requires at least 25 responses; waiting that long for the first reward is unnecessary. Show answer XP immediately and show progress for the next fact approaching mastery. Under the existing rule, “4/5 checks” is the number of observed responses, not necessarily four correct answers; use distinct response/evidence and accuracy information when displaying a detailed fact view.

## Screen and interaction plan

1. **Choose a player:** each avatar/name row includes a readable XP total. Keep editing separate from choosing the player. Use one compact family standings preview, not several score cards.
2. **Choose an activity:** use a persistent identity strip containing avatar, full name, and XP. Put Practice and Challenge near the top. Replace the large Journey panel with one compact mastery bar/ring and a single next target. Remove the full milestone list from this screen. Both activities use the same small XP reward cue; Practice must not say “No score.”
3. **Answer a question:** keep the identity strip visible. On a correct answer, show a brief `+1 XP` beside the feedback and a subtle transfer to the XP total. For a mistake, show the correct answer and a retry/practice action. Keep feedback controllable by the child, with a prominent Next button. Count only a scored first attempt; do not turn repeatedly pressing an answer into new rewards.
4. **Finish a round:** lead with XP earned, then the mastery change and next useful action. Show one or two newly mastered equations as the achievement itself. Example: `+33 XP`, `Mastered 3 × 4`, `76% → 80%`. A brief celebration can reinforce this; a badge grid is unnecessary. More detail stays behind a small disclosure.
5. **Family leaderboard:** use equal-length progress tracks for each player. Make mastery percentage the large right-aligned value. Put avatar, name, and personal XP together on the left. Show rank once. Make ties visually equal and highlight the active player with more than color alone. Keep skill ranges/fractions available by tapping a row; a parent view can show them by default.
6. **Parent progress:** show assigned scope, exact counts, placement evidence, facts needing review, and queued changes. Keep the algorithm explanation here. Preserve existing personal learning history and levels in a secondary view; levels do not determine family rank.

The [visual study](design/gamification/visual-study.md) compares three structures within the existing brand: aligned progress rows, a shared finish-line race, and an activity home with a compact leaderboard. They are planning mockups, not implemented screens. The aligned rows are the strongest default for readable names, equal treatment of ties, and families with more than three players.

Do not replace every word with an icon. Keep names, XP, percentages, essential actions, and accessible labels. Use graphics for amount, progress, rank, and change. Icon-only explanations still need discoverable accessible text.

## Implementation sequence

1. **Scoring and data contract:** split personal XP from scoped mastery; add immutable first-mastery rewards, a durable XP total/ledger, competition scope snapshots, and parent-only scope changes. Compute/save rewards atomically with sessions on the server, not from browser totals. Preserve idempotent retries and concurrent-family updates.
2. **Migration:** carry each player's currently displayed XP into an opening balance. Flag currently mastered facts as already rewarded. Historical sessions are capped at 200, so they cannot reliably reconstruct every past mastery transition; inspect available history before choosing any broader backfill. Document this limitation rather than silently resetting or inventing past awards.
3. **Identity and earning feedback:** update Shell and player rows; show answer reward previews while saving at existing session boundaries. Preview XP must be clearly pending until saved. On retry/reload, reconcile against the server award for that session ID; no double payment and no false saved reward. Handle concurrent sessions by taking the latest authoritative balance.
4. **Activity/results redesign:** compact progress, direct reward cues, reachable activity buttons, one total per round, specific mastered-fact celebrations. Retire the separate 100/125-point challenge presentation from the main flow; preserve old session history as historical information.
5. **Leaderboard and parent controls:** replace total-fact rankings, remove XP tiebreaks, implement ties and scope scheduling. Move personal-best/accuracy history to a player's details rather than separate family podiums.
6. **Verify with a family:** run a first-use session with both age groups, then compare equal percentages, a tie, an advance in scope, a lost/recovered mastery fact, and an interrupted save.

Likely change areas: `lib/progression.js`, `components/progression.jsx`, `components/multiply-app.jsx`, and a new Nhost migration for durable awards, scope snapshots, and authorization. Read the installed Next.js guides before implementation, as required by AGENTS.md. This plan does not modify those files.

## Acceptance checks

- 20/25 and 80/100 share rank, regardless of lifetime XP, typed answers, sessions played, or unrelated mastered facts.
- Solving more questions does not move a player ahead unless their assigned-scope mastery ratio improves.
- An easier session selection cannot shrink the denominator; a child cannot edit ranked scope from their avatar.
- A family can see why a seven-year-old and twelve-year-old tie without reading the algorithm.
- XP is beside avatar/name on player selection, activities, play, and results. Long names and large XP totals fit at 320px width.
- A correct answer visibly earns XP; Practice and Challenge have consistent reward cues.
- Eight correct answers plus one first mastery show 33 XP exactly once. Mastery loss never reduces XP, recovery never re-pays the bonus, and duplicate session saves never duplicate awards.
- Main activity choices remain visible in the initial mobile viewport without expanding a reward catalog.
- Empty, tied, unranked, 100% mastered, pending-save, and queued-scope states have clear presentations.
- Rank/progress remain understandable without color or animation; verify keyboard access, screen-reader announcements, readable contrast, text zoom, and reduced motion in the finished implementation.
- Ask each child to point to their XP, show how to earn more, identify the next activity, and explain who is ahead. Use failures to revise the interface rather than add a paragraph of instructions.

## Later, only if needed

If the family wants a fresh weekly contest based on performance rather than current mastery, introduce a separate, clearly labeled competition with identical scoring opportunities: the same number of calibrated questions and scored rounds for every player. Do not reuse unlimited lifetime XP as its score. Keep this out of the first release to avoid adding a third number before the core model is understood.
