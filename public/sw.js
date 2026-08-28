/**
 * Service Worker RG Play - v1.0.3
 * - Network-First pour HTML & API avec fallback Response propre
 * - Stale-While-Revalidate pour assets statiques
 * - Push Notifications & PWA
 */

const SW_VERSION = 'v1.0.3';
const CACHE_NAME = `rg-play-${SW_VERSION}`;
const API_PREFIX = '/api/';

// ── Installation Immédiate ───────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// ── Activation (Suppression immédiate des anciens caches) ────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch Strategy : Network-First avec Fallback Robuste ─────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!request.url.startsWith('http://') && !request.url.startsWith('https://')) {
    return;
  }
  const url = new URL(request.url);

  // 1. Navigation HTML & API : Network First
  if (request.mode === 'navigate' || request.destination === 'document' || url.pathname.startsWith(API_PREFIX)) {
    event.respondWith(
      fetch(request)
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          if (request.mode === 'navigate' || request.destination === 'document') {
            const indexHtml = await caches.match('/index.html');
            if (indexHtml) return indexHtml;
          }
          return new Response('<!DOCTYPE html><html><body><p>Hors-ligne</p></body></html>', {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        })
    );
    return;
  }

  // 2. Assets statiques (JS, CSS, Images, SVGs)
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response('', { status: 408, statusText: 'Request Timeout' });
      })
  );
});

// ════════════════════════════════════════════════════════════════════════════
//  PUSH NOTIFICATIONS
// ════════════════════════════════════════════════════════════════════════════
self.addEventListener('push', (event) => {
  let data = { 
    title: 'RG Play', 
    body: 'Nouveau livre audio disponible !', 
    icon: '/icon.svg', 
    badge: '/icon.svg' 
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
    data: {
      url: data.url || '/',
      bookId: data.bookId,
    },
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
