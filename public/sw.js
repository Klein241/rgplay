/**
 * Service Worker RG Play - v2.0.0
 * ─────────────────────────────────────────────────────────────────────────────
 * STRATÉGIE :
 *  1. install  → précache l'app shell (index.html + assets Vite)
 *  2. activate → purge les anciens caches (sauf audio hors-ligne)
 *  3. fetch    → Cache-First pour l'app shell, Network-First pour API
 *               → Audio offline servi depuis le cache rg-play-audio-offline
 */

const SW_VERSION = 'v2.1.0';
const CACHE_SHELL  = `rg-play-shell-${SW_VERSION}`;
const CACHE_AUDIO  = 'rg-play-audio-offline'; // Partagé avec offlineAudioCache.js

// Ressources du shell à précacher absolument pour le fonctionnement hors-ligne
const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
];

// ── 1. INSTALLATION : Précachage de l'app shell ──────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_SHELL).then(async (cache) => {
      // On précache chaque ressource individuellement pour ne pas bloquer
      // si l'une d'elles échoue (polices Google, etc.)
      for (const url of SHELL_URLS) {
        try {
          await cache.add(new Request(url, { cache: 'reload' }));
        } catch (e) {
          console.warn(`[SW] Précachage échoué pour ${url}:`, e);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

// ── 2. ACTIVATION : Nettoyage des anciens caches du shell ────────────────────
self.addEventListener('activate', (event) => {
  const KEEP_CACHES = [CACHE_SHELL, CACHE_AUDIO];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !KEEP_CACHES.includes(k))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

const APP_ORIGIN = self.location.origin;

// ── 3. FETCH ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignorer les schemes non-HTTP (chrome-extension:, etc.)
  if (!request.url.startsWith('http')) return;

  const url = new URL(request.url);

  // ── 3a. Requêtes cross-origin : laisser le navigateur gérer (CDN, polices)
  if (url.origin !== APP_ORIGIN) return;

  // ── 3b. Audio hors-ligne : Cache-First dans CACHE_AUDIO
  if (url.pathname.startsWith('/api/r2/') || url.pathname.startsWith('/api/audio/')) {
    event.respondWith(
      caches.open(CACHE_AUDIO).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        // En ligne : récupérer et servir (pas mis en cache automatiquement ici,
        // c'est offlineAudioCache.js qui décide quoi cacher)
        return fetch(request).catch(() =>
          new Response('Audio non disponible hors-ligne', { status: 503 })
        );
      })
    );
    return;
  }

  // ── 3c. API métier (/api/*) : Network-Only avec fallback JSON d'erreur
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({ error: 'Hors-ligne : API inaccessible', offline: true }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // ── 3d. Navigation SPA (HTML) : Network-First → Cache Shell (index.html)
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Mettre à jour le cache si la réponse est valide
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_SHELL).then((cache) => cache.put('/index.html', clone));
          }
          return response;
        })
        .catch(async () => {
          // Hors-ligne : servir l'app shell depuis le cache
          const cached = await caches.match('/index.html', { cacheName: CACHE_SHELL });
          if (cached) return cached;
          // Dernier recours : page minimale
          return new Response(
            `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>RG Play — Hors-ligne</title>
  <style>
    body { background:#07041A; color:#c77dff; font-family:sans-serif;
           display:flex; flex-direction:column; align-items:center;
           justify-content:center; min-height:100vh; gap:1.5rem; margin:0; }
    .logo { font-size:3rem; }
    h1 { font-size:1.5rem; font-weight:800; margin:0; }
    p  { color:#a1a1aa; margin:0; font-size:.9rem; text-align:center; }
    button { background:#9d4edd; color:#fff; border:none; padding:.75rem 2rem;
             border-radius:2rem; font-weight:700; cursor:pointer; font-size:1rem; }
  </style>
</head>
<body>
  <div class="logo">🎧</div>
  <h1>RG Play</h1>
  <p>Vous êtes hors-ligne.<br>Reconnectez-vous pour accéder à la bibliothèque complète.</p>
  <button onclick="location.reload()">Réessayer</button>
</body>
</html>`,
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // ── 3e. Assets statiques (JS, CSS, images, polices) : Cache-First
  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (
              response.ok &&
              (url.pathname.endsWith('.js') ||
               url.pathname.endsWith('.css') ||
               url.pathname.endsWith('.woff2') ||
               url.pathname.endsWith('.woff') ||
               url.pathname.endsWith('.svg') ||
               url.pathname.endsWith('.png') ||
               url.pathname.endsWith('.webp') ||
               url.pathname.endsWith('.jpg') ||
               url.pathname.endsWith('.ico'))
            ) {
              const clone = response.clone();
              caches.open(CACHE_SHELL).then((cache) => cache.put(request, clone)).catch(() => {});
            }
            return response;
          })
          .catch(() => new Response('', { status: 408, statusText: 'Timeout' }));
      })
    );
  }
});


// ════════════════════════════════════════════════════════════════════════════
//  PUSH NOTIFICATIONS
// ════════════════════════════════════════════════════════════════════════════
self.addEventListener('push', (event) => {
  let data = {
    title: 'RG Play',
    body: 'Nouveau livre audio disponible !',
    icon: '/icon.svg',
    badge: '/icon.svg',
  };

  if (event.data) {
    try { data = { ...data, ...event.data.json() }; }
    catch { data.body = event.data.text(); }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon.svg',
    badge: data.badge || '/icon.svg',
    tag: data.tag || 'rg-play-notif',
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: data.url || '/', bookId: data.bookId },
    actions: [
      { action: 'open', title: '🎧 Ouvrir' },
      { action: 'dismiss', title: '✕ Ignorer' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const existing = clientList.find((c) => c.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        return existing.navigate(targetUrl);
      }
      return clients.openWindow(targetUrl);
    })
  );
});
