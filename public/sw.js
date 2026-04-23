// YIELD Service Worker
// Stratégie : Network-first pour les pages, Cache-first pour les assets statiques

const CACHE_VERSION = "v1";
const STATIC_CACHE = `margeschef-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `margeschef-dynamic-${CACHE_VERSION}`;

// App Shell — mis en cache à l'installation
const APP_SHELL = [
  "/",
  "/dashboard",
  "/offline",
  "/_next/static/css/app/globals.css",
];

// ─── Install : mise en cache de l'app shell ───────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate : nettoyage des anciens caches ──────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch : stratégies par type de requête ───────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ne pas intercepter les extensions Chrome ou les requêtes non-HTTP
  if (!url.protocol.startsWith("http")) return;

  // API calls & Edge Functions → Network only (pas de cache)
  if (
    url.pathname.startsWith("/api/") ||
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("anthropic.com")
  ) {
    return; // Passe directement au réseau
  }

  // Navigation (HTML) → Network first, fallback offline page
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Mise en cache dynamique des pages visitées
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) => cached || caches.match("/offline")
          )
        )
    );
    return;
  }

  // Assets Next.js (JS, CSS, fonts) → Cache first, network fallback
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    request.destination === "font"
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
            return response;
          })
      )
    );
    return;
  }

  // Tout le reste → Stale-while-revalidate
  event.respondWith(
    caches.open(DYNAMIC_CACHE).then((cache) =>
      cache.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          cache.put(request, response.clone());
          return response;
        });
        return cached || fetchPromise;
      })
    )
  );
});

// ─── Background Sync — retry uploads échoués ─────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "retry-invoice-upload") {
    event.waitUntil(retryFailedUploads());
  }
});

async function retryFailedUploads() {
  // Les uploads en attente sont stockés dans IndexedDB par le client
  // Cette fonction sera complétée dans la Phase 2
  console.log("[SW] Background sync: retry invoice uploads");
}

// ─── Push notifications ───────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || "YIELD", {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      tag: data.tag || "margeschef-alert",
      data: { url: data.url || "/dashboard" },
      actions: [
        { action: "view", title: "Voir l'alerte" },
        { action: "dismiss", title: "Ignorer" },
      ],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.includes(url));
        if (existing) return existing.focus();
        return self.clients.openWindow(url);
      })
  );
});
