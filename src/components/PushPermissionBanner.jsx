import React, { useState } from 'react';
import { Bell, X, Sparkles, CheckCircle2, ChevronRight } from 'lucide-react';
import { usePush } from '../context/PushContext';

export const PushPermissionBanner = () => {
  const { requestPermission, permission } = usePush();
  const [isActivating, setIsActivating] = useState(false);
  const [isMinimized, setIsMinimized] = useState(() => {
    try {
      return localStorage.getItem('rg_push_banner_minimized') === 'true';
    } catch {
      return false;
    }
  });

  // Si les notifications sont déjà autorisées, ne plus afficher
  if (permission === 'granted') return null;

  const handleActivate = async () => {
    setIsActivating(true);
    try {
      await requestPermission();
    } finally {
      setIsActivating(false);
    }
  };

  const handleMinimize = (e) => {
    if (e) e.stopPropagation();
    setIsMinimized(true);
    try {
      localStorage.setItem('rg_push_banner_minimized', 'true');
    } catch {}
  };

  // ── Mode Réduit Persistant : Gros bouton flottant toujours accessible ──
  if (isMinimized) {
    return (
      <div className="fixed bottom-28 sm:bottom-32 md:bottom-24 right-4 z-45 animate-slideUp">
        <button
          onClick={handleActivate}
          disabled={isActivating}
          className="group relative flex items-center gap-3.5 px-6 py-3.5 sm:py-4 rounded-2xl sm:rounded-3xl bg-linear-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black text-xs sm:text-sm shadow-[0_0_35px_rgba(168,85,247,0.7)] border-2 border-purple-300/60 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title="Activer les notifications push"
        >
          <span className="w-3 h-3 rounded-full bg-cyan-300 animate-ping" />
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
            <Bell size={20} className="animate-bounce text-white fill-white" />
          </div>
          <div className="text-left">
            <p className="leading-tight font-black tracking-wide text-xs sm:text-sm uppercase">Activer les Notifications</p>
            <p className="text-[10.5px] text-purple-100 font-medium">Ne ratez aucune nouveauté audio</p>
          </div>
          <ChevronRight size={18} className="text-purple-200 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    );
  }

  // ── Mode Déplié : Bannière Large avec Grand Bouton d'Action Imposant ──
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
              onClick={handleMinimize}
              className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors shrink-0"
              title="Réduire"
            >
              <X size={18} />
            </button>
          </div>

          {/* GRAND BOUTON D'ACTIVATION PERSISTANT */}
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
              onClick={handleMinimize}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 text-xs font-semibold transition-colors text-center hover:bg-white/5 cursor-pointer"
            >
              Réduire
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
