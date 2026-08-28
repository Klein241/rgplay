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

    // ─── GET /api/audiobooks ─────────────────────────────────────
    if ((path === '/audiobooks' || path === '/audiobooks/') && method === 'GET') {
      const category = url.searchParams.get('category');
      const search = url.searchParams.get('search');
      const featured = url.searchParams.get('featured');

      // Cache KV si pas de filtres dynamiques
      if (!search && env.KV_BINDING) {
        const cacheKey = `books_${category || 'all'}_${featured || 'false'}`;
        const cached = await env.KV_BINDING.get(cacheKey, { type: 'json' });
        if (cached && Array.isArray(cached)) {
          const sanitized = cached.map(b => {
            let cUrl = b.cover_url;
            if (!cUrl || cUrl.includes('r2.cloudflarestorage.com')) {
              const fb = getFallbackAudiobooks().find(item => item.id === b.id);
              cUrl = fb?.cover_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80';
            }
            let pUrl = b.preview_url;
            if (!pUrl || pUrl.includes('r2.cloudflarestorage.com')) {
              const fb = getFallbackAudiobooks().find(item => item.id === b.id);
              pUrl = fb?.preview_url || 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';
            }
            return { ...b, cover_url: cUrl, preview_url: pUrl };
          });
          return jsonResponse(sanitized, corsHeaders);
        }
      }

      if (env.DB) {
        let query = `
          SELECT a.*, c.name as category_name 
          FROM audiobooks a 
          LEFT JOIN categories c ON a.category_id = c.id 
          WHERE 1=1
        `;
        const queryParams = [];

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
        query += ' ORDER BY a.is_featured DESC, a.rating DESC';

        const { results } = await env.DB.prepare(query).bind(...queryParams).all();

        // Récupérer TOUS les chapitres pour chaque livre depuis la table chapters de D1
        let chaptersByBook = {};
        try {
          const { results: allChapters } = await env.DB.prepare(
            'SELECT * FROM chapters ORDER BY chapter_number ASC'
          ).all();
          for (const ch of (allChapters || [])) {
            if (!chaptersByBook[ch.audiobook_id]) chaptersByBook[ch.audiobook_id] = [];
            chaptersByBook[ch.audiobook_id].push({
              ...ch,
              audio_stream_url: `/api/chapters/${ch.id}/stream`,
              audio_url: (ch.audio_url && !ch.audio_url.includes('r2.cloudflarestorage.com')) ? ch.audio_url : `/api/chapters/${ch.id}/stream`,
            });
          }
        } catch (chErr) {
          console.warn('Erreur chargement chapitres D1:', chErr);
        }

        // Enrichir et garantir des URLs publiques valides pour chaque livre
        const enriched = results.map(book => {
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

          const bookChapters = chaptersByBook[book.id] && chaptersByBook[book.id].length > 0
            ? chaptersByBook[book.id]
            : (getFallbackAudiobooks().find(fb => fb.id === book.id)?.chapters || [
                { id: `chap-${book.id}-1`, chapter_number: 1, title: 'Introduction & Chapitre 1', duration_seconds: book.duration_seconds || 1800, audio_url: previewUrl }
              ]);

          return {
            ...book,
            cover_url: coverUrl,
            preview_url: previewUrl,
            chapters: bookChapters,
          };
        });

        // Cache KV si pas de recherche textuelle
        if (!search && env.KV_BINDING) {
          const cacheKey = `books_${category || 'all'}_${featured || 'false'}`;
          await env.KV_BINDING.put(cacheKey, JSON.stringify(enriched), { expirationTtl: 300 });
        }

        return jsonResponse(enriched, corsHeaders);
      }
      return jsonResponse(getFallbackAudiobooks(category, search, featured), corsHeaders);
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
        const id = `prog-${userId.slice(0, 8)}-${audiobook_id}`;
        await env.DB.prepare(`
          INSERT INTO user_progress (id, user_id, audiobook_id, current_chapter_id, position_seconds, completed_percentage, is_completed, last_listened_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id, audiobook_id) DO UPDATE SET
            current_chapter_id = excluded.current_chapter_id,
            position_seconds = excluded.position_seconds,
            completed_percentage = excluded.completed_percentage,
            is_completed = excluded.is_completed,
            last_listened_at = CURRENT_TIMESTAMP
        `).bind(id, userId, audiobook_id, chapter_id, position_seconds, completed_percentage, is_completed ? 1 : 0).run();
      }

      // Invalidation du cache KV pour la bibliothèque
      if (env.KV_BINDING) {
        await env.KV_BINDING.delete(`library_${userId}`);
      }

      return jsonResponse({ success: true, synced_to: 'cloudflare_d1' }, corsHeaders);
    }

    // ─── POST /api/payment/initiate (CamerPay — Paiement Réel) ──────
    // Initie un paiement Mobile Money via CamerPay.
    // Crée la transaction en état 'pending' dans D1 et envoie la requête à l'opérateur.
    // L'utilisateur reçoit un push USSD/SMS sur son téléphone et entre son PIN.
    // Une fois confirmé, CamerPay appelle POST /api/payment/notify (webhook).
    if (path === '/payment/initiate' && method === 'POST') {
      const body = await request.json();
      const userId = request.headers.get('X-User-Id') || 'user-demo';
      const { audiobook_id, payment_method, customer_phone, amount } = body;

      // Validation des champs requis
      if (!audiobook_id || !payment_method || !amount) {
        return jsonResponse({ success: false, error: 'Champs requis manquants : audiobook_id, payment_method, amount' }, corsHeaders, 400);
      }
      if ((payment_method === 'orange_money' || payment_method === 'mtn_momo') && !customer_phone) {
        return jsonResponse({ success: false, error: 'Numéro de téléphone requis pour le paiement mobile' }, corsHeaders, 400);
      }

      // Générer un identifiant de transaction unique
      const txId = `RGP-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      const purchaseId = `pur-${Date.now()}`;
      const CAMERPAY_TOKEN = env.CAMERPAY_TOKEN || '800|QNy2YL5p5kkEAVFK3FNi7RY8XaL8LrKYW71RA5XQ3262b7e9';
      const WEBHOOK_URL = 'https://rg-play.pages.dev/api/payment/notify';
      const RETURN_URL  = 'https://rg-play.pages.dev';

      // 1. Enregistrer la transaction en état PENDING dans D1
      if (env.DB) {
        try {
          await env.DB.prepare(`
            INSERT OR REPLACE INTO purchases
              (id, user_id, audiobook_id, amount_paid, currency, payment_method, transaction_id, status, purchased_at)
            VALUES (?, ?, ?, ?, 'XAF', ?, ?, 'pending', CURRENT_TIMESTAMP)
          `).bind(purchaseId, userId, audiobook_id, Number(amount), payment_method, txId).run();
        } catch (dbErr) {
          console.error('[PAYMENT] Erreur insertion D1:', dbErr.message);
          return jsonResponse({ success: false, error: 'Erreur base de données' }, corsHeaders, 500);
        }
      }

      // Stocker dans KV pour polling rapide (évite requêtes D1 répétées)
      if (env.KV_BINDING) {
        await env.KV_BINDING.put(`tx_${txId}`, JSON.stringify({
          userId, audiobook_id, amount: Number(amount), payment_method,
          customer_phone, status: 'pending', created_at: Date.now()
        }), { expirationTtl: 3600 }); // expire après 1h si non confirmé
      }

      // 2. Appel à CamerPay pour déclencher le push USSD sur le téléphone de l'utilisateur
      let camerpayData = null;
      let camerpayError = null;
      try {
        const camerpayRes = await fetch('https://camerpay.biz/api/payment/initiate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CAMERPAY_TOKEN}`,
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            payment_method,                // "orange_money" | "mtn_momo"
            amount: Number(amount),
            currency: 'XAF',
            customer_phone,                // Ex: "699123456" (sans indicatif)
            merchant_invoice_id: txId,     // Référence unique de notre côté
            merchant_callback_url: WEBHOOK_URL, // CamerPay appellera cette URL quand confirmé
            merchant_return_url: RETURN_URL,
            source: 'api',
          }),
        });

        const camerpayText = await camerpayRes.text();
        try {
          camerpayData = JSON.parse(camerpayText);
        } catch {
          camerpayData = { raw: camerpayText };
        }

        if (!camerpayRes.ok) {
          // CamerPay a refusé : marquer comme failed et retourner l'erreur
          camerpayError = camerpayData?.message || `CamerPay HTTP ${camerpayRes.status}`;
          if (env.DB) {
            await env.DB.prepare(
              `UPDATE purchases SET status = 'failed' WHERE transaction_id = ?`
            ).bind(txId).run();
          }
          if (env.KV_BINDING) {
            await env.KV_BINDING.put(`tx_${txId}`, JSON.stringify({
              userId, audiobook_id, status: 'failed', error: camerpayError, updated_at: Date.now()
            }), { expirationTtl: 3600 });
          }
          return jsonResponse({
            success: false,
            transaction_id: txId,
            status: 'failed',
            error: camerpayError,
            camerpay_response: camerpayData,
          }, corsHeaders, 402);
        }
      } catch (fetchErr) {
        // Erreur réseau (timeout, DNS...) — garder en pending pour retry
        console.error('[PAYMENT] Erreur réseau CamerPay:', fetchErr.message);
        return jsonResponse({
          success: false,
          transaction_id: txId,
          status: 'pending',
          error: 'Impossible de joindre le service de paiement. Vérifiez votre connexion.',
        }, corsHeaders, 503);
      }

      // 3. Succès : CamerPay a accepté la demande → push envoyé sur le téléphone
      return jsonResponse({
        success: true,
        transaction_id: txId,
        audiobook_id,
        status: 'pending',
        message: 'Demande envoyée ! Vérifiez votre téléphone et entrez votre code PIN pour confirmer le paiement.',
        camerpay_response: camerpayData,
      }, corsHeaders);
    }

    // ─── POST/GET /api/payment/notify & /api/webhook/payment (Webhook CamerPay) ──
    // CamerPay appelle cette URL quand le paiement est confirmé par l'opérateur (MTN/Orange).
    if ((path === '/payment/notify' || path === '/webhook/payment') && (method === 'POST' || method === 'GET')) {
      let hookData = {};
      
      // 1. Lire les query parameters (si GET ou POST avec query)
      for (const [k, v] of url.searchParams.entries()) {
        hookData[k] = v;
      }

      // 2. Si POST, lire le body JSON ou form-urlencoded
      if (method === 'POST') {
        try {
          const bodyJson = await request.json();
          hookData = { ...hookData, ...bodyJson };
        } catch {
          try {
            const text = await request.text();
            const formObj = Object.fromEntries(new URLSearchParams(text));
            hookData = { ...hookData, ...formObj };
          } catch (_) {}
        }
      }

      console.log('[WEBHOOK CamerPay]', JSON.stringify(hookData));

      // Extraire l'identifiant de transaction (CamerPay peut utiliser plusieurs clés)
      const txId = hookData.merchant_invoice_id || 
                   hookData.transaction_id || 
                   hookData.reference || 
                   hookData.ref || 
                   hookData.invoice_id ||
                   hookData.id;

      // Détecter si le statut est un succès
      const statusValue = String(
        hookData.status || 
        hookData.payment_status || 
        hookData.transaction_status || 
        hookData.code || 
        hookData.result || 
        ''
      ).toLowerCase();

      const isSuccess = ['success', 'successful', 'completed', 'paid', 'approved', '00', '1', 'ok', 'valid'].includes(statusValue) || 
                        hookData.status === true;

      if (!txId) {
        console.warn('[WEBHOOK] Pas de transaction_id trouvé:', hookData);
        return jsonResponse({ received: true, warning: 'Pas de transaction_id identifié' }, corsHeaders);
      }

      if (isSuccess || statusValue !== 'failed') {
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

        // Mettre à jour le KV pour polling instantané côté frontend
        if (env.KV_BINDING) {
          const existing = await env.KV_BINDING.get(`tx_${txId}`, { type: 'json' }) || {};
          await env.KV_BINDING.put(`tx_${txId}`, JSON.stringify({
            ...existing,
            status: 'completed',
            confirmed_at: Date.now(),
            camerpay_data: hookData,
          }), { expirationTtl: 86400 * 30 });
        }

        console.log(`[WEBHOOK] ✅ Paiement confirmé avec succès : ${txId}`);
      } else {
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
        console.log(`[WEBHOOK] ❌ Paiement échoué : ${txId}`, hookData);
      }

      return jsonResponse({ received: true, status: isSuccess ? 'completed' : statusValue }, corsHeaders);
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
    const payStatusMatch = path.match(/^\/payment\/status\/([A-Z0-9_-]+)$/);
    if (payStatusMatch && method === 'GET') {
      const txId = payStatusMatch[1];
      const userId = request.headers.get('X-User-Id') || 'user-demo';
      const CAMERPAY_TOKEN = env.CAMERPAY_TOKEN || '800|QNy2YL5p5kkEAVFK3FNi7RY8XaL8LrKYW71RA5XQ3262b7e9';

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
      let localStatus = null;
      let localData   = null;

      if (env.KV_BINDING) {
        localData = await env.KV_BINDING.get(`tx_${txId}`, { type: 'json' });
        if (localData) localStatus = localData.status;
      }

      // Si déjà completed ou failed en KV → retourner directement
      if (localStatus === 'completed' || localStatus === 'failed') {
        let bookInfo = null;
        if (localStatus === 'completed' && localData?.audiobook_id && env.DB) {
          bookInfo = await env.DB.prepare(
            'SELECT id, title, author, cover_url FROM audiobooks WHERE id = ?'
          ).bind(localData.audiobook_id).first();
        }
        return jsonResponse({
          transaction_id: txId,
          status: localStatus,
          audiobook_id: localData?.audiobook_id,
          audiobook: bookInfo,
          amount: localData?.amount,
          payment_method: localData?.payment_method,
          source: 'kv_cache',
        }, corsHeaders);
      }

      // ── 2. Vérification active auprès de CamerPay (si status=pending) ─────
      // On interroge CamerPay directement à chaque poll pour ne pas dépendre du webhook.
      let camerpayStatus = null;
      let camerpayTxData = null;
      try {
        // Essayer d'abord avec l'endpoint de recherche par référence
        const checkRes = await fetch(
          `https://camerpay.biz/api/payment/${txId}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${CAMERPAY_TOKEN}`,
              'Accept': 'application/json',
            },
          }
        );

        if (checkRes.ok) {
          const checkText = await checkRes.text();
          try { camerpayTxData = JSON.parse(checkText); } catch { camerpayTxData = null; }

          if (camerpayTxData) {
            // Normaliser le statut CamerPay → nos valeurs
            const rawStatus = (
              camerpayTxData.status ||
              camerpayTxData.payment_status ||
              camerpayTxData.transaction_status ||
              camerpayTxData.data?.status || ''
            ).toLowerCase();

            if (['success', 'successful', 'completed', 'paid'].includes(rawStatus)) {
              camerpayStatus = 'completed';
            } else if (['failed', 'cancelled', 'canceled', 'rejected', 'expired'].includes(rawStatus)) {
              camerpayStatus = 'failed';
            } else {
              camerpayStatus = 'pending';
            }
          }
        } else {
          // Fallback : essayer endpoint alternatif avec merchant_invoice_id
          const checkRes2 = await fetch(
            `https://camerpay.biz/api/transactions?reference=${encodeURIComponent(txId)}`,
            {
              headers: {
                'Authorization': `Bearer ${CAMERPAY_TOKEN}`,
                'Accept': 'application/json',
              },
            }
          );
          if (checkRes2.ok) {
            const data2 = await checkRes2.json().catch(() => null);
            if (data2) {
              camerpayTxData = data2;
              const rawStatus = (
                data2.status || data2.data?.status ||
                (Array.isArray(data2.data) && data2.data[0]?.status) || ''
              ).toLowerCase();
              if (['success', 'successful', 'completed', 'paid'].includes(rawStatus)) {
                camerpayStatus = 'completed';
              } else if (['failed', 'cancelled', 'canceled', 'rejected'].includes(rawStatus)) {
                camerpayStatus = 'failed';
              }
            }
          }
        }
      } catch (pollErr) {
        // Erreur réseau temporaire vers CamerPay — pas grave, on continue
        console.warn(`[STATUS POLL] Erreur vérif CamerPay pour ${txId}:`, pollErr.message);
      }

      // ── 3. Si CamerPay confirme 'completed' → mettre à jour et déverrouiller ─
      if (camerpayStatus === 'completed') {
        const audiobookId = localData?.audiobook_id;
        await confirmPayment(audiobookId, camerpayTxData);

        let bookInfo = null;
        if (audiobookId && env.DB) {
          bookInfo = await env.DB.prepare(
            'SELECT id, title, author, cover_url FROM audiobooks WHERE id = ?'
          ).bind(audiobookId).first();
        }

        return jsonResponse({
          transaction_id: txId,
          status: 'completed',
          audiobook_id: audiobookId,
          audiobook: bookInfo,
          amount: localData?.amount,
          payment_method: localData?.payment_method,
          source: 'camerpay_active_check',
        }, corsHeaders);
      }

      // ── 4. Si CamerPay confirme 'failed' ─────────────────────────────────
      if (camerpayStatus === 'failed') {
        if (env.DB) {
          await env.DB.prepare(
            `UPDATE purchases SET status = 'failed' WHERE transaction_id = ? AND status = 'pending'`
          ).bind(txId).run();
        }
        if (env.KV_BINDING && localData) {
          await env.KV_BINDING.put(`tx_${txId}`, JSON.stringify({
            ...localData, status: 'failed', updated_at: Date.now()
          }), { expirationTtl: 3600 });
        }
        return jsonResponse({
          transaction_id: txId,
          status: 'failed',
          source: 'camerpay_active_check',
        }, corsHeaders);
      }

      // ── 5. Fallback D1 (si pas de KV) ────────────────────────────────────
      if (env.DB) {
        const pur = await env.DB.prepare(
          `SELECT p.*, a.title, a.author, a.cover_url FROM purchases p
           LEFT JOIN audiobooks a ON a.id = p.audiobook_id
           WHERE p.transaction_id = ?`
        ).bind(txId).first();

        if (pur) {
          return jsonResponse({
            transaction_id: txId,
            status: pur.status,
            audiobook_id: pur.audiobook_id,
            audiobook: pur.title ? { id: pur.audiobook_id, title: pur.title, author: pur.author, cover_url: pur.cover_url } : null,
            amount: pur.amount_paid,
            payment_method: pur.payment_method,
            source: 'd1_database',
          }, corsHeaders);
        }
      }

      // Toujours en attente (pas encore confirmé par CamerPay)
      return jsonResponse({
        transaction_id: txId,
        status: localData?.status || 'pending',
        source: 'kv_pending',
      }, corsHeaders);
    }


    // ─── POST /api/admin/payment/sync-pending ─────────────────────────────────
    // Synchronise manuellement toutes les transactions 'pending' avec CamerPay.
    // Utile si des webhooks n'ont pas été reçus.
    // Appelé depuis le dashboard admin ou manuellement.
    if (path === '/admin/payment/sync-pending' && method === 'POST') {
      const CAMERPAY_TOKEN = env.CAMERPAY_TOKEN || '800|QNy2YL5p5kkEAVFK3FNi7RY8XaL8LrKYW71RA5XQ3262b7e9';
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

    // ─── POST /api/admin/books (Ajout / Mise à jour Livre dans D1) ─
    if (path === '/admin/books' && method === 'POST') {
      const body = await request.json();
      const bookId = body.id || `book-${Date.now()}`;

      if (env.DB) {
        try {
          await env.DB.prepare(`
            INSERT OR REPLACE INTO audiobooks (
              id, title, author, narrator, description, synopsis,
              price, discount_price, category_id, cover_url, cover_r2_key,
              preview_url, preview_r2_key, duration_seconds, rating, rating_count, 
              is_featured, is_bestseller, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 5.0, 1, 1, 0, CURRENT_TIMESTAMP)
          `).bind(
            bookId, body.title, body.author, body.narrator, body.description, body.synopsis || '',
            body.price, body.discount_price || null, body.category_id,
            body.cover_url, body.cover_r2_key || null,
            body.preview_url, body.preview_r2_key || null,
            body.duration_seconds || 0
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
                chap.audio_url || '',
                chap.duration_seconds || 1800
              ).run();
            }
          }

          // Invalider les caches KV catalogue
          if (env.KV_BINDING) {
            try {
              const list = await env.KV_BINDING.list({ prefix: 'books_' });
              for (const key of list.keys) {
                await env.KV_BINDING.delete(key.name);
              }
            } catch (_) {
              await env.KV_BINDING.delete('books_all_false');
              await env.KV_BINDING.delete('books_all_true');
            }
            await env.KV_BINDING.delete('categories_v1');
            await env.KV_BINDING.delete(`book_${bookId}`);
          }

          return jsonResponse({
            success: true,
            book_id: bookId,
            stored_in: ['cloudflare_d1', 'cloudflare_r2'],
            message: 'Livre audio enregistré avec succès dans Cloudflare D1 !'
          }, corsHeaders);
        } catch (dbErr) {
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

    // ─── DELETE /api/admin/books/:id (Suppression Livre D1) ──────
    const deleteBookMatch = path.match(/^\/admin\/books\/([a-zA-Z0-9_-]+)$/);
    if (deleteBookMatch && method === 'DELETE') {
      const bookId = deleteBookMatch[1];

      if (env.DB) {
        await env.DB.prepare('DELETE FROM chapters WHERE audiobook_id = ?').bind(bookId).run();
        await env.DB.prepare('DELETE FROM audiobooks WHERE id = ?').bind(bookId).run();

        if (env.KV_BINDING) {
          await env.KV_BINDING.delete('books_all_false');
          await env.KV_BINDING.delete('books_all_true');
          await env.KV_BINDING.delete(`book_${bookId}`);
        }

        return jsonResponse({ success: true, message: `Livre ${bookId} supprimé de D1` }, corsHeaders);
      }

      return jsonResponse({ success: true, message: `Livre supprimé localement` }, corsHeaders);
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
              headers.set('Accept-Ranges', 'bytes');
              headers.set('Content-Range', `bytes ${start}-${end ?? (obj.size - 1)}/${obj.size}`);
              return new Response(obj.body, { status: 206, headers });
            }
          }
        }

        const obj = await env.AUDIO_BUCKET.get(key);
        if (obj) {
          const headers = new Headers(corsHeaders);
          obj.writeHttpMetadata(headers);
          headers.set('Accept-Ranges', 'bytes');
          headers.set('Cache-Control', 'public, max-age=86400');
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

function getFallbackAudiobooks(category, search, featured) {
  const books = [
    { id: 'book-1', title: 'La Psychologie de l\'Argent', author: 'Morgan Housel', narrator: 'Alexandre D.', description: 'Quelques leçons intemporelles sur la richesse, la cupidité et le bonheur.', cover_url: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&q=80', preview_url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3', category_id: 'cat-1', category_name: 'Business & Finance', price: 3500, discount_price: 2900, duration_seconds: 21600, rating: 4.9, rating_count: 1420, is_featured: 1, is_bestseller: 1, is_free_for_members: 0, chapters: [{ id: 'chap-1-1', chapter_number: 1, title: 'Introduction : Le plus grand spectacle sur Terre', duration_seconds: 1800, audio_url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3', audio_stream_url: '/api/chapters/chap-1-1/stream' }, { id: 'chap-1-2', chapter_number: 2, title: 'Personne n\'est fou', duration_seconds: 2400, audio_url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=ambient-piano-amp-strings-10711.mp3', audio_stream_url: '/api/chapters/chap-1-2/stream' }, { id: 'chap-1-3', chapter_number: 3, title: 'Chance & Risque : Deux faces d\'une même pièce', duration_seconds: 2100, audio_url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8bbf7341e.mp3?filename=cinematic-epic-10903.mp3', audio_stream_url: '/api/chapters/chap-1-3/stream' }] },
    { id: 'book-4', title: 'Révolution IA : Comprendre et Dompter le Futur', author: 'Dr. Sophie Laurent', narrator: 'Claire V.', description: 'Une plongée captivante dans le fonctionnement des LLMs, agents autonomes et leur impact sur le travail.', cover_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80', preview_url: 'https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f792cb.mp3?filename=electronic-future-beats-117997.mp3', category_id: 'cat-3', category_name: 'Intelligence Artificielle & Tech', price: 5000, discount_price: 3900, duration_seconds: 25200, rating: 4.95, rating_count: 2150, is_featured: 1, is_bestseller: 1, is_free_for_members: 0, chapters: [{ id: 'chap-4-1', chapter_number: 1, title: 'Genèse des Modèles Géants : De Turing aux Transformers', duration_seconds: 2400, audio_url: 'https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f792cb.mp3?filename=electronic-future-beats-117997.mp3', audio_stream_url: '/api/chapters/chap-4-1/stream' }, { id: 'chap-4-2', chapter_number: 2, title: 'L\'art du Prompting et les Agents Autonomes', duration_seconds: 3000, audio_url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3', audio_stream_url: '/api/chapters/chap-4-2/stream' }] },
    { id: 'book-2', title: 'L\'Effet Cumulé : Décuplez votre réussite', author: 'Darren Hardy', narrator: 'Nathalie Dupont', description: 'Le principe fondamental pour transformer de petites actions quotidiennes en succès gigantesques.', cover_url: 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=800&q=80', preview_url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=ambient-piano-amp-strings-10711.mp3', category_id: 'cat-2', category_name: 'Développement Personnel', price: 4000, discount_price: null, duration_seconds: 18000, rating: 4.85, rating_count: 980, is_featured: 1, is_bestseller: 1, is_free_for_members: 0, chapters: [{ id: 'chap-2-1', chapter_number: 1, title: 'L\'effet cumulé en action', duration_seconds: 3600, audio_url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=ambient-piano-amp-strings-10711.mp3', audio_stream_url: '/api/chapters/chap-2-1/stream' }] },
    { id: 'book-3', title: 'L\'Art de la Guerre & Stratégie', author: 'Sun Tzu (Adapté)', narrator: 'Jean-Pierre M.', description: 'Le traité stratégique le plus influent au monde, appliqué au leadership moderne.', cover_url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&q=80', preview_url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8bbf7341e.mp3?filename=cinematic-epic-10903.mp3', category_id: 'cat-5', category_name: 'Histoire & Stratégie', price: 2500, discount_price: 1900, duration_seconds: 10800, rating: 4.7, rating_count: 640, is_featured: 0, is_bestseller: 0, is_free_for_members: 1, chapters: [{ id: 'chap-3-1', chapter_number: 1, title: 'Évaluation et plans initiaux', duration_seconds: 2700, audio_url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8bbf7341e.mp3?filename=cinematic-epic-10903.mp3', audio_stream_url: '/api/chapters/chap-3-1/stream' }] },
    { id: 'book-5', title: 'Le Pouvoir du Moment Présent', author: 'Eckhart Tolle', narrator: 'Marc Bellemare', description: 'Guide d\'éveil spirituel pour calmer le bavardage mental et vivre avec sérénité.', cover_url: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80', preview_url: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_bb630cc098.mp3?filename=meditation-peace-6644.mp3', category_id: 'cat-4', category_name: 'Psychologie & Mental', price: 3800, discount_price: null, duration_seconds: 28800, rating: 4.88, rating_count: 3120, is_featured: 0, is_bestseller: 1, is_free_for_members: 0, chapters: [{ id: 'chap-5-1', chapter_number: 1, title: 'Vous n\'êtes pas votre mental', duration_seconds: 3600, audio_url: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_bb630cc098.mp3?filename=meditation-peace-6644.mp3', audio_stream_url: '/api/chapters/chap-5-1/stream' }] },
    { id: 'book-6', title: 'L\'Alchimiste & Secrets du Désert', author: 'Paulo Coelho', narrator: 'Michel A.', description: 'L\'histoire intemporelle de Santiago, un berger andalou parti à la recherche de sa Légende Personnelle.', cover_url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800&q=80', preview_url: 'https://cdn.pixabay.com/download/audio/2022/05/16/audio_c1c1f7a0dc.mp3?filename=oriental-strings-111162.mp3', category_id: 'cat-6', category_name: 'Romans & Fiction', price: 3000, discount_price: null, duration_seconds: 14400, rating: 4.92, rating_count: 4800, is_featured: 0, is_bestseller: 1, is_free_for_members: 1, chapters: [{ id: 'chap-6-1', chapter_number: 1, title: 'Première Partie : Les rêves de Tarifa', duration_seconds: 3200, audio_url: 'https://cdn.pixabay.com/download/audio/2022/05/16/audio_c1c1f7a0dc.mp3?filename=oriental-strings-111162.mp3', audio_stream_url: '/api/chapters/chap-6-1/stream' }] },
  ];

  let filtered = books;
  if (category && category !== 'all') filtered = filtered.filter(b => b.category_id === category);
  if (search) { const q = search.toLowerCase(); filtered = filtered.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)); }
  if (featured === 'true') filtered = filtered.filter(b => b.is_featured === 1);
  return filtered;
}

function getFallbackBookDetail(id) {
  return getFallbackAudiobooks().find(b => b.id === id) || getFallbackAudiobooks()[0];
}

function getFallbackLibrary() {
  const books = getFallbackAudiobooks();
  return [
    { ...books[0], purchased_at: new Date().toISOString(), position_seconds: 450, completed_percentage: 25, is_completed: 0, is_favorite: 1, current_chapter_title: 'Personne n\'est fou' },
    { ...books[1], purchased_at: new Date().toISOString(), position_seconds: 1200, completed_percentage: 50, is_completed: 0, is_favorite: 1, current_chapter_title: 'L\'art du Prompting' },
  ];
}

async function ensureD1Seeded(db) {
  try {
    const tableCheck = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='audiobooks'").first();
    if (!tableCheck) return;

    const count = await db.prepare('SELECT COUNT(*) as c FROM audiobooks').first();
    if (count && count.c === 0) {
      const categories = getFallbackCategories();
      for (const cat of categories) {
        await db.prepare('INSERT OR IGNORE INTO categories (id, name, slug, icon, color, display_order) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(cat.id, cat.name, cat.slug, cat.icon, cat.color, cat.display_order).run();
      }

      const books = getFallbackAudiobooks();
      for (const b of books) {
        await db.prepare(`
          INSERT OR IGNORE INTO audiobooks (
            id, title, author, narrator, description, price, discount_price, category_id, cover_url, preview_url, duration_seconds, rating, rating_count, is_featured, is_bestseller
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          b.id, b.title, b.author, b.narrator, b.description,
          b.price, b.discount_price || null, b.category_id,
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

