/**
 * src/services/api/artistApi.js
 * 
 * Module API client pour les profils et discographies d'artistes (Architecture AGENTS.md)
 * Gère la communication avec /api/artists, le cache local et les données de démonstration par défaut.
 */

export const DEFAULT_ARTIST_VICTOIRE_K = {
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

const STORAGE_KEY = 'rg_artists_cache';

function getLocalArtists() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  return [DEFAULT_ARTIST_VICTOIRE_K];
}

function saveLocalArtists(artists) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(artists));
  } catch (_) {}
}

export const artistApi = {
  /**
   * Récupère la liste complète des artistes
   */
  async getArtists() {
    try {
      const res = await fetch('/api/artists');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          saveLocalArtists(data);
          return data;
        }
      }
    } catch (_) {}
    return getLocalArtists();
  },

  /**
   * Récupère un profil d'artiste par son slug unique (ex: "victoireK")
   */
  async getArtistBySlug(slug) {
    if (!slug) return null;
    const cleanSlug = slug.trim().toLowerCase();

    // 1. Essai réseau Edge
    try {
      const res = await fetch(`/api/artists/${encodeURIComponent(cleanSlug)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.name) return data;
      }
    } catch (_) {}

    // 2. Recherche dans le cache local
    const local = getLocalArtists();
    const found = local.find(a => a.slug?.toLowerCase() === cleanSlug);
    if (found) return found;

    // 3. Fallback victoireK
    if (cleanSlug === 'victoirek' || cleanSlug === 'victoire') {
      return DEFAULT_ARTIST_VICTOIRE_K;
    }

    return null;
  },

  /**
   * Sauvegarde ou met à jour un profil d'artiste
   */
  async saveArtist(artistData) {
    const id = artistData.id || `art-${Date.now().toString(36)}`;
    const fullData = { ...artistData, id };

    // Sauvegarde locale instantanée
    const local = getLocalArtists();
    const idx = local.findIndex(a => a.id === id || a.slug?.toLowerCase() === fullData.slug?.toLowerCase());
    if (idx >= 0) {
      local[idx] = fullData;
    } else {
      local.unshift(fullData);
    }
    saveLocalArtists(local);
    window.dispatchEvent(new CustomEvent('rg:artist-saved', { detail: fullData }));

    // Synchronisation Edge Cloudflare
    try {
      const res = await fetch('/api/artists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullData),
      });
      if (res.ok) {
        const saved = await res.json();
        return saved.artist || fullData;
      }
    } catch (_) {}

    return fullData;
  },

  /**
   * Supprime un artiste
   */
  async deleteArtist(id) {
    const local = getLocalArtists().filter(a => a.id !== id && a.slug !== id);
    saveLocalArtists(local);
    window.dispatchEvent(new CustomEvent('rg:artist-deleted', { detail: { id } }));

    try {
      await fetch(`/api/artists/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (_) {}

    return true;
  }
};
