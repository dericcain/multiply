# Multiply homepage review — October 12, 2026

## Executive summary

Three independent, read-only reviewers assessed copy, visual UX, and content architecture. A separate Judge read all three complete reports, challenged the evidence, and authorized five bounded improvement groups. Only those groups were implemented; the Judge accepted the final diff and focused verification.

The homepage's playful identity, visual product storytelling, section sequence, playable hero, and concise headlines work well. The meaningful opportunities were returning-parent navigation, keyboard continuity and focus visibility, one inaccurate illustrative mastery metric, and an identical full leaderboard repeated twice. No redesign or broad copy rewrite was warranted.

Scope: the current local repository homepage, not the deployed website. Initial review used the in-app browser on localhost:3000. Final verification used the same repository's production build on localhost:3002 to avoid stale development assets. No deployment, flag mutation, production account creation, or real family write occurred during this review.

## Review results

| Finding | Source agent | Severity | Judge verdict | Reason |
| --- | --- | --- | --- | --- |
| Mobile header hides Sign in | Visual V1 | Medium | APPROVE — P1 | Returning parents otherwise see signup or must scroll to the footer. Restore the existing task entry. |
| Hero loses keyboard focus when answering and advancing | Visual V2 | Medium | APPROVE — P1 | Confirmed BODY focus interrupts repeated keyboard play. |
| Final CTA focus indicator blends into purple | Visual V3 | Medium | APPROVE — P1 | A contrasting local focus treatment makes the selected action visible. |
| Identical full leaderboards; duplicate span leaves a desktop gap | Architecture A3-01 / Visual V4 | Medium / Low | APPROVE — P2 | One retained family dashboard communicates both ranking and monitoring; natural gallery reflow fixes the gap. |
| Child phone says “Table mastery · 4 of 6”; “No parent controls” is ambiguous | Copy C1 / C3 | Medium / Low | APPROVE — P2 | Use the real fact-mastery unit with a Builder-consistent ratio, and state that parent settings remain private. |
| Second home-screen tile | Architecture A3-02 | Low | DEFER | The actual app icon adds recognition; conditional layouts are disproportionate to this modest redundancy. |
| Remove “No round score. Just practice.” | Copy C2 | Medium proposed | REJECT | Practice stores a null competitive score; a correctness tally does not erase its genuine difference from Challenge. The original specification requests this distinction. |

## Changes implemented

1. **Visible mobile Sign in.** Retained `/login` in the header at 320px and above, with a 44px-high target. Reduced only mobile navigation gaps/CTA padding and hid the small CTA arrow where needed. Start playing and the logo remain visible, with no new menu or account-flow change.
2. **Continuous keyboard sample play.** Answer buttons retain stable identities and use `aria-disabled` with the existing one-answer lock. Already-answered choices leave the Tab order while the focused answer stays in place. Manual keyboard Next restores the first enabled answer; automatic advancement restores it only when the disappearing Next control still has focus. Visitors who move outside the demo are not pulled back, and pointer users do not receive a new keyboard focus jump.
3. **Contrasting final CTA focus.** Added an opaque light 3px outline with a 5px offset around the yellow button on purple, without changing its normal or hover appearance.
4. **One full family leaderboard.** Removed only the identical gallery standings card. Retained the complete family dashboard and moved the existing “Lifetime XP sets the rank. Mastery sets the level.” sentence beside it. All other gallery cards keep their source order; the review card now naturally fills the third desktop cell beside mastery and streaks. Shared sample data moved to the existing preview-parts module. At 375px, the measured page height fell from 9,754px to 9,129px, approximately 625px less scrolling.
5. **Accurate child-phone summary.** Changed the illustration to “Facts mastered · 20 of 60” with a one-third progress fill, consistent with Builder. Both Maya profiles retain 420 XP. Changed the reassurance to “Their profile. Your password and settings stay private.” No actual game or security behavior changed.

The review diff is limited to seven homepage files. Gameplay, authentication, legacy routing, PWA behavior, feature flags, and the shared real-game standings component were not changed by this review.

## Deferred and rejected findings

The home-screen tile remains, including when the independently flagged phone showcase is absent. This keeps installation coverage and the recognizable app icon without adding conditional layout logic. Practice/Challenge copy remains because the scoring distinction is supported by source and specification. No other headings, sections, reward explanations, installation claims, or CTA wording were changed.

## Focused verification

