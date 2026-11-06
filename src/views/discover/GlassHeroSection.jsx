import React from 'react';
import { Play, Sparkles, Headphones, Download, Star, ChevronRight, Info } from 'lucide-react';

/**
 * GlassHeroSection — Vitrine Héroïque Style Glassmorphism Pur (Axolotl)
 * ─────────────────────────────────────────────────────────────────────────────
 * Titre éditorial monumental, jaquette 3D mise en scène et colonne de badges
 * verticaux dépolis (Studio HD, Hors-ligne, Note 4.9/5).
 */

export const GlassHeroSection = ({ book, onPlay, onDetails }) => {
  if (!book) return null;

  return (
    <section className="relative w-full rounded-3xl p-6 sm:p-10 lg:p-12 glass-panel overflow-hidden my-4 sm:my-6">
      {/* Halos d'ambiance en arrière-plan */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 left-10 w-80 h-80 bg-fuchsia-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
        {/* Colonne Gauche : Titre Éditorial & Accroche */}
        <div className="lg:col-span-7 space-y-5 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-pill text-[11px] font-black text-purple-200 uppercase tracking-widest">
            <Sparkles size={12} className="text-amber-400" />
            <span>À LA UNE CETTE SEMAINE</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white uppercase tracking-tight font-['Outfit'] leading-[1.08]">
            L'EXCELLENCE AUDIO <br />
            <span className="bg-linear-to-r from-purple-300 via-fuchsia-200 to-amber-200 bg-clip-text text-transparent">
              POUR VOTRE RÉUSSITE
            </span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base max-w-xl leading-relaxed font-normal">
            Plongez dans <strong className="text-white font-bold">"{book.title}"</strong> par {book.author || 'RG Play'}.
            {book.description ? ` ${book.description.slice(0, 140)}...` : ' Une expérience sonore d\'exception pour transformer votre quotidien.'}
          </p>

          {/* Boutons d'action en capsules de verre */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => onPlay(book)}
              className="px-6 sm:px-8 py-3.5 rounded-full bg-linear-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs sm:text-sm font-black shadow-[0_10px_35px_rgba(168,85,247,0.45)] border border-white/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5 cursor-pointer"
            >
              <Play size={16} className="fill-white" />
              <span className="tracking-wider uppercase">ÉCOUTER L'EXTRAIT</span>
              <ChevronRight size={16} />
            </button>

            <button
              onClick={() => onDetails(book)}
              className="px-5 sm:px-6 py-3.5 rounded-full glass-pill text-purple-200 hover:text-white text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer"
            >
              <Info size={16} />
              <span>Détails &amp; Chapitres</span>
            </button>
          </div>
        </div>

        {/* Colonne Droite : Jaquette 3D + Colonne de Badges Verticaux */}
        <div className="lg:col-span-5 flex items-center justify-center lg:justify-end gap-4 sm:gap-6">
          {/* Jaquette 3D mise en valeur */}
          <div 
            onClick={() => onPlay(book)}
            className="group relative w-48 h-48 sm:w-60 sm:h-60 rounded-3xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.8)] border border-white/25 cursor-pointer transform lg:rotate-1 hover:rotate-0 hover:scale-105 transition-all duration-500"
          >
            <img
              src={book.cover_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80'}
              alt={book.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
              <span className="text-2xs font-bold truncate max-w-[140px] bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-sm">
                {book.narrator || 'RG Studio'}
              </span>
              <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Play size={16} className="fill-white ml-0.5" />
              </div>
            </div>
          </div>

          {/* Colonne Verticale de Badges Glass (Copie fidèle du style Axolotl) */}
          <div className="flex flex-col gap-2.5 shrink-0">
            <div className="glass-badge-pill p-3 flex flex-col items-center justify-center text-center w-20 sm:w-22">
              <Headphones size={18} className="text-purple-300 mb-1" />
              <span className="text-[10px] font-black text-white leading-tight">STUDIO HD</span>
              <span className="text-[8px] text-purple-200/70">Masterisé</span>
            </div>

            <div className="glass-badge-pill p-3 flex flex-col items-center justify-center text-center w-20 sm:w-22">
              <Download size={18} className="text-emerald-300 mb-1" />
              <span className="text-[10px] font-black text-white leading-tight">OFFLINE</span>
              <span className="text-[8px] text-emerald-200/70">Disponible</span>
            </div>

            <div className="glass-badge-pill p-3 flex flex-col items-center justify-center text-center w-20 sm:w-22">
              <Star size={18} className="text-amber-400 fill-amber-400 mb-1" />
              <span className="text-[10px] font-black text-white leading-tight">4.9 / 5</span>
              <span className="text-[8px] text-amber-200/70">Avis Réels</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
