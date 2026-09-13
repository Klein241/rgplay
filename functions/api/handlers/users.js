/**
 * functions/api/handlers/users.js
 * 
 * Gestionnaire modulaire RG Play pour les Utilisateurs :
 * - Association et sécurisation de compte via Numéro WhatsApp
 * - Récupération de compte cross-device (changement de téléphone / PWA)
 * - Liste assainie des utilisateurs réels pour l'Admin Studio (exclut les curieux passifs)
 * - Crédit de Sky Points par l'Admin
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
 * Nettoie et normalise un numéro de téléphone en format international.
 * Priorité Gabon (+241) si l'indicatif n'est pas fourni.
 */
function normalizePhoneNumber(raw) {
  if (!raw) return '';
  let cleaned = String(raw).replace(/[^\d+]/g, '').trim();
  if (!cleaned) return '';

  // Si commence par +, on garde tel quel
  if (cleaned.startsWith('+')) return cleaned;

  // Si commence par 00, remplacer par +
  if (cleaned.startsWith('00')) return '+' + cleaned.slice(2);

  // Format Gabon local (ex: 074... ou 065... ou 74...)
  if (cleaned.startsWith('0') && (cleaned.length === 8 || cleaned.length === 9)) {
    return '+241' + cleaned.slice(1);
  }
  if (cleaned.length === 7 || cleaned.length === 8) {
    return '+241' + cleaned;
  }

  // Défaut : ajouter '+' au début
  return '+' + cleaned;
}

/**
 * POST /api/users/link-whatsapp
 * Lie l'ID utilisateur actif à un numéro WhatsApp pour sécuriser son compte.
 */
export async function handleLinkWhatsApp(request, env, corsHeaders) {
  if (!env.DB) {
    return jsonResponse({ success: false, error: 'Base D1 non disponible' }, corsHeaders, 500);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const userId = body.userId || request.headers.get('X-User-Id');
    const rawPhone = body.phone;
    const name = body.name?.trim();

    if (!userId || !rawPhone) {
      return jsonResponse({ success: false, error: 'ID utilisateur et numéro WhatsApp requis' }, corsHeaders, 400);
    }

    const phone = normalizePhoneNumber(rawPhone);
    if (!phone || phone.length < 8) {
      return jsonResponse({ success: false, error: 'Numéro WhatsApp invalide' }, corsHeaders, 400);
    }

    // 1. Enregistrer ou mettre à jour dans la table users
    await env.DB.prepare(`
      INSERT INTO users (id, phone, name, updated_at)
      VALUES (?, ?, COALESCE(NULLIF(?, ''), 'Auditeur RG Play'), CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        phone = excluded.phone,
        name = CASE WHEN excluded.name != 'Auditeur RG Play' THEN excluded.name ELSE users.name END,
        updated_at = CURRENT_TIMESTAMP
    `).bind(userId, phone, name || 'Auditeur RG Play').run();

    // 2. Mettre à jour les sessions de visite associées
    await env.DB.prepare(`
      UPDATE visitor_sessions 
      SET user_id = ?, user_name = COALESCE(NULLIF(?, ''), user_name)
      WHERE visitor_id = ?
    `).bind(userId, name || '', userId).run().catch(() => {});

    return jsonResponse({
      success: true,
      phone,
      message: 'Compte sécurisé et lié à WhatsApp avec succès !',
    }, corsHeaders);
  } catch (err) {
    console.error('Erreur link-whatsapp:', err);
    return jsonResponse({ success: false, error: err.message || 'Erreur serveur' }, corsHeaders, 500);
  }
}

/**
 * POST /api/users/recover-whatsapp
 * Restaure le compte d'un utilisateur sur un nouvel appareil à partir de son numéro WhatsApp.
 */
