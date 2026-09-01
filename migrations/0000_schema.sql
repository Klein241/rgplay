-- Schéma D1 RG Play (Tables & Index uniquement, sans réinsertion de seed data)

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
    content_type TEXT DEFAULT 'audiobook',
    price REAL NOT NULL,
    price_eur REAL,
    discount_price REAL,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    language TEXT DEFAULT 'fr',
    rating REAL DEFAULT 4.8,
    rating_count INTEGER DEFAULT 0,
    display_plays_count INTEGER DEFAULT 0,
    display_reviews_count INTEGER DEFAULT 0,
    display_rating REAL DEFAULT 4.8,
    is_featured BOOLEAN DEFAULT 0,
    is_bestseller BOOLEAN DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,
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
    audio_r2_key TEXT NOT NULL,
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
    payment_method TEXT NOT NULL,
    transaction_id TEXT,
    status TEXT DEFAULT 'completed',
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

-- 7. Table des Signets & Notes (Bookmarks)
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

-- 9. Table des Souscriptions Push Notifications
CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    auth TEXT,
    p256dh TEXT,
    user_id TEXT,
    device TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. Table des Livres Supprimés (Registre de suppression permanent)
CREATE TABLE IF NOT EXISTS deleted_books (
    id TEXT PRIMARY KEY,
    deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_audiobooks_category ON audiobooks(category_id);
CREATE INDEX IF NOT EXISTS idx_audiobooks_featured ON audiobooks(is_featured);
CREATE INDEX IF NOT EXISTS idx_chapters_audiobook ON chapters(audiobook_id, chapter_number);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id, audiobook_id);
CREATE INDEX IF NOT EXISTS idx_deleted_books_id ON deleted_books(id);
