import React, { useState, useEffect, useCallback } from 'react';
import { Zap, X, Clock, Flame } from 'lucide-react';

// ── Durée de l'offre : 15 minutes = 900 secondes ──
const OFFER_DURATION_SECONDS = 900;
const STORAGE_KEY = 'rg_welcome_offer';

const getOfferState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
};

const initOffer = () => {
  const now = Date.now();
  const state = { startedAt: now, dismissed: false };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
};

export const WelcomeOfferBanner = ({ onOpenCheckout, featuredBook }) => {
  const [visible, setVisible] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(OFFER_DURATION_SECONDS);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    let state = getOfferState();

    // Première visite : démarrer l'offre
    if (!state) {
      state = initOffer();
    }

    if (state.dismissed) return;

    const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
    const remaining = OFFER_DURATION_SECONDS - elapsed;

    if (remaining <= 0) {
      // Offre expirée
      return;
    }

    setSecondsLeft(remaining);
    setVisible(true);

    // Petite animation d'entrée
    setTimeout(() => setAnimate(true), 300);

    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setVisible(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const dismiss = useCallback(() => {
    const state = getOfferState() || {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, dismissed: true }));
    setVisible(false);
  }, []);

  const handleCTA = () => {
    dismiss();
    if (onOpenCheckout && featuredBook) {
      onOpenCheckout({ ...featuredBook, discount_price: Math.round((featuredBook.price || 3500) * 0.6) });
    }
  };

  if (!visible) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const urgency = secondsLeft < 120; // rouge dans les 2 dernières minutes

  return (
    <div
      className={`fixed bottom-24 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 transition-all duration-700 ${animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
    >
      <div
        className="rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background: urgency
            ? 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 40%, #1a0000 100%)'
            : 'linear-gradient(135deg, #3b0764 0%, #4c1d95 40%, #1e1b4b 100%)',
          border: urgency ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(168,85,247,0.5)',
          boxShadow: urgency
            ? '0 20px 60px rgba(239,68,68,0.35), 0 0 0 1px rgba(239,68,68,0.1)'
            : '0 20px 60px rgba(168,85,247,0.35), 0 0 0 1px rgba(168,85,247,0.1)',
        }}
      >
        {/* Barre de progression du temps */}
        <div className="h-1 bg-white/10">
          <div
            className="h-full transition-all duration-1000"
            style={{
              width: `${(secondsLeft / OFFER_DURATION_SECONDS) * 100}%`,
              background: urgency
                ? 'linear-gradient(90deg, #ef4444, #f97316)'
                : 'linear-gradient(90deg, #a855f7, #6366f1)',
            }}
          />
        </div>

        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
                style={{ background: urgency ? 'rgba(239,68,68,0.25)' : 'rgba(168,85,247,0.25)' }}
              >
                {urgency ? (
                  <Flame className="w-5 h-5 text-orange-400 animate-pulse" />
                ) : (
                  <Zap className="w-5 h-5 text-purple-300 animate-pulse" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white">🎁 Offre de Bienvenue</span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-extrabold"
                    style={{
                      background: urgency ? 'rgba(239,68,68,0.25)' : 'rgba(168,85,247,0.25)',
                      color: urgency ? '#fca5a5' : '#d8b4fe',
                      border: urgency ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(168,85,247,0.4)',
                    }}
                  >
                    -40%
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Profitez de -40% sur votre premier achat
                </p>
              </div>
            </div>
            <button
              onClick={dismiss}
              className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all flex-shrink-0"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>

          {/* Compte à rebours */}
          <div className="flex items-center gap-2 mb-4">
            <Clock className={`w-4 h-4 ${urgency ? 'text-red-400' : 'text-purple-300'}`} />
            <span className="text-[11px] text-slate-300">
              Expire dans{' '}
              <span
                className={`font-black text-sm tabular-nums ${urgency ? 'text-red-300' : 'text-purple-200'}`}
              >
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </span>
            </span>
          </div>

          {/* CTA */}
          <button
            onClick={handleCTA}
            className="w-full py-3 rounded-2xl font-black text-sm text-white transition-all active:scale-95 shadow-lg"
            style={{
              background: urgency
                ? 'linear-gradient(135deg, #ef4444, #f97316)'
                : 'linear-gradient(135deg, #a855f7, #6366f1)',
              boxShadow: urgency
                ? '0 8px 24px rgba(239,68,68,0.40)'
                : '0 8px 24px rgba(168,85,247,0.40)',
            }}
          >
            ⚡ Profiter de l'offre maintenant
          </button>
        </div>
      </div>
    </div>
  );
};
