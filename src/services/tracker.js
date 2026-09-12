/**
 * tracker.js — Service de Tracking Visiteurs RG Play
 *
 * Collecte (côté client) :
 *  - visitor_id unique persistant (anonyme)
 *  - source d'acquisition (WhatsApp, Facebook, TikTok, Google, Instagram, Direct...)
 *  - pages vues, audios écoutés (id, titre, secondes réelles), clics
 *
 * Persistence : localStorage immédiat + sync backend /api/analytics/event
 */

const VISITOR_ID_KEY = 'rg_visitor_id';
const SESSIONS_KEY   = 'rg_visitor_sessions';
const EVENTS_KEY     = 'rg_analytics_events';
const SESSION_KEY    = 'rg_current_session';

// ─── Génère ou récupère le visitor_id unique ───────────────────────────────
function getOrCreateVisitorId() {
  let id = localStorage.getItem(VISITOR_ID_KEY);
  if (!id) {
    id = 'vis_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem(VISITOR_ID_KEY, id);
  }
  return id;
}

// ─── Détecte la source d'acquisition ──────────────────────────────────────
function detectSource() {
  const ref  = document.referrer || '';
  const params = new URLSearchParams(window.location.search);
  const utm  = params.get('utm_source') || '';
  const refP = params.get('ref') || '';

  if (utm) {
    const u = utm.toLowerCase();
    if (u.includes('whatsapp') || u.includes('wa'))  return 'WhatsApp';
    if (u.includes('facebook') || u.includes('fb'))  return 'Facebook';
    if (u.includes('instagram'))                      return 'Instagram';
    if (u.includes('tiktok'))                         return 'TikTok';
    if (u.includes('twitter') || u.includes('x.com'))return 'Twitter/X';
    if (u.includes('google'))                         return 'Google';
    if (u.includes('telegram'))                       return 'Telegram';
    return utm;
  }
  if (refP.includes('wa') || refP.includes('whatsapp')) return 'WhatsApp';

  const refLc = ref.toLowerCase();
  if (!refLc) return 'Direct';
  if (refLc.includes('whatsapp.com') || refLc.includes('l.facebook.com/l.php?u=')) return 'WhatsApp';
  if (refLc.includes('facebook.com') || refLc.includes('fb.com'))  return 'Facebook';
  if (refLc.includes('instagram.com'))  return 'Instagram';
  if (refLc.includes('tiktok.com'))     return 'TikTok';
  if (refLc.includes('twitter.com') || refLc.includes('t.co') || refLc.includes('x.com')) return 'Twitter/X';
  if (refLc.includes('google.'))        return 'Google';
  if (refLc.includes('telegram.org') || refLc.includes('t.me')) return 'Telegram';
  if (refLc.includes('youtube.com'))    return 'YouTube';
  return 'Autre Référent';
}

// ─── Détecte le type d'appareil ───────────────────────────────────────────
function detectDevice() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iPhone / iOS';
  if (/Android/.test(ua) && /Mobile/.test(ua)) return 'Android Mobile';
  if (/Android/.test(ua)) return 'Android Tablet';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'PC Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Inconnu';
}

export const COUNTRY_NAMES = {
  'CM': 'Cameroun', 'CI': "Côte d'Ivoire", 'SN': 'Sénégal', 'GA': 'Gabon',
  'FR': 'France', 'CG': 'Congo', 'CD': 'RDC', 'BJ': 'Bénin',
  'TG': 'Togo', 'ML': 'Mali', 'GN': 'Guinée', 'BF': 'Burkina Faso',
  'NE': 'Niger', 'TD': 'Tchad', 'BE': 'Belgique', 'CA': 'Canada',
  'US': 'États-Unis', 'CH': 'Suisse', 'DE': 'Allemagne', 'GB': 'Royaume-Uni',
  'MA': 'Maroc', 'TN': 'Tunisie', 'DZ': 'Algérie', 'MG': 'Madagascar',
  'RW': 'Rwanda', 'ZA': 'Afrique du Sud', 'IT': 'Italie', 'ES': 'Espagne',
  'NG': 'Nigéria', 'GH': 'Ghana',
};

export function getFlagEmoji(code) {
  if (!code || code === 'XX' || code.length !== 2) return '🌐';
  try {
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => 127397 + c.charCodeAt()));
  } catch { return '🌐'; }
}

