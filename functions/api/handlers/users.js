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
      ORDER BY u.created_at DESC
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
 * Calcule dynamiquement le niveau et titre selon les seuils d'XP RG Play
 */
export function computeUserLevel(xp = 0) {
  const numXp = Math.max(0, Number(xp) || 0);
  if (numXp >= 3000) return { level: 6, title: "Sage de Read's Great", color: '#00f5d4' };
  if (numXp >= 1500) return { level: 5, title: 'Maître du Savoir', color: '#ffbe0b' };
  if (numXp >= 700)  return { level: 4, title: 'Érudit Émérite', color: '#fb5607' };
  if (numXp >= 300)  return { level: 3, title: 'Lecteur Passionné', color: '#ff006e' };
  if (numXp >= 100)  return { level: 2, title: 'Apprenti Lecteur', color: '#3a86ff' };
  return { level: 1, title: 'Novice Curieux', color: '#9d4edd' };
}

/**
 * GET /api/admin/users
 * Liste assainie des utilisateurs réels (exclut les bots et rebonds passifs à 0s d'écoute).
 */
export async function handleGetAdminUsers(request, env, corsHeaders) {
  if (!env.DB) return jsonResponse([], corsHeaders);

  try {
    // 1. Utilisateurs enregistrés de la table users
    const { results: dbUsers } = await env.DB.prepare(`
      SELECT 
        u.id, COALESCE(NULLIF(u.name, ''), 'Auditeur RG Play') AS name,
        u.email, u.phone, u.avatar_url,
        COALESCE(u.plan, 'free') AS plan,
        COALESCE(u.wallet_balance, 0) AS wallet_balance,
        u.created_at, u.referred_by, u.referral_code,
        (SELECT COUNT(*) FROM users u2 WHERE u2.referred_by = u.id) AS referral_count,
        COALESCE(g.points, 0) AS points,
        COALESCE(g.xp, 0) AS xp,
        COALESCE(g.level, 1) AS level,
        COALESCE(g.reading_minutes, 0) AS reading_minutes,
        COALESCE(g.listening_minutes, 0) AS listening_minutes,
        COALESCE(g.books_completed, 0) AS books_completed,
        g.last_daily_reward_date,
        COALESCE(NULLIF(NULLIF((SELECT vs.country FROM visitor_sessions vs WHERE vs.user_id = u.id OR vs.visitor_id = u.id ORDER BY vs.last_active_at DESC LIMIT 1), 'XX'), ''), 'GA') AS country,
        CASE WHEN u.phone IS NOT NULL AND TRIM(u.phone) != '' THEN 1 ELSE 0 END AS has_whatsapp,
        1 AS is_registered, 'registered' AS user_type,
        COALESCE(ipd.ip, (SELECT vs.ip FROM visitor_sessions vs WHERE vs.user_id = u.id OR vs.visitor_id = u.id ORDER BY vs.last_active_at DESC LIMIT 1)) AS ip_address,
        COALESCE(ipd.last_seen_at, (SELECT vs.last_active_at FROM visitor_sessions vs WHERE vs.user_id = u.id OR vs.visitor_id = u.id ORDER BY vs.last_active_at DESC LIMIT 1), u.created_at) AS ip_last_seen
      FROM users u
      LEFT JOIN user_gamification g ON u.id = g.user_id
      LEFT JOIN ip_devices ipd ON ipd.primary_user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `).all().catch(() => ({ results: [] }));

    // 2. Auditeurs invités avec écoute réelle (> 30s) — BOTS à 0s formellement exclus
    const { results: activeVisitors } = await env.DB.prepare(`
      SELECT 
        vs.visitor_id AS id,
        COALESCE(NULLIF(MAX(vs.user_name), ''), 'Auditeur Invité #' || substr(vs.visitor_id, -6)) AS name,
        MAX(vs.user_email) AS email, NULL AS phone, NULL AS avatar_url,
        'free' AS plan, 0 AS wallet_balance, MIN(vs.started_at) AS created_at,
        COALESCE(MAX(g.points), MAX(vs.points), 0) AS points,
        COALESCE(MAX(g.xp), MAX(vs.points), 0) AS xp,
        COALESCE(MAX(g.level), 1) AS level,
        COALESCE(MAX(g.reading_minutes), 0) AS reading_minutes,
        ROUND(MAX(COALESCE(vs.total_duration_seconds, 0)) / 60) AS listening_minutes,
        COALESCE(MAX(g.books_completed), 0) AS books_completed,
        MAX(g.last_daily_reward_date) AS last_daily_reward_date,
        COALESCE(NULLIF(NULLIF(MAX(vs.country), 'XX'), ''), 'GA') AS country,
        0 AS has_whatsapp, 0 AS is_registered, 'guest' AS user_type,
        COALESCE(MAX(ipd.ip), MAX(vs.ip)) AS ip_address,
        COALESCE(MAX(ipd.last_seen_at), MAX(vs.last_active_at)) AS ip_last_seen
      FROM visitor_sessions vs
      LEFT JOIN users u ON vs.visitor_id = u.id OR vs.user_id = u.id
      LEFT JOIN user_gamification g ON vs.visitor_id = g.user_id OR vs.user_id = g.user_id
      LEFT JOIN ip_devices ipd ON vs.visitor_id = ipd.primary_user_id
      WHERE u.id IS NULL 
        AND (
          COALESCE(vs.total_duration_seconds, 0) >= 30
          OR COALESCE(g.listening_minutes, 0) > 0
          OR (COALESCE(g.points, 0) > 0 AND g.user_id IS NOT NULL)
          OR EXISTS (SELECT 1 FROM analytics_events ae WHERE ae.visitor_id = vs.visitor_id AND ae.action IN ('audio_play', 'audio_listen', 'download_offline', 'buy_click', 'rating_submit'))
        )
      GROUP BY vs.visitor_id
      ORDER BY MAX(vs.last_active_at) DESC
      LIMIT 500
    `).all().catch(() => ({ results: [] }));

    const combined = [...(dbUsers || [])];
    const existingIds = new Set(combined.map(u => u.id));
    for (const v of (activeVisitors || [])) {
      if (!existingIds.has(v.id)) {
        combined.push(v);
        existingIds.add(v.id);
      }
    }

    // Tri chronologique
    combined.sort((a, b) => {
      const timeA = a.created_at ? new Date(String(a.created_at).replace(' ', 'T')).getTime() || 0 : 0;
      const timeB = b.created_at ? new Date(String(b.created_at).replace(' ', 'T')).getTime() || 0 : 0;
      return timeB - timeA;
    });

    const finalUsers = combined.map(u => {
      const realPoints = Math.max(0, Number(u.points) || 0);
      const realXp = Math.max(0, Number(u.xp) || realPoints);
      const lvlInfo = computeUserLevel(realXp);
      return {
        ...u,
        points: realPoints,
        xp: realXp,
        level: lvlInfo.level,
        level_title: lvlInfo.title,
        level_color: lvlInfo.color,
      };
    });

    return jsonResponse(finalUsers, corsHeaders);
  } catch (err) {
    console.error('Erreur getAdminUsers:', err);
    return jsonResponse([], corsHeaders, 500);
  }
}

