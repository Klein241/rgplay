-- Migration pour ajouter les colonnes manquantes dans visitor_sessions et users
ALTER TABLE visitor_sessions ADD COLUMN country TEXT;
ALTER TABLE visitor_sessions ADD COLUMN city TEXT;
ALTER TABLE visitor_sessions ADD COLUMN ip TEXT;
ALTER TABLE visitor_sessions ADD COLUMN total_duration_seconds INTEGER DEFAULT 0;
ALTER TABLE visitor_sessions ADD COLUMN last_active_at DATETIME;
ALTER TABLE visitor_sessions ADD COLUMN points INTEGER DEFAULT 0;
ALTER TABLE visitor_sessions ADD COLUMN user_name TEXT;
ALTER TABLE visitor_sessions ADD COLUMN user_email TEXT;

-- Index pour accélérer le tracking et la géolocalisation
CREATE INDEX IF NOT EXISTS idx_sessions_country ON visitor_sessions(country);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON visitor_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_visitor ON visitor_sessions(visitor_id);
