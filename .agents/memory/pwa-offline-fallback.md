---
name: PWA offline fallback
description: Non-obvious interaction between vite-plugin-pwa defaults and Workbox 7 offline navigation fallbacks
---

Use a navigation runtime route with Workbox's precache fallback plugin for a dedicated offline document, and explicitly disable vite-plugin-pwa's default navigation fallback.

**Why:** Workbox 7 rejects `offlineFallback` as a top-level `generateSW` option. Also, vite-plugin-pwa inserts an `index.html` navigation fallback by default; that route is registered first and shadows a later offline runtime route unless disabled.

**How to apply:** When changing LexCom PWA navigation caching, inspect the generated service worker after a production build. Confirm the offline document is precached, the precache fallback plugin points to it, and no earlier SPA `NavigationRoute` remains.