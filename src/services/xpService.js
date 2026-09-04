/**
 * XP & Gamification Service — Système Read's Great pour RG Play
 * Gère les niveaux, les points, les paliers de récompense, les badges et les confettis.
 */

import confetti from 'canvas-confetti';

// ── NIVEAUX DE PROGRESSION READ'S GREAT ─────────────────────────────────────────
export const XP_LEVELS = [
  { level: 1, name: 'Novice Curieux', minXp: 0, maxXp: 100, icon: '🌱', color: '#9d4edd', badge: 'badge-level-1', title: 'Débutant de la lecture' },
  { level: 2, name: 'Apprenti Lecteur', minXp: 100, maxXp: 300, icon: '⚡', color: '#3a86ff', badge: 'badge-level-2', title: 'Habitué des livres' },
  { level: 3, name: 'Lecteur Passionné', minXp: 300, maxXp: 700, icon: '🔥', color: '#ff006e', badge: 'badge-level-3', title: 'Dévoreur d’histoires' },
  { level: 4, name: 'Érudit Émérite', minXp: 700, maxXp: 1500, icon: '📚', color: '#fb5607', badge: 'badge-level-4', title: 'Connaisseur averti' },
  { level: 5, name: 'Maître du Savoir', minXp: 1500, maxXp: 3000, icon: '👑', color: '#ffbe0b', badge: 'badge-level-5', title: 'Guide de la communauté' },
  { level: 6, name: 'Sage de Read’s Great', minXp: 3000, maxXp: 999999, icon: '✨', color: '#00f5d4', badge: 'badge-level-6', title: 'Légende vivante' },
];

// ── CATALOGUE COMPLET DES BADGES ───────────────────────────────────────────────
export const BADGES_CATALOG = [
  {
    id: 'badge-welcome',
    name: 'Bienvenue chez Read’s Great',
    description: 'A rejoint la communauté des passionnés de lecture.',
    icon: '🎉',
    category: 'onboarding',
    rewardPoints: 50,
  },
  {
    id: 'badge-first-read',
    name: 'Premières Pages',
    description: 'A lu au moins 10 pages dans un e-book numérique.',
    icon: '📖',
    category: 'reading',
    rewardPoints: 20,
  },
  {
    id: 'badge-first-listen',
    name: 'Première Écoute',
    description: 'A écouté son premier livre audio complet.',
    icon: '🎧',
    category: 'audio',
    rewardPoints: 20,
  },
  {
    id: 'badge-streak-3',
    name: 'Flamme Naissante',
    description: '3 jours consécutifs d’activité de lecture.',
    icon: '🔥',
    category: 'streak',
    rewardPoints: 30,
  },
  {
    id: 'badge-streak-7',
    name: 'Lévitateur 7 Jours',
    description: '7 jours consécutifs de fidélité et de lecture quotidienne.',
    icon: '⚡',
    category: 'streak',
    rewardPoints: 70,
  },
  {
    id: 'badge-streak-30',
    name: 'Maître de la Constance',
    description: '30 jours sans interruption ! Une discipline en or.',
    icon: '🏆',
    category: 'streak',
    rewardPoints: 200,
  },
  {
    id: 'badge-collector-3',
    name: 'Grand Collectionneur',
    description: 'A débloqué au moins 3 livres premium.',
    icon: '💎',
    category: 'collector',
    rewardPoints: 100,
  },
  {
    id: 'badge-ambassador',
    name: 'Ambassadeur Read’s Great',
    description: 'A invité au moins 3 amis avec son code de parrainage.',
    icon: '🤝',
    category: 'social',
    rewardPoints: 150,
  },
  {
    id: 'badge-sponsor-supporter',
    name: 'Soutien Actif',
    description: 'A soutenu la plateforme en visionnant 5 offres partenaires.',
    icon: '🎁',
    category: 'rewards',
    rewardPoints: 50,
  },
];

// ── RÈGLES DE RÉCOMPENSES EN POINTS & XP (ÉCONOMIE ÉQUILIBRÉE POUR PROTÉGER MOBILE MONEY) ─
export const REWARD_RULES = {
  DAILY_LOGIN_BASE_XP: 10,
  DAILY_LOGIN_BASE_POINTS: 2,           // Réduit de 10 à 2 points
  READING_INTERVAL_MINUTES: 5,         // Toutes les 5 minutes
  READING_INTERVAL_XP: 5,
  READING_INTERVAL_POINTS: 1,          // 1 seul point par 5 min de lecture
  LISTENING_INTERVAL_MINUTES: 5,       // Toutes les 5 minutes
  LISTENING_INTERVAL_XP: 5,
  LISTENING_INTERVAL_POINTS: 1,        // 1 seul point par 5 min d'écoute
  SPONSOR_AD_POINTS: 3,                // Réduit de 25-30 à 3 points pour forcer le Mobile Money
  SPONSOR_AD_XP: 10,
  REFERRAL_POINTS: 15,
  REFERRAL_XP: 20,
  BOOK_COMPLETED_XP: 40,
  BOOK_COMPLETED_POINTS: 10,
  POINTS_TO_UNLOCK_STANDARD_BOOK: 300, // Augmenté de 100 à 300 points (Mobile Money privilégié)
};

/**
 * Calcule le niveau et la progression pour un nombre d'XP donné
 */
export function calculateLevelProgress(xp = 0) {
  let currentLevel = XP_LEVELS[0];
  let nextLevel = XP_LEVELS[1];

  for (let i = 0; i < XP_LEVELS.length; i++) {
    if (xp >= XP_LEVELS[i].minXp) {
      currentLevel = XP_LEVELS[i];
      nextLevel = XP_LEVELS[i + 1] || null;
    }
  }

  const currentLevelMin = currentLevel.minXp;
  const nextLevelMin = nextLevel ? nextLevel.minXp : currentLevel.maxXp;
  const range = nextLevelMin - currentLevelMin;
  const currentProgress = xp - currentLevelMin;
  const percentage = nextLevel ? Math.min(100, Math.max(0, Math.round((currentProgress / range) * 100))) : 100;
  const xpNeeded = nextLevel ? nextLevelMin - xp : 0;

  return {
    currentLevel,
    nextLevel,
    percentage,
    xpNeeded,
    totalXp: xp,
  };
}

/**
 * Lance des confettis festifs pour célébrer un niveau ou un badge débloqué
 */
export function fireCelebrationConfetti(type = 'default') {
  if (typeof window === 'undefined') return;

  try {
    if (type === 'level-up') {
      const end = Date.now() + 1.5 * 1000;
      const colors = ['#9d4edd', '#c77dff', '#e0aaff', '#ffd166', '#06d6a0'];

      (function frame() {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors: colors,
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors: colors,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();
    } else {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.65 },
        colors: ['#a855f7', '#ec4899', '#3b82f6', '#10b981', '#f59e0b'],
      });
    }
  } catch (e) {
    // Ignorer si confetti indisponible
  }
}

/**
 * Joue une douce tonalité de récompense (Web Audio API natif sans dépendance externe)
 */
export function playRewardChime(type = 'reward') {
  if (typeof window === 'undefined') return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'level-up') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.setValueAtTime(554.37, now + 0.1); // C#5
      osc.frequency.setValueAtTime(659.25, now + 0.2); // E5
      osc.frequency.setValueAtTime(880, now + 0.3); // A5

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc.start(now);
      osc.stop(now + 0.8);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.08); // A5

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.start(now);
      osc.stop(now + 0.4);
    }
  } catch (e) {
    // Web Audio non supporté ou bloqué par le navigateur
  }
}
