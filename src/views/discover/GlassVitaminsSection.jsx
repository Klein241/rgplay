import React from 'react';
import { Shield, Globe, Heart, Zap, ArrowRight } from 'lucide-react';

/**
 * GlassVitaminsSection — Bloc Panoramique Split & Footer Ticker Style Axolotl
 * ─────────────────────────────────────────────────────────────────────────────
 * Copie 100% fidèle du bas de la maquette Axolotl :
 * - Carte gauche avec titre, descriptif et bouton vert
 * - Carte droite avec les 4 pastilles d'actifs / vitamines (HD, PDF, SYNC, VIP)
 * - Ticker de 4 engagements en bas de page
 */

const PILLARS_DATA = [
  { code: 'HD', title: 'MASTERING HD', desc: 'Clarté vocale & ambiance' },
  { code: 'PDF', title: 'LISEUSE INTÉGRÉE', desc: 'Mobile, tablette & web' },
  { code: 'SYNC', title: 'SYNCHRO CLOUD', desc: 'Reprise multi-écrans' },
  { code: 'VIP', title: 'AVIS CERTIFIÉS', desc: 'Communauté vérifiée' },
];

export const GlassVitaminsSection = ({ onExploreAuthors }) => {
  return (
    <div className="space-y-8 my-8 sm:my-12">
      {/* ── 1. CARTE PANORAMIQUE SPLIT (Style Essential Vitamins) ── */}
      <div className="glass-panel p-6 sm:p-10 rounded-3xl border border-white/20 shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Colonne Gauche : Titre & Bouton */}
        <div className="lg:col-span-5 space-y-4 text-left">
          <div className="inline-flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-widest">
            <span>🌿</span>
            <span>EXCELLENCE ÉDITORIALE</span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight font-['Outfit'] leading-tight">
            DES OEUVRES RARES. <br />
            SOIGNEUSEMENT ÉDITÉES.
          </h3>

          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Chaque ouvrage est méticuleusement sélectionné, adapté en audio immersif et synchronisé avec son manuscrit original.
          </p>

          <button
            onClick={onExploreAuthors}
            className="btn-emerald-pill px-6 py-3 text-xs tracking-wider uppercase flex items-center gap-2 cursor-pointer pt-2"
          >
            <span>DÉCOUVRIR LES AUTEURS</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Colonne Droite : Les 4 Pastilles Circulaires (B3, B6, B12, C) */}
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {PILLARS_DATA.map((p) => (
            <div
              key={p.code}
              className="glass-card p-4 rounded-2xl flex flex-col items-center text-center justify-between border border-white/15 hover:border-emerald-400/40 transition-all hover:scale-105"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center mb-3 shadow-[0_0_15px_rgba(52,211,153,0.25)]">
                <span className="text-xs font-black text-emerald-300 font-['Outfit']">
                  {p.code}
                </span>
              </div>

              <h4 className="text-2xs sm:text-xs font-black text-white uppercase tracking-wider mb-1">
                {p.title}
              </h4>

              <p className="text-[10px] text-slate-300 leading-tight">
                {p.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. FOOTER TICKER AXOLOTL (SUSTAINABLE SOURCING...) ── */}
      <div className="glass-pill px-6 py-3.5 rounded-full border border-white/15 shadow-xl flex flex-wrap items-center justify-between gap-4 text-xs font-bold text-slate-300">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-emerald-400" />
          <span>ÉDITIONS READ'S GREAT</span>
        </div>

        <div className="flex items-center gap-2">
          <Globe size={16} className="text-teal-400" />
          <span>AFRIQUE &amp; DIASPORA (GABON 🇬🇦)</span>
        </div>

        <div className="flex items-center gap-2">
          <Heart size={16} className="text-rose-400" />
          <span>100% INDÉPENDANT</span>
        </div>

        <div className="flex items-center gap-2">
          <Zap size={16} className="text-amber-400" />
          <span>AIRTEL &amp; MOOV MONEY</span>
        </div>
      </div>
    </div>
  );
};
