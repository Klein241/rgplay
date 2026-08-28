-- Migration Cloudflare D1 : Initialisation du Schéma RG Play Audiobooks

-- 1. Table des Catégories
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT,
    color TEXT,
    display_order INTEGER DEFAULT 0
);

-- 2. Table des Livres Audio (Audiobooks)
CREATE TABLE IF NOT EXISTS audiobooks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    narrator TEXT NOT NULL,
    description TEXT NOT NULL,
    synopsis TEXT,
    cover_r2_key TEXT,
    cover_url TEXT NOT NULL,
    preview_r2_key TEXT,
    preview_url TEXT,
    category_id TEXT NOT NULL REFERENCES categories(id),
    price REAL NOT NULL, -- Prix en FCFA (XAF) ou devise de base
    price_eur REAL,
    discount_price REAL,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    language TEXT DEFAULT 'fr',
    rating REAL DEFAULT 4.8,
    rating_count INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT 0,
    is_bestseller BOOLEAN DEFAULT 0,
    is_free_for_members BOOLEAN DEFAULT 0,
    release_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table des Chapitres (Chapters)
CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    audiobook_id TEXT NOT NULL REFERENCES audiobooks(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    audio_r2_key TEXT NOT NULL, -- Clé dans le bucket R2 Cloudflare
    audio_url TEXT,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Table des Utilisateurs (Users)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    wallet_balance REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Table des Achats & Abonnements (Purchases)
CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    audiobook_id TEXT NOT NULL REFERENCES audiobooks(id),
    amount_paid REAL NOT NULL,
    currency TEXT DEFAULT 'XAF',
    payment_method TEXT NOT NULL, -- 'camerpay_om', 'camerpay_momo', 'card', 'wallet'
    transaction_id TEXT,
    status TEXT DEFAULT 'completed', -- 'pending', 'completed', 'failed'
    purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, audiobook_id)
);

-- 6. Table de Suivi de la Progression d'Écoute (User Progress)
CREATE TABLE IF NOT EXISTS user_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    audiobook_id TEXT NOT NULL REFERENCES audiobooks(id),
    current_chapter_id TEXT REFERENCES chapters(id),
    position_seconds REAL DEFAULT 0,
    completed_percentage REAL DEFAULT 0,
    is_completed BOOLEAN DEFAULT 0,
    is_favorite BOOLEAN DEFAULT 0,
    last_listened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, audiobook_id)
);

-- 7. Table des Signets & Notes Personnalisées (Bookmarks)
CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    audiobook_id TEXT NOT NULL REFERENCES audiobooks(id),
    chapter_id TEXT REFERENCES chapters(id),
    timestamp_seconds REAL NOT NULL,
    title TEXT,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Table des Avis & Commentaires (Reviews)
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    audiobook_id TEXT NOT NULL REFERENCES audiobooks(id),
    rating INTEGER CHECK(rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index pour optimiser les performances de requêtes Cloudflare D1
CREATE INDEX IF NOT EXISTS idx_audiobooks_category ON audiobooks(category_id);
CREATE INDEX IF NOT EXISTS idx_audiobooks_featured ON audiobooks(is_featured);
CREATE INDEX IF NOT EXISTS idx_chapters_audiobook ON chapters(audiobook_id, chapter_number);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id, audiobook_id);

-- =========================================================================
-- SEED DATA : Catégories et Livres Audio Initiaux
-- =========================================================================

INSERT OR IGNORE INTO categories (id, name, slug, icon, color, display_order) VALUES
('cat-1', 'Business & Finance', 'business-finance', 'TrendingUp', '#9d4edd', 1),
('cat-2', 'Développement Personnel', 'dev-perso', 'Sparkles', '#c77dff', 2),
('cat-3', 'Intelligence Artificielle & Tech', 'tech-ia', 'Cpu', '#3a86ff', 3),
('cat-4', 'Psychologie & Mental', 'psychologie', 'Brain', '#ff006e', 4),
('cat-5', 'Histoire & Stratégie', 'strategie', 'Shield', '#fb5607', 5),
('cat-6', 'Romans & Fiction', 'fiction', 'BookOpen', '#ffbe0b', 6);

