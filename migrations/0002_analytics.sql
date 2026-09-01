-- Migration 002 : Analytics Visiteurs & Social Proof pour RG Play
-- Nouvelles tables et colonnes pour le tracking et l'effet de masse

-- Colonnes Social Proof sur audiobooks (display vs réel)
ALTER TABLE audiobooks ADD COLUMN display_plays_count INTEGER DEFAULT 0;
ALTER TABLE audiobooks ADD COLUMN display_reviews_count INTEGER DEFAULT 0;
ALTER TABLE audiobooks ADD COLUMN display_rating REAL DEFAULT NULL;

-- Seed : initialiser les métriques d'affichage avec les valeurs existantes (effet de masse)
UPDATE audiobooks SET display_plays_count = rating_count * 7, display_reviews_count = rating_count, display_rating = rating WHERE display_plays_count = 0;

-- Table des Sessions Visiteurs (inscrits ET anonymes)
CREATE TABLE IF NOT EXISTS visitor_sessions (
    session_id  TEXT PRIMARY KEY,
    visitor_id  TEXT NOT NULL,
    user_id     TEXT REFERENCES users(id),
    source      TEXT NOT NULL DEFAULT 'Direct',
    device      TEXT NOT NULL DEFAULT 'Inconnu',
    referrer    TEXT,
    landing_url TEXT,
    started_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table des Événements Analytics
CREATE TABLE IF NOT EXISTS analytics_events (
    id          TEXT PRIMARY KEY,
    session_id  TEXT REFERENCES visitor_sessions(session_id),
    visitor_id  TEXT NOT NULL,
    user_id     TEXT REFERENCES users(id),
    event_type  TEXT NOT NULL,
    page        TEXT,
    action      TEXT,
    audiobook_id    TEXT REFERENCES audiobooks(id),
    audiobook_title TEXT,
    chapter_id  TEXT,
    seconds_listened INTEGER DEFAULT 0,
    extra_data  TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index pour les requêtes analytiques admin
CREATE INDEX IF NOT EXISTS idx_sessions_visitor  ON visitor_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_source   ON visitor_sessions(source);
CREATE INDEX IF NOT EXISTS idx_sessions_started  ON visitor_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_events_visitor    ON analytics_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_events_type       ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_audiobook  ON analytics_events(audiobook_id);
CREATE INDEX IF NOT EXISTS idx_events_created    ON analytics_events(created_at);
