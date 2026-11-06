import React from 'react';

/**
 * GlassCategoryBar — Sélecteur d'Univers en Capsules de Verre Dépolies
 * ─────────────────────────────────────────────────────────────────────────────
 * Défilement horizontal fluide de pilules de verre pour filtrer les catalogues.
 */

export const CATEGORY_FILTERS = [
  { id: 'all', label: 'Tous les Audios', emoji: '🌟' },
  { id: 'audiobook', label: 'Livres Audio', emoji: '📚' },
  { id: 'podcast', label: 'Podcasts', emoji: '🎙️' },
  { id: 'masterclass', label: 'Masterclasses', emoji: '🎓' },
  { id: 'music', label: 'Musiques', emoji: '🎵' },
  { id: 'points', label: 'Déblocables Points', emoji: '⭐' },
  { id: 'new', label: 'Nouveautés', emoji: '🔥' },
];

export const GlassCategoryBar = ({ activeFilter, onSelectFilter }) => {
  return (
    <div className="w-full overflow-x-auto no-scrollbar py-2">
      <div className="flex items-center gap-2 sm:gap-3 min-w-max">
        {CATEGORY_FILTERS.map((cat) => {
          const isActive = activeFilter === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectFilter(cat.id)}
              className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-white/20 border border-white/50 text-white shadow-[0_4px_20px_rgba(168,85,247,0.4)] scale-105 backdrop-blur-2xl'
                  : 'glass-pill text-purple-200/80 hover:text-white'
              }`}
            >
              <span className="text-base">{cat.emoji}</span>
              <span>{cat.label}</span>
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
