import React, { useState, useEffect } from 'react';
import { Bell, Sparkles, ChevronRight, Headphones, Download, ShieldCheck, X } from 'lucide-react';
import { usePush } from '../context/PushContext';

/**
 * PushPermissionBanner — Modale VIP Persistante d'Autorisation des Notifications
 * ─────────────────────────────────────────────────────────────────────────────
 * Affichage immédiat (1.5s), persistance en badge d'ancrage si ignoré,
 * et ré-ouverture lors des interactions audio clés (Écoute / Téléchargement).
 */

export const PushPermissionBanner = () => {
  const { requestPermission, permission } = usePush();
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(() => {
    return typeof localStorage !== 'undefined' && localStorage.getItem('rg_push_banner_minimized') === 'true';
  });
  const [isActivating, setIsActivating] = useState(false);

  useEffect(() => {
    // Si notifications non supportées ou déjà traitées (granted / denied)
    if (typeof Notification === 'undefined' || permission === 'granted' || permission === 'denied') {
      setIsVisible(false);
      return;
    }

    // Affichage immédiat après 1.5 seconde de découverte
    const timer = setTimeout(() => {
      if (permission === 'default') {
        setIsVisible(true);
      }
    }, 1500);

    // Écouteur global : si l'utilisateur tente d'écouter ou télécharger sans push activé
    const onActionIntent = () => {
      if (permission === 'default') {
        setIsMinimized(false);
        setIsVisible(true);
      }
    };

    window.addEventListener('rg_require_push_prompt', onActionIntent);
    window.addEventListener('rg_play_audio_intent', onActionIntent);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('rg_require_push_prompt', onActionIntent);
      window.removeEventListener('rg_play_audio_intent', onActionIntent);
    };
  }, [permission]);

  // Si permission accordée ou bloquée par l'OS
  if (permission === 'granted' || permission === 'denied') {
    return null;
  }

  const handleActivate = async () => {
    setIsActivating(true);
    try {
      const granted = await requestPermission();
      if (granted) {
        setIsVisible(false);
        localStorage.removeItem('rg_push_banner_minimized');
      }
    } finally {
      setIsActivating(false);
    }
  };

  const handleMinimize = (e) => {
    if (e) e.stopPropagation();
    setIsMinimized(true);
    try {
      localStorage.setItem('rg_push_banner_minimized', 'true');
    } catch (_) {}
  };

  const handleMaximize = () => {
    setIsMinimized(false);
    setIsVisible(true);
    try {
      localStorage.removeItem('rg_push_banner_minimized');
    } catch (_) {}
  };

  // 1. État replié : Badge Flottant Persistant Clignotant
  if (isVisible && isMinimized) {
    return (
      <div className="fixed bottom-24 sm:bottom-28 left-4 z-45 animate-bounce">
        <button
          onClick={handleMaximize}
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-linear-to-r from-purple-700 via-fuchsia-600 to-pink-600 text-white shadow-[0_8px_25px_rgba(168,85,247,0.5)] border border-white/20 text-xs font-black cursor-pointer hover:scale-105 transition-transform"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
          </span>
          <Bell size={14} className="fill-white" />
          <span>Activer les notifications</span>
        </button>
      </div>
    );
  }

  // 2. État plein : Modale VIP Engageante et Immersive
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-lg rounded-3xl p-5 sm:p-7 border-2 border-purple-400/80 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_50px_rgba(168,85,247,0.4)] bg-linear-to-br from-[#1a0b33]/98 via-[#120624]/98 to-[#090214]/98 backdrop-blur-2xl relative overflow-hidden text-left">
        {/* Halos d'ambiance */}
        <div className="absolute -top-16 -right-16 w-44 h-44 bg-purple-500/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-14 -left-14 w-40 h-40 bg-pink-500/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          {/* Entête */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-tr from-purple-600 via-fuchsia-600 to-pink-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-purple-500/50 border border-white/25">
                <Bell size={26} className="fill-white animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center gap-1">
                    <Sparkles size={11} /> ACTIVATION REQUISE
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wider font-['Outfit'] mt-1 leading-tight">
                  Restez Connecté à la Communauté
                </h3>
              </div>
            </div>

            <button
              onClick={handleMinimize}
              className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
              title="Réduire"
            >
              <X size={18} />
            </button>
          </div>

          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Pour profiter pleinement de RG Play, être averti dès qu'un <strong className="text-white">nouvel audio sort</strong> et voir ce que <strong className="text-purple-300">les autres auditeurs écoutent en direct</strong> :
          </p>

          {/* Avantages VIP */}
          <div className="space-y-2 py-1">
            <div className="flex items-center gap-2.5 text-xs text-slate-200">
              <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0 text-purple-300">
                <Headphones size={13} />
              </div>
              <span>Alertes instantanées à chaque nouveau livre audio &amp; PDF</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-200">
              <div className="w-6 h-6 rounded-lg bg-pink-500/20 flex items-center justify-center shrink-0 text-pink-300">
                <Download size={13} />
              </div>
              <span>Téléchargement hors-ligne et accès aux chapitres exclusifs</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-200">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-300">
                <ShieldCheck size={13} />
              </div>
              <span>100% Gratuit, garanti sans spam ni publicité abusive</span>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2">
            <button
              onClick={handleActivate}
              disabled={isActivating}
              className="flex-1 py-4 px-6 rounded-2xl bg-linear-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm sm:text-base font-black shadow-2xl shadow-purple-600/50 flex items-center justify-center gap-3 transition-all duration-200 active:scale-95 disabled:opacity-50 cursor-pointer border-2 border-purple-300/60 hover:scale-[1.02]"
            >
              {isActivating ? (
                <>
                  <span className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Activation en cours...</span>
                </>
              ) : (
                <>
                  <Bell size={20} className="fill-white animate-bounce shrink-0" />
                  <span className="tracking-wide uppercase">AUTORISER LES NOTIFICATIONS</span>
                  <ChevronRight size={20} />
                </>
              )}
            </button>

            <button
              onClick={handleMinimize}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 text-xs font-semibold transition-colors text-center hover:bg-white/5 cursor-pointer"
            >
              Plus tard
            </button>
          </div>

          <p className="text-center text-[10px] text-purple-200/50">
            ✓ Activé via Google Firebase Cloud Messaging sécurisé
          </p>
        </div>
      </div>
    </div>
  );
};
