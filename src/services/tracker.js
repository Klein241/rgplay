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

// ─── Envoie un événement au backend ───────────────────────────────────────
async function sendEventToBackend(payload) {
  try {
    await fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch (_) {
    // Silencieux — les données sont déjà sauvegardées en localStorage
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  API PUBLIQUE DU TRACKER
// ═══════════════════════════════════════════════════════════════════════════

let _sessionId = null;
let _visitorId = null;
let _source    = null;

/**
 * Initialise le tracker au premier chargement de l'app.
 * Crée ou récupère la session en cours.
 */
export function initTracker() {
  if (typeof window === 'undefined') return;

  _visitorId = getOrCreateVisitorId();
  _source    = detectSource();
  const device = detectDevice();
  _sessionId = 'sess_' + Date.now().toString(36);

  const session = {
    session_id:  _sessionId,
    visitor_id:  _visitorId,
    source:      _source,
    device,
    referrer:    document.referrer || '',
    landing_url: window.location.href,
    started_at:  Date.now(),
    events:      [],
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));

  // Persister dans la liste des sessions
  const sessions = loadSessions();
  sessions.unshift(session);
  saveSessions(sessions);

  // Sync backend
  sendEventToBackend({ type: 'session_start', visitor_id: _visitorId, session_id: _sessionId, source: _source, device, landing_url: window.location.href });
}

/**
 * Enregistre une page vue (ex: 'discover', 'library', 'profile', 'player').
 */
export function trackPageView(page) {
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
  if (!_visitorId || !book) return;
  const event = {
    type:            'audio_play',
    visitor_id:      _visitorId,
    session_id:      _sessionId,
    audiobook_id:    book.id,
    audiobook_title: book.title,
    chapter_id:      chapter?.id || null,
    chapter_title:   chapter?.title || null,
    seconds_listened: Math.round(secondsListened),
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
  const audioPlayEvents = events.filter(e => e.type === 'audio_play');
  const audioPlays = {};
  audioPlayEvents.forEach(e => {
    if (!audioPlays[e.audiobook_id]) audioPlays[e.audiobook_id] = { id: e.audiobook_id, title: e.audiobook_title, plays: 0, seconds: 0 };
    audioPlays[e.audiobook_id].plays   += 1;
    audioPlays[e.audiobook_id].seconds += e.seconds_listened || 0;
  });
  const topAudios = Object.values(audioPlays).sort((a, b) => b.plays - a.plays).slice(0, 10);

  // Profil de chaque visiteur récent
  const visitorMap = {};
  sessions.forEach(s => {
    if (!visitorMap[s.visitor_id]) {
      visitorMap[s.visitor_id] = { ...s, sessions_count: 0, audios: [], actions: [] };
    }
    visitorMap[s.visitor_id].sessions_count++;
  });
  events.forEach(e => {
    if (!visitorMap[e.visitor_id]) return;
    if (e.type === 'audio_play') visitorMap[e.visitor_id].audios.push(e);
    if (e.type === 'action')     visitorMap[e.visitor_id].actions.push(e);
  });
  const recentVisitors = Object.values(visitorMap)
    .sort((a, b) => b.started_at - a.started_at)
    .slice(0, 50);

  // Taux de conversion (achat / visiteur)
  const buyClicks  = events.filter(e => e.type === 'action' && e.action === 'buy_click').length;
  const convRate   = uniqueVisitors > 0 ? ((buyClicks / uniqueVisitors) * 100).toFixed(1) : '0.0';

  return { uniqueVisitors, todayVisitors, sources, topAudios, recentVisitors, sessions, events, convRate };
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
