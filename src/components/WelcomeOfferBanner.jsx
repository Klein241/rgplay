import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Zap, X, Clock, Flame } from 'lucide-react';

// ── Durée de l'offre : 15 minutes = 900 secondes ──
const OFFER_DURATION_SECONDS = 900;
const STORAGE_KEY = 'rg_welcome_offer';
const INITIAL_DELAY_MS = 140 * 1000;   // ~2 min 20s après l'arrivée (décalé du push pour éviter le chevauchement)
const REMIND_INTERVAL_MS = 5 * 60 * 1000; // Rappel toutes les 5 minutes si fermée

const getOfferState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
};

const initOffer = () => {
  const now = Date.now();
  const state = { startedAt: now, dismissed: false, claimed: false, dismissedAt: 0 };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
};

export const WelcomeOfferBanner = ({ onOpenCheckout, onNavigate, featuredBook }) => {
  const [visible, setVisible] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(OFFER_DURATION_SECONDS);
  const [animate, setAnimate] = useState(false);
  const sessionStartTimeRef = useRef(Date.now());

  useEffect(() => {
    let state = getOfferState();

    // Première visite : initialiser l'offre
    if (!state) {
      state = initOffer();
    }

    // Si l'offre a déjà été utilisée
    if (state.claimed) return;

    const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
    const remaining = OFFER_DURATION_SECONDS - elapsed;

    if (remaining <= 0) {
      // Offre expirée
      return;
    }

    setSecondsLeft(remaining);

    const checkShouldShow = () => {
      const currentState = getOfferState();
      if (!currentState || currentState.claimed) return false;

      const currentRemaining = OFFER_DURATION_SECONDS - Math.floor((Date.now() - currentState.startedAt) / 1000);
      if (currentRemaining <= 0) return false;

      const now = Date.now();
      const elapsedSinceLoad = now - sessionStartTimeRef.current;
      if (elapsedSinceLoad < INITIAL_DELAY_MS) return false;

      if (currentState.dismissedAt && now - currentState.dismissedAt < REMIND_INTERVAL_MS) {
        return false;
      }

      return true;
    };

    // 1. Minuteur initial de ~2 minutes
    const initialTimer = setTimeout(() => {
      if (checkShouldShow()) {
        setVisible(true);
        setTimeout(() => setAnimate(true), 150);
      }
    }, INITIAL_DELAY_MS);

    // 2. Intervalle régulier de rappel si non réclamée
    const checkInterval = setInterval(() => {
      if (!visible && checkShouldShow()) {
        setVisible(true);
        setTimeout(() => setAnimate(true), 150);
      }
    }, 30000);

    // 3. Décompte des secondes
    const secondInterval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(secondInterval);
          setVisible(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(checkInterval);
      clearInterval(secondInterval);
    };
  }, [visible]);

  const dismiss = useCallback(() => {
    const state = getOfferState() || {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...state,
      dismissed: true,
      dismissedAt: Date.now()
    }));
    setAnimate(false);
    setTimeout(() => setVisible(false), 300);
  }, []);

  const handleCTA = () => {
    const state = getOfferState() || {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...state,
      claimed: true,
      dismissed: true
    }));
    setAnimate(false);
    setVisible(false);

    // 1. Redirection effective vers la boutique (Store)
    if (onNavigate) {
      onNavigate('store');
    }
    window.dispatchEvent(new CustomEvent('rg:navigate-tab', { detail: 'store' }));

    // 2. Préparation de l'offre avec -40% et ouverture directe du checkout
    const offerItem = featuredBook ? {
      ...featuredBook,
      discount_price: Math.round((featuredBook.price || 3500) * 0.6)
    } : {
      id: 'pack_1000',
      title: 'Pack Populaire (Offre de Bienvenue -40%)',
      subtitle: '750 Points RG (+150 pts bonus offerts)',
      author: "Read's Great VIP",
      rawPrice: 600,
      price: 600,
      unit: 'FCFA',
      is_point_pack: true,
      points_reward: 750,
      cover_url: '/icon.svg',
      description: 'Offre exclusive de bienvenue : 750 Points RG à 600 FCFA au lieu de 1 000 FCFA (-40%) pour débloquer immédiatement vos livres audio et ebooks !'
    };

    if (onOpenCheckout) {
      setTimeout(() => {
        onOpenCheckout(offerItem);
      }, 100);
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
                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
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
                <p className="text-2xs text-slate-300 mt-0.5">
                  Profitez de -40% sur votre premier pack ou livre audio
                </p>
              </div>
            </div>
            <button
              onClick={dismiss}
              className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all shrink-0 cursor-pointer"
              title="Fermer"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>

          {/* Compte à rebours */}
          <div className="flex items-center gap-2 mb-4">
            <Clock className={`w-4 h-4 ${urgency ? 'text-red-400' : 'text-purple-300'}`} />
            <span className="text-2xs text-slate-300">
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
            className="w-full py-3 rounded-2xl font-black text-sm text-white transition-all active:scale-95 shadow-lg cursor-pointer hover:brightness-110"
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
