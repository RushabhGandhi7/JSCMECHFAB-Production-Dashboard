/**
 * JSC MECH FAB LLP – Production Control ERP
 * Service Worker v1.0
 *
 * SECURITY RULES:
 * - NEVER cache /api/* routes (authentication, project data, procurement)
 * - NEVER cache /login, /logout routes (session endpoints)
 * - Cache-first ONLY for truly static immutable assets (_next/static/)
 * - Network-first for all app pages (always fresh data)
 * - Offline fallback for navigation requests when network is unavailable
 */

const SW_VERSION = "jsc-erp-v1.0";
const STATIC_CACHE = `${SW_VERSION}-static`;
const OFFLINE_URL = "/offline.html";

// Static assets safe to cache (immutable, versioned by Next.js build hash)
const STATIC_ASSET_PATTERNS = [
  /^\/_next\/static\//,   // JS, CSS with content hash — safe to cache forever
  /^\/icons\//,           // App icons
  /^\/manifest\.json$/,   // PWA manifest
  /^\/offline\.html$/,    // Offline fallback
];

// NEVER cache these — auth sessions, API data, dynamic pages
const NEVER_CACHE_PATTERNS = [
  /^\/api\//,             // ALL API routes — project data, auth, procurement
  /^\/login/,             // Login page
  /^\/logout/,            // Logout endpoint
];

// ─── Install: cache the offline fallback page ──────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll([
        OFFLINE_URL,
        "/manifest.json",
        "/icons/icon-192.png",
        "/icons/icon-512.png",
        "/icons/apple-touch-icon.png",
      ]).catch(() => {
        // Non-fatal: continue install even if some resources fail
      });
    })
  );
  self.skipWaiting();
});

// ─── Activate: clean up old caches ───────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// ─── Fetch: routing strategy ──────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  const pathname = url.pathname;

  // ── Rule 1: NEVER cache auth or API requests — always network-only ──────
  const isNeverCache = NEVER_CACHE_PATTERNS.some((p) => p.test(pathname));
  if (isNeverCache) {
    // Pure pass-through — no cache interaction whatsoever
    event.respondWith(fetch(request));
    return;
  }

  // ── Rule 2: Static assets — cache-first (immutable, hashed by Next.js) ──
  const isStaticAsset = STATIC_ASSET_PATTERNS.some((p) => p.test(pathname));
  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        });
      })
    );
    return;
  }

  // ── Rule 3: Navigation requests (HTML pages) — network-first ─────────────
  // If network fails, show offline fallback (NOT stale page data)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => {
          // Network unavailable — show generic offline page, NOT cached app data
          return caches.match(OFFLINE_URL).then((offline) => {
            return (
              offline ||
              new Response(
                `<!DOCTYPE html><html><head><title>Offline – JSC ERP</title>
                <meta name="viewport" content="width=device-width,initial-scale=1">
                <style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;
                justify-content:center;min-height:100vh;margin:0;background:#f8fafc;color:#0f172a;}
                .box{text-align:center;padding:2rem;max-width:400px;}
                h1{font-size:1.5rem;font-weight:900;margin-bottom:.5rem;}
                p{color:#64748b;margin:.5rem 0;}</style></head>
                <body><div class="box">
                <p style="font-size:3rem">📡</p>
                <h1>You're offline</h1>
                <p>JSC ERP requires an internet connection to load live production data.</p>
                <p>Please reconnect and try again.</p>
                </div></body></html>`,
                { headers: { "Content-Type": "text/html" } }
              )
            );
          });
        })
    );
    return;
  }

  // ── Rule 4: Everything else — network-only (safe default) ─────────────────
  event.respondWith(fetch(request));
});
