/**
 * Firebase Cloud Messaging Service Worker — RG Play
 * ─────────────────────────────────────────────────────────────────────────────
 * Gère la réception des notifications Push Firebase (FCM) en arrière-plan
 * et l'interaction lors du clic utilisateur.
 */

importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCVBPE1heud9kajOTEwbSMQtxbAzwgmkNo",
  authDomain: "rg-play-a6d69.firebaseapp.com",
  projectId: "rg-play-a6d69",
  storageBucket: "rg-play-a6d69.firebasestorage.app",
  messagingSenderId: "840098107667",
  appId: "1:840098107667:web:1e8b38c14e14d51195cae6",
  measurementId: "G-7K2X007M0D"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[FCM-SW] Notification en arrière-plan reçue :', payload);
  const title = payload.notification?.title || payload.data?.title || '🎧 RG Play';
  const options = {
    body: payload.notification?.body || payload.data?.body || 'Nouveau contenu disponible !',
    icon: payload.notification?.icon || payload.data?.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.data?.tag || `rg-fcm-${Date.now()}`,
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: payload.data?.url || payload.notification?.click_action || '/',
      ...payload.data
    }
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
