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
 * Conserve la base sociale / seed si le compteur initial était à 0.
 */
export async function handleIncrementDownloads(request, env, corsHeaders, bookId) {
  if (!bookId) {
    return new Response(JSON.stringify({ error: 'ID du livre manquant' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ success: true, id: bookId, incremented: 1, note: 'Simulation sans D1' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    // 1. Lire le nombre actuel pour préserver la valeur maximale enregistrée
    const row = await env.DB.prepare(
      'SELECT id, display_plays_count, downloads_count FROM audiobooks WHERE id = ?'
    ).bind(bookId).first();

    let current = Math.max(Number(row?.downloads_count || 0), Number(row?.display_plays_count || 0));
    if (current <= 0) {
      // Calcul du seed de base pour éviter de repartir de 1
      const seed = bookId ? Math.abs(bookId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) : 120;
      current = (seed % 350) + 48;
    }
    const nextCount = current + 1;

    // 2. Mettre à jour dans Cloudflare D1 (display_plays_count ET downloads_count de manière synchrone)
    await env.DB.prepare(
      'UPDATE audiobooks SET display_plays_count = ?, downloads_count = ? WHERE id = ?'
    ).bind(nextCount, nextCount, bookId).run().catch(async () => {
      await env.DB.prepare('UPDATE audiobooks SET display_plays_count = ? WHERE id = ?').bind(nextCount, bookId).run().catch(() => {});
      await env.DB.prepare('UPDATE audiobooks SET downloads_count = ? WHERE id = ?').bind(nextCount, bookId).run().catch(() => {});
    });

    // 3. Invalider les caches KV complets (audiobooks, ebooks, podcasts)
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
      downloads_count: nextCount,
      display_plays_count: nextCount
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

