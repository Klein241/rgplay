/**
 * functions/api/handlers/reviews.js
 * 
 * Gestionnaire modulaire RG Play pour les Avis & Notations :
 * - Insertion & mise à jour sécurisée des avis dans Cloudflare D1
 * - Calcul automatique de la moyenne et du nombre total d'évaluations
 * - Compatible avec l'ancien et le nouveau schéma SQLite sans plantage ON CONFLICT
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
 * Assure que la table reviews et ses colonnes existent dans D1
 */
async function ensureReviewsTable(db) {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        audiobook_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        rating REAL NOT NULL,
        comment TEXT,
        user_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run().catch(() => {});

    // Ajouter les colonnes au cas où la table venait d'une ancienne migration
    await db.prepare(`ALTER TABLE reviews ADD COLUMN user_name TEXT`).run().catch(() => {});
    await db.prepare(`ALTER TABLE reviews ADD COLUMN user_avatar TEXT`).run().catch(() => {});
  } catch (_) {}
}

/**
 * GET /api/audiobooks/:id/reviews
 */
export async function handleGetBookReviews(request, env, corsHeaders, bookId) {
  if (!env.DB) {
    return jsonResponse({ success: true, reviews: [], count: 0, total_reviews: 0, average_rating: null, user_rating: null }, corsHeaders);
  }

  try {
    await ensureReviewsTable(env.DB);

    const url = new URL(request.url);
    const userId = (request.headers.get('X-User-Id') || url.searchParams.get('user_id') || '').trim();

    const { results } = await env.DB.prepare(`
      SELECT id, audiobook_id, user_id, 
             COALESCE(user_name, 'Auditeur RG Play') as author_name,
             COALESCE(user_name, 'Auditeur RG Play') as user_name,
             user_avatar,
             rating, 
             COALESCE(comment, '') as comment,
             strftime('%d/%m/%Y', created_at) as date,
             created_at
      FROM reviews
      WHERE audiobook_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `).bind(bookId).all().catch(() => ({ results: [] }));

    const revList = results || [];

    // Détection de la note de l'utilisateur actuel
    let userRating = null;
    if (userId) {
      const myRev = revList.find(r => r.user_id === userId);
      if (myRev) {
        userRating = Number(myRev.rating);
      } else {
        // Recherche en base si non présent dans les 100 premiers
        const dbMyRev = await env.DB.prepare(`
          SELECT rating FROM reviews WHERE audiobook_id = ? AND user_id = ? LIMIT 1
        `).bind(bookId, userId).first().catch(() => null);
        if (dbMyRev?.rating) {
          userRating = Number(dbMyRev.rating);
        }
      }
    }

    // Calcul de la note moyenne et du nombre total d'avis
    let avgRating = null;
    let totalReviews = revList.length;

    // Lire aussi les métadonnées de la table audiobooks
    const bookRow = await env.DB.prepare(`
      SELECT rating, rating_count, display_rating, display_reviews_count 
      FROM audiobooks WHERE id = ? LIMIT 1
    `).bind(bookId).first().catch(() => null);

    const baseCount = Math.max(Number(bookRow?.rating_count || 0), Number(bookRow?.display_reviews_count || 0));

    if (revList.length > 0) {
      const sum = revList.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
      avgRating = Number((sum / revList.length).toFixed(1));
      totalReviews = Math.max(revList.length, baseCount);
      if (bookRow?.rating || bookRow?.display_rating) {
        avgRating = Math.min(5.0, Math.max(1.0, Number(bookRow.rating || bookRow.display_rating)));
      }
    } else if (bookRow) {
      avgRating = Math.min(5.0, Math.max(1.0, Number(bookRow.rating || bookRow.display_rating || 5.0)));
      totalReviews = baseCount;
    }

    return jsonResponse({
      success: true,
      reviews: revList,
      count: revList.length,
      total_reviews: totalReviews,
      average_rating: avgRating,
      user_rating: userRating
    }, corsHeaders);
  } catch (err) {
    console.error('[handleGetBookReviews] Erreur:', err);
    return jsonResponse({ success: true, reviews: [], count: 0, total_reviews: 0, average_rating: null, user_rating: null }, corsHeaders);
  }
}

/**
 * POST /api/audiobooks/:id/reviews
 */
