-- Migration D1 : 0011_real_metrics.sql
-- Ajout des colonnes de métriques RÉELLES (Back-office Admin RG Play)
-- Séparées de manière étanche des chiffres publics ("Effet de masse" / Social Proof)

-- 1. Vrais téléchargements hors-ligne (actions réelles physiques d'utilisateurs)
ALTER TABLE audiobooks ADD COLUMN real_downloads_count INTEGER DEFAULT 0;

-- 2. Vraies lectures / écoutes (actions réelles de lecture et streaming)
ALTER TABLE audiobooks ADD COLUMN real_plays_count INTEGER DEFAULT 0;

-- 3. Alias downloads_count pour compatibilité ascendante
ALTER TABLE audiobooks ADD COLUMN downloads_count INTEGER DEFAULT 0;

-- 4. Index d'accélération pour le tableau de bord et le catalogue admin
CREATE INDEX IF NOT EXISTS idx_audiobooks_real_downloads ON audiobooks(real_downloads_count);
CREATE INDEX IF NOT EXISTS idx_audiobooks_real_plays ON audiobooks(real_plays_count);
