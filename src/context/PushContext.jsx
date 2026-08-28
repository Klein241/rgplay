import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const PushContext = createContext(null);

// Clé publique VAPID (génère tes vraies clés avec : npx web-push generate-vapid-keys)
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBkYI9sl6aKlEczgA4Ko';

// Convertit base64url en Uint8Array pour VAPID
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export function PushProvider({ children }) {
  const [permission,    setPermission]    = useState(Notification?.permission || 'default');
  const [subscription,  setSubscription]  = useState(null);
  const [swRegistration,setSwRegistration]= useState(null);
  const [isSupported,   setIsSupported]   = useState(false);

  // Enregistrer le Service Worker au mount
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[Push] Non supporté sur ce navigateur');
      return;
    }
    setIsSupported(true);

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(reg => {
        setSwRegistration(reg);
        // Vérifier subscription existante
        return reg.pushManager.getSubscription();
      })
      .then(sub => { if (sub) setSubscription(sub); })
      .catch(err => console.warn('[SW] Erreur enregistrement:', err));

    setPermission(Notification.permission);
  }, []);

  // Demander permission + créer subscription
  const requestPermission = useCallback(async () => {
    if (!swRegistration) return false;

    const perm = await Notification.requestPermission();
    setPermission(perm);

    if (perm !== 'granted') return false;

    try {
      const sub = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      setSubscription(sub);

      // Envoyer subscription au serveur (D1 via Cloudflare)
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          userId: 'user-demo',
          device: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
        }),
      }).catch(() => {}); // Non bloquant si hors ligne

      return true;
    } catch (err) {
      console.warn('[Push] Échec souscription:', err);
      return false;
    }
  }, [swRegistration]);

  // Désactiver les notifications
  const unsubscribe = useCallback(async () => {
    if (!subscription) return;
    await subscription.unsubscribe();
    setSubscription(null);
    setPermission('default');
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => {});
  }, [subscription]);

  // Test local d'une notification (admin)
  const sendTestNotification = useCallback(async (opts = {}) => {
    if (!swRegistration || permission !== 'granted') return;
    await swRegistration.showNotification(opts.title || '🎧 RG Play', {
      body:    opts.body    || 'Nouveau livre audio disponible !',
      icon:    '/icon-192.png',
      badge:   '/icon-72.png',
      vibrate: [200, 100, 200],
      tag:     'test',
      data:    { url: opts.url || '/' },
      actions: [
        { action: 'open',    title: 'Ouvrir'   },
        { action: 'dismiss', title: 'Ignorer'  },
      ],
    });
  }, [swRegistration, permission]);

  return (
    <PushContext.Provider value={{
      isSupported, permission, subscription,
      requestPermission, unsubscribe, sendTestNotification,
      isSubscribed: permission === 'granted' && !!subscription,
    }}>
      {children}
    </PushContext.Provider>
  );
}

export const usePush = () => {
  const ctx = useContext(PushContext);
  if (!ctx) throw new Error('usePush doit être dans <PushProvider>');
  return ctx;
};
