/**
 * functions/api/handlers/artists.js
 * 
 * Gestionnaire modulaire RG Play pour les Pages Artistes & Discographies (Architecture AGENTS.md) :
 * - Gestion persistante dans Cloudflare D1 (table artists)
 * - Création, modification, consultation et suppression des profils artistes
 * - Stockage dynamique des albums et morceaux
 * - Rendu haute performance compatible Cloudflare Edge (< 400 lignes)
 */

import { DEFAULT_VICTOIRE_K } from './artistDefaults.js';

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
        INSERT INTO artists (id, slug, name, bio, photo_url, cover_url, albums_json, tracks_json, social_links_json, is_verified, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(slug) DO UPDATE SET
          name = excluded.name,
          bio = excluded.bio,
          photo_url = excluded.photo_url,
          cover_url = excluded.cover_url,
          albums_json = excluded.albums_json,
          tracks_json = excluded.tracks_json,
          social_links_json = excluded.social_links_json,
          is_verified = excluded.is_verified,
          updated_at = CURRENT_TIMESTAMP
      `).bind(id, slug, name, bio, photo_url, cover_url, albums_json, tracks_json, social_links_json, data.is_verified ? 1 : 0).run();
    }

    return jsonResponse({
      success: true,
      id,
      slug,
      name,
      message: 'Artiste et morceaux enregistrés avec succès dans Cloudflare D1'
    }, corsHeaders);
  } catch (err) {
    console.error('[Artists Handler] Erreur enregistrement:', err);
    return jsonResponse({ error: err.message }, corsHeaders, 500);
  }
}

/**
 * DELETE /api/artists/:id
 */
export async function handleDeleteArtist(request, env, corsHeaders, id) {
  if (!env.DB) {
    return jsonResponse({ success: true }, corsHeaders);
  }

  try {
    await env.DB.prepare(`DELETE FROM artists WHERE id = ? OR slug = ?`).bind(id, id).run();
    return jsonResponse({ success: true, message: 'Artiste supprimé' }, corsHeaders);
  } catch (err) {
    return jsonResponse({ error: err.message }, corsHeaders, 500);
  }
}