export async function handleRecoverWhatsApp(request, env, corsHeaders) {
  if (!env.DB) {
    return jsonResponse({ success: false, error: 'Base D1 non disponible' }, corsHeaders, 500);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const rawPhone = body.phone;

    if (!rawPhone) {
      return jsonResponse({ success: false, error: 'Numéro WhatsApp requis pour la récupération' }, corsHeaders, 400);
    }

    const phone = normalizePhoneNumber(rawPhone);

    // Chercher l'utilisateur par son téléphone
    const user = await env.DB.prepare(`
      SELECT 
        u.id, u.name, u.phone, u.email, u.avatar_url, u.plan, u.wallet_balance,
        g.points, g.xp, g.level, g.reading_minutes, g.listening_minutes, 
        g.books_completed, g.daily_streak, g.last_daily_reward_date, g.unlocked_badges
      FROM users u
      LEFT JOIN user_gamification g ON u.id = g.user_id
      WHERE u.phone = ? OR u.phone = ?
      ORDER BY u.updated_at DESC
      LIMIT 1
    `).bind(phone, rawPhone.trim()).first();

    if (!user) {
      return jsonResponse({
        success: false,
        error: `Aucun compte Read's Great trouvé avec le numéro ${phone}. Vérifiez le numéro ou commencez un nouveau profil.`,
      }, corsHeaders, 404);
    }

    // Parser les badges
    let unlockedBadges = ['badge-welcome'];
    try {
      if (typeof user.unlocked_badges === 'string') {
        unlockedBadges = JSON.parse(user.unlocked_badges);
      } else if (Array.isArray(user.unlocked_badges)) {
        unlockedBadges = user.unlocked_badges;
      }
    } catch (_) {}

    // Récupérer les livres achetés / débloqués
    const { results: purchases } = await env.DB.prepare(`
      SELECT audiobook_id FROM purchases WHERE user_id = ? AND status = 'completed'
    `).bind(user.id).all().catch(() => ({ results: [] }));
    const unlockedBookIds = (purchases || []).map(p => p.audiobook_id);

    return jsonResponse({
      success: true,
      user: {
        id: user.id,
        name: user.name || 'Auditeur RG Play',
        phone: user.phone || phone,
        email: user.email || '',
        avatar: user.avatar_url,
        plan: user.plan || 'free',
        wallet_balance: user.wallet_balance || 0,
        is_registered: true,
      },
      gamification: {
        points: user.points ?? 1000,
        xp: user.xp ?? 1000,
        level: user.level || 1,
        readingMinutes: user.reading_minutes || 0,
        listeningMinutes: user.listening_minutes || 0,
        booksCompleted: user.books_completed || 0,
        dailyStreak: user.daily_streak || 1,
        lastDailyRewardDate: user.last_daily_reward_date,
        unlockedBadges,
      },
      unlockedBookIds,
      message: `Heureux de vous revoir ${user.name || ''} ! Votre solde et vos livres ont été restaurés.`,
    }, corsHeaders);
  } catch (err) {
    console.error('Erreur recover-whatsapp:', err);
    return jsonResponse({ success: false, error: err.message || 'Erreur serveur' }, corsHeaders, 500);
  }
}

/**
 * GET /api/admin/users
 * Liste assainie des utilisateurs réels (exclut les simples visiteurs passifs à 0 action).
 */
