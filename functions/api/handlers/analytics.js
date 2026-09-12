/**
 * functions/api/handlers/analytics.js
 * 
 * Gestionnaire modulaire RG Play pour les Analytics :
 * - Filtrage strict entre Visiteurs (Trafic / Rebond) et Utilisateurs Actifs (Écoutes / Points / Engagement)
 * - Métriques agrégées pour l'Admin Studio
 */

function jsonResponse(data, headers = {}, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

/**
 * GET /api/admin/analytics/visitors-vs-users
 * Renvoie séparément le flux des visiteurs de passage et le flux des utilisateurs engagés.
 */
export async function handleGetVisitorsVsUsers(request, env, corsHeaders) {
  if (!env.DB) {
    return jsonResponse({ visitors: [], activeUsers: [] }, corsHeaders);
  }

  try {
    // Récupérer les 100 dernières sessions avec leurs actions associées
    const { results: rawSessions } = await env.DB.prepare(`
      SELECT 
        vs.session_id,
        vs.visitor_id,
        vs.user_id,
        vs.source,
        vs.device,
        vs.country,
        vs.city,
        vs.ip,
        vs.total_duration_seconds,
        vs.started_at,
        vs.last_active_at,
        vs.points,
        vs.user_name,
        vs.user_email,
        u.phone AS user_phone,
        u.name AS registered_name
      FROM visitor_sessions vs
      LEFT JOIN users u ON vs.user_id = u.id OR vs.visitor_id = u.id
      ORDER BY vs.last_active_at DESC
      LIMIT 100
    `).all().catch(() => ({ results: [] }));

    // Pour chaque session, récupérer les événements audio/téléchargement
    const sessionIds = (rawSessions || []).map(s => s.session_id).filter(Boolean);
    let eventsBySession = {};

    if (sessionIds.length > 0) {
      const placeholders = sessionIds.map(() => '?').join(',');
      const { results: events } = await env.DB.prepare(`
        SELECT session_id, visitor_id, event_type, action, audiobook_id, audiobook_title
        FROM analytics_events
        WHERE session_id IN (${placeholders})
      `).bind(...sessionIds).all().catch(() => ({ results: [] }));

      (events || []).forEach(ev => {
        if (!eventsBySession[ev.session_id]) eventsBySession[ev.session_id] = [];
        eventsBySession[ev.session_id].push(ev);
      });
    }

    const visitors = [];
    const activeUsers = [];

    (rawSessions || []).forEach(s => {
      const evs = eventsBySession[s.session_id] || [];
      const audios = evs.filter(e => e.action === 'audio_play' || e.event_type === 'play' || e.action === 'audio_listen');
      const downloads = evs.filter(e => e.action === 'download_offline' || e.event_type === 'download');
      const hasPoints = (Number(s.points) || 0) > 0;
      const isRegistered = Boolean(s.user_phone || s.user_email || s.registered_name);
      const isEngaged = audios.length > 0 || downloads.length > 0 || hasPoints || isRegistered;

      const baseItem = {
        ...s,
        audios,
        downloads,
        actions: evs,
        has_whatsapp: Boolean(s.user_phone),
      };

      if (isEngaged) {
        activeUsers.push({
          ...baseItem,
          is_user: true,
          display_label: s.registered_name || s.user_name || `Utilisateur #${(s.visitor_id || 'user').slice(-6)}`,
        });
      } else {
        visitors.push({
          ...baseItem,
          is_user: false,
          display_label: `Visiteur #${(s.visitor_id || 'guest').slice(-6)}`,
        });
      }
    });

    return jsonResponse({
      success: true,
      visitors,
      activeUsers,
      totalVisitors: visitors.length,
      totalActiveUsers: activeUsers.length,
    }, corsHeaders);
  } catch (err) {
    console.error('Erreur getVisitorsVsUsers:', err);
    return jsonResponse({ visitors: [], activeUsers: [], error: err.message }, corsHeaders, 500);
  }
}
