import React from 'react';
import { Star, Play, Clock, Headphones, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAudio } from '../context/AudioContext';

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80';

export const AudiobookCard = ({ book, onSelect, isPurchased = false, layout = 'grid' }) => {
  const { currentBook, isPlaying, playPreview, playBook } = useAudio();

  const isCurrentPlaying = currentBook?.id === book.id && isPlaying;

  const handleQuickPlay = (e) => {
    e.stopPropagation();
    if (isPurchased) {
      playBook(book, 0, 0);
    } else {
      playPreview(book);
    }
  };

  const formattedDuration = `${Math.floor((book.duration_seconds || 3600) / 3600)}h ${Math.floor(((book.duration_seconds || 3600) % 3600) / 60)}m`;

  // Résolution de l'URL de couverture : proxy R2 si r2.cloudflarestorage.com, fallback si absent
  const coverSrc = !book.cover_url
    ? DEFAULT_COVER
    : book.cover_url.includes('r2.cloudflarestorage.com') && book.cover_r2_key
      ? `/api/r2/download?key=${encodeURIComponent(book.cover_r2_key)}`
      : book.cover_url.includes('r2.cloudflarestorage.com')
        ? DEFAULT_COVER
        : book.cover_url;

  if (layout === 'carousel') {
    return (
      <div
        onClick={() => onSelect(book)}
        className="glass-card flex-shrink-0 w-52 sm:w-60 rounded-3xl p-4 cursor-pointer group flex flex-col justify-between transition-all duration-300 hover:scale-[1.03]"
      >
        <div>
          {/* Jaquette */}
          <div className="relative aspect-square rounded-2xl overflow-hidden mb-3.5 shadow-lg border border-white/10">
            <img
              src={coverSrc}
              alt={book.title}
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_COVER; }}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            
            {/* Lueur et bouton play sur hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-3">
              <button
                onClick={handleQuickPlay}
                className="w-11 h-11 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 text-white flex items-center justify-center shadow-xl shadow-purple-600/60 hover:scale-110 active:scale-95 transition-transform"
              >
                {isCurrentPlaying ? (
                  <span className="w-3.5 h-3.5 bg-white rounded-xs"></span>
                ) : (
                  <Play className="w-4.5 h-4.5 fill-white ml-0.5" />
                )}
              </button>
            </div>

            {/* Badges sécurisés */}
            <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 pointer-events-none">
              {Boolean(book.is_bestseller) && (
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 shadow-md">
                  Bestseller
                </span>
              )}
              {Boolean(book.is_featured) && (
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-600 text-white shadow-md">
                  Tendance
                </span>
              )}
            </div>
          </div>

          {/* Détails du livre */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block">
              {book.category_name || 'Livre Audio'}
            </span>
            <h4 className="text-sm sm:text-base font-bold text-white line-clamp-1 group-hover:text-purple-300 transition-colors leading-snug">
              {book.title}
            </h4>
            <p className="text-xs text-slate-400 truncate">
              Par <span className="text-slate-300 font-medium">{book.author}</span>
            </p>
          </div>
        </div>

        {/* Footer Note et Prix */}
        <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/5 text-xs">
          <div className="flex items-center gap-1 text-amber-400 font-bold">
            <Star className="w-3.5 h-3.5 fill-amber-400" />
            <span>{book.rating || 5.0}</span>
          </div>
          <div className="font-extrabold text-purple-300">
            {book.discount_price ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500 line-through">{book.price} F</span>
                <span className="text-emerald-400 font-black">{book.discount_price} FCFA</span>
              </div>
            ) : (
              <span>{book.price} FCFA</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Grille standard
  return (
    <div
      onClick={() => onSelect(book)}
      className="glass-card rounded-3xl p-4 sm:p-5 cursor-pointer group flex flex-col justify-between transition-all duration-300 hover:scale-[1.02]"
    >
      <div>
        {/* Cover avec bouton flottant */}
        <div className="relative aspect-[4/3] sm:aspect-square rounded-2xl overflow-hidden mb-4 shadow-lg border border-white/10">
          <img
            src={coverSrc}
            alt={book.title}
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_COVER; }}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />

          {/* Badges superposés */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 pointer-events-none">
            {Boolean(book.is_bestseller) && (
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 shadow-md">
                Bestseller
              </span>
            )}
            {Boolean(book.is_featured) && (
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-600 text-white shadow-md">
                Coup de Cœur
              </span>
            )}
          </div>

          {/* Bouton d'écoute rapide */}
          <button
            onClick={handleQuickPlay}
            className="absolute bottom-3 right-3 w-12 h-12 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 text-white flex items-center justify-center shadow-xl shadow-purple-950/80 group-hover:scale-110 active:scale-95 transition-all"
          >
            {isCurrentPlaying ? (
              <span className="w-4 h-4 bg-white rounded-xs"></span>
            ) : (
              <Play className="w-5 h-5 fill-white ml-0.5" />
            )}
          </button>
        </div>

        {/* Textes du Livre */}
        <div className="space-y-1.5 mb-4">
          <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block">
            {book.category_name || 'Livre Audio'}
          </span>
          <h3 className="text-base sm:text-lg font-bold text-white line-clamp-1 group-hover:text-purple-300 transition-colors leading-snug">
            {book.title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 line-clamp-1">
            Par <span className="text-slate-200 font-medium">{book.author}</span>
          </p>
          <p className="text-xs text-slate-400 line-clamp-2 mt-2 leading-relaxed font-normal">
            {book.description}
          </p>
        </div>
      </div>

      {/* Footer Prix et Note */}
      <div className="pt-3.5 border-t border-white/8 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-1 text-amber-400 font-bold">
            <Star className="w-4 h-4 fill-amber-400" />
            <span>{book.rating || 5.0}</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            <span>{formattedDuration}</span>
          </div>
        </div>

        <div className="text-right">
          {book.discount_price ? (
            <div>
              <span className="text-[11px] text-slate-500 line-through mr-1.5">{book.price} F</span>
              <span className="text-sm sm:text-base font-black text-emerald-400">{book.discount_price} FCFA</span>
            </div>
          ) : (
            <span className="text-sm sm:text-base font-black text-purple-300">{book.price} FCFA</span>
          )}
        </div>
      </div>
    </div>
  );
};
