# PWA plan

Harepin ships as a PWA at `https://lilbunnyrabbit.github.io/harepin/`. WebOS and Series Tracker live on the same origin, so they share Cache Storage, SW registrations, localStorage and IndexedDB with it. This plan checks for clashes (2026-11-08) and sets up Harepin to stay out of their way.

## What's already on the origin

| | WebOS (`/webos/`) | Series Tracker (`/series-tracker/`) |
|---|---|---|
| Build | `vite-plugin-pwa` 1.1.0 `VitePWA`, generateSW (Workbox 7.4) | `@vite-pwa/sveltekit` + `vite-plugin-pwa` 1.2.0, generateSW, Vite 8 |
| Registration | injected `registerSW.js`: `register('/webos/sw.js', { scope: '/webos/' })` | `virtual:pwa-register` in `+layout.svelte`, `/series-tracker/sw.js` |
| Update | `autoUpdate` (skipWaiting + clientsClaim), VersionService overlay | `prompt`, UpdateToast + Settings, `version.json` poll |
| Precache | `workbox-precache-v2-https://lilbunnyrabbit.github.io/webos/`, `cleanupOutdatedCaches` | same name pattern with `/series-tracker/`, `cleanupOutdatedCaches` |
| Runtime caches | `webos-wasm`, `webos-fonts`, `webos-dictionaries`, `webos-mammoth`, `webos-store`, `webos-assets` | none |
| Navigate fallback | `index.html`, denylist `^/webos/portfolio/` | `/series-tracker/404.html` |
| Manifest | no `id`, `start_url`/`scope` `/webos/`, standalone, `#17252C` | no `id`, `start_url`/`scope` `/series-tracker/`, standalone, portrait, `#17252C` |
| Storage | OPFS, localStorage `app.{id}.*`, locks `webos.*` | IndexedDB `series-tracker`, localStorage `series-tracker:*`, `picker:*` |

The root user site is not deployed: `/`, `/sw.js` and `/manifest.webmanifest` all return 404. No SW controls `/`.

## Same-domain handling the owner already did

- Series Tracker fix `eecd726` (2026-10-12): the update fallback used to unregister every worker and wipe every cache on the origin. It now unregisters only its own registration and deletes only cache keys that contain its scope URL (`src/lib/version.svelte.ts` `applyUpdate`).
- WebOS copies that, "minus its origin-wide wipe": `scope_caches(keys, scope)` in `src/lib/core/api/services/version/update.ts`, with a test that a sibling's `workbox-precache-v2-…/series-tracker/` survives. `docs/system/services/version.md` › Fallback.
- WebOS `StoreService.prune` deletes only keys starting with `webos-assets-` (`store/lists.ts`).
- WebOS docs flag the shared origin for data too: ADR-037, ADR-063 and `brainstorm/2026-10-12_app-candidates.md` (G8).

## Clash risks for Harepin

- **Cache wipes: none today.** Both apps delete only keys that contain `/webos/` or `/series-tracker/`, or that start with `webos-assets-`. Workbox `deleteOutdatedCaches` matches `-precache-` plus its own `registration.scope` (workbox-precaching 7.4.0). Harepin's precache name contains `/harepin/`, so it matches none of these.
- **Harepin must return the favour.** Any manual cleanup filters on `registration.scope`. Never call `caches.keys()` and delete everything, never `getRegistrations()` and unregister everything. Never name a cache `webos-*`.
- **Scope overlap: none.** Each SW controls only its own path, and its navigate fallback only fires there. A root-scope SW would control `/harepin/` unless Harepin has its own registration, because the longest scope wins. The root site is 404, so this is only a watch item if a user-site repo is ever created.
- **Install identity.** Neither manifest sets `id`, so each id falls back to its `start_url`, and the paths differ. Harepin sets an explicit `id` anyway.
- **localStorage is origin-wide and readable by every app.** Every Harepin key already uses the `harepin:` prefix (`build`, `help`, `theme`, `settings`, `best`, `splits`, `ghost:<seed>`, `<mode>:<seed>`). No clash with `app.*`, `series-tracker:*` or `picker:*`. Keep the prefix for any new key and for any IndexedDB name.
- **Peer range.** `vite-plugin-pwa` 1.2.0 declares `vite` up to `^7`. Series Tracker runs it on Vite 8, so it works, but expect a peer warning.

