import { sendFcmMessage } from './fcm.js';
import { sendWebPushNotification, DEFAULT_VAPID_KEYS } from './push.js';

/**
 * functions/api/handlers/social.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Gestionnaire d'Activités Sociales & Preuve Sociale en Temps Réel RG Play.
 * Enregistre les actions des utilisateurs (écoute, téléchargement, avis, déblocage)
 * et diffuse les notifications (Push FCM + Flux Social en direct).
 */

function jsonResponse(data, headers = {}, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/**
 * Assure la création de la table social_activities dans Cloudflare D1
 */
async function ensureSocialTable(db) {
  if (!db) return;
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS social_activities (
        id TEXT PRIMARY KEY,
        action_type TEXT NOT NULL,
        user_name TEXT,
        user_id TEXT,
        book_id TEXT,
        book_title TEXT,
        country TEXT DEFAULT 'GA',
        city TEXT,
        message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run().catch(() => {});

    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_social_created ON social_activities(created_at)`).run().catch(() => {});
  } catch (_) {}
}

/**
 * POST /api/social/action
 * Reçoit une action utilisateur (écoute, téléchargement, like, avis)
 * et envoie une notification aux autres utilisateurs.
 */
export async function handleRecordSocialAction(request, env, corsHeaders) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      action_type = 'listen', // 'listen', 'download', 'review', 'like', 'unlock'
      book_id = null,
      book_title = 'Un livre audio',
      user_name = 'Un auditeur',
      user_id = null,
      rating = null,
    } = body;

    const cfCountry = (request.cf?.country && request.cf.country !== 'XX') ? request.cf.country : 'GA';
    const city = request.cf?.city || (cfCountry === 'GA' ? 'Libreville' : 'Afrique');
    const id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Construire le message convivial pour la communauté
    let notifTitle = '🎧 Activité en direct sur RG Play';
    let notifMessage = '';

    if (action_type === 'listen') {
      notifTitle = '🔥 Écoute en cours sur RG Play';
      notifMessage = `${user_name} à ${city} écoute "${book_title}". Rejoignez l'écoute !`;
    } else if (action_type === 'download') {
      notifTitle = '📥 Nouveau Téléchargement';
      notifMessage = `"${book_title}" vient d'être téléchargé pour une écoute hors-ligne à ${city} !`;
    } else if (action_type === 'review' || action_type === 'like') {
      notifTitle = '⭐ Nouvel Avis sur RG Play';
      notifMessage = `${user_name} a noté "${book_title}" ${rating ? rating + '/5' : 'coup de cœur'} !`;
    } else if (action_type === 'unlock') {
      notifTitle = '✨ Livre Débloqué !';
      notifMessage = `Un membre à ${city} vient de débloquer l'accès complet à "${book_title}".`;
    } else {
      notifMessage = `${user_name} découvre "${book_title}" en ce moment.`;
    }

    // 1. Sauvegarde dans Cloudflare D1
    if (env.DB) {
      await ensureSocialTable(env.DB);
      try {
        await env.DB.prepare(`
          INSERT INTO social_activities (id, action_type, user_name, user_id, book_id, book_title, country, city, message, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(id, action_type, user_name, user_id, book_id, book_title, cfCountry, city, notifMessage).run();

        // Limiter la table aux 500 dernières activités
        await env.DB.prepare(`
          DELETE FROM social_activities WHERE id NOT IN (
            SELECT id FROM social_activities ORDER BY created_at DESC LIMIT 500
          )
        `).run().catch(() => {});
      } catch (dbErr) {
        console.warn('[Social] Erreur insertion D1:', dbErr.message);
      }
    }

    // 2. Déclencher un Push vers tous les abonnés (avec throttling intelligent 5 min par livre)
    let pushSent = false;
    const cacheKey = `push_throttle_${book_id}_${action_type}`;

    if (env.KV_BINDING) {
      const throttled = await env.KV_BINDING.get(cacheKey);
      if (!throttled && (action_type === 'download' || action_type === 'review' || action_type === 'unlock')) {
        // Bloque le spam push pour 10 minutes sur ce même livre
        await env.KV_BINDING.put(cacheKey, '1', { expirationTtl: 600 });
        pushSent = true;
      }
    } else if (action_type === 'download' || action_type === 'review') {
      pushSent = true;
    }

    if (pushSent && env.DB) {
      // Envoyer en tâche de fond pour ne pas ralentir l'utilisateur
      broadcastSocialPush(env, {
        title: notifTitle,
        body: notifMessage,
        url: book_id ? `/?book=${book_id}` : '/',
        bookId: book_id,
        excludeUserId: user_id,
      }).catch(err => console.warn('[Social Push] Erreur:', err));
    }

    return jsonResponse({
      success: true,
      activity: { id, action_type, user_name, book_title, city, country: cfCountry, message: notifMessage, created_at: new Date().toISOString() },
      pushTriggered: pushSent,
    }, corsHeaders);
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, corsHeaders, 500);
  }
}

/**
 * GET /api/social/feed
 * Récupère le flux d'activités récentes pour l'affichage en direct côté client
 */
export async function handleGetSocialFeed(request, env, corsHeaders) {
  if (!env.DB) {
    return jsonResponse({ activities: [] }, corsHeaders);
  }

  try {
    await ensureSocialTable(env.DB);
    const { results } = await env.DB.prepare(`
      SELECT id, action_type, user_name, book_id, book_title, country, city, message, created_at
      FROM social_activities
      ORDER BY created_at DESC
      LIMIT 30
    `).all().catch(() => ({ results: [] }));

    return jsonResponse({
      success: true,
      activities: results || [],
    }, corsHeaders);
  } catch (err) {
    return jsonResponse({ activities: [], error: err.message }, corsHeaders, 500);
  }
}

/**
 * Diffuse le push d'activité sociale aux abonnés
 */
async function broadcastSocialPush(env, { title, body, url, bookId, excludeUserId }) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT endpoint, auth, p256dh, user_id FROM push_subscriptions WHERE user_id != ? OR user_id IS NULL LIMIT 100'
    ).bind(excludeUserId || 'anon').all().catch(() => ({ results: [] }));

    if (!results || results.length === 0) return;

    const payload = {
      title,
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `rg-social-${Date.now()}`,
      data: { url, bookId },
    };

    const BATCH_SIZE = 15;
    for (let i = 0; i < results.length; i += BATCH_SIZE) {
      const batch = results.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (sub) => {
          try {
            if (sub.endpoint.startsWith('fcm:')) {
              await sendFcmMessage(sub.endpoint.slice(4), { title, body, url, bookId });
            } else {
              await sendWebPushNotification({ endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } }, payload, DEFAULT_VAPID_KEYS);
            }
          } catch (_) {}
        })
      );
    }
  } catch (_) {}
}