-- Livres audio de démonstration haute qualité
INSERT OR IGNORE INTO audiobooks (
    id, title, author, narrator, description, synopsis,
    cover_r2_key, cover_url, preview_r2_key, preview_url,
    category_id, price, price_eur, discount_price, duration_seconds,
    language, rating, rating_count, is_featured, is_bestseller, is_free_for_members, release_date
) VALUES
(
    'book-1',
    'La Psychologie de l''Argent',
    'Morgan Housel',
    'Alexandre D.',
    'Quelques leçons intemporelles sur la richesse, la cupidité et le bonheur. Comment notre comportement influence nos finances bien plus que notre QI.',
    'Dans La Psychologie de l''Argent, Morgan Housel partage 19 histoires courtes explorant les manières étranges dont les gens pensent à l''argent. Vous découvrirez comment maîtriser vos émotions, éviter les pièges financiers courants et bâtir une véritable liberté financière durable.',
    'covers/psychologie-argent.webp',
    'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&q=80',
    'previews/psychologie-argent.mp3',
    'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
    'cat-1',
    3500,
    5.50,
    2900,
    21600, -- 6 heures
    'fr',
    4.9,
    1420,
    1,
    1,
    0,
    '2024-01-15'
),
(
    'book-2',
    'L''Effet Cumulé : Décuplez votre réussite',
    'Darren Hardy',
    'Nathalie Dupont',
    'Le principe fondamental pour transformer de petites actions quotidiennes en succès gigantesques au fil du temps.',
    'Pas de formule magique ni de raccourci. L''Effet Cumulé repose sur une vérité indiscutable : vos choix quotidiens déterminent votre destinée. Apprenez à créer des habitudes vertueuses et à éliminer les freins invisibles qui bloquent votre croissance personnelle et professionnelle.',
    'covers/effet-cumule.webp',
    'https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=800&q=80',
    'previews/effet-cumule.mp3',
    'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=ambient-piano-amp-strings-10711.mp3',
    'cat-2',
    4000,
    6.00,
    NULL,
    18000, -- 5 heures
    'fr',
    4.85,
    980,
    1,
    1,
    0,
    '2023-11-20'
),
(
    'book-3',
    'L''Art de la Guerre & Stratégie Moderne',
    'Sun Tzu (Adapté)',
    'Jean-Pierre M.',
    'Le traité militaire et stratégique le plus influent au monde, appliqué au leadership moderne et à la négociation.',
    'Connaissez votre ennemi et connaissez-vous vous-même, et vous remporterez cent victoires sur cent batailles. Cette version enrichie offre des analyses concrètes pour le monde professionnel, la gestion des conflits et la vision à long terme.',
    'covers/art-de-la-guerre.webp',
    'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&q=80',
    'previews/art-de-la-guerre.mp3',
    'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8bbf7341e.mp3?filename=cinematic-epic-10903.mp3',
    'cat-5',
    2500,
    3.90,
    1900,
    10800, -- 3 heures
    'fr',
    4.7,
    640,
    0,
    0,
    1,
    '2024-02-10'
),
(
    'book-4',
    'Révolution IA : Comprendre et Dompter le Futur',
    'Dr. Sophie Laurent',
    'Claire V.',
    'Une plongée captivante dans le fonctionnement des LLMs, agents autonomes et l''impact sur le travail et la création.',
    'L''intelligence artificielle transforme déjà tous les secteurs. Comment rester indispensable ? Ce livre audio décortique sans jargon les rouages de l''IA générative et donne des clés d''action concrètes pour tirer parti de la plus grande révolution technologique.',
    'covers/revolution-ia.webp',
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80',
    'previews/revolution-ia.mp3',
    'https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f792cb.mp3?filename=electronic-future-beats-117997.mp3',
    'cat-3',
    5000,
    7.50,
    3900,
    25200, -- 7 heures
    'fr',
    4.95,
    2150,
    1,
    1,
    0,
    '2024-03-01'
),
(
    'book-5',
    'Le Pouvoir du Moment Présent',
    'Eckhart Tolle',
    'Marc Bellemare',
    'Guide d''éveil spirituel pour calmer le bavardage mental et vivre avec une clarté et une sérénité totales.',
    'Pour entreprendre ce voyage dans Le Pouvoir du moment présent, il nous faut laisser derrière nous notre esprit analytique et son faux soi, l''ego. Dès le début du livre audio, nous nous élevons rapidement vers une altitude supérieure où nous respirons un air plus pur.',
    'covers/pouvoir-moment-present.webp',
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80',
    'previews/pouvoir-moment-present.mp3',
    'https://cdn.pixabay.com/download/audio/2021/08/04/audio_bb630cc098.mp3?filename=meditation-peace-6644.mp3',
    'cat-4',
    3800,
    5.90,
    NULL,
    28800, -- 8 heures
    'fr',
    4.88,
    3120,
    0,
    1,
    0,
    '2023-09-12'
),
(
    'book-6',
    'L''Alchimiste et les Secrets du Désert',
    'Paulo Coelho',
    'Michel A.',
    'L''histoire intemporelle de Santiago, un jeune berger andalou qui part à la recherche d''un trésor enfoui au pied des Pyramides.',
    'Quand on veut une chose, tout l''Univers conspire à nous permettre de réaliser notre rêve. Une quête initiatique inoubliable sur l''écoute de son cœur et le déchiffrement des signes que le destin sème sur notre route.',
    'covers/alchimiste.webp',
    'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800&q=80',
    'previews/alchimiste.mp3',
    'https://cdn.pixabay.com/download/audio/2022/05/16/audio_c1c1f7a0dc.mp3?filename=oriental-strings-111162.mp3',
    'cat-6',
    3000,
    4.50,
    NULL,
    14400, -- 4 heures
    'fr',
    4.92,
    4800,
    0,
    1,
    1,
    '2023-08-01'
);

