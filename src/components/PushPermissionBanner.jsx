import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Sparkles, ChevronRight } from 'lucide-react';
import { usePush } from '../context/PushContext';

// ── Délais d'affichage ──
const INITIAL_DELAY_MS = 2 * 60 * 1000;  // 2 minutes après l'arrivée
const REMIND_INTERVAL_MS = 5 * 60 * 1000; // Rappel toutes les 5 minutes si non activé

export const PushPermissionBanner = () => {
  const { requestPermission, permission } = usePush();
  const [isVisible, setIsVisible] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const sessionStartTimeRef = useRef(Date.now());

  // Nettoyage immédiat de l'ancien état "minimized" qui restait figé sur l'écran
  useEffect(() => {
    try {
      localStorage.removeItem('rg_push_banner_minimized');
    } catch (_) {}
  }, []);

  useEffect(() => {
    // Si notifications non supportées, déjà autorisées ou bloquées par le navigateur, ne pas afficher
    if (typeof Notification === 'undefined' || permission === 'granted' || permission === 'denied') {
      setIsVisible(false);
      return;
    }

    const checkShouldShow = () => {
      if (permission !== 'default') return false;

      const now = Date.now();
      const elapsedSinceLoad = now - sessionStartTimeRef.current;
      if (elapsedSinceLoad < INITIAL_DELAY_MS) return false;

      try {
        const lastDismissed = Number(sessionStorage.getItem('rg_push_banner_dismissed_at') || 0);
        if (lastDismissed && now - lastDismissed < REMIND_INTERVAL_MS) {
          return false;
        }
      } catch (_) {}

      return true;
    };

    // 1. Minuteur initial de 2 minutes
    const initialTimer = setTimeout(() => {
      if (checkShouldShow()) {
        setIsVisible(true);
      }
    }, INITIAL_DELAY_MS);

    // 2. Intervalle régulier de rappel si l'utilisateur ne l'a pas activé
    const intervalTimer = setInterval(() => {
      if (!isVisible && checkShouldShow()) {
        setIsVisible(true);
      }
    }, 30000); // vérifie toutes les 30s si l'intervalle est atteint

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, [permission, isVisible]);

  // Si les notifications sont déjà traitées ou bannière masquée
  if (permission === 'granted' || permission === 'denied' || !isVisible) {
    return null;
  }

  const handleActivate = async () => {
    setIsActivating(true);
    try {
      await requestPermission();
      setIsVisible(false);
    } finally {
      setIsActivating(false);
    }
  };

  const handleDismiss = (e) => {
    if (e) e.stopPropagation();
    setIsVisible(false);
    try {
      sessionStorage.setItem('rg_push_banner_dismissed_at', String(Date.now()));
      localStorage.removeItem('rg_push_banner_minimized');
    } catch (_) {}
  };

  return (
    <div className="fixed bottom-28 sm:bottom-32 md:bottom-24 right-4 left-4 sm:left-auto sm:max-w-lg z-45 animate-slideUp">
      <div className="rounded-3xl p-5 sm:p-6 border-2 border-purple-400/70 shadow-[0_12px_45px_rgba(0,0,0,0.85),0_0_40px_rgba(168,85,247,0.45)] bg-linear-to-br from-[#1c0d36]/98 via-[#130726]/98 to-[#0b0318]/98 backdrop-blur-2xl relative overflow-hidden">
        {/* Halo lumineux */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-purple-500/30 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-pink-500/25 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-tr from-purple-600 via-fuchsia-600 to-pink-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-purple-500/40 animate-pulse border border-white/25">
                <Bell size={26} className="fill-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm sm:text-base font-black text-white uppercase tracking-wider font-['Outfit']">
                    Alertes &amp; Nouveautés
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center gap-1">
                    <Sparkles size={10} /> VIP
                  </span>
                </div>
                <p className="text-slate-300 text-xs sm:text-[13px] mt-0.5 leading-snug">
                  Soyez prévenu dès la sortie de nouveaux livres audio, PDF et promotions exclusives !
                </p>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
              title="Fermer"
            >
              <X size={18} />
            </button>
          </div>

          {/* BOUTONS D'ACTION */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
            <button
              onClick={handleActivate}
              disabled={isActivating}
              className="flex-1 py-4 px-6 rounded-2xl bg-linear-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm sm:text-base font-black shadow-2xl shadow-purple-600/50 flex items-center justify-center gap-3 transition-all duration-200 active:scale-95 disabled:opacity-50 cursor-pointer border-2 border-purple-300/50 hover:scale-[1.02]"
            >
              {isActivating ? (
                <>
                  <span className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Activation en cours...</span>
                </>
              ) : (
                <>
                  <Bell size={20} className="fill-white animate-bounce shrink-0" />
                  <span className="tracking-wide">ACTIVER LES NOTIFICATIONS</span>
                  <ChevronRight size={20} />
                </>
              )}
            </button>

            <button
              onClick={handleDismiss}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 text-xs font-semibold transition-colors text-center hover:bg-white/5 cursor-pointer"
            >
              Plus tard
            </button>
          </div>

          <p className="text-center text-[10px] text-purple-200/60">
            ✓ 100% Gratuit • Sans publicité abusive • Révoquable en 1 clic
          </p>
        </div>
      </div>
    </div>
  );
};
