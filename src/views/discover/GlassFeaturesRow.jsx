import React from 'react';
import { Headphones, Download, Sparkles, ChevronRight } from 'lucide-react';

/**
 * GlassFeaturesRow — Les 3 Piliers de l'Expérience RG Play (Style Axolotl 3 Cards)
 * ─────────────────────────────────────────────────────────────────────────────
 * 3 dalles de verre givré avec icône dans un cercle dépoli, texte d'accroche
 * et bouton en capsule de verre.
 */

export const GlassFeaturesRow = ({ onExplore, onOpenOffline, onOpenRewards }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 my-6 sm:my-8">
      {/* Carte 1 : Audio HD */}
      <div className="glass-card p-6 flex flex-col justify-between text-left group">
        <div className="space-y-3">
          <div className="w-12 h-12 rounded-2xl glass-pill flex items-center justify-center text-purple-300 group-hover:scale-110 group-hover:border-purple-400/50 transition-all">
            <Headphones size={22} />
          </div>
          <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wider font-['Outfit']">
            Son Haute Fidélité
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Narrations d'acteurs professionnels et masters audio cristallins pour une absorption maximale des connaissances.
          </p>
        </div>

        <button
          onClick={onExplore}
          className="mt-6 self-start px-4 py-2 rounded-full glass-pill text-xs font-bold text-purple-200 hover:text-white flex items-center gap-1.5 cursor-pointer"
        >
          <span>Découvrir</span>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Carte 2 : Hors-ligne */}
      <div className="glass-card p-6 flex flex-col justify-between text-left group">
        <div className="space-y-3">
          <div className="w-12 h-12 rounded-2xl glass-pill flex items-center justify-center text-emerald-300 group-hover:scale-110 group-hover:border-emerald-400/50 transition-all">
            <Download size={22} />
          </div>
          <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wider font-['Outfit']">
            Mode Hors-Ligne Pur
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Téléchargez vos livres dans l'application et écoutez vos chapitres en voyage sans consommer votre forfait data.
          </p>
        </div>

        <button
          onClick={onOpenOffline}
          className="mt-6 self-start px-4 py-2 rounded-full glass-pill text-xs font-bold text-emerald-200 hover:text-white flex items-center gap-1.5 cursor-pointer"
        >
          <span>Ma Bibliothèque</span>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Carte 3 : Sky Points */}
      <div className="glass-card p-6 flex flex-col justify-between text-left group">
        <div className="space-y-3">
          <div className="w-12 h-12 rounded-2xl glass-pill flex items-center justify-center text-amber-300 group-hover:scale-110 group-hover:border-amber-400/50 transition-all">
            <Sparkles size={22} />
          </div>
          <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wider font-['Outfit']">
            Points &amp; Déblocage
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Gagnez des Sky Points en écoutant chaque jour ou via nos partenaires et débloquez vos œuvres sans carte bancaire.
          </p>
        </div>

        <button
          onClick={onOpenRewards}
          className="mt-6 self-start px-4 py-2 rounded-full glass-pill text-xs font-bold text-amber-200 hover:text-white flex items-center gap-1.5 cursor-pointer"
        >
          <span>Gagner des points</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};
