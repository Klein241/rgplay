import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  calculateLevelProgress,
  BADGES_CATALOG,
  REWARD_RULES,
  fireCelebrationConfetti,
  playRewardChime,
} from '../services/xpService';
import { apiClient } from '../services/api';

const XpContext = createContext(null);

const STORAGE_KEY = 'rg_gamification_state';

const DEFAULT_STATE = {
  xp: 30,
  points: 10, // 10 points de découverte (pas suffisant pour débloquer un livre sans Mobile Money)
  level: 1,
  readingMinutes: 0,
  listeningMinutes: 0,
  booksCompleted: 0,
  dailyStreak: 1,
  lastDailyRewardDate: null,
  unlockedBadges: ['badge-welcome'],
  recentTransactions: [
    { id: 'tx-init-1', amount: 10, type: 'bonus', description: 'Bienvenue sur Read’s Great', createdAt: new Date().toISOString() },
  ],
};

export const XpProvider = ({ children }) => {
  const [gamification, setGamification] = useState(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) return { ...DEFAULT_STATE, ...JSON.parse(cached) };
    } catch {}
    return DEFAULT_STATE;
  });

  const [activeRewardNotification, setActiveRewardNotification] = useState(null);
  const readingIntervalRef = useRef(null);
  const listeningIntervalRef = useRef(null);

  // Sauvegarde locale instantanée
  const saveState = (newState) => {
    setGamification(newState);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    } catch {}
  };

  // Synchronisation avec D1 au chargement
  useEffect(() => {
    const fetchRemoteState = async () => {
      try {
        const remote = await apiClient.getGamificationState?.();
        if (remote && typeof remote === 'object') {
          setGamification(prev => {
            const merged = { ...prev, ...remote };
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch {}
            return merged;
          });
        }
      } catch (e) {
        // En cas d'erreur de réseau, le state local prévaut
      }
    };
    fetchRemoteState();
  }, []);

  // Déclencher une notification de récompense
  const showRewardToast = (title, message, xpGain, pointsGain) => {
    setActiveRewardNotification({
      id: Date.now(),
      title,
      message,
      xpGain,
      pointsGain,
    });
    setTimeout(() => {
      setActiveRewardNotification(null);
    }, 4500);
  };

  // ── AJOUT D'XP ET DE POINTS ───────────────────────────────────────────────
  const awardPointsAndXp = useCallback(async ({
    xp = 0,
    points = 0,
    type = 'bonus',
    description = 'Récompense',
    badgeId = null,
  }) => {
    setGamification(prev => {
      const newXp = prev.xp + xp;
      const newPoints = prev.points + points;
      const prevProg = calculateLevelProgress(prev.xp);
      const newProg = calculateLevelProgress(newXp);
      const leveledUp = newProg.currentLevel.level > prevProg.currentLevel.level;

      let newBadges = [...(prev.unlockedBadges || [])];
      if (badgeId && !newBadges.includes(badgeId)) {
        newBadges.push(badgeId);
      }

      // Vérifier automatiquement les badges déblocables
      if (newXp >= 100 && !newBadges.includes('badge-level-2')) newBadges.push('badge-level-2');
      if (newXp >= 300 && !newBadges.includes('badge-level-3')) newBadges.push('badge-level-3');
      if (prev.readingMinutes >= 10 && !newBadges.includes('badge-first-read')) newBadges.push('badge-first-read');

      const tx = {
        id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        amount: points,
        type,
        description,
        createdAt: new Date().toISOString(),
      };

      const newState = {
        ...prev,
        xp: newXp,
        points: newPoints,
        level: newProg.currentLevel.level,
        unlockedBadges: newBadges,
        recentTransactions: [tx, ...(prev.recentTransactions || [])].slice(0, 20),
      };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      } catch {}

      // Animations et effets
      if (leveledUp) {
        fireCelebrationConfetti('level-up');
        playRewardChime('level-up');
        showRewardToast(
          `🎉 Niveau ${newProg.currentLevel.level} Atteint !`,
          `Félicitations, vous êtes maintenant ${newProg.currentLevel.name} !`,
          xp,
          points
        );
      } else if (points > 0 || xp > 0) {
        playRewardChime('reward');
        showRewardToast(description, `+${xp} XP et +${points} Points gagnés !`, xp, points);
      }

      // Sync asynchrone D1
      apiClient.syncGamificationState?.(newState).catch(() => {});

      return newState;
    });
  }, []);

  // ── RÉCOMPENSE QUOTIDIENNE (DAILY LOGIN) ──────────────────────────────────
  const claimDailyReward = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    if (gamification.lastDailyRewardDate === today) {
      return { success: false, message: 'Déjà réclamé aujourd’hui !' };
    }

    const streak = (gamification.dailyStreak || 0) + 1;
    const bonusMultiplier = Math.min(2.5, 1 + (streak * 0.1));
    const xp = Math.round(REWARD_RULES.DAILY_LOGIN_BASE_XP * bonusMultiplier);
    const points = Math.round(REWARD_RULES.DAILY_LOGIN_BASE_POINTS * bonusMultiplier);

    setGamification(prev => {
      const newState = {
        ...prev,
        dailyStreak: streak,
        lastDailyRewardDate: today,
      };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newState)); } catch {}
      return newState;
    });

    awardPointsAndXp({
      xp,
      points,
      type: 'daily_reward',
      description: `Série Quotidienne (Jour ${streak}) 🔥`,
    });

    return { success: true, xp, points, streak };
  }, [gamification.lastDailyRewardDate, gamification.dailyStreak, awardPointsAndXp]);

  // ── ENREGISTRER DU TEMPS DE LECTURE (E-BOOK) ──────────────────────────────
  const recordReadingTime = useCallback((minutes = 1) => {
    setGamification(prev => {
      const totalMinutes = (prev.readingMinutes || 0) + minutes;
      const newState = { ...prev, readingMinutes: totalMinutes };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newState)); } catch {}

      // Si palier de 3 minutes atteint
      if (totalMinutes > 0 && totalMinutes % REWARD_RULES.READING_INTERVAL_MINUTES === 0) {
        awardPointsAndXp({
          xp: REWARD_RULES.READING_INTERVAL_XP,
          points: REWARD_RULES.READING_INTERVAL_POINTS,
          type: 'reading_time',
          description: `Temps de lecture (${totalMinutes} min)`,
        });
      }

      return newState;
    });
  }, [awardPointsAndXp]);

  // ── ENREGISTRER DU TEMPS D'ÉCOUTE (AUDIOBOOK) ─────────────────────────────
  const recordListeningTime = useCallback((minutes = 1) => {
    setGamification(prev => {
      const totalMinutes = (prev.listeningMinutes || 0) + minutes;
      const newState = { ...prev, listeningMinutes: totalMinutes };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newState)); } catch {}

      // Si palier de 5 minutes atteint
      if (totalMinutes > 0 && totalMinutes % REWARD_RULES.LISTENING_INTERVAL_MINUTES === 0) {
        awardPointsAndXp({
          xp: REWARD_RULES.LISTENING_INTERVAL_XP,
          points: REWARD_RULES.LISTENING_INTERVAL_POINTS,
          type: 'listening_time',
          description: `Temps d’écoute (${totalMinutes} min)`,
        });
      }

      return newState;
    });
  }, [awardPointsAndXp]);

  // ── DÉBLOQUER UN LIVRE AVEC DES POINTS ────────────────────────────────────
  const unlockBookWithPoints = useCallback(async (book, pointsCost = REWARD_RULES.POINTS_TO_UNLOCK_STANDARD_BOOK) => {
    if (gamification.points < pointsCost) {
      return {
        success: false,
        message: `Solde insuffisant (${gamification.points}/${pointsCost} pts). Regardez une vidéo sponsorisée pour en gagner !`,
      };
    }

    // Déduire les points
    setGamification(prev => {
      const newPoints = prev.points - pointsCost;
      const tx = {
        id: `tx-spend-${Date.now()}`,
        amount: -pointsCost,
        type: 'book_unlock',
        description: `Déblocage de "${book.title}"`,
        createdAt: new Date().toISOString(),
      };
      const newState = {
        ...prev,
        points: newPoints,
        booksCompleted: (prev.booksCompleted || 0) + 1,
        recentTransactions: [tx, ...(prev.recentTransactions || [])].slice(0, 20),
      };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newState)); } catch {}
      apiClient.syncGamificationState?.(newState).catch(() => {});
      return newState;
    });

    // Enregistrer le livre dans la bibliothèque utilisateur
    try {
      await apiClient.purchaseAudiobook?.(book.id, {
        payment_method: 'points_reward',
        amount_paid: 0,
        points_spent: pointsCost,
      });

      // Synchroniser avec localStorage library pour compatibilité
      const lib = JSON.parse(localStorage.getItem('rg_user_library') || '[]');
      if (!lib.some(b => b.id === book.id)) {
        lib.push(book);
        localStorage.setItem('rg_user_library', JSON.stringify(lib));
        window.dispatchEvent(new Event('rg:library-updated'));
      }

      fireCelebrationConfetti('default');
      playRewardChime('reward');

      showRewardToast(
        '🎉 Livre Débloqué avec Succès !',
        `"${book.title}" est maintenant disponible dans votre bibliothèque.`,
        0,
        -pointsCost
      );

      return { success: true };
    } catch (err) {
      return { success: true }; // Succès local garanti
    }
  }, [gamification.points]);

  // Calcul du niveau actuel
  const levelInfo = calculateLevelProgress(gamification.xp);

  // ── DÉDUIRE DES POINTS (AGENT SKY OU SERVICE) ───────────────────────────
  const spendPoints = useCallback((pointsCost, description = 'Dépense de points') => {
    if ((gamification.points || 0) < pointsCost) {
      return false;
    }
    setGamification(prev => {
      const newPoints = Math.max(0, (prev.points || 0) - pointsCost);
      const tx = {
        id: `tx-spend-${Date.now()}`,
        amount: -pointsCost,
        type: 'spend',
        description,
        createdAt: new Date().toISOString(),
      };
      const newState = {
        ...prev,
        points: newPoints,
        recentTransactions: [tx, ...(prev.recentTransactions || [])].slice(0, 20),
      };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newState)); } catch {}
      apiClient.syncGamificationState?.(newState).catch(() => {});
      return newState;
    });
    return true;
  }, [gamification.points]);

  return (
    <XpContext.Provider
      value={{
        ...gamification,
        levelInfo,
        allBadges: BADGES_CATALOG,
        awardPointsAndXp,
        claimDailyReward,
        recordReadingTime,
        recordListeningTime,
        unlockBookWithPoints,
        spendPoints,
      }}
    >
      {children}

      {/* Toast Notification Flottante de Récompense Read's Great */}
      {activeRewardNotification && (
        <div className="fixed top-20 right-4 z-[9999] pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-[#1c0e33]/95 border border-purple-500/40 backdrop-blur-xl rounded-2xl p-4 shadow-2xl shadow-purple-950/80 max-w-sm flex items-center gap-3.5 text-white">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-xl shrink-0 shadow-lg shadow-purple-600/30">
              ✨
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm text-purple-200 truncate">{activeRewardNotification.title}</h4>
              <p className="text-xs text-purple-300/80 line-clamp-1">{activeRewardNotification.message}</p>
              <div className="flex items-center gap-2 mt-1">
                {activeRewardNotification.xpGain > 0 && (
                  <span className="inline-flex items-center text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    +{activeRewardNotification.xpGain} XP
                  </span>
                )}
                {activeRewardNotification.pointsGain > 0 && (
                  <span className="inline-flex items-center text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    +{activeRewardNotification.pointsGain} Points ⭐
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </XpContext.Provider>
  );
};

const defaultXpState = {
  xp: 0,
  level: 1,
  points: 0,
  streak: 1,
  badges: [],
  history: [],
  awardPointsAndXp: () => {},
  unlockBookWithPoints: () => ({ success: false, message: 'Système de points non disponible' }),
  canAffordBook: () => false,
  rules: {},
  loading: false,
};

export const useXp = () => {
  const context = useContext(XpContext);
  if (!context) {
    return defaultXpState;
  }
  return context;
};

