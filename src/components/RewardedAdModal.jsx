import React, { useState, useEffect, useRef } from "react";
import {
  X, Play, Gift, Sparkles, CheckCircle2, ShieldCheck,
  Timer, Volume2, VolumeX, Music, ExternalLink, Headphones,
  Clock, Maximize2, ZoomIn
} from "lucide-react";
import { useXp } from "../context/XpContext";
import { apiClient } from "../services/api";

const FALLBACK_OFFERS = [
  {
    id: "fb-1",
    title: "CamerPay — Paiement Mobile Money",
    tagline: "Payez vos livres et abonnements en 1 clic. Orange Money, MTN MoMo.",
    mediaType: "image",
    mediaUrl: null,
    aspectRatio: "16:9",
    gradient: "from-amber-600 to-orange-700",
    icon: "💳",
    duration: 8,
    rewardPoints: 3,
    ctaUrl: "https://camerpay.biz",
    ctaText: "Découvrir CamerPay"
  },
  {
    id: "fb-2",
    title: "Read's Great VIP Club",
    tagline: "Rejoignez la plus grande communauté de lecteurs d'Afrique.",
    mediaType: "image",
    mediaUrl: null,
    aspectRatio: "1:1",
    gradient: "from-purple-600 to-indigo-700",
    icon: "📚",
    duration: 8,
    rewardPoints: 3,
    ctaUrl: "https://wa.me/237699456779",
    ctaText: "Rejoindre la Communauté"
  },
];

function getAdRewardPoints() {
  try {
    const rules = JSON.parse(localStorage.getItem("rg_gamification_rules") || "{}");
    return Number(rules.adRewardPoints) || 3;
  } catch (_) {
    return 3;
  }
}

