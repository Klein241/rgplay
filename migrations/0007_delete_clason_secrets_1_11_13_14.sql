-- Migration : Suppression des Secrets 1, 11, 13, 14 de George S. Clason
-- IDs identifiés : rgplay-babylon-secret-01-fixed, rgplay-babylon-secret-11, rgplay-babylon-secret-13, rgplay-babylon-secret-14-fixed

-- 1. Supprimer les chapitres liés
DELETE FROM chapters WHERE audiobook_id IN (
  'rgplay-babylon-secret-01-fixed',
  'rgplay-babylon-secret-11',
  'rgplay-babylon-secret-13',
  'rgplay-babylon-secret-14-fixed'
);

-- 2. Supprimer les reviews liées
DELETE FROM reviews WHERE audiobook_id IN (
  'rgplay-babylon-secret-01-fixed',
  'rgplay-babylon-secret-11',
  'rgplay-babylon-secret-13',
  'rgplay-babylon-secret-14-fixed'
);

-- 3. Supprimer les bookmarks liés
DELETE FROM bookmarks WHERE audiobook_id IN (
  'rgplay-babylon-secret-01-fixed',
  'rgplay-babylon-secret-11',
  'rgplay-babylon-secret-13',
  'rgplay-babylon-secret-14-fixed'
);

-- 4. Supprimer la progression liée
DELETE FROM user_progress WHERE audiobook_id IN (
  'rgplay-babylon-secret-01-fixed',
  'rgplay-babylon-secret-11',
  'rgplay-babylon-secret-13',
  'rgplay-babylon-secret-14-fixed'
);

-- 5. Supprimer les achats liés
DELETE FROM purchases WHERE audiobook_id IN (
  'rgplay-babylon-secret-01-fixed',
  'rgplay-babylon-secret-11',
  'rgplay-babylon-secret-13',
  'rgplay-babylon-secret-14-fixed'
);

-- 6. Supprimer les livres eux-mêmes
DELETE FROM audiobooks WHERE id IN (
  'rgplay-babylon-secret-01-fixed',
  'rgplay-babylon-secret-11',
  'rgplay-babylon-secret-13',
  'rgplay-babylon-secret-14-fixed'
);

-- 7. Enregistrer dans deleted_books pour propager aux clients
INSERT OR IGNORE INTO deleted_books (id) VALUES
  ('rgplay-babylon-secret-01-fixed'),
  ('rgplay-babylon-secret-11'),
  ('rgplay-babylon-secret-13'),
  ('rgplay-babylon-secret-14-fixed');
