-- Migration D1 : 0008_comprehensive_schema_sync.sql
-- Consolidation de toutes les tables nécessaires pour RG Play

-- 1. Table Utilisateurs Enrichie
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    name TEXT NOT NULL DEFAULT 'Auditeur RG Play',
    phone TEXT,
    avatar_url TEXT,
    plan TEXT DEFAULT 'free',
    plan_expires_at DATETIME,
    wallet_balance REAL DEFAULT 0,
    theme_preference TEXT DEFAULT 'purple',
    audio_quality TEXT DEFAULT '128',
    download_wifi_only INTEGER DEFAULT 1,
    auto_play_next INTEGER DEFAULT 1,
    sleep_timer_default TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table Achats & Déblocages
CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    audiobook_id TEXT NOT NULL,
    amount_paid REAL NOT NULL,
    currency TEXT DEFAULT 'XAF',
    payment_method TEXT NOT NULL,
    transaction_id TEXT,
    status TEXT DEFAULT 'completed',
    purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, audiobook_id)
);

-- 3. Table Progression d'Écoute
CREATE TABLE IF NOT EXISTS user_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    audiobook_id TEXT NOT NULL,
    current_chapter_id TEXT,
    position_seconds REAL DEFAULT 0,
    completed_percentage REAL DEFAULT 0,
    is_completed BOOLEAN DEFAULT 0,
    is_favorite BOOLEAN DEFAULT 0,
    last_listened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, audiobook_id)
);

-- 4. Table Signets & Marque-pages Audio
CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    audiobook_id TEXT NOT NULL,
    chapter_id TEXT,
    chapter_number INTEGER,
    chapter_title TEXT,
    timestamp_seconds REAL NOT NULL,
    title TEXT,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Table Avis & Notations
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    audiobook_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_avatar TEXT,
    rating INTEGER CHECK(rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Table Clés API Admin
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT,
    key_preview TEXT,
    permissions TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME
);

-- 7. Table Historique des Notifications Push
CREATE TABLE IF NOT EXISTS push_notifications (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    url TEXT,
    icon TEXT,
    book_id TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT 0
);

-- 8. Table Registre des Livres Supprimés
CREATE TABLE IF NOT EXISTS deleted_books (
    id TEXT PRIMARY KEY,
    deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_purchases_user_book ON purchases(user_id, audiobook_id);
CREATE INDEX IF NOT EXISTS idx_progress_user_book ON user_progress(user_id, audiobook_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_book ON bookmarks(user_id, audiobook_id);
CREATE INDEX IF NOT EXISTS idx_reviews_book ON reviews(audiobook_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sent ON push_notifications(sent_at);