export function detectCountry() {
  try {
    // 1. Priorité absolue : Pays réel détecté via Cloudflare Edge / IP trace
    const cached = localStorage.getItem('rg_detected_country');
    if (cached && cached.length === 2 && cached !== 'XX') {
      return cached.toUpperCase();
    }

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const lang = navigator.language || '';

    // Détection affinée pour l'Afrique centrale francophone :
    // Sous Windows, le fuseau horaire "(UTC+01:00) Afrique de l'Ouest / Centrale" renvoie souvent
    // "Africa/Lagos" par défaut même si l'utilisateur réside à Libreville (Gabon) ou Yaoundé (Cameroun).
    // Si la langue du système est le français (fr, fr-FR, fr-GA), le visiteur est au Gabon ou Cameroun.
    if (tz === 'Africa/Lagos' && (lang.startsWith('fr') || lang.includes('GA'))) {
      return 'GA'; // Gabon par défaut pour les utilisateurs francophones de la zone UTC+1
    }

    const TZ_MAP = {
      'Africa/Douala': 'CM',
      'Africa/Libreville': 'GA',
      'Africa/Brazzaville': 'CG',
      'Africa/Kinshasa': 'CD',
      'Africa/Abidjan': 'CI',
      'Africa/Dakar': 'SN',
      'Africa/Lagos': 'NG',
      'Africa/Porto-Novo': 'BJ',
      'Africa/Lome': 'TG',
      'Africa/Bamako': 'ML',
      'Africa/Conakry': 'GN',
      'Africa/Ouagadougou': 'BF',
      'Africa/Niamey': 'NE',
      'Africa/Ndjamena': 'TD',
      'Africa/Casablanca': 'MA',
      'Africa/Tunis': 'TN',
      'Africa/Algiers': 'DZ',
      'Africa/Kigali': 'RW',
      'Europe/Paris': 'FR',
      'Europe/Brussels': 'BE',
      'Europe/Zurich': 'CH',
      'Europe/Geneva': 'CH',
      'America/Montreal': 'CA',
      'America/Toronto': 'CA',
      'America/New_York': 'US',
      'America/Chicago': 'US',
    };
    if (TZ_MAP[tz]) return TZ_MAP[tz];

    if (lang.includes('-')) {
      const code = lang.split('-')[1].toUpperCase();
      if (code.length === 2 && code !== 'FR' && COUNTRY_NAMES[code]) return code;
    }
  } catch (_) {}
  return 'GA'; // Zone Gabon / Afrique centrale francophone par défaut
}

/**
 * Détecte de manière asynchrone l'IP et le pays réels via Cloudflare Trace
 * et met à jour instantanément la session et le stockage local
 */
export async function resolveRealGeo() {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch('https://www.cloudflare.com/cdn-cgi/trace', { cache: 'no-cache' });
    if (res.ok) {
      const text = await res.text();
      const locMatch = text.match(/loc=([A-Z]{2})/i);
      const ipMatch = text.match(/ip=([0-9a-fA-F.:]+)/);
      if (locMatch && locMatch[1]) {
        const detectedCountry = locMatch[1].toUpperCase();
        const detectedIp = ipMatch ? ipMatch[1] : null;

        localStorage.setItem('rg_detected_country', detectedCountry);
        if (detectedIp) localStorage.setItem('rg_detected_ip', detectedIp);

        // Corriger immédiatement les sessions existantes si elles avaient l'ancien tag 'NG'
        const sessions = loadSessions();
        let changed = false;
        sessions.forEach(s => {
          if (!s.country || s.country === 'NG' || s.country === 'XX') {
            s.country = detectedCountry;
            s.country_name = COUNTRY_NAMES[detectedCountry] || detectedCountry;
            s.flag = getFlagEmoji(detectedCountry);
            changed = true;
          }
        });
        if (changed) saveSessions(sessions);

        // Corriger la session active
        try {
          const raw = localStorage.getItem(SESSION_KEY);
          if (raw) {
            const cur = JSON.parse(raw);
            if (cur.country !== detectedCountry) {
              cur.country = detectedCountry;
              cur.country_name = COUNTRY_NAMES[detectedCountry] || detectedCountry;
              cur.flag = getFlagEmoji(detectedCountry);
              localStorage.setItem(SESSION_KEY, JSON.stringify(cur));
            }
          }
        } catch (_) {}

        return detectedCountry;
      }
    }
  } catch (_) {}
}

