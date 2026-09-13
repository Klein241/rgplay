/**
 * src/services/api/settingsApi.js
 * 
 * Module spécialisé pour la gestion des paramètres globaux de la plateforme (AGENTS.md) :
 * - Configuration du Support WhatsApp VIP (+24177624383 par défaut - Gabon)
 * - Message prédéfini prêt à l'envoi
 * - Synchronisation Cloudflare D1 & Cache local
 */

const API_BASE = '/api';

export const DEFAULT_PLATFORM_SETTINGS = {
  support_whatsapp: '+24177624383',
  support_whatsapp_message: "Bonjour RG Play, j'ai besoin d'une assistance avec mon compte et mes accès VIP.",
};

/**
 * Nettoie un numéro de téléphone pour le format standard wa.me
 * Retire le '+', les espaces, les tirets et parenthèses.
 * Exemple: "+241 77 62 43 83" -> "24177624383"
 */
export function formatWhatsAppNumber(phone) {
  if (!phone) return '24177624383';
  const clean = String(phone).replace(/[^0-9]/g, '');
  return clean || '24177624383';
}

/**
 * Génère l'URL directe wa.me avec le message d'assistance prédéfini encodé
 */
export function buildWhatsAppSupportUrl(phone, customMessage) {
  const cleanNumber = formatWhatsAppNumber(phone || DEFAULT_PLATFORM_SETTINGS.support_whatsapp);
  const msg = customMessage || DEFAULT_PLATFORM_SETTINGS.support_whatsapp_message;
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(msg)}`;
}

/**
 * Récupère les paramètres de la plateforme depuis Cloudflare D1 (avec repli local)
 */
export async function getAppSettings() {
  try {
    const res = await fetch(`${API_BASE}/settings`, {
      headers: { 'Accept': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.settings) {
        try {
          localStorage.setItem('rg_platform_settings', JSON.stringify(data.settings));
        } catch (_) {}
        return { ...DEFAULT_PLATFORM_SETTINGS, ...data.settings };
      }
    }
  } catch (err) {
    console.warn('[getAppSettings] Erreur réseau:', err);
  }

  // Repli sur le cache local
  try {
    const cached = localStorage.getItem('rg_platform_settings');
    if (cached) {
      return { ...DEFAULT_PLATFORM_SETTINGS, ...JSON.parse(cached) };
    }
  } catch (_) {}

  return { ...DEFAULT_PLATFORM_SETTINGS };
}

/**
 * Enregistre les paramètres modifiés dans Cloudflare D1 et notifie l'application
 */
export async function saveAppSettings(newSettings) {
  if (!newSettings || typeof newSettings !== 'object') return null;

  try {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings),
    });

    if (res.ok) {
      const data = await res.json();
      const updated = data.settings || newSettings;
      try {
        localStorage.setItem('rg_platform_settings', JSON.stringify(updated));
      } catch (_) {}

      // Émettre un événement pour mise à jour réactive immédiate des vues ouvertes
      window.dispatchEvent(new CustomEvent('rg:settings-updated', { detail: { settings: updated } }));

      return { success: true, settings: updated };
    }
  } catch (err) {
    console.warn('[saveAppSettings] Erreur réseau:', err);
  }

  // Sauvegarde locale de secours si l'API est injoignable
  try {
    const existing = JSON.parse(localStorage.getItem('rg_platform_settings') || '{}');
    const merged = { ...DEFAULT_PLATFORM_SETTINGS, ...existing, ...newSettings };
    localStorage.setItem('rg_platform_settings', JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent('rg:settings-updated', { detail: { settings: merged } }));
    return { success: true, settings: merged, fallback: true };
  } catch (_) {
    return { success: false };
  }
}
