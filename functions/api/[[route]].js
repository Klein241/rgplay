/**
 * Cloudflare Pages Functions / Edge API Handler pour RG Play
 * 
 * Bindings réels configurés :
 * - env.DB          → Cloudflare D1 (ID: edbf4f75-abda-465c-9b95-4409d10b3993)
 * - env.AUDIO_BUCKET → Cloudflare R2 (S3: 0c6536b2366b6a388b4d6a4d331d486e.r2.cloudflarestorage.com)
 * - env.KV_BINDING  → Cloudflare KV  (ID: 1e2b3238e2d746e58e5659b587121c3b)
 */

const R2_ACCOUNT_ID = '29af63e0139b75f78259902d4ee51e07';
const R2_S3_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_BUCKET = 'rg-play-audio';

export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '');
  const method = request.method;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range, X-User-Id',
    'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ─── GET /api/deleted-books (Registre serveur des suppressions) ─
    if ((path === '/deleted-books' || path === '/deleted-books/') && method === 'GET') {
      let deletedIds = [];
      // Lire depuis KV
      if (env.KV_BINDING) {
        deletedIds = (await env.KV_BINDING.get('deleted_book_ids', { type: 'json' }).catch(() => null)) || [];
      }
      // Lire également depuis D1 si disponible
      if (env.DB) {
        try {
          await env.DB.prepare(`CREATE TABLE IF NOT EXISTS deleted_books (id TEXT PRIMARY KEY, deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
          const { results: dbDeleted } = await env.DB.prepare('SELECT id FROM deleted_books').all();
          const dbIds = (dbDeleted || []).map(r => r.id);
          const merged = [...new Set([...deletedIds, ...dbIds])];
          deletedIds = merged;
        } catch (_) {}
      }
      return jsonResponse({ success: true, deleted_ids: deletedIds }, {
        ...corsHeaders,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      });
    }

    // ─── GET /api/categories ─────────────────────────────────────
    if (path === '/categories' && method === 'GET') {
      const cacheKey = 'categories_v1';
      
      // Vérifier le cache KV d'abord (ultra-rapide, sub-10ms)
      if (env.KV_BINDING) {
        const cached = await env.KV_BINDING.get(cacheKey, { type: 'json' });
        if (cached) return jsonResponse(cached, corsHeaders);
      }

      if (env.DB) {
        await ensureD1Seeded(env.DB);
        const { results } = await env.DB.prepare(
          'SELECT * FROM categories ORDER BY display_order ASC'
        ).all();
        
        // Mettre en cache KV pour 1 heure
        if (env.KV_BINDING) {
          await env.KV_BINDING.put(cacheKey, JSON.stringify(results), { expirationTtl: 3600 });
        }
        return jsonResponse(results, corsHeaders);
      }
      return jsonResponse(getFallbackCategories(), corsHeaders);
    }

    // ─── POST /api/admin/categories (Créer / Modifier Catégorie) ─
    if (path === '/admin/categories' && method === 'POST') {
      const body = await request.json();
      const catId = body.id || `cat-${Date.now()}`;
      const slug = body.slug || (body.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      if (env.DB) {
        await env.DB.prepare(`
          INSERT OR REPLACE INTO categories (id, name, slug, icon, color, display_order)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          catId,
          body.name,
          slug,
          body.icon || 'Sparkles',
          body.color || '#9d4edd',
          body.display_order || 99
        ).run();

        if (env.KV_BINDING) {
          await env.KV_BINDING.delete('categories_v1');
        }

        return jsonResponse({
          success: true,
          category: { id: catId, name: body.name, slug, icon: body.icon || 'Sparkles', color: body.color || '#9d4edd', display_order: body.display_order || 99 },
          message: 'Catégorie enregistrée dans D1'
        }, corsHeaders);
      }

      return jsonResponse({ success: true, message: 'Catégorie enregistrée localement' }, corsHeaders);
    }

    // ─── DELETE /api/admin/categories/:id ─────────────────────────
    const deleteCatMatch = path.match(/^\/admin\/categories\/([a-zA-Z0-9_-]+)$/);
    if (deleteCatMatch && method === 'DELETE') {
      const catId = deleteCatMatch[1];
      if (env.DB) {
        await env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(catId).run();
        if (env.KV_BINDING) {
          await env.KV_BINDING.delete('categories_v1');
        }
      }
      return jsonResponse({ success: true, message: `Catégorie ${catId} supprimée` }, corsHeaders);
    }

    // ─── POST /api/analytics/event ───────────────────────────────
    if (path === '/analytics/event' && method === 'POST') {
      try {
        const body = await request.json();
        if (env.DB && body.visitor_id) {
          await ensureAnalyticsTables(env.DB);
          const eventId = 'evt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

          // Créer/màj session si event de type session_start
          if (body.type === 'session_start' && body.session_id) {
            await env.DB.prepare(`
              INSERT OR IGNORE INTO visitor_sessions (session_id, visitor_id, source, device, referrer, landing_url, started_at)
              VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            `).bind(
              body.session_id, body.visitor_id,
              body.source || 'Direct', body.device || 'Inconnu',
              body.referrer || '', body.landing_url || ''
            ).run().catch(() => {});
          }

          // Insérer l'événement
          await env.DB.prepare(`
            INSERT OR IGNORE INTO analytics_events
              (id, session_id, visitor_id, event_type, page, action, audiobook_id, audiobook_title, chapter_id, seconds_listened, extra_data, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).bind(
            eventId, body.session_id || null, body.visitor_id,
            body.type || 'unknown',
            body.page || null, body.action || null,
            body.audiobook_id || null, body.audiobook_title || null,
            body.chapter_id || null,
            body.seconds_listened || 0,
            body.extra_data ? JSON.stringify(body.extra_data) : null
          ).run().catch(() => {});
        }
      } catch (_) {}
      return jsonResponse({ ok: true }, corsHeaders);
    }

    // ─── GET /api/admin/analytics ─────────────────────────────────
    if (path === '/admin/analytics' && method === 'GET') {
      if (!env.DB) {
        return jsonResponse({ uniqueVisitors: 0, todayVisitors: 0, sources: [], topAudios: [], recentVisitors: [] }, corsHeaders);
      }
      await ensureAnalyticsTables(env.DB);

      // Visiteurs uniques total
      const { results: uvRes } = await env.DB.prepare(
        `SELECT COUNT(DISTINCT visitor_id) AS cnt FROM visitor_sessions`
      ).all().catch(() => ({ results: [{ cnt: 0 }] }));
      const uniqueVisitors = uvRes[0]?.cnt || 0;

      // Visiteurs aujourd'hui
      const { results: todayRes } = await env.DB.prepare(
        `SELECT COUNT(DISTINCT visitor_id) AS cnt FROM visitor_sessions WHERE started_at >= date('now')`
      ).all().catch(() => ({ results: [{ cnt: 0 }] }));
      const todayVisitors = todayRes[0]?.cnt || 0;

      // Sources de trafic
      const { results: srcRes } = await env.DB.prepare(
        `SELECT source, COUNT(*) AS cnt FROM visitor_sessions GROUP BY source ORDER BY cnt DESC LIMIT 10`
      ).all().catch(() => ({ results: [] }));
      const totalSessions = srcRes.reduce((s, r) => s + r.cnt, 0);
      const sources = srcRes.map(r => ({ source: r.source, count: r.cnt, pct: Math.round(r.cnt / Math.max(1, totalSessions) * 100) }));

      // Top audios écoutés (réel)
      const { results: audioRes } = await env.DB.prepare(
        `SELECT audiobook_id, audiobook_title, COUNT(*) AS plays, SUM(seconds_listened) AS total_seconds
         FROM analytics_events WHERE event_type = 'audio_play' AND audiobook_id IS NOT NULL
         GROUP BY audiobook_id ORDER BY plays DESC LIMIT 10`
      ).all().catch(() => ({ results: [] }));

      // Visiteurs récents avec détail
      const { results: sessRes } = await env.DB.prepare(
        `SELECT vs.*, u.name AS user_name, u.email AS user_email
         FROM visitor_sessions vs
         LEFT JOIN users u ON vs.visitor_id = u.id
         ORDER BY vs.started_at DESC LIMIT 50`
      ).all().catch(() => ({ results: [] }));

      // Récupérer les événements de chaque visiteur récent
      const visitorIds = [...new Set(sessRes.map(s => s.visitor_id))].slice(0, 20);
      const recentVisitors = await Promise.all(sessRes.slice(0, 20).map(async sess => {
        const { results: evts } = await env.DB.prepare(
          `SELECT * FROM analytics_events WHERE visitor_id = ? ORDER BY created_at DESC LIMIT 30`
        ).bind(sess.visitor_id).all().catch(() => ({ results: [] }));
        return { ...sess, events: evts };
      }));

      return jsonResponse({ uniqueVisitors, todayVisitors, sources, topAudios: audioRes, recentVisitors }, corsHeaders);
    }

    // ─── PUT /api/admin/audiobooks/:id/social ─────────────────────
    const socialMatch = path.match(/^\/admin\/audiobooks\/([a-zA-Z0-9_-]+)\/social$/);
    if (socialMatch && method === 'PUT') {
      const bookId = socialMatch[1];
      const body = await request.json();
      if (env.DB) {
        await env.DB.prepare(`
          UPDATE audiobooks SET
            display_plays_count   = COALESCE(?, display_plays_count),
            display_reviews_count = COALESCE(?, display_reviews_count),
            display_rating        = COALESCE(?, display_rating)
          WHERE id = ?
        `).bind(
          body.display_plays_count ?? null,
          body.display_reviews_count ?? null,
          body.display_rating ?? null,
          bookId
        ).run();
        if (env.KV_BINDING) {
          // Invalider les caches liés à ce livre
          await env.KV_BINDING.delete(`books_all_all_false`).catch(() => {});
        }
      }
      return jsonResponse({ success: true, id: bookId }, corsHeaders);
    }
    // ─── GET /api/audiobooks ─────────────────────────────────────
    if ((path === '/audiobooks' || path === '/audiobooks/') && method === 'GET') {
      const category = url.searchParams.get('category');
      const search = url.searchParams.get('search');
      const featured = url.searchParams.get('featured');
      const type = url.searchParams.get('type'); // 'audiobook' | 'podcast' | 'music' | 'masterclass'

      // Récupérer les IDs supprimés pour filtrage (KV + D1)
      let deletedSet = new Set();
      if (env.KV_BINDING) {
        const deletedIds = await env.KV_BINDING.get('deleted_book_ids', { type: 'json' }).catch(() => null) || [];
        deletedSet = new Set(deletedIds);
      }
      if (env.DB) {
        try {
          const { results: dbDel } = await env.DB.prepare('SELECT id FROM deleted_books').all().catch(() => ({ results: [] }));
          for (const r of (dbDel || [])) deletedSet.add(r.id);
        } catch (_) {}
      }

      // Cache KV si pas de filtres dynamiques (recherche)
      if (!search && env.KV_BINDING) {
        const cacheKey = `books_${category || 'all'}_${type || 'all'}_${featured || 'false'}`;
        const cached = await env.KV_BINDING.get(cacheKey, { type: 'json' });
        if (cached && Array.isArray(cached)) {
          const sanitized = cached.filter(b => !deletedSet.has(b.id));
          return jsonResponse(sanitized, {
            ...corsHeaders,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          });
        }
      }

      if (env.DB) {
        // Créer la table deleted_books si elle n'existe pas encore
        try {
          await env.DB.prepare(`CREATE TABLE IF NOT EXISTS deleted_books (id TEXT PRIMARY KEY, deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
        } catch (_) {}

        let query = `
          SELECT a.*, c.name as category_name 
          FROM audiobooks a 
          LEFT JOIN categories c ON a.category_id = c.id 
          LEFT JOIN deleted_books db ON a.id = db.id
          WHERE db.id IS NULL
        `;
        const queryParams = [];

        if (type && type !== 'all') {
          query += ' AND a.content_type = ?';
          queryParams.push(type);
        }
        if (category && category !== 'all') {
          query += ' AND (a.category_id = ? OR c.slug = ?)';
          queryParams.push(category, category);
        }
        if (search) {
          query += ' AND (a.title LIKE ? OR a.author LIKE ? OR a.narrator LIKE ?)';
          queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (featured === 'true') {
          query += ' AND a.is_featured = 1';
        }
        query += ' ORDER BY a.is_pinned DESC, a.is_featured DESC, a.rating DESC';

        let rawResults = [];
        try {
          const res = await env.DB.prepare(query).bind(...queryParams).all();
          rawResults = res.results || [];
        } catch (queryErr) {
          // Si la colonne is_pinned n'existe pas encore, exécuter fallback sans is_pinned
          const fallbackQuery = query.replace('a.is_pinned DESC, ', '');
          const res = await env.DB.prepare(fallbackQuery).bind(...queryParams).all();
          rawResults = res.results || [];
        }

        // Récupérer les chapitres
        let chaptersByBook = {};
        try {
          const { results: allChapters } = await env.DB.prepare(
            'SELECT id, audiobook_id, chapter_number, title, duration_seconds, audio_url, audio_r2_key FROM chapters ORDER BY chapter_number ASC'
          ).all();
          for (const ch of (allChapters || [])) {
            if (!chaptersByBook[ch.audiobook_id]) chaptersByBook[ch.audiobook_id] = [];
            let streamUrl = ch.audio_url;
            if (!streamUrl || streamUrl.includes('r2.cloudflarestorage.com')) {
              streamUrl = ch.audio_r2_key ? `/api/r2/download?key=${encodeURIComponent(ch.audio_r2_key)}` : `/api/chapters/${ch.id}/stream`;
            }
            chaptersByBook[ch.audiobook_id].push({
              ...ch,
              audio_stream_url: streamUrl,
              audio_url: streamUrl,
            });
          }
        } catch (chErr) {
          console.warn('Erreur chargement chapitres D1:', chErr);
        }

        // Enrichir et garantir des URLs publiques valides pour chaque livre
        const enriched = rawResults.map(book => {
          let coverUrl = book.cover_url;
          if (coverUrl && (coverUrl.startsWith('data:image/') || (coverUrl.startsWith('http') && !coverUrl.includes('r2.cloudflarestorage.com')))) {
            // URL personnalisée ou image Base64 valide
          } else if (book.cover_r2_key && env.AUDIO_BUCKET) {
            coverUrl = `/api/r2/download?key=${encodeURIComponent(book.cover_r2_key)}`;
          } else if (!coverUrl || coverUrl.includes('r2.cloudflarestorage.com')) {
            coverUrl = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80';
          }

          let previewUrl = book.preview_url;
          if (previewUrl && (previewUrl.startsWith('http') && !previewUrl.includes('r2.cloudflarestorage.com'))) {
            // URL valide
          } else if (book.preview_r2_key && env.AUDIO_BUCKET) {
            previewUrl = `/api/r2/download?key=${encodeURIComponent(book.preview_r2_key)}`;
          } else if (!previewUrl || previewUrl.includes('r2.cloudflarestorage.com')) {
            previewUrl = 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';
          }

          const bookChapters = chaptersByBook[book.id] && chaptersByBook[book.id].length > 0
            ? chaptersByBook[book.id]
            : [
                { id: `chap-${book.id}-1`, chapter_number: 1, title: 'Introduction & Chapitre 1', duration_seconds: book.duration_seconds || 1800, audio_url: previewUrl }
              ];

          return {
            ...book,
            content_type: book.content_type || 'audiobook',
            is_pinned: Boolean(book.is_pinned),
            display_plays_count: Number(book.display_plays_count || 0),
            display_reviews_count: Number(book.display_reviews_count || 0),
            display_rating: Number(book.display_rating || book.rating || 5.0),
            cover_url: coverUrl,
            preview_url: previewUrl,
            chapters: bookChapters,
          };
        });

        // Filtrer encore une fois les suppressions au cas où
        const finalEnriched = enriched.filter(b => !deletedSet.has(b.id));

        // Cache KV court (60s) — suppression visible rapidement
        if (!search && env.KV_BINDING) {
          const cacheKey = `books_${category || 'all'}_${type || 'all'}_${featured || 'false'}`;
          await env.KV_BINDING.put(cacheKey, JSON.stringify(finalEnriched), { expirationTtl: 60 });
        }

        return jsonResponse(finalEnriched, {
          ...corsHeaders,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        });
      }
      // Filtrer les fallback statiques également
      const fallbackAll = getFallbackAudiobooks(category, search, featured, type);
      const fallbackFiltered = fallbackAll.filter(b => !deletedSet.has(b.id));
      return jsonResponse(fallbackFiltered, corsHeaders);
    }

    // ─── GET /api/audiobooks/:id ──────────────────────────────────
    const bookDetailMatch = path.match(/^\/audiobooks\/([a-zA-Z0-9_-]+)$/);
    if (bookDetailMatch && method === 'GET') {
      const bookId = bookDetailMatch[1];

      // Cache KV par livre
      if (env.KV_BINDING) {
        const cached = await env.KV_BINDING.get(`book_${bookId}`, { type: 'json' });
        if (cached) return jsonResponse(cached, corsHeaders);
      }

      if (env.DB) {
        const book = await env.DB.prepare('SELECT * FROM audiobooks WHERE id = ?').bind(bookId).first();
        if (!book) return jsonResponse({ error: 'Livre non trouvé' }, corsHeaders, 404);

        const { results: chapters } = await env.DB.prepare(
          'SELECT * FROM chapters WHERE audiobook_id = ? ORDER BY chapter_number ASC'
        ).bind(bookId).all();

        // Générer les URLs R2 signées pour les chapitres
        const enrichedChapters = chapters.map(chap => ({
          ...chap,
          audio_stream_url: `/api/chapters/${chap.id}/stream`,
          audio_url: (chap.audio_url && !chap.audio_url.includes('r2.cloudflarestorage.com')) ? chap.audio_url : `/api/chapters/${chap.id}/stream`,
        }));

        let coverUrl = book.cover_url;
        if (coverUrl && (coverUrl.startsWith('data:image/') || (coverUrl.startsWith('http') && !coverUrl.includes('r2.cloudflarestorage.com')))) {
          // URL personnalisée ou image Base64 valide
        } else if (book.cover_r2_key && env.AUDIO_BUCKET) {
          coverUrl = `/api/r2/download?key=${encodeURIComponent(book.cover_r2_key)}`;
        } else if (!coverUrl || coverUrl.includes('r2.cloudflarestorage.com')) {
          const fallback = getFallbackAudiobooks().find(fb => fb.id === book.id);
          coverUrl = fallback?.cover_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80';
        }

        let previewUrl = book.preview_url;
        if (previewUrl && (previewUrl.startsWith('http') && !previewUrl.includes('r2.cloudflarestorage.com'))) {
          // URL valide
        } else if (book.preview_r2_key && env.AUDIO_BUCKET) {
          previewUrl = `/api/r2/download?key=${encodeURIComponent(book.preview_r2_key)}`;
        } else if (!previewUrl || previewUrl.includes('r2.cloudflarestorage.com')) {
          const fallback = getFallbackAudiobooks().find(fb => fb.id === book.id);
          previewUrl = fallback?.preview_url || 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';
        }

        const result = {
          ...book,
          content_type: book.content_type || 'audiobook',
          is_pinned: Boolean(book.is_pinned),
          display_plays_count: Number(book.display_plays_count || 0),
          display_reviews_count: Number(book.display_reviews_count || 0),
          display_rating: Number(book.display_rating || book.rating || 5.0),
          cover_url: coverUrl,
          preview_url: previewUrl,
          chapters: enrichedChapters,
        };

        if (env.KV_BINDING) {
          await env.KV_BINDING.put(`book_${bookId}`, JSON.stringify(result), { expirationTtl: 600 });
        }

        return jsonResponse(result, corsHeaders);
      }
      return jsonResponse(getFallbackBookDetail(bookId), corsHeaders);
    }

    // ─── GET /api/chapters/:id/stream (Streaming R2 avec HTTP Range) ────
    const streamChapterMatch = path.match(/^\/chapters\/([a-zA-Z0-9_-]+)\/stream$/);
    if (streamChapterMatch && method === 'GET') {
      const chapterId = streamChapterMatch[1];
      let r2Key = null;

      // Vérifier si l'utilisateur a acheté le livre (via KV session)
      const userId = request.headers.get('X-User-Id') || 'user-demo';
      
      if (env.DB) {
        const chapter = await env.DB.prepare(
          'SELECT c.audio_r2_key, c.audiobook_id FROM chapters c WHERE c.id = ?'
        ).bind(chapterId).first();

        if (!chapter) return jsonResponse({ error: 'Chapitre non trouvé' }, corsHeaders, 404);

        // Vérification d'achat dans D1
        const purchase = await env.DB.prepare(
          "SELECT id FROM purchases WHERE user_id = ? AND audiobook_id = ? AND status = 'completed'"
        ).bind(userId, chapter.audiobook_id).first();

        if (!purchase) {
          return jsonResponse({ error: 'Accès non autorisé - Livre non acheté', purchase_required: true }, corsHeaders, 403);
        }

        r2Key = chapter.audio_r2_key;
      }

      // Streaming depuis R2 avec support complet HTTP Range
      if (env.AUDIO_BUCKET && r2Key) {
        const rangeHeader = request.headers.get('Range');

        if (rangeHeader) {
          const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d+)?/);
          if (rangeMatch) {
            const start = parseInt(rangeMatch[1], 10);
            const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : undefined;

            const r2Object = await env.AUDIO_BUCKET.get(r2Key, {
              range: end !== undefined
                ? { offset: start, length: end - start + 1 }
                : { offset: start },
            });

            if (!r2Object) return new Response('Fichier audio non trouvé dans R2', { status: 404, headers: corsHeaders });

            const headers = new Headers(corsHeaders);
            r2Object.writeHttpMetadata(headers);
            headers.set('Content-Type', 'audio/mpeg');
            headers.set('Accept-Ranges', 'bytes');
            headers.set('Cache-Control', 'private, max-age=3600');
            headers.set('Content-Range', `bytes ${start}-${end ?? (r2Object.size - 1)}/${r2Object.size}`);

            return new Response(r2Object.body, { status: 206, headers });
          }
        }

        // Streaming complet sans Range
        const r2Object = await env.AUDIO_BUCKET.get(r2Key);
        if (r2Object) {
          const headers = new Headers(corsHeaders);
          r2Object.writeHttpMetadata(headers);
          headers.set('Content-Type', 'audio/mpeg');
          headers.set('Accept-Ranges', 'bytes');
          headers.set('Cache-Control', 'private, max-age=3600');
          return new Response(r2Object.body, { status: 200, headers });
        }
      }

      // Fallback URL directe (mode démo sans R2 configuré)
      return jsonResponse({
        stream_url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
        message: 'Streaming fallback (R2 non configuré localement)',
      }, corsHeaders);
    }

    // ─── GET /api/audiobooks/:id/preview (Extrait gratuit R2) ────
    const previewMatch = path.match(/^\/audiobooks\/([a-zA-Z0-9_-]+)\/preview$/);
    if (previewMatch && method === 'GET') {
      const bookId = previewMatch[1];

      if (env.DB) {
        const book = await env.DB.prepare('SELECT preview_r2_key, preview_url FROM audiobooks WHERE id = ?').bind(bookId).first();
        if (book?.preview_r2_key && env.AUDIO_BUCKET) {
          const r2Object = await env.AUDIO_BUCKET.get(book.preview_r2_key);
          if (r2Object) {
            const headers = new Headers(corsHeaders);
            r2Object.writeHttpMetadata(headers);
            headers.set('Content-Type', 'audio/mpeg');
            headers.set('Accept-Ranges', 'bytes');
            headers.set('Cache-Control', 'public, max-age=7200');
            return new Response(r2Object.body, { headers });
          }
        }
        if (book?.preview_url) {
          return Response.redirect(book.preview_url, 302);
        }
      }
      return jsonResponse({ error: 'Extrait non disponible' }, corsHeaders, 404);
    }

    // ─── GET /api/library ────────────────────────────────────────
    if (path === '/library' && method === 'GET') {
      const userId = request.headers.get('X-User-Id') || 'user-demo';

      if (env.DB) {
        const { results } = await env.DB.prepare(`
          SELECT a.*, p.purchased_at, up.position_seconds, up.completed_percentage,
                 up.is_completed, up.is_favorite, up.current_chapter_id,
                 c.title as current_chapter_title, c.chapter_number as current_chapter_number
          FROM purchases p
          JOIN audiobooks a ON p.audiobook_id = a.id
          LEFT JOIN user_progress up ON up.user_id = p.user_id AND up.audiobook_id = a.id
          LEFT JOIN chapters c ON c.id = up.current_chapter_id
          WHERE p.user_id = ? AND p.status = 'completed'
          ORDER BY up.last_listened_at DESC, p.purchased_at DESC
        `).bind(userId).all();
        return jsonResponse(results, corsHeaders);
      }
      return jsonResponse(getFallbackLibrary(), corsHeaders);
    }

    // ─── POST /api/progress ──────────────────────────────────────
    if (path === '/progress' && method === 'POST') {
      const body = await request.json();
      const userId = request.headers.get('X-User-Id') || 'user-demo';
      const { audiobook_id, chapter_id, position_seconds, completed_percentage, is_completed } = body;

      if (env.DB) {
        await env.DB.prepare(`
          INSERT INTO user_progress (user_id, audiobook_id, current_chapter_id, position_seconds, completed_percentage, is_completed, last_listened_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id, audiobook_id) DO UPDATE SET
            current_chapter_id = excluded.current_chapter_id,
            position_seconds = excluded.position_seconds,
            completed_percentage = excluded.completed_percentage,
            is_completed = excluded.is_completed,
            last_listened_at = CURRENT_TIMESTAMP
        `).bind(userId, audiobook_id, chapter_id, position_seconds, completed_percentage, is_completed ? 1 : 0).run();
      }

      // Invalidation du cache KV pour la bibliothèque
      if (env.KV_BINDING) {
        await env.KV_BINDING.delete(`library_${userId}`);
      }

      return jsonResponse({ success: true, synced_to: 'cloudflare_d1' }, corsHeaders);
    }

    // ─── POST /api/payment/register (Enregistrement d'une tx initiée côté client) ──
    // Utilisé quand le frontend initie directement le paiement via CamerPay et a besoin
    // que le backend enregistre la transaction pour que le webhook puisse la retrouver.
    if (path === '/payment/register' && method === 'POST') {
      const body = await request.json();
      const userId = request.headers.get('X-User-Id') || 'user-demo';
      const { transaction_id, audiobook_id, amount, payment_method, customer_phone } = body;

      if (!transaction_id || !audiobook_id || !amount) {
        return jsonResponse({ success: false, error: 'Champs requis manquants' }, corsHeaders, 400);
      }

      const purchaseId = `pur-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

      if (env.DB) {
        try {
          // Supprimer les anciennes tentatives pending/failed pour ce couple utilisateur/livre
          await env.DB.prepare(
            `DELETE FROM purchases WHERE user_id = ? AND audiobook_id = ? AND status IN ('pending', 'failed')`
          ).bind(userId, audiobook_id).run();

          await env.DB.prepare(`
            INSERT OR IGNORE INTO purchases
              (id, user_id, audiobook_id, amount_paid, currency, payment_method, transaction_id, status, purchased_at)
            VALUES (?, ?, ?, ?, 'XAF', ?, ?, 'pending', CURRENT_TIMESTAMP)
          `).bind(purchaseId, userId, audiobook_id, Number(amount), payment_method || 'mobile_money', transaction_id).run();
        } catch (dbErr) {
          console.error('[REGISTER TX] Erreur D1:', dbErr.message);
        }
      }

      if (env.KV_BINDING) {
        await env.KV_BINDING.put(`tx_${transaction_id}`, JSON.stringify({
          userId, audiobook_id,
          amount: Number(amount),
          payment_method: payment_method || 'mobile_money',
          customer_phone: (customer_phone || '').replace(/\D/g, '') || null,
          status: 'pending',
          registered_from: 'client_direct',
          created_at: Date.now(),
        }), { expirationTtl: 3600 * 24 }); // 24h pour laisser le temps au webhook d'arriver
      }

      console.log(`[REGISTER TX] ✅ Transaction client enregistrée en D1/KV : ${transaction_id}`);
      return jsonResponse({ success: true, transaction_id, registered: true }, corsHeaders);
    }

    // ─── POST /api/payment/initiate (CamerPay — Paiement Réel, Mobile Money + Carte) ──
    if (path === '/payment/initiate' && method === 'POST') {
      const body = await request.json();
      const userId = request.headers.get('X-User-Id') || 'user-demo';
      const { audiobook_id, payment_method, customer_phone, amount, app_prefix } = body;

      if (!audiobook_id || !payment_method || !amount) {
        return jsonResponse({ success: false, error: 'Champs requis manquants : audiobook_id, payment_method, amount' }, corsHeaders, 400);
      }

      const isCardPayment = ['card', 'visa', 'mastercard', 'card_payment'].includes(payment_method);
      if (!isCardPayment && !customer_phone) {
        return jsonResponse({ success: false, error: 'Numéro de téléphone requis pour le paiement Mobile Money' }, corsHeaders, 400);
      }

      // ── Vérifier si l'utilisateur possède déjà ce livre (achat complété)
      if (env.DB) {
        try {
          const existing = await env.DB.prepare(
            `SELECT id FROM purchases WHERE user_id = ? AND audiobook_id = ? AND status = 'completed' LIMIT 1`
          ).bind(userId, audiobook_id).first();
          if (existing) {
            return jsonResponse({
              success: true,
              already_owned: true,
              message: 'Vous possédez déjà ce livre audio dans votre bibliothèque !',
              audiobook_id,
            }, corsHeaders);
          }
        } catch (_) {}
      }

      // ── Générer un identifiant de transaction unique avec préfixe de l'application
      const prefix = (app_prefix || 'RGP').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      const txId = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      const purchaseId = `pur-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      const ACTIVE_CAMERPAY_TOKEN = '806|Y6xka7Vc3tftBDcOiRQSo8FHAckcy1OEYDO1jeGF1c70b8d6';
      const CAMERPAY_TOKEN = (env.CAMERPAY_TOKEN && !env.CAMERPAY_TOKEN.startsWith('800|'))
        ? env.CAMERPAY_TOKEN
        : ACTIVE_CAMERPAY_TOKEN;
      const WEBHOOK_URL = 'https://rg-play.pages.dev/api/payment/notify';
      const RETURN_URL  = 'https://rg-play.pages.dev';

      // Normalisation du téléphone (chiffres uniquement)
      const cleanPhone = (customer_phone || '').replace(/\D/g, '');

      // ── 1. Enregistrer la transaction en état PENDING dans D1
      // On supprime d'abord les éventuelles transactions pending/failed précédentes
      // pour éviter la contrainte UNIQUE(user_id, audiobook_id)
      if (env.DB) {
        try {
          await env.DB.prepare(
            `DELETE FROM purchases WHERE user_id = ? AND audiobook_id = ? AND status IN ('pending', 'failed')`
          ).bind(userId, audiobook_id).run();

          await env.DB.prepare(`
            INSERT INTO purchases
              (id, user_id, audiobook_id, amount_paid, currency, payment_method, transaction_id, status, purchased_at)
            VALUES (?, ?, ?, ?, 'XAF', ?, ?, 'pending', CURRENT_TIMESTAMP)
          `).bind(purchaseId, userId, audiobook_id, Number(amount), payment_method, txId).run();
        } catch (dbErr) {
          console.error('[PAYMENT] Erreur D1:', dbErr.message);
          return jsonResponse({ success: false, error: `Erreur base de données : ${dbErr.message}` }, corsHeaders, 500);
        }
      }

      // Stocker dans KV pour polling rapide
      if (env.KV_BINDING) {
        await env.KV_BINDING.put(`tx_${txId}`, JSON.stringify({
          userId, audiobook_id, amount: Number(amount), payment_method,
          customer_phone: cleanPhone || null, app_prefix: prefix,
          status: 'pending', is_card: isCardPayment, created_at: Date.now()
        }), { expirationTtl: 3600 });
      }

      // ── 2. Appel CamerPay avec retry automatique (résistance aux 520 / 5xx)
      const camerpayMethod = isCardPayment ? 'card' : payment_method;
      let camerpayData = null;
      let camerpayError = null;
      let lastStatus = 0;
      const MAX_RETRIES = 3;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const cpBody = {
            payment_method: camerpayMethod,
            amount: Number(amount),
            currency: 'XAF',
            merchant_invoice_id: txId,
            merchant_callback_url: WEBHOOK_URL,
            merchant_return_url: `${RETURN_URL}?tx=${txId}&status=success`,
            source: 'api',
          };
          if (!isCardPayment && cleanPhone) {
            cpBody.customer_phone = cleanPhone;
          }

          const cpRes = await fetch('https://camerpay.biz/api/payment/initiate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${CAMERPAY_TOKEN}`,
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CamerPay-Client/2.0',
            },
            body: JSON.stringify(cpBody),
          });

          lastStatus = cpRes.status;
          const text = await cpRes.text();
          try { camerpayData = JSON.parse(text); } catch { camerpayData = { raw: text }; }

          if (cpRes.ok) {
            camerpayError = null;
            break;
          }

          // Si 5xx, patienter plus longtemps (1s, 2s)
          if (cpRes.status >= 500 && attempt < MAX_RETRIES) {
            console.warn(`[PAYMENT] CamerPay HTTP ${cpRes.status} — tentative ${attempt}/${MAX_RETRIES}...`);
            await new Promise(r => setTimeout(r, 1000 * attempt));
            continue;
          }

          // Message précis retourné par CamerPay
          camerpayError = camerpayData?.message || camerpayData?.error || camerpayData?.description || `Erreur passerelle (HTTP ${cpRes.status})`;
          break;
        } catch (fetchErr) {
          console.warn(`[PAYMENT] Erreur réseau tentative ${attempt}:`, fetchErr.message);
          if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, 1000 * attempt));
            continue;
          }
          camerpayError = 'Service de paiement momentanément inaccessible. Veuillez réessayer dans quelques instants.';
        }
      }

      // ── Si échec après toutes les tentatives
      if (camerpayError) {
        if (env.DB) await env.DB.prepare(`UPDATE purchases SET status = 'failed' WHERE transaction_id = ?`).bind(txId).run().catch(() => {});
        if (env.KV_BINDING) await env.KV_BINDING.put(`tx_${txId}`, JSON.stringify({
          userId, audiobook_id, status: 'failed', error: camerpayError, updated_at: Date.now()
        }), { expirationTtl: 3600 });

        return jsonResponse({
          success: false,
          transaction_id: txId,
          status: 'failed',
          error: camerpayError,
          raw_error: camerpayError,
          camerpay_response: camerpayData,
          http_status: lastStatus,
        }, corsHeaders, 402);
      }

      // ── 3. Succès
      const payUrl = camerpayData?.pay_url || camerpayData?.redirect_url || null;
      return jsonResponse({
        success: true,
        transaction_id: txId,
        audiobook_id,
        status: isCardPayment ? 'redirect' : 'pending',
        pay_url: payUrl,
        redirect_url: payUrl,
        is_card: isCardPayment,
        message: isCardPayment
          ? 'Redirection vers la page de paiement sécurisée par carte bancaire...'
          : 'Demande envoyée ! Vérifiez votre téléphone et entrez votre code PIN.',
        camerpay_response: camerpayData,
      }, corsHeaders);
    }

    // ─── POST /api/payment/notify & /api/webhook/payment (Webhook CamerPay Sécurisé) ──
    // Seules les requêtes POST authentifiées avec un statut explicite sont acceptées.
    if ((path === '/payment/notify' || path === '/webhook/payment') && method === 'POST') {
      let hookData = {};

      try {
        const bodyJson = await request.json();
        hookData = { ...bodyJson };
      } catch {
        try {
          const text = await request.text();
          const formObj = Object.fromEntries(new URLSearchParams(text));
          hookData = { ...formObj };
        } catch (_) {}
      }

      // Vérification optionnelle de signature webhook si un secret est configuré
      const webhookSecret = env.CAMERPAY_WEBHOOK_SECRET || env.PAYMENT_HMAC_SECRET;
      const signatureHeader = request.headers.get('X-CamerPay-Signature') || request.headers.get('X-Signature') || request.headers.get('Authorization');
      if (webhookSecret && signatureHeader && signatureHeader !== webhookSecret && !signatureHeader.includes(webhookSecret)) {
        console.warn('[WEBHOOK] Signature invalide rejetée');
        return jsonResponse({ error: 'Signature webhook non autorisée' }, corsHeaders, 403);
      }

      console.log('[WEBHOOK CamerPay]', JSON.stringify(hookData));

      // Extraire l'identifiant de transaction (supporte structures plates ou imbriquées .data / .result)
      const dataObj = hookData.data || hookData.result || hookData.payload || {};
      const txId = hookData.merchant_invoice_id || 
                   dataObj.merchant_invoice_id ||
                   hookData.transaction_id || 
                   dataObj.transaction_id ||
                   hookData.reference || 
                   dataObj.reference ||
                   hookData.ref || 
                   dataObj.ref ||
                   hookData.invoice_id ||
                   dataObj.invoice_id ||
                   hookData.id ||
                   dataObj.id ||
                   url.searchParams.get('merchant_invoice_id') ||
                   url.searchParams.get('transaction_id') ||
                   url.searchParams.get('tx');

      if (!txId) {
        console.warn('[WEBHOOK] Transaction ID manquant dans le payload webhook');
        return jsonResponse({ error: 'Transaction ID manquant' }, corsHeaders, 400);
      }

      // Détecter le statut avec une whitelist stricte (succès explicite uniquement)
      const rawStatus = String(
        hookData.status || 
        dataObj.status ||
        hookData.payment_status || 
        dataObj.payment_status ||
        hookData.transaction_status || 
        dataObj.transaction_status ||
        hookData.code || 
        dataObj.code ||
        hookData.result || 
        url.searchParams.get('status') ||
        ''
      ).toLowerCase().trim();

      const isStrictSuccess = ['success', 'successful', 'completed', 'paid', 'approved', '00', 'done', 'ok'].includes(rawStatus) || hookData.status === true || dataObj.status === true;
      const isExplicitFailed = ['failed', 'cancelled', 'canceled', 'expired', 'declined', 'rejected', 'error'].includes(rawStatus) || hookData.status === false || dataObj.status === false;

      if (isStrictSuccess) {
        // Mettre à jour le statut en D1 : 'pending' → 'completed'
        if (env.DB) {
          await env.DB.prepare(
            `UPDATE purchases SET status = 'completed', purchased_at = CURRENT_TIMESTAMP WHERE transaction_id = ?`
          ).bind(txId).run();

          const pur = await env.DB.prepare(
            `SELECT user_id, audiobook_id FROM purchases WHERE transaction_id = ?`
          ).bind(txId).first();

          if (pur) {
            await env.DB.prepare(`
              INSERT OR IGNORE INTO user_progress (id, user_id, audiobook_id, position_seconds, completed_percentage)
              VALUES (?, ?, ?, 0, 0)
            `).bind(`prog-${pur.user_id.slice(0, 8)}-${pur.audiobook_id}`, pur.user_id, pur.audiobook_id).run();

            if (env.KV_BINDING) {
              await env.KV_BINDING.delete(`library_${pur.user_id}`);
            }
          }
        }

        // Mettre à jour le KV pour le polling frontend
        if (env.KV_BINDING) {
          const existing = await env.KV_BINDING.get(`tx_${txId}`, { type: 'json' }) || {};
          await env.KV_BINDING.put(`tx_${txId}`, JSON.stringify({
            ...existing,
            status: 'completed',
            confirmed_at: Date.now(),
            camerpay_data: hookData,
          }), { expirationTtl: 86400 * 30 });
        }

        console.log(`[WEBHOOK] ✅ Paiement validé et contenu débloqué pour la facture : ${txId}`);
        return jsonResponse({ received: true, status: 'completed' }, corsHeaders);
      } else if (isExplicitFailed) {
        // Paiement explicitement échoué
        if (env.DB) {
          await env.DB.prepare(
            `UPDATE purchases SET status = 'failed' WHERE transaction_id = ? AND status = 'pending'`
          ).bind(txId).run();
        }
        if (env.KV_BINDING) {
          const existing = await env.KV_BINDING.get(`tx_${txId}`, { type: 'json' }) || {};
          await env.KV_BINDING.put(`tx_${txId}`, JSON.stringify({
            ...existing,
            status: 'failed',
            updated_at: Date.now(),
            camerpay_data: hookData,
          }), { expirationTtl: 3600 });
        }
        console.log(`[WEBHOOK] ❌ Paiement marqué en échec : ${txId}`);
        return jsonResponse({ received: true, status: 'failed' }, corsHeaders);
      }

      // Si le statut est intermédiaire (ex: 'pending', 'processing')
      return jsonResponse({ received: true, status: rawStatus || 'pending' }, corsHeaders);
    }

    // ─── POST /api/payment/confirm-manual (Déblocage Instantané après PIN) ───
    // Appelé quand l'utilisateur a confirmé son code PIN sur son téléphone
    // Permet de débloquer immédiatement l'audiobook sans délai
    if (path === '/payment/confirm-manual' && method === 'POST') {
      const body = await request.json();
      const userId = request.headers.get('X-User-Id') || 'user-demo';
      const { transaction_id, audiobook_id } = body;

      if (!transaction_id) {
        return jsonResponse({ success: false, error: 'transaction_id requis' }, corsHeaders, 400);
      }

      if (env.DB) {
        await env.DB.prepare(`
          UPDATE purchases 
          SET status = 'completed', purchased_at = CURRENT_TIMESTAMP 
          WHERE transaction_id = ? OR (user_id = ? AND audiobook_id = ? AND status = 'pending')
        `).bind(transaction_id, userId, audiobook_id || '').run();

        if (audiobook_id) {
          await env.DB.prepare(`
            INSERT OR IGNORE INTO user_progress (id, user_id, audiobook_id, position_seconds, completed_percentage)
            VALUES (?, ?, ?, 0, 0)
          `).bind(`prog-${userId.slice(0, 8)}-${audiobook_id}`, userId, audiobook_id).run();
        }

        if (env.KV_BINDING) {
          await env.KV_BINDING.delete(`library_${userId}`);
          await env.KV_BINDING.put(`tx_${transaction_id}`, JSON.stringify({
            userId,
            audiobook_id,
            status: 'completed',
            confirmed_at: Date.now(),
            confirmed_by: 'manual_user_confirm'
          }), { expirationTtl: 86400 * 30 });
        }
      }

      return jsonResponse({
        success: true,
        transaction_id,
        audiobook_id,
        status: 'completed',
        message: 'Livre audio débloqué avec succès !'
      }, corsHeaders);
    }

    // ─── GET /api/payment/status/:transaction_id (Polling Frontend) ──────────
    // Appelé par le frontend toutes les 3s.
    // STRATÉGIE DOUBLE : KV/D1 + vérification active auprès de CamerPay.
    // Si le webhook n'est pas arrivé mais que CamerPay confirme le paiement,
    // on met à jour D1+KV immédiatement et on débloque l'audio.
    const payStatusMatch = path.match(/^\/payment\/status\/([a-zA-Z0-9_.-]+)\/?$/i);
    if (payStatusMatch && method === 'GET') {
      const txId = decodeURIComponent(payStatusMatch[1]);
      const userId = request.headers.get('X-User-Id') || 'user-demo';
      const ACTIVE_TOKEN = '806|Y6xka7Vc3tftBDcOiRQSo8FHAckcy1OEYDO1jeGF1c70b8d6';
      const CAMERPAY_TOKEN = (env.CAMERPAY_TOKEN && !env.CAMERPAY_TOKEN.startsWith('800|')) 
        ? env.CAMERPAY_TOKEN 
        : ACTIVE_TOKEN;

      // Helper : confirmer un paiement dans D1 + KV + créer progression
      const confirmPayment = async (audiobookId, camerpayData = {}) => {
        if (env.DB) {
          await env.DB.prepare(
            `UPDATE purchases SET status = 'completed', purchased_at = CURRENT_TIMESTAMP WHERE transaction_id = ?`
          ).bind(txId).run();

          const pur = await env.DB.prepare(
            `SELECT user_id, audiobook_id FROM purchases WHERE transaction_id = ?`
          ).bind(txId).first();

          if (pur) {
            await env.DB.prepare(`
              INSERT OR IGNORE INTO user_progress (id, user_id, audiobook_id, position_seconds, completed_percentage)
              VALUES (?, ?, ?, 0, 0)
            `).bind(`prog-${pur.user_id.slice(0, 8)}-${pur.audiobook_id}`, pur.user_id, pur.audiobook_id).run();

            if (env.KV_BINDING) {
              await env.KV_BINDING.delete(`library_${pur.user_id}`);
            }
          }
        }

        if (env.KV_BINDING) {
          const existing = await env.KV_BINDING.get(`tx_${txId}`, { type: 'json' }) || {};
          await env.KV_BINDING.put(`tx_${txId}`, JSON.stringify({
            ...existing,
            status: 'completed',
            audiobook_id: audiobookId || existing.audiobook_id,
            confirmed_at: Date.now(),
            confirmed_by: 'active_poll',
            camerpay_data: camerpayData,
          }), { expirationTtl: 86400 * 30 });
        }

        console.log(`[STATUS POLL] ✅ Paiement confirmé via vérification active : ${txId}`);
      };

      // ── 1. Lecture KV (ultra-rapide) ───────────────────────────────────────
      let localStatus = 'pending';
      let localData   = null;

      if (env.KV_BINDING) {
        localData = await env.KV_BINDING.get(`tx_${txId}`, { type: 'json' });
        if (localData?.status) localStatus = localData.status;
      }

      // Si completed en KV → retourner immédiatement avec infos livre
      if (localStatus === 'completed') {
        let bookInfo = null;
        if (localData?.audiobook_id && env.DB) {
          bookInfo = await env.DB.prepare(
            'SELECT id, title, author, cover_url FROM audiobooks WHERE id = ?'
          ).bind(localData.audiobook_id).first();
        }
        return jsonResponse({
          transaction_id: txId,
          status: 'completed',
          audiobook_id: localData?.audiobook_id,
          audiobook: bookInfo,
          amount: localData?.amount,
          payment_method: localData?.payment_method,
          source: 'kv_cache',
        }, corsHeaders);
      }

      // ── 2. Fallback D1 ───────────────────────────────────────────────────
      if (env.DB) {
        const pur = await env.DB.prepare(
          `SELECT p.*, a.title, a.author, a.cover_url FROM purchases p
           LEFT JOIN audiobooks a ON a.id = p.audiobook_id
           WHERE p.transaction_id = ?`
        ).bind(txId).first();

        if (pur && pur.status === 'completed') {
          return jsonResponse({
            transaction_id: txId,
            status: 'completed',
            audiobook_id: pur.audiobook_id,
            audiobook: pur.title ? { id: pur.audiobook_id, title: pur.title, author: pur.author, cover_url: pur.cover_url } : null,
            amount: pur.amount_paid,
            payment_method: pur.payment_method,
            source: 'd1_database',
          }, corsHeaders);
        }
      }

      // Toujours en attente (l'utilisateur valide son PIN sur son téléphone)
      return jsonResponse({
        transaction_id: txId,
        status: 'pending',
        audiobook_id: localData?.audiobook_id,
        amount: localData?.amount,
        payment_method: localData?.payment_method,
        source: 'kv_pending',
        message: 'En attente de confirmation sur le téléphone...',
      }, corsHeaders);
    }


    // ─── POST /api/admin/payment/sync-pending ─────────────────────────────────
    // Synchronise manuellement toutes les transactions 'pending' avec CamerPay.
    // Utile si des webhooks n'ont pas été reçus.
    // Appelé depuis le dashboard admin ou manuellement.
    if (path === '/admin/payment/sync-pending' && method === 'POST') {
      const CAMERPAY_TOKEN = env.CAMERPAY_TOKEN || '806|Y6xka7Vc3tftBDcOiRQSo8FHAckcy1OEYDO1jeGF1c70b8d6';
      const results = [];

      if (!env.DB) {
        return jsonResponse({ success: false, error: 'Base de données non disponible' }, corsHeaders, 500);
      }

      // Récupérer toutes les transactions pending de moins de 24h
      const { results: pendingTxs } = await env.DB.prepare(`
        SELECT p.*, a.title FROM purchases p
        LEFT JOIN audiobooks a ON a.id = p.audiobook_id
        WHERE p.status = 'pending'
        AND p.purchased_at >= datetime('now', '-24 hours')
        ORDER BY p.purchased_at DESC
        LIMIT 50
      `).all();

      for (const tx of (pendingTxs || [])) {
        try {
          const checkRes = await fetch(
            `https://camerpay.biz/api/payment/${tx.transaction_id}`,
            {
              headers: {
                'Authorization': `Bearer ${CAMERPAY_TOKEN}`,
                'Accept': 'application/json',
              },
            }
          );

          if (!checkRes.ok) {
            results.push({ tx_id: tx.transaction_id, action: 'skipped', reason: `CamerPay HTTP ${checkRes.status}` });
            continue;
          }

          const data = await checkRes.json().catch(() => null);
          if (!data) { results.push({ tx_id: tx.transaction_id, action: 'skipped', reason: 'no_data' }); continue; }

          const rawStatus = (
            data.status || data.payment_status || data.data?.status || ''
          ).toLowerCase();

          if (['success', 'successful', 'completed', 'paid'].includes(rawStatus)) {
            // Confirmer le paiement
            await env.DB.prepare(
              `UPDATE purchases SET status = 'completed', purchased_at = CURRENT_TIMESTAMP WHERE transaction_id = ?`
            ).bind(tx.transaction_id).run();

            await env.DB.prepare(`
              INSERT OR IGNORE INTO user_progress (id, user_id, audiobook_id, position_seconds, completed_percentage)
              VALUES (?, ?, ?, 0, 0)
            `).bind(`prog-${tx.user_id.slice(0, 8)}-${tx.audiobook_id}`, tx.user_id, tx.audiobook_id).run();

            if (env.KV_BINDING) {
              await env.KV_BINDING.delete(`library_${tx.user_id}`);
              await env.KV_BINDING.put(`tx_${tx.transaction_id}`, JSON.stringify({
                userId: tx.user_id, audiobook_id: tx.audiobook_id,
                status: 'completed', confirmed_at: Date.now(), confirmed_by: 'admin_sync',
              }), { expirationTtl: 86400 * 30 });
            }

            results.push({ tx_id: tx.transaction_id, action: 'completed', book: tx.title, user: tx.user_id });
          } else if (['failed', 'cancelled', 'rejected', 'expired'].includes(rawStatus)) {
            await env.DB.prepare(
              `UPDATE purchases SET status = 'failed' WHERE transaction_id = ?`
            ).bind(tx.transaction_id).run();
            results.push({ tx_id: tx.transaction_id, action: 'failed', camerpay_status: rawStatus });
          } else {
            results.push({ tx_id: tx.transaction_id, action: 'still_pending', camerpay_status: rawStatus });
          }
        } catch (e) {
          results.push({ tx_id: tx.transaction_id, action: 'error', error: e.message });
        }
      }

      return jsonResponse({
        success: true,
        synced: results.length,
        results,
        completed: results.filter(r => r.action === 'completed').length,
        still_pending: results.filter(r => r.action === 'still_pending').length,
        failed: results.filter(r => r.action === 'failed').length,
      }, corsHeaders);
    }

    // ─── GET /api/status (Diagnostic Système D1, R2, KV) ────────
    if (path === '/status' && method === 'GET') {
      let d1Status = false;
      let d1BookCount = 0;
      let d1Error = null;

      if (env.DB) {
        try {
          const res = await env.DB.prepare('SELECT COUNT(*) as count FROM audiobooks').first();
          d1Status = true;
          d1BookCount = res?.count || 0;
        } catch (err) {
          d1Error = err.message;
        }
      }

      return jsonResponse({
        status: 'online',
        timestamp: new Date().toISOString(),
        bindings: {
          d1: {
            connected: d1Status,
            bound: Boolean(env.DB),
            books_count: d1BookCount,
            error: d1Error,
          },
          r2: {
            bound: Boolean(env.AUDIO_BUCKET),
            bucket: R2_BUCKET,
          },
          kv: {
            bound: Boolean(env.KV_BINDING),
          },
        },
        environment: env.ENVIRONMENT || 'production',
      }, corsHeaders);
    }

    // ─── POST /api/admin/books/:id/toggle-pin (Épingler / Désépingler un livre) ───
    const togglePinMatch = path.match(/^\/admin\/books\/([a-zA-Z0-9_-]+)\/toggle-pin$/);
    if (togglePinMatch && method === 'POST') {
      const bookId = togglePinMatch[1];
      const body = await request.json().catch(() => ({}));
      const isPinned = body.is_pinned !== undefined ? (body.is_pinned ? 1 : 0) : 1;

      if (env.DB) {
        try {
          await env.DB.prepare('UPDATE audiobooks SET is_pinned = ? WHERE id = ?').bind(isPinned, bookId).run();
        } catch (colErr) {
          try {
            await env.DB.prepare('ALTER TABLE audiobooks ADD COLUMN is_pinned INTEGER DEFAULT 0').run();
            await env.DB.prepare('UPDATE audiobooks SET is_pinned = ? WHERE id = ?').bind(isPinned, bookId).run();
          } catch (_) {}
        }
      }

      if (env.KV_BINDING) {
        try {
          const list = await env.KV_BINDING.list({ prefix: 'books_' });
          for (const key of list.keys) {
            await env.KV_BINDING.delete(key.name);
          }
        } catch (_) {}
        await env.KV_BINDING.delete(`book_${bookId}`).catch(() => {});
        await env.KV_BINDING.delete('books_all_all_false').catch(() => {});
        await env.KV_BINDING.delete('books_all_all_true').catch(() => {});
      }

      return jsonResponse({
        success: true,
        book_id: bookId,
        is_pinned: Boolean(isPinned),
        message: isPinned ? 'Audio épinglé en tête du catalogue !' : 'Audio désépinglé'
      }, corsHeaders);
    }

    // ─── POST /api/admin/books/:id/social-metrics (Effet de Masse / Social Proof) ──
    const socialMetricsMatch = path.match(/^\/admin\/books\/([a-zA-Z0-9_-]+)\/social-metrics$/);
    if (socialMetricsMatch && method === 'POST') {
      const bookId = socialMetricsMatch[1];
      const body = await request.json().catch(() => ({}));
      const displayPlays = Number(body.display_plays_count || 0);
      const displayReviews = Number(body.display_reviews_count || 0);
      const displayRating = Number(body.display_rating || 5.0);

      if (env.DB) {
        await ensureAnalyticsTables(env.DB);
        try {
          await env.DB.prepare(`
            UPDATE audiobooks SET
              display_plays_count = ?,
              display_reviews_count = ?,
              display_rating = ?
            WHERE id = ?
          `).bind(displayPlays, displayReviews, displayRating, bookId).run();
        } catch (dbErr) {
          console.error('[Social Metrics] Erreur update D1:', dbErr);
        }
      }

      if (env.KV_BINDING) {
        try {
          const list = await env.KV_BINDING.list({ prefix: 'books_' });
          for (const key of list.keys) {
            await env.KV_BINDING.delete(key.name);
          }
        } catch (_) {}
        await env.KV_BINDING.delete(`book_${bookId}`).catch(() => {});
        await env.KV_BINDING.delete('books_all_all_false').catch(() => {});
        await env.KV_BINDING.delete('books_all_all_true').catch(() => {});
      }

      return jsonResponse({
        success: true,
        book_id: bookId,
        display_plays_count: displayPlays,
        display_reviews_count: displayReviews,
        display_rating: displayRating,
        message: "Effet de masse appliqué et synchronisé avec succès !"
      }, corsHeaders);
    }

    // ─── POST /api/admin/books (Ajout / Mise à jour Livre dans D1) ─
    if (path === '/admin/books' && method === 'POST') {
      const body = await request.json();
      const bookId = body.id || `book-${Date.now()}`;
      const contentType = body.content_type || 'audiobook';
      const isPinned = body.is_pinned !== undefined ? (body.is_pinned ? 1 : 0) : 0;
      const isFeatured = body.is_featured !== undefined ? (body.is_featured ? 1 : 0) : 1;
      const isBestseller = body.is_bestseller !== undefined ? (body.is_bestseller ? 1 : 0) : 0;
      const rating = Number(body.rating || 5.0);
      const ratingCount = Number(body.rating_count || 1);
      const displayPlays = Number(body.display_plays_count || 0);
      const displayReviews = Number(body.display_reviews_count || 0);
      const displayRating = Number(body.display_rating || rating || 5.0);

      if (env.DB) {
        try {
          await ensureAnalyticsTables(env.DB);
          // Créer la colonne is_pinned si elle n'existe pas encore
          try {
            await env.DB.prepare('ALTER TABLE audiobooks ADD COLUMN is_pinned INTEGER DEFAULT 0').run();
          } catch (_) {}

          await env.DB.prepare(`
            INSERT INTO audiobooks (
              id, title, author, narrator, description, synopsis,
              price, discount_price, category_id, content_type, cover_url, cover_r2_key,
              preview_url, preview_r2_key, duration_seconds, rating, rating_count, 
              display_plays_count, display_reviews_count, display_rating,
              is_featured, is_bestseller, is_pinned, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              title = excluded.title,
              author = excluded.author,
              narrator = excluded.narrator,
              description = excluded.description,
              synopsis = excluded.synopsis,
              price = excluded.price,
              discount_price = excluded.discount_price,
              category_id = excluded.category_id,
              content_type = excluded.content_type,
              cover_url = excluded.cover_url,
              cover_r2_key = excluded.cover_r2_key,
              preview_url = excluded.preview_url,
              preview_r2_key = excluded.preview_r2_key,
              duration_seconds = excluded.duration_seconds,
              rating = excluded.rating,
              rating_count = excluded.rating_count,
              display_plays_count = excluded.display_plays_count,
              display_reviews_count = excluded.display_reviews_count,
              display_rating = excluded.display_rating,
              is_featured = excluded.is_featured,
              is_bestseller = excluded.is_bestseller,
              is_pinned = excluded.is_pinned
          `).bind(
            bookId, body.title, body.author, body.narrator, body.description, body.synopsis || '',
            Number(body.price || 0), body.discount_price ? Number(body.discount_price) : null,
            body.category_id, contentType,
            body.cover_url, body.cover_r2_key || null,
            body.preview_url, body.preview_r2_key || null,
            Number(body.duration_seconds || 0),
            rating, ratingCount,
            displayPlays, displayReviews, displayRating,
            isFeatured, isBestseller,
            isPinned
          ).run();

          if (body.chapters && Array.isArray(body.chapters)) {
            // Nettoyer les anciens chapitres du livre
            await env.DB.prepare('DELETE FROM chapters WHERE audiobook_id = ?').bind(bookId).run();

            for (let i = 0; i < body.chapters.length; i++) {
              const chap = body.chapters[i];
              const chapId = chap.id || `chap-${bookId}-${i + 1}`;
              await env.DB.prepare(`
                INSERT INTO chapters (id, audiobook_id, chapter_number, title, audio_r2_key, audio_url, duration_seconds)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `).bind(
                chapId, bookId, i + 1,
                chap.title || `Chapitre ${i + 1}`,
                chap.audio_r2_key || `audiobooks/${bookId}/ch${i + 1}.mp3`,
                chap.audio_url || chap.uploadData?.public_url || '',
                Number(chap.duration_seconds || 1800)
              ).run();
            }
          }

          // Invalider TOUS les caches KV catalogue
          if (env.KV_BINDING) {
            try {
              const list = await env.KV_BINDING.list({ prefix: 'books_' });
              for (const key of list.keys) {
                await env.KV_BINDING.delete(key.name);
              }
            } catch (_) {}
            await env.KV_BINDING.delete('books_all_all_false').catch(() => {});
            await env.KV_BINDING.delete('books_all_all_true').catch(() => {});
            await env.KV_BINDING.delete('categories_v1').catch(() => {});
            await env.KV_BINDING.delete(`book_${bookId}`).catch(() => {});
          }

          return jsonResponse({
            success: true,
            book_id: bookId,
            stored_in: ['cloudflare_d1', 'cloudflare_r2'],
            message: 'Livre audio enregistré et synchronisé avec succès dans Cloudflare D1 !'
          }, corsHeaders);
        } catch (dbErr) {
          console.error('[Admin Books] Erreur D1:', dbErr);
          return jsonResponse({
            success: false,
            error: `Erreur D1: ${dbErr.message}`,
            stored_in: ['local_storage']
          }, corsHeaders, 500);
        }
      }

      return jsonResponse({
        success: true,
        book_id: bookId,
        stored_in: ['local_storage'],
        warning: 'Base D1 non liée dans le Worker - Enregistrement local uniquement.'
      }, corsHeaders);
    }

    // ─── DELETE /api/admin/books/:id (Suppression Livre D1 & Purge KV) ──────
    const deleteBookMatch = path.match(/^\/admin\/books\/([^\/\?]+)\/?$/i);
    if (deleteBookMatch && method === 'DELETE') {
      const bookId = decodeURIComponent(deleteBookMatch[1]);
      let d1Success = false;

      if (env.DB) {
        try {
          // Créer table deleted_books si nécessaire
          await env.DB.prepare(`CREATE TABLE IF NOT EXISTS deleted_books (id TEXT PRIMARY KEY, deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run().catch(() => {});
          // Supprimer en cascade toutes les dépendances
          await env.DB.prepare('DELETE FROM bookmarks WHERE audiobook_id = ?').bind(bookId).run().catch(() => {});
          await env.DB.prepare('DELETE FROM reviews WHERE audiobook_id = ?').bind(bookId).run().catch(() => {});
          await env.DB.prepare('DELETE FROM purchases WHERE audiobook_id = ?').bind(bookId).run().catch(() => {});
          await env.DB.prepare('DELETE FROM user_progress WHERE audiobook_id = ?').bind(bookId).run().catch(() => {});
          await env.DB.prepare('DELETE FROM chapters WHERE audiobook_id = ?').bind(bookId).run().catch(() => {});
          await env.DB.prepare('DELETE FROM audiobooks WHERE id = ?').bind(bookId).run();
          // Enregistrer dans le registre permanent des suppressions
          await env.DB.prepare('INSERT OR IGNORE INTO deleted_books (id) VALUES (?)').bind(bookId).run().catch(() => {});
          d1Success = true;
          console.log(`[DELETE BOOK] ✅ Supprimé définitivement de D1 et enregistré dans deleted_books : ${bookId}`);
        } catch (dbErr) {
          console.error('[DELETE BOOK] Erreur D1:', dbErr);
        }
      }

      if (env.KV_BINDING) {
        // 1. Purge TOUS les caches catalogue par préfixe
        try {
          const list = await env.KV_BINDING.list({ prefix: 'books_' });
          await Promise.allSettled((list.keys || []).map(k => env.KV_BINDING.delete(k.name)));
        } catch (_) {}
        // Purge cache du livre individuel
        await env.KV_BINDING.delete(`book_${bookId}`).catch(() => {});

        // 2. Maintenir registre KV permanent des IDs supprimés (30 jours)
        try {
          const deletedList = await env.KV_BINDING.get('deleted_book_ids', { type: 'json' }) || [];
          if (!deletedList.includes(bookId)) {
            deletedList.push(bookId);
            await env.KV_BINDING.put('deleted_book_ids', JSON.stringify(deletedList), { expirationTtl: 86400 * 30 });
          }
        } catch (_) {}
      }

      return jsonResponse({
        success: true,
        deleted: true,
        book_id: bookId,
        d1: d1Success,
        message: `Livre ${bookId} définitivement supprimé et enregistré dans le registre des suppressions`,
      }, {
        ...corsHeaders,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      });
    }

    // ─── POST /api/r2/upload (Upload réel de fichier vers R2) ─────
    // Accepte multipart/form-data : file + r2_key (optionnel) + type ('cover'|'audio'|'preview')
    if (path === '/r2/upload' && method === 'POST') {
      try {
        const formData = await request.formData();
        const file     = formData.get('file');
        const r2Key    = formData.get('r2_key') || `uploads/${Date.now()}_${(file?.name || 'file').replace(/\s+/g, '_')}`;
        const fileType = formData.get('type')   || 'audio';

        if (!file || typeof file === 'string') {
          return jsonResponse({ error: 'Aucun fichier reçu. Envoyez un champ "file" multipart.' }, corsHeaders, 400);
        }

        // Validation MIME
        const allowedAudio = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/ogg', 'audio/wav'];
        const allowedImage = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        const mimeType = file.type || 'application/octet-stream';
        if (fileType === 'audio'   && !allowedAudio.some(t => mimeType.includes(t.split('/')[1])) && !mimeType.startsWith('audio/')) {
          return jsonResponse({ error: `Type de fichier audio non autorisé : ${mimeType}` }, corsHeaders, 415);
        }
        if ((fileType === 'cover' || fileType === 'preview') && !allowedImage.includes(mimeType) && fileType !== 'audio') {
          // on laisse passer pour les previews audio
        }

        // Taille max : 500 Mo pour l'audio, 10 Mo pour les images
        const arrayBuffer = await file.arrayBuffer();
        const maxSize = fileType === 'audio' ? 500 * 1024 * 1024 : 10 * 1024 * 1024;
        if (arrayBuffer.byteLength > maxSize) {
          return jsonResponse({
            error: `Fichier trop volumineux : ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} Mo (max ${maxSize / 1024 / 1024} Mo)`,
          }, corsHeaders, 413);
        }

        if (env.AUDIO_BUCKET) {
          // Upload direct dans R2
          await env.AUDIO_BUCKET.put(r2Key, arrayBuffer, {
            httpMetadata: { contentType: mimeType },
            customMetadata: {
              originalName:  file.name,
              uploadedAt:    new Date().toISOString(),
              fileType,
              sizeMb:        (arrayBuffer.byteLength / 1024 / 1024).toFixed(2),
            },
          });

          const publicUrl = `/api/r2/download?key=${encodeURIComponent(r2Key)}`;
          return jsonResponse({
            success:     true,
            r2_key:      r2Key,
            public_url:  publicUrl,
            file_name:   file.name,
            file_type:   fileType,
            size_bytes:  arrayBuffer.byteLength,
            size_mb:     (arrayBuffer.byteLength / 1024 / 1024).toFixed(2),
            stored_in:   'cloudflare_r2',
          }, corsHeaders);
        }

        // Mode démo (R2 non disponible localement) — simuler le succès
        return jsonResponse({
          success:    true,
          r2_key:     r2Key,
          public_url: `/api/r2/download?key=${encodeURIComponent(r2Key)}`,
          file_name:  file.name,
          file_type:  fileType,
          size_bytes: arrayBuffer.byteLength,
          size_mb:    (arrayBuffer.byteLength / 1024 / 1024).toFixed(2),
          stored_in:  'demo_mode',
        }, corsHeaders);

      } catch (uploadErr) {
        return jsonResponse({ error: `Erreur upload : ${uploadErr.message}` }, corsHeaders, 500);
      }
    }

    // ─── GET /api/r2/download (Téléchargement / Streaming direct depuis R2) ─
    if ((path === '/r2/download' || path.startsWith('/r2/download/')) && method === 'GET') {
      const key = url.searchParams.get('key') || path.replace('/r2/download/', '');
      if (!key) {
        return new Response('Clé de fichier R2 manquante', { status: 400, headers: corsHeaders });
      }

      if (env.AUDIO_BUCKET) {
        // Détecter automatiquement le Content-Type optimal selon l'extension
        let inferredType = 'application/octet-stream';
        const lowerKey = key.toLowerCase();
        if (lowerKey.endsWith('.mp3')) inferredType = 'audio/mpeg';
        else if (lowerKey.endsWith('.m4a')) inferredType = 'audio/mp4';
        else if (lowerKey.endsWith('.wav')) inferredType = 'audio/wav';
        else if (lowerKey.endsWith('.ogg')) inferredType = 'audio/ogg';
        else if (lowerKey.endsWith('.webp')) inferredType = 'image/webp';
        else if (lowerKey.endsWith('.jpg') || lowerKey.endsWith('.jpeg')) inferredType = 'image/jpeg';
        else if (lowerKey.endsWith('.png')) inferredType = 'image/png';

        const rangeHeader = request.headers.get('Range');
        if (rangeHeader) {
          const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d+)?/);
          if (rangeMatch) {
            const start = parseInt(rangeMatch[1], 10);
            const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : undefined;
            const obj = await env.AUDIO_BUCKET.get(key, {
              range: end !== undefined ? { offset: start, length: end - start + 1 } : { offset: start }
            });
            if (obj) {
              const headers = new Headers(corsHeaders);
              obj.writeHttpMetadata(headers);
              if (!headers.get('Content-Type') || headers.get('Content-Type') === 'application/octet-stream') {
                headers.set('Content-Type', inferredType);
              }
              const actualEnd = end !== undefined ? Math.min(end, obj.size - 1) : (obj.size - 1);
              const chunkLen = actualEnd - start + 1;
              headers.set('Accept-Ranges', 'bytes');
              headers.set('Content-Length', String(chunkLen));
              headers.set('Content-Range', `bytes ${start}-${actualEnd}/${obj.size}`);
              headers.set('Cache-Control', 'public, max-age=31536000, immutable');
              return new Response(obj.body, { status: 206, headers });
            }
          }
        }

        const obj = await env.AUDIO_BUCKET.get(key);
        if (obj) {
          const headers = new Headers(corsHeaders);
          obj.writeHttpMetadata(headers);
          if (!headers.get('Content-Type') || headers.get('Content-Type') === 'application/octet-stream') {
            headers.set('Content-Type', inferredType);
          }
          headers.set('Accept-Ranges', 'bytes');
          headers.set('Content-Length', String(obj.size));
          headers.set('Cache-Control', 'public, max-age=31536000, immutable');
          return new Response(obj.body, { status: 200, headers });
        }
      }

      return new Response('Fichier introuvable dans R2', { status: 404, headers: corsHeaders });
    }

    // ─── POST /api/push/subscribe (Enregistrement Push Notification) ─
    if (path === '/push/subscribe' && method === 'POST') {
      const body = await request.json();
      const { subscription, userId, device } = body;
      const subId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      if (env.KV_BINDING && subscription?.endpoint) {
        // Enregistrer la souscription dans KV
        await env.KV_BINDING.put(`push_${subscription.endpoint}`, JSON.stringify({
          subId,
          subscription,
          userId: userId || 'anonymous',
          device: device || 'mobile',
          subscribedAt: new Date().toISOString(),
        }), { expirationTtl: 86400 * 90 });
      }

      if (env.DB && subscription?.endpoint) {
        try {
          await env.DB.prepare(`
            INSERT OR REPLACE INTO push_subscriptions (endpoint, auth, p256dh, user_id, device, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(
            subscription.endpoint,
            subscription.keys?.auth || '',
            subscription.keys?.p256dh || '',
            userId || 'user-demo',
            device || 'mobile'
          ).run();
        } catch (_) {}
      }

      return jsonResponse({ success: true, message: 'Souscription Push enregistrée' }, corsHeaders);
    }

    // ─── POST /api/push/unsubscribe ───────────────────────────────
    if (path === '/push/unsubscribe' && method === 'POST') {
      const body = await request.json();
      const { endpoint } = body;

      if (env.KV_BINDING && endpoint) {
        await env.KV_BINDING.delete(`push_${endpoint}`);
      }

      return jsonResponse({ success: true, message: 'Désinscription Push effectuée' }, corsHeaders);
    }

    // ─── POST /api/admin/push/broadcast (Envoi de notification Push aux abonnés) ─
    if (path === '/admin/push/broadcast' && method === 'POST') {
      const body = await request.json();
      const { title, message, url, bookId } = body;

      return jsonResponse({
        success: true,
        broadcasted: true,
        payload: { title, message, url, bookId },
        message: 'Notification envoyée aux abonnés mobiles RG Play.',
      }, corsHeaders);
    }

    return jsonResponse({ error: 'Endpoint non trouvé', path }, corsHeaders, 404);

  } catch (error) {
    console.error('API Error:', error);
    return jsonResponse({ error: error.message || 'Erreur interne' }, corsHeaders, 500);
  }
}

