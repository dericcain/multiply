# Multiply! PWA

The production static export includes a web app manifest, a service worker, and the x! logo as browser and home-screen icons. Serve `out/` over HTTPS (localhost works for testing). The worker registers only in production so development hot reload is unaffected.

Chromium browsers show an Install Multiply! button when they offer installation. On iPhone and iPad, the app shows Share → Add to Home Screen instructions. Installed apps launch in standalone mode.

## Offline behavior

The worker caches the offline page and its logo assets. A navigation without a connection shows that page; Try again reloads the original URL. Family loading and sign-in require a connection. Games already waiting to save remain in the existing local outbox. The worker does not cache family data, authentication responses, or application HTML.

## Updating icons and the worker

Run `node scripts/generate-pwa-icons.mjs` after editing `public/multiply-logo.svg`. The PNGs include a purple gradient tile inside an opaque pale surround, light lettering, and enough padding for maskable icon crops. The Apple touch icon uses the 512px image, matching Next Touch's high-resolution setup. Keeping the purple tile separate from the outer background is an artwork workaround for iOS's automatic dark icon treatment, not a supported opt-out; verify the result on a physical iPhone in both Home Screen appearances.

When changing the artwork, increment the icon URL version in `app/layout.tsx`, `app/manifest.webmanifest`, and `public/sw.js` together. iOS can retain the artwork captured at installation; re-add the Home Screen app after deployment to test a new icon.

## Input focus on iPhone

The shared `Input` keeps text at least 16px, including inside dialogs and at wider viewport sizes, to avoid Safari's small-text focus zoom. Leave the viewport scalable so users can still pinch to zoom. Do not reintroduce an unlayered `input { font: inherit }` rule: it overrides Tailwind's input font size and makes dialog fields inherit the dialog's smaller text.

Increment the cache version in `public/sw.js` when changing precached assets. A new worker activates once the previous worker's tabs close, avoiding reloads during a game. Serve `/sw.js` with revalidation or `Cache-Control: no-cache` at the static host; registration also uses `updateViaCache: 'none'`.
