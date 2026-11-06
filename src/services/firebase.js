/**
 * Firebase Client SDK — RG Play
 * ─────────────────────────────────────────────────────────────────────────────
 * Intégration prioritaire de Firebase Cloud Messaging (FCM) & Firebase Analytics.
 * Configuration officielle du projet rg-play-a6d69.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported as isMessagingSupported } from 'firebase/messaging';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';

export const firebaseConfig = {
  apiKey: "AIzaSyCVBPE1heud9kajOTEwbSMQtxbAzwgmkNo",
  authDomain: "rg-play-a6d69.firebaseapp.com",
  projectId: "rg-play-a6d69",
  storageBucket: "rg-play-a6d69.firebasestorage.app",
  messagingSenderId: "840098107667",
  appId: "1:840098107667:web:1e8b38c14e14d51195cae6",
  measurementId: "G-7K2X007M0D"
};

// Paire de clés Web Push (VAPID) générée dans la console Firebase
export const FIREBASE_VAPID_KEY = 'BMPsHIXGEB0Ah1IBApkTCcA_sWZScSKWTokYJfFijPIfyOmWxV3M-7v9PLA5qGA2W412uYvh-_KK6QWj6tEwgNI';

let appInstance = null;
let messagingInstance = null;
let analyticsInstance = null;

/**
 * Initialise ou retourne l'instance unique de l'application Firebase
 */
export function getFirebaseApp() {
  if (typeof window === 'undefined') return null;
  if (!appInstance) {
    appInstance = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  }
  return appInstance;
}

/**
 * Initialise Firebase Analytics avec fallback sécurisé
 */
export async function getFirebaseAnalytics() {
  if (typeof window === 'undefined') return null;
  if (analyticsInstance) return analyticsInstance;

  try {
    const supported = await isAnalyticsSupported();
    if (supported) {
      const app = getFirebaseApp();
      analyticsInstance = getAnalytics(app);
      return analyticsInstance;
    }
  } catch (err) {
    console.warn('[Firebase] Analytics non disponible dans cet environnement:', err);
  }
  return null;
}

/**
 * Vérifie si Firebase Cloud Messaging est supporté dans le navigateur courant
 */
export async function checkFCMSupport() {
  if (typeof window === 'undefined') return false;
  try {
    return await isMessagingSupported();
  } catch {
    return false;
  }
}

/**
 * Initialise Firebase Messaging
 */
export async function getFirebaseMessaging() {
  if (typeof window === 'undefined') return null;
  if (messagingInstance) return messagingInstance;

  const supported = await checkFCMSupport();
  if (!supported) {
    console.info('[Firebase] FCM non supporté sur ce navigateur.');
    return null;
  }

  try {
    const app = getFirebaseApp();
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (err) {
    console.warn('[Firebase] Échec initialisation Messaging:', err);
    return null;
  }
}

/**
 * Demande et récupère le Token FCM pour l'appareil courant.
 * Priorise le Service Worker existant si fourni.
 */
export async function requestFCMToken(swRegistration = null) {
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return null;

    const tokenOptions = {
      vapidKey: FIREBASE_VAPID_KEY,
    };

    if (swRegistration) {
      tokenOptions.serviceWorkerRegistration = swRegistration;
    }

    const currentToken = await getToken(messaging, tokenOptions);
    if (currentToken) {
      console.log('[Firebase] FCM Token obtenu avec succès');
      return currentToken;
    } else {
      console.warn('[Firebase] Aucun token FCM disponible. Permission refusée ou en attente.');
      return null;
    }
  } catch (err) {
    console.warn('[Firebase] Erreur lors de la récupération du token FCM:', err);
    return null;
  }
}

/**
 * Écoute les messages Firebase reçus au premier plan (Foreground)
 */
export async function onFCMForegroundMessage(callback) {
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return () => {};

    return onMessage(messaging, (payload) => {
      console.log('[Firebase] Message FCM reçu au premier plan:', payload);
      if (typeof callback === 'function') {
        callback(payload);
      }
    });
  } catch (err) {
    console.warn('[Firebase] Impossible d\'écouter les messages en premier plan:', err);
    return () => {};
  }
}
