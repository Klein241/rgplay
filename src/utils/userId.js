/**
 * RG Play - Système d'Identité Utilisateur & Parrainage Unique
 * Garantit que chaque visiteur (Chrome, Firefox, Mobile, etc.) possède
 * un identifiant persistant et distinct, éliminant tout partage de session.
 */

const USER_ID_KEY = 'rg_user_id';
const REFERRAL_KEY = 'rg_referral_data';
const REFERRED_BY_KEY = 'rg_referred_by';

/**
 * Récupère ou génère un identifiant utilisateur unique pour ce navigateur/appareil.
 * Si l'ancien 'user-demo' est détecté, il est immédiatement purgé.
 */
export function getOrCreateUserId() {
  if (typeof window === 'undefined') return 'guest';

  try {
    let id = localStorage.getItem(USER_ID_KEY);

    // Si pas d'identifiant ou si c'est l'ancien 'user-demo' global
    if (!id || id === 'user-demo' || id.trim() === '') {
      const timePart = Date.now().toString(36);
      const randPart = Math.random().toString(36).slice(2, 9);
      id = `usr_${timePart}_${randPart}`;
      localStorage.setItem(USER_ID_KEY, id);

      // Nettoyer les caches locaux pollués par l'ancien 'user-demo'
      try {
        const storedProfile = localStorage.getItem('rg_user_profile');
        if (storedProfile) {
          const parsed = JSON.parse(storedProfile);
          if (parsed.id === 'user-demo' || parsed.email?.includes('user-demo')) {
            localStorage.removeItem('rg_user_profile');
          }
        }
      } catch (_) {}
    }

    return id;
  } catch (_) {
    return 'guest';
  }
}

/**
 * Renvoie l'ID utilisateur actif.
 */
export function getUserId() {
  return getOrCreateUserId();
}

/**
 * Génère ou récupère le code de parrainage unique de l'utilisateur.
 */
export function getUserReferralCode() {
  if (typeof window === 'undefined') return 'RGPLAY';

  try {
    const raw = localStorage.getItem(REFERRAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.code && parsed.code !== 'RGUSERDEMO') return parsed.code;
    }
  } catch (_) {}

  const uid = getOrCreateUserId();
  const clean = uid.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
  const code = `RG${clean}`;

  try {
    const initData = {
      code,
      referrals: [],
      creditsEarned: 0,
      pendingCredits: 0,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(REFERRAL_KEY, JSON.stringify(initData));
  } catch (_) {}

  return code;
}

/**
 * Enregistre le code du parrain si un visiteur arrive avec ?ref=XYZ
 */
export function recordReferredBy(code) {
  if (!code || typeof window === 'undefined') return;
  const clean = code.trim().toUpperCase();
  // Éviter de s'auto-parrainer
  if (clean === getUserReferralCode()) return;

  try {
    const current = localStorage.getItem(REFERRED_BY_KEY);
    if (!current) {
      localStorage.setItem(REFERRED_BY_KEY, clean);
    }
  } catch (_) {}
}

/**
 * Récupère le parrain éventuel
 */
export function getReferredBy() {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(REFERRED_BY_KEY);
  } catch (_) {
    return null;
  }
}