## Recommended setup

- **Approach.** Use `vite-plugin-pwa` `VitePWA` with generateSW, the same as WebOS: Harepin is plain Vite, not SvelteKit. This adds one devDependency plus `@vite-pwa/assets-generator` for icons. **Get the owner's OK before adding them.** The only zero-dependency option is a hand-written `public/sw.js`, which goes against the owner's existing pattern.
- **Scope.** Keep `base: "./"`. The plugin then registers `./sw.js` with scope `./`, which resolves to `/harepin/`. Set `scope: "./"` explicitly in both the plugin options and the manifest. Use `injectRegister: "script"`, like WebOS.
- **Manifest.**
  - `id: "harepin"`, which resolves to `/harepin`.
  - `start_url: "./"`, `scope: "./"`, `name`/`short_name` "Harepin".
  - `display: "fullscreen"` with `display_override: ["fullscreen", "standalone"]`, and `orientation: "landscape"`.
  - `background_color`/`theme_color` `#17252C`: the logo's ink, which both sibling apps also use.
  - Manifest colours must be static hex. Pull them from the theme token source at build time only if a token module can be imported by `vite.config.ts`; otherwise hardcode them, one line.
- **Icons.** Run `pwa-assets-generator --preset minimal-2023 public/logo.svg`, like Series Tracker. It outputs 64/192/512, maskable 512, apple-touch 180 and `favicon.ico`. The circular logo needs padding to work as a maskable icon (the preset's default).
- **Precache.** `globPatterns: ["**/*.{js,css,html,woff2,svg,png,ico}"]` covers the JS bundle, the CSS, the Hack fonts, the logo and the icons. The current `dist` is 1.1 MB and the world is generated, so nothing else is needed. Set `maximumFileSizeToCacheInBytes` above the three.js chunk if it is over 2 MiB.
- **Inter font.** Inter loads from Google Fonts across origins, so offline play would fall back to a system font. Self-host it like Hack (`public/fonts`): one fewer network rule, and the fonts land in the precache. If it stays remote, add a `CacheFirst` runtime rule named `harepin-google-fonts`.
- **Cache naming.** The precache is Workbox's own `workbox-precache-v2-…/harepin/`. Any runtime cache is named `harepin-*`. Keep `cleanupOutdatedCaches: true` (the plugin default); it is scope-filtered.
- **Navigate fallback.** Keep the default `index.html`. Harepin has one page, so no denylist is needed.
- **Update flow.** Use `autoUpdate` with the injected script, like WebOS. The new SW activates in the background, and the new build loads on the next launch or reload. The plugin's own script only registers the SW; it never reloads, so a race is never cut short. Harepin builds into one JS chunk, so there are no lazy chunks the old page could lose. Use `prompt` plus a menu "Update ready, restart" item only if the owner wants a visible update.
- **Offline.** Solo, track modes, garage and ghosts all work offline: generated world, localStorage. Multiplayer (trystero, appId `lilbunnyrabbit-harepin`) needs the network. Its WebSocket and WebRTC traffic never goes through the SW's `fetch` handler. When `navigator.onLine` is false, disable the lobby entry with an "Offline" note so it does not hang.
- **Verify before deploy.** Run `vite build && vite preview`, then check in DevTools › Application:
  - the SW is registered with scope `/harepin/`;
  - the only cache is `workbox-precache-v2-…/harepin/`;
  - with the network off, a reload still boots solo;
  - the existing WebOS and Series Tracker caches are intact on the live origin after visiting.

Sources: repo files above (WebOS `d57931e3`, Series Tracker `f9e37f2`, both 2026-11-08 / 2026-11-06); live `curl` of `/`, `/webos/`, `/series-tracker/` manifests and `sw.js` (2026-11-08); `node_modules` `vite-plugin-pwa` 1.2.0 (`resolveBasePath`, scope default = base) and `workbox-precaching` 7.4.0 `utils/deleteOutdatedCaches.js`.
