
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
);

INSERT INTO artists (id, slug, name, bio, photo_url, cover_url, albums_json, tracks_json, social_links_json, is_verified, updated_at)
VALUES (
  'art-victoirek',
  'victoireK',
  'Chantre Victoire K',
  'Chantre d''Adoration & Voix Céleste. Retrouvez ici en exclusivité l''ensemble de ses albums et cantiques sacrés : Album Emmanuel, Jésus Nous Sommes Là et Nouveaux Cantiques.',
  '/artists/victoirek/portrait.jpg',
  '/artists/victoirek/cover_emmanuel.jpg',
  '[{"id":"alb-emmanuel","title":"Album Emmanuel","type":"album","year":"2023","cover_url":"/artists/victoirek/cover_emmanuel.jpg","track_count":4},{"id":"alb-jesus-sommes-la","title":"Album Jésus Nous Sommes Là","type":"album","year":"2019","cover_url":"/artists/victoirek/cover_jesus.jpg","track_count":8},{"id":"alb-nouveaux-cantiques","title":"Nouveaux Cantiques & Singles","type":"single","year":"2026","cover_url":"/artists/victoirek/cover_singles.jpg","track_count":5}]',
  '[{"id":"trk-emmanuel","title":"Emmanuel","artist":"Chantre Victoire K","album":"Album Emmanuel","album_id":"alb-emmanuel","duration":"04:38","duration_seconds":278,"cover_url":"/artists/victoirek/cover_emmanuel.jpg","audio_url":"/audios/victoirek/emmanuel.mp3","plays_count":24500,"is_favorite":true},{"id":"trk-adoration-m","title":"Adoration M","artist":"Chantre Victoire K","album":"Album Emmanuel","album_id":"alb-emmanuel","duration":"04:15","duration_seconds":255,"cover_url":"/artists/victoirek/cover_emmanuel.jpg","audio_url":"/audios/victoirek/adoration_m.mp3","plays_count":18200,"is_favorite":true},{"id":"trk-amour-amour","title":"Amour Amour","artist":"Chantre Victoire K","album":"Album Emmanuel","album_id":"alb-emmanuel","duration":"05:12","duration_seconds":312,"cover_url":"/artists/victoirek/cover_emmanuel.jpg","audio_url":"/audios/victoirek/amour_amour.mp3","plays_count":15300},{"id":"trk-le-sang-de-jesus","title":"Le Sang de Jésus","artist":"Chantre Victoire K","album":"Album Emmanuel","album_id":"alb-emmanuel","duration":"04:02","duration_seconds":242,"cover_url":"/artists/victoirek/cover_emmanuel.jpg","audio_url":"/audios/victoirek/le_sang_de_jesus.mp3","plays_count":12900,"is_favorite":true},{"id":"trk-jesus-sommes-la","title":"1. Jésus Nous Sommes Là","artist":"Chantre Victoire K","album":"Album Jésus Nous Sommes Là","album_id":"alb-jesus-sommes-la","duration":"04:10","duration_seconds":250,"cover_url":"/artists/victoirek/cover_jesus.jpg","audio_url":"/audios/victoirek/1-jesus_nous_somme_la.mp3","plays_count":19800,"is_favorite":true},{"id":"trk-tu-es-lagneau","title":"2. Tu Es L''Agneau","artist":"Chantre Victoire K","album":"Album Jésus Nous Sommes Là","album_id":"alb-jesus-sommes-la","duration":"04:30","duration_seconds":270,"cover_url":"/artists/victoirek/cover_jesus.jpg","audio_url":"/audios/victoirek/2-tu_est_lagneau.mp3","plays_count":16400},{"id":"trk-tu-mas-aime","title":"3. Tu M''as Aimé","artist":"Chantre Victoire K","album":"Album Jésus Nous Sommes Là","album_id":"alb-jesus-sommes-la","duration":"04:18","duration_seconds":258,"cover_url":"/artists/victoirek/cover_jesus.jpg","audio_url":"/audios/victoirek/3-tu_mas_aime.mp3","plays_count":14200},{"id":"trk-heureux-toi","title":"4. Heureux-toi","artist":"Chantre Victoire K","album":"Album Jésus Nous Sommes Là","album_id":"alb-jesus-sommes-la","duration":"03:45","duration_seconds":225,"cover_url":"/artists/victoirek/cover_jesus.jpg","audio_url":"/audios/victoirek/4-heureux-toi.mp3","plays_count":11500},{"id":"trk-temps-detresse","title":"5. Le Temps De La Détresse","artist":"Chantre Victoire K","album":"Album Jésus Nous Sommes Là","album_id":"alb-jesus-sommes-la","duration":"03:32","duration_seconds":212,"cover_url":"/artists/victoirek/cover_jesus.jpg","audio_url":"/audios/victoirek/5-le_temps_de_la_detresse.mp3","plays_count":9800},{"id":"trk-eternel","title":"6. Éternel","artist":"Chantre Victoire K","album":"Album Jésus Nous Sommes Là","album_id":"alb-jesus-sommes-la","duration":"05:15","duration_seconds":315,"cover_url":"/artists/victoirek/cover_jesus.jpg","audio_url":"/audios/victoirek/6-eternel.mp3","plays_count":13700},{"id":"trk-reconnaissant","title":"7. Je Te Serais Reconnaissant","artist":"Chantre Victoire K","album":"Album Jésus Nous Sommes Là","album_id":"alb-jesus-sommes-la","duration":"04:52","duration_seconds":292,"cover_url":"/artists/victoirek/cover_jesus.jpg","audio_url":"/audios/victoirek/7-je_te_serais_reconnaissant.mp3","plays_count":17100,"is_favorite":true},{"id":"trk-parole","title":"8. Parole","artist":"Chantre Victoire K","album":"Album Jésus Nous Sommes Là","album_id":"alb-jesus-sommes-la","duration":"06:40","duration_seconds":400,"cover_url":"/artists/victoirek/cover_jesus.jpg","audio_url":"/audios/victoirek/8-parole.mp3","plays_count":8900},{"id":"trk-ce-dieu-attend","title":"Ce Dieu Attend De Moi","artist":"Chantre Victoire K","album":"Nouveaux Cantiques & Singles","album_id":"alb-nouveaux-cantiques","duration":"04:05","duration_seconds":245,"cover_url":"/artists/victoirek/cover_singles.jpg","audio_url":"/audios/victoirek/ce_dieu_attend_de_moi.mp3","plays_count":15600,"is_favorite":true},{"id":"trk-en-jesus-la-victoire","title":"En Jésus J''ai La Victoire","artist":"Chantre Victoire K","album":"Nouveaux Cantiques & Singles","album_id":"alb-nouveaux-cantiques","duration":"03:55","duration_seconds":235,"cover_url":"/artists/victoirek/cover_singles.jpg","audio_url":"/audios/victoirek/en_jesus_jai_la_victoire_m.mp3","plays_count":21300,"is_favorite":true},{"id":"trk-ne-batirais-plus","title":"Je Ne Bâtirais Plus Sur Le Sable","artist":"Chantre Victoire K","album":"Nouveaux Cantiques & Singles","album_id":"alb-nouveaux-cantiques","duration":"03:22","duration_seconds":202,"cover_url":"/artists/victoirek/cover_singles.jpg","audio_url":"/audios/victoirek/je_ne_batirais_plus_sur_le_sable_.mp3","plays_count":12400},{"id":"trk-quand-les-epreuves","title":"Quand Les Épreuves Et Combats","artist":"Chantre Victoire K","album":"Nouveaux Cantiques & Singles","album_id":"alb-nouveaux-cantiques","duration":"03:40","duration_seconds":220,"cover_url":"/artists/victoirek/cover_singles.jpg","audio_url":"/audios/victoirek/quand_les_epreuves_et_combats_1.mp3","plays_count":10800},{"id":"trk-victoire-k-3","title":"Victoire K - Cantique 3","artist":"Chantre Victoire K","album":"Nouveaux Cantiques & Singles","album_id":"alb-nouveaux-cantiques","duration":"03:05","duration_seconds":185,"cover_url":"/artists/victoirek/cover_singles.jpg","audio_url":"/audios/victoirek/victoire_k_3.mp3","plays_count":8900}]',
  '{"youtube":"https://youtube.com","facebook":"https://facebook.com","whatsapp":"https://wa.me/24100000000"}',
  1,
  CURRENT_TIMESTAMP
)
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  bio = excluded.bio,
  photo_url = excluded.photo_url,
  cover_url = excluded.cover_url,
  albums_json = excluded.albums_json,
  tracks_json = excluded.tracks_json,
  social_links_json = excluded.social_links_json,
  is_verified = excluded.is_verified,
  updated_at = CURRENT_TIMESTAMP;
