# Multiply! Homepage Refinement Specification

**Status:** Proposed — ready for implementation after verifying live presentation  
**Prepared:** October 13, 2026 (CDT)  
**Product:** [Multiply!](https://playmultiply.com)  
**Repository:** [dericcain/multiply](https://github.com/dericcain/multiply)  
**Baseline reviewed:** Production deployment associated with commit `1c8b9ec3e9048db5fd72d83d46ca085205238db3`  
**Scope:** Public landing page only; retain gameplay, authentication, child access, and PWA behavior

## 1. Objective

Refine the existing Multiply! homepage so parents understand the product **faster, with less reading and fewer repeated demonstrations**, while preserving its colorful, playful aesthetic.

**Guiding principle: _Show, don't explain._**

This is a targeted quality pass, **not a redesign**. Retain the current design system, interactive hero, core section narrative, family leaderboard, and clear signup calls to action (CTAs). Do not add new marketing sections, dependencies, or backend functionality solely to support the refinements.

### Desired outcomes

- Clear, legible product demonstrations on narrow mobile screens.
- Homepage previews that accurately represent where real application controls live and what children actually see.
- Less redundant content and shorter scrolling without sacrificing meaningful feature coverage.
- Tighter copy that communicates product benefits rather than decorating them.
- A richer, **truthful** visual portrayal of mastery badges when that feature is publicly available.
- Consistent claims about what is actually enabled in production.

## 2. Evidence and verification boundaries

The audit compared the live production deployment's Git commit to the source for the landing page, practice-link showcase, application flows, feature flags, and CSS. **The live page was not freshly rendered and visually inspected during that audit.** Prior repository documentation records responsive browser tests and a ~9,129px mobile page height at 375px width after an earlier deduplication pass.

Therefore:

- Treat code-visible issues (e.g., 8–10px phone-mockup labels and repeated feature depictions) as grounded findings.
- Treat the **actual severity of mobile legibility, visual balance, animation timing, and scrolling burden** as hypotheses until confirmed in a live browser or an equivalent production build.
- Do not claim a change improves conversion without user evidence or metrics.
- Preserve an option to reject a proposed change if real-device verification shows no improvement.

### Source files to inspect first

- `components/landing/landing-page.tsx`
- `components/landing/landing.module.css`
- `components/landing/interactive-demo.tsx`
- `components/landing/how-it-works.tsx`
- `components/landing/feature-showcase.tsx`
- `components/landing/family-showcase.tsx`
- `components/landing/preview-parts.tsx`
- `components/practice-link-showcase.tsx`
- `components/practice-link-showcase.module.css`
- `components/mastery-badge.jsx` and `public/badges/*.svg`
- `lib/flags.ts`, `docs/feature-flags.md`
- Actual app settings, player selection, activity, and child-link flows in `components/multiply-app.jsx`, `components/family-settings.jsx`, and `components/practice-links.jsx`

## 3. Priority summary

| ID | Priority | Change | Evidence / status |
| --- | --- | --- | --- |
| HP-01 | P1 | Make the practice-link demonstration readable and understandable on narrow mobile screens | Source-backed; compare live variants |
| HP-02 | P1 | Align parent and child showcase screens with actual app workflows | Source-backed mismatch |
| HP-03 | P1 | Consolidate repeated feature demonstrations and shorten mobile scrolling | Source-backed repetition; measured baseline from previous local review |
| HP-04 | P1 verification | Confirm showcase and child practice capability cannot be misleadingly out of sync in Production | Separate feature flags; live values not independently verified |
| HP-05 | P2 | Remove decorative, low-information copy | Source-backed; editorial decision |
| HP-06 | P2 | Improve legibility of small labels and disclaimers | CSS-backed risk; visually verify |
| HP-07 | P2 conditional | Show actual mastery badge artwork instead of a text-only level sequence | Artwork exists; production availability must be confirmed |

**Implementation sequence:** Verify actual production states → HP-01/HP-02 → HP-03 → HP-04 → HP-05/HP-06 → HP-07 → regression verification.

---

## 4. HP-01 — Mobile practice-link demonstration

**Priority:** P1  
**Target:** `components/practice-link-showcase.tsx` and `.module.css`

### Problem

The current two-phone mockup keeps both phones side by side on very narrow screens. Labels within the mockups are frequently around 8–10px, and the section contains considerable vertical space. Prior testing established no horizontal overflow, but that does **not** establish readability or comprehension.

### Requirements

1. On desktop/tablet, retain the visually compelling two-device storytelling when space permits.
2. At mobile widths where side-by-side phones become too small to read, use a **larger, sequential demonstration**. Preferred flow: **Parent shares → Child opens → Child plays**.
3. The sequential presentation may use one larger phone with two states, a staged transition, or vertically arranged readable frames. Choose based on actual browser testing; avoid introducing a cumbersome carousel merely to fit the concept.
4. Ensure a static state communicates the workflow without animation, scrolling tricks, or JavaScript-dependent timing.
5. If animated, provide replay; make transitions brief, purposeful, and compatible with `prefers-reduced-motion`.
6. Use readable in-device labels where labels are necessary. Remove decorative microcopy rather than shrinking it further.
7. Preserve sample-data labeling and privacy assurances without cluttering the phones.
8. Do not add fake tappable controls. Decorative controls should look like illustrative UI and must not mislead visitors into believing they are usable.

### Acceptance criteria

- At 320px, 375px, and 390px, a visitor can identify who is sharing, what is shared, and what the child opens **without pinch zoom**.
- No phone content is clipped or spills out of its frame.
- No horizontal page overflow.
- Reduced-motion users see the completed, understandable demonstration.
- The mobile version avoids unnecessary scrolling relative to the existing two-phone treatment, subject to visual quality.
- A reviewer can articulate the flow as **Share → Open → Play** after a glance.

## 5. HP-02 — Match showcase previews to the real app

**Priority:** P1  
**Target:** `components/practice-link-showcase.tsx` plus any extracted display-only preview components

### Problem

The parent mockup currently suggests that **Share practice link** is directly available from the player profile, while the implemented flow is managed through **Settings → Kids' practice links**. The child mockup also presents a custom welcome-screen composition that differs from the actual activity screen.

### Requirements

1. Verify current production flows before editing, since the product is actively changing.
2. Show a recognizable **Settings → Kids' practice links** context for the parent's share action, or otherwise clearly avoid implying a nonexistent shortcut.
3. Show a child activity screen that closely matches the real interface's structure, labels, and control hierarchy (including Practice and Challenge, player identity, and available progress information).
4. Reuse current app tokens/components where reasonable; presentation-only replicas are acceptable if faithfully representative and clearly non-interactive.
5. Keep sensitive information out of previews; use fictional players, illustrative XP, and nonsensitive sample links.
6. Do not claim kids can access parent settings. Make the access boundary clear using one concise phrase if needed.
7. Do not move any real app controls as part of this homepage-only refinement.

### Acceptance criteria

- A visitor following the pictured workflow can find the corresponding action in the live app.
- The child preview resembles the app's actual activity experience rather than introducing a separate imagined screen.
- Parent authorization and child access claims are accurate.
- No new game functionality is implemented.

## 6. HP-03 — Deduplicate information and reduce page length

**Priority:** P1  
**Targets:** `landing-page.tsx`, `how-it-works.tsx`, `feature-showcase.tsx`, `family-showcase.tsx`, `practice-link-showcase.tsx`

### Problem

Several capabilities are demonstrated multiple times without consistently adding a new perspective:

| Concept | Current placements | Editorial direction |
| --- | --- | --- |
| Practice / Challenge | How It Works, feature gallery, child phone | Keep a compact overview in How It Works; detailed distinction only where it adds information |
| XP / mastery progress | Hero, How It Works, features, family dashboard | Keep reward feedback in hero, learning payoff in How It Works, and authoritative family context in dashboard; remove duplicate explanations |
| Multiple players | How It Works, family section | Keep selection in How It Works; family section should show parental overview and multi-player management, not repeat the same profiles gratuitously |
| Home Screen access | Practice-link phone, practice-link benefits, family tile | Keep one meaningful installation explanation/visual and avoid repeated claims |

### Recommended information architecture

Retain the current narrative and major sections, but tighten their interior content:

1. **Hero — Play a question:** preserve the interactive demo and primary CTA.
2. **How It Works:** Pick player → Practice or Challenge → Earn progress. Three steps, minimal explanatory copy.
3. **Own Practice Link:** dedicated parent-to-child handoff example.
4. **Feature Gallery:** group complementary features instead of dedicating a large card to every minor detail. Candidate groups:
   - **Answers:** multiple-choice, typing, and qualified typed-challenge bonus.
   - **Flexible Practice:** selected times tables, multiplier range, optional timer.
   - **Growth:** XP, mastery, levels/badges, varied-fact streaks.
   - **Review:** round results and multiplication facts to practice next.
5. **Family Progress:** real leaderboard, assigned ranges, saved progress, multiple players and parent sharing—without repeating detailed reward mechanics.
6. **Final CTA:** preserve the conversion action.

**This is a recommendation, not a mandate to eliminate all standalone cards.** Preserve an individual visual when grouping would make the card dense or hide an important capability. Intentional repetition across different user perspectives is acceptable.

### Acceptance criteria

- Every core product capability represented before the edit remains identifiable afterward.
- A feature receives a second visual explanation **only if it adds a genuinely different user benefit or perspective**.
- The mobile page is meaningfully shorter or easier to scan, as supported by before/after captures and measurements.
- The feature gallery is not replaced by a dense wall of text.
- The family leaderboard remains a meaningful, visually prominent part of the page.
- All Start playing and Sign in paths remain easy to find.

### Explicitly preserve

- Interactive hero demo and sample-only XP behavior.
- Three-step introduction.
- Major child practice-link showcase.
- Full family dashboard/leaderboard.
- Primary CTA near the top and another near the bottom.

## 7. HP-04 — Production flag / claims consistency

**Priority:** P1 — verification before UI changes  
**Targets:** `lib/flags.ts`, homepage section gating, current Vercel Production configuration

### Problem

The `practice-link-showcase` flag and `child-practice-links` application flag are independent. A homepage can therefore potentially advertise child access that is disabled or paused in the game.

### Requirements

1. Read the actual live Production values of `landing-page`, `practice-link-showcase`, `child-practice-links`, and (for HP-07) `mastery-badges` using authorized tooling.
2. Verify the child-link workflow in the **deployed** application, not solely from docs or desired rollout state.
3. If the practice-link showcase is visible while child practice is unavailable, remove the misleading claim or adjust presentation gating so the public page reflects actual availability.
4. Preserve independent Preview testing and the project's existing feature-flag policy; do not blindly couple unrelated backend operations to a landing-page flag.
5. **Do not enable or disable Production flags without explicit release approval.** Report inconsistencies and propose safe conditional behavior instead.
6. If live flag inspection is denied, record that limitation and request manual confirmation rather than guessing.

### Acceptance criteria

- Visitors are not offered an unavailable child practice flow as though it were generally enabled.
- Existing `/#play=…` and `/?invite=…` compatibility, `/play`, `/login`, and PWA launch behavior remain unchanged.
- Feature rollout states and implementation behavior are documented accurately.

## 8. HP-05 — Remove decorative copy that adds no information

**Priority:** P2  
**Target:** `components/landing/landing-page.tsx` and section components

### Candidates for removal

| Current wording | Recommendation |
| --- | --- |
| “A little practice. A lot of possibility.” | Remove from hero unless visual tests show it establishes necessary context |
| “Their pace. Their progress. Their next big win.” | Remove; hero subtitle already communicates the value |
| “Small steps. Big smiles.” | Remove; three steps explain themselves |
| “A game with growing room.” | Remove; feature heading is sufficient |
| “Let the next adventure begin.” | Remove; final CTA carries the action |

Retain strong functional text such as:

- **“Times tables. Game on.”**
- **“Fun multiplication practice for kids. Progress parents can see.”**
- **“Ready. Set. Multiply!”**
- **“Just tap and play.”**
- **“Big fun. Real progress.”**
- **“Made for kids. Helpful for parents.”**
- **“Ready to multiply?”**

### Requirements

- Audit remaining subtitles, footnotes, instructional labels, and sample disclaimers.
- Keep copy that prevents misunderstanding (for example, sample progress isn't real progress, or no parent login is needed for a child link).
- Do not blindly remove section labels that contribute to navigation or semantic context.
- Do not replace removed phrases with different decorative phrases.
- Favor showing the actual UI rather than adding new explanatory text.

### Acceptance criteria

- Core functionality and parent benefits remain clear.
- No repeated slogan merely restates the next heading.
- All actionable controls retain clear names, accessible labels, and context.

## 9. HP-06 — Improve small-label readability

**Priority:** P2  
**Targets:** `landing.module.css`, `practice-link-showcase.module.css`, preview components

### Problem

Several sample UI and disclaimer labels use very small text (often ~8–11px). This may make feature previews difficult to read on phones, especially when they contain essential information.

### Requirements

1. Identify which labels carry information a parent actually needs.
2. Increase the legibility of essential labels with responsive typography or larger layouts; remove nonessential labels where space is tight.
3. Reserve very small type for genuinely decorative detail only, not instructions or important claims.
4. Keep visual hierarchy clear between real content, sample status, and decoration.
5. Validate color contrast and content legibility against the actual rendered backgrounds.

### Acceptance criteria

- Essential information remains readable at 320–390px without zoom.
- No overflow is introduced by larger text.
- Decorative UI does not compete with the key steps and CTA.
- Check at 200% browser zoom and with device text scaling when feasible.

## 10. HP-07 — Incorporate existing mastery badge artwork

**Priority:** P2, **conditional on release**  
**Targets:** `components/landing/feature-showcase.tsx`, `public/badges/*.svg`, `lib/flags.ts`

### Opportunity

The homepage mastery preview currently presents the level sequence as small text:

`Starter → Explorer → Builder → Expert → Math Genius`

The repository now includes designed SVG badges for these levels. Actual artwork can communicate the progression more clearly and with greater personality.

### Requirements

1. Verify `mastery-badges` is enabled and supported in Production before showing badges as an available live capability.
2. Use the existing brand-owned SVG assets; do not generate replacement badges or create another visual system.
3. Prefer one emphasized current badge (e.g., Builder) with smaller progression indicators for other levels, rather than a crowded five-badge catalog.
4. Preserve the numerical mastery progress/bar and distinguish badge mastery from XP leaderboard ranking.
5. If badges are not available in Production, keep a truthful, simpler mastery presentation without implying that badges are already accessible.
6. Keep accessible badge names and meaningful alt text; decorative duplicates should not produce repetitive screen-reader announcements.

### Acceptance criteria

- Mastery progression is understandable without reading a long string of tiny level names.
- The showcased badge corresponds to the sample mastery level.
- Badge visuals match the released app and actual rollout state.
- No confusion between **XP determines rank** and **mastery determines level**.

---

## 11. Non-goals and guardrails

Do **not**:

- Rebrand or replace the current purple/lavender/coral/sky/green design system.
- Replace the hero demo or make it require authentication.
- Remove all repetition without considering whether it serves separate visitor needs.
- Delete feature coverage simply to hit a page-length number.
- Introduce fake functionality to make a mockup look good.
- Rewrite the game's learning progression, XP rules, player settings, or authorization.
- Add pricing, testimonials, a blog, or generic marketing sections.
- Enable Production feature flags as part of a cosmetic refactor.
- Modify unrelated backend, account, PWA, or gameplay code unless required to prevent a regression, and then keep the change narrowly scoped.

## 12. Delivery workflow

### Stage A — Inspect and baseline

1. Review the current live page or an equivalent production build with the same feature flags.
2. Capture full-page screenshots at **320, 375/390, 768, and 1440px**.
3. Capture the mobile practice-link demo in its default, animated, and reduced-motion states.
4. Record page height, obvious repetitive modules, and critical-copy readability.
5. Check current Production flag state and deployed child-link availability.
6. Note any discrepancy from the audited baseline commit; use the most recent deployed state as the implementation target.

### Stage B — Implement scoped improvements

1. Improve mobile phone showcase readability.
2. Correct showcase workflow fidelity.
3. Consolidate redundant product features while retaining coverage.
4. Resolve or report rollout/claim mismatches, without changing Production flags without approval.
5. Remove low-information copy and improve important labels.
6. Integrate badges **only when live feature availability supports that claim**.

### Stage C — Verify and report

1. Run repository tests and production build.
2. Recheck hero keyboard interaction, answer feedback, one-time sample XP, and no sample persistence.
3. Recheck `Start playing`, `Sign in`, anchor navigation, child-link routes, invitations, and installed-app entry points; avoid real family writes unless explicitly authorized.
4. Inspect responsive screenshots side by side, **before vs. after**.
5. Check pointer interaction, keyboard focus, 200% zoom, and `prefers-reduced-motion` behavior.
6. Summarize implemented, deferred, and rejected recommendations with evidence.

## 13. Final acceptance checklist

- [ ] Public homepage still clearly explains the product to parents within the first viewport.
- [ ] Interactive sample gameplay still works without sign-in or backend writes.
- [ ] Practice-link story is readable on narrow phones and accurately represents the app.
- [ ] No new horizontal overflow, clipping, inaccessible tiny informational text, or distracting motion.
- [ ] All important capabilities remain represented at least once.
- [ ] The gallery and family sections no longer unnecessarily retell identical information.
- [ ] Low-information marketing copy is removed without losing clarity.
- [ ] Actual mastery badge artwork is used only if consistent with live rollout.
- [ ] Production copy does not promise unavailable child-link functionality.
- [ ] Primary CTAs remain prominent near the beginning and end.
- [ ] Existing `/play`, `/login`, invitation links, child links, and PWA behavior are not regressed.
- [ ] Test/build results and actual browser/device verification limitations are documented.

## 14. Definition of done

The refinement succeeds when **the homepage feels like the same Multiply! game, communicates the same range of capabilities, and is easier for a parent to scan and understand—especially on mobile—without reading more or navigating more than necessary**.

Do not ship changes simply because they reduce word count or page height. Ship changes that make the experience demonstrably clearer, more accurate, or easier to use.
