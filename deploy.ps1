#!/usr/bin/env pwsh
# ============================================================
# deploy.ps1 - Script de déploiement complet RG Play
# Cloudflare Pages + D1 + R2 + KV
# ============================================================

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  RG PLAY - Déploiement Cloudflare Edge" -ForegroundColor Cyan
Write-Host "  Account : 29af63e0139b75f78259902d4ee51e07" -ForegroundColor Gray
Write-Host "  Subdomain : rgplay.workers.dev" -ForegroundColor Gray
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Build du projet React
Write-Host "[1/5] Build React (Vite)..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "ERREUR Build" -ForegroundColor Red; exit 1 }
Write-Host "  ✓ Build réussi -> ./dist" -ForegroundColor Green

# 2. Créer le bucket R2 (idempotent)
Write-Host "[2/5] Création bucket R2 'rg-play-audio'..." -ForegroundColor Yellow
npx wrangler r2 bucket create rg-play-audio 2>$null
Write-Host "  ✓ Bucket R2 prêt" -ForegroundColor Green

# 3. Créer le bucket R2 de preview
Write-Host "[3/5] Création bucket R2 preview 'rg-play-audio-preview'..." -ForegroundColor Yellow
npx wrangler r2 bucket create rg-play-audio-preview 2>$null
Write-Host "  ✓ Bucket R2 preview prêt" -ForegroundColor Green

# 4. Assurer la présence du schéma Cloudflare D1
Write-Host "[4/5] Vérification et mise à jour du schéma Cloudflare D1..." -ForegroundColor Yellow
npx wrangler d1 execute rg-play-db --remote --file=./migrations/0000_schema.sql --yes
if ($LASTEXITCODE -ne 0) { 
    Write-Host "  AVERTISSEMENT: D1 schema check a retourné un code non nul" -ForegroundColor DarkYellow
} else {
    Write-Host "  ✓ D1 Schéma vérifié" -ForegroundColor Green
}

# 5. Déploiement sur Cloudflare Pages
Write-Host "[5/5] Déploiement sur Cloudflare Pages..." -ForegroundColor Yellow
npx wrangler pages deploy dist --project-name=rg-play --commit-dirty=true
if ($LASTEXITCODE -ne 0) { Write-Host "ERREUR Déploiement Pages" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "  DÉPLOIEMENT RÉUSSI !" -ForegroundColor Green
Write-Host "  URL : https://rg-play.pages.dev" -ForegroundColor Cyan
Write-Host "  Workers : https://rgplay.workers.dev" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""
