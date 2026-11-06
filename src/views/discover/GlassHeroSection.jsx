import React from 'react';
import { Play, Sparkles, Headphones, Download, Star, ArrowRight, BookOpen } from 'lucide-react';

/**
 * GlassHeroSection — Vitrine Héroïque Style Glassmorphism Pur (Axolotl)
 * ─────────────────────────────────────────────────────────────────────────────
 * Copie 100% fidèle de la structure de l'image de référence :
 * - Titre monumental 3 lignes avec 3ème ligne menthe/émeraude éclatante
 * - Sous-titre avec icône organique
 * - Bouton pill émeraude "ÉCOUTER MAINTENANT →" + bouton verre givré
 * - Jaquette 3D mise en scène
 * - 3 badges verticaux dépolis superposés à droite de la jaquette
 */

export const GlassHeroSection = ({ book, onPlay, onDetails }) => {
  if (!book) return null;

  return (
    <section className="relative w-full rounded-3xl p-6 sm:p-10 lg:p-14 glass-panel overflow-hidden my-4 sm:my-6 border border-white/20 shadow-2xl">
      {/* Halo d'ambiance émeraude et lueur d'eau */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 left-10 w-80 h-80 bg-teal-400/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Colonne Gauche : Titre Éditorial Style Axolotl */}
        <div className="lg:col-span-7 space-y-6 text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-pill text-[11px] font-black text-emerald-300 uppercase tracking-widest border border-emerald-400/30">
            <Sparkles size={13} className="text-emerald-400" />
            <span>ÉDITION ORIGINALE READ'S GREAT</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white uppercase tracking-tight font-['Outfit'] leading-[1.02]">
            L'ESPRIT <br />
            NOURRI PAR <br />
            <span className="text-emerald-400 drop-shadow-[0_0_25px_rgba(52,211,153,0.45)]">
              L'EXCELLENCE.
            </span>
          </h1>

          <div className="flex items-center gap-2 text-slate-200 text-sm sm:text-base font-medium">
            <span className="text-emerald-400">🍃</span>
            <p>
              Des œuvres audio et littéraires d'exception pour élever votre vie et votre foi.
            </p>
          </div>

          <p className="text-slate-300/80 text-xs sm:text-sm max-w-xl leading-relaxed">
            Plongez dans <strong className="text-white font-bold">"{book.title}"</strong> par {book.author || 'Read’s Great'}.
            {book.description ? ` ${book.description.slice(0, 130)}...` : ''}
          </p>

          {/* Boutons d'action : 1 bouton pill émeraude + 1 bouton verre givré */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={() => onPlay(book)}
              className="btn-emerald-pill px-8 py-4 text-xs sm:text-sm tracking-wider uppercase flex items-center gap-3 cursor-pointer"
            >
              <Play size={16} className="fill-current" />
              <span>ÉCOUTER MAINTENANT</span>
              <ArrowRight size={16} />
            </button>

            <button
              onClick={() => onDetails(book)}
              className="px-6 py-4 rounded-full glass-pill text-white hover:text-emerald-300 text-xs sm:text-sm font-bold flex items-center gap-2.5 cursor-pointer border border-white/25"
            >
              <BookOpen size={16} />
              <span>DÉCOUVRIR LE LIVRE</span>
            </button>
          </div>
        </div>

        {/* Colonne Droite : Jaquette 3D + Les 3 Badges Verticaux Axolotl */}
        <div className="lg:col-span-5 flex items-center justify-center lg:justify-end gap-4 sm:gap-6">
          {/* Jaquette 3D mise en valeur */}
          <div 
            onClick={() => onPlay(book)}
            className="group relative w-48 h-48 sm:w-64 sm:h-64 rounded-3xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.85)] border border-white/30 cursor-pointer transform hover:scale-105 transition-all duration-500 glass-card"
          >
            <img
              src={book.cover_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80'}
              alt={book.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-3.5 left-3.5 right-3.5 flex items-center justify-between text-white">
              <span className="text-2xs font-bold truncate max-w-[140px] glass-pill px-2.5 py-1 rounded-lg">
                {book.author || 'Read’s Great'}
              </span>
              <div className="w-10 h-10 rounded-full btn-emerald-pill flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Play size={18} className="fill-current ml-0.5 text-slate-950" />
              </div>
            </div>
          </div>

          {/* Les 3 Badges Verticaux Axolotl superposés */}
          <div className="flex flex-col gap-3 shrink-0">
            <div className="glass-badge-pill p-3.5 flex flex-col items-center justify-center text-center w-22 sm:w-26">
              <Headphones size={20} className="text-emerald-400 mb-1.5" />
              <span className="text-[10.5px] font-black text-white leading-tight">STUDIO HD</span>
              <span className="text-[8.5px] text-emerald-200/80">Masterisé</span>
            </div>

            <div className="glass-badge-pill p-3.5 flex flex-col items-center justify-center text-center w-22 sm:w-26">
              <Download size={20} className="text-teal-300 mb-1.5" />
              <span className="text-[10.5px] font-black text-white leading-tight">OFFLINE</span>
              <span className="text-[8.5px] text-teal-200/80">100% Inclus</span>
            </div>

            <div className="glass-badge-pill p-3.5 flex flex-col items-center justify-center text-center w-22 sm:w-26">
              <Star size={20} className="text-amber-400 fill-amber-400 mb-1.5" />
              <span className="text-[10.5px] font-black text-white leading-tight">4.9 / 5</span>
              <span className="text-[8.5px] text-amber-200/80">Avis Réels</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
