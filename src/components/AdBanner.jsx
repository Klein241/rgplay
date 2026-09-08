import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, ArrowRight, Eye, CheckCircle } from 'lucide-react';
import { useXp } from '../context/XpContext';
import { apiClient } from '../services/api';
import { trackAdImpression, trackAdClick } from '../services/tracker';

// Clé sessionStorage pour les pubs vues dans la session courante
const SESSION_SEEN_KEY = 'rg_session_seen_ads';

function getSessionSeenAds() {
  try {
    const sessionSeen = JSON.parse(sessionStorage.getItem(SESSION_SEEN_KEY) || '[]');
    const localRaw = JSON.parse(localStorage.getItem('rg_seen_reward_ads') || '{}');
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const localSeen = Object.entries(localRaw)
      .filter(([_, ts]) => typeof ts === 'number' && now - ts < DAY_MS)
      .map(([id]) => id);
    return Array.from(new Set([...sessionSeen, ...localSeen]));
  } catch {
    return [];
  }
}

function markAdAsSeen(adId) {
  try {
    const seen = JSON.parse(sessionStorage.getItem(SESSION_SEEN_KEY) || '[]');
    if (!seen.includes(adId)) {
      seen.push(adId);
      sessionStorage.setItem(SESSION_SEEN_KEY, JSON.stringify(seen));
    }
  } catch {}
}

