/**
 * functions/api/handlers/artists.js
 * 
 * Gestionnaire modulaire RG Play pour les Pages Artistes & Discographies (Architecture AGENTS.md) :
 * - Gestion persistante dans Cloudflare D1 (table artists)
 * - Création, modification, consultation et suppression des profils artistes
 * - Stockage structuré des albums et morceaux (JSON)
 * - Rendu haute performance compatible Cloudflare Edge
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
 * Initialisation de la table artists dans Cloudflare D1
 */
async function ensureArtistsTable(db) {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS artists (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        bio TEXT,
        photo_url TEXT,
        cover_url TEXT,
        albums_json TEXT,
        tracks_json TEXT,
        social_links_json TEXT,
        is_verified INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (_) {}
}

// Profil par défaut pour "victoireK"
export const DEFAULT_VICTOIRE_K = {
  id: 'art-victoirek',
  slug: 'victoireK',
  name: 'Victoire K',
  tagline: 'Artiste Chanteuse & Auteure-Compositrice',
  bio: "Chanteuse d'Adoration & Voix Céleste. Découvrez l'intégralité de sa discographie, ses albums live et ses singles en streaming Studio HD.",
  photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
  cover_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1600&q=80',
  is_verified: true,
  albums: [
    {
      id: 'alb-grace-infinie',
      title: 'Grâce Infinie',
      type: 'album',
      year: '2026',
      cover_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      track_count: 4,
    },
    {
      id: 'alb-symphonie-celeste',
      title: 'Symphonie Céleste',
      type: 'album',
      year: '2025',
      cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80',
      track_count: 3,
    },
    {
      id: 'alb-singles-2026',
      title: 'Singles & Inédits',
      type: 'single',
      year: '2026',
      cover_url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=400&q=80',
      track_count: 2,
    }
  ],
  tracks: [
    {
      id: 'trk-born-to-die',
      title: 'Born To Die',
      artist: 'Victoire K',
      album: 'Grâce Infinie',
      album_id: 'alb-grace-infinie',
      duration: '03:45',
      duration_seconds: 225,
      cover_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      audio_url: 'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/no_curator/Tours/Enthusiast/Tours_-_01_-_Enthusiast.mp3',
      plays_count: 14200,
      is_favorite: true,
    },
    {
      id: 'trk-victoire-eternelle',
      title: 'Victoire Éternelle',
      artist: 'Victoire K',
      album: 'Grâce Infinie',
      album_id: 'alb-grace-infinie',
      duration: '04:12',
      duration_seconds: 252,
      cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80',
      audio_url: 'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/ccCommunity/Kai_Engel/Sollers/Kai_Engel_-_04_-_Sentinel.mp3',
      plays_count: 9840,
      is_favorite: true,
    },
    {
      id: 'trk-source-de-vie',
      title: 'Source de Vie',
      artist: 'Victoire K',
      album: 'Grâce Infinie',
      album_id: 'alb-grace-infinie',
      duration: '03:30',
      duration_seconds: 210,
      cover_url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=400&q=80',
      audio_url: 'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/no_curator/Tours/Enthusiast/Tours_-_01_-_Enthusiast.mp3',
      plays_count: 8120,
    },
    {
      id: 'trk-lumiere-celeste',
      title: 'Lumière Céleste',
      artist: 'Victoire K',
      album: 'Grâce Infinie',
      album_id: 'alb-grace-infinie',
      duration: '04:05',
      duration_seconds: 245,
      cover_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=400&q=80',
      audio_url: 'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/ccCommunity/Kai_Engel/Sollers/Kai_Engel_-_04_-_Sentinel.mp3',
      plays_count: 7350,
    },
    {
      id: 'trk-eclat-de-gloire',
      title: 'Éclat de Gloire',
      artist: 'Victoire K',
      album: 'Symphonie Céleste',
      album_id: 'alb-symphonie-celeste',
      duration: '03:52',
      duration_seconds: 232,
      cover_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
      audio_url: 'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/no_curator/Tours/Enthusiast/Tours_-_01_-_Enthusiast.mp3',
      plays_count: 11200,
    },
    {
      id: 'trk-mon-esperance',
      title: 'Mon Espérance',
      artist: 'Victoire K',
      album: 'Symphonie Céleste',
      album_id: 'alb-symphonie-celeste',
      duration: '04:30',
      duration_seconds: 270,
      cover_url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=400&q=80',
      audio_url: 'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/ccCommunity/Kai_Engel/Sollers/Kai_Engel_-_04_-_Sentinel.mp3',
      plays_count: 6540,
    },
    {
      id: 'trk-reconnaissance',
      title: 'Reconnaissance (Single)',
      artist: 'Victoire K',
      album: 'Singles & Inédits',
      album_id: 'alb-singles-2026',
      duration: '03:15',
      duration_seconds: 195,
      cover_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      audio_url: 'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/no_curator/Tours/Enthusiast/Tours_-_01_-_Enthusiast.mp3',
      plays_count: 15300,
      is_favorite: true,
    }
  ]
};

/**
 * GET /api/artists ou GET /api/artists/:slugOrId
 */
export async function handleGetArtists(request, env, corsHeaders, slugOrId = null) {
  if (!env.DB) {
    if (slugOrId) {
      const match = slugOrId.toLowerCase() === DEFAULT_VICTOIRE_K.slug.toLowerCase();
      return jsonResponse(match ? DEFAULT_VICTOIRE_K : null, corsHeaders, match ? 200 : 404);
    }
    return jsonResponse([DEFAULT_VICTOIRE_K], corsHeaders);
  }

  try {
    await ensureArtistsTable(env.DB);

    if (slugOrId) {
      const row = await env.DB.prepare(`
        SELECT * FROM artists WHERE LOWER(slug) = LOWER(?) OR id = ?
      `).bind(slugOrId, slugOrId).first().catch(() => null);

      if (!row) {
        if (slugOrId.toLowerCase() === DEFAULT_VICTOIRE_K.slug.toLowerCase()) {
          return jsonResponse(DEFAULT_VICTOIRE_K, corsHeaders);
        }
        return jsonResponse({ error: 'Artiste introuvable' }, corsHeaders, 404);
      }

      const artist = {
        ...row,
        albums: row.albums_json ? JSON.parse(row.albums_json) : [],
        tracks: row.tracks_json ? JSON.parse(row.tracks_json) : [],
        social_links: row.social_links_json ? JSON.parse(row.social_links_json) : {},
      };
      return jsonResponse(artist, corsHeaders);
    }

    const { results } = await env.DB.prepare(`
      SELECT * FROM artists ORDER BY created_at DESC
    `).all().catch(() => ({ results: [] }));

    let list = (results || []).map(r => ({
      ...r,
      albums: r.albums_json ? JSON.parse(r.albums_json) : [],
      tracks: r.tracks_json ? JSON.parse(r.tracks_json) : [],
    }));

    if (!list.some(a => a.slug.toLowerCase() === DEFAULT_VICTOIRE_K.slug.toLowerCase())) {
      list.unshift(DEFAULT_VICTOIRE_K);
    }

    return jsonResponse(list, corsHeaders);
  } catch (err) {
    console.error('[Artists Handler] Erreur lecture:', err);
    return jsonResponse([DEFAULT_VICTOIRE_K], corsHeaders);
  }
}

/**
 * POST /api/artists (Création ou mise à jour)
 */
export async function handleSaveArtist(request, env, corsHeaders) {
  try {
    const data = await request.json();
    if (!data.name || !data.slug) {
      return jsonResponse({ error: 'Le nom et le slug sont obligatoires' }, corsHeaders, 400);
    }

    const id = data.id || `art-${Date.now().toString(36)}`;
    const slug = data.slug.trim().toLowerCase();
    const name = data.name.trim();
    const bio = data.bio || '';
    const photo_url = data.photo_url || '';
    const cover_url = data.cover_url || '';
    const albums_json = JSON.stringify(data.albums || []);
    const tracks_json = JSON.stringify(data.tracks || []);
    const social_links_json = JSON.stringify(data.social_links || {});

    if (env.DB) {
      await ensureArtistsTable(env.DB);
      await env.DB.prepare(`
        INSERT INTO artists (id, slug, name, bio, photo_url, cover_url, albums_json, tracks_json, social_links_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          slug = excluded.slug,
          name = excluded.name,
          bio = excluded.bio,
          photo_url = excluded.photo_url,
          cover_url = excluded.cover_url,
          albums_json = excluded.albums_json,
          tracks_json = excluded.tracks_json,
          social_links_json = excluded.social_links_json,
          updated_at = CURRENT_TIMESTAMP
      `).bind(id, slug, name, bio, photo_url, cover_url, albums_json, tracks_json, social_links_json).run();
    }

    return jsonResponse({
      success: true,
      artist: {
        id,
        slug,
        name,
        bio,
        photo_url,
        cover_url,
        albums: data.albums || [],
        tracks: data.tracks || [],
        social_links: data.social_links || {}
      }
    }, corsHeaders);
  } catch (err) {
    console.error('[Artists Handler] Erreur sauvegarde:', err);
    return jsonResponse({ error: err.message }, corsHeaders, 500);
  }
}

/**
 * DELETE /api/artists/:id
 */
export async function handleDeleteArtist(request, env, corsHeaders, id) {
  if (!id) {
    return jsonResponse({ error: 'ID requis' }, corsHeaders, 400);
  }
  if (env.DB) {
    try {
      await ensureArtistsTable(env.DB);
      await env.DB.prepare('DELETE FROM artists WHERE id = ? OR slug = ?').bind(id, id).run();
    } catch (e) {
      console.warn('[Artists Handler] Erreur delete:', e);
    }
  }
  return jsonResponse({ success: true, deletedId: id }, corsHeaders);
}