export async function handlePostBookReview(request, env, corsHeaders, bookId) {
  const body = await request.json().catch(() => ({}));
  const rawRating = Number(body.rating);

  if (!rawRating || rawRating < 1 || rawRating > 5) {
    return jsonResponse({ error: 'La note doit être comprise entre 1 et 5' }, corsHeaders, 400);
  }

  const ratingVal = Number(rawRating.toFixed(1));
  const comment = (body.comment || '').trim();
  const userName = (body.user_name || body.author || 'Auditeur RG Play').trim();
  const userId = (request.headers.get('X-User-Id') || body.user_id || 'user-anonymous').trim();

  if (!env.DB) {
    return jsonResponse({
      success: true,
      review: { id: `rev-${Date.now()}`, rating: ratingVal, comment, author_name: userName, date: "À l'instant" },
      rating: ratingVal,
      total_reviews: 1
    }, corsHeaders);
  }

  try {
    await ensureReviewsTable(env.DB);

    // 🛡️ CRITIQUE : Garantir que l'utilisateur existe dans 'users' pour satisfaire la clé étrangère
    // users.email et users.name sont NOT NULL dans le schéma SQLite D1
    const cleanUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '') || 'guest';
    await env.DB.prepare(`
      INSERT OR IGNORE INTO users (id, name, email, country, created_at)
      VALUES (?, ?, ?, 'GA', CURRENT_TIMESTAMP)
    `).bind(
      userId,
      userName || 'Auditeur RG Play',
      `${cleanUserId}@rgplay.local`
    ).run().catch((e) => {
      console.warn('[handlePostBookReview] Auto-création utilisateur ignorée:', e.message);
    });

    // Vérifier si cet utilisateur a déjà évalué ce livre
    const existing = await env.DB.prepare(`
      SELECT id, rating FROM reviews WHERE audiobook_id = ? AND user_id = ? LIMIT 1
    `).bind(bookId, userId).first().catch(() => null);

    let reviewId;
    if (existing && existing.id) {
      reviewId = existing.id;
      await env.DB.prepare(`
        UPDATE reviews 
        SET rating = ?, comment = ?, user_name = ?, created_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(ratingVal, comment || `Note de ${ratingVal}/5`, userName, reviewId).run();
    } else {
      reviewId = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      await env.DB.prepare(`
        INSERT INTO reviews (id, audiobook_id, user_id, rating, comment, user_name, created_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(reviewId, bookId, userId, ratingVal, comment || `Note de ${ratingVal}/5`, userName).run();
    }

    // Récupérer les stats existantes du livre dans audiobooks
    const bookRow = await env.DB.prepare(`
      SELECT rating, rating_count, display_rating, display_reviews_count 
      FROM audiobooks WHERE id = ? LIMIT 1
    `).bind(bookId).first().catch(() => null);

    // Compter les vrais avis dans la table reviews
    const stats = await env.DB.prepare(`
      SELECT COUNT(*) as total, AVG(rating) as avg_rating FROM reviews WHERE audiobook_id = ?
    `).bind(bookId).first().catch(() => null);

    const reviewsCountInDb = Number(stats?.total || 1);
    const reviewsAvgInDb = Number(Number(stats?.avg_rating || ratingVal).toFixed(1));

    let newTotal = reviewsCountInDb;
    let newAvg = reviewsAvgInDb;

    if (bookRow) {
      const prevCount = Math.max(Number(bookRow.rating_count || 0), Number(bookRow.display_reviews_count || 0));
      if (!existing && prevCount >= reviewsCountInDb) {
        newTotal = prevCount + 1;
        const prevAvg = Number(bookRow.rating || bookRow.display_rating || 5.0);
        newAvg = Number(((prevAvg * prevCount + ratingVal) / newTotal).toFixed(1));
      } else if (existing && prevCount > reviewsCountInDb) {
        newTotal = prevCount;
        const prevAvg = Number(bookRow.rating || bookRow.display_rating || 5.0);
        const oldRating = Number(existing.rating || 5.0);
        newAvg = Number(((prevAvg * prevCount - oldRating + ratingVal) / prevCount).toFixed(1));
      }
    }

    newAvg = Math.min(5.0, Math.max(1.0, newAvg));

    // Mettre à jour la table audiobooks de façon permanente
    try {
      await env.DB.prepare(`
        UPDATE audiobooks 
        SET rating = ?, rating_count = ?, display_rating = ?, display_reviews_count = ?
        WHERE id = ?
      `).bind(newAvg, newTotal, newAvg, newTotal, bookId).run();
    } catch (_) {}

    // Invalider les caches KV
    if (env.KV_BINDING) {
      await env.KV_BINDING.delete(`book_${bookId}`).catch(() => {});
      const commonKeys = [
        'books_all_all_false', 'books_all_all_true',
        'books_all_audiobook_false', 'books_all_audiobook_true',
        'books_all_ebook_false', 'books_all_ebook_true',
        'books_all_podcast_false', 'books_all_podcast_true',
      ];
      for (const k of commonKeys) {
        await env.KV_BINDING.delete(k).catch(() => {});
      }
    }

    return jsonResponse({
      success: true,
      review: {
        id: reviewId,
        audiobook_id: bookId,
        user_id: userId,
        user_name: userName,
        author_name: userName,
        rating: ratingVal,
        comment,
        date: "À l'instant"
      },
      rating: newAvg,
      average_rating: newAvg,
      total_reviews: newTotal,
      user_rating: ratingVal,
      message: `Note ${ratingVal}/5 enregistrée avec succès`
    }, corsHeaders);

  } catch (err) {
    console.error('[handlePostBookReview] Erreur D1:', err);
    return jsonResponse({ success: false, error: err.message }, corsHeaders, 500);
  }
}