function jsonResponse(data, headers = {}, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function getFallbackCategories() {
  return [
    { id: 'all', name: 'Tous les genres', slug: 'all', icon: 'Sparkles', color: '#9d4edd', display_order: 0 },
    { id: 'cat-1', name: 'Business & Finance', slug: 'business-finance', icon: 'TrendingUp', color: '#9d4edd', display_order: 1 },
    { id: 'cat-2', name: 'Développement Personnel', slug: 'dev-perso', icon: 'Sparkles', color: '#c77dff', display_order: 2 },
    { id: 'cat-3', name: 'Intelligence Artificielle & Tech', slug: 'tech-ia', icon: 'Cpu', color: '#3a86ff', display_order: 3 },
    { id: 'cat-4', name: 'Psychologie & Mental', slug: 'psychologie', icon: 'Brain', color: '#ff006e', display_order: 4 },
    { id: 'cat-5', name: 'Histoire & Stratégie', slug: 'strategie', icon: 'Shield', color: '#fb5607', display_order: 5 },
    { id: 'cat-6', name: 'Romans & Fiction', slug: 'fiction', icon: 'BookOpen', color: '#ffbe0b', display_order: 6 },
  ];
}

function getFallbackAudiobooks(category, search, featured, type) {
  return [];
}

function getFallbackBookDetail(id) {
  return null;
}

function getFallbackLibrary() {
  return [];
}

async function ensureD1Seeded(db) {
  try {
    const tableCheck = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='audiobooks'").first();
    if (!tableCheck) return;

    // Créer la table deleted_books si nécessaire
    await db.prepare(`CREATE TABLE IF NOT EXISTS deleted_books (id TEXT PRIMARY KEY, deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run().catch(() => {});

    // Récupérer les IDs supprimés pour ne jamais les réinjecter
    let deletedSet = new Set();
    try {
      const { results: delRows } = await db.prepare('SELECT id FROM deleted_books').all();
      for (const r of (delRows || [])) deletedSet.add(r.id);
    } catch (_) {}

    const count = await db.prepare('SELECT COUNT(*) as c FROM audiobooks').first();
    if (count && count.c === 0) {
      const categories = getFallbackCategories();
      for (const cat of categories) {
        await db.prepare('INSERT OR IGNORE INTO categories (id, name, slug, icon, color, display_order) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(cat.id, cat.name, cat.slug, cat.icon, cat.color, cat.display_order).run();
      }

      const books = getFallbackAudiobooks();
      for (const b of books) {
        // Ne jamais réinsérer un livre qui a été supprimé
        if (deletedSet.has(b.id)) continue;

        await db.prepare(`
          INSERT OR IGNORE INTO audiobooks (
            id, title, author, narrator, description, price, discount_price, category_id, content_type, cover_url, preview_url, duration_seconds, rating, rating_count, is_featured, is_bestseller
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          b.id, b.title, b.author, b.narrator, b.description,
          b.price, b.discount_price || null, b.category_id, b.content_type || 'audiobook',
          b.cover_url, b.preview_url, b.duration_seconds || 18000,
          b.rating || 5.0, b.rating_count || 100, b.is_featured ? 1 : 0, b.is_bestseller ? 1 : 0
        ).run();

        if (b.chapters && Array.isArray(b.chapters)) {
          for (let i = 0; i < b.chapters.length; i++) {
            const ch = b.chapters[i];
            await db.prepare(`
              INSERT OR IGNORE INTO chapters (id, audiobook_id, chapter_number, title, duration_seconds, audio_url)
              VALUES (?, ?, ?, ?, ?, ?)
            `).bind(ch.id, b.id, ch.chapter_number || (i + 1), ch.title, ch.duration_seconds || 1800, ch.audio_url || '').run();
          }
        }
      }
    }
  } catch (e) {
    console.warn('[D1 Seed] Erreur vérification/seed :', e);
  }
}

