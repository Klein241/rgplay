import React, { useState } from 'react';
import { Bell, X, Sparkles, CheckCircle2, ChevronRight } from 'lucide-react';
import { usePush } from '../context/PushContext';

export const PushPermissionBanner = () => {
  const { isBannerVisible, requestPermission, dismissBanner, permission } = usePush();
  const [isActivating, setIsActivating] = useState(false);

  if (!isBannerVisible || permission === 'granted') return null;

  const handleActivate = async () => {
    setIsActivating(true);
    try {
      await requestPermission();
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:max-w-md z-45 animate-slideUp">
      <div className="glass-card rounded-2xl p-4 border border-purple-500/40 shadow-2xl bg-slate-900/95 backdrop-blur-xl relative overflow-hidden">
        {/* Glow décoratif */}
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-purple-500/20 rounded-full blur-xl pointer-events-none" />

        <div className="flex items-start gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-purple-500/30 animate-pulse">
            <Bell size={20} />
          </div>

          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">Activer les Alertes</span>
              <Sparkles size={12} className="text-amber-400" />
            </div>
            <p className="text-white text-xs font-semibold leading-snug">
              Ne manquez aucun nouveau podcast, livre audio ou session lofi !
            </p>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Recevez les recommandations quotidiennes et alertes nouveautés.
            </p>

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleActivate}
                disabled={isActivating}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold shadow-md shadow-purple-500/20 flex items-center gap-1.5 transition-all duration-200 active:scale-95 disabled:opacity-50"
              >
                {isActivating ? 'Activation...' : (
                  <>
                    <Bell size={13} />
                    Activer en 1 clic
                    <ChevronRight size={13} />
                  </>
                )}
              </button>

              <button
                onClick={dismissBanner}
                className="px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors"
              >
                Plus tard
              </button>
            </div>
          </div>

          <button
            onClick={dismissBanner}
            className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-white/5 transition-colors"
            title="Fermer"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
