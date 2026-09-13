-- Migration D1 : 0010_app_settings.sql
-- Table de configuration globale de la plateforme RG Play (Support WhatsApp VIP, paramètres système)

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insertion des valeurs par défaut pour le Gabon (+24177624383)
INSERT OR IGNORE INTO app_settings (key, value)
VALUES 
    ('support_whatsapp', '+24177624383'),
    ('support_whatsapp_message', 'Bonjour RG Play, j''ai besoin d''une assistance avec mon compte et mes accès VIP.');
