/**
 * functions/api/handlers/audiobooks.js
 * 
 * Gestionnaire modulaire RG Play pour le streaming audio R2 :
 * - Prise en charge native et unifiée des requêtes GET et HEAD (crucial Safari / WebKit / ExoPlayer)
 * - Support complet HTTP Range (Status 206 Partial Content) avec calcul strict de Content-Range
 * - Interdiction formelle du cache public sur les chunks 206 pour empêcher Cloudflare Edge
 *   de mettre en cache des fragments tronqués (15s/25s)
 * - Résolution intelligente des clés R2 avec fallbacks de dossiers (audios/, previews/, audiobooks/)
 */

/**
 * Détermine le Content-Type optimal selon l'extension du fichier audio/média
 */
function getInferredContentType(key = '') {
  const lowerKey = key.toLowerCase();
  if (lowerKey.endsWith('.mp3')) return 'audio/mpeg';
  if (lowerKey.endsWith('.m4a')) return 'audio/mp4';
  if (lowerKey.endsWith('.wav')) return 'audio/wav';
  if (lowerKey.endsWith('.webm')) return 'audio/webm';
  if (lowerKey.endsWith('.aac')) return 'audio/aac';
  if (lowerKey.endsWith('.flac')) return 'audio/flac';
  if (lowerKey.endsWith('.ogg') || lowerKey.endsWith('.opus')) return 'audio/ogg';
  if (lowerKey.endsWith('.pdf')) return 'application/pdf';
  if (lowerKey.endsWith('.webp')) return 'image/webp';
  if (lowerKey.endsWith('.jpg') || lowerKey.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerKey.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

/**
 * Sert un fichier R2 avec prise en charge intégrale des Range Requests HTTP 206 et du verbe HEAD
 */
export async function serveR2Object(request, env, corsHeaders, key) {
  if (!key) {
    return new Response(JSON.stringify({ error: 'Clé de fichier R2 manquante' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  if (!env.AUDIO_BUCKET) {
    return new Response(JSON.stringify({ error: 'Bucket R2 non configuré', key }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const method = request.method;
  const inferredType = getInferredContentType(key);

  // Normalisation du nom de fichier et des préfixes de secours
  let cleanKey = key;
  try {
    cleanKey = decodeURIComponent(key);
  } catch (_) {}

  const fileName = cleanKey.split('/').pop();
  const keysToTry = [
    key,
    cleanKey,
    `audios/${fileName}`,
    `previews/${fileName}`,
    `audiobooks/${fileName}`,
    fileName,
  ].filter((k, i, arr) => arr.indexOf(k) === i);

  const rangeHeader = request.headers.get('Range');
  const rangeMatch = rangeHeader ? rangeHeader.match(/bytes=(\d+)-(\d+)?/) : null;

  for (const tryKey of keysToTry) {
    try {
      // 1. Toujours sonder d'abord via HEAD pour obtenir la taille totale réelle du fichier
      const headObj = await env.AUDIO_BUCKET.head(tryKey);
      if (!headObj) continue;

      const totalSize = headObj.size;

      // ── CAS 1 : Requête partielle (Range HTTP 206) ──────────────────────────
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        if (isNaN(start) || start >= totalSize) {
          const errHeaders = new Headers(corsHeaders);
          errHeaders.set('Content-Range', `bytes */${totalSize}`);
          return new Response('Range Not Satisfiable', { status: 416, headers: errHeaders });
        }

        const rawEnd = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : undefined;
        const actualEnd = (rawEnd !== undefined && !isNaN(rawEnd))
          ? Math.min(rawEnd, totalSize - 1)
          : (totalSize - 1);
        const chunkLen = actualEnd - start + 1;

        const headers = new Headers(corsHeaders);
        headObj.writeHttpMetadata(headers);

        const currentType = headers.get('Content-Type');
        if (!currentType || currentType === 'application/octet-stream') {
          headers.set('Content-Type', inferredType);
        }

        headers.set('Accept-Ranges', 'bytes');
        headers.set('Content-Length', String(chunkLen));
        headers.set('Content-Range', `bytes ${start}-${actualEnd}/${totalSize}`);
        // 🛡️ CRITIQUE : Ne JAMAIS mettre public, immutable sur une réponse 206 !
        // Cela force Cloudflare Edge à ne pas mettre en cache un fragment tronqué (15s/25s).
        headers.set('Cache-Control', 'private, no-transform');
        headers.set('ETag', headObj.httpEtag || `"${tryKey}"`);

        if (method === 'HEAD') {
          return new Response(null, { status: 206, headers });
        }

        const obj = await env.AUDIO_BUCKET.get(tryKey, {
          range: { offset: start, length: chunkLen },
        });

        if (!obj) continue;
        return new Response(obj.body, { status: 206, headers });
      }

      // ── CAS 2 : Requête complète (HTTP 200) ou pré-vol HEAD ────────────────
      const headers = new Headers(corsHeaders);
      headObj.writeHttpMetadata(headers);

      const currentType = headers.get('Content-Type');
      if (!currentType || currentType === 'application/octet-stream') {
        headers.set('Content-Type', inferredType);
      }

      headers.set('Accept-Ranges', 'bytes');
      headers.set('Content-Length', String(totalSize));
      headers.set('Cache-Control', 'private, max-age=86400');
      headers.set('ETag', headObj.httpEtag || `"${tryKey}"`);

      if (method === 'HEAD') {
        return new Response(null, { status: 200, headers });
      }

      const obj = await env.AUDIO_BUCKET.get(tryKey);
      if (!obj) continue;

      return new Response(obj.body, { status: 200, headers });
    } catch (err) {
      console.warn(`[audiobooks.js] Erreur tentative clé "${tryKey}":`, err.message);
    }
  }

  return new Response(
    JSON.stringify({ error: 'Fichier introuvable dans le stockage R2', key }),
    { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}

/**
 * GET / HEAD /api/r2/download?key=... ou /api/r2/download/...
 */
export async function handleR2Stream(request, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '');
  const key = url.searchParams.get('key') || path.replace('/r2/download/', '');

  return serveR2Object(request, env, corsHeaders, key);
}

/**
 * GET / HEAD /api/chapters/:id/stream (Streaming de chapitre R2 avec vérification de droits)
 */
export async function handleChapterStream(request, env, corsHeaders, chapterId) {
  const method = request.method;
  if (method !== 'GET' && method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  let r2Key = null;
  const userId = request.headers.get('X-User-Id') || 'user-demo';

  if (env.DB) {
    const chapter = await env.DB.prepare(
      'SELECT c.audio_r2_key, c.audiobook_id, c.chapter_number FROM chapters c WHERE c.id = ?'
    ).bind(chapterId).first();

    if (!chapter) {
      return new Response(JSON.stringify({ error: 'Chapitre non trouvé' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Le chapitre 1 (ou <= 1) est toujours un extrait gratuit
    const isFreePreview = Number(chapter.chapter_number) <= 1;

    if (!isFreePreview) {
      const book = await env.DB.prepare(
        'SELECT price, is_free_for_members, unlock_points FROM audiobooks WHERE id = ?'
      ).bind(chapter.audiobook_id).first();

      const isBookFree = book && (Number(book.price) === 0 || book.is_free_for_members || Number(book.unlock_points) === 0);

      if (!isBookFree) {
        const purchase = await env.DB.prepare(
          "SELECT id FROM purchases WHERE (user_id = ? OR user_id = 'user-demo') AND audiobook_id = ? AND status = 'completed'"
        ).bind(userId, chapter.audiobook_id).first();

        if (!purchase) {
          return new Response(JSON.stringify({
            error: 'Accès non autorisé - Livre non acheté',
            purchase_required: true,
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }
    }

    r2Key = chapter.audio_r2_key;
  }

  if (env.AUDIO_BUCKET && r2Key) {
    return serveR2Object(request, env, corsHeaders, r2Key);
  }

  // Mode secours si R2 n'est pas lié ou clé absente
  if (method === 'HEAD') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  return new Response(JSON.stringify({
    stream_url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
    message: 'Streaming fallback (R2 non configuré localement)',
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

/**
 * GET / HEAD /api/audiobooks/:id/preview (Extrait audio officiel du livre)
 */
export async function handleAudiobookPreview(request, env, corsHeaders, bookId) {
  const method = request.method;
  if (method !== 'GET' && method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  if (env.DB) {
    const book = await env.DB.prepare(
      'SELECT preview_r2_key, preview_url FROM audiobooks WHERE id = ?'
    ).bind(bookId).first();

    if (book?.preview_r2_key && env.AUDIO_BUCKET) {
      return serveR2Object(request, env, corsHeaders, book.preview_r2_key);
    }
    if (book?.preview_url) {
      return Response.redirect(book.preview_url, 302);
    }
  }

  return new Response(JSON.stringify({ error: 'Extrait non disponible' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
