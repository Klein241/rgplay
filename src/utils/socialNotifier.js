import { apiClient } from '../services/api';

/**
 * socialNotifier.js — Déclencheur d'actions communautaires RG Play
 * ─────────────────────────────────────────────────────────────────────────────
 * Émet les actions (écoute, téléchargement, like, avis) pour notifier
 * l'ensemble des autres utilisateurs en direct et via Push FCM.
 */

// Anti-spam en mémoire : évite d'émettre 10 fois pour le même livre en 1 minute
const actionCooldowns = new Map();

export async function notifySocialAction({
  type = 'listen', // 'listen', 'download', 'review', 'like', 'unlock'
  bookId,
  bookTitle,
  rating = null,
}) {
  if (!bookId || !bookTitle) return;

  const key = `${type}_${bookId}`;
  const now = Date.now();
  const lastSent = actionCooldowns.get(key) || 0;

  // 60 secondes de cooldown par type d'action et par livre
  if (now - lastSent < 60000) {
    return;
  }
  actionCooldowns.set(key, now);

  // Récupérer le nom de l'utilisateur ou fallback chaleureux
  let userName = 'Un auditeur';
  try {
    const savedUser = localStorage.getItem('rg_user_profile');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      if (parsed.name && parsed.name.trim()) userName = parsed.name.trim();
    }
  } catch (_) {}

  const payload = {
    action_type: type,
    book_id: bookId,
    book_title: bookTitle,
    user_name: userName,
    rating,
  };

  // 1. Émission locale immédiate (In-App)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rg_local_social_activity', { detail: payload }));
  }

  // 2. Transmission au backend Cloudflare D1 & Push FCM
  try {
    await apiClient.recordSocialAction(payload);
  } catch (err) {
    console.warn('[SocialNotifier] Échec émission action:', err);
  }
}