- `npm test`: **48 passed, 0 failed**. Includes existing routing, manifests, feature-flag failure defaults, API authorization, progression, and badge tests.
- `npm run build`: **passed**, including TypeScript and production route generation.
- Fresh in-app screenshots and DOM measurements at **320, 375, 768, and 1440px**: no horizontal overflow; header links fit; phone contents remain contained; one full leaderboard; corrected bar measures one-third; desktop gallery vacancy resolved.
- Keyboard Enter and Space checks: correct and incorrect feedback preserve a logical focused button; Tab reaches Next; manual Next and automatic Next restoration reach an enabled answer. Moving outside the demo during the delay preserves that outside focus.
- Pointer/duplicate activation: one correct answer awards one sample XP; a repeated activation while locked awards none. Automatic advancement retains the same answer-node position rather than making an unsolicited focus jump.
- Real Tab navigation to the final CTA: `:focus-visible` is true, outline is opaque light 3px, offset 5px; saved screenshot visibly confirms the ring.
- Restored mobile Sign in opened the normal `/login` form; See how it works retained its anchor. No authentication was submitted.
- All thirteen requested capability categories remain represented: game modes, answer methods, assigned ranges, durations, XP, mastery/levels, varied-fact streaks, ranking, review facts, multiple players, shared parents, child links, and the installable web app. Deferred installation fallback and rejected Practice score wording remain intact.
- The Judge inspected the final seven-file diff, responsive screenshots, focus evidence, and source, and **accepted the implementation with no remaining approved-scope repairs**.

### Flow steps and health

| Step | Surface | Final health |
| --- | --- | --- |
| 1 | Header and playable hero | Healthy after navigation and keyboard fixes |
| 2 | Three-step introduction | Healthy; unchanged |
| 3 | Independent child practice links | Healthy after localized accuracy/clarity fixes |
| 4 | Feature gallery | Healthy; duplicate removed and natural desktop placement verified |
| 5 | Family and progress | Healthy; full ranking retained with its XP/mastery explanation |
| 6 | Final CTA | Healthy after focus-visibility fix |
| 7 | Footer | Healthy; unchanged |

## Evidence

Current-run reports and captured images are stored in [the audit folder](/Users/dericcain/.codex/visualizations/2026/10/12/01a13287-0dcc-7613-b396-88c15d153e11/homepage-review).

- [Copy review](/Users/dericcain/.codex/visualizations/2026/10/12/01a13287-0dcc-7613-b396-88c15d153e11/homepage-review/agent-1-copy.md)
- [Visual review](/Users/dericcain/.codex/visualizations/2026/10/12/01a13287-0dcc-7613-b396-88c15d153e11/homepage-review/agent-2-visual.md)
- [Architecture review](/Users/dericcain/.codex/visualizations/2026/10/12/01a13287-0dcc-7613-b396-88c15d153e11/homepage-review/agent-3-architecture.md)
- [Judge decisions](/Users/dericcain/.codex/visualizations/2026/10/12/01a13287-0dcc-7613-b396-88c15d153e11/homepage-review/judge-decisions.md)
- [Judge final verification](/Users/dericcain/.codex/visualizations/2026/10/12/01a13287-0dcc-7613-b396-88c15d153e11/homepage-review/judge-final-verification.md)
- [Review-only diff](/Users/dericcain/.codex/visualizations/2026/10/12/01a13287-0dcc-7613-b396-88c15d153e11/homepage-review/approved-changes.diff)

**Mobile navigation after the fix:**

![Mobile header with Sign in and Start playing](/Users/dericcain/.codex/visualizations/2026/10/12/01a13287-0dcc-7613-b396-88c15d153e11/homepage-review/after-320-header.png)

**Final CTA during keyboard focus:**

![Yellow CTA with a contrasting white focus ring](/Users/dericcain/.codex/visualizations/2026/10/12/01a13287-0dcc-7613-b396-88c15d153e11/homepage-review/after-375-final-focus.png)

## Limits

This is not a production review, measured conversion study, full WCAG certification, screen-reader session, touch-device test, or actual PWA installation test. Reduced-motion rules were inspected and preserved; the supported in-app audit surface did not provide media emulation for a fresh rendered reduced-motion test. The final Judge review is focused verification, not another unrestricted audit. An early development reload mixed stale client assets with updated SSR content; those captures were replaced by production-build evidence before acceptance. No production flags were changed.