export async function handleGetAdminUsers(request, env, corsHeaders) {
  if (!env.DB) {
    return jsonResponse([], corsHeaders);
  }

  try {
    // 1. Récupérer tous les utilisateurs enregistrés dans la table users
    const { results: dbUsers } = await env.DB.prepare(`
      SELECT 
        u.id,
        COALESCE(NULLIF(u.name, ''), 'Auditeur RG Play') AS name,
        u.email,
        u.phone,
        u.avatar_url,
        COALESCE(u.plan, 'free') AS plan,
        COALESCE(u.wallet_balance, 0) AS wallet_balance,
        u.created_at,
        u.referred_by,
        u.referral_code,
        (SELECT COUNT(*) FROM users u2 WHERE u2.referred_by = u.id) AS referral_count,
        CASE 
          WHEN g.points IS NULL OR g.points = 0 THEN 1000
          ELSE g.points
        END AS points,
        CASE 
          WHEN g.xp IS NULL OR g.xp = 0 THEN 1000
          ELSE g.xp
        END AS xp,
        COALESCE(g.level, 1) AS level,
        COALESCE(g.reading_minutes, 0) AS reading_minutes,
        COALESCE(g.listening_minutes, 0) AS listening_minutes,
        COALESCE(g.books_completed, 0) AS books_completed,
        g.last_daily_reward_date,
        COALESCE(
          NULLIF(NULLIF((SELECT vs.country FROM visitor_sessions vs WHERE vs.user_id = u.id OR vs.visitor_id = u.id ORDER BY vs.last_active_at DESC LIMIT 1), 'XX'), ''),
          'GA'
        ) AS country,
        CASE WHEN u.phone IS NOT NULL AND u.phone != '' THEN 1 ELSE 0 END AS has_whatsapp,
        1 AS is_real_user,
        COALESCE(ipd.ip, (SELECT vs.ip FROM visitor_sessions vs WHERE vs.user_id = u.id OR vs.visitor_id = u.id ORDER BY vs.last_active_at DESC LIMIT 1)) AS ip_address,
        COALESCE(ipd.last_seen_at, (SELECT vs.last_active_at FROM visitor_sessions vs WHERE vs.user_id = u.id OR vs.visitor_id = u.id ORDER BY vs.last_active_at DESC LIMIT 1)) AS ip_last_seen
      FROM users u
      LEFT JOIN user_gamification g ON u.id = g.user_id
      LEFT JOIN ip_devices ipd ON ipd.primary_user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `).all().catch(() => ({ results: [] }));

    // 2. Récupérer UNIQUEMENT les visiteurs anonymes qui sont de VRAIS utilisateurs engagés :
    // - Soit ils ont accumulé des points > 0
    // - Soit ils ont écouté au moins un audio (total_duration_seconds > 10 ou présence d'événements)
    const { results: activeVisitors } = await env.DB.prepare(`
      SELECT 
        vs.visitor_id AS id,
        COALESCE(NULLIF(MAX(vs.user_name), ''), 'Utilisateur #' || substr(vs.visitor_id, -6)) AS name,
        MAX(vs.user_email) AS email,
        NULL AS phone,
        NULL AS avatar_url,
        'free' AS plan,
        0 AS wallet_balance,
        MIN(vs.started_at) AS created_at,
        CASE 
          WHEN MAX(g.points) IS NULL OR MAX(g.points) = 0
          THEN CASE WHEN MAX(vs.points) IS NULL OR MAX(vs.points) = 0 THEN 1000 ELSE MAX(vs.points) END
          ELSE MAX(g.points)
        END AS points,
        CASE 
          WHEN MAX(g.xp) IS NULL OR MAX(g.xp) = 0
          THEN CASE WHEN MAX(vs.points) IS NULL OR MAX(vs.points) = 0 THEN 1000 ELSE MAX(vs.points * 2) END
          ELSE MAX(g.xp)
        END AS xp,
        COALESCE(MAX(g.level), 1) AS level,
        COALESCE(MAX(g.reading_minutes), 0) AS reading_minutes,
        ROUND(MAX(COALESCE(vs.total_duration_seconds, 0)) / 60) AS listening_minutes,
        COALESCE(MAX(g.books_completed), 0) AS books_completed,
        MAX(g.last_daily_reward_date) AS last_daily_reward_date,
        COALESCE(NULLIF(NULLIF(MAX(vs.country), 'XX'), ''), 'GA') AS country,
        0 AS has_whatsapp,
        1 AS is_real_user,
        COALESCE(MAX(ipd.ip), MAX(vs.ip)) AS ip_address,
        COALESCE(MAX(ipd.last_seen_at), MAX(vs.last_active_at)) AS ip_last_seen
      FROM visitor_sessions vs
      LEFT JOIN users u ON vs.visitor_id = u.id OR vs.user_id = u.id
      LEFT JOIN user_gamification g ON vs.visitor_id = g.user_id OR vs.user_id = g.user_id
      LEFT JOIN ip_devices ipd ON vs.visitor_id = ipd.primary_user_id
      WHERE u.id IS NULL 
        AND (
          vs.points > 0 
          OR vs.total_duration_seconds >= 10
          OR EXISTS (SELECT 1 FROM analytics_events ae WHERE ae.visitor_id = vs.visitor_id AND ae.action IN ('audio_play', 'audio_listen', 'download_offline', 'buy_click', 'rating_submit'))
        )
      GROUP BY vs.visitor_id
      ORDER BY MAX(vs.last_active_at) DESC
      LIMIT 100
    `).all().catch(() => ({ results: [] }));

    const combined = [...(dbUsers || [])];
    const existingIds = new Set(combined.map(u => u.id));

    for (const v of (activeVisitors || [])) {
      if (!existingIds.has(v.id)) {
        combined.push(v);
        existingIds.add(v.id);
      }
    }

    // Tri chronologique strict
    combined.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    // Post-processing : garantie — aucun utilisateur ne peut afficher 0 pts (bonus bienvenue = 1000 par défaut)
    const finalUsers = combined.map(u => ({
      ...u,
      points: (u.points !== null && u.points !== undefined && Number(u.points) > 0) ? Number(u.points) : 1000,
      xp: (u.xp !== null && u.xp !== undefined && Number(u.xp) > 0) ? Number(u.xp) : 1000,
      level: Number(u.level) || 1,
    }));

    return jsonResponse(finalUsers, corsHeaders);
  } catch (err) {
    console.error('Erreur getAdminUsers:', err);
    return jsonResponse([], corsHeaders, 500);
  }
}
