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

// ── Notifications par Défaut / Découverte ─────────────────────────────────────
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
  },
  {
    id: 'notif-pod-1',
    title: '🎙️ Nouveau Podcast Tech Pulse',
    body: 'Épisode 1 & 2 disponibles : L\'ère de l\'IA et les champions tech d\'Afrique.',
    time: 'Il y a 10 min',
    timestamp: Date.now() - 10 * 60 * 1000,
    type: 'podcast',
    read: false,
    url: '/?type=podcast',
  },
  {
    id: 'notif-mus-1',
    title: '🎵 Deep Focus & Lofi Study',
    body: 'Nouvelle session d\'ambiance relaxante pour lire et étudier au calme.',
    time: 'Il y a 1h',
    timestamp: Date.now() - 60 * 60 * 1000,
    type: 'music',
    read: false,
    url: '/?type=music',
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

  // ── Demander la permission Push de manière proactive ───────────────────────
  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return false;

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === 'granted') {
        setIsBannerDismissed(true);
        localStorage.setItem('rg_push_banner_dismissed', 'true');

        // Envoyer la notification de confirmation immédiate
        sendLocalNotification({
          title: '🔔 Notifications activées !',
          body: 'Vous recevrez les alertes pour les nouveaux livres audio, podcasts et musiques relaxantes.',
          type: 'system',
          url: '/',
        });

        // Souscrire au Push Manager si SW disponible
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

  // ── Moteur de Notifications Périodiques / Forçage Intelligent ─────────────
  useEffect(() => {
    // 1. Auto-invite au démarrage (si permission == 'default')
    const timerPrompt = setTimeout(() => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        // Déclencher prompt après 2 secondes d'interaction
        const onFirstInteraction = () => {
          requestPermission();
          window.removeEventListener('click', onFirstInteraction);
          window.removeEventListener('scroll', onFirstInteraction);
        };
        window.addEventListener('click', onFirstInteraction, { once: true });
        window.addEventListener('scroll', onFirstInteraction, { once: true });
      }
    }, 2000);

    // 2. Moteur récurrent de relance et de push périodique (toutes les 45 secondes en démo / 20 min en prod)
    const intervalNotifs = [
      {
        title: '🎧 Pause Lecture & Détente',
        body: 'Prenez 10 minutes pour écouter un chapitre de "L\'Effet Cumulé" ou votre livre en cours.',
        type: 'audiobook',
        url: '/?type=audiobook',
      },
      {
        title: '🎙️ Nouveau Podcast du Jour',
        body: 'Tech Pulse : Découvrez les nouvelles opportunités de l\'IA en Afrique !',
        type: 'podcast',
        url: '/?type=podcast',
      },
      {
        title: '🎵 Ambiance Focus & Lofi',
        body: 'Activez Deep Focus Session pour une concentration maximale.',
        type: 'music',
        url: '/?type=music',
      },
      {
        title: '🎓 Masterclass Disponible',
        body: 'Maîtrisez le Prompt Engineering Pro dans notre nouvelle formation audio.',
        type: 'masterclass',
        url: '/?type=masterclass',
      },
    ];

    let notifIndex = 0;
    const intervalPush = setInterval(() => {
      // Déclencher une notification si l'utilisateur est actif
      const nextItem = intervalNotifs[notifIndex % intervalNotifs.length];
      notifIndex++;

      // Envoi de la notification
      sendLocalNotification(nextItem);
    }, 90000); // toutes les 90 secondes en session active

    return () => {
      clearTimeout(timerPrompt);
      clearInterval(intervalPush);
    };
  }, [requestPermission, sendLocalNotification]);

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
