-- Migration D1 : 0009_gamification_and_ebooks.sql
-- Module Gamification, Points, Badges et Liseuse E-Book Read's Great

-- 1. Table Gamification Utilisateur (XP, Points, Niveaux, Streaks)
CREATE TABLE IF NOT EXISTS user_gamification (
    user_id TEXT PRIMARY KEY,
    xp INTEGER NOT NULL DEFAULT 0,
    points INTEGER NOT NULL DEFAULT 50, -- 50 points de bienvenue offerts
    level INTEGER NOT NULL DEFAULT 1,
    reading_minutes INTEGER NOT NULL DEFAULT 0,
    listening_minutes INTEGER NOT NULL DEFAULT 0,
    books_completed INTEGER NOT NULL DEFAULT 0,
    daily_streak INTEGER NOT NULL DEFAULT 1,
    last_daily_reward_date TEXT,
    last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    unlocked_badges TEXT DEFAULT '["badge-welcome"]', -- JSON Array de badges
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table Historique des Transactions de Points
CREATE TABLE IF NOT EXISTS point_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL, -- Positif pour gain, négatif pour dépense
    type TEXT NOT NULL, -- 'daily_reward', 'ad_reward', 'reading_time', 'listening_time', 'referral', 'book_unlock', 'bonus'
    description TEXT NOT NULL,
    metadata TEXT, -- JSON supplémentaire
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table Progression de Lecture E-Book / PDF
CREATE TABLE IF NOT EXISTS ebook_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    book_id TEXT NOT NULL,
    current_page INTEGER NOT NULL DEFAULT 1,
    total_pages INTEGER NOT NULL DEFAULT 1,
    reading_seconds INTEGER NOT NULL DEFAULT 0,
    percentage REAL NOT NULL DEFAULT 0,
    is_completed BOOLEAN NOT NULL DEFAULT 0,
    last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, book_id)
);

-- 4. Table Signets & Notes E-Book
CREATE TABLE IF NOT EXISTS ebook_bookmarks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    book_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index d'optimisation
CREATE INDEX IF NOT EXISTS idx_point_tx_user ON point_transactions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ebook_prog_user ON ebook_progress(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_ebook_bm_user ON ebook_bookmarks(user_id, book_id);
