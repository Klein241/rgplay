-- Migration 0003 : Table de protection IP anti-fraude et historique notifications
CREATE TABLE IF NOT EXISTS ip_devices (
    id TEXT PRIMARY KEY,
    ip TEXT NOT NULL,
    device_fingerprint TEXT,
    primary_user_id TEXT NOT NULL,
    bonus_claimed INTEGER DEFAULT 1,
    points_balance INTEGER DEFAULT 1000,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ip_devices_ip ON ip_devices(ip);
CREATE INDEX IF NOT EXISTS idx_ip_devices_user ON ip_devices(primary_user_id);

CREATE TABLE IF NOT EXISTS notifications_history (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    icon TEXT,
    url TEXT DEFAULT '/',
    book_id TEXT,
    is_read INTEGER DEFAULT 0,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