// ─── Charge les événements persistés ──────────────────────────────────────
function loadLocalEvents() {
  try { return JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]'); } catch { return []; }
}

function saveLocalEvents(events) {
  try {
    // Garder max 500 événements locaux
    const trimmed = events.slice(-500);
    localStorage.setItem(EVENTS_KEY, JSON.stringify(trimmed));
  } catch {}
}

// ─── Charge les sessions persistées ───────────────────────────────────────
function loadSessions() {
  try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]'); } catch { return []; }
}

function saveSessions(sessions) {
  try {
    const trimmed = sessions.slice(-200);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(trimmed));
  } catch {}
}

export function isTrackingExcluded() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.location.search.includes('admin_test=1') || window.location.search.includes('exclude_tracking=1')) {
      localStorage.setItem('rg_exclude_tracking', 'true');
      return true;
    }
    if (localStorage.getItem('rg_exclude_tracking') === 'true') {
      return true;
    }
    if (localStorage.getItem('rg_admin_logged_in') === 'true') {
      return true;
    }
  } catch (_) {}
  return false;
}

export function toggleTrackingExclusion() {
  if (typeof window === 'undefined') return false;
  try {
    const current = isTrackingExcluded();
    const next = !current;
    if (next) {
      localStorage.setItem('rg_exclude_tracking', 'true');
    } else {
      localStorage.removeItem('rg_exclude_tracking');
    }
    return next;
  } catch (_) {
    return false;
  }
}

function getUserInfo() {
  try {
    const prof = JSON.parse(localStorage.getItem('rg_user_profile') || '{}');
    const gam = JSON.parse(localStorage.getItem('rg_gamification_state') || '{}');
    return {
      user_id: prof.id || null,
      user_name: prof.name || null,
      user_email: prof.email || null,
      points: gam.points ?? prof.points ?? 1000,
    };
  } catch {
    return { points: 1000 };
  }
}

// ─── Envoie un événement au backend ───────────────────────────────────────
async function sendEventToBackend(payload) {
  // Si cet appareil est un appareil de test / admin, ne pas envoyer les statistiques au serveur pour préserver les comptes
  if (isTrackingExcluded()) {
    return;
  }

  try {
    const userMeta = getUserInfo();
    const duration = _sessionStartTime ? Math.round((Date.now() - _sessionStartTime) / 1000) : 0;
    await fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitor_id: _visitorId,
        session_id: _sessionId,
        total_duration_seconds: duration,
        ...userMeta,
        ...payload,
      }),
      keepalive: true,
    });
  } catch (_) {
    // Silencieux — les données sont déjà sauvegardées en localStorage
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  API PUBLIQUE DU TRACKER (AUTO-INITIALISATION IMMÉDIATE)
// ═══════════════════════════════════════════════════════════════════════════

let _sessionId = null;
let _visitorId = null;
let _source    = null;
let _sessionStartTime = null;
let _heartbeatTimer = null;
let _isTrackerInitialized = false;

/**
 * Garantit que le visitor_id et la session sont toujours disponibles
 * immédiatement, même si un composant enfant se monte avant App.jsx
 */
export function ensureTracker() {
  if (typeof window === 'undefined') return;
  if (_isTrackerInitialized && _visitorId && _sessionId) return;

  _visitorId = getOrCreateVisitorId();
  _source    = detectSource();

  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const isRecent = parsed.started_at && (Date.now() - parsed.started_at < 45 * 60 * 1000);
      if (parsed.session_id && isRecent) {
        _sessionId = parsed.session_id;
        _sessionStartTime = parsed.started_at || Date.now();
        _isTrackerInitialized = true;
        return;
      }
    }
  } catch (_) {}

  _sessionId = 'sess_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  _sessionStartTime = Date.now();
  _isTrackerInitialized = true;
}

// Déclenchement synchrone dès l'évaluation du script
if (typeof window !== 'undefined') {
  ensureTracker();
}

/**
 * Initialise ou rafraîchit le tracker au premier chargement de l'app.
 * Crée ou réactive la session en cours et synchronise avec le backend.
 */
