/**
 * functions/api/handlers/download.js
 * 
 * Gestionnaire modulaire RG Play pour le téléchargement physique direct :
 * - Streaming proxy avec Content-Disposition: attachment
 * - Contournement des blocages CORS et restrictions mobiles de lecture au lieu de téléchargement
 */

export async function handleAudioDownload(request, env, corsHeaders) {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');
  const rawTitle = url.searchParams.get('title') || 'audiobook';
  const cleanTitle = rawTitle.replace(/[^a-zA-Z0-9_-]/g, '_');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Paramètre url manquant' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    let fetchUrl = targetUrl;
    if (targetUrl.startsWith('/')) {
      fetchUrl = `${url.origin}${targetUrl}`;
    }

    const upstream = await fetch(fetchUrl);
    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: 'Fichier distant inaccessible' }), {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const contentType = upstream.headers.get('content-type') || 'audio/mpeg';
    const responseHeaders = new Headers(corsHeaders);
    responseHeaders.set('Content-Type', contentType);
    responseHeaders.set('Content-Disposition', `attachment; filename="${cleanTitle}.mp3"`);
    responseHeaders.set('Cache-Control', 'public, max-age=86400');

    return new Response(upstream.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

/**
 * Incrémente le compteur de téléchargements d'un livre (persistant dans Cloudflare D1)
 * Sépare de manière étanche :
 * 1. 'real_downloads_count' : VRAI compteur d'actions physiques d'utilisateurs (lu par l'admin)
 * 2. 'display_plays_count' / 'downloads_count' : Compteur public ("Effet de masse")
 */
export async function handleIncrementDownloads(request, env, corsHeaders, bookId) {
  if (!bookId) {
    return new Response(JSON.stringify({ error: 'ID du livre manquant' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ 
      success: true, 
      id: bookId, 
      downloads_count: 1, 
      display_plays_count: 1,
      real_downloads_count: 1,
      note: 'Simulation sans D1' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    // 1. Garantir l'existence des colonnes nécessaires (idempotent, zéro crash)
    await env.DB.prepare('ALTER TABLE audiobooks ADD COLUMN real_downloads_count INTEGER DEFAULT 0').run().catch(() => {});
    await env.DB.prepare('ALTER TABLE audiobooks ADD COLUMN real_plays_count INTEGER DEFAULT 0').run().catch(() => {});
    await env.DB.prepare('ALTER TABLE audiobooks ADD COLUMN downloads_count INTEGER DEFAULT 0').run().catch(() => {});

    // 2. Lire l'état actuel de manière sécurisée
    const row = await env.DB.prepare(
      'SELECT id, display_plays_count, COALESCE(real_downloads_count, 0) as real_downloads_count FROM audiobooks WHERE id = ?'
    ).bind(bookId).first().catch(() => null);

    // Vrai compteur (Admin)
    const currentReal = Number(row?.real_downloads_count || 0);
    const nextReal = currentReal + 1;

    // Compteur public / Effet de masse
    let currentDisplay = Number(row?.display_plays_count || 0);
    if (currentDisplay <= 0) {
      // Calcul du seed de base si non encore configuré pour conserver la crédibilité publique
      const seed = bookId ? Math.abs(bookId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) : 120;
      currentDisplay = (seed % 350) + 48;
    }
    const nextDisplay = currentDisplay + 1;

    // 3. Mettre à jour de manière atomique dans Cloudflare D1
    await env.DB.prepare(`
      UPDATE audiobooks 
      SET display_plays_count = ?, 
          downloads_count = ?,
          real_downloads_count = ?
      WHERE id = ?
    `).bind(nextDisplay, nextDisplay, nextReal, bookId).run().catch(async () => {
      // Fallback au cas où une colonne spécifique poserait problème
      await env.DB.prepare('UPDATE audiobooks SET display_plays_count = ? WHERE id = ?').bind(nextDisplay, bookId).run().catch(() => {});
      await env.DB.prepare('UPDATE audiobooks SET real_downloads_count = ? WHERE id = ?').bind(nextReal, bookId).run().catch(() => {});
    });

    // 4. Invalider les caches KV complets (audiobooks, ebooks, podcasts, et par livre)
    if (env.KV_BINDING) {
      const keys = [
        'books_all_all_false', 'books_all_all_true',
        'books_all_audiobook_false', 'books_all_audiobook_true',
        'books_all_ebook_false', 'books_all_ebook_true',
        'books_all_podcast_false', 'books_all_podcast_true',
        `book_${bookId}`
      ];
      for (const key of keys) {
        await env.KV_BINDING.delete(key).catch(() => {});
      }
    }

    return new Response(JSON.stringify({
      success: true,
      id: bookId,
      downloads_count: nextDisplay,
      display_plays_count: nextDisplay,
      real_downloads_count: nextReal
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    console.error('[handleIncrementDownloads] Erreur:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

