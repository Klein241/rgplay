/**
 * src/services/api/artistApi.js
 * 
 * Module API client isolé pour les profils et discographies d'artistes.
 * Entièrement autonome pour ne pas alourdir le reste de l'application.
 */

export const DEFAULT_ARTIST_VICTOIRE_K = {
  id: 'art-victoirek',
  slug: 'victoireK',
  name: 'Chantre Victoire K',
  tagline: 'Artiste Chanteuse & Chantre de l\'Éternel',
  bio: "Chantre d'Adoration & Voix Céleste. Retrouvez ici en exclusivité l'ensemble de ses albums et cantiques sacrés : Album Emmanuel, Jésus Nous Sommes Là et Nouveaux Cantiques.",
  photo_url: '/artists/victoirek/portrait.jpg',
  cover_url: '/artists/victoirek/cover_emmanuel.jpg',
  is_verified: true,
  albums: [
    {
      id: 'alb-emmanuel',
      title: 'Album Emmanuel',
      type: 'album',
      year: '2023',
      cover_url: '/artists/victoirek/cover_emmanuel.jpg',
      track_count: 4,
    },
    {
      id: 'alb-jesus-sommes-la',
      title: 'Album Jésus Nous Sommes Là',
      type: 'album',
      year: '2019',
      cover_url: '/artists/victoirek/cover_jesus.jpg',
      track_count: 8,
    },
    {
      id: 'alb-nouveaux-cantiques',
      title: 'Nouveaux Cantiques & Singles',
      type: 'single',
      year: '2026',
      cover_url: '/artists/victoirek/cover_singles.jpg',
      track_count: 5,
    }
  ],
  tracks: [
    // ── ALBUM EMMANUEL ──
    {
      id: 'trk-emmanuel',
      title: 'Emmanuel',
      artist: 'Chantre Victoire K',
      album: 'Album Emmanuel',
      album_id: 'alb-emmanuel',
      duration: '04:38',
      duration_seconds: 278,
      cover_url: '/artists/victoirek/cover_emmanuel.jpg',
      audio_url: '/audios/victoirek/emmanuel.mp3',
      plays_count: 24500,
      is_favorite: true,
    },
    {
      id: 'trk-adoration-m',
      title: 'Adoration M',
      artist: 'Chantre Victoire K',
      album: 'Album Emmanuel',
      album_id: 'alb-emmanuel',
      duration: '04:15',
      duration_seconds: 255,
      cover_url: '/artists/victoirek/cover_emmanuel.jpg',
      audio_url: '/audios/victoirek/adoration_m.mp3',
      plays_count: 18200,
      is_favorite: true,
    },
    {
      id: 'trk-amour-amour',
      title: 'Amour Amour',
      artist: 'Chantre Victoire K',
      album: 'Album Emmanuel',
      album_id: 'alb-emmanuel',
      duration: '05:12',
      duration_seconds: 312,
      cover_url: '/artists/victoirek/cover_emmanuel.jpg',
      audio_url: '/audios/victoirek/amour_amour.mp3',
      plays_count: 15300,
    },
    {
      id: 'trk-le-sang-de-jesus',
      title: 'Le Sang de Jésus',
      artist: 'Chantre Victoire K',
      album: 'Album Emmanuel',
      album_id: 'alb-emmanuel',
      duration: '04:02',
      duration_seconds: 242,
      cover_url: '/artists/victoirek/cover_emmanuel.jpg',
      audio_url: '/audios/victoirek/le_sang_de_jesus.mp3',
      plays_count: 12900,
      is_favorite: true,
    },

    // ── ALBUM JÉSUS NOUS SOMMES LÀ ──
    {
      id: 'trk-jesus-sommes-la',
      title: '1. Jésus Nous Sommes Là',
      artist: 'Chantre Victoire K',
      album: 'Album Jésus Nous Sommes Là',
      album_id: 'alb-jesus-sommes-la',
      duration: '04:10',
      duration_seconds: 250,
      cover_url: '/artists/victoirek/cover_jesus.jpg',
      audio_url: '/audios/victoirek/1-jesus_nous_somme_la.mp3',
      plays_count: 19800,
      is_favorite: true,
    },
    {
      id: 'trk-tu-es-lagneau',
      title: "2. Tu Es L'Agneau",
      artist: 'Chantre Victoire K',
      album: 'Album Jésus Nous Sommes Là',
      album_id: 'alb-jesus-sommes-la',
      duration: '04:30',
      duration_seconds: 270,
      cover_url: '/artists/victoirek/cover_jesus.jpg',
      audio_url: '/audios/victoirek/2-tu_est_lagneau.mp3',
      plays_count: 16400,
    },
    {
      id: 'trk-tu-mas-aime',
      title: "3. Tu M'as Aimé",
      artist: 'Chantre Victoire K',
      album: 'Album Jésus Nous Sommes Là',
      album_id: 'alb-jesus-sommes-la',
      duration: '04:18',
      duration_seconds: 258,
      cover_url: '/artists/victoirek/cover_jesus.jpg',
      audio_url: '/audios/victoirek/3-tu_mas_aime.mp3',
      plays_count: 14200,
    },
    {
      id: 'trk-heureux-toi',
      title: '4. Heureux-toi',
      artist: 'Chantre Victoire K',
      album: 'Album Jésus Nous Sommes Là',
      album_id: 'alb-jesus-sommes-la',
      duration: '03:45',
      duration_seconds: 225,
      cover_url: '/artists/victoirek/cover_jesus.jpg',
      audio_url: '/audios/victoirek/4-heureux-toi.mp3',
      plays_count: 11500,
    },
    {
      id: 'trk-temps-detresse',
      title: '5. Le Temps De La Détresse',
      artist: 'Chantre Victoire K',
      album: 'Album Jésus Nous Sommes Là',
      album_id: 'alb-jesus-sommes-la',
      duration: '03:32',
      duration_seconds: 212,
      cover_url: '/artists/victoirek/cover_jesus.jpg',
      audio_url: '/audios/victoirek/5-le_temps_de_la_detresse.mp3',
      plays_count: 9800,
    },
    {
      id: 'trk-eternel',
      title: '6. Éternel',
      artist: 'Chantre Victoire K',
      album: 'Album Jésus Nous Sommes Là',
      album_id: 'alb-jesus-sommes-la',
      duration: '05:15',
      duration_seconds: 315,
      cover_url: '/artists/victoirek/cover_jesus.jpg',
      audio_url: '/audios/victoirek/6-eternel.mp3',
      plays_count: 13700,
    },
    {
      id: 'trk-reconnaissant',
      title: '7. Je Te Serais Reconnaissant',
      artist: 'Chantre Victoire K',
      album: 'Album Jésus Nous Sommes Là',
      album_id: 'alb-jesus-sommes-la',
      duration: '04:52',
      duration_seconds: 292,
      cover_url: '/artists/victoirek/cover_jesus.jpg',
      audio_url: '/audios/victoirek/7-je_te_serais_reconnaissant.mp3',
      plays_count: 17100,
      is_favorite: true,
    },
    {
      id: 'trk-parole',
      title: '8. Parole',
      artist: 'Chantre Victoire K',
      album: 'Album Jésus Nous Sommes Là',
      album_id: 'alb-jesus-sommes-la',
      duration: '06:40',
      duration_seconds: 400,
      cover_url: '/artists/victoirek/cover_jesus.jpg',
      audio_url: '/audios/victoirek/8-parole.mp3',
      plays_count: 8900,
    },

    // ── NOUVEAUX CANTIQUES & SINGLES ──
    {
      id: 'trk-ce-dieu-attend',
      title: 'Ce Dieu Attend De Moi',
      artist: 'Chantre Victoire K',
      album: 'Nouveaux Cantiques & Singles',
      album_id: 'alb-nouveaux-cantiques',
      duration: '03:20',
      duration_seconds: 200,
      cover_url: '/artists/victoirek/cover_singles.jpg',
      audio_url: '/audios/victoirek/ce_dieu_attend_de_moi.mp3',
      plays_count: 22100,
      is_favorite: true,
    },
    {
      id: 'trk-en-jesus-la-victoire',
      title: "En Jésus J'ai La Victoire",
      artist: 'Chantre Victoire K',
      album: 'Nouveaux Cantiques & Singles',
      album_id: 'alb-nouveaux-cantiques',
      duration: '03:55',
      duration_seconds: 235,
      cover_url: '/artists/victoirek/cover_singles.jpg',
      audio_url: '/audios/victoirek/en_jesus_jai_la_victoire_m.mp3',
      plays_count: 28400,
      is_favorite: true,
    },
    {
      id: 'trk-sur-le-sable',
      title: 'Je Ne Bâtirai Plus Sur Le Sable',
      artist: 'Chantre Victoire K',
      album: 'Nouveaux Cantiques & Singles',
      album_id: 'alb-nouveaux-cantiques',
      duration: '04:05',
      duration_seconds: 245,
      cover_url: '/artists/victoirek/cover_singles.jpg',
      audio_url: '/audios/victoirek/je_ne_batirais_plus_sur_le_sable_.mp3',
      plays_count: 19500,
    },
    {
      id: 'trk-epreuves-combats',
      title: 'Quand Les Épreuves Et Combats',
      artist: 'Chantre Victoire K',
      album: 'Nouveaux Cantiques & Singles',
      album_id: 'alb-nouveaux-cantiques',
      duration: '04:25',
      duration_seconds: 265,
      cover_url: '/artists/victoirek/cover_singles.jpg',
      audio_url: '/audios/victoirek/quand_les_epreuves_et_combats_1.mp3',
      plays_count: 16700,
    },
    {
      id: 'trk-victoire-k-3',
      title: 'Victoire K (Inédit)',
      artist: 'Chantre Victoire K',
      album: 'Nouveaux Cantiques & Singles',
      album_id: 'alb-nouveaux-cantiques',
      duration: '03:42',
      duration_seconds: 222,
      cover_url: '/artists/victoirek/cover_singles.jpg',
      audio_url: '/audios/victoirek/victoire_k_3.mp3',
      plays_count: 14300,
    }
  ]
};