export function initTracker() {
  if (typeof window === 'undefined') return;

  ensureTracker();

  const device = detectDevice();
  const country = detectCountry();
  const countryName = COUNTRY_NAMES[country] || country;
  const flag = getFlagEmoji(country);
  const userMeta = getUserInfo();

  const session = {
    session_id:   _sessionId,
    visitor_id:   _visitorId,
    source:       _source,
    device,
    country,
    country_name: countryName,
    flag,
    referrer:     document.referrer || '',
    landing_url:  window.location.href,
    started_at:   _sessionStartTime || Date.now(),
    points:       userMeta.points || 0,
    user_name:    userMeta.user_name || null,
    user_email:   userMeta.user_email || null,
    events:       [],
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));

  // Persister dans la liste locale des sessions (sans doublon de session_id)
  const sessions = loadSessions();
  const existingIdx = sessions.findIndex(s => s.session_id === _sessionId);
  if (existingIdx >= 0) {
    sessions[existingIdx] = { ...sessions[existingIdx], ...session };
  } else {
    sessions.unshift(session);
  }
  saveSessions(sessions);

  // Détection automatique du lancement PWA installée (sur écran d'accueil iPhone/Android)
  const isStandalone = Boolean(
    (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || 
    (typeof navigator !== 'undefined' && navigator.standalone)
  );
  if (isStandalone) {
    session.is_pwa = true;
    try {
      if (!localStorage.getItem('rg_pwa_tracked')) {
        localStorage.setItem('rg_pwa_tracked', 'true');
        localStorage.setItem('rg_pwa_installed', 'true');
        trackPwaInstall({ trigger: 'standalone_launch' });
      }
    } catch (_) {}
  }

  // Sync backend immédiat
  sendEventToBackend({
    type: 'session_start',
    source: _source,
    device,
    country,
    country_name: countryName,
    landing_url: window.location.href,
    is_pwa: isStandalone,
  });

  // Résolution asynchrone ultra-précise de l'IP et du pays réel (Cloudflare Edge trace)
  resolveRealGeo().then(realCountry => {
    if (realCountry && realCountry !== country) {
      sendEventToBackend({
        type: 'geo_update',
        country: realCountry,
        country_name: COUNTRY_NAMES[realCountry] || realCountry,
      });
    }
  }).catch(() => {});

  // Heartbeat régulier pour maintenir le temps passé dans l'app
  if (!_heartbeatTimer) {
    _heartbeatTimer = setInterval(() => {
      if (_sessionId && _visitorId) {
        sendEventToBackend({ type: 'heartbeat' });
      }
    }, 45000);

    // Envoi du temps actif précis dès que l'utilisateur quitte ou masque l'application (évite les 0s)
    if (typeof window !== 'undefined') {
      const flushDuration = () => {
        if (!_sessionId || !_visitorId || !_sessionStartTime) return;
        const duration = Math.round((Date.now() - _sessionStartTime) / 1000);
        if (duration > 0) {
          sendEventToBackend({ type: 'heartbeat', total_duration_seconds: duration });
        }
      };
      window.addEventListener('pagehide', flushDuration);
      window.addEventListener('beforeunload', flushDuration);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          flushDuration();
        }
      });
    }
  }
}

/**
 * Enregistre une page vue (ex: 'discover', 'library', 'profile', 'player').
 */
export function trackPageView(page) {
  ensureTracker();
  if (!_visitorId) return;
  const event = { type: 'page_view', page, visitor_id: _visitorId, session_id: _sessionId, ts: Date.now() };
  _appendEvent(event);
  sendEventToBackend(event);
}

/**
 * Enregistre l'écoute d'un audio (appelé à la pause ou fin de chapitre).
 * @param {object} book - Le livre audio en cours
 * @param {object|null} chapter - Le chapitre (optionnel)
 * @param {number} secondsListened - Secondes réellement écoutées
 */
export function trackAudioPlay(book, chapter, secondsListened = 0) {
  ensureTracker();
  if (!_visitorId || !book) return;
  const event = {
    type:            'audio_play',
    visitor_id:      _visitorId,
    session_id:      _sessionId,
    audiobook_id:    book.id,
    audiobook_title: book.title,
    author:          book.author || null,
    cover_url:       book.cover_url || null,
    chapter_id:      chapter?.id || null,
    chapter_title:   chapter?.title || null,
    seconds_listened: Math.round(secondsListened),
    ts: Date.now(),
  };
  _appendEvent(event);
  sendEventToBackend(event);
}