export function RewardedAdModal({ isOpen, onClose }) {
  const { points, awardPointsAndXp } = useXp();
  const [ads, setAds] = useState([]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [phase, setPhase] = useState("preview"); // 'preview' | 'watching' | 'done'
  const [countdown, setCountdown] = useState(8);
  const [muted, setMuted] = useState(false);
  const [ctaClicked, setCtaClicked] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  const currentAd = ads[currentAdIndex] || null;
  const rewardPts = currentAd?.rewardPoints || getAdRewardPoints() || 3;
  const AD_DURATION = currentAd?.duration || 8;

  useEffect(() => {
    if (!isOpen) {
      if (videoRef.current) videoRef.current.pause();
      if (audioRef.current) audioRef.current.pause();
      clearInterval(timerRef.current);
      setIsLightboxOpen(false);
      return;
    }

    apiClient.getAds({ placement: 'reward_modal' }).then(loaded => {
      const pool = (Array.isArray(loaded) && loaded.length > 0) ? loaded : FALLBACK_OFFERS;
      setAds(pool);
      setCurrentAdIndex(0);
      setPhase("preview");
      setCtaClicked(false);
      setIsLightboxOpen(false);
      setCountdown(pool[0]?.duration || 8);
    }).catch(() => {
      setAds(FALLBACK_OFFERS);
      setCurrentAdIndex(0);
      setPhase("preview");
      setCtaClicked(false);
      setIsLightboxOpen(false);
      setCountdown(FALLBACK_OFFERS[0]?.duration || 8);
    });
  }, [isOpen]);

  useEffect(() => {
    if (phase !== "watching") return;
    setCountdown(AD_DURATION);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAdComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, AD_DURATION]);

  const handleStartWatch = () => {
    setPhase("watching");
    if (currentAd?.mediaType === "video" && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
    if (currentAd?.mediaType === "audio" && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  };

  const handleAdComplete = () => {
    setPhase("done");
    if (videoRef.current) videoRef.current.pause();
    if (audioRef.current) audioRef.current.pause();
    if (!currentAd?.ctaUrl || ctaClicked) {
      awardPointsAndXp({
        xp: 1,
        points: rewardPts,
        type: "ad_reward",
        description: `Pub vue : ${currentAd?.title || "Sponsor"}`,
      });
      window.dispatchEvent(new CustomEvent('rg:ad-reward-completed', { detail: { points: rewardPts } }));
    }
  };

  const handleCtaClick = () => {
    setCtaClicked(true);
    if (phase === "done" || phase === "watching") {
      awardPointsAndXp({
        xp: 1,
        points: rewardPts,
        type: "ad_reward",
        description: `CTA cliqué : ${currentAd?.title || "Sponsor"}`,
      });
      window.dispatchEvent(new CustomEvent('rg:ad-reward-completed', { detail: { points: rewardPts } }));
      if (phase === "watching") {
        clearInterval(timerRef.current);
        setPhase("done");
        if (videoRef.current) videoRef.current.pause();
        if (audioRef.current) audioRef.current.pause();
      }
    }
    if (currentAd?.ctaUrl) {
      window.open(currentAd.ctaUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (!isOpen || !currentAd) return null;

  const isVideo = currentAd.mediaType === "video" && currentAd.mediaUrl;
  const isAudio = currentAd.mediaType === "audio" && currentAd.mediaUrl;
  const isImage = currentAd.mediaType === "image" && currentAd.mediaUrl;
  const progress = ((AD_DURATION - countdown) / AD_DURATION) * 100;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      {/* Conteneur modale optimisé taille réelle */}
      <div className="bg-[#100820] border border-purple-500/30 rounded-3xl max-w-lg w-full max-h-[94vh] flex flex-col overflow-hidden shadow-2xl shadow-purple-950/80 text-white relative">

        {/* Audio invisible contrôlé par ref */}
        {isAudio && (
          <audio ref={audioRef} src={currentAd.mediaUrl} preload="auto" />
        )}

        {/* Barre d'en-tête de la modale */}
        <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-purple-500/20 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
              <Gift className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm text-white leading-tight truncate">Offre Sponsorisée</h3>
              <p className="text-[10px] text-purple-300/80 truncate">
                Gagnez +{rewardPts} pts ⭐ en cliquant sur le lien
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-purple-300 hover:text-white transition-colors cursor-pointer shrink-0"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corps de la modale avec défilement fluide si nécessaire */}
        <div className="p-3.5 sm:p-5 space-y-3.5 overflow-y-auto overscroll-contain flex-1">

          {/* ── PHASE PREVIEW (Avant de lancer le timer) ── */}
          {phase === "preview" && (
            <>
              {/* Conteneur média plein format */}
              <div className="w-full relative rounded-2xl overflow-hidden bg-black/60 border border-white/10 flex items-center justify-center p-1.5"
                   style={{ minHeight: '260px', maxHeight: '58vh' }}>
                {isVideo ? (
                  <video
                    ref={videoRef}
                    src={currentAd.mediaUrl}
                    muted={muted}
                    playsInline
                    loop
                    autoPlay
                    className="w-full max-h-[56vh] object-contain rounded-xl"
                  />
                ) : isAudio ? (
                  <div className="w-full h-full min-h-[220px] p-6 bg-gradient-to-br from-emerald-950/80 via-[#101b2b] to-purple-950/80 flex flex-col items-center justify-center gap-2.5 rounded-xl">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300">
                      <Headphones className="w-7 h-7" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                      Spot Audio Partenaire
                    </span>
                    <h4 className="font-extrabold text-base text-white text-center leading-snug">{currentAd.title}</h4>
                    {currentAd.tagline && <p className="text-xs text-slate-300 text-center">{currentAd.tagline}</p>}
                  </div>
                ) : isImage ? (
                  <div className="relative w-full h-full flex items-center justify-center group">
                    <img
                      src={currentAd.mediaUrl}
                      alt={currentAd.title}
                      onClick={() => setIsLightboxOpen(true)}
                      className="w-auto h-auto max-w-full max-h-[56vh] object-contain mx-auto rounded-xl select-none cursor-zoom-in transition-transform duration-200 group-hover:scale-[1.01]"
                    />
                    <button
                      type="button"
                      onClick={() => setIsLightboxOpen(true)}
                      className="absolute top-2 right-2 px-2.5 py-1 rounded-xl bg-black/75 hover:bg-black text-white/90 border border-white/20 text-[11px] font-bold flex items-center gap-1.5 shadow-lg backdrop-blur-md cursor-pointer transition-all active:scale-95"
                      title="Agrandir en plein écran"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Agrandir</span>
                    </button>
                  </div>
                ) : (
                  <div className={`w-full min-h-[220px] bg-gradient-to-br ${currentAd.gradient || "from-purple-600 to-pink-700"} flex flex-col items-center justify-center text-center gap-2 p-6 rounded-xl`}>
                    <div className="text-5xl mb-1">{currentAd.icon || "📢"}</div>
                    <h4 className="font-extrabold text-base text-white leading-snug">{currentAd.title}</h4>
                    {currentAd.tagline && <p className="text-xs text-white/80 mt-1">{currentAd.tagline}</p>}
                  </div>
                )}
              </div>

              {(isImage || isVideo) && (
                <div>
                  <h4 className="font-bold text-sm text-white">{currentAd.title}</h4>
                  {currentAd.tagline && <p className="text-xs text-purple-300/80 mt-0.5">{currentAd.tagline}</p>}
                </div>
              )}

              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs text-amber-300 font-semibold">
                  Cliquez sur le lien partenaire → <strong>+{rewardPts} pts instantanés</strong>
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {/* CTA principal */}
                {currentAd.ctaUrl && (
                  <button
                    type="button"
                    onClick={handleCtaClick}
                    className="w-full py-3 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 text-white shadow-lg hover:scale-[1.02] transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>{currentAd.ctaText || 'Visiter le partenaire'} → +{rewardPts} pts</span>
                  </button>
                )}

                <button
                  onClick={handleStartWatch}
                  className="w-full py-2.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-purple-300 border border-white/10 transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Regarder la pub ({AD_DURATION}s)</span>
                  <Clock className="w-3.5 h-3.5 opacity-60" />
                </button>
              </div>
            </>
          )}

          {/* ── PHASE WATCHING (Lecture de la pub en cours) ── */}
          {phase === "watching" && (
            <div className="space-y-3.5">
              {/* Conteneur média plein format */}
              <div className="w-full relative rounded-2xl overflow-hidden bg-black/70 border border-white/10 flex items-center justify-center p-1.5"
                   style={{ minHeight: '260px', maxHeight: '58vh' }}>
                {isVideo ? (
                  <>
                    <video
                      ref={videoRef}
                      src={currentAd.mediaUrl}
                      muted={muted}
                      playsInline
                      autoPlay
                      className="w-full max-h-[56vh] object-contain rounded-xl"
                    />
                    <button
                      onClick={() => { setMuted((m) => !m); if (videoRef.current) videoRef.current.muted = !muted; }}
                      className="absolute bottom-2.5 right-2.5 p-1.5 rounded-lg bg-black/70 hover:bg-black text-white cursor-pointer"
                    >
                      {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  </>
                ) : isAudio ? (
                  <div className="w-full h-full min-h-[220px] p-6 bg-gradient-to-br from-emerald-950/90 via-[#0e1726] to-purple-950/90 flex flex-col items-center justify-center text-center gap-3 rounded-xl">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400/40 flex items-center justify-center text-emerald-300 animate-pulse">
                      <Music className="w-8 h-8 animate-spin" style={{ animationDuration: '6s' }} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">{currentAd.title}</h4>
                      {currentAd.tagline && <p className="text-xs text-emerald-300/80 mt-0.5">{currentAd.tagline}</p>}
                    </div>
                  </div>
                ) : isImage ? (
                  <div className="relative w-full h-full flex items-center justify-center group">
                    <img
                      src={currentAd.mediaUrl}
                      alt={currentAd.title}
                      onClick={() => setIsLightboxOpen(true)}
                      className="w-auto h-auto max-w-full max-h-[56vh] object-contain mx-auto rounded-xl select-none cursor-zoom-in transition-transform duration-200 group-hover:scale-[1.01]"
                    />
                    <button
                      type="button"
                      onClick={() => setIsLightboxOpen(true)}
                      className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-xl bg-black/75 hover:bg-black text-white/90 border border-white/20 text-[11px] font-bold flex items-center gap-1.5 shadow-lg backdrop-blur-md cursor-pointer transition-all active:scale-95"
                      title="Agrandir en plein écran"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Agrandir</span>
                    </button>
                  </div>
                ) : (
                  <div className={`w-full min-h-[220px] bg-gradient-to-br ${currentAd.gradient || "from-purple-600 to-pink-700"} flex flex-col items-center justify-center text-center gap-3 p-6 rounded-xl`}>
                    <div className="text-5xl">{currentAd.icon || "📢"}</div>
                    <h4 className="font-bold text-sm text-white">{currentAd.title}</h4>
                  </div>
                )}

                {/* Badge Timer avec fond sombre lisible */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-black/80 backdrop-blur-md border border-white/15 rounded-xl px-3 py-1 z-10 shadow-lg">
                  <Timer className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                  <span className="text-xs font-black text-amber-300 font-mono">{countdown}s</span>
                </div>
              </div>

              {/* Barre de progression */}
              <div className="space-y-1.5">
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-400 to-pink-500 transition-all duration-1000"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-[10px] text-purple-300/70 text-center">
                  Puis cliquez le lien partenaire pour valider vos +{rewardPts} points...
                </p>
              </div>

              {/* CTA cliquable pendant la pub */}
              {currentAd.ctaUrl && (
                <button
                  type="button"
                  onClick={handleCtaClick}
                  className={`w-full py-2.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    ctaClicked
                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                      : 'bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 text-white shadow-lg hover:scale-[1.02]'
                  }`}
                >
                  {ctaClicked ? (
                    <><CheckCircle2 className="w-4 h-4" /><span>Lien visité ✅ — Points crédités !</span></>
                  ) : (
                    <><ExternalLink className="w-4 h-4" /><span>{currentAd.ctaText || 'Visiter le partenaire'} → +{rewardPts} pts</span></>
                  )}
                </button>
              )}
            </div>
          )}

          {/* ── PHASE DONE (Récompense attribuée) ── */}
          {phase === "done" && (
            <div className="py-4 flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-3xl">🎉</div>
              <div>
                <h4 className="font-extrabold text-lg text-emerald-300">Récompense Débloquée !</h4>
                <p className="text-xs text-purple-200 mt-1">
                  Vous avez gagné{' '}
                  <strong className="text-amber-400">+{rewardPts} points de fidélité ⭐</strong>
                </p>
                <div className="mt-2 text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl inline-block">
                  Nouveau Solde : {points} points
                </div>
              </div>

              {currentAd.ctaUrl && !ctaClicked && (
                <button
                  type="button"
                  onClick={handleCtaClick}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-pink-500 flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <span>{currentAd.ctaText || "Visiter le partenaire sponsor"}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}

              {currentAd.ctaUrl && ctaClicked && (
                <div className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Lien visité — Points crédités !</span>
                </div>
              )}

              <div className="w-full space-y-2">
                <button
                  onClick={() => { onClose(); window.dispatchEvent(new CustomEvent("rg:navigate-tab", { detail: "library" })); }}
                  className="w-full py-3 rounded-2xl font-bold text-sm bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg hover:scale-[1.02] transition-transform cursor-pointer"
                >
                  Utiliser mes points pour débloquer un livre →
                </button>
                <button onClick={onClose} className="w-full py-2 rounded-xl font-semibold text-xs text-slate-400 hover:text-white transition-colors cursor-pointer">
                  Fermer
                </button>
              </div>
            </div>
          )}
        </div>

        {phase !== "done" && (
          <div className="px-4 py-2.5 border-t border-white/5 flex items-center justify-center gap-2 text-[10px] text-slate-400 flex-shrink-0">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Offre vérifiée par Read's Great • Attribution instantanée</span>
          </div>
        )}
      </div>

      {/* ── LIGHTBOX PLEIN ÉCRAN POUR AFFICHE PUBLICITAIRE (TAILLE RÉELLE 100%) ── */}
      {isLightboxOpen && isImage && (
        <div
          className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-md flex flex-col items-center justify-between p-3 sm:p-5 animate-in fade-in duration-200"
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Barre supérieure Lightbox */}
          <div className="w-full max-w-2xl flex items-center justify-between z-10 py-1" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2.5 py-0.5 rounded-full bg-purple-600/40 border border-purple-400/40 text-xs font-bold text-white shrink-0">
                Affiche Haute Résolution
              </span>
              <h4 className="text-xs sm:text-sm font-bold text-white truncate">{currentAd.title}</h4>
            </div>
            <button
              onClick={() => setIsLightboxOpen(false)}
              className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer shrink-0"
              title="Quitter le plein écran"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Image en taille réelle */}
          <div className="flex-1 w-full max-w-2xl flex items-center justify-center p-2 overflow-auto" onClick={(e) => e.stopPropagation()}>
            <img
              src={currentAd.mediaUrl}
              alt={currentAd.title}
              className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-2xl border border-white/10"
            />
          </div>

          {/* Barre inférieure Lightbox */}
          <div className="w-full max-w-md pt-2 flex items-center justify-center gap-3 z-10" onClick={(e) => e.stopPropagation()}>
            {currentAd.ctaUrl && (
              <button
                type="button"
                onClick={() => {
                  handleCtaClick();
                  setIsLightboxOpen(false);
                }}
                className="flex-1 py-3 px-4 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 text-white shadow-xl hover:scale-105 transition-all cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>{currentAd.ctaText || 'Visiter le partenaire'} → +{rewardPts} pts</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsLightboxOpen(false)}
              className="px-4 py-3 rounded-2xl font-bold text-xs sm:text-sm bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default RewardedAdModal;
