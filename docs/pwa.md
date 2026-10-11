# Multiply! PWA

The production static export includes a web app manifest, a service worker, and the x! logo as browser and home-screen icons. Serve `out/` over HTTPS (localhost works for testing). The worker registers only in production so development hot reload is unaffected.

Chromium browsers show an Install Multiply! button when they offer installation. On iPhone and iPad, the app shows Share → Add to Home Screen instructions. Installed apps launch in standalone mode.

## Offline behavior

The worker caches the offline page and its logo assets. A navigation without a connection shows that page; Try again reloads the original URL. Family loading and sign-in require a connection. Games already waiting to save remain in the existing local outbox. The worker does not cache family data, authentication responses, or application HTML.

## Updating icons and the worker

Run `node scripts/generate-pwa-icons.mjs` after editing `public/multiply-logo.svg`. The PNGs include an opaque light background and enough padding for maskable icon crops.

Increment the cache version in `public/sw.js` when changing precached assets. A new worker activates once the previous worker's tabs close, avoiding reloads during a game. Serve `/sw.js` with revalidation or `Cache-Control: no-cache` at the static host; registration also uses `updateViaCache: 'none'`.
