PRAGMA foreign_keys = OFF;

DELETE FROM user_progress WHERE audiobook_id IN ('book-1','book-2','book-3','book-4','book-5','book-6','book-7','book-8','book-1787932983991','book-1787985275565','pod-1','pod-2','mus-1','mus-2','mc-1');
DELETE FROM bookmarks WHERE audiobook_id IN ('book-1','book-2','book-3','book-4','book-5','book-6','book-7','book-8','book-1787932983991','book-1787985275565','pod-1','pod-2','mus-1','mus-2','mc-1');
DELETE FROM reviews WHERE audiobook_id IN ('book-1','book-2','book-3','book-4','book-5','book-6','book-7','book-8','book-1787932983991','book-1787985275565','pod-1','pod-2','mus-1','mus-2','mc-1');
DELETE FROM purchases WHERE audiobook_id IN ('book-1','book-2','book-3','book-4','book-5','book-6','book-7','book-8','book-1787932983991','book-1787985275565','pod-1','pod-2','mus-1','mus-2','mc-1');
DELETE FROM chapters WHERE audiobook_id IN ('book-1','book-2','book-3','book-4','book-5','book-6','book-7','book-8','book-1787932983991','book-1787985275565','pod-1','pod-2','mus-1','mus-2','mc-1');
DELETE FROM audiobooks WHERE id IN ('book-1','book-2','book-3','book-4','book-5','book-6','book-7','book-8','book-1787932983991','book-1787985275565','pod-1','pod-2','mus-1','mus-2','mc-1');

-- Insertion permanente dans deleted_books
INSERT OR IGNORE INTO deleted_books (id) VALUES 
('book-1'), ('book-2'), ('book-3'), ('book-4'), ('book-5'), ('book-6'), ('book-7'), ('book-8'), 
('book-1787932983991'), ('book-1787985275565'), 
('pod-1'), ('pod-2'), ('mus-1'), ('mus-2'), ('mc-1');

PRAGMA foreign_keys = ON;