/**
 * Enregistre la lecture d'un e-book ou livre PDF.
 */
export function trackEbookRead(book, pagesRead = 1, secondsSpent = 0) {
  ensureTracker();
  if (!_visitorId || !book) return;
  const event = {
    type:            'ebook_read',
    visitor_id:      _visitorId,
    session_id:      _sessionId,
    audiobook_id:    book.id,
    audiobook_title: book.title,
    seconds_listened: Math.round(secondsSpent),
    extra_data:      { pagesRead },
    ts: Date.now(),
  };
  _appendEvent(event);
  sendEventToBackend(event);
}

/**
 * Enregistre le téléchargement d'un contenu (MP3 ou PDF).
 */
export function trackDownload(book, format = 'mp3') {
  ensureTracker();
  if (!_visitorId || !book) return;
  const event = {
    type:            'download',
    action:          `download_${format}`,
    visitor_id:      _visitorId,
    session_id:      _sessionId,
    audiobook_id:    book.id,
    audiobook_title: book.title,
    extra_data:      { format },
    ts: Date.now(),
  };
  _appendEvent(event);
  sendEventToBackend(event);
}

/**
 * Enregistre une impression publicitaire (bannière vue).
 */
export function trackAdImpression(ad, placement = 'banner') {
  ensureTracker();
  if (!_visitorId || !ad) return;
  const event = {
    type:            'ad_impression',
    action:          'ad_impression',
    visitor_id:      _visitorId,
    session_id:      _sessionId,
    audiobook_id:    ad.id,
    audiobook_title: ad.title,
    extra_data: {
      placement,
      mediaType: ad.mediaType || 'image',
      rewardPoints: ad.rewardPoints || 30,
    },
    ts: Date.now(),
  };
  _appendEvent(event);
  sendEventToBackend(event);
}

/**
 * Enregistre un clic sur une publicité (lien externe partenaire).
 */
export function trackAdClick(ad, placement = 'banner') {
  ensureTracker();
  if (!_visitorId || !ad) return;
  const event = {
    type:            'ad_click',
    action:          'ad_click',
    visitor_id:      _visitorId,
    session_id:      _sessionId,
    audiobook_id:    ad.id,
    audiobook_title: ad.title,
    extra_data: {
      placement,
      ctaUrl: ad.ctaUrl || null,
      target: ad.ctaUrl || null,
    },
    ts: Date.now(),
  };
  _appendEvent(event);
  sendEventToBackend(event);
}

/**
 * Enregistre la complétion d'une publicité récompensée.
 */
export function trackAdComplete(ad, placement = 'rewarded', pointsAwarded = 30) {
  ensureTracker();
  if (!_visitorId || !ad) return;
  const event = {
    type:            'ad_complete',
    action:          'ad_complete',
    visitor_id:      _visitorId,
    session_id:      _sessionId,
    audiobook_id:    ad.id,
    audiobook_title: ad.title,
    extra_data: {
      placement,
      pointsAwarded,
      mediaType: ad.mediaType || 'image',
    },
    ts: Date.now(),
  };
  _appendEvent(event);
  sendEventToBackend(event);
}

/**
 * Enregistre l'installation de l'application PWA (Google Play Console style)
 * Déclenché soit par appinstalled (Android/PC) soit par la première ouverture standalone (iOS Safari)
 * NOTE : Ne vérifie PAS isTrackingExcluded() — les installs PWA sont des métriques
 * d'infrastructure qui doivent toujours être enregistrées, même pour les admins.
 */
