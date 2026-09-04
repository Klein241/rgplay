import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Gift, Sparkles, ArrowRight, ExternalLink, Play, Music, ChevronLeft, ChevronRight } from 'lucide-react';
import { useXp } from '../context/XpContext';
import { apiClient } from '../services/api';

// Délai entre chaque pub du carrousel (ms)
const CAROUSEL_INTERVAL = 6000;

export function AdBanner({ onOpenRewardModal, placement = 'discover_hero', className = '' }) {
  const { points } = useXp();
  const [ads, setAds] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = useRef(null);

  const loadAds = useCallback(() => {
    apiClient.getAds({ placement }).then(result => {
      if (Array.isArray(result) && result.length > 0) {
        setAds(result.filter(a => a.active !== false));
        setCurrentIndex(0);
      } else {
        setAds([]);
      }
    }).catch(() => setAds([]));
  }, [placement]);

  useEffect(() => {
    loadAds();
    const handleUpdate = () => loadAds();
    window.addEventListener('rg:ads-updated', handleUpdate);
    return () => window.removeEventListener('rg:ads-updated', handleUpdate);
  }, [loadAds]);

  // Carrousel automatique
  useEffect(() => {
    if (ads.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % ads.length);
    }, CAROUSEL_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [ads.length]);

  const goTo = (idx) => {
    clearInterval(timerRef.current);
    setCurrentIndex(idx);
    // Reprendre après interaction
    timerRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % ads.length);
    }, CAROUSEL_INTERVAL);
  };

  const goNext = () => goTo((currentIndex + 1) % ads.length);
  const goPrev = () => goTo((currentIndex - 1 + ads.length) % ads.length);

  // ── Aucune pub configurée : bannière Read's Great par défaut ─────────
  if (ads.length === 0) {
    const defaultRewardPts = (() => {
      try {
        const rules = JSON.parse(localStorage.getItem('rg_gamification_rules') || '{}');
        return Number(rules.adRewardPoints) || 3;
      } catch { return 3; }
    })();

    return (
      <div
        className={`relative overflow-hidden rounded-3xl p-5 sm:p-6 border border-purple-500/30 bg-gradient-to-r from-purple-950/80 via-[#1e0d36] to-pink-950/60 shadow-xl shadow-purple-950/40 ${className}`}
      >
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-pink-500/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-pink-500 flex items-center justify-center text-2xl shadow-lg shadow-amber-500/30 shrink-0">
              🎁
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Offre Gratuite Read's Great
                </span>
                <span className="text-xs text-purple-300/80">Solde : <strong className="text-amber-400 font-bold">{points} pts</strong></span>
              </div>
              <h3 className="font-extrabold text-base sm:text-lg text-white leading-tight">
                Débloquez des livres audio &amp; e-books gratuitement !
              </h3>
              <p className="text-xs text-purple-200/70 mt-1 max-w-lg">
                Regardez une courte présentation partenaire ou invitez vos amis pour accumuler des points de déblocage instantanés.
              </p>
            </div>
          </div>

          <button
            onClick={onOpenRewardModal}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 text-white shadow-lg shadow-amber-500/25 hover:scale-105 active:scale-95 transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Gagner +{defaultRewardPts} Points</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── Carrousel de pubs ────────────────────────────────────────────────
  const ad = ads[currentIndex];
  const rewardPts = ad?.rewardPoints || 3;
  const isImage = ad?.mediaType === 'image' && ad?.mediaUrl;
  const isVideo = ad?.mediaType === 'video' && ad?.mediaUrl;
  const isAudio = ad?.mediaType === 'audio' && ad?.mediaUrl;
  const hasMultiple = ads.length > 1;

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-pink-500/30 bg-gradient-to-r from-purple-950/90 via-[#1b0c30] to-pink-950/70 shadow-xl shadow-purple-950/50 ${className}`}>
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-pink-500/20 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />

      {/* Contenu pub actuelle */}
      <div className="relative z-10 p-4 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0 flex-1">
          {/* Visuel du sponsor */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-black/50 border border-white/10 shrink-0 flex items-center justify-center shadow-lg">
            {isVideo ? (
              <video src={ad.mediaUrl} muted autoPlay loop playsInline className="w-full h-full object-cover" />
            ) : isAudio ? (
              <div className="w-full h-full bg-emerald-900/40 flex items-center justify-center text-emerald-300">
                <Music className="w-8 h-8 animate-pulse" />
              </div>
            ) : isImage ? (
              <img src={ad.mediaUrl} alt={ad.title} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl">{ad.icon || '📢'}</span>
            )}
          </div>

          {/* Texte */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                Partenaire Officiel
              </span>
              <span className="text-[11px] text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                +{rewardPts} pts ⭐
              </span>
              {hasMultiple && (
                <span className="text-[10px] text-purple-300/60 font-mono">
                  {currentIndex + 1}/{ads.length}
                </span>
              )}
            </div>
            <h3 className="font-extrabold text-base sm:text-lg text-white leading-snug truncate">
              {ad.title}
            </h3>
            {ad.tagline && (
              <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">{ad.tagline}</p>
            )}
          </div>
        </div>

        {/* Boutons */}
        <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 flex-wrap">
          {ad.ctaUrl && (
            <a
              href={ad.ctaUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 md:flex-none px-4 py-3 rounded-2xl font-bold text-xs bg-white/10 hover:bg-white/20 text-white border border-white/15 flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
            >
              <span>{ad.ctaText || 'Découvrir'}</span>
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
            </a>
          )}
          <button
            onClick={onOpenRewardModal}
            className="flex-1 md:flex-none px-5 py-3 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 text-white shadow-lg shadow-amber-500/30 hover:scale-105 active:scale-95 transition-all whitespace-nowrap cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span>Gagner +{rewardPts} Pts</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Carrousel controls + dots */}
      {hasMultiple && (
        <div className="relative z-10 px-4 pb-3 flex items-center justify-between">
          {/* Boutons prev/next */}
          <div className="flex items-center gap-2">
            <button
              onClick={goPrev}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-purple-300 hover:text-white transition-colors cursor-pointer"
              aria-label="Publicité précédente"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={goNext}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-purple-300 hover:text-white transition-colors cursor-pointer"
              aria-label="Publicité suivante"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Dots de navigation */}
          <div className="flex items-center gap-1.5">
            {ads.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`rounded-full transition-all duration-300 cursor-pointer ${
                  i === currentIndex
                    ? 'w-5 h-2 bg-amber-400'
                    : 'w-2 h-2 bg-white/25 hover:bg-white/50'
                }`}
                aria-label={`Aller à la publicité ${i + 1}`}
              />
            ))}
          </div>

          {/* Barre de progression auto */}
          <div className="h-0.5 w-16 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-pink-500 rounded-full"
              style={{
                animation: `carousel-progress ${CAROUSEL_INTERVAL}ms linear infinite`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default AdBanner;
