import React, { useState, useEffect } from 'react';
import {
  Sparkles, Save, ShieldCheck, Headphones, Award, Gift, Plus, Trash2,
  Image, Video, Music, ToggleLeft, ToggleRight, Eye, ExternalLink, Globe,
  Check, Layers, CheckSquare, Square
} from 'lucide-react';
import { DropZone } from '../components/DropZone';
import { apiClient } from '../../../services/api';

// ── 17 Emplacements d'affichage ciblés dans toute l'application RG Play ──
export const AD_PLACEMENTS = [
  { id: 'discover_hero', label: "Accueil — Bannière Hero Principale (Haut)", icon: "🌟", color: "text-amber-400", desc: "Tout en haut de la page d'accueil" },
  { id: 'discover_feed', label: "Accueil — Flux Central (Entre carrousels)", icon: "📰", color: "text-purple-400", desc: "Au milieu des sections de livres" },
  { id: 'discover_bottom', label: "Accueil — Bas de page Découvrir", icon: "⚓", color: "text-indigo-400", desc: "Pied de page de l'accueil" },
  { id: 'reward_modal', label: "Modale Récompensée — Vidéo & Audio (+ Points fidélité)", icon: "🎁", color: "text-pink-400", desc: "Modale pour gagner des points gratuits" },
  { id: 'player_fullscreen', label: "Lecteur Audio Plein Écran — Sous la pochette", icon: "🎧", color: "text-emerald-400", desc: "Affiché pendant l'écoute d'un livre" },
  { id: 'mini_player', label: "Mini-Lecteur Flottant — Bandeau discret", icon: "🎵", color: "text-cyan-400", desc: "Bandeau au-dessus du mini-lecteur" },
  { id: 'chapter_break', label: "Transition Audio — Interstitiel entre chapitres", icon: "⏸️", color: "text-blue-400", desc: "Spot joué entre 2 chapitres" },
  { id: 'library_top', label: "Bibliothèque — En-tête supérieur", icon: "📚", color: "text-amber-300", desc: "Haut de la bibliothèque de l'utilisateur" },
  { id: 'library_grid', label: "Bibliothèque — Carte intégrée dans la grille", icon: "🗂️", color: "text-rose-400", desc: "Insérée parmi les livres de l'utilisateur" },
  { id: 'store_top', label: "Boutique & Catalogue — En-tête", icon: "🛍️", color: "text-fuchsia-400", desc: "En-tête de la boutique VIP" },
  { id: 'store_grid', label: "Boutique — Entre les catégories", icon: "🏷️", color: "text-violet-400", desc: "Dans la grille des abonnements" },
  { id: 'book_detail', label: "Fiche Détail du Livre — Sous les boutons d'action", icon: "📖", color: "text-sky-400", desc: "Directement sous le bouton d'écoute/achat" },
  { id: 'pdf_reader', label: "Liseuse E-Book / PDF — Bandeau discret", icon: "📄", color: "text-teal-400", desc: "Bandeau partenaire dans la liseuse" },
  { id: 'profile_header', label: "Profil Utilisateur — En-tête", icon: "👤", color: "text-orange-400", desc: "Haut de la page de profil" },
  { id: 'profile_wallet', label: "Espace Portefeuille & Paiement Mobile Money", icon: "💳", color: "text-green-400", desc: "Sous le solde portefeuille" },
  { id: 'sky_ai_chat', label: "Agent SKY IA — Bannière dans le chat", icon: "🤖", color: "text-blue-300", desc: "Dans le dialogue interactif SKY" },
  { id: 'checkout_modal', label: "Écran de Caisse / Confirmation de commande", icon: "🛒", color: "text-yellow-400", desc: "Pendant le paiement CamerPay / MoMo" },
];