-- Chapitres pour les livres audio
INSERT OR IGNORE INTO chapters (id, audiobook_id, chapter_number, title, audio_r2_key, audio_url, duration_seconds) VALUES
('chap-1-1', 'book-1', 1, 'Introduction : Le plus grand spectacle sur Terre', 'audiobooks/book-1/ch1.mp3', 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3', 1800),
('chap-1-2', 'book-1', 2, 'Personne n''est fou : Les expériences façonnent la vision', 'audiobooks/book-1/ch2.mp3', 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=ambient-piano-amp-strings-10711.mp3', 2400),
('chap-1-3', 'book-1', 3, 'Chance & Risque : Deux faces d''une même pièce', 'audiobooks/book-1/ch3.mp3', 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8bbf7341e.mp3?filename=cinematic-epic-10903.mp3', 2100),
('chap-1-4', 'book-1', 4, 'Ne jamais en avoir assez : Savoir dire stop', 'audiobooks/book-1/ch4.mp3', 'https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f792cb.mp3?filename=electronic-future-beats-117997.mp3', 1900),
('chap-1-5', 'book-1', 5, 'Les Intérêts Composés : La magie du temps', 'audiobooks/book-1/ch5.mp3', 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_bb630cc098.mp3?filename=meditation-peace-6644.mp3', 2200),

('chap-4-1', 'book-4', 1, 'Genèse des Modèles Géants : De Turing aux Transformers', 'audiobooks/book-4/ch1.mp3', 'https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f792cb.mp3?filename=electronic-future-beats-117997.mp3', 2400),
('chap-4-2', 'book-4', 2, 'L''art du Prompting et les Agents Autonomes', 'audiobooks/book-4/ch2.mp3', 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3', 3000),
('chap-4-3', 'book-4', 3, 'L''Économie de l''IA : Qui gagne vraiment ?', 'audiobooks/book-4/ch3.mp3', 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=ambient-piano-amp-strings-10711.mp3', 2700),

('chap-2-1', 'book-2', 1, 'Chapitre 1 : L''effet cumulé en action', 'audiobooks/book-2/ch1.mp3', 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=ambient-piano-amp-strings-10711.mp3', 3600),
('chap-2-2', 'book-2', 2, 'Chapitre 2 : Les choix inconscients', 'audiobooks/book-2/ch2.mp3', 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3', 3200);

-- Utilisateur par défaut de démonstration
INSERT OR IGNORE INTO users (id, email, name, phone, avatar_url, wallet_balance) VALUES
('user-demo', 'alex@rgplay.com', 'Alexandre Ndongo', '+237 690 00 00 00', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80', 15000);

-- Pré-remplir la bibliothèque avec 2 livres en cours d'écoute
INSERT OR IGNORE INTO purchases (id, user_id, audiobook_id, amount_paid, currency, payment_method, transaction_id, status) VALUES
('pur-1', 'user-demo', 'book-1', 2900, 'XAF', 'camerpay_om', 'CP_TX_987654321', 'completed'),
('pur-2', 'user-demo', 'book-4', 3900, 'XAF', 'camerpay_momo', 'CP_TX_123456789', 'completed');

INSERT OR IGNORE INTO user_progress (id, user_id, audiobook_id, current_chapter_id, position_seconds, completed_percentage, is_completed, is_favorite) VALUES
('prog-1', 'user-demo', 'book-1', 'chap-1-2', 450, 24.5, 0, 1),
('prog-2', 'user-demo', 'book-4', 'chap-4-1', 1200, 48.0, 0, 1);