const STORAGE_KEY = 'rg_artists_cache_v2';

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

  async getArtistBySlug(slug) {
    if (!slug) return DEFAULT_ARTIST_VICTOIRE_K;
    const cleanSlug = slug.trim().toLowerCase();

    // 1. Récupération dynamique depuis la base de données Cloudflare D1 via l'API
    try {
      const res = await fetch(`/api/artists/${encodeURIComponent(cleanSlug)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.name && Array.isArray(data.tracks) && data.tracks.length > 0) {
          const local = getLocalArtists();
          const idx = local.findIndex(a => a.slug?.toLowerCase() === cleanSlug || a.id === data.id);
          if (idx >= 0) local[idx] = data;
          else local.unshift(data);
          saveLocalArtists(local);
          return data;
        }
      }
    } catch (_) {}

    // 2. Fallback cache local si hors-ligne
    const local = getLocalArtists();
    const found = local.find(a => a.slug?.toLowerCase() === cleanSlug);
    if (found) return found;

    // 3. Fallback par défaut
    return DEFAULT_ARTIST_VICTOIRE_K;
  },

  async saveArtist(artistData) {
    const id = artistData.id || `art-${Date.now().toString(36)}`;
    const fullData = { ...artistData, id };

    const local = getLocalArtists();
    const idx = local.findIndex(a => a.id === id || a.slug?.toLowerCase() === fullData.slug?.toLowerCase());
    if (idx >= 0) {
      local[idx] = fullData;
    } else {
      local.unshift(fullData);
    }
    saveLocalArtists(local);
    window.dispatchEvent(new CustomEvent('rg:artist-saved', { detail: fullData }));

    try {
      await fetch('/api/artists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullData),
      });
    } catch (_) {}

    return fullData;
  },

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