const DEFAULT_AD = {
  id: '',
  title: '',
  tagline: '',
  mediaType: 'image', // 'image' | 'video' | 'audio'
  mediaUrl: '',
  duration: 8,
  rewardPoints: 3, // Configurable librement par pub (ex: 3, 5, 25 pts)
  placements: ['discover_hero', 'reward_modal'],
  ctaUrl: '',
  ctaText: 'Découvrir',
  active: true,
};

export const GamificationRubric = () => {
  const [gamificationRules, setGamificationRules] = useState(() => {
    try {
      const cached = localStorage.getItem('rg_gamification_rules');
      if (cached) return JSON.parse(cached);
    } catch (_) {}
    return {
      bookUnlockPoints: 300,
      readingXpPer3Min: 2,
      readingPointsPer3Min: 1,
      adRewardPoints: 3,
      adRewardXp: 1,
      dailyLoginBaseXp: 2,
      audioXpDisabled: localStorage.getItem('rg_settings_audio_xp_disabled') !== 'false',
    };
  });

  // ── État Publicités Admin (Local + Synchronisation Cloudflare KV) ──
  const [adminAds, setAdminAds] = useState(() => {
    try {
      const raw = localStorage.getItem('rg_admin_ads');
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return [];
  });

  // Synchroniser avec Cloudflare KV au chargement
  useEffect(() => {
    apiClient.getAdminAds().then(serverAds => {
      if (Array.isArray(serverAds) && serverAds.length > 0) {
        setAdminAds(serverAds);
      }
    }).catch(() => {});
  }, []);

  const [newAd, setNewAd] = useState({ ...DEFAULT_AD });
  const [adSavedMsg, setAdSavedMsg] = useState('');
  const [savingGamification, setSavingGamification] = useState(false);
  const [gamificationSavedMsg, setGamificationSavedMsg] = useState('');

  const handleSaveGamification = async (updated) => {
    setSavingGamification(true);
    setGamificationSavedMsg('');
    const rulesToSave = updated || gamificationRules;
    setGamificationRules(rulesToSave);
    try {
      localStorage.setItem('rg_gamification_rules', JSON.stringify(rulesToSave));
      localStorage.setItem('rg_settings_audio_xp_disabled', String(rulesToSave.audioXpDisabled));
      window.dispatchEvent(new CustomEvent('rg:gamification-rules-updated', { detail: rulesToSave }));
      await fetch('/api/admin/gamification-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rulesToSave),
      }).catch(() => {});
      setGamificationSavedMsg('✓ Règles enregistrées !');
      setTimeout(() => setGamificationSavedMsg(''), 3000);
    } finally {
      setSavingGamification(false);
    }
  };

  const handleSaveAds = async (updatedAds) => {
    const toSave = updatedAds !== undefined ? updatedAds : adminAds;
    setAdminAds(toSave);
    localStorage.setItem('rg_admin_ads', JSON.stringify(toSave));
    await apiClient.saveAdminAds(toSave);
    setAdSavedMsg('✓ Publicités enregistrées & synchronisées !');
    setTimeout(() => setAdSavedMsg(''), 3500);
  };

  const handleAddAd = () => {
    if (!newAd.title.trim()) return;
    const ad = {
      ...newAd,
      id: `ad-${Date.now()}`,
      createdAt: new Date().toISOString(),
      rewardPoints: Number(newAd.rewardPoints) || gamificationRules.adRewardPoints || 3,
      placements: Array.isArray(newAd.placements) && newAd.placements.length > 0 ? newAd.placements : ['discover_hero']
    };
    const updated = [ad, ...adminAds];
    handleSaveAds(updated);
    setNewAd({ ...DEFAULT_AD, rewardPoints: gamificationRules.adRewardPoints || 3 });
  };

  const handleToggleAd = (id) => {
    const updated = adminAds.map(a => a.id === id ? { ...a, active: !a.active } : a);
    handleSaveAds(updated);
  };

  const handleDeleteAd = (id) => {
    const updated = adminAds.filter(a => a.id !== id);
    handleSaveAds(updated);
  };

  const togglePlacement = (placementId) => {
    setNewAd(prev => {
      const current = prev.placements || [];
      const exists = current.includes(placementId);
      const updated = exists ? current.filter(p => p !== placementId) : [...current, placementId];
      return { ...prev, placements: updated };
    });
  };

  const selectAllPlacements = () => {
    setNewAd(prev => ({ ...prev, placements: AD_PLACEMENTS.map(p => p.id) }));
  };

  const clearAllPlacements = () => {
    setNewAd(prev => ({ ...prev, placements: [] }));
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* En-tête avec bouton de sauvegarde */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black text-white font-['Outfit'] tracking-tight flex items-center gap-2.5">
            <Sparkles className="w-7 h-7 text-amber-400" />
            <span>Gamification & Publicités RG Play</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
            Gérez les points, les vidéos/audios sponsorisés et choisissez précisément où afficher chaque publicité.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {gamificationSavedMsg && (
            <span className="text-xs font-bold text-emerald-400 animate-fadeIn">
              {gamificationSavedMsg}
            </span>
          )}
          <button
            type="button"
            onClick={() => handleSaveGamification()}
            disabled={savingGamification}
            className="btn-gradient px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xl cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{savingGamification ? 'Enregistrement...' : 'Enregistrer les Règles'}</span>
          </button>
        </div>
      </div>

      {/* Carte Explicative */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-purple-950/60 via-[#1b0d33] to-indigo-950/60 border border-purple-500/30 space-y-2 shadow-xl">
        <div className="flex items-center gap-2.5 text-purple-200 font-bold text-sm">
          <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
          <span>Monétisation Publicitaire & Économie de Points RG Play</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Les auditeurs peuvent regarder des vidéos sponsorisées, écouter des spots radio ou lire pour accumuler des <strong>Points ⭐</strong>. Vous pouvez créer des annonces (images, vidéos HD, spots audio), configurer le gain de points pour chaque offre (ex : 3 pts, 10 pts, 25 pts) et <strong>choisir exactement leurs emplacements d'affichage</strong> parmi les 17 zones de l'application.
        </p>
      </div>

      {/* TOGGLE CRITIQUE : DÉSACTIVER LES POINTS XP SUR LES LIVRES AUDIO */}
      <div className="p-5 rounded-3xl bg-white/4 border border-white/10 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Headphones className="w-5 h-5 text-purple-400" />
              <h3 className="text-sm font-black text-white font-['Outfit']">
                Points XP sur les Livres Audio
              </h3>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                gamificationRules.audioXpDisabled
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {gamificationRules.audioXpDisabled ? 'Désactivé 🔴' : 'Activé 🟢'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Quand cette option est désactivée, le bouton <strong>100 Pts ⭐</strong> est masqué sur tous les livres audio (achat Mobile Money ou écoute gratuite).
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              const nextVal = !gamificationRules.audioXpDisabled;
              const updated = { ...gamificationRules, audioXpDisabled: nextVal };
              handleSaveGamification(updated);
            }}
            className={`px-5 py-2.5 rounded-2xl font-black text-xs transition-all cursor-pointer shadow-lg flex items-center gap-2 whitespace-nowrap ${
              gamificationRules.audioXpDisabled
                ? 'bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/40'
                : 'bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40'
            }`}
          >
            {gamificationRules.audioXpDisabled
              ? '🔴 XP Audio Désactivé (Cliquer pour activer)'
              : '🟢 XP Audio Activé (Cliquer pour désactiver)'
            }
          </button>
        </div>
      </div>

      {/* Cartes Éditables : Économie de Points */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Coût Déblocage */}
        <div className="p-4 rounded-3xl bg-gradient-to-br from-amber-950/40 to-[#1b0d33] border border-amber-500/30 space-y-2 shadow-xl">
          <span className="text-[10px] uppercase font-extrabold text-amber-400 tracking-wider block">Coût Déblocage Livre</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="10"
              max="1000"
              value={gamificationRules.bookUnlockPoints || 100}
              onChange={e => setGamificationRules(r => ({ ...r, bookUnlockPoints: Number(e.target.value) }))}
              className="rg-input text-lg font-black text-white w-24 py-1"
            />
            <span className="text-xs font-bold text-amber-300">Points ⭐</span>
          </div>
          <p className="text-[11px] text-slate-400">Points requis pour débloquer 1 livre sans payer.</p>
        </div>

        {/* 2. Récompense Lecture */}
        <div className="p-4 rounded-3xl bg-gradient-to-br from-purple-950/40 to-[#1b0d33] border border-purple-500/30 space-y-2 shadow-xl">
          <span className="text-[10px] uppercase font-extrabold text-purple-400 tracking-wider block">Récompense Lecture (E-Book)</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-purple-300 font-bold">+</span>
            <input
              type="number"
              min="1"
              max="50"
              value={gamificationRules.readingXpPer3Min || 8}
              onChange={e => setGamificationRules(r => ({ ...r, readingXpPer3Min: Number(e.target.value) }))}
              className="rg-input text-lg font-black text-white w-20 py-1"
            />
            <span className="text-xs font-bold text-purple-300">XP / 3 min</span>
          </div>
          <p className="text-[11px] text-slate-400">+5 Points attribués toutes les 3 min de lecture dans la liseuse.</p>
        </div>

        {/* 3. Pubs Sponsorisées (Règle par défaut) */}
        <div className="p-4 rounded-3xl bg-gradient-to-br from-cyan-950/40 to-[#1b0d33] border border-cyan-500/30 space-y-2 shadow-xl">
          <span className="text-[10px] uppercase font-extrabold text-cyan-400 tracking-wider block">Pubs Sponsorisées (Défaut)</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-cyan-300 font-bold">+</span>
            <input
              type="number"
              min="1"
              max="200"
              value={gamificationRules.adRewardPoints || 3}
              onChange={e => setGamificationRules(r => ({ ...r, adRewardPoints: Number(e.target.value) }))}
              className="rg-input text-lg font-black text-white w-20 py-1"
            />
            <span className="text-xs font-bold text-cyan-300">Pts / Pub</span>
          </div>
          <p className="text-[11px] text-slate-400">Points attribués par visionnage (chaque pub peut avoir son propre montant ci-dessous).</p>
        </div>

        {/* 4. Bonus Quotidien */}
        <div className="p-4 rounded-3xl bg-gradient-to-br from-emerald-950/40 to-[#1b0d33] border border-emerald-500/30 space-y-2 shadow-xl">
          <span className="text-[10px] uppercase font-extrabold text-emerald-400 tracking-wider block">Bonus Quotidien (Streak)</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-emerald-300 font-bold">+</span>
            <input
              type="number"
              min="1"
              max="100"
              value={gamificationRules.dailyLoginBaseXp || 2}
              onChange={e => setGamificationRules(r => ({ ...r, dailyLoginBaseXp: Number(e.target.value) }))}
              className="rg-input text-lg font-black text-white w-20 py-1"
            />
            <span className="text-xs font-bold text-emerald-300">XP / jour</span>
          </div>
          <p className="text-[11px] text-slate-400">Multiplicateur appliqué selon la série de jours consécutifs.</p>
        </div>
      </div>

      {/* ── PANNEAU PUBLICITÉS ADMIN & CIBLAGE MULTI-EMPLACEMENTS ── */}
      <div className="card-lg space-y-6 border border-pink-500/25">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-lg font-black text-white font-['Outfit'] flex items-center gap-2">
              <span className="text-2xl">📢</span>
              <span>Gestionnaire des Publicités & Offres Sponsorisées</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Téléversez directement des fichiers (Images, Vidéos HD, Spots Audio) et choisissez les emplacements d'affichage dans l'application.
            </p>
          </div>
          {adSavedMsg && <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/30 animate-fadeIn">{adSavedMsg}</span>}
        </div>

        {/* Formulaire ajout nouvelle pub */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white/4 border border-white/10 space-y-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <span>➕ Créer une nouvelle publicité</span>
            </h4>
            <span className="text-[11px] text-slate-400">Stockage direct permanent Cloudflare R2</span>
          </div>

          {/* Titre et Sous-titre */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Titre de la publicité *</label>
              <input
                type="text"
                value={newAd.title}
                onChange={e => setNewAd(a => ({ ...a, title: e.target.value }))}
                placeholder="Ex: CamerPay – Paiement Orange Money & MTN MoMo"
                className="rg-input w-full text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Slogan / Tagline accrocheur</label>
              <input
                type="text"
                value={newAd.tagline}
                onChange={e => setNewAd(a => ({ ...a, tagline: e.target.value }))}
                placeholder="Ex: Achetez vos livres audio en 1 clic sans carte bancaire"
                className="rg-input w-full text-xs"
              />
            </div>
          </div>

          {/* Type de média (3 boutons : Image, Vidéo, Audio) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">Format du Média *</label>
            <div className="grid grid-cols-3 gap-2.5 max-w-md">
              <button
                type="button"
                onClick={() => setNewAd(a => ({ ...a, mediaType: 'image' }))}
                className={`py-2.5 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  newAd.mediaType === 'image'
                    ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30 scale-[1.02]'
                    : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Image className="w-4 h-4" /> Image 🖼️
              </button>
              <button
                type="button"
                onClick={() => setNewAd(a => ({ ...a, mediaType: 'video' }))}
                className={`py-2.5 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  newAd.mediaType === 'video'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 scale-[1.02]'
                    : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Video className="w-4 h-4" /> Vidéo 🎬
              </button>
              <button
                type="button"
                onClick={() => setNewAd(a => ({ ...a, mediaType: 'audio' }))}
                className={`py-2.5 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  newAd.mediaType === 'audio'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 scale-[1.02]'
                    : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Music className="w-4 h-4" /> Audio 🎧
              </button>
            </div>
          </div>

          {/* Téléversement multimédia direct avec DropZone */}
          <div className="space-y-3">
            {newAd.mediaType === 'image' && (
              <DropZone
                label="Visuel Publicitaire (Image WebP / JPG / PNG)"
                accept="image/*"
                type="cover"
                value={newAd.mediaUrl}
                onUploaded={res => setNewAd(a => ({ ...a, mediaUrl: res.public_url }))}
              />
            )}

            {newAd.mediaType === 'video' && (
              <DropZone
                label="Fichier Vidéo Publicitaire (MP4, WebM - jusqu'à 500 Mo)"
                accept="video/mp4,video/webm,video/*"
                type="video"
                value={newAd.mediaUrl}
                onDurationDetected={d => setNewAd(a => ({ ...a, duration: d }))}
                onUploaded={res => setNewAd(a => ({
                  ...a,
                  mediaUrl: res.public_url,
                  duration: res.duration_seconds || a.duration || 15
                }))}
              />
            )}

            {newAd.mediaType === 'audio' && (
              <DropZone
                label="Spot Publicitaire Audio (MP3, WAV, M4A)"
                accept="audio/*,.mp3,.wav,.ogg,.m4a"
                type="audio"
                value={newAd.mediaUrl}
                onDurationDetected={d => setNewAd(a => ({ ...a, duration: d }))}
                onUploaded={res => setNewAd(a => ({
                  ...a,
                  mediaUrl: res.public_url,
                  duration: res.duration_seconds || a.duration || 10
                }))}
              />
            )}

            {/* Saisie alternative d'URL directe */}
            <div className="pt-1">
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Ou saisir/coller une URL directe ({newAd.mediaType})
              </label>
              <input
                type="url"
                value={newAd.mediaUrl}
                onChange={e => setNewAd(a => ({ ...a, mediaUrl: e.target.value }))}
                placeholder={
                  newAd.mediaType === 'video'
                    ? 'https://.../video.mp4'
                    : newAd.mediaType === 'audio'
                      ? 'https://.../spot.mp3'
                      : 'https://.../affiche.jpg'
                }
                className="rg-input w-full text-xs font-mono"
              />
            </div>
          </div>

          {/* Paramètres d'attribution : Points Récompense & Durée */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-2xl bg-black/30 border border-white/6">
            <div>
              <label className="text-xs font-bold text-amber-300 block mb-1">
                Points attribués ⭐ (ex: 3, 5, 25 pts)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={newAd.rewardPoints}
                  onChange={e => setNewAd(a => ({ ...a, rewardPoints: Number(e.target.value) }))}
                  className="rg-input text-sm font-bold text-white w-24 py-1.5"
                />
                <span className="text-xs text-amber-300/80 font-bold">Points / vue</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Montant libre par publicité (même 3 pts).</p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Durée (secondes)</label>
              <input
                type="number"
                min="3"
                max="120"
                value={newAd.duration}
                onChange={e => setNewAd(a => ({ ...a, duration: Number(e.target.value) }))}
                className="rg-input text-sm font-bold text-white w-24 py-1.5"
              />
              <p className="text-[10px] text-slate-400 mt-1">Détectée automatiquement ou manuelle.</p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Lien de redirection (CTA)</label>
              <input
                type="url"
                value={newAd.ctaUrl}
                onChange={e => setNewAd(a => ({ ...a, ctaUrl: e.target.value }))}
                placeholder="https://wa.me/... ou https://..."
                className="rg-input w-full text-xs py-1.5"
              />
              <p className="text-[10px] text-slate-400 mt-1">Lien cliquable ouvert au clic.</p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Texte du bouton CTA</label>
              <input
                type="text"
                value={newAd.ctaText}
                onChange={e => setNewAd(a => ({ ...a, ctaText: e.target.value }))}
                placeholder="Ex: Découvrir l'offre"
                className="rg-input w-full text-xs py-1.5"
              />
              <p className="text-[10px] text-slate-400 mt-1">Libellé du bouton d'action.</p>
            </div>
          </div>

          {/* SÉLECTEUR GRANULAIRE DES 17 EMPLACEMENTS D'AFFICHAGE */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <label className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5 font-['Outfit']">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <span>Emplacements d'affichage dans l'application ({newAd.placements?.length || 0} sélectionnés)</span>
                </label>
                <p className="text-[11px] text-slate-400">Cochez les zones précises où cette annonce doit être visible.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllPlacements}
                  className="px-3 py-1 rounded-xl text-[10px] font-bold bg-white/10 hover:bg-white/15 text-slate-200 transition-all cursor-pointer"
                >
                  Tout sélectionner
                </button>
                <button
                  type="button"
                  onClick={clearAllPlacements}
                  className="px-3 py-1 rounded-xl text-[10px] font-bold bg-white/5 hover:bg-white/10 text-slate-400 transition-all cursor-pointer"
                >
                  Tout désélectionner
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1 p-3 rounded-2xl bg-black/25 border border-white/8">
              {AD_PLACEMENTS.map(pl => {
                const isSelected = (newAd.placements || []).includes(pl.id);
                return (
                  <div
                    key={pl.id}
                    onClick={() => togglePlacement(pl.id)}
                    className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-purple-600/20 border-purple-500/50 shadow-md shadow-purple-950/40 text-white'
                        : 'bg-white/2 border-white/5 text-slate-400 hover:bg-white/5 hover:text-slate-200'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-purple-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{pl.icon}</span>
                        <span className="text-xs font-bold truncate">{pl.label}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">{pl.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Aperçu Live du Média */}
          {newAd.mediaUrl && (
            <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Prévisualisation ({newAd.mediaType.toUpperCase()})
              </span>
              {newAd.mediaType === 'image' && (
                <div className="max-h-48 rounded-xl overflow-hidden border border-white/10 bg-black/50">
                  <img src={newAd.mediaUrl} alt="Aperçu" className="w-full max-h-48 object-contain mx-auto" />
                </div>
              )}
              {newAd.mediaType === 'video' && (
                <div className="max-h-48 rounded-xl overflow-hidden border border-white/10 bg-black">
                  <video src={newAd.mediaUrl} controls playsInline className="w-full max-h-48 object-contain mx-auto" />
                </div>
              )}
              {newAd.mediaType === 'audio' && (
                <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                    <Music className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span>Spot Audio : {newAd.title || 'Sans titre'} ({newAd.duration}s)</span>
                  </div>
                  <audio src={newAd.mediaUrl} controls className="w-full h-10 rounded-xl" />
                </div>
              )}
            </div>
          )}

          {/* Bouton d'ajout */}
          <button
            type="button"
            onClick={handleAddAd}
            disabled={!newAd.title.trim()}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 text-white text-xs sm:text-sm font-bold shadow-xl shadow-purple-950/50 hover:scale-[1.02] active:scale-98 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            <span>Enregistrer & Diffuser cette Publicité</span>
          </button>
        </div>

        {/* Liste des publicités actives et configurées */}
        {adminAds.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {adminAds.length} publicité{adminAds.length > 1 ? 's' : ''} configurée{adminAds.length > 1 ? 's' : ''} (En ligne sur Cloudflare)
              </p>
            </div>

            <div className="space-y-3">
              {adminAds.map(ad => {
                const placementCount = Array.isArray(ad.placements) ? ad.placements.length : 0;
                return (
                  <div
                    key={ad.id}
                    className={`p-4 rounded-3xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
                      ad.active ? 'bg-white/5 border-white/10' : 'bg-white/2 border-white/5 opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      {/* Vignette média */}
                      <div className="w-16 h-14 rounded-xl overflow-hidden bg-black/50 border border-white/10 shrink-0 flex items-center justify-center">
                        {ad.mediaUrl ? (
                          ad.mediaType === 'video' ? (
                            <video src={ad.mediaUrl} muted playsInline className="w-full h-full object-cover" />
                          ) : ad.mediaType === 'audio' ? (
                            <Music className="w-6 h-6 text-emerald-400" />
                          ) : (
                            <img src={ad.mediaUrl} alt={ad.title} className="w-full h-full object-cover" />
                          )
                        ) : (
                          ad.mediaType === 'video' ? <Video className="w-5 h-5 text-purple-400" /> :
                          ad.mediaType === 'audio' ? <Music className="w-5 h-5 text-emerald-400" /> :
                          <Image className="w-5 h-5 text-pink-400" />
                        )}
                      </div>

                      {/* Détails */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="text-xs sm:text-sm font-bold text-white truncate">{ad.title}</h5>
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${
                            ad.mediaType === 'video' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                            ad.mediaType === 'audio' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                            'bg-pink-500/20 text-pink-300 border-pink-500/30'
                          }`}>
                            {ad.mediaType}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            +{ad.rewardPoints || 3} pts
                          </span>
                        </div>
                        {ad.tagline && <p className="text-xs text-slate-300 line-clamp-1">{ad.tagline}</p>}
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 flex-wrap">
                          <span>Durée : {ad.duration || 8}s</span>
                          <span>•</span>
                          <span className="text-purple-300 font-semibold">{placementCount} emplacement{placementCount > 1 ? 's' : ''}</span>
                          {ad.ctaUrl && (
                            <>
                              <span>•</span>
                              <a href={ad.ctaUrl} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline flex items-center gap-0.5">
                                <ExternalLink className="w-3 h-3" /> Lien CTA
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions Activer / Supprimer */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleAd(ad.id)}
                        className="p-2 rounded-xl hover:bg-white/10 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                        title={ad.active ? 'Désactiver' : 'Activer'}
                      >
                        {ad.active ? (
                          <>
                            <ToggleRight className="w-6 h-6 text-emerald-400" />
                            <span className="text-emerald-400 hidden sm:inline">Active</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-6 h-6 text-slate-500" />
                            <span className="text-slate-500 hidden sm:inline">Désactivée</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAd(ad.id)}
                        className="p-2 rounded-xl hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 cursor-pointer transition-colors"
                        title="Supprimer la publicité"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 space-y-2 border border-dashed border-white/10 rounded-3xl">
            <p className="text-sm font-bold text-slate-300">Aucune publicité configurée</p>
            <p className="text-xs opacity-75 max-w-sm mx-auto">
              Utilisez le formulaire ci-dessus pour téléverser votre première image, vidéo ou spot audio.
            </p>
          </div>
        )}
      </div>

      {/* Gestion des Niveaux & Badges */}
      <div className="card-lg space-y-5 border border-purple-500/25">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-white font-['Outfit'] flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-400" />
              <span>Niveaux de Prestige Read's Great</span>
            </h3>
            <p className="text-xs text-slate-400">Paliers de montée en niveau et progression des lecteurs</p>
          </div>
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
            6 Niveaux Configurés
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { level: 1, name: 'Novice Curieux', xp: '0 - 100 XP', icon: '🌱', desc: 'Découvre la bibliothèque' },
            { level: 2, name: 'Apprenti Lecteur', xp: '100 - 300 XP', icon: '⚡', desc: 'Lit et écoute régulièrement' },
            { level: 3, name: 'Lecteur Passionné', xp: '300 - 700 XP', icon: '🔥', desc: 'Enrichit sa bibliothèque' },
            { level: 4, name: 'Érudit Émérite', xp: '700 - 1500 XP', icon: '📚', desc: 'Maîtrise les œuvres classiques' },
            { level: 5, name: 'Maître du Savoir', xp: '1500 - 3000 XP', icon: '👑', desc: 'Expert des thématiques' },
            { level: 6, name: 'Sage de Read\'s Great', xp: '3000+ XP', icon: '✨', desc: 'Légende vivante de la communauté' },
          ].map((lvl) => (
            <div key={lvl.level} className="p-3.5 rounded-2xl bg-white/4 border border-white/8 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-xl shrink-0">
                {lvl.icon}
              </div>
              <div className="min-w-0">
                <span className="text-[9.5px] font-extrabold text-purple-400 uppercase">Niveau {lvl.level} • {lvl.xp}</span>
                <h4 className="text-xs font-bold text-white truncate">{lvl.name}</h4>
                <p className="text-[10px] text-slate-400 truncate">{lvl.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Outil d'attribution manuelle de Points pour l'Admin */}
      <div className="card-lg space-y-4 border border-amber-500/25">
        <h3 className="text-sm font-black text-white flex items-center gap-2">
          <Gift className="w-4 h-4 text-amber-400" />
          <span>Simulateur & Attribution de Points Récompenses</span>
        </h3>
        <p className="text-xs text-slate-400">
          Vous pouvez tester les célébrations visuelles ou créditer des points test sur votre session.
        </p>

        <div className="flex flex-wrap gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('rg:claim-points', { detail: { points: 100, xp: 50, desc: 'Bonus Admin Studio RG Play' } }));
              alert('✓ 100 Points et 50 XP crédités avec succès !');
            }}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-md"
          >
            +100 Points Test ⭐
          </button>
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new Event('rg:open-reward-ad'));
            }}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md"
          >
            Tester Modale Pub Récompensée 🎬
          </button>
        </div>
      </div>
    </div>
  );
};

export default GamificationRubric;
