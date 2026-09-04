import React, { useState, useEffect, useCallback } from 'react';
import {
  Flame, Trophy, Star, Crown, Target, ChevronRight,
  Zap, BookOpen, TrendingUp, Award, X
} from 'lucide-react';

// ── Niveaux basés sur le nombre de jours de streak ──
const STREAK_LEVELS = [
  { min: 0,   max: 6,   label: 'Apprenti Lecteur',    color: '#94a3b8', gradient: 'from-slate-500 to-slate-600',   icon: '📖', xp: 10 },
  { min: 7,   max: 13,  label: 'Bâtisseur de Savoir', color: '#22d3ee', gradient: 'from-cyan-500 to-blue-600',     icon: '🧱', xp: 25 },
  { min: 14,  max: 29,  label: 'Stratège Accompli',   color: '#a855f7', gradient: 'from-purple-500 to-violet-600', icon: '⚔️', xp: 50 },
  { min: 30,  max: 59,  label: 'Visionnaire',         color: '#f59e0b', gradient: 'from-amber-500 to-orange-500',  icon: '🔭', xp: 100 },
  { min: 60,  max: 999, label: "Leader d'Empire",     color: '#f43f5e', gradient: 'from-rose-500 to-pink-600',     icon: '👑', xp: 200 },
];

const STORAGE_KEY = 'rg_streak';

const getStreakData = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { currentStreak: 0, longestStreak: 0, lastListenedDate: null, totalMinutes: 0 };
    return JSON.parse(raw);
  } catch {
    return { currentStreak: 0, longestStreak: 0, lastListenedDate: null, totalMinutes: 0 };
  }
};

export const recordListeningSession = (minutes = 5) => {
  const data = getStreakData();
  const today = new Date().toDateString();
  const lastDate = data.lastListenedDate;

  let newStreak = data.currentStreak;

  if (lastDate === today) {
    // Déjà écouté aujourd'hui, juste ajouter les minutes
  } else if (lastDate === new Date(Date.now() - 86400000).toDateString()) {
    // Hier = streak continue
    newStreak += 1;
  } else {
    // Nouvelle série ou rupture
    newStreak = 1;
  }

  const updated = {
    currentStreak: newStreak,
    longestStreak: Math.max(data.longestStreak || 0, newStreak),
    lastListenedDate: today,
    totalMinutes: (data.totalMinutes || 0) + minutes,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('rg:streak-updated', { detail: updated }));
  return updated;
};

const getLevelForStreak = (streak) => {
  return STREAK_LEVELS.find(l => streak >= l.min && streak <= l.max) || STREAK_LEVELS[0];
};

// ── Composant Badge compact (dans Header / PlayerBar) ──
export const StreakBadge = ({ onClick }) => {
  const [data, setData] = useState(getStreakData());

  useEffect(() => {
    const handler = (e) => setData(e.detail || getStreakData());
    window.addEventListener('rg:streak-updated', handler);
    return () => window.removeEventListener('rg:streak-updated', handler);
  }, []);

  const level = getLevelForStreak(data.currentStreak);
  const isActive = data.lastListenedDate === new Date().toDateString();

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl transition-all active:scale-95"
      style={{
        background: isActive ? 'rgba(251,146,60,0.18)' : 'rgba(255,255,255,0.06)',
        border: isActive ? '1px solid rgba(251,146,60,0.40)' : '1px solid rgba(255,255,255,0.08)',
      }}
      title={`Série d'écoute : ${data.currentStreak} jour(s)`}
    >
      <Flame
        className={`w-4 h-4 ${isActive ? 'text-orange-400 animate-pulse' : 'text-slate-400'}`}
        style={{ fill: isActive ? 'rgba(251,146,60,0.3)' : 'none' }}
      />
      <span className={`text-xs font-black tabular-nums ${isActive ? 'text-orange-300' : 'text-slate-400'}`}>
        {data.currentStreak}
      </span>
    </button>
  );
};

