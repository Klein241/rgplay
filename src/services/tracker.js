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
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const TZ_MAP = {
      'Africa/Douala': 'CM',
      'Africa/Lagos': 'NG',
      'Africa/Abidjan': 'CI',
      'Africa/Dakar': 'SN',
      'Africa/Libreville': 'GA',
      'Africa/Brazzaville': 'CG',
      'Africa/Kinshasa': 'CD',
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
    const lang = navigator.language || '';
    if (lang.includes('-')) {
      const code = lang.split('-')[1].toUpperCase();
      if (code.length === 2) return code;
    }
  } catch (_) {}
  return 'CM'; // Zone francophone d'Afrique centrale par défaut
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

function getUserInfo() {
  try {
    const prof = JSON.parse(localStorage.getItem('rg_user_profile') || '{}');
    const gam = JSON.parse(localStorage.getItem('rg_gamification_state') || '{}');
    return {
      user_id: prof.id || null,
      user_name: prof.name || null,
      user_email: prof.email || null,
      points: gam.points || prof.points || 0,
    };
  } catch {
    return { points: 0 };
  }
}

// ─── Envoie un événement au backend ───────────────────────────────────────
async function sendEventToBackend(payload) {
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

  // Sync backend immédiat
  sendEventToBackend({
    type: 'session_start',
    source: _source,
    device,
    country,
    country_name: countryName,
    landing_url: window.location.href,
  });

  // Heartbeat régulier pour maintenir le temps passé dans l'app
  if (!_heartbeatTimer) {
    _heartbeatTimer = setInterval(() => {
      if (_sessionId && _visitorId) {
        sendEventToBackend({ type: 'heartbeat' });
      }
    }, 45000);
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
  const audioPlayEvents = events.filter(e => e.type === 'audio_play' || e.action === 'audio_play');
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
  const countryCounts = {};
  sessions.forEach(s => {
    const c = (s.country || detectCountry() || 'CM').toUpperCase();
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

  const campaigns = Object.values(campaignsMap).map(c => ({
    ...c,
    ctr: c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(1) : '0.0',
    vtr: c.impressions > 0 ? ((c.completions / c.impressions) * 100).toFixed(1) : '0.0',
  }));

  const totalAdPoints = adCompletions.reduce((acc, e) => acc + Number(e.extra_data?.pointsAwarded || e.extra_data?.rewardPoints || 30), 0);
  const totalImpr = adImpressions.length;
  const totalClks = adClicks.length;

  const adStats = {
    impressions: totalImpr,
    clicks: totalClks,
    completions: adCompletions.length,
    ctr: totalImpr > 0 ? ((totalClks / totalImpr) * 100).toFixed(1) : '0.0',
    vtr: totalImpr > 0 ? ((adCompletions.length / Math.max(1, totalImpr)) * 100).toFixed(1) : '0.0',
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

  return {
    uniqueVisitors,
    todayVisitors,
    sources,
    countries,
    topAudios,
    adStats,
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
