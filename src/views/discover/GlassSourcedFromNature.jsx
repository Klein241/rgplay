import React from 'react';
import { Headphones, BookOpen, GraduationCap, Radio, Mic2 } from 'lucide-react';

/**
 * GlassSourcedFromNature — Panneau Panoramique 5 Univers Style Axolotl
 * ─────────────────────────────────────────────────────────────────────────────
 * Copie 100% conforme au bloc "SOURCED FROM NATURE" de la maquette de référence :
 * - Pilule centrale au sommet "UNIVERS READ'S GREAT"
 * - 5 colonnes dépolies avec icônes, titres et sous-titres
 * - Sélection interactive de l'univers d'écoute
 */

const UNIVERS_ITEMS = [
  {
    id: 'audiobook',
    title: 'LIVRES AUDIO',
    desc: 'Voix immersives & sound design professionnel',
    icon: Headphones,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
  },
  {
    id: 'ebook',
    title: 'E-BOOKS & PDF',
    desc: 'Lecture fluide & synchronisation instantanée',
    icon: BookOpen,
    color: 'text-teal-400',
    bg: 'bg-teal-500/15',
  },
  {
    id: 'masterclass',
    title: 'MASTERCLASSES',
    desc: 'Formations exclusives de nos auteurs',
    icon: GraduationCap,
    color: 'text-amber-400',
    bg: 'bg-amber-500/15',
  },
  {
    id: 'podcast',
    title: 'PODCASTS',
    desc: 'Émissions inspirantes & méditations',
    icon: Radio,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/15',
  },
  {
    id: 'conference',
    title: 'CONFÉRENCES',
    desc: 'Enseignements en direct & rediffusions',
    icon: Mic2,
    color: 'text-emerald-300',
    bg: 'bg-emerald-500/15',
  },
];

export const GlassSourcedFromNature = ({ activeFilter, onSelectFilter }) => {
  return (
    <div className="relative glass-panel rounded-3xl p-6 sm:p-8 pt-10 sm:pt-12 border border-white/20 shadow-2xl my-8 sm:my-10">
      {/* Pilule centrale flottante au sommet (comme "SOURCED FROM NATURE") */}
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
        <div className="glass-pill px-5 py-1.5 rounded-full border border-emerald-400/40 text-[11px] font-black uppercase tracking-widest text-emerald-300 flex items-center gap-2 shadow-lg">
          <span>🌿</span>
          <span>UNIVERS &amp; FORMATS CERTIFIÉS</span>
        </div>
      </div>

      {/* Les 5 Colonnes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6 text-center">
        {UNIVERS_ITEMS.map((item) => {
          const Icon = item.icon;
          const isSelected = activeFilter === item.id;
          return (
            <div
              key={item.id}
              onClick={() => onSelectFilter(isSelected ? 'all' : item.id)}
              className={`p-4 rounded-2xl cursor-pointer transition-all duration-300 flex flex-col items-center justify-between group ${
                isSelected
                  ? 'bg-emerald-500/20 border border-emerald-400/60 shadow-[0_0_25px_rgba(52,211,153,0.3)] scale-105'
                  : 'hover:bg-white/8 border border-white/10 hover:border-white/25 hover:scale-102'
              }`}
            >
              <div className={`w-12 h-12 rounded-2xl ${item.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                <Icon className={`w-6 h-6 ${item.color}`} />
              </div>

              <h4 className="text-xs sm:text-sm font-black text-white tracking-wide uppercase font-['Outfit'] mb-1">
                {item.title}
              </h4>

              <p className="text-[11px] text-slate-300 leading-snug line-clamp-2">
                {item.desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
