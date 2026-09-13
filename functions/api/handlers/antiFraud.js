/**
 * functions/api/handlers/antiFraud.js
 * 
 * Module de protection et persistance anti-fraude par IP pour RG Play :
 * 1. Empêche le reset infini des 1 000 points de bienvenue par vidage de cache.
 * 2. Empêche la création de multiples comptes sur le même appareil physique via différents navigateurs.
 * 3. Bloque l'auto-parrainage sur la même adresse IP (referral loop).
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

function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || '127.0.0.1';
}

/**
 * GET /api/gamification
 * Récupère le solde de points en vérifiant l'adresse IP pour empêcher les resets par vidage de cache.
 */
export async function handleGetGamification(request, env, corsHeaders) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId') || request.headers.get('X-User-Id');
  const clientIp = getClientIp(request);

  if (!env.DB) {
    return jsonResponse(null, corsHeaders);
  }

  try {
    // 1. Si un userId valide est fourni, chercher son profil direct
    if (userId && userId !== 'user-demo' && userId !== 'guest') {
      const existing = await env.DB.prepare(
        'SELECT * FROM user_gamification WHERE user_id = ?'
      ).bind(userId).first();

      if (existing) {
        // Mettre à jour la trace IP de cet appareil
        await env.DB.prepare(`
          INSERT INTO ip_devices (id, ip, primary_user_id, points_balance, last_seen_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            points_balance = excluded.points_balance,
            last_seen_at = CURRENT_TIMESTAMP
        `).bind(`ip_${clientIp.replace(/[^a-zA-Z0-9]/g, '_')}`, clientIp, userId, existing.points || 1000).run().catch(() => {});

        const txs = await env.DB.prepare(
          'SELECT id, amount, type, description, created_at AS createdAt FROM point_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20'
        ).bind(userId).all().catch(() => ({ results: [] }));

        return jsonResponse({
          xp: existing.xp,
          points: existing.points,
          level: existing.level,
          readingMinutes: existing.reading_minutes,
          listeningMinutes: existing.listening_minutes,
          booksCompleted: existing.books_completed,
          dailyStreak: existing.daily_streak,
          lastDailyRewardDate: existing.last_daily_reward_date,
          unlockedBadges: typeof existing.unlocked_badges === 'string' ? JSON.parse(existing.unlocked_badges) : (existing.unlocked_badges || ['badge-welcome']),
          recentTransactions: txs.results || [],
          boundUserId: userId,
        }, corsHeaders);
      }
    }

    // 2. Si le compte n'existe pas (cache vidé ou autre navigateur sur la même IP)
    // Vérifier si cette adresse IP est déjà enregistrée dans ip_devices
    const ipRecord = await env.DB.prepare(
      'SELECT primary_user_id, points_balance, bonus_claimed FROM ip_devices WHERE ip = ? LIMIT 1'
    ).bind(clientIp).first();

    if (ipRecord && ipRecord.primary_user_id) {
      // L'adresse IP a déjà un compte existant ! On restaure son solde au lieu de réattribuer 1000 pts
      const originalGam = await env.DB.prepare(
        'SELECT * FROM user_gamification WHERE user_id = ?'
      ).bind(ipRecord.primary_user_id).first();

      if (originalGam) {
        return jsonResponse({
          xp: originalGam.xp,
          points: originalGam.points,
          level: originalGam.level,
          readingMinutes: originalGam.reading_minutes,
          listeningMinutes: originalGam.listening_minutes,
          booksCompleted: originalGam.books_completed,
          dailyStreak: originalGam.daily_streak,
          lastDailyRewardDate: originalGam.last_daily_reward_date,
          unlockedBadges: typeof originalGam.unlocked_badges === 'string' ? JSON.parse(originalGam.unlocked_badges) : ['badge-welcome'],
          recentTransactions: [],
          boundUserId: ipRecord.primary_user_id,
          restoredFromIp: true,
        }, corsHeaders);
      }
    }

    // 3. Première visite absolue pour cette IP : Initialiser l'appareil avec le bonus de bienvenue 1000 pts
    const newUserId = userId || `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    
    await env.DB.prepare(`
      INSERT INTO user_gamification (user_id, xp, points, level, updated_at)
      VALUES (?, 1000, 1000, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO NOTHING
    `).bind(newUserId).run().catch(() => {});

    await env.DB.prepare(`
      INSERT INTO ip_devices (id, ip, primary_user_id, points_balance, bonus_claimed, last_seen_at)
      VALUES (?, ?, ?, 1000, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        last_seen_at = CURRENT_TIMESTAMP
    `).bind(`ip_${clientIp.replace(/[^a-zA-Z0-9]/g, '_')}`, clientIp, newUserId).run().catch(() => {});

    return jsonResponse({
      xp: 1000,
      points: 1000,
      level: 1,
      readingMinutes: 0,
      listeningMinutes: 0,
      booksCompleted: 0,
      dailyStreak: 1,
      lastDailyRewardDate: null,
      unlockedBadges: ['badge-welcome'],
      recentTransactions: [
        { id: 'tx-init-1', amount: 1000, type: 'bonus', description: 'Bienvenue sur RG Play (1 000 Sky Points offerts)', createdAt: new Date().toISOString() }
      ],
      boundUserId: newUserId,
    }, corsHeaders);
  } catch (err) {
    console.error('Erreur handleGetGamification:', err);
    return jsonResponse(null, corsHeaders);
  }
}

/**
 * POST /api/gamification
 * Sauvegarde synchrone de l'état de points et mise à jour de la balance liée à l'IP.
 */
export async function handleSyncGamification(request, env, corsHeaders) {
  const body = await request.json().catch(() => ({}));
  const userId = body.userId || request.headers.get('X-User-Id');
  const clientIp = getClientIp(request);

  if (!env.DB || !userId) {
    return jsonResponse({ success: false }, corsHeaders);
  }

  try {
    const points = Number(body.points) || 0;
    const xp = Number(body.xp) || 0;
    const level = Number(body.level) || 1;

    await env.DB.prepare(`
      INSERT INTO user_gamification (
        user_id, xp, points, level, reading_minutes, listening_minutes, 
        books_completed, daily_streak, last_daily_reward_date, unlocked_badges, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        xp = excluded.xp,
        points = excluded.points,
        level = excluded.level,
        reading_minutes = excluded.reading_minutes,
        listening_minutes = excluded.listening_minutes,
        books_completed = excluded.books_completed,
        daily_streak = excluded.daily_streak,
        last_daily_reward_date = excluded.last_daily_reward_date,
        unlocked_badges = excluded.unlocked_badges,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      userId,
      xp,
      points,
      level,
      body.readingMinutes || 0,
      body.listeningMinutes || 0,
      body.booksCompleted || 0,
      body.dailyStreak || 1,
      body.lastDailyRewardDate || null,
      JSON.stringify(body.unlockedBadges || ['badge-welcome'])
    ).run();

    // Mettre à jour ip_devices pour cet appareil
    await env.DB.prepare(`
      INSERT INTO ip_devices (id, ip, primary_user_id, points_balance, last_seen_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        points_balance = excluded.points_balance,
        last_seen_at = CURRENT_TIMESTAMP
    `).bind(`ip_${clientIp.replace(/[^a-zA-Z0-9]/g, '_')}`, clientIp, userId, points).run().catch(() => {});

    return jsonResponse({ success: true, points, xp }, corsHeaders);
  } catch (err) {
    console.error('Erreur handleSyncGamification:', err);
    return jsonResponse({ success: false, error: err.message }, corsHeaders, 500);
  }
}

/**
 * POST /api/referral/register
 * Enregistrement du parrainage avec contrôle anti-fraude IP (refus strict de l'auto-parrainage).
 */
export async function handleRegisterReferral(request, env, corsHeaders) {
  const body = await request.json().catch(() => ({}));
  const referrerCode = (body.referrerCode || '').trim().toUpperCase();
  const newUserId = request.headers.get('X-User-Id') || body.userId;
  const clientIp = getClientIp(request);

  if (!referrerCode || !newUserId) {
    return jsonResponse({ success: false, error: 'Code parrain et ID requis' }, corsHeaders, 400);
  }

  try {
    // 1. Vérifier si le parrain existe et quelle est son IP d'enregistrement
    if (env.DB) {
      // Trouver l'utilisateur parrain
      const referrerUser = await env.DB.prepare(
        'SELECT id, referral_code FROM users WHERE referral_code = ? LIMIT 1'
      ).bind(referrerCode).first().catch(() => null);

      if (referrerUser) {
        // Bloquer si c'est le même ID
        if (referrerUser.id === newUserId) {
          return jsonResponse({
            success: false,
            error: 'Impossible de vous parrainer vous-même.'
          }, corsHeaders, 403);
        }

        // Vérifier l'adresse IP associée au parrain dans ip_devices
        const referrerIpRecord = await env.DB.prepare(
          'SELECT ip FROM ip_devices WHERE primary_user_id = ? LIMIT 1'
        ).bind(referrerUser.id).first().catch(() => null);

        if (referrerIpRecord && referrerIpRecord.ip === clientIp) {
          return jsonResponse({
            success: false,
            error: 'Auto-parrainage non autorisé sur le même appareil ou réseau Wi-Fi.'
          }, corsHeaders, 403);
        }
      }

      // Vérifier si cette adresse IP a déjà été parrainée
      const alreadyReferredIp = await env.DB.prepare(
        'SELECT id FROM users WHERE id IN (SELECT primary_user_id FROM ip_devices WHERE ip = ?) AND referred_by IS NOT NULL'
      ).bind(clientIp).first().catch(() => null);

      if (alreadyReferredIp) {
        return jsonResponse({
          success: false,
          error: 'Cet appareil a déjà bénéficié d\'un code de parrainage.'
        }, corsHeaders, 403);
      }

      // Enregistrer le parrainage dans la table users
      await env.DB.prepare(`
        UPDATE users SET referred_by = ? WHERE id = ?
      `).bind(referrerUser ? referrerUser.id : referrerCode, newUserId).run().catch(() => {});
    }

    // 2. Créditer le parrain dans KV (ou D1)
    if (env.KV_BINDING) {
      const refKey = `rg_referral_${referrerCode}`;
      let current = await env.KV_BINDING.get(refKey, { type: 'json' }).catch(() => null) || {
        code: referrerCode,
        referrals: [],
        creditsEarned: 0,
        pendingCredits: 0
      };

      if (!current.referrals.includes(newUserId)) {
        current.referrals.push(newUserId);
        current.creditsEarned = (current.creditsEarned || 0) + 500;
        await env.KV_BINDING.put(refKey, JSON.stringify(current));
      }

      return jsonResponse({ success: true, stats: current }, corsHeaders);
    }

    return jsonResponse({ success: true }, corsHeaders);
  } catch (err) {
    console.error('Erreur handleRegisterReferral:', err);
    return jsonResponse({ success: false, error: err.message }, corsHeaders, 500);
  }
}
