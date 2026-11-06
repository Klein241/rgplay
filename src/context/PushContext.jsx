import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient, getUserId } from '../services/api';
import {
  FIREBASE_VAPID_KEY,
  getFirebaseAnalytics,
  requestFCMToken,
  onFCMForegroundMessage
} from '../services/firebase';

const PushContext = createContext(null);

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// ── Notifications Initiales Propres ─────────────────────────────────────
const INITIAL_NOTIFICATIONS = [
  {
    id: 'notif-welcome',
    title: '🎧 Bienvenue sur RG Play !',
    body: 'Explorez nos 4 univers : Livres Audio, Podcasts, Musique et Masterclasses.',
    time: 'À l\'instant',
    timestamp: Date.now(),
    type: 'welcome',
    read: false,
    url: '/',
  }
];

export function PushProvider({ children }) {
  const [permission, setPermission] = useState(() => {
    return typeof Notification !== 'undefined' ? Notification.permission : 'default';
  });
  const [subscription, setSubscription] = useState(null);
  const [fcmToken, setFcmToken] = useState(() => {
    return typeof localStorage !== 'undefined' ? localStorage.getItem('rg_fcm_token') : null;
  });
  const [swRegistration, setSwRegistration] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(() => {
    return typeof localStorage !== 'undefined' && localStorage.getItem('rg_push_banner_dismissed') === 'true';
  });

  // Centre de notifications persistant (D1 + Local)
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('rg_notifications_history');
      return saved ? JSON.parse(saved) : INITIAL_NOTIFICATIONS;
    } catch {
      return INITIAL_NOTIFICATIONS;
    }
  });

  // Initialisation silencieuse de Firebase Analytics
  useEffect(() => {
    getFirebaseAnalytics().catch(() => {});
  }, []);

  // Charger l'historique des notifications depuis Cloudflare D1
  useEffect(() => {
    apiClient.getNotificationsHistory().then(d1Notifs => {
      if (Array.isArray(d1Notifs) && d1Notifs.length > 0) {
        setNotifications(prev => {
          const merged = [...d1Notifs.map(n => ({
            id: n.id,
            title: n.title,
            body: n.body,
            icon: n.icon || '/icon-192.png',
            url: n.url || '/',
            bookId: n.book_id,
            time: n.sent_at ? new Date(n.sent_at).toLocaleDateString('fr-FR') : "Récemment",
            read: Boolean(n.is_read)
          })), ...prev];
          const uniqueMap = new Map();
          for (const item of merged) {
            if (!uniqueMap.has(item.id)) uniqueMap.set(item.id, item);
          }
          return Array.from(uniqueMap.values());
        });
      }
    }).catch(() => {});
  }, []);

  // Sauvegarder l'historique localement
  useEffect(() => {
    try {
      localStorage.setItem('rg_notifications_history', JSON.stringify(notifications));
    } catch (_) {}
  }, [notifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // ── Enregistrement du Service Worker PWA & FCM ────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!('serviceWorker' in navigator)) {
      console.log('[Push] ServiceWorker non supporté sur ce navigateur');
      return;
    }

    setIsSupported(true);

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(reg => {
        setSwRegistration(reg);
        if ('pushManager' in reg) {
          return reg.pushManager.getSubscription();
        }
        return null;
      })
      .then(sub => {
        if (sub) setSubscription(sub);
      })
      .catch(err => console.warn('[SW] Erreur enregistrement:', err));

    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
    }
  }, []);

  // ── Envoi d'une Notification Système (Native + In-App) ─────────────────────
  const sendLocalNotification = useCallback(async ({ title, body, icon, url, type, bookId }) => {
    const notifTitle = title || '🎧 RG Play';
    const notifBody = body || 'Nouveau contenu disponible !';
    const notifIcon = icon || '/icon-192.png';

    const newNotif = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: notifTitle,
      body: notifBody,
      time: 'À l\'instant',
      timestamp: Date.now(),
      type: type || 'general',
      url: url || '/',
      bookId: bookId || null,
      read: false,
    };

    setNotifications(prev => [newNotif, ...prev.slice(0, 49)]);

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator) {
          try {
            const reg = swRegistration || await navigator.serviceWorker.ready;
            if (reg && typeof reg.showNotification === 'function') {
              await reg.showNotification(notifTitle, {
                body: notifBody,
                icon: notifIcon,
                badge: notifIcon,
                vibrate: [200, 100, 200],
                tag: `rg-${Date.now()}`,
                renotify: true,
                data: { url: url || '/', bookId },
              });
              return;
            }
          } catch (swErr) {
            console.warn('[Push] Échec reg.showNotification:', swErr);
          }
        }

        if (typeof Notification === 'function' && Notification.prototype && typeof Notification.prototype.close === 'function') {
          try {
            const n = new Notification(notifTitle, {
              body: notifBody,
              icon: notifIcon,
            });
            setTimeout(() => { try { n.close(); } catch (_) {} }, 6000);
          } catch (_) {}
        }
      } catch (err) {
        console.warn('[Push] Notification système ignorée:', err);
      }
    }
  }, [swRegistration]);

  // ── Écouteur de notifications Firebase en premier plan (Foreground) ───────
  useEffect(() => {
    let unsubscribe = () => {};
    onFCMForegroundMessage((payload) => {
      const title = payload.notification?.title || payload.data?.title || '🎧 RG Play';
      const body = payload.notification?.body || payload.data?.body || 'Nouveau contenu audio disponible !';
      const icon = payload.notification?.icon || payload.data?.icon || '/icon-192.png';
      const url = payload.data?.url || payload.notification?.click_action || '/';
      const bookId = payload.data?.bookId || null;

      sendLocalNotification({ title, body, icon, url, type: 'firebase', bookId });
    }).then(unsub => {
      if (typeof unsub === 'function') unsubscribe = unsub;
    }).catch(() => {});

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [sendLocalNotification]);

  // ── Synchronisation automatique du Token FCM si déjà autorisé ─────────────
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && swRegistration) {
      requestFCMToken(swRegistration).then(token => {
        if (token) {
          setFcmToken(token);
          localStorage.setItem('rg_fcm_token', token);
        }
      }).catch(() => {});
    }
  }, [swRegistration]);

  // ── Demander la permission Push (Firebase FCM en priorité absolue) ────────
  const requestPermission = useCallback(async () => {
    if (typeof Notification !== 'undefined') {
      try {
        let perm = Notification.permission;
        if (typeof Notification.requestPermission === 'function') {
          const result = Notification.requestPermission();
          perm = result instanceof Promise ? await result : await new Promise(r => Notification.requestPermission(r));
        }
        setPermission(perm);

        if (perm === 'granted') {
          setIsBannerDismissed(true);
          localStorage.setItem('rg_push_banner_dismissed', 'true');

          const reg = swRegistration || ('serviceWorker' in navigator ? await navigator.serviceWorker.ready.catch(() => null) : null);
          if (reg) setSwRegistration(reg);

          setTimeout(() => {
            sendLocalNotification({
              title: '🔔 Notifications activées !',
              body: 'Vous recevrez des alertes instantanées lors des sorties et événements RG Play.',
              type: 'system',
              url: '/',
            });
          }, 500);

          // 1. PRIORITÉ ABSOLUE : Récupération du Token Firebase Cloud Messaging
          let currentFcmToken = null;
          try {
            currentFcmToken = await requestFCMToken(reg);
            if (currentFcmToken) {
              setFcmToken(currentFcmToken);
              localStorage.setItem('rg_fcm_token', currentFcmToken);
            }
          } catch (fcmErr) {
            console.warn('[Push] Erreur récupération token FCM:', fcmErr);
          }

          // 2. Enregistrement Web Push standard (avec la clé VAPID Firebase)
          let sub = null;
          if (reg && 'pushManager' in reg) {
            try {
              sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(FIREBASE_VAPID_KEY),
              });
              setSubscription(sub);
            } catch (subErr) {
              console.warn('[Push] Échec subscribe VAPID:', subErr);
            }
          }

          // 3. Envoi au serveur Cloudflare D1
          fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: 'firebase',
              fcmToken: currentFcmToken || localStorage.getItem('rg_fcm_token'),
              subscription: sub ? sub.toJSON() : null,
              userId: getUserId(),
              device: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
            }),
          }).catch(() => {});

          return true;
        }
        return false;
      } catch (e) {
        console.warn('[Push] Erreur requestPermission:', e);
        return false;
      }
    }
    return false;
  }, [swRegistration, sendLocalNotification]);

  // ── Envoyer une Notification de Test ──────────────────────────────────────
  const sendTestNotification = useCallback(async ({ title, body, url }) => {
    return sendLocalNotification({
      title: title || '🎧 Test Firebase RG Play',
      body: body || 'Le système de notifications Firebase fonctionne parfaitement sur votre appareil !',
      type: 'system',
      url: url || '/',
    });
  }, [sendLocalNotification]);

  // ── Écoute d'événements réels pour les notifications ──────────────────────
  useEffect(() => {
    const onNewContent = (e) => {
      const book = e.detail;
      if (book?.title) {
        sendLocalNotification({
          title: `✨ Nouveau contenu disponible !`,
          body: `"${book.title}" par ${book.author || 'RG Play'} est maintenant en ligne.`,
          type: book.content_type || 'audiobook',
          bookId: book.id,
          url: `/?type=${book.content_type || 'audiobook'}`,
        });
      }
    };

    window.addEventListener('rg_new_content_published', onNewContent);
    return () => window.removeEventListener('rg_new_content_published', onNewContent);
  }, [sendLocalNotification]);

  // ── Actions du Centre de Notifications ─────────────────────────────────────
  const markAsRead = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const dismissBanner = useCallback(() => {
    setIsBannerDismissed(true);
    localStorage.setItem('rg_push_banner_dismissed', 'true');
  }, []);

  return (
    <PushContext.Provider value={{
      permission,
      subscription,
      fcmToken,
      isSubscribed: permission === 'granted',
      isSupported,
      isBannerVisible: !isBannerDismissed && permission !== 'granted',
      notifications,
      unreadCount,
      requestPermission,
      sendTestNotification,
      dismissBanner,
      sendLocalNotification,
      markAsRead,
      markAllAsRead,
      clearNotification,
      clearAllNotifications,
    }}>
      {children}
    </PushContext.Provider>
  );
}

export function usePush() {
  const context = useContext(PushContext);
  if (!context) {
    throw new Error('usePush doit être utilisé à l\'intérieur de PushProvider');
  }
  return context;
}