/**
 * POST /api/admin/users/credit-points ou /api/admin/users/:id/points
 * Crédite ou débite des Sky Points / XP de manière atomique et auditée.
 */
export async function handleCreditUserPoints(request, env, corsHeaders, routeUserId = null) {
  if (!env.DB) return jsonResponse({ success: false, error: 'Base D1 non disponible' }, corsHeaders, 500);

  try {
    const body = await request.json().catch(() => ({}));
    const userId = routeUserId || body.user_id || body.userId;
    const pointsDelta = Number(body.points !== undefined ? body.points : (body.sky_points !== undefined ? body.sky_points : body.amount));
    const reason = body.reason || body.description || "Crédit Sky Points par l'Admin";

    if (!userId) return jsonResponse({ success: false, error: 'Identifiant utilisateur requis' }, corsHeaders, 400);
    if (isNaN(pointsDelta) || pointsDelta === 0) {
      return jsonResponse({ success: false, error: 'Montant de points invalide (différent de 0 requis)' }, corsHeaders, 400);
    }

    // 1. S'assurer que le user existe
    await env.DB.prepare(`
      INSERT OR IGNORE INTO users (id, name, created_at, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(userId, body.user_name || 'Auditeur RG Play').run().catch(() => {});

    // 2. Mettre à jour user_gamification
    const xpDelta = pointsDelta > 0 ? pointsDelta : 0;
    const initialPts = Math.max(0, pointsDelta);

    await env.DB.prepare(`
      INSERT INTO user_gamification (
        user_id, xp, points, level, reading_minutes, listening_minutes, 
        books_completed, daily_streak, updated_at
      ) VALUES (?, ?, ?, 1, 0, 0, 0, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        points = MAX(0, user_gamification.points + ?),
        xp = MAX(0, user_gamification.xp + ?),
        updated_at = CURRENT_TIMESTAMP
    `).bind(userId, initialPts, initialPts, pointsDelta, xpDelta).run();

    // 3. Enregistrer la transaction
    const txId = `tx-admin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const txType = pointsDelta > 0 ? 'admin_credit' : 'admin_debit';
    await env.DB.prepare(`
      INSERT INTO point_transactions (id, user_id, amount, type, description, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(txId, userId, pointsDelta, txType, reason).run().catch(() => {});

    // 4. Mettre à jour visitor_sessions
    await env.DB.prepare(`
      UPDATE visitor_sessions SET points = MAX(0, points + ?) WHERE user_id = ? OR visitor_id = ?
    `).bind(pointsDelta, userId, userId).run().catch(() => {});

    // 5. Récupérer le solde mis à jour
    const updated = await env.DB.prepare(
      'SELECT user_id, points, xp, level FROM user_gamification WHERE user_id = ?'
    ).bind(userId).first();

    const finalPoints = updated ? Number(updated.points) : initialPts;
    const finalXp = updated ? Number(updated.xp) : initialPts;
    const levelInfo = computeUserLevel(finalXp);

    if (updated && updated.level !== levelInfo.level) {
      await env.DB.prepare('UPDATE user_gamification SET level = ? WHERE user_id = ?')
        .bind(levelInfo.level, userId).run().catch(() => {});
    }

    return jsonResponse({
      success: true,
      user_id: userId,
      points_added: pointsDelta,
      new_points: finalPoints,
      new_xp: finalXp,
      level: levelInfo.level,
      level_title: levelInfo.title,
      transaction_id: txId,
      message: `${pointsDelta > 0 ? `+${pointsDelta}` : pointsDelta} Sky Points enregistrés avec succès !`
    }, corsHeaders);
  } catch (err) {
    console.error('Erreur handleCreditUserPoints:', err);
    return jsonResponse({ success: false, error: err.message || 'Erreur serveur' }, corsHeaders, 500);
  }
}
