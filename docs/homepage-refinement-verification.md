# Homepage refinement verification

October 13, 2026 · Scope: public homepage presentation, existing flags, and rollout documentation. No production deployment or flag changes were made.

## Implemented

- **HP-01:** Mobile uses readable sequential frames: Parent shares → Child opens → Plays. The parent frame is compact; the child gets a larger phone. Tablet/desktop retain two phones. The presentation is static, with no timed reveal, hidden waiting screen, replay control, or fake tappable controls.
- **HP-02:** Parent context is Settings → Kids’ practice links. The child preview uses Choose an activity, player identity/XP, mastery above Practice/Challenge, and Family leaderboard. These labels and hierarchy were checked against the implemented settings and activity screens. Screens remain illustrative, with fictional sample data. Link privacy, revocation, saved progress, and internet requirements remain explicit.
- **HP-03:** Nine gallery cards become four complementary groups: answers/typed bonus, tables/range/timer, mastery/XP/streaks, and round review. Practice versus Challenge stays in the three-step introduction. Parent tiles focus on individual assignments and parent sharing; saved progress is represented in the prominent family dashboard. Installation appears once in the family section.
- **HP-04:** The server requires both `practice-link-showcase` and `child-practice-links` before rendering the handoff. The flags retain their separate application/API boundaries and default-off fallback. No backend operations or authorization changed.
- **HP-05/06:** Removed the five proposed decorative slogans and additional redundant eyebrows. Essential preview copy and disclaimers use at least 12px; phone copy uses 12–19px. Tiny status-bar text is decorative and hidden from assistive technology. Existing headings, signup/sign-in paths, and sample disclaimers remain.
- **HP-07:** Reused the existing Builder badge through `MasteryBadge`, under the existing provider boolean. The sample is 25/100 facts, which matches Builder’s 25% threshold. Numeric mastery remains when badges are disabled; the dashboard explicitly separates XP rank from mastery level.

The animated handoff was replaced by an always-complete story because readable static frames satisfy the workflow without waiting. No new marketing section, dependency, API, gameplay feature, or temporary release flag was added. These changes refine existing behavior; rollout remains under the existing feature flags.

## Live availability

Authorized `vercel project inspect` confirmed the linked Multiply project. `vercel flags inspect` found:

| Flag | Development | Preview | Production |
| --- | --- | --- | --- |
| landing-page | On | On | On |
| practice-link-showcase | On | On | Off |
| child-practice-links | On | On | Off |
| mastery-badges | On | On | On |

The live public page omitted the child-link showcase. A direct deployed practice load request with a nonsensitive dummy token returned `503 FEATURE_DISABLED`. The active child workflow cannot be verified on Production while paused; no family links or game sessions were created. Fidelity is based on the current integrated app source, not an authenticated walkthrough of an enabled production child account. The released public family dashboard displayed the existing badge artwork.

## Responsive evidence

Chromium viewport height: 900px. Full-page captures before and after. The all-enabled comparison uses the same Development flags; the final capture uses `next start` after the production build. The live-production comparison uses the verified Production booleans through SDK-signed authorized overrides on the local production build.

| Width | Before, all enabled | After, all enabled | Live production before | After, Production flags |
| --- | ---: | ---: | ---: | ---: |
| 320 | 9,700 | 8,444 | 8,186 | 6,971 |
| 375 | 9,130 | 8,035 | 7,670 | 6,580 |
| 390 | 9,052 | 7,970 | 7,592 | 6,515 |
| 768 | 6,149 | 5,627 | 5,213 | 4,552 |
| 1440 | 5,986 | 5,208 | 4,929 | 4,456 |

At 375px, the complete page is approximately 12% shorter with the showcase enabled, and 14% shorter with Production flags. The practice section retains similar height while replacing the two narrow phones and repeated benefits with larger readable frames. This is a layout measurement, not conversion evidence.

Evidence is in `output/playwright/` (local, untracked):

- `local-before-{width}.png`: all-enabled baseline.
- `home-before-{width}.png`: live production baseline.
- `build-all-enabled-{width}.png` and `build-production-flags-{width}.png`: final production-build captures.
- `practice-before-375.png`, `practice-after-375.png`, `practice-after-768.png`, `practice-after-1440.png`: handoff detail comparisons.
- `features-after-375.png`, `features-after-1440.png`, `family-after-320.png`: key sections inspected visually.
- `practice-reduced-320.png`, `practice-static-320.png`, `home-zoom-200.png`: accessibility/layout checks.

No horizontal overflow was detected at any required width. Phone content remained inside its frames. Narrow/mobile, tablet, desktop, gallery, and leaderboard captures were visually inspected.

## Behavior and checks

- `npm test`: **48 passed**, including provider enabled/disabled/failure decisions, direct API gates, authorization, invitation/child compatibility, and PWA manifest/entry behavior.
- `npm run build`: passed compilation and TypeScript checks; request-time homepage and app routes remain dynamic.
- Browser signed overrides checked all four showcase/child combinations; only both On shows the section. `mastery-badges` Off removes homepage artwork and preserves numerical progress.
- Hero keyboard answers: correct feedback, rapid repeated Enter awards only one sample XP; incorrect feedback awards no XP. Next question restores focus to the first answer. Reload resets sample XP to 120; localStorage is unchanged and no game API/Nhost requests occur.
- Start playing remains `/play?signup=1`, Sign in remains `/login`, and the How it works anchor remains available. Routing/manifest unit checks preserve legacy child and invitation links and installed-app launch behavior.
- Reduced-motion at 320px has zero animations and the completed story. A JavaScript-disabled production-build context renders both sample frames and Choose an activity.
- A 200% CSS zoom simulation at 1440px had no horizontal overflow. This is not native browser zoom or real-device accessibility text scaling.
- React checklist reviewed server/client boundaries, hook removal from the static handoff, existing badge gating, semantic headings, focus paths, illustrative controls, and sample asset alt text. No new client data fetches.
- `git diff --check`: clean.

## Limits

No physical-device test, native text-scaling test, conversion study, authenticated enabled Production child walkthrough, or real-family write was performed. Existing app/authorization/PWA source is unchanged. The development Vercel Toolbar produced an events-endpoint error before the edits; production-build verification has no Toolbar. Visual QA used Chromium and equivalent local production rendering, not a newly deployed preview.
