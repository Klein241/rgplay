import React from 'react';
import { Zap, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';

/**
 * GlassFeaturesRow — Les 3 Piliers de Verre Verticaux Style Axolotl
 * ─────────────────────────────────────────────────────────────────────────────
 * Copie 100% fidèle des 3 cartes (NATURAL ENERGY, CLEAN INGREDIENTS, MIND & BODY BALANCE)
 * avec icône dans un cercle dépoli, titre en majuscules, descriptif et bouton pill.
 */

export const GlassFeaturesRow = ({ onExplore, onOpenOffline, onOpenRewards }) => {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 my-8 sm:my-10">
      {/* 1. ÉNERGIE & INSPIRATION (Carte 1) */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl flex flex-col justify-between space-y-6 hover:scale-102 transition-all border border-white/20 shadow-2xl">
        <div className="space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-lg">
            <Zap size={26} />
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight font-['Outfit']">
            AUDIO HAUTE <br /> DÉFINITION
          </h3>

          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Enregistrements de qualité studio, voix d'orateurs reconnus et ambiances sonores immersives pour nourrir votre esprit chaque jour.
          </p>
        </div>

        <button
          onClick={onExplore}
          className="w-full py-3 rounded-full glass-pill text-xs font-black uppercase tracking-wider text-white hover:text-emerald-300 flex items-center justify-center gap-2 border border-white/20 transition-all cursor-pointer"
        >
          <span>DÉCOUVRIR LE SON</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {/* 2. CONTENUS PURS & CERTIFIÉS (Carte 2) */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl flex flex-col justify-between space-y-6 hover:scale-102 transition-all border border-white/20 shadow-2xl">
        <div className="space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-teal-500/15 border border-teal-400/30 flex items-center justify-center text-teal-300 shadow-lg">
            <ShieldCheck size={26} />
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight font-['Outfit']">
            LECTURE 100% <br /> HORS-LIGNE
          </h3>

          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Téléchargez vos livres et audios une seule fois. Écoutez où que vous soyez en avion, en voyage ou au village sans connexion Internet.
          </p>
        </div>

        <button
          onClick={onOpenOffline}
          className="w-full py-3 rounded-full glass-pill text-xs font-black uppercase tracking-wider text-white hover:text-teal-300 flex items-center justify-center gap-2 border border-white/20 transition-all cursor-pointer"
        >
          <span>MA BIBLIOTHÈQUE</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {/* 3. ÉLÉVATION & RÉCOMPENSES (Carte 3) */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl flex flex-col justify-between space-y-6 hover:scale-102 transition-all border border-white/20 shadow-2xl">
        <div className="space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-300 shadow-lg">
            <Sparkles size={26} />
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight font-['Outfit']">
            SKY POINTS &amp; <br /> RÉCOMPENSES
          </h3>

          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Chaque minute d'écoute et de lecture vous rapporte des Sky Points. Débloquez des œuvres gratuites sans débourser un centime.
          </p>
        </div>

        <button
          onClick={onOpenRewards}
          className="w-full py-3 rounded-full glass-pill text-xs font-black uppercase tracking-wider text-white hover:text-amber-300 flex items-center justify-center gap-2 border border-white/20 transition-all cursor-pointer"
        >
          <span>GAGNER DES POINTS</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </section>
  );
};