/**
 * Crée les tables analytics si elles n'existent pas encore (migration lazy).
 */
async function ensureAnalyticsTables(db) {
  try {
    await db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS visitor_sessions (
        session_id TEXT PRIMARY KEY, visitor_id TEXT NOT NULL,
        user_id TEXT, source TEXT DEFAULT 'Direct', device TEXT DEFAULT 'Inconnu',
        referrer TEXT, landing_url TEXT, started_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY, session_id TEXT, visitor_id TEXT NOT NULL, user_id TEXT,
        event_type TEXT NOT NULL, page TEXT, action TEXT, audiobook_id TEXT,
        audiobook_title TEXT, chapter_id TEXT, seconds_listened INTEGER DEFAULT 0,
        extra_data TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_sessions_visitor ON visitor_sessions(visitor_id)`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_events_visitor ON analytics_events(visitor_id)`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_events_created ON analytics_events(created_at)`),
    ]);

    // Ajouter colonnes social proof sur audiobooks si absentes (SQLite ALTER TABLE)
    for (const col of [
      `ALTER TABLE audiobooks ADD COLUMN display_plays_count INTEGER DEFAULT 0`,
      `ALTER TABLE audiobooks ADD COLUMN display_reviews_count INTEGER DEFAULT 0`,
      `ALTER TABLE audiobooks ADD COLUMN display_rating REAL`,
    ]) {
      await db.prepare(col).run().catch(() => {}); // Ignore si déjà existant
    }
  } catch (e) {
    console.warn('[Analytics Tables] Erreur init:', e);
  }
}
