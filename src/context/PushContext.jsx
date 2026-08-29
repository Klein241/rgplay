import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const PushContext = createContext(null);

// Clé publique VAPID pour Web Push PWA
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBkYI9sl6aKlEczgA4Ko';

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
  const [swRegistration, setSwRegistration] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(() => {
    return localStorage.getItem('rg_push_banner_dismissed') === 'true';
  });

  // Centre de notifications persistant
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('rg_notifications_history');
      return saved ? JSON.parse(saved) : INITIAL_NOTIFICATIONS;
    } catch {
      return INITIAL_NOTIFICATIONS;
    }
  });

  // Sauvegarder l'historique
  useEffect(() => {
    try {
      localStorage.setItem('rg_notifications_history', JSON.stringify(notifications));
    } catch (_) {}
  }, [notifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // ── Enregistrement du Service Worker ───────────────────────────────────────
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
    const newNotif = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: title || '🎧 RG Play',
      body: body || 'Nouveau contenu disponible !',
      time: 'À l\'instant',
      timestamp: Date.now(),
      type: type || 'general',
      url: url || '/',
      bookId: bookId || null,
      read: false,
    };

    setNotifications(prev => [newNotif, ...prev.slice(0, 49)]);

    // Si permission accordée, afficher notification native système
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        if (swRegistration && 'showNotification' in swRegistration) {
          await swRegistration.showNotification(title, {
            body,
            icon: icon || '/icon.svg',
            badge: '/icon.svg',
            vibrate: [200, 100, 200],
            tag: `rg-${Date.now()}`,
            renotify: true,
            data: { url: url || '/', bookId },
          });
        } else {
          new Notification(title, {
            body,
            icon: icon || '/icon.svg',
          });
        }
      } catch (err) {
        console.warn('[Push] Erreur affichage notification:', err);
      }
    }
  }, [swRegistration]);

  // ── Demander la permission Push ───────────────────────────────────────────
  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return false;

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === 'granted') {
        setIsBannerDismissed(true);
        localStorage.setItem('rg_push_banner_dismissed', 'true');

        sendLocalNotification({
          title: '🔔 Notifications activées !',
          body: 'Vous recevrez des alertes lors de la sortie de nouveaux livres audio et formations.',
          type: 'system',
          url: '/',
        });

        if (swRegistration && 'pushManager' in swRegistration) {
          try {
            const sub = await swRegistration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });
            setSubscription(sub);

            fetch('/api/push/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subscription: sub.toJSON(),
                userId: 'user-demo',
                device: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
              }),
            }).catch(() => {});
          } catch (subErr) {
            console.warn('[Push] Échec subscribe VAPID:', subErr);
          }
        }
        return true;
      }
      return false;
    } catch (e) {
      console.warn('[Push] Erreur requestPermission:', e);
      return false;
    }
  }, [swRegistration, sendLocalNotification]);

  // ── Écoute d'événements réels pour les notifications (Pas de spam récurrent) ──
  useEffect(() => {
    // 1. Écouter la publication d'un nouveau livre réel depuis Admin Studio
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
      isSupported,
      isBannerVisible: !isBannerDismissed && permission !== 'granted',
      notifications,
      unreadCount,
      requestPermission,
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
