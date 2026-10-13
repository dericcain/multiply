# Multiply landing page

The public homepage shows the actual game’s visual language through seven sections: a playable hero, three steps, the two-phone practice-link demonstration, ten product features, family progress, a final Start playing action, and a compact footer. It uses the existing color variables, logo, buttons, progress bars, streak badge, and family standings renderer. Decorative previews are static sample interfaces, not inactive form controls.

## Routes and compatibility

| Entry | Behavior |
| --- | --- |
| `/` | Public landing page when `landing-page` is enabled; original application when disabled |
| `/play` | Existing family game, sign-in, player selection, and gameplay |
| `/play?signup=1` | Account creation for a signed-out visitor; existing game for a signed-in parent |
| `/login` | Sign in or create an account; successful authentication navigates to `/play` |
| `/#play=…` | Browser replaces the URL with `/play#play=…`, preserving the secret in the fragment |
| `/?invite=…` | Browser replaces the URL with `/play?invite=…`, preserving the invitation |
| Existing installed parent shortcut at `/` | Standalone/display-mode detection opens `/play` |

Root compatibility lives in `lib/app-entry.js` and the lightweight `LandingEntry` component. It also handles supported fragments introduced after page load. Ordinary section anchors stay on the homepage. Compatibility works whether the marketing flag is enabled or disabled. These are full same-origin browser replacements so the server never needs to read a child fragment. The page does not read the parent session or load family data.

New child links and parent invitations use `/play`. The Nhost invitation email function also uses `/play`; its source change needs the normal functions deployment. Older email links remain compatible in the meantime.

## Installation

The parent manifest keeps its existing `id: "/"` and `scope: "/"`, while `start_url` becomes `/play`. Keeping the ID prevents this routing change from creating a second parent app identity.

Child manifests keep their existing digest-based IDs (`/?player=…`), scope, and icons. They still omit `start_url` so the browser retains the full installing document URL, including the child fragment. The old and new URL forms produce the same digest and manifest identity. The PWA component synchronizes every manifest tag, including tags streamed after hydration, to the current player manifest. Install prompts are offered within the game rather than the public page or login page. Existing service-worker navigation remains network-first and never caches family data.

Installed icons do not automatically rewrite their saved launch URLs everywhere. The root compatibility entry remains necessary for both parent and child shortcuts. Browser checks verify those entry URLs, manifest contents, and runtime selection; actual Add to Home Screen installation on iOS and Android was not performed.

## Sample gameplay and feature accuracy

The hero demo uses four predefined multiple-choice questions. A correct answer adds exactly one sample XP and advances after a short delay. A wrong answer reveals the correct value and waits for Next question. Buttons lock after the first answer to prevent duplicate awards. Keyboard activation and touch use the same handlers. Nothing is sent to Nhost or app game APIs, and no sample session is stored.

Mastery in the hero stays at the sample player’s existing 25/100 facts: a single answer does not claim mastery. Other previews show 25 XP for first mastery, a five-fact streak built with varied facts, parent-assigned ranges through 15, timed practice from 1–10 minutes, lifetime XP rankings separate from mastery levels, and a 5 XP typed-challenge bonus at 80% or better. Family summaries use the real standings function and different assigned scopes. The home-screen tile identifies the installable web app.

The phone demonstration plays once when visible, supports replay, and shows the completed child screen with reduced motion or without JavaScript. The landing page uses CSS animation, with no animation library dependency.

## Metadata and previews

Landing-specific title, description, canonical URL, Open Graph, and Twitter metadata are enabled with the landing flag. `/play` and `/login` have application titles and noindex metadata. `public/social-preview.png` is a 1200×630 browser-rendered composition of the branded hero and sample gameplay, with no remote image dependencies or live player information.

## Verification

- Production build and TypeScript check passed. Unit tests cover routing, manifests, flag decisions/failure defaults, and existing API authorization behavior.
- Browser checks covered incorrect and correct hero answers, keyboard selection, one sample XP per correct answer, automatic advance, reduced motion, replay, anchors, and all CTA destinations. Network/storage checks found no game backend calls or game persistence from the public demonstration.
- Layout checks covered 320, 375, 390, 768, 1024, and 1440 pixel widths without horizontal overflow. Device contents remain within their mockup frames. Accessibility checks use axe WCAG A/AA rules on desktop and mobile, plus keyboard focus checks and a zoom/reflow check.
- PostgreSQL and Hasura integration checks passed for family invitations, concurrent saves, authoritative XP, child-token isolation, link replacement/revocation, and saved streaks.
- A separate disposable browser fixture verified legacy root child entry, child gameplay and saved XP, root invitation entry and real invitation acceptance, shared-family settings, new canonical practice links, and player-specific manifest selection. Sign-in and registration responses came from a local authentication fixture; the normal Nhost SDK/form/session flow ran against it. No production users, emails, or game data were created.
- Signed SDK overrides verify that disabling the landing or showcase hides their UI while preserving the app’s entry points. Provider failures are covered by unit tests. Existing app API flag tests remain unchanged in scope.

See `docs/feature-flags.md` for release controls. This work prepares the repository and local preview; it does not deploy the website or Nhost function and does not enable Production flags.
