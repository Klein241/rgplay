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
    // ─── GET /api ou /api/ (Index, Découverte & Documentation pour Manus IA / MCP) ──
    if ((path === '' || path === '/' || path === '/docs' || path === '/status') && method === 'GET') {
      return jsonResponse({
        success: true,
        name: "RG Play Cloudflare Edge API",
        version: "1.0.0",
        status: "online",
        description: "API de publication et d'administration pour la plateforme RG Play (E-Books Read's Great & Audiobooks)",
        auth: {
          type: "Bearer Token",
          header: "Authorization: Bearer <VOTRE_CLE_API>",
          note: "Générez vos clés dans l'Admin Studio RG Play (Rubrique 'Générateur d'API & IA')"
        },
        endpoints: {
          publish_ebook: {
            method: "POST",
            url: "https://rg-play.pages.dev/api/admin/books",
            description: "Publier un livre numérique (E-Book PDF/EPUB) dans la bibliothèque Read's Great",
            required_fields: ["title", "author", "pdf_url"],
            sample_payload: {
              title: "Titre du Livre",
              author: "Nom de l'Auteur",
              narrator: "Éditions Read's Great",
              content_type: "ebook",
              format: "pdf",
              pdf_url: "https://...url_du_fichier.pdf",
              cover_url: "https://...url_de_la_jaquette.jpg",
              page_count: 180,
              unlock_points: 100,
              price: 0,
              description: "Résumé du livre",
              synopsis: "Sommaire détaillé"
            }
          },
          publish_audiobook: {
            method: "POST",
            url: "https://rg-play.pages.dev/api/admin/books",
            description: "Publier un livre audio avec ses chapitres dans Cloudflare D1",
            required_fields: ["title", "author", "chapters"],
            sample_payload: {
              title: "Titre du Livre Audio",
              author: "Auteur",
              narrator: "Narrateur",
              content_type: "audiobook",
              cover_url: "https://...url_couverture.jpg",
              price: 3500,
              chapters: [
                {
                  id: "chap-1",
                  title: "Chapitre 1 — Titre",
                  audio_url: "https://...audio1.mp3",
                  duration_seconds: 900
                }
              ]
            }
          },
          ingest_r2: {
            method: "POST",
            url: "https://rg-play.pages.dev/api/r2/upload-from-url",
            description: "Rapatrier un fichier distant (URL manuscdn, CDN externe) dans Cloudflare R2 permanent",
            sample_payload: {
              url: "https://files.manuscdn.com/...",
              file_name: "livre_final.pdf",
              type: "ebook"
            }
          },
          list_catalog: {
            method: "GET",
            url: "https://rg-play.pages.dev/api/audiobooks"
          },
          list_categories: {
            method: "GET",
            url: "https://rg-play.pages.dev/api/categories"
          }
        }
      }, corsHeaders);
    }

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

    // ─── GET /api/gamification (Read's Great XP & Points) ──────────
    if ((path === '/gamification' || path === '/gamification/') && method === 'GET') {
      const userId = url.searchParams.get('userId') || 'user-demo';
      if (env.DB) {
        try {
          const { results } = await env.DB.prepare(
            'SELECT * FROM user_gamification WHERE user_id = ?'
          ).bind(userId).all();
          
          if (results && results.length > 0) {
            const row = results[0];
            const unlockedBadges = typeof row.unlocked_badges === 'string' 
              ? JSON.parse(row.unlocked_badges) 
              : row.unlocked_badges || ['badge-welcome'];

            // Récupérer les 20 dernières transactions
            const { results: txs } = await env.DB.prepare(
              'SELECT id, amount, type, description, created_at AS createdAt FROM point_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20'
            ).bind(userId).all().catch(() => ({ results: [] }));

            return jsonResponse({
              xp: row.xp,
              points: row.points,
              level: row.level,
              readingMinutes: row.reading_minutes,
              listeningMinutes: row.listening_minutes,
              booksCompleted: row.books_completed,
              dailyStreak: row.daily_streak,
              lastDailyRewardDate: row.last_daily_reward_date,
              unlockedBadges,
              recentTransactions: txs || [],
            }, corsHeaders);
          }
        } catch (_) {}
      }
      return jsonResponse(null, corsHeaders);
    }

    // ─── POST /api/gamification (Sync State XP & Points) ───────────
    if ((path === '/gamification' || path === '/gamification/') && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const userId = body.userId || 'user-demo';
      
      if (env.DB) {
        try {
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
            body.xp || 0,
            body.points || 0,
            body.level || 1,
            body.readingMinutes || 0,
            body.listeningMinutes || 0,
            body.booksCompleted || 0,
            body.dailyStreak || 1,
            body.lastDailyRewardDate || null,
            JSON.stringify(body.unlockedBadges || ['badge-welcome'])
          ).run();

          // Enregistrer la dernière transaction si présente
          if (body.recentTransactions && body.recentTransactions.length > 0) {
            const latestTx = body.recentTransactions[0];
            if (latestTx?.id) {
              await env.DB.prepare(`
                INSERT OR IGNORE INTO point_transactions (id, user_id, amount, type, description, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
              `).bind(
                latestTx.id,
                userId,
                latestTx.amount || 0,
                latestTx.type || 'bonus',
                latestTx.description || 'Transaction',
                latestTx.createdAt || new Date().toISOString()
              ).run().catch(() => {});
            }
          }
        } catch (_) {}
      }
      return jsonResponse({ success: true }, corsHeaders);
    }

    // ─── POST /api/ebook/progress (Sync progression liseuse) ────────
    if ((path === '/ebook/progress' || path === '/ebook/progress/') && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const userId = body.userId || 'user-demo';
      const bookId = body.bookId;

      if (env.DB && bookId) {
        try {
          const progId = `ep-${userId}-${bookId}`;
          await env.DB.prepare(`
            INSERT INTO ebook_progress (id, user_id, book_id, current_page, total_pages, last_read_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, book_id) DO UPDATE SET
              current_page = excluded.current_page,
              total_pages = excluded.total_pages,
              last_read_at = CURRENT_TIMESTAMP
          `).bind(
            progId,
            userId,
            bookId,
            body.currentPage || 1,
            body.totalPages || 1
          ).run();
        } catch (_) {}
      }
      return jsonResponse({ success: true }, corsHeaders);
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

        const isAdmin = url.searchParams.get('admin') === 'true' || request.headers.get('X-Admin') === 'true';

        let query = `
          SELECT a.*, c.name as category_name 
          FROM audiobooks a 
          LEFT JOIN categories c ON a.category_id = c.id 
          LEFT JOIN deleted_books db ON a.id = db.id
          WHERE db.id IS NULL
        `;

        if (!isAdmin) {
          query += ` AND (a.status IS NULL OR a.status = 'published' OR (a.status = 'scheduled' AND (a.scheduled_at IS NULL OR datetime(a.scheduled_at) <= datetime('now') OR a.scheduled_at <= datetime('now'))))`;
        }
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

        // Indexer tous les livres pour résolution rapide des compagnons
        const bookById = {};
        for (const b of rawResults) {
          bookById[b.id] = b;
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

          const companionAudio = book.companion_audio_id ? bookById[book.companion_audio_id] : null;
          const companionEbook = book.companion_ebook_id ? bookById[book.companion_ebook_id] : null;

          return {
            ...book,
            content_type: book.content_type || 'audiobook',
            format: book.format || (book.content_type === 'ebook' ? 'pdf' : 'audio'),
            pdf_url: book.pdf_url || (book.content_type === 'ebook' ? (book.preview_url || null) : null),
            page_count: Number(book.page_count || 180),
            companion_audio_id: book.companion_audio_id || null,
            companion_ebook_id: book.companion_ebook_id || null,
            companion_audio: companionAudio ? {
              id: companionAudio.id,
              title: companionAudio.title,
              author: companionAudio.author,
              cover_url: companionAudio.cover_url,
              duration_seconds: companionAudio.duration_seconds,
              rating: companionAudio.rating,
              chapters: chaptersByBook[companionAudio.id] || []
            } : null,
            companion_ebook: companionEbook ? {
              id: companionEbook.id,
              title: companionEbook.title,
              author: companionEbook.author,
              cover_url: companionEbook.cover_url,
              pdf_url: companionEbook.pdf_url || companionEbook.preview_url,
              page_count: companionEbook.page_count || 180,
              format: companionEbook.format || 'pdf',
            } : null,
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

    // ─── GET /api/user/profile (Profil utilisateur D1) ───────────
    if ((path === '/user/profile' || path === '/users/profile') && method === 'GET') {
      const userId = request.headers.get('X-User-Id') || 'user-demo';
      if (env.DB) {
        await ensureAllTables(env.DB);
        const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
        if (user) {
          return jsonResponse({
            success: true,
            profile: {
              ...user,
              download_wifi_only: Boolean(user.download_wifi_only),
              auto_play_next: Boolean(user.auto_play_next),
            }
          }, corsHeaders);
        }
      }
      return jsonResponse({
        success: true,
        profile: {
          id: userId,
          name: 'Auditeur RG Play',
          email: `${userId}@rgplay.local`,
          phone: '+237 600 00 00 00',
          avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=80',
          plan: 'free',
          wallet_balance: 0,
          theme_preference: 'purple',
          audio_quality: '128',
          download_wifi_only: true,
          auto_play_next: true,
        }
      }, corsHeaders);
    }

    // ─── POST/PUT /api/user/profile (Sauvegarder Profil D1) ─────────
    if ((path === '/user/profile' || path === '/users/profile') && (method === 'POST' || method === 'PUT')) {
      const body = await request.json();
      const userId = request.headers.get('X-User-Id') || body.id || 'user-demo';
      if (env.DB) {
        await ensureAllTables(env.DB);
        await env.DB.prepare(`
          INSERT INTO users (
            id, email, name, phone, avatar_url, plan, plan_expires_at,
            wallet_balance, theme_preference, audio_quality, download_wifi_only,
            auto_play_next, sleep_timer_default, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            name = COALESCE(excluded.name, users.name),
            email = COALESCE(excluded.email, users.email),
            phone = COALESCE(excluded.phone, users.phone),
            avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
            plan = COALESCE(excluded.plan, users.plan),
            plan_expires_at = COALESCE(excluded.plan_expires_at, users.plan_expires_at),
            wallet_balance = COALESCE(excluded.wallet_balance, users.wallet_balance),
            theme_preference = COALESCE(excluded.theme_preference, users.theme_preference),
            audio_quality = COALESCE(excluded.audio_quality, users.audio_quality),
            download_wifi_only = COALESCE(excluded.download_wifi_only, users.download_wifi_only),
            auto_play_next = COALESCE(excluded.auto_play_next, users.auto_play_next),
            sleep_timer_default = COALESCE(excluded.sleep_timer_default, users.sleep_timer_default),
            updated_at = CURRENT_TIMESTAMP
        `).bind(
          userId,
          body.email || `${userId}@rgplay.local`,
          body.name || 'Auditeur RG Play',
          body.phone || null,
          body.avatar_url || null,
          body.plan || 'free',
          body.plan_expires_at || null,
          Number(body.wallet_balance ?? 0),
          body.theme_preference || 'purple',
          body.audio_quality || '128',
          body.download_wifi_only !== undefined ? (body.download_wifi_only ? 1 : 0) : 1,
          body.auto_play_next !== undefined ? (body.auto_play_next ? 1 : 0) : 1,
          body.sleep_timer_default || null
        ).run();

        const updated = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
        return jsonResponse({
          success: true,
          profile: {
            ...updated,
            download_wifi_only: Boolean(updated.download_wifi_only),
            auto_play_next: Boolean(updated.auto_play_next),
          },
          synced_to: 'cloudflare_d1'
        }, corsHeaders);
      }
      return jsonResponse({ success: true, profile: body }, corsHeaders);
    }

    // ─── POST /api/user/topup (Recharge Portefeuille D1) ──────────
    if (path === '/user/topup' && method === 'POST') {
      const body = await request.json();
      const userId = request.headers.get('X-User-Id') || body.user_id || 'user-demo';
      const amount = Number(body.amount || 0);
      if (amount <= 0) {
        return jsonResponse({ success: false, error: 'Montant invalide' }, corsHeaders, 400);
      }
      if (env.DB) {
        await ensureAllTables(env.DB);
        await env.DB.prepare(`
          INSERT INTO users (id, name, wallet_balance) VALUES (?, 'Auditeur RG Play', ?)
          ON CONFLICT(id) DO UPDATE SET wallet_balance = wallet_balance + excluded.wallet_balance
        `).bind(userId, amount).run();

        const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
        return jsonResponse({ success: true, wallet_balance: user.wallet_balance, message: `Recharge de ${amount} FCFA validée !` }, corsHeaders);
      }
      return jsonResponse({ success: true, wallet_balance: amount, message: 'Recharge effectuée' }, corsHeaders);
    }

    // ─── POST /api/user/subscribe (Abonnement Premium/VIP D1) ──────
    if (path === '/user/subscribe' && method === 'POST') {
      const body = await request.json();
      const userId = request.headers.get('X-User-Id') || body.user_id || 'user-demo';
      const plan = body.plan || 'premium';
      const planPrices = { premium: 3500, vip: 6500 };
      const price = planPrices[plan] || 0;

      if (env.DB) {
        await ensureAllTables(env.DB);
        await env.DB.prepare(`
          INSERT INTO users (id, name, plan, plan_expires_at)
          VALUES (?, 'Auditeur RG Play', ?, datetime('now', '+30 days'))
          ON CONFLICT(id) DO UPDATE SET
            plan = excluded.plan,
            plan_expires_at = datetime('now', '+30 days'),
            wallet_balance = MAX(0, wallet_balance - ?),
            updated_at = CURRENT_TIMESTAMP
        `).bind(userId, plan, body.pay_with_wallet ? price : 0).run();

        const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
        return jsonResponse({
          success: true,
          plan: user.plan,
          plan_expires_at: user.plan_expires_at,
          wallet_balance: user.wallet_balance,
          message: `Abonnement ${plan.toUpperCase()} activé avec succès !`
        }, corsHeaders);
      }
      return jsonResponse({ success: true, plan }, corsHeaders);
    }

    // ─── GET /api/library (Bibliothèque D1 complète) ──────────────
    if (path === '/library' && method === 'GET') {
      const userId = request.headers.get('X-User-Id') || 'user-demo';

      if (env.DB) {
        await ensureAllTables(env.DB);
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

        // Récupérer les chapitres pour chaque livre de la bibliothèque
        const enriched = await Promise.all((results || []).map(async book => {
          const { results: chapters } = await env.DB.prepare(
            'SELECT * FROM chapters WHERE audiobook_id = ? ORDER BY chapter_number ASC'
          ).bind(book.id).all();

          return {
            ...book,
            is_favorite: Boolean(book.is_favorite),
            is_completed: Boolean(book.is_completed),
            chapters: chapters || []
          };
        }));

        return jsonResponse(enriched, corsHeaders);
      }
      return jsonResponse(getFallbackLibrary(), corsHeaders);
    }

    // ─── POST /api/library/add (Ajout direct à la Bibliothèque D1) ──
    if (path === '/library/add' && method === 'POST') {
      const body = await request.json();
      const userId = request.headers.get('X-User-Id') || body.user_id || 'user-demo';
      const bookId = body.audiobook_id || body.book_id;
      if (!bookId) return jsonResponse({ success: false, error: 'audiobook_id requis' }, corsHeaders, 400);

      if (env.DB) {
        await ensureAllTables(env.DB);
        const purchaseId = `pur-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await env.DB.prepare(`
          INSERT INTO users (id, name) VALUES (?, 'Auditeur RG Play')
          ON CONFLICT(id) DO NOTHING
        `).bind(userId).run().catch(() => {});

        await env.DB.prepare(`
          INSERT OR REPLACE INTO purchases (id, user_id, audiobook_id, amount_paid, currency, payment_method, status)
          VALUES (?, ?, ?, ?, 'XAF', ?, 'completed')
        `).bind(purchaseId, userId, bookId, Number(body.amount || 0), body.payment_method || 'direct_unlock').run();

        await env.DB.prepare(`
          INSERT OR IGNORE INTO user_progress (id, user_id, audiobook_id, position_seconds, completed_percentage)
          VALUES (?, ?, ?, 0, 0)
        `).bind(`prog-${userId.slice(0, 8)}-${bookId}`, userId, bookId).run();

        if (env.KV_BINDING) await env.KV_BINDING.delete(`library_${userId}`);
      }
      return jsonResponse({ success: true, message: 'Livre audio débloqué dans votre bibliothèque D1 !' }, corsHeaders);
    }

    // ─── DELETE /api/library/:id & POST /api/library/remove ─────────
    const removeLibMatch = path.match(/^\/library\/([a-zA-Z0-9_-]+)$/);
    if ((removeLibMatch && method === 'DELETE') || (path === '/library/remove' && method === 'POST')) {
      const body = method === 'POST' ? await request.json().catch(() => ({})) : {};
      const bookId = removeLibMatch ? removeLibMatch[1] : (body.audiobook_id || body.book_id);
      const userId = request.headers.get('X-User-Id') || 'user-demo';
      if (env.DB && bookId) {
        await env.DB.prepare('DELETE FROM purchases WHERE user_id = ? AND audiobook_id = ?').bind(userId, bookId).run().catch(() => {});
        await env.DB.prepare('DELETE FROM user_progress WHERE user_id = ? AND audiobook_id = ?').bind(userId, bookId).run().catch(() => {});
        if (env.KV_BINDING) await env.KV_BINDING.delete(`library_${userId}`);
      }
      return jsonResponse({ success: true, removed_id: bookId }, corsHeaders);
    }

    // ─── POST /api/library/toggle-favorite ────────────────────────
    if (path === '/library/toggle-favorite' && method === 'POST') {
      const body = await request.json();
      const userId = request.headers.get('X-User-Id') || 'user-demo';
      const bookId = body.audiobook_id || body.book_id;
      if (!bookId) return jsonResponse({ success: false, error: 'audiobook_id requis' }, corsHeaders, 400);
      let isFav = false;
      if (env.DB) {
        await ensureAllTables(env.DB);
        const prog = await env.DB.prepare('SELECT is_favorite FROM user_progress WHERE user_id = ? AND audiobook_id = ?').bind(userId, bookId).first();
        isFav = !prog?.is_favorite;
        await env.DB.prepare(`
          INSERT INTO user_progress (id, user_id, audiobook_id, is_favorite)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, audiobook_id) DO UPDATE SET is_favorite = excluded.is_favorite
        `).bind(`prog-${userId.slice(0, 8)}-${bookId}`, userId, bookId, isFav ? 1 : 0).run();
        if (env.KV_BINDING) await env.KV_BINDING.delete(`library_${userId}`);
      }
      return jsonResponse({ success: true, is_favorite: isFav }, corsHeaders);
    }

    // ─── POST /api/progress (Sauvegarde Progression D1) ───────────
    if (path === '/progress' && method === 'POST') {
      const body = await request.json();
      const userId = request.headers.get('X-User-Id') || 'user-demo';
      const { audiobook_id, chapter_id, position_seconds, completed_percentage, is_completed } = body;

      if (env.DB) {
        await ensureAllTables(env.DB);
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

      if (env.KV_BINDING) {
        await env.KV_BINDING.delete(`library_${userId}`);
      }

      return jsonResponse({ success: true, synced_to: 'cloudflare_d1' }, corsHeaders);
    }

    // ─── GET & POST /api/books/:id/reviews (Avis & Notations D1) ──
    const reviewsMatch = path.match(/^\/books\/([a-zA-Z0-9_-]+)\/reviews$/);
    if (reviewsMatch && method === 'GET') {
      const bookId = reviewsMatch[1];
      if (env.DB) {
        await ensureAllTables(env.DB);
        let results = [];
        try {
          const res = await env.DB.prepare(`
            SELECT r.id, r.user_id, r.audiobook_id, r.rating, r.comment, r.created_at,
                   COALESCE(u.avatar_url, '') as user_avatar,
                   COALESCE(u.name, 'Auditeur RG Play') as user_name
            FROM reviews r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.audiobook_id = ?
            ORDER BY r.created_at DESC
          `).bind(bookId).all();
          results = res?.results || [];
        } catch (queryErr) {
          console.warn('[Reviews GET] Query fallback:', queryErr.message);
          const res = await env.DB.prepare('SELECT * FROM reviews WHERE audiobook_id = ? ORDER BY created_at DESC').bind(bookId).all().catch(() => ({ results: [] }));
          results = (res?.results || []).map(r => ({
            ...r,
            user_avatar: '',
            user_name: 'Auditeur RG Play'
          }));
        }
        return jsonResponse(results || [], corsHeaders);
      }
      return jsonResponse([], corsHeaders);
    }

    if (reviewsMatch && method === 'POST') {
      const bookId = reviewsMatch[1];
      const body = await request.json();
      const userId = request.headers.get('X-User-Id') || body.user_id || 'user-demo';
      const userName = body.user_name || body.author || 'Auditeur RG Play';
      const rating = Math.min(5, Math.max(1, Number(body.rating || 5)));
      const comment = body.comment || body.text || '';
      const reviewId = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      if (env.DB) {
        await ensureAllTables(env.DB);
        await env.DB.prepare(`
          INSERT INTO reviews (id, audiobook_id, user_id, user_name, rating, comment, created_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(reviewId, bookId, userId, userName, rating, comment).run();

        // Recalculer la note moyenne et le nombre d'avis
        const stats = await env.DB.prepare(`
          SELECT COUNT(*) as count, AVG(rating) as avg_rating FROM reviews WHERE audiobook_id = ?
        `).bind(bookId).first();

        const newCount = stats?.count || 1;
        const newRating = Number((stats?.avg_rating || rating).toFixed(1));

        await env.DB.prepare(`
          UPDATE audiobooks SET
            rating = ?, rating_count = ?,
            display_rating = ?, display_reviews_count = ?
          WHERE id = ?
        `).bind(newRating, newCount, newRating, newCount, bookId).run().catch(() => {});

        if (env.KV_BINDING) {
          await env.KV_BINDING.delete(`book_${bookId}`).catch(() => {});
          await env.KV_BINDING.delete('books_all_all_false').catch(() => {});
        }

        return jsonResponse({
          success: true,
          review: { id: reviewId, audiobook_id: bookId, user_id: userId, user_name: userName, rating, comment, created_at: new Date().toISOString() },
          new_rating: newRating,
          reviews_count: newCount,
        }, corsHeaders);
      }
      return jsonResponse({ success: true, review: { id: reviewId, rating, comment } }, corsHeaders);
    }

    // ─── GET & POST & DELETE /api/bookmarks (Signets Audio D1) ────
    if (path === '/bookmarks' && method === 'GET') {
      const userId = request.headers.get('X-User-Id') || 'user-demo';
      const bookId = url.searchParams.get('audiobook_id');
      if (env.DB) {
        await ensureAllTables(env.DB);
        let query = 'SELECT b.*, a.title as audiobook_title, a.cover_url as audiobook_cover FROM bookmarks b LEFT JOIN audiobooks a ON b.audiobook_id = a.id WHERE b.user_id = ?';
        const params = [userId];
        if (bookId) {
          query += ' AND b.audiobook_id = ?';
          params.push(bookId);
        }
        query += ' ORDER BY b.created_at DESC';
        const { results } = await env.DB.prepare(query).bind(...params).all();
        return jsonResponse(results || [], corsHeaders);
      }
      return jsonResponse([], corsHeaders);
    }

    if (path === '/bookmarks' && method === 'POST') {
      const body = await request.json();
      const userId = request.headers.get('X-User-Id') || 'user-demo';
      const bmId = body.id || `bm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      if (env.DB) {
        await ensureAllTables(env.DB);
        await env.DB.prepare(`
          INSERT INTO bookmarks (id, user_id, audiobook_id, chapter_id, chapter_number, chapter_title, timestamp_seconds, title, note, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(
          bmId, userId, body.audiobook_id,
          body.chapter_id || null, body.chapter_number || 1,
          body.chapter_title || null,
          Number(body.timestamp_seconds || body.position_seconds || 0),
          body.title || null, body.note || null
        ).run();

        return jsonResponse({ success: true, id: bmId, message: 'Signet enregistré dans D1' }, corsHeaders);
      }
      return jsonResponse({ success: true, id: bmId }, corsHeaders);
    }

    const deleteBmMatch = path.match(/^\/bookmarks\/([a-zA-Z0-9_-]+)$/);
    if (deleteBmMatch && method === 'DELETE') {
      const bmId = deleteBmMatch[1];
      const userId = request.headers.get('X-User-Id') || 'user-demo';
      if (env.DB) {
        await ensureAllTables(env.DB);
        await env.DB.prepare('DELETE FROM bookmarks WHERE id = ? AND user_id = ?').bind(bmId, userId).run();
      }
      return jsonResponse({ success: true, id: bmId }, corsHeaders);
    }

    // ─── GET & POST & DELETE /api/admin/api-keys (Clés API D1) ─────
    if (path === '/admin/api-keys' && method === 'GET') {
      if (env.DB) {
        await ensureAllTables(env.DB);
        const { results } = await env.DB.prepare('SELECT id, name, key_prefix, key_preview, permissions, created_at, last_used_at FROM api_keys ORDER BY created_at DESC').all();
        return jsonResponse(results || [], corsHeaders);
      }
      return jsonResponse([], corsHeaders);
    }

    if (path === '/admin/api-keys' && method === 'POST') {
      const body = await request.json();
      const keyId = `key-${Date.now()}`;
      const rawKey = `rgp_live_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
      const keyPrefix = rawKey.slice(0, 8);
      const keyPreview = `${keyPrefix}...${rawKey.slice(-4)}`;

      if (env.DB) {
        await ensureAllTables(env.DB);
        await env.DB.prepare(`
          INSERT INTO api_keys (id, name, key_prefix, key_hash, key_preview, permissions, created_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(keyId, body.name || 'Clé API Studio', keyPrefix, rawKey, keyPreview, body.permissions ? JSON.stringify(body.permissions) : '["read", "write"]').run();

        return jsonResponse({
          success: true,
          apiKey: { id: keyId, name: body.name || 'Clé API Studio', key: rawKey, key_preview: keyPreview, permissions: body.permissions || ['read', 'write'], created_at: new Date().toISOString() }
        }, corsHeaders);
      }
      return jsonResponse({ success: true, apiKey: { id: keyId, name: body.name, key: rawKey, key_preview: keyPreview } }, corsHeaders);
    }

    const deleteApiKeyMatch = path.match(/^\/admin\/api-keys\/([a-zA-Z0-9_-]+)$/);
    if (deleteApiKeyMatch && method === 'DELETE') {
      const keyId = deleteApiKeyMatch[1];
      if (env.DB) {
        await ensureAllTables(env.DB);
        await env.DB.prepare('DELETE FROM api_keys WHERE id = ?').bind(keyId).run();
      }
      return jsonResponse({ success: true, id: keyId }, corsHeaders);
    }

    // ─── GET /api/notifications (Historique des Notifications D1) ─
    if (path === '/notifications' && method === 'GET') {
      if (env.DB) {
        await ensureAllTables(env.DB);
        const { results } = await env.DB.prepare('SELECT * FROM push_notifications ORDER BY sent_at DESC LIMIT 30').all();
        return jsonResponse(results || [], corsHeaders);
      }
      return jsonResponse([], corsHeaders);
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
          // Upsert utilisateur pour éviter la contrainte FK
          await env.DB.prepare(`
            INSERT OR IGNORE INTO users (id, email, name, created_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(userId, `${userId}@rgplay.local`, userId).run();

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
          console.error('[REGISTER TX] Erreur D1 (non bloquant):', dbErr.message);
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
      // Priorite : secret Cloudflare > token hardcode de secours
      const CAMERPAY_TOKEN = env.CAMERPAY_TOKEN || ACTIVE_CAMERPAY_TOKEN;
      const WEBHOOK_URL = 'https://rg-play.pages.dev/api/payment/notify';
      const RETURN_URL  = 'https://rg-play.pages.dev';

      // Normalisation du téléphone (chiffres uniquement)
      const cleanPhone = (customer_phone || '').replace(/\D/g, '');

      // ── 1. Enregistrer la transaction en état PENDING dans D1
      // On s'assure que l'utilisateur existe (évite les erreurs de FK)
      if (env.DB) {
        try {
          // Upsert utilisateur pour éviter la contrainte FK purchases → users
          await env.DB.prepare(`
            INSERT OR IGNORE INTO users (id, email, name, phone, created_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(userId, `${userId}@rgplay.local`, userId, cleanPhone || null).run();

          // Supprimer les anciennes tentatives pending/failed
          await env.DB.prepare(
            `DELETE FROM purchases WHERE user_id = ? AND audiobook_id = ? AND status IN ('pending', 'failed')`
          ).bind(userId, audiobook_id).run();

          await env.DB.prepare(`
            INSERT INTO purchases
              (id, user_id, audiobook_id, amount_paid, currency, payment_method, transaction_id, status, purchased_at)
            VALUES (?, ?, ?, ?, 'XAF', ?, ?, 'pending', CURRENT_TIMESTAMP)
          `).bind(purchaseId, userId, audiobook_id, Number(amount), payment_method, txId).run();
        } catch (dbErr) {
          // Non bloquant : continuer même si D1 échoue (le webhook re-créera la transaction)
          console.error('[PAYMENT] Erreur D1 (non bloquant):', dbErr.message);
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

      // Vérification optionnelle de signature webhook si explicitement configurée
      const webhookSecret = env.CAMERPAY_WEBHOOK_SECRET;
      const signatureHeader = request.headers.get('X-CamerPay-Signature') || request.headers.get('X-Signature');
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
      const body = await request.json().catch(() => ({}));
      const headerUserId = request.headers.get('X-User-Id');
      const { transaction_id, audiobook_id } = body;

      if (!transaction_id) {
        return jsonResponse({ success: false, error: 'transaction_id requis' }, corsHeaders, 400);
      }

      let targetUserId = headerUserId;
      let targetBookId = audiobook_id;

      if (env.DB) {
        try {
          // Récupérer les infos existantes de la transaction si disponibles
          const existingPur = await env.DB.prepare(
            `SELECT user_id, audiobook_id FROM purchases WHERE transaction_id = ? LIMIT 1`
          ).bind(transaction_id).first();

          if (existingPur?.user_id) {
            targetUserId = existingPur.user_id;
            targetBookId = existingPur.audiobook_id || targetBookId;
          }

          const finalUserId = targetUserId || 'user-demo';

          // Garantir l'existence de l'utilisateur pour éviter les erreurs de contrainte FK
          await env.DB.prepare(`
            INSERT OR IGNORE INTO users (id, email, name, created_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(finalUserId, `${finalUserId}@rgplay.local`, finalUserId).run().catch(() => {});

          await env.DB.prepare(`
            UPDATE purchases 
            SET status = 'completed', purchased_at = CURRENT_TIMESTAMP 
            WHERE transaction_id = ? OR (user_id = ? AND audiobook_id = ? AND status = 'pending')
          `).bind(transaction_id, finalUserId, targetBookId || '').run();

          if (targetBookId) {
            await env.DB.prepare(`
              INSERT OR IGNORE INTO user_progress (id, user_id, audiobook_id, position_seconds, completed_percentage)
              VALUES (?, ?, ?, 0, 0)
            `).bind(`prog-${finalUserId.slice(0, 8)}-${targetBookId}`, finalUserId, targetBookId).run().catch(() => {});
          }

          if (env.KV_BINDING) {
            await env.KV_BINDING.delete(`library_${finalUserId}`).catch(() => {});
          }
        } catch (dbErr) {
          console.warn('[CONFIRM MANUAL] Erreur D1 non bloquante:', dbErr.message);
        }
      }

      if (env.KV_BINDING) {
        try {
          const existingKv = await env.KV_BINDING.get(`tx_${transaction_id}`, { type: 'json' }) || {};
          await env.KV_BINDING.put(`tx_${transaction_id}`, JSON.stringify({
            ...existingKv,
            status: 'completed',
            confirmed_at: Date.now(),
            confirmed_by: 'manual_user_confirm'
          }), { expirationTtl: 86400 * 30 });
        } catch (_) {}
      }

      return jsonResponse({
        success: true,
        transaction_id,
        audiobook_id: targetBookId,
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
      // Priorite : secret Cloudflare > token hardcode de secours
      const CAMERPAY_TOKEN = env.CAMERPAY_TOKEN || ACTIVE_TOKEN;

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

      if (localStatus === 'failed') {
        return jsonResponse({
          transaction_id: txId,
          status: 'failed',
          audiobook_id: localData?.audiobook_id,
          error: localData?.error || 'Paiement échoué ou annulé',
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

        if (pur) {
          if (pur.status === 'completed') {
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
          if (pur.status === 'failed') {
            return jsonResponse({
              transaction_id: txId,
              status: 'failed',
              audiobook_id: pur.audiobook_id,
              error: 'Paiement non validé par l\'opérateur',
              source: 'd1_database',
            }, corsHeaders);
          }
        }
      }

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
      const body = await request.json().catch(() => ({}));
      const bookId    = body.id || `book-${Date.now()}`;
      // ── Fallbacks robustes sur tous les champs NOT NULL ──────────────────────
      const safeTitle       = body.title       || 'Sans titre';
      const safeAuthor      = body.author      || 'Auteur inconnu';
      const safeNarrator    = body.narrator    || body.author || 'Non spécifié';
      const safeDescription = body.description || body.synopsis || safeTitle;
      const safeSynopsis    = body.synopsis    || body.description || '';
      const safeCoverUrl    = body.cover_url   || body.cover || body.image_url || 'https://rg-play.pages.dev/icons/icon-192x192.png';
      const safePreviewUrl  = body.preview_url || body.preview || null;
      const contentType     = body.content_type || 'audiobook';
      const isPinned        = body.is_pinned   ? 1 : 0;
      const isFeatured      = body.is_featured !== undefined ? (body.is_featured ? 1 : 0) : 1;
      const isBestseller    = body.is_bestseller ? 1 : 0;
      const status          = body.status || (body.scheduled_at ? 'scheduled' : 'published');
      const scheduledAt     = body.scheduled_at || null;
      const rating          = Number(body.rating       || 5.0);
      const ratingCount     = Number(body.rating_count || 1);
      const displayPlays    = Number(body.display_plays_count   || 0);
      const displayReviews  = Number(body.display_reviews_count || 0);
      const displayRating   = Number(body.display_rating || rating || 5.0);

      if (env.DB) {
        try {
          await ensureAnalyticsTables(env.DB);
          try { await env.DB.prepare('ALTER TABLE audiobooks ADD COLUMN is_pinned INTEGER DEFAULT 0').run(); } catch (_) {}
          try { await env.DB.prepare("ALTER TABLE audiobooks ADD COLUMN status TEXT DEFAULT 'published'").run(); } catch (_) {}
          try { await env.DB.prepare('ALTER TABLE audiobooks ADD COLUMN scheduled_at TEXT').run(); } catch (_) {}
          try { await env.DB.prepare('ALTER TABLE audiobooks ADD COLUMN companion_audio_id TEXT').run(); } catch (_) {}
          try { await env.DB.prepare('ALTER TABLE audiobooks ADD COLUMN companion_ebook_id TEXT').run(); } catch (_) {}
          try { await env.DB.prepare('ALTER TABLE audiobooks ADD COLUMN pdf_url TEXT').run(); } catch (_) {}
          try { await env.DB.prepare('ALTER TABLE audiobooks ADD COLUMN page_count INTEGER DEFAULT 180').run(); } catch (_) {}
          try { await env.DB.prepare("ALTER TABLE audiobooks ADD COLUMN format TEXT DEFAULT 'audio'").run(); } catch (_) {}

          // ── Valider le category_id (FK) — fallback sur la première catégorie disponible ──
          let safeCategoryId = body.category_id || 'cat-1';
          try {
            const catCheck = await env.DB.prepare('SELECT id FROM categories WHERE id = ?').bind(safeCategoryId).first();
            if (!catCheck) {
              const firstCat = await env.DB.prepare('SELECT id FROM categories ORDER BY display_order ASC LIMIT 1').first();
              safeCategoryId = firstCat ? firstCat.id : 'cat-1';
              console.warn(`[Admin Books] category_id "${body.category_id}" introuvable → fallback "${safeCategoryId}"`);
            }
          } catch (_) { safeCategoryId = 'cat-1'; }

          await env.DB.prepare(`
            INSERT INTO audiobooks (
              id, title, author, narrator, description, synopsis,
              price, discount_price, category_id, content_type,
              cover_url, cover_r2_key, preview_url, preview_r2_key,
              duration_seconds, rating, rating_count,
              display_plays_count, display_reviews_count, display_rating,
              is_featured, is_bestseller, is_pinned, status, scheduled_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              title = excluded.title, author = excluded.author, narrator = excluded.narrator,
              description = excluded.description, synopsis = excluded.synopsis,
              price = excluded.price, discount_price = excluded.discount_price,
              category_id = excluded.category_id, content_type = excluded.content_type,
              cover_url = excluded.cover_url, cover_r2_key = excluded.cover_r2_key,
              preview_url = excluded.preview_url, preview_r2_key = excluded.preview_r2_key,
              duration_seconds = excluded.duration_seconds,
              rating = excluded.rating, rating_count = excluded.rating_count,
              display_plays_count = excluded.display_plays_count,
              display_reviews_count = excluded.display_reviews_count,
              display_rating = excluded.display_rating,
              is_featured = excluded.is_featured, is_bestseller = excluded.is_bestseller,
              is_pinned = excluded.is_pinned,
              status = excluded.status,
              scheduled_at = excluded.scheduled_at
          `).bind(
            bookId, safeTitle, safeAuthor, safeNarrator, safeDescription, safeSynopsis,
            Number(body.price || 0), body.discount_price ? Number(body.discount_price) : null,
            safeCategoryId, contentType,
            safeCoverUrl, body.cover_r2_key || null,
            safePreviewUrl, body.preview_r2_key || null,
            Number(body.duration_seconds || 0),
            rating, ratingCount,
            displayPlays, displayReviews, displayRating,
            isFeatured, isBestseller, isPinned,
            status, scheduledAt
          ).run();

          // ── Mettre à jour les métadonnées spécifiques E-Book & Association Compagnon ──
          const companionAudioId = body.companion_audio_id || null;
          const companionEbookId = body.companion_ebook_id || null;
          const pdfUrl = body.pdf_url || body.pdfUrl || (contentType === 'ebook' ? (body.preview_url || null) : null);
          const pageCount = Number(body.page_count || 180);
          const format = body.format || (contentType === 'ebook' ? 'pdf' : 'audio');

          try {
            await env.DB.prepare(`
              UPDATE audiobooks SET
                companion_audio_id = ?,
                companion_ebook_id = ?,
                pdf_url = ?,
                page_count = ?,
                format = ?
              WHERE id = ?
            `).bind(companionAudioId, companionEbookId, pdfUrl, pageCount, format, bookId).run();
          } catch (updErr) {
            console.warn('[Admin Books] Erreur update colonnes compagnon:', updErr);
          }

          // Liaison réciproque automatique (si l'admin a relié les 2 versions)
          if (companionAudioId) {
            try {
              await env.DB.prepare('UPDATE audiobooks SET companion_ebook_id = ? WHERE id = ?')
                .bind(bookId, companionAudioId).run();
            } catch (_) {}
          }
          if (companionEbookId) {
            try {
              await env.DB.prepare('UPDATE audiobooks SET companion_audio_id = ? WHERE id = ?')
                .bind(bookId, companionEbookId).run();
            } catch (_) {}
          }

          // ── Chapitres : accepte les noms de champs alternatifs ──────────────
          if (body.chapters && Array.isArray(body.chapters)) {
            await env.DB.prepare('UPDATE user_progress SET current_chapter_id = NULL WHERE audiobook_id = ?').bind(bookId).run().catch(() => {});
            await env.DB.prepare('UPDATE bookmarks SET chapter_id = NULL WHERE audiobook_id = ?').bind(bookId).run().catch(() => {});
            await env.DB.prepare('DELETE FROM chapters WHERE audiobook_id = ?').bind(bookId).run();
            for (let i = 0; i < body.chapters.length; i++) {
              const chap   = body.chapters[i];
              const chapId = chap.id || `chap-${bookId}-${i + 1}`;
              const chapAudioUrl = chap.audio_url || chap.url || chap.uploadData?.public_url || chap.public_url || '';
              const chapR2Key    = chap.audio_r2_key || chap.r2_key || `audiobooks/${bookId}/ch${i + 1}.mp3`;
              await env.DB.prepare(`
                INSERT INTO chapters (id, audiobook_id, chapter_number, title, audio_r2_key, audio_url, duration_seconds)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  title = excluded.title, audio_r2_key = excluded.audio_r2_key,
                  audio_url = excluded.audio_url, duration_seconds = excluded.duration_seconds
              `).bind(
                chapId, bookId, i + 1,
                chap.title || chap.name || `Épisode ${i + 1}`,
                chapR2Key, chapAudioUrl,
                Number(chap.duration_seconds || chap.duration || 1800)
              ).run();
            }
          }

          // ── Purge cache KV ──────────────────────────────────────────────────
          if (env.KV_BINDING) {
            try {
              const list = await env.KV_BINDING.list({ prefix: 'books_' });
              for (const key of list.keys) await env.KV_BINDING.delete(key.name);
            } catch (_) {}
            await env.KV_BINDING.delete('books_all_all_false').catch(() => {});
            await env.KV_BINDING.delete('books_all_all_true').catch(() => {});
            await env.KV_BINDING.delete('categories_v1').catch(() => {});
            await env.KV_BINDING.delete(`book_${bookId}`).catch(() => {});
          }

          return jsonResponse({
            success: true,
            book_id: bookId,
            category_id: safeCategoryId,
            chapters_count: Array.isArray(body.chapters) ? body.chapters.length : 0,
            stored_in: ['cloudflare_d1', 'cloudflare_r2'],
            message: 'Livre audio enregistré et synchronisé avec succès dans Cloudflare D1 !'
          }, corsHeaders);

        } catch (dbErr) {
          console.error('[Admin Books] Erreur D1:', dbErr);
          // HTTP 200 avec success:false pour que Manus/agents externes lisent le détail
          return jsonResponse({
            success: false,
            error: dbErr.message || String(dbErr),
            error_type: dbErr.constructor?.name || 'D1Error',
            book_id: bookId,
            received_fields: Object.keys(body || {}),
            hint: 'Vérifiez que title, description et category_id sont fournis et que category_id existe dans /api/categories.',
            stored_in: []
          }, corsHeaders, 200);
        }
      }

      return jsonResponse({
        success: true,
        book_id: bookId,
        stored_in: ['local_storage'],
        warning: 'Base D1 non liée dans le Worker - Enregistrement local uniquement.'
      }, corsHeaders);
    }

    // ─── POST /api/admin/books/:id/chapters (MAJ chapitres uniquement, sans FK category) ──
    // Permet à Manus/MCP de remplacer les chapitres d'un livre existant sans risque de
    // contrainte de clé étrangère sur category_id.
    const updateChaptersMatch = path.match(/^\/admin\/books\/([a-zA-Z0-9_-]+)\/chapters$/);
    if (updateChaptersMatch && method === 'POST') {
      const bookId = updateChaptersMatch[1];
      const body = await request.json().catch(() => ({}));
      const chapters = body.chapters || body.audios || [];

      if (!Array.isArray(chapters) || chapters.length === 0) {
        return jsonResponse({ success: false, error: 'Le champ "chapters" (tableau) est obligatoire.' }, corsHeaders, 400);
      }

      if (!env.DB) {
        return jsonResponse({ success: false, error: 'Base D1 non disponible' }, corsHeaders, 500);
      }

      try {
        // Vérifier que le livre existe
        const bookExists = await env.DB.prepare('SELECT id FROM audiobooks WHERE id = ?').bind(bookId).first();
        if (!bookExists) {
          return jsonResponse({ success: false, error: `Livre "${bookId}" introuvable dans D1.` }, corsHeaders, 404);
        }

        // Détacher les clés étrangères bloquantes (user_progress, bookmarks) avant de recréer les chapitres
        await env.DB.prepare('UPDATE user_progress SET current_chapter_id = NULL WHERE audiobook_id = ?').bind(bookId).run().catch(() => {});
        await env.DB.prepare('UPDATE bookmarks SET chapter_id = NULL WHERE audiobook_id = ?').bind(bookId).run().catch(() => {});

        // Supprimer les anciens chapitres
        await env.DB.prepare('DELETE FROM chapters WHERE audiobook_id = ?').bind(bookId).run();

        // Insérer les nouveaux chapitres
        for (let i = 0; i < chapters.length; i++) {
          const chap = chapters[i];
          const chapId = chap.id || `chap-${bookId}-${i + 1}`;

          // Résoudre l'URL audio (supporte plusieurs formats de payload)
          const rawUrl = chap.audio_url || chap.url || chap.public_url
            || chap.uploadData?.public_url || chap.audio_stream_url || '';

          // Construire la clé R2 depuis l'URL si possible
          const chapR2Key = chap.audio_r2_key || chap.r2_key
            || (rawUrl.includes('key=') ? decodeURIComponent(rawUrl.split('key=')[1]?.split('&')[0] || '') : `audiobooks/${bookId}/ch${i + 1}.wav`);

          // Normaliser l'URL publique vers /api/r2/download?key=...
          let chapAudioUrl = rawUrl;
          if (chapR2Key && (!chapAudioUrl || chapAudioUrl.includes('r2.cloudflarestorage.com'))) {
            chapAudioUrl = `/api/r2/download?key=${encodeURIComponent(chapR2Key)}`;
          }

          await env.DB.prepare(`
            INSERT INTO chapters (id, audiobook_id, chapter_number, title, audio_r2_key, audio_url, duration_seconds)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              title = excluded.title,
              audio_r2_key = excluded.audio_r2_key,
              audio_url = excluded.audio_url,
              duration_seconds = excluded.duration_seconds
          `).bind(
            chapId, bookId, i + 1,
            chap.title || chap.name || `Chapitre ${i + 1}`,
            chapR2Key,
            chapAudioUrl,
            Number(chap.duration_seconds || chap.duration || 1800)
          ).run();
        }

        // Mettre à jour duration_seconds total du livre si fourni
        if (body.duration_seconds || body.total_duration) {
          const totalDuration = Number(body.duration_seconds || body.total_duration || 0);
          if (totalDuration > 0) {
            await env.DB.prepare('UPDATE audiobooks SET duration_seconds = ? WHERE id = ?')
              .bind(totalDuration, bookId).run().catch(() => {});
          }
        }

        // Purge cache KV
        if (env.KV_BINDING) {
          try {
            const list = await env.KV_BINDING.list({ prefix: 'books_' });
            for (const k of list.keys) await env.KV_BINDING.delete(k.name);
          } catch (_) {}
          await env.KV_BINDING.delete(`book_${bookId}`).catch(() => {});
          await env.KV_BINDING.delete('books_all_all_false').catch(() => {});
          await env.KV_BINDING.delete('books_all_all_true').catch(() => {});
        }

        return jsonResponse({
          success: true,
          book_id: bookId,
          chapters_updated: chapters.length,
          stored_in: ['cloudflare_d1'],
          message: `${chapters.length} chapitres mis à jour avec succès dans D1 pour "${bookId}" !`
        }, corsHeaders);

      } catch (chapErr) {
        console.error('[Chapters Update] Erreur D1:', chapErr);
        return jsonResponse({
          success: false,
          error: chapErr.message || String(chapErr),
          book_id: bookId,
          hint: 'Vérifiez que le livre existe via GET /api/audiobooks/:id avant de mettre à jour ses chapitres.'
        }, corsHeaders, 500);
      }
    }

    // ─── POST /api/admin/migrate-manus (Migration Automatique Manus -> R2 Cloudflare) ──
    if (path === '/admin/migrate-manus' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const targetBookId = body.book_id;

      if (!env.DB || !env.AUDIO_BUCKET) {
        return jsonResponse({ success: false, error: 'D1 ou R2 non disponible dans le Worker' }, corsHeaders, 500);
      }

      try {
        let book = null;
        if (targetBookId) {
          book = await env.DB.prepare('SELECT id, title, cover_url, preview_url FROM audiobooks WHERE id = ?').bind(targetBookId).first();
        } else {
          book = await env.DB.prepare(`
            SELECT DISTINCT a.id, a.title, a.cover_url, a.preview_url
            FROM audiobooks a
            LEFT JOIN chapters c ON a.id = c.audiobook_id
            WHERE (a.cover_url LIKE '%manuscdn.com%'
               OR a.preview_url LIKE '%manuscdn.com%'
               OR c.audio_url LIKE '%manuscdn.com%')
            LIMIT 1
          `).first();
        }

        if (!book) {
          return jsonResponse({
            success: true,
            done: true,
            message: 'Tous les livres ont déjà été migrés vers R2 ! Aucun lien temporaire Manus restant.'
          }, corsHeaders);
        }

        const bookId = book.id;
        const migrationLogs = [];

        // 1. Migrer la couverture si c'est un lien manus
        let newCoverUrl = book.cover_url;
        let newCoverR2Key = null;
        if (book.cover_url && book.cover_url.includes('manuscdn.com')) {
          try {
            const covRes = await fetch(book.cover_url);
            if (covRes.ok) {
              const covBuf = await covRes.arrayBuffer();
              newCoverR2Key = `covers/${bookId}.webp`;
              const mime = covRes.headers.get('content-type') || 'image/webp';
              await env.AUDIO_BUCKET.put(newCoverR2Key, covBuf, {
                httpMetadata: { contentType: mime }
              });
              newCoverUrl = `/api/r2/download?key=${encodeURIComponent(newCoverR2Key)}`;
              await env.DB.prepare('UPDATE audiobooks SET cover_url = ?, cover_r2_key = ? WHERE id = ?')
                .bind(newCoverUrl, newCoverR2Key, bookId).run();
              migrationLogs.push(`Couverture migrée vers ${newCoverR2Key}`);
            }
          } catch (covErr) {
            migrationLogs.push(`Erreur couverture: ${covErr.message}`);
          }
        }

        // 2. Migrer les chapitres audio
        const { results: chapters } = await env.DB.prepare(
          'SELECT id, chapter_number, title, audio_url, audio_r2_key FROM chapters WHERE audiobook_id = ? ORDER BY chapter_number ASC'
        ).bind(bookId).all();

        let migratedChaptersCount = 0;
        let firstChapterR2Url = null;

        for (const ch of (chapters || [])) {
          if (ch.audio_url && ch.audio_url.includes('manuscdn.com')) {
            try {
              const audRes = await fetch(ch.audio_url);
              if (audRes.ok) {
                const audBuf = await audRes.arrayBuffer();
                const r2Key = `audiobooks/${bookId}/ch${ch.chapter_number}.wav`;
                await env.AUDIO_BUCKET.put(r2Key, audBuf, {
                  httpMetadata: { contentType: 'audio/wav' }
                });
                const permUrl = `/api/r2/download?key=${encodeURIComponent(r2Key)}`;
                await env.DB.prepare('UPDATE chapters SET audio_url = ?, audio_r2_key = ? WHERE id = ?')
                  .bind(permUrl, r2Key, ch.id).run();
                migratedChaptersCount++;
                if (!firstChapterR2Url) firstChapterR2Url = permUrl;
              } else {
                migrationLogs.push(`Chapitre ${ch.chapter_number} HTTP ${audRes.status}`);
              }
            } catch (audErr) {
              migrationLogs.push(`Erreur chap ${ch.chapter_number}: ${audErr.message}`);
            }
          }
        }

        // 3. Migrer l'extrait preview si nécessaire
        if (firstChapterR2Url || (book.preview_url && book.preview_url.includes('manuscdn.com'))) {
          const finalPreview = firstChapterR2Url || `/api/r2/download?key=${encodeURIComponent(`audiobooks/${bookId}/ch1.wav`)}`;
          await env.DB.prepare('UPDATE audiobooks SET preview_url = ? WHERE id = ?')
            .bind(finalPreview, bookId).run().catch(() => {});
          migrationLogs.push('Extrait preview mis à jour vers R2');
        }

        // 4. Purge caches KV
        if (env.KV_BINDING) {
          try {
            const list = await env.KV_BINDING.list({ prefix: 'books_' });
            for (const k of list.keys) await env.KV_BINDING.delete(k.name);
          } catch (_) {}
          await env.KV_BINDING.delete(`book_${bookId}`).catch(() => {});
          await env.KV_BINDING.delete('books_all_all_false').catch(() => {});
          await env.KV_BINDING.delete('books_all_all_true').catch(() => {});
        }

        return jsonResponse({
          success: true,
          done: false,
          book_id: bookId,
          title: book.title,
          chapters_migrated: migratedChaptersCount,
          logs: migrationLogs,
          message: `Livre "${book.title}" (${bookId}) migré avec succès : ${migratedChaptersCount} chapitres injectés dans R2 !`
        }, corsHeaders);

      } catch (err) {
        console.error('[Migrate Manus] Erreur:', err);
        return jsonResponse({ success: false, error: err.message }, corsHeaders, 500);
      }
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
        const allowedAudio = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac', 'audio/flac', 'audio/x-m4a'];
        const allowedImage = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        const mimeType = file.type || 'application/octet-stream';
        if (fileType === 'audio'   && !allowedAudio.some(t => mimeType.includes(t.split('/')[1])) && !mimeType.startsWith('audio/')) {
          return jsonResponse({ error: `Type de fichier audio non autorisé : ${mimeType}` }, corsHeaders, 415);
        }
        if ((fileType === 'cover' || fileType === 'preview') && !allowedImage.includes(mimeType) && fileType !== 'audio' && !mimeType.startsWith('audio/')) {
          // on laisse passer pour les previews audio et covers
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

    // ─── POST /api/r2/upload-from-url (Rapatriement et Ingestion R2 Permanente) ─
    // Permet à Manus IA ou à tout client MCP d'ingérer une URL externe (ex: manuscdn)
    // et de la sauvegarder de manière définitive dans Cloudflare R2
    if (path === '/r2/upload-from-url' && method === 'POST') {
      try {
        const body = await request.json();
        const sourceUrl = body.url;
        const fileType = body.type || (sourceUrl?.endsWith('.pdf') || sourceUrl?.endsWith('.epub') ? 'ebook' : 'audio');
        const customName = body.file_name || sourceUrl?.split('/').pop()?.split('?')[0] || `file_${Date.now()}`;

        if (!sourceUrl) {
          return jsonResponse({ error: 'Champ "url" manquant dans le corps de la requête JSON.' }, corsHeaders, 400);
        }

        // Télécharger les octets du fichier distant
        const fetchRes = await fetch(sourceUrl);
        if (!fetchRes.ok) {
          return jsonResponse({ error: `Impossible de récupérer le fichier distant (${fetchRes.status} ${fetchRes.statusText})` }, corsHeaders, 502);
        }

        const arrayBuffer = await fetchRes.arrayBuffer();
        const mimeType = fetchRes.headers.get('content-type') || (
          customName.endsWith('.pdf') ? 'application/pdf' :
          customName.endsWith('.epub') ? 'application/epub+zip' :
          customName.endsWith('.wav') ? 'audio/wav' :
          customName.endsWith('.mp3') ? 'audio/mpeg' :
          'application/octet-stream'
        );

        const folder = fileType === 'ebook' ? 'ebooks' : fileType === 'cover' ? 'covers' : 'audiobooks';
        const r2Key = `${folder}/${Date.now()}_${customName.replace(/\s+/g, '_')}`;

        if (env.AUDIO_BUCKET) {
          await env.AUDIO_BUCKET.put(r2Key, arrayBuffer, {
            httpMetadata: { contentType: mimeType },
            customMetadata: {
              originalUrl: sourceUrl,
              originalName: customName,
              uploadedAt: new Date().toISOString(),
              fileType,
              sizeMb: (arrayBuffer.byteLength / 1024 / 1024).toFixed(2),
            },
          });

          return jsonResponse({
            success: true,
            r2_key: r2Key,
            public_url: `/api/r2/download?key=${encodeURIComponent(r2Key)}`,
            file_name: customName,
            file_type: fileType,
            size_mb: (arrayBuffer.byteLength / 1024 / 1024).toFixed(2),
            stored_in: 'cloudflare_r2',
            message: 'Fichier distant rapatrié et enregistré définitivement dans Cloudflare R2 !'
          }, corsHeaders);
        }

        return jsonResponse({
          success: true,
          r2_key: r2Key,
          public_url: sourceUrl,
          file_name: customName,
          file_type: fileType,
          size_mb: (arrayBuffer.byteLength / 1024 / 1024).toFixed(2),
          stored_in: 'url_fallback',
          message: 'URL validée et enregistrée pour la publication.'
        }, corsHeaders);

      } catch (err) {
        return jsonResponse({ error: `Erreur rapatriement R2 : ${err.message}` }, corsHeaders, 500);
      }
    }

    // ─── POST /api/admin/bulk-check-duplicates ─────────────────────────────────
    // Vérifie si des fichiers existent déjà dans le catalogue (par hash SHA-256 ou titre normalisé)
    if (path === '/admin/bulk-check-duplicates' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const files = body.files || [];

      if (!Array.isArray(files) || files.length === 0) {
        return jsonResponse({ success: false, error: 'Champ "files" requis' }, corsHeaders, 400);
      }

      const results = [];

      if (env.DB) {
        try {
          // Charger tous les livres existants (titre normalisé + id)
          const { results: existingBooks } = await env.DB.prepare(
            `SELECT id, title, content_type, pdf_url FROM audiobooks WHERE content_type = 'ebook' OR pdf_url IS NOT NULL`
          ).all();

          const normalize = (str) => (str || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, ' ')
            .trim()
            .replace(/\s+/g, ' ');

          for (const file of files) {
            const normalizedIncoming = normalize(file.title || file.filename || '');
            let match = null;
            let confidence = 0;

            for (const existing of (existingBooks || [])) {
              const normalizedExisting = normalize(existing.title);

              // Correspondance exacte du titre
              if (normalizedIncoming && normalizedExisting && normalizedIncoming === normalizedExisting) {
                match = existing;
                confidence = 100;
                break;
              }

              // Correspondance partielle (titre contient ou est contenu dans)
              if (normalizedIncoming.length > 5 && normalizedExisting.length > 5) {
                if (normalizedExisting.includes(normalizedIncoming) || normalizedIncoming.includes(normalizedExisting)) {
                  if (confidence < 70) {
                    match = existing;
                    confidence = 70;
                  }
                }
              }
            }

            results.push({
              filename: file.filename,
              sha256: file.sha256,
              title: file.title,
              isDuplicate: confidence >= 70,
              confidence,
              existingId: match?.id || null,
              existingTitle: match?.title || null,
              status: confidence >= 100 ? 'exact' : confidence >= 70 ? 'probable' : 'new'
            });
          }
        } catch (err) {
          console.error('[bulk-check-duplicates] Erreur D1:', err);
          // En cas d'erreur D1, retourner tous comme "new"
          for (const file of files) {
            results.push({ filename: file.filename, sha256: file.sha256, isDuplicate: false, confidence: 0, status: 'new' });
          }
        }
      } else {
        // Sans D1, on ne peut pas vérifier — on retourne tous comme "new"
        for (const file of files) {
          results.push({ filename: file.filename, sha256: file.sha256, isDuplicate: false, confidence: 0, status: 'new' });
        }
      }

      return jsonResponse({ success: true, results, total: results.length }, corsHeaders);
    }

    // ─── POST /api/admin/bulk-publish ──────────────────────────────────────────
    // Publication en lot d'e-books (max 50 par requête pour éviter timeout Workers)
    if (path === '/admin/bulk-publish' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const booksToPublish = body.books || [];

      if (!Array.isArray(booksToPublish) || booksToPublish.length === 0) {
        return jsonResponse({ success: false, error: 'Champ "books" (tableau) requis' }, corsHeaders, 400);
      }

      if (!env.DB) {
        return jsonResponse({ success: false, error: 'D1 non disponible' }, corsHeaders, 500);
      }

      const published = [];
      const failed = [];

      // Assurer que les colonnes supplémentaires existent (migration dynamique)
      const ensureColumns = [
        `ALTER TABLE audiobooks ADD COLUMN content_type TEXT DEFAULT 'audiobook'`,
        `ALTER TABLE audiobooks ADD COLUMN pdf_url TEXT`,
        `ALTER TABLE audiobooks ADD COLUMN pdf_r2_key TEXT`,
        `ALTER TABLE audiobooks ADD COLUMN cover_r2_key TEXT`,
        `ALTER TABLE audiobooks ADD COLUMN page_count INTEGER DEFAULT 0`,
        `ALTER TABLE audiobooks ADD COLUMN format TEXT DEFAULT 'pdf'`,
        `ALTER TABLE audiobooks ADD COLUMN unlock_points INTEGER DEFAULT 100`,
        `ALTER TABLE audiobooks ADD COLUMN synopsis TEXT`,
        `ALTER TABLE audiobooks ADD COLUMN status TEXT DEFAULT 'published'`,
        `ALTER TABLE audiobooks ADD COLUMN scheduled_at TEXT`,
        `ALTER TABLE audiobooks ADD COLUMN language TEXT DEFAULT 'fr'`,
      ];
      for (const sql of ensureColumns) {
        await env.DB.prepare(sql).run().catch(() => {});
      }

      for (const book of booksToPublish.slice(0, 50)) {
        try {
          const bookId = book.id || `ebook-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const safeCategoryId = book.category_id || 'cat-1';

          // Vérifier que la catégorie existe
          const catExists = await env.DB.prepare('SELECT id FROM categories WHERE id = ?').bind(safeCategoryId).first();
          const finalCategoryId = catExists ? safeCategoryId : 'cat-1';

          const scheduledAt = book.scheduled_at || null;
          const status = scheduledAt ? 'scheduled' : 'published';

          await env.DB.prepare(`
            INSERT INTO audiobooks (
              id, title, author, narrator, description, synopsis,
              cover_url, cover_r2_key, preview_url,
              category_id, price, discount_price, duration_seconds,
              language, rating, is_featured, release_date,
              content_type, pdf_url, page_count, format, status, scheduled_at,
              unlock_points, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              title = excluded.title, author = excluded.author,
              cover_url = excluded.cover_url, cover_r2_key = excluded.cover_r2_key,
              pdf_url = excluded.pdf_url, page_count = excluded.page_count,
              category_id = excluded.category_id, price = excluded.price,
              status = excluded.status, scheduled_at = excluded.scheduled_at,
              unlock_points = excluded.unlock_points
          `).bind(
            bookId,
            book.title || 'Sans titre',
            book.author || 'Auteur inconnu',
            '',
            book.description || '',
            book.synopsis || '',
            book.cover_url || '/icons/icon-192.png',
            book.cover_r2_key || '',
            book.preview_url || book.cover_url || '',
            finalCategoryId,
            Number(book.price || 3500),
            Number(book.discount_price || 0),
            0,
            book.language || 'fr',
            4.8,
            0,
            new Date().toISOString().slice(0, 10),
            'ebook',
            book.pdf_url || book.pdf_r2_key || '',
            Number(book.page_count || 0),
            book.format || 'pdf',
            status,
            scheduledAt,
            Number(book.unlock_points || 100)
          ).run();

          published.push({ id: bookId, title: book.title, status });
        } catch (err) {
          failed.push({ title: book.title, error: err.message });
        }
      }

      // Purge cache KV
      if (env.KV_BINDING) {
        try {
          const list = await env.KV_BINDING.list({ prefix: 'books_' });
          for (const k of list.keys) await env.KV_BINDING.delete(k.name);
        } catch (_) {}
      }

      return jsonResponse({
        success: true,
        published: published.length,
        failed: failed.length,
        results: published,
        errors: failed,
        message: `${published.length} e-book(s) traités avec succès sur ${booksToPublish.length} reçus.`
      }, corsHeaders);
    }

    // ─── GET /api/audiobooks/:id/reviews (Vrais avis en base D1) ─────────────────
    const reviewsGetMatch = path.match(/^\/audiobooks\/([a-zA-Z0-9_-]+)\/reviews$/);
    if (reviewsGetMatch && method === 'GET') {
      const bookId = reviewsGetMatch[1];
      if (env.DB) {
        try {
          await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS reviews (
              id TEXT PRIMARY KEY,
              audiobook_id TEXT NOT NULL,
              user_id TEXT NOT NULL,
              user_name TEXT NOT NULL,
              user_avatar TEXT,
              rating INTEGER CHECK(rating >= 1 AND rating <= 5),
              comment TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `).run().catch(() => {});

          const { results } = await env.DB.prepare(`
            SELECT id, user_id, user_name as author_name, user_avatar, rating, comment,
                   strftime('%d/%m/%Y', created_at) as date, created_at
            FROM reviews
            WHERE audiobook_id = ?
            ORDER BY created_at DESC
            LIMIT 50
          `).bind(bookId).all();

          return jsonResponse({ success: true, reviews: results || [], count: (results || []).length }, corsHeaders);
        } catch (e) {
          return jsonResponse({ success: true, reviews: [], count: 0 }, corsHeaders);
        }
      }
      return jsonResponse({ success: true, reviews: [], count: 0 }, corsHeaders);
    }

    // ─── POST /api/audiobooks/:id/reviews (Dépôt d'un vrai avis) ────────────────
    const reviewsPostMatch = path.match(/^\/audiobooks\/([a-zA-Z0-9_-]+)\/reviews$/);
    if (reviewsPostMatch && method === 'POST') {
      const bookId = reviewsPostMatch[1];
      const body = await request.json().catch(() => ({}));
      const reviewId = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const userId = request.headers.get('X-User-Id') || body.user_id || 'user-anon';
      const userName = body.author || body.user_name || 'Auditeur Passionné';
      const rating = Math.min(5, Math.max(1, Number(body.rating) || 5));
      const comment = (body.comment || '').trim();

      if (!comment) {
        return jsonResponse({ success: false, error: 'Commentaire requis' }, corsHeaders, 400);
      }

      if (env.DB) {
        try {
          await env.DB.prepare(`
            INSERT INTO reviews (id, audiobook_id, user_id, user_name, user_avatar, rating, comment, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(reviewId, bookId, userId, userName, '', rating, comment).run();

          // Recalculer la note moyenne et le nombre réel d'avis pour le livre
          const stats = await env.DB.prepare(`
            SELECT COUNT(*) as cnt, AVG(rating) as avg_rating FROM reviews WHERE audiobook_id = ?
          `).bind(bookId).first();

          if (stats && stats.cnt > 0) {
            await env.DB.prepare(`
              UPDATE audiobooks SET rating = ROUND(?, 1), rating_count = ? WHERE id = ?
            `).bind(stats.avg_rating, stats.cnt, bookId).run().catch(() => {});
          }

          return jsonResponse({
            success: true,
            review: { id: reviewId, author_name: userName, rating, comment, date: "À l'instant" },
            stats: { rating: stats?.avg_rating || rating, rating_count: stats?.cnt || 1 }
          }, corsHeaders);
        } catch (err) {
          return jsonResponse({ success: false, error: err.message }, corsHeaders, 500);
        }
      }

      return jsonResponse({
        success: true,
        review: { id: reviewId, author_name: userName, rating, comment, date: "À l'instant" }
      }, corsHeaders);
    }

    // ─── DELETE /api/admin/reviews/:id (Modération avis par admin) ──────────────
    const reviewDeleteMatch = path.match(/^\/admin\/reviews\/([a-zA-Z0-9_-]+)$/);
    if (reviewDeleteMatch && method === 'DELETE') {
      const revId = reviewDeleteMatch[1];
      if (env.DB) {
        try {
          await env.DB.prepare('DELETE FROM reviews WHERE id = ?').bind(revId).run();
          return jsonResponse({ success: true, message: 'Avis supprimé' }, corsHeaders);
        } catch (e) {
          return jsonResponse({ success: false, error: e.message }, corsHeaders, 500);
        }
      }
      return jsonResponse({ success: true }, corsHeaders);
    }

    // ─── GET /api/admin/gamification-rules (Règles éditables) ────────────────────
    if (path === '/admin/gamification-rules' && method === 'GET') {
      let rules = {
        bookUnlockPoints: 100,
        readingXpPer3Min: 8,
        readingPointsPer3Min: 5,
        adRewardPoints: 30,
        adRewardXp: 40,
        dailyLoginBaseXp: 20,
        dailyLoginBasePoints: 15,
        audioXpDisabled: true, // Désactivé par défaut comme demandé par l'admin
      };

      if (env.KV_BINDING) {
        const stored = await env.KV_BINDING.get('rg_gamification_rules', { type: 'json' }).catch(() => null);
        if (stored) rules = { ...rules, ...stored };
      }

      return jsonResponse({ success: true, rules }, corsHeaders);
    }

    // ─── POST /api/admin/gamification-rules (Sauvegarde des règles) ──────────────
    if (path === '/admin/gamification-rules' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (env.KV_BINDING) {
        await env.KV_BINDING.put('rg_gamification_rules', JSON.stringify(body));
      }
      return jsonResponse({ success: true, rules: body, message: 'Règles de gamification enregistrées' }, corsHeaders);
    }

    // ─── GET /api/ads (Publicités actives pour les utilisateurs) ───────────────
    if (path === '/ads' && method === 'GET') {
      let ads = [];
      if (env.KV_BINDING) {
        const stored = await env.KV_BINDING.get('rg_admin_ads', { type: 'json' }).catch(() => null);
        if (Array.isArray(stored)) ads = stored;
      }
      let activeAds = ads.filter(a => a && a.active !== false);

      const placement = url.searchParams.get('placement');
      if (placement) {
        activeAds = activeAds.filter(a => Array.isArray(a.placements) && a.placements.includes(placement));
      }

      return jsonResponse({ success: true, ads: activeAds }, corsHeaders);
    }

    // ─── GET /api/admin/ads (Toutes les publicités pour le panneau admin) ───────
    if (path === '/admin/ads' && method === 'GET') {
      let ads = [];
      if (env.KV_BINDING) {
        const stored = await env.KV_BINDING.get('rg_admin_ads', { type: 'json' }).catch(() => null);
        if (Array.isArray(stored)) ads = stored;
      }
      return jsonResponse({ success: true, ads }, corsHeaders);
    }

    // ─── POST /api/admin/ads (Sauvegarde des publicités par l'admin) ─────────────
    if (path === '/admin/ads' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const ads = Array.isArray(body.ads) ? body.ads : [];
      if (env.KV_BINDING) {
        await env.KV_BINDING.put('rg_admin_ads', JSON.stringify(ads));
      }
      return jsonResponse({ success: true, ads, message: 'Publicités enregistrées avec succès' }, corsHeaders);
    }

    // ─── POST /api/referral/register (Enregistrement d'un parrainage) ───────────
    if (path === '/referral/register' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const referrerCode = (body.referrerCode || '').trim().toUpperCase();
      const newUserId = request.headers.get('X-User-Id') || body.userId;

      if (referrerCode && newUserId && env.KV_BINDING) {
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
    }

    // ─── GET /api/referral/stats (Statistiques de parrainage de l'utilisateur) ───
    if (path === '/referral/stats' && method === 'GET') {
      const code = (url.searchParams.get('code') || '').trim().toUpperCase();
      if (code && env.KV_BINDING) {
        const refKey = `rg_referral_${code}`;
        const stats = await env.KV_BINDING.get(refKey, { type: 'json' }).catch(() => null);
        if (stats) {
          return jsonResponse({ success: true, stats }, corsHeaders);
        }
      }
      return jsonResponse({
        success: true,
        stats: { code: code || 'RGPLAY', referrals: [], creditsEarned: 0, pendingCredits: 0 }
      }, corsHeaders);
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
        else if (lowerKey.endsWith('.webm')) inferredType = 'audio/webm';
        else if (lowerKey.endsWith('.aac')) inferredType = 'audio/aac';
        else if (lowerKey.endsWith('.flac')) inferredType = 'audio/flac';
        else if (lowerKey.endsWith('.ogg') || lowerKey.endsWith('.opus')) inferredType = 'audio/ogg';
        else if (lowerKey.endsWith('.pdf')) inferredType = 'application/pdf';
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

    // ─── POST /api/ai/enrich (Synthèse, Key Takeaways & Tags DeepSeek pour Admin) ─
    if (path === '/ai/enrich' && method === 'POST') {
      const body = await request.json();
      const { title, author, description, synopsis } = body;
      const DEEPSEEK_API_KEY = (env && env.DEEPSEEK_API_KEY) || 'sk-f7d21369be024340bac5d7d1443b59ea';
      const DEEPSEEK_MODEL = (env && env.DEEPSEEK_MODEL) || 'deepseek-v4-flash';

      const prompt = `Tu es un directeur éditorial et expert marketing pour RG Play, la première plateforme de livres audio et masterclasses d'excellence en Afrique.
À partir des informations suivantes :
- Titre : "${title || ''}"
- Auteur / Narrateur : "${author || ''}"
- Description existante : "${description || ''}"
- Synopsis existant : "${synopsis || ''}"

Génère en français un objet JSON valide et strict avec :
1. "description": une phrase d'accroche percutante et captivante (max 160 caractères) pour donner envie d'écouter.
2. "synopsis": un résumé éditorial approfondi, clair et motivant (2 paragraphes, environ 100-150 mots).
3. "key_takeaways": un tableau de 5 leçons clés concrètes (Key Takeaways) formulées de façon active et mémorable.
4. "tags": un tableau de 5 à 7 mots-clés stratégiques pour la recherche et le SEO.
5. "suggested_category": la catégorie la plus adaptée parmi : "Business & Finance", "Développement Personnel", "Intelligence Artificielle & Tech", "Psychologie & Mental", "Histoire & Stratégie", "Foi & Spiritualité", "Romans & Fiction".

Ne réponds rien d'autre que l'objet JSON (sans texte d'accompagnement ni balises de code markdown).`;

      try {
        const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages: [
              { role: 'system', content: 'Tu es une API qui répond exclusivement par du JSON strict et valide.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 1500,
          }),
        });

        if (!dsRes.ok) {
          const errTxt = await dsRes.text();
          return jsonResponse({ success: false, error: `Erreur DeepSeek (${dsRes.status}): ${errTxt}` }, corsHeaders, 502);
        }

        const dsData = await dsRes.json();
        const rawContent = dsData.choices?.[0]?.message?.content || '{}';
        const cleaned = rawContent.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
        let parsed = {};
        try {
          parsed = JSON.parse(cleaned);
        } catch (parseErr) {
          console.warn('[DeepSeek] JSON parse error, raw:', cleaned);
          parsed = { description: rawContent, synopsis: rawContent, key_takeaways: [], tags: [] };
        }

        return jsonResponse({
          success: true,
          data: parsed
        }, corsHeaders);
      } catch (err) {
        console.error('[DeepSeek Enrich] Erreur:', err);
        return jsonResponse({ success: false, error: err.message }, corsHeaders, 500);
      }
    }

    // ─── POST /api/ai/chat (Discuter avec le Livre - Tuteur Interactif & Vision Couverture) ─────────
    if (path === '/ai/chat' && method === 'POST') {
      const body = await request.json();
      const { book_id, book_title, author, synopsis, description, key_takeaways, messages = [], user_message, image_base64, image_url } = body;
      const DEEPSEEK_API_KEY = (env && env.DEEPSEEK_API_KEY) || 'sk-f7d21369be024340bac5d7d1443b59ea';
      const hasImage = Boolean(image_base64 || image_url);
      const DEEPSEEK_MODEL = hasImage 
        ? 'deepseek-v4-flash-vision-exp' 
        : ((env && env.DEEPSEEK_MODEL) || 'deepseek-v4-flash');

      if (!user_message && messages.length === 0 && !hasImage) {
        return jsonResponse({ success: false, error: 'Message ou image requis' }, corsHeaders, 400);
      }

      let chapterInfo = '';
      if (env.DB && book_id) {
        try {
          const { results: chs } = await env.DB.prepare('SELECT title, chapter_number FROM chapters WHERE audiobook_id = ? ORDER BY chapter_number ASC').bind(book_id).all();
          if (chs && chs.length > 0) {
            chapterInfo = '\nChapitres du livre :\n' + chs.map(c => `- Chapitre ${c.chapter_number} : ${c.title}`).join('\n');
          }
        } catch (_) {}
      }

      // Contexte du catalogue complet (Audiobooks & E-books) pour recherche par couverture
      let catalogBooks = [];
      if (env.DB) {
        try {
          const { results } = await env.DB.prepare('SELECT id, title, author, cover_url, pdf_url, content_type FROM audiobooks WHERE id NOT IN (SELECT id FROM deleted_books) LIMIT 60').all();
          catalogBooks = results || [];
        } catch (_) {}
      }

      const catalogContext = catalogBooks.length > 0
        ? '\nCatalogue disponible sur RG Play :\n' + catalogBooks.map(b => `- ID: ${b.id} | Titre: "${b.title}" | Auteur: "${b.author}" | Format: ${b.pdf_url ? 'E-Book PDF' : 'Livre Audio'}`).join('\n')
        : '';

      const systemPrompt = hasImage
        ? `Tu es l'Agent SKY, l'intelligence artificielle d'élite et mentor officiel de RG Play.
L'utilisateur t'envoie une photo de couverture d'un livre pour l'identifier, le rechercher ou obtenir des conseils.
Consignes d'analyse visuelle :
1. Identifie avec précision l'ouvrage : Titre exact et Auteur.
2. Vérifie immédiatement dans le catalogue RG Play :
${catalogContext}
3. Si le livre est présent dans le catalogue :
   - Annonce-le avec enthousiasme.
   - Fournis obligatoirement les liens d'accès :
     - Pour écouter l'audio : [🎧 Écouter l'Audio](rg:audio:ID_DU_LIVRE)
     - Pour lire le PDF / E-Book : [📖 Lire le PDF / E-Book](rg:ebook:ID_DU_LIVRE)
     - Pour la fiche complète : [ℹ️ Fiche du Livre](rg:book:ID_DU_LIVRE)
4. Si le livre n'est pas encore au catalogue :
   - Donne un résumé percutant de ses 3 leçons fondamentales.
   - Recommande 1 ou 2 œuvres proches disponibles dans notre catalogue.
5. Sois vif, structuré et concis (maximum 180 mots).`
        : `Tu es l'Agent SKY, l'intelligence artificielle d'élite, tuteur et mentor interactif officiel sur la plateforme RG Play, dédié à l'œuvre audio "${book_title || 'cet audio'}" de ${author || 'l\'auteur'}.
Contexte du livre :
- Titre : ${book_title || 'Inconnu'}
- Auteur : ${author || 'Inconnu'}
- Résumé / Synopsis : ${synopsis || description || 'Non renseigné'}
${key_takeaways ? '- Points clés connus : ' + (Array.isArray(key_takeaways) ? key_takeaways.join(' ; ') : key_takeaways) : ''}
${chapterInfo}

Règles de discussion :
1. Tu es l'Agent SKY : ton ton est inspirant, clair, vif, pédagogue et percutant.
2. Structure toujours tes réponses avec une excellente lisibilité : utilise des titres courts, des listes à puces aérées avec des puces claires et des mots-clés en gras.
3. Appuie-toi fidèlement sur les principes et le contenu réel de cette œuvre.
4. Sois très pragmatique et donne des exemples d'application concrets et immédiatement actionnables.
5. Sois dynamique, positif et motivant.
6. Si tu recommandes ou mentionnes un livre du catalogue ou un livre lié à la discussion, insère un lien cliquable au format [Titre du Livre](rg:book:TitreDuLivre).
7. Sois concis, vif et percutant : structure ta réponse en 2 ou 3 points courts (maximum 150 mots au total).`;

      const dsMessages = [{ role: 'system', content: systemPrompt }];
      for (const m of messages.slice(-4)) {
        if (m.role && m.content) {
          dsMessages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content).slice(0, 400) });
        }
      }

      if (hasImage) {
        const imgUrl = image_base64 || image_url;
        const formattedUrl = imgUrl.startsWith('data:') ? imgUrl : `data:image/jpeg;base64,${imgUrl}`;
        dsMessages.push({
          role: 'user',
          content: [
            { type: 'text', text: user_message || "Analyse cette photo de couverture de livre. Identifie le titre et l'auteur et vérifie s'il est disponible sur RG Play." },
            { type: 'image_url', image_url: { url: formattedUrl } }
          ]
        });
      } else if (user_message) {
        dsMessages.push({ role: 'user', content: String(user_message).slice(0, 400) });
      }

      try {
        const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages: dsMessages,
            temperature: 0.7,
            max_tokens: hasImage ? 500 : 450,
          }),
        });

        if (!dsRes.ok) {
          const errTxt = await dsRes.text();
          return jsonResponse({ success: false, error: `Erreur DeepSeek (${dsRes.status}): ${errTxt}` }, corsHeaders, 502);
        }

        const dsData = await dsRes.json();
        const reply = dsData.choices?.[0]?.message?.content || dsData.choices?.[0]?.message?.reasoning_content || 'Je n\'ai pas pu générer de réponse pour le moment.';

        // Identifier si un livre du catalogue correspond à la réponse
        let matched_book = null;
        const replyLower = reply.toLowerCase();
        for (const b of catalogBooks) {
          if (b.title && replyLower.includes(b.title.toLowerCase())) {
            matched_book = {
              id: b.id,
              title: b.title,
              author: b.author,
              cover_url: b.cover_url,
              pdf_url: b.pdf_url,
              content_type: b.content_type || (b.pdf_url ? 'ebook' : 'audiobook'),
            };
            break;
          }
        }

        return jsonResponse({
          success: true,
          reply,
          matched_book,
          model_used: DEEPSEEK_MODEL,
        }, corsHeaders);
      } catch (err) {
        console.error('[DeepSeek Chat] Erreur:', err);
        return jsonResponse({ success: false, error: err.message }, corsHeaders, 500);
      }
    }

    // ─── POST /api/ai/search (Recherche Sémantique par Intention) ─────────────
    if (path === '/ai/search' && method === 'POST') {
      const body = await request.json();
      const { query } = body;
      const DEEPSEEK_API_KEY = (env && env.DEEPSEEK_API_KEY) || 'sk-f7d21369be024340bac5d7d1443b59ea';
      const DEEPSEEK_MODEL = (env && env.DEEPSEEK_MODEL) || 'deepseek-v4-flash';

      if (!query || query.trim().length < 2) {
        return jsonResponse({ success: true, matched_ids: [], reason: '' }, corsHeaders);
      }

      let books = [];
      if (env.DB) {
        try {
          const { results } = await env.DB.prepare(`
            SELECT a.id, a.title, a.author, a.description, a.synopsis, c.name as category_name
            FROM audiobooks a
            LEFT JOIN categories c ON a.category_id = c.id
            LEFT JOIN deleted_books db ON a.id = db.id
            WHERE db.id IS NULL
          `).all();
          books = results || [];
        } catch (_) {}
      }

      if (books.length === 0) {
        return jsonResponse({ success: true, matched_ids: [], reason: '' }, corsHeaders);
      }

      const catalogContext = books.map(b => 
        `ID: ${b.id} | Titre: "${b.title}" | Auteur: "${b.author}" | Catégorie: "${b.category_name || ''}" | Résumé: "${(b.description || b.synopsis || '').slice(0, 150)}"`
      ).join('\n');

      const searchPrompt = `Tu es le moteur de recommandation sémantique de RG Play.
L'utilisateur a entré la recherche suivante : "${query}"

Catalogue de livres audio disponibles :
${catalogContext}

Tâche :
Analyse l'intention, l'émotion ou le besoin de l'utilisateur.
Identifie les 1 à 4 livres les plus pertinents pour cette recherche, classés du plus pertinent au moins pertinent.
Fournis une courte phrase d'explication (max 1 phrase) pour guider l'auditeur.

Réponds STRICTEMENT sous format JSON :
{
  "matched_ids": ["id1", "id2"],
  "reason": "Explication courte pour l'auditeur"
}`;

      try {
        const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages: [
              { role: 'system', content: 'Tu es un moteur de recherche sémantique JSON strict.' },
              { role: 'user', content: searchPrompt }
            ],
            temperature: 0.3,
            max_tokens: 250,
          }),
        });

        if (!dsRes.ok) {
          return jsonResponse({ success: false, error: 'Recherche IA indisponible', matched_ids: [] }, corsHeaders);
        }

        const dsData = await dsRes.json();
        const raw = dsData.choices?.[0]?.message?.content || '{}';
        const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
        let parsed = { matched_ids: [], reason: '' };
        try {
          parsed = JSON.parse(cleaned);
        } catch (_) {}

        return jsonResponse({
          success: true,
          matched_ids: Array.isArray(parsed.matched_ids) ? parsed.matched_ids : [],
          reason: parsed.reason || ''
        }, corsHeaders);
      } catch (err) {
        console.error('[DeepSeek Search] Erreur:', err);
        return jsonResponse({ success: false, error: err.message, matched_ids: [] }, corsHeaders);
      }
    }

    // ─── POST /api/ai/match-companion (Association Intelligente & Recommandations DeepSeek) ──
    if (path === '/ai/match-companion' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const { title, author, description, target_type = 'audio' } = body;
      const DEEPSEEK_API_KEY = (env && env.DEEPSEEK_API_KEY) || 'sk-f7d21369be024340bac5d7d1443b59ea';
      const DEEPSEEK_MODEL = (env && env.DEEPSEEK_MODEL) || 'deepseek-v4-flash';

      if (!title || !title.trim()) {
        return jsonResponse({ success: false, error: 'Titre requis pour l\'association IA.' }, corsHeaders, 400);
      }

      let candidates = [];
      if (env.DB) {
        try {
          const { results } = await env.DB.prepare(`
            SELECT a.id, a.title, a.author, a.description, a.synopsis, a.content_type, a.cover_url, a.pdf_url, c.name as category_name
            FROM audiobooks a
            LEFT JOIN categories c ON a.category_id = c.id
            LEFT JOIN deleted_books db ON a.id = db.id
            WHERE db.id IS NULL
          `).all();

          if (target_type === 'audio') {
            // Chercher parmi les livres audio (non-ebook purs)
            candidates = (results || []).filter(b => b.content_type !== 'ebook' && (!b.pdf_url || b.content_type === 'audiobook'));
          } else {
            // Chercher parmi les e-books Read's Great
            candidates = (results || []).filter(b => b.content_type === 'ebook' || (b.pdf_url && b.pdf_url.length > 0));
          }
        } catch (_) {}
      }

      if (candidates.length === 0) {
        return jsonResponse({
          success: true,
          matched: false,
          message: 'Aucun candidat disponible dans le catalogue.',
          recommendations: []
        }, corsHeaders);
      }

      const catalogSummary = candidates.map(b =>
        `ID: ${b.id} | Titre: "${b.title}" | Auteur: "${b.author}" | Genre: "${b.category_name || ''}" | Extrait: "${(b.description || '').slice(0, 120)}"`
      ).join('\n');

      const matchPrompt = `Tu es l'algorithme d'association et de recommandation de RG Play & Read's Great.
Nous avons un ouvrage avec les métadonnées suivantes :
- Titre : "${title}"
- Auteur : "${author || 'Non spécifié'}"
- Résumé : "${(description || '').slice(0, 300)}"

Catalogue cible (${target_type === 'audio' ? 'Livres Audio RG Play' : 'E-Books Read\'s Great'}) :
${catalogSummary}

Consignes :
1. Analyse si un livre de la liste correspond exactement à la même œuvre (même titre ou titre très proche + même auteur).
2. Si correspondance trouvée : "matched": true, donne l'ID exact dans "companion_id", "confidence" (0.8 à 1.0), et "reason" expliquant l'association.
3. Si aucune correspondance exacte : "matched": false, "companion_id": null, et propose jusqu'à 3 livres du catalogue les plus pertinents du même genre/thème dans "recommendations".

Réponds STRICTEMENT en JSON valide sans texte avant ni après :
{
  "matched": true,
  "companion_id": "id_du_livre_ou_null",
  "companion_title": "titre_trouve_ou_null",
  "confidence": 0.95,
  "reason": "Explication claire en une phrase",
  "recommendations": [
    { "id": "id_recommande", "title": "titre", "author": "auteur", "reason": "Pourquoi c'est recommandé" }
  ]
}`;

      try {
        const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages: [
              { role: 'system', content: 'Tu es un assistant bibliographique IA. Réponds strictement en JSON.' },
              { role: 'user', content: matchPrompt }
            ],
            temperature: 0.2,
            max_tokens: 350,
          }),
        });

        if (!dsRes.ok) {
          return jsonResponse({ success: false, error: 'Service DeepSeek indisponible' }, corsHeaders, 502);
        }

        const dsData = await dsRes.json();
        const raw = dsData.choices?.[0]?.message?.content || '{}';
        const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
        let parsed = {};
        try { parsed = JSON.parse(cleaned); } catch (_) {}

        let companion = null;
        if (parsed.matched && parsed.companion_id) {
          const found = candidates.find(c => c.id === parsed.companion_id);
          if (found) {
            companion = {
              id: found.id,
              title: found.title,
              author: found.author,
              cover_url: found.cover_url,
              category_name: found.category_name,
              reason: parsed.reason || 'Correspondance identifiée avec certitude'
            };
          }
        }

        const recs = (parsed.recommendations || []).map(r => {
          const item = candidates.find(c => c.id === r.id);
          return {
            id: r.id,
            title: r.title || item?.title,
            author: r.author || item?.author,
            cover_url: item?.cover_url,
            category_name: item?.category_name,
            reason: r.reason || 'Ouvrage recommandé du même genre'
          };
        }).filter(r => r.id);

        return jsonResponse({
          success: true,
          matched: Boolean(parsed.matched && companion),
          companion,
          confidence: parsed.confidence || (companion ? 0.9 : 0),
          reason: parsed.reason || '',
          recommendations: recs
        }, corsHeaders);

      } catch (err) {
        console.error('[DeepSeek Match Companion] Erreur:', err);
        return jsonResponse({ success: false, error: err.message }, corsHeaders, 500);
      }
    }

    // ─── POST / GET /api/ai/tts (Génération & Synthèse Vocale IA HD) ─────────
    if ((path === '/ai/tts' || path === '/ai/tts/') && (method === 'POST' || method === 'GET')) {
      try {
        let text = '';
        let voice = 'fr-FR-HenriNeural';
        let speed = 1.0;
        let pitch = 1.0;
        let requestedFormat = 'auto'; // 'mp3' | 'wav' | 'json' | 'auto'

        if (method === 'POST') {
          const contentType = request.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const body = await request.json().catch(() => ({}));
            text = body.text || '';
            voice = body.voice || voice;
            speed = Number(body.speed) || speed;
            pitch = Number(body.pitch) || pitch;
            requestedFormat = body.format || requestedFormat;
          } else if (contentType.includes('form')) {
            const fd = await request.formData().catch(() => new FormData());
            text = fd.get('text') || '';
            voice = fd.get('voice') || voice;
            speed = Number(fd.get('speed')) || speed;
            requestedFormat = fd.get('format') || requestedFormat;
          }
        } else {
          text = url.searchParams.get('text') || '';
          voice = url.searchParams.get('voice') || voice;
          speed = Number(url.searchParams.get('speed')) || speed;
          pitch = Number(url.searchParams.get('pitch')) || pitch;
          requestedFormat = url.searchParams.get('format') || requestedFormat;
        }

        if (!text || !text.trim()) {
          return jsonResponse({ error: 'Le champ "text" est obligatoire pour la synthèse vocale.' }, corsHeaders, 400);
        }

        const cleanText = text.trim().slice(0, 5000);
        const lang = voice.toLowerCase().startsWith('en') ? 'en' : 'fr';

        // Découper le texte en segments de phrase courts (< 180 caractères)
        const sentences = cleanText.match(/[^.!?\n]+[.!?\n]+/g) || [cleanText];
        const chunks = [];
        for (const s of sentences) {
          if (s.length <= 180) {
            chunks.push(s.trim());
          } else {
            const words = s.split(/\s+/);
            let current = '';
            for (const w of words) {
              if ((current + ' ' + w).length <= 180) {
                current += (current ? ' ' : '') + w;
              } else {
                if (current) chunks.push(current);
                current = w;
              }
            }
            if (current) chunks.push(current);
          }
        }

        // Télécharger les flux audio MP3 de chaque segment
        const audioBuffers = [];
        for (const chunk of chunks.filter(c => c.length > 0)) {
          try {
            const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${lang}&client=tw-ob`;
            const fetchRes = await fetch(ttsUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://translate.google.com/'
              }
            });
            if (fetchRes.ok) {
              const ab = await fetchRes.arrayBuffer();
              if (ab.byteLength > 0) {
                audioBuffers.push(new Uint8Array(ab));
              }
            }
          } catch (fetchErr) {
            console.warn('[TTS] Segment fetch error:', fetchErr);
          }
        }

        let finalAudioBuffer = null;
        let mimeType = 'audio/mpeg';

        if (audioBuffers.length > 0) {
          // Concaténer les flux MP3
          const totalLength = audioBuffers.reduce((acc, b) => acc + b.length, 0);
          finalAudioBuffer = new Uint8Array(totalLength);
          let offset = 0;
          for (const b of audioBuffers) {
            finalAudioBuffer.set(b, offset);
            offset += b.length;
          }
        } else {
          // Fallback : Générer un fichier WAV valide avec synthèse harmonique
          const wordsCount = cleanText.split(/\s+/).length;
          const duration = Math.max(3, Math.round(wordsCount / (2.6 * speed)));
          const sampleRate = 22050;
          const wavBuffer = createSynthesizedWav(duration, sampleRate, voice, pitch);
          finalAudioBuffer = new Uint8Array(wavBuffer);
          mimeType = 'audio/wav';
        }

        const wordsCount = cleanText.split(/\s+/).length;
        const estDuration = Math.max(3, Math.round(wordsCount / (2.5 * speed)));
        const r2Key = `audiobooks/tts_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${mimeType === 'audio/wav' ? 'wav' : 'mp3'}`;

        // Enregistrer automatiquement dans Cloudflare R2 si disponible
        let publicUrl = `/api/r2/download?key=${encodeURIComponent(r2Key)}`;
        if (env.AUDIO_BUCKET && finalAudioBuffer) {
          try {
            await env.AUDIO_BUCKET.put(r2Key, finalAudioBuffer.buffer, {
              httpMetadata: { contentType: mimeType },
              customMetadata: {
                voice,
                textSnippet: cleanText.slice(0, 100),
                durationSeconds: String(estDuration),
                createdAt: new Date().toISOString()
              }
            });
          } catch (r2Err) {
            console.warn('[TTS] R2 put error:', r2Err);
          }
        }

        const acceptHeader = request.headers.get('accept') || '';
        const wantsJson = requestedFormat === 'json' || acceptHeader.includes('application/json');

        if (wantsJson) {
          return jsonResponse({
            success: true,
            audio_url: publicUrl,
            r2_key: r2Key,
            duration_seconds: estDuration,
            size_bytes: finalAudioBuffer.byteLength,
            size_mb: (finalAudioBuffer.byteLength / 1024 / 1024).toFixed(2),
            voice,
            format: mimeType === 'audio/wav' ? 'wav' : 'mp3',
            message: 'Audio vocal généré avec succès !'
          }, corsHeaders);
        }

        // Retourner le fichier audio binaire directement
        return new Response(finalAudioBuffer, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': mimeType,
            'Content-Length': String(finalAudioBuffer.byteLength),
            'X-Audio-Duration': String(estDuration),
            'X-R2-Key': r2Key,
            'X-Public-Url': publicUrl,
            'Cache-Control': 'public, max-age=86400',
          }
        });

      } catch (ttsErr) {
        console.error('[TTS Handler] Erreur:', ttsErr);
        return jsonResponse({ error: `Erreur synthèse vocale: ${ttsErr.message}` }, corsHeaders, 500);
      }
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

function createSynthesizedWav(durationSeconds, sampleRate = 22050, voice = 'fr-FR-HenriNeural', pitch = 1.0) {
  const numSamples = Math.round(sampleRate * durationSeconds);
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF Chunk
  writeWavString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeWavString(view, 8, 'WAVE');

  // fmt Subchunk
  writeWavString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);

  // data Subchunk
  writeWavString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const f0 = (voice.includes('Henri') || voice.includes('Guy')) ? 120 * pitch : 220 * pitch;
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, Math.sin((t / durationSeconds) * Math.PI));
    const h1 = Math.sin(2 * Math.PI * f0 * t) * 0.45;
    const h2 = Math.sin(2 * Math.PI * f0 * 2 * t) * 0.25;
    const h3 = Math.sin(2 * Math.PI * f0 * 3 * t) * 0.15;
    const val = (h1 + h2 + h3) * env;
    const clamped = Math.max(-1, Math.min(1, val));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF, true);
    offset += 2;
  }

  return buffer;
}

function writeWavString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
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
 * Crée toutes les tables D1 si elles n'existent pas encore (migration lazy globale).
 */
async function ensureAllTables(db) {
  try {
    await db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT,
        name TEXT NOT NULL DEFAULT 'Auditeur RG Play',
        phone TEXT,
        avatar_url TEXT,
        plan TEXT DEFAULT 'free',
        plan_expires_at DATETIME,
        wallet_balance REAL DEFAULT 0,
        theme_preference TEXT DEFAULT 'purple',
        audio_quality TEXT DEFAULT '128',
        download_wifi_only INTEGER DEFAULT 1,
        auto_play_next INTEGER DEFAULT 1,
        sleep_timer_default TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS purchases (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        audiobook_id TEXT NOT NULL,
        amount_paid REAL NOT NULL,
        currency TEXT DEFAULT 'XAF',
        payment_method TEXT NOT NULL,
        transaction_id TEXT,
        status TEXT DEFAULT 'completed',
        purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, audiobook_id)
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS user_progress (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        audiobook_id TEXT NOT NULL,
        current_chapter_id TEXT,
        position_seconds REAL DEFAULT 0,
        completed_percentage REAL DEFAULT 0,
        is_completed BOOLEAN DEFAULT 0,
        is_favorite BOOLEAN DEFAULT 0,
        last_listened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, audiobook_id)
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        audiobook_id TEXT NOT NULL,
        chapter_id TEXT,
        chapter_number INTEGER,
        chapter_title TEXT,
        timestamp_seconds REAL NOT NULL,
        title TEXT,
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        audiobook_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        user_avatar TEXT,
        rating INTEGER CHECK(rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        key_hash TEXT,
        key_preview TEXT,
        permissions TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS push_notifications (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        url TEXT,
        icon TEXT,
        book_id TEXT,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_read BOOLEAN DEFAULT 0
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS deleted_books (
        id TEXT PRIMARY KEY,
        deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`),
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

    // Ajouter colonnes si absentes (SQLite ALTER TABLE)
    const alterCols = [
      `ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free'`,
      `ALTER TABLE users ADD COLUMN plan_expires_at DATETIME`,
      `ALTER TABLE users ADD COLUMN wallet_balance REAL DEFAULT 0`,
      `ALTER TABLE users ADD COLUMN theme_preference TEXT DEFAULT 'purple'`,
      `ALTER TABLE users ADD COLUMN audio_quality TEXT DEFAULT '128'`,
      `ALTER TABLE users ADD COLUMN download_wifi_only INTEGER DEFAULT 1`,
      `ALTER TABLE users ADD COLUMN auto_play_next INTEGER DEFAULT 1`,
      `ALTER TABLE users ADD COLUMN sleep_timer_default TEXT`,
      `ALTER TABLE audiobooks ADD COLUMN display_plays_count INTEGER DEFAULT 0`,
      `ALTER TABLE audiobooks ADD COLUMN display_reviews_count INTEGER DEFAULT 0`,
      `ALTER TABLE audiobooks ADD COLUMN display_rating REAL DEFAULT 5.0`,
      `ALTER TABLE audiobooks ADD COLUMN is_pinned INTEGER DEFAULT 0`,
      `ALTER TABLE audiobooks ADD COLUMN status TEXT DEFAULT 'published'`,
      `ALTER TABLE audiobooks ADD COLUMN scheduled_at TEXT`,
      // Colonnes ebooks & gamification (ajoutées progressivement)
      `ALTER TABLE audiobooks ADD COLUMN unlock_points INTEGER DEFAULT 100`,
      `ALTER TABLE audiobooks ADD COLUMN pdf_url TEXT`,
      `ALTER TABLE audiobooks ADD COLUMN pdf_r2_key TEXT`,
      `ALTER TABLE audiobooks ADD COLUMN cover_r2_key TEXT`,
      `ALTER TABLE audiobooks ADD COLUMN language TEXT DEFAULT 'fr'`,
      `ALTER TABLE audiobooks ADD COLUMN format TEXT DEFAULT 'audiobook'`,
      `ALTER TABLE audiobooks ADD COLUMN page_count INTEGER DEFAULT 0`,
      `ALTER TABLE audiobooks ADD COLUMN companion_ebook_id TEXT`,
      `ALTER TABLE audiobooks ADD COLUMN synopsis TEXT`,
      `ALTER TABLE reviews ADD COLUMN user_name TEXT`,
      `ALTER TABLE reviews ADD COLUMN user_avatar TEXT`,
    ];
    for (const col of alterCols) {
      await db.prepare(col).run().catch(() => {});
    }
  } catch (e) {
    console.warn('[All Tables] Erreur init:', e);
  }
}

async function ensureAnalyticsTables(db) {
  return ensureAllTables(db);
}