// ── Modal Streak Complet ──
export const StreakModal = ({ isOpen, onClose }) => {
  const [data, setData] = useState(getStreakData());

  useEffect(() => {
    if (!isOpen) return;
    setData(getStreakData());
    const handler = (e) => setData(e.detail || getStreakData());
    window.addEventListener('rg:streak-updated', handler);
    return () => window.removeEventListener('rg:streak-updated', handler);
  }, [isOpen]);

  if (!isOpen) return null;

  const level = getLevelForStreak(data.currentStreak);
  const nextLevel = STREAK_LEVELS.find(l => l.min > data.currentStreak);
  const daysToNext = nextLevel ? nextLevel.min - data.currentStreak : 0;
  const isActive = data.lastListenedDate === new Date().toDateString();

  // Derniers 7 jours
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000).toDateString();
    return {
      date: d,
      label: new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString('fr', { weekday: 'short' }),
      listened: data.lastListenedDate === d || (data.currentStreak > (6 - i) && data.lastListenedDate)
    };
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #0f0a1e 0%, #1a1033 100%)',
          border: '1px solid rgba(168,85,247,0.25)',
          boxShadow: '0 40px 80px rgba(0,0,0,0.70)',
        }}
      >
        {/* Header */}
        <div
          className="p-6 text-center relative"
          style={{ background: `linear-gradient(135deg, rgba(168,85,247,0.25) 0%, rgba(99,102,241,0.15) 100%)` }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>

          <div className="text-5xl mb-2">{level.icon}</div>
          <div className="text-xs font-bold text-purple-300 mb-1 tracking-widest uppercase">Niveau</div>
          <h2 className="text-xl font-black text-white mb-1">{level.label}</h2>

          {/* Flamme principale */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <div
              className={`flex flex-col items-center gap-1 px-6 py-3 rounded-2xl ${isActive ? 'animate-pulse' : ''}`}
              style={{
                background: isActive ? 'rgba(251,146,60,0.20)' : 'rgba(255,255,255,0.06)',
                border: isActive ? '1px solid rgba(251,146,60,0.40)' : '1px solid rgba(255,255,255,0.10)',
              }}
            >
              <Flame className={`w-8 h-8 ${isActive ? 'text-orange-400' : 'text-slate-400'}`} style={{ fill: isActive ? 'rgba(251,146,60,0.5)' : 'none' }} />
              <span className="text-3xl font-black text-white tabular-nums">{data.currentStreak}</span>
              <span className="text-[10px] text-slate-400 font-bold">JOURS DE SUITE</span>
            </div>

            <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
              <Trophy className="w-6 h-6 text-amber-400" />
              <span className="text-2xl font-black text-white tabular-nums">{data.longestStreak}</span>
              <span className="text-[10px] text-slate-400 font-bold">RECORD</span>
            </div>
          </div>
        </div>

        {/* Contenu */}
        <div className="p-5 space-y-5">
          {/* Grille 7 jours */}
          <div>
            <p className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">Activité des 7 derniers jours</p>
            <div className="grid grid-cols-7 gap-1.5">
              {last7.map((day, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all`}
                    style={day.listened
                      ? { background: 'linear-gradient(135deg, #f97316, #ef4444)', boxShadow: '0 4px 12px rgba(249,115,22,0.4)' }
                      : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }
                    }
                  >
                    {day.listened ? (
                      <Flame className="w-4 h-4 text-white" style={{ fill: 'rgba(255,255,255,0.5)' }} />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-white/15" />
                    )}
                  </div>
                  <span className="text-[9px] text-slate-500 font-bold capitalize">{day.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Progression vers niveau suivant */}
          {nextLevel && (
            <div className="p-4 rounded-2xl space-y-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{nextLevel.icon}</span>
                  <div>
                    <p className="text-xs font-bold text-white">{nextLevel.label}</p>
                    <p className="text-[10px] text-slate-400">Prochain niveau</p>
                  </div>
                </div>
                <span className="text-xs font-black text-purple-300">+{daysToNext} jours</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (data.currentStreak - level.min) / (nextLevel.min - level.min) * 100)}%`,
                    background: 'linear-gradient(90deg, #a855f7, #6366f1)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Stats totales */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-lg font-black text-white">{Math.round((data.totalMinutes || 0) / 60)}h</p>
              <p className="text-[10px] text-slate-400 font-bold">Temps d'écoute total</p>
            </div>
            <div className="p-3 rounded-2xl text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <span className="text-lg">{level.icon}</span>
                <span className="text-xs font-black text-white">{(level?.label || 'Lecteur').split(' ')[0]}</span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold">Rang actuel</p>
            </div>
          </div>

          {!isActive && (
            <div className="p-3 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-center">
              <p className="text-xs text-orange-300 font-bold">🔥 Écoutez aujourd'hui pour maintenir votre série !</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