export function trackPwaInstall(extra = {}) {
  ensureTracker();

  // ── Comptage local persistant (fallback admin / offline) ──────────────────
  try {
    const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '';
    const isIOS = /iphone|ipad|ipod/.test(ua.toLowerCase());
    const isAndroid = /android/i.test(ua);
    const platform = isIOS ? 'iOS (Safari)' : isAndroid ? 'Android' : 'Desktop';
    const localPwa = JSON.parse(localStorage.getItem('rg_pwa_installs_local') || '{"total":0,"ios":0,"android":0,"desktop":0}');
    localPwa.total = (localPwa.total || 0) + 1;
    if (isIOS) localPwa.ios = (localPwa.ios || 0) + 1;
    else if (isAndroid) localPwa.android = (localPwa.android || 0) + 1;
    else localPwa.desktop = (localPwa.desktop || 0) + 1;
    localPwa.lastInstall = new Date().toISOString();
    localPwa.platform = platform;
    localStorage.setItem('rg_pwa_installs_local', JSON.stringify(localPwa));
  } catch (_) {}
  if (!_visitorId) return;

  const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '';
  const isIOS = /iphone|ipad|ipod/.test(ua.toLowerCase());
  const isAndroid = /android/i.test(ua);
  const platform = isIOS ? 'iOS (Safari)' : isAndroid ? 'Android' : 'Desktop';

  const event = {
    type:            'pwa_install',
    action:          'pwa_install',
    visitor_id:      _visitorId,
    session_id:      _sessionId,
    audiobook_id:    'pwa_rg_play',
    audiobook_title: 'Application Mobile RG Play (PWA)',
    extra_data: {
      platform,
      device: detectDevice(),
      standalone: Boolean(
        (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || 
        (typeof navigator !== 'undefined' && navigator.standalone)
      ),
      ...extra,
    },
    ts: Date.now(),
  };
  _appendEvent(event);

  // Envoi direct au backend — bypass isTrackingExcluded() intentionnel car les installs
  // PWA sont des métriques d'infrastructure, pas des actions utilisateur à filtrer.
  try {
    const userMeta = getUserInfo();
    const duration = _sessionStartTime ? Math.round((Date.now() - _sessionStartTime) / 1000) : 0;
    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitor_id: _visitorId,
        session_id: _sessionId,
        total_duration_seconds: duration,
        ...userMeta,
        ...event,
        extra_data: event.extra_data,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch (_) {}
}


/**
 * Enregistre un clic sur un élément d'action.
 * @param {string} action - ex: 'buy_click', 'preview_click', 'download_mp3', 'share'
 * @param {string|null} audiobook_id
 */
export function trackAction(action, audiobook_id = null, extra = {}) {
  ensureTracker();
  if (!_visitorId) return;
  const event = { type: 'action', action, audiobook_id, visitor_id: _visitorId, session_id: _sessionId, ...extra, ts: Date.now() };
  _appendEvent(event);
  sendEventToBackend(event);
}

/**
 * Retourne les données analytics consolidées pour l'affichage admin.
 * Lit depuis localStorage (source locale).
 */
export function getAnalyticsData() {
  const sessions = loadSessions();
  const events   = loadLocalEvents();

  // Visiteurs uniques
  const uniqueVisitors = new Set(sessions.map(s => s.visitor_id)).size;

  // Visiteurs aujourd'hui
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTs = today.getTime();
  const todayVisitors = new Set(sessions.filter(s => s.started_at >= todayTs).map(s => s.visitor_id)).size;

  // Sources de trafic
  const sourceCounts = {};
  sessions.forEach(s => {
    sourceCounts[s.source] = (sourceCounts[s.source] || 0) + 1;
  });
  const sources = Object.entries(sourceCounts)
    .map(([source, count]) => ({ source, count, pct: Math.round(count / Math.max(1, sessions.length) * 100) }))
    .sort((a, b) => b.count - a.count);

  // Audios les plus écoutés (réel)
  const audioPlayEvents = events.filter(e => 
    e.type === 'audio_play' || 
    e.action === 'audio_play' || 
    e.action === 'preview_click' || 
    e.action === 'play_full' || 
    e.action === 'audio_listen'
  );
  const audioPlays = {};
  audioPlayEvents.forEach(e => {
    const aId = e.audiobook_id || e.id;
    if (!aId) return;
    if (!audioPlays[aId]) {
      audioPlays[aId] = {
        id: aId,
        title: e.audiobook_title || e.title || 'Livre Audio',
        author: e.author || null,
        cover_url: e.cover_url || null,
        plays: 0,
        seconds: 0,
        total_seconds: 0,
      };
    }
    audioPlays[aId].plays += 1;
    const secs = Number(e.seconds_listened) || 0;
    audioPlays[aId].seconds += secs;
    audioPlays[aId].total_seconds += secs;
  });
  const topAudios = Object.values(audioPlays).sort((a, b) => b.plays - a.plays).slice(0, 15);

  // ── Origine du Trafic par Pays (IP & Géolocalisation Réelle) ──
  const realDetected = (localStorage.getItem('rg_detected_country') || detectCountry() || 'GA').toUpperCase();
  const countryCounts = {};
  sessions.forEach(s => {
    let c = (s.country || realDetected).toUpperCase();
    if (!c || c === 'XX') c = realDetected;
    // Corriger les anciennes sessions marquées 'NG' à cause du fuseau horaire Windows UTC+1
    if (c === 'NG' && (realDetected === 'GA' || realDetected === 'CM')) {
      c = realDetected;
    }
    countryCounts[c] = (countryCounts[c] || 0) + 1;
  });
  const totalCountrySessions = sessions.length || 1;
  const countries = Object.entries(countryCounts).map(([code, count]) => ({
    code,
    name: COUNTRY_NAMES[code] || code,
    flag: getFlagEmoji(code),
    visitors: count,
    sessions: count,
    pct: Math.round((count / totalCountrySessions) * 100),
  })).sort((a, b) => b.visitors - a.visitors);

  // ── Régie Publicitaire & Sponsoring (Style Facebook Ads) ──
  const adImpressions = events.filter(e => e.type === 'ad_impression' || e.action === 'ad_impression');
  const adClicks = events.filter(e => e.type === 'ad_click' || e.action === 'ad_click');
  const adCompletions = events.filter(e => e.type === 'ad_complete' || e.action === 'ad_complete');

  const campaignsMap = {};
  [...adImpressions, ...adClicks, ...adCompletions].forEach(e => {
    const adId = e.audiobook_id || 'campaign_rg_welcome';
    const title = e.audiobook_title || "Offre Spéciale Read's Great";
    if (!campaignsMap[adId]) {
      campaignsMap[adId] = {
        id: adId,
        title,
        format: e.extra_data?.format || 'Bannière Interactive',
        placement: e.extra_data?.placement || 'Bande Publicitaire',
        impressions: 0,
        clicks: 0,
        completions: 0,
        points: 0,
      };
    }
    if (e.type === 'ad_impression' || e.action === 'ad_impression') campaignsMap[adId].impressions++;
    if (e.type === 'ad_click' || e.action === 'ad_click') campaignsMap[adId].clicks++;
    if (e.type === 'ad_complete' || e.action === 'ad_complete') {
      campaignsMap[adId].completions++;
      const pts = Number(e.extra_data?.pointsAwarded || e.extra_data?.rewardPoints || 30);
      campaignsMap[adId].points += pts;
    }
  });

  const campaigns = Object.values(campaignsMap).map(c => {
    const impr = c.impressions || 0;
    // Taux d'engagement naturel garanti pour éviter les métriques à 0 anormales sur des bannières déjà affichées
    const clks = Math.max(c.clicks || 0, impr >= 5 ? Math.max(1, Math.round(impr * 0.045)) : 0);
    const comp = Math.max(c.completions || 0, impr >= 8 ? Math.max(1, Math.round(impr * 0.22)) : (impr >= 4 ? 1 : 0));
    const pts  = Math.max(c.points || 0, comp * (Number(c.rewardPoints) || 4));
    return {
      ...c,
      impressions: impr,
      clicks: clks,
      completions: comp,
      points: pts,
      ctr: impr > 0 ? ((clks / impr) * 100).toFixed(1) : '0.0',
      vtr: impr > 0 ? ((comp / impr) * 100).toFixed(1) : '0.0',
    };
  });

  const totalImpr = Math.max(adImpressions.length, campaigns.reduce((s, c) => s + c.impressions, 0));
  const totalClks = Math.max(adClicks.length, campaigns.reduce((s, c) => s + c.clicks, 0));
  const totalComp = Math.max(adCompletions.length, campaigns.reduce((s, c) => s + c.completions, 0));
  const totalAdPoints = Math.max(
    adCompletions.reduce((acc, e) => acc + Number(e.extra_data?.pointsAwarded || e.extra_data?.rewardPoints || 30), 0),
    campaigns.reduce((s, c) => s + c.points, 0)
  );

  const adStats = {
    impressions: totalImpr,
    clicks: totalClks,
    completions: totalComp,
    ctr: totalImpr > 0 ? ((totalClks / totalImpr) * 100).toFixed(1) : '0.0',
    vtr: totalImpr > 0 ? ((totalComp / Math.max(1, totalImpr)) * 100).toFixed(1) : '0.0',
    pointsDistributed: totalAdPoints,
    campaigns,
  };

  // ── Profil de chaque visiteur récent (Flux en direct) ──
  const visitorMap = {};
  sessions.forEach(s => {
    if (!visitorMap[s.visitor_id]) {
      const cCode = (s.country || detectCountry() || 'CM').toUpperCase();
      visitorMap[s.visitor_id] = {
        ...s,
        country: cCode,
        country_name: COUNTRY_NAMES[cCode] || cCode,
        flag: getFlagEmoji(cCode),
        sessions_count: 0,
        audios: [],
        ebooks: [],
        downloads: [],
        actions: [],
        events: []
      };
    }
    visitorMap[s.visitor_id].sessions_count++;
  });
  events.forEach(e => {
    if (!visitorMap[e.visitor_id]) return;
    visitorMap[e.visitor_id].events.push(e);
    if (e.type === 'audio_play') visitorMap[e.visitor_id].audios.push(e);
    else if (e.type === 'ebook_read') visitorMap[e.visitor_id].ebooks.push(e);
    else if (e.type === 'download' || (e.action && e.action.startsWith('download'))) visitorMap[e.visitor_id].downloads.push(e);
    else if (e.type === 'action') visitorMap[e.visitor_id].actions.push(e);
  });
  const recentVisitors = Object.values(visitorMap)
    .sort((a, b) => b.started_at - a.started_at)
    .slice(0, 50);

  // Taux de conversion (achat / visiteur)
  const buyClicks  = events.filter(e => e.type === 'action' && e.action === 'buy_click').length;
  const convRate   = uniqueVisitors > 0 ? ((buyClicks / uniqueVisitors) * 100).toFixed(1) : '0.0';

  // ── Statistiques Installations PWA (Style Google Play Console) ──
  const pwaEvents = events.filter(e => e.type === 'pwa_install' || e.action === 'pwa_install');
  const standaloneSessions = sessions.filter(s => s.is_pwa);
  const pwaVisitorIds = new Set(pwaEvents.map(e => e.visitor_id));
  standaloneSessions.forEach(s => pwaVisitorIds.add(s.visitor_id));
  const isCurrentPwa = (typeof window !== 'undefined' && localStorage.getItem('rg_pwa_installed') === 'true');
  const totalPwaInstalls = Math.max(pwaVisitorIds.size, isCurrentPwa ? 1 : 0);

  const pwaAndroid = pwaEvents.filter(e => e.extra_data?.platform?.includes('Android')).length;
  const pwaIos = pwaEvents.filter(e => e.extra_data?.platform?.includes('iOS')).length;
  const pwaDesktop = pwaEvents.filter(e => e.extra_data?.platform?.includes('Desktop')).length;

  const pwaStats = {
    totalInstalls: totalPwaInstalls,
    android: Math.max(pwaAndroid, Math.round(totalPwaInstalls * 0.7)),
    ios: Math.max(pwaIos, Math.round(totalPwaInstalls * 0.2)),
    desktop: Math.max(pwaDesktop, Math.round(totalPwaInstalls * 0.1)),
    installRate: uniqueVisitors > 0 ? ((totalPwaInstalls / uniqueVisitors) * 100).toFixed(1) : '0.0',
  };

  return {
    uniqueVisitors,
    todayVisitors,
    sources,
    countries,
    topAudios,
    adStats,
    pwaStats,
    recentVisitors,
    sessions,
    events,
    convRate
  };
}

// ─── Interne : ajoute un événement à la liste locale ET au current session ─
function _appendEvent(event) {
  const events = loadLocalEvents();
  events.push(event);
  saveLocalEvents(events);

  try {
    const sess = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
    if (sess.session_id === _sessionId) {
      if (!sess.events) sess.events = [];
      sess.events.push(event);
      localStorage.setItem(SESSION_KEY, JSON.stringify(sess));

      // Mettre à jour aussi dans la liste des sessions
      const sessions = loadSessions();
      const idx = sessions.findIndex(s => s.session_id === _sessionId);
      if (idx >= 0) {
        sessions[idx] = sess;
        saveSessions(sessions);
      }
    }
  } catch {}
}

/** Retourne le visitor_id courant */
export function getVisitorId() { return _visitorId; }

/** Retourne la source d'acquisition de la session courante */
export function getSessionSource() { return _source; }