export function AdBanner({ onOpenRewardModal, placement = 'discover_hero', className = '' }) {
  const { points } = useXp();
  const [allAds, setAllAds] = useState([]);
  // IDs des pubs retirées (vues)
  const [removedIds, setRemovedIds] = useState(() => getSessionSeenAds());

  const loadAds = useCallback(() => {
    apiClient.getAds({ placement }).then(result => {
      if (Array.isArray(result) && result.length > 0) {
        setAllAds(result.filter(a => a.active !== false));
      } else {
        setAllAds([]);
      }
    }).catch(() => setAllAds([]));
  }, [placement]);

  useEffect(() => {
    loadAds();
    const handleUpdate = () => loadAds();
    window.addEventListener('rg:ads-updated', handleUpdate);
    return () => window.removeEventListener('rg:ads-updated', handleUpdate);
  }, [loadAds]);

  // Écouter les événements de pub vue (émis par RewardedAdModal lors du visionnage ou clic lien)
  useEffect(() => {
    const handleAdSeenEvent = (e) => {
      const seenAdId = e?.detail?.adId;
      if (seenAdId) {
        markAdAsSeen(seenAdId);
        setRemovedIds(prev => (prev.includes(seenAdId) ? prev : [...prev, seenAdId]));
      }
    };
    window.addEventListener('rg:ad-seen', handleAdSeenEvent);
    return () => window.removeEventListener('rg:ad-seen', handleAdSeenEvent);
  }, []);

  // Pubs encore visibles (non vues)
  const visibleAds = allAds.filter(a => !removedIds.includes(a.id));

  const defaultPromoAd = {
    id: 'campaign_rg_welcome',
    title: "Offre Spéciale Read's Great",
    mediaType: 'image',
    format: 'Bannière Interactive',
    placement: placement || 'discover_hero',
    rewardPoints: 30,
    ctaUrl: 'https://readgreat.com',
  };

  // Tracker l'impression des pubs visibles ou de la bannière par défaut
  useEffect(() => {
    if (visibleAds.length > 0) {
      visibleAds.forEach(ad => trackAdImpression(ad, placement));
    } else if (allAds.length === 0) {
      trackAdImpression(defaultPromoAd, placement);
    }
  }, [visibleAds.length, allAds.length, placement]);

  // Clic direct sur une carte : ouvre immédiatement la modale officielle de cette pub
  const handleCardClick = (ad) => {
    trackAdClick(ad, placement);
    if (onOpenRewardModal) {
      onOpenRewardModal(ad);
    }
    window.dispatchEvent(new CustomEvent('rg:open-reward-ad', { detail: { ad } }));
  };

  // ── Aucune pub configurée : bannière Read's Great par défaut ──────────
  if (allAds.length === 0) {
    const defaultRewardPts = (() => {
      try {
        const rules = JSON.parse(localStorage.getItem('rg_gamification_rules') || '{}');
        return Number(rules.adRewardPoints) || 3;
      } catch { return 3; }
    })();

    return (
      <div className={`relative overflow-hidden rounded-3xl p-5 sm:p-6 border border-purple-500/30 bg-gradient-to-r from-purple-950/80 via-[#1e0d36] to-pink-950/60 shadow-xl shadow-purple-950/40 ${className}`}>
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-pink-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-pink-500 flex items-center justify-center text-2xl shadow-lg shadow-amber-500/30 shrink-0">🎁</div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">Offre Gratuite Read's Great</span>
                <span className="text-xs text-purple-300/80">Solde : <strong className="text-amber-400 font-bold">{points} pts</strong></span>
              </div>
              <h3 className="font-extrabold text-base sm:text-lg text-white leading-tight">Débloquez des livres audio &amp; e-books gratuitement !</h3>
              <p className="text-xs text-purple-200/70 mt-1 max-w-lg">Regardez une courte présentation partenaire ou invitez vos amis pour accumuler des points de déblocage instantanés.</p>
            </div>
          </div>
          <button
            onClick={() => {
              trackAdClick(defaultPromoAd, placement);
              if (onOpenRewardModal) onOpenRewardModal(defaultPromoAd);
              window.dispatchEvent(new CustomEvent('rg:open-reward-ad', { detail: { ad: defaultPromoAd } }));
            }}
            className="btn-blinking-border w-full sm:w-auto px-6 py-3.5 sm:px-7 sm:py-4 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 text-white shadow-2xl hover:scale-105 active:scale-95 transition-all whitespace-nowrap shrink-0 cursor-pointer border-amber-400"
          >
            <Sparkles className="w-5 h-5 text-amber-200 animate-spin" style={{ animationDuration: '3s' }} />
            <span className="tracking-wide">Gagner +{defaultRewardPts} Points 🎁</span>
            <ArrowRight className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    );
  }

  // ── Toutes les pubs ont été vues ──────────────────────────────────────
  if (visibleAds.length === 0) {
    return (
      <div className={`relative overflow-hidden rounded-3xl p-4 sm:p-5 border border-emerald-500/20 bg-gradient-to-r from-emerald-950/60 via-[#0e1a14] to-teal-950/50 shadow-lg ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-300">Toutes les publicités ont été vues ✓</p>
            <p className="text-xs text-slate-400">Revenez demain pour de nouvelles offres partenaires !</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-amber-300 font-bold">Solde actuel</p>
            <p className="text-lg font-black text-amber-400">{points} pts</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Bande de cartes individuelles ────────────────────────────────────
  return (
    <div className={`${className}`}>
      {/* En-tête */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-pink-500/15 text-pink-300 border border-pink-500/25">
            🤝 Partenaires Officiels
          </span>
          <span className="text-[10px] text-slate-400">
            {visibleAds.length} annonce{visibleAds.length > 1 ? 's' : ''} • Cliquez pour voir &amp; gagner des points
          </span>
        </div>
        <span className="text-xs text-amber-300 font-bold">{points} pts ⭐</span>
      </div>

      {/* Grille de cartes horizontales scrollables */}
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
        {visibleAds.map((ad) => {
          const rewardPts = ad.rewardPoints || 0;
          const isImage = ad.mediaType === 'image' && ad.mediaUrl;
          const isVideo = ad.mediaType === 'video' && ad.mediaUrl;

          return (
            <div
              key={ad.id}
              onClick={() => handleCardClick(ad)}
              className="relative flex-shrink-0 snap-start w-52 sm:w-60 cursor-pointer rounded-2xl border border-white/10 bg-gradient-to-br from-purple-950/80 via-[#1b0c2a] to-pink-950/60 hover:border-purple-500/40 hover:scale-[1.02] transition-all duration-200 overflow-hidden shadow-lg group"
            >
              {/* Badge reward */}
              {rewardPts > 0 && (
                <div className="absolute top-2 right-2 z-10 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-500/90 text-black shadow-md">
                  +{rewardPts} pts
                </div>
              )}

              {/* Visuel */}
              <div className="w-full h-24 bg-black/40 overflow-hidden flex items-center justify-center border-b border-white/8 relative">
                {isVideo ? (
                  <video src={ad.mediaUrl} muted autoPlay loop playsInline className="w-full h-full object-cover" />
                ) : isImage ? (
                  <img src={ad.mediaUrl} alt={ad.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl">{ad.icon || '📢'}</span>
                )}
                {/* Overlay hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 flex items-center justify-center transition-all duration-200">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                    <Eye className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>

              {/* Texte */}
              <div className="p-3">
                <p className="text-xs font-bold text-white truncate leading-tight">{ad.title}</p>
                {ad.tagline && (
                  <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2 leading-tight">{ad.tagline}</p>
                )}
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full w-0 group-hover:w-full bg-gradient-to-r from-amber-400 to-pink-500 rounded-full transition-all duration-300" />
                  </div>
                  <span className="text-[9px] text-purple-300 font-semibold">Voir</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AdBanner;
