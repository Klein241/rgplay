import React, { useState } from 'react';
import { Star, Play, Clock, Headphones, Sparkles, CheckCircle2, Share2, Volume2 } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { shareAudioWithCover } from '../utils/shareUtils';

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80';

export const AudiobookCard = ({ book, onSelect, isPurchased = false, layout = 'grid' }) => {
  const { currentBook, isPlaying, playPreview, playBook } = useAudio();
  const [copied, setCopied] = useState(false);

  const isCurrentPlaying = currentBook?.id === book.id && isPlaying;

  const handleQuickPlay = (e) => {
    e.stopPropagation();
    if (isPurchased || book.price === 0 || book.is_free_for_members) {
      playBook(book, 0, 0);
    } else {
      playPreview(book);
    }
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    const res = await shareAudioWithCover(book);
    if (res.method === 'clipboard') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formattedDuration = `${Math.floor((book.duration_seconds || 3600) / 3600)}h ${Math.floor(((book.duration_seconds || 3600) % 3600) / 60)}m`;

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
        className="glass-card flex-shrink-0 w-56 sm:w-64 rounded-3xl p-4 cursor-pointer group flex flex-col justify-between transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1.5"
        style={{
          boxShadow: isCurrentPlaying 
            ? '0 12px 36px rgba(168, 85, 247, 0.40), 0 0 0 1.5px rgba(208, 143, 255, 0.60)' 
            : undefined
        }}
      >
        <div>
          {/* Jaquette */}
          <div className="relative aspect-square rounded-2xl overflow-hidden mb-3.5 shadow-xl border border-white/10 group-hover:border-purple-500/30 transition-colors">
            <img
              src={coverSrc}
              alt={book.title}
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_COVER; }}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
            />
            
            {/* Lueur et boutons sur hover / play */}
            <div className={`absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent transition-opacity duration-300 flex items-end justify-between p-3 ${
              isCurrentPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}>
              <button
                onClick={handleShare}
                className="w-10 h-10 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white flex items-center justify-center backdrop-blur-md transition-all hover:scale-110 active:scale-95 border border-white/10 shadow-lg"
                title="Partager ce contenu"
              >
                <Share2 className="w-4 h-4 text-purple-300" />
              </button>

              <button
                onClick={handleQuickPlay}
                className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-pink-500 text-white flex items-center justify-center shadow-xl shadow-purple-600/60 hover:scale-110 active:scale-95 transition-all border border-white/20"
              >
                {isCurrentPlaying ? (
                  <div className="flex items-center gap-0.5">
                    <span className="w-1 h-3.5 bg-white rounded-full animate-pulse" />
                    <span className="w-1 h-4.5 bg-white rounded-full animate-pulse delay-75" />
                    <span className="w-1 h-2.5 bg-white rounded-full animate-pulse delay-150" />
                  </div>
                ) : (
                  <Play className="w-5 h-5 fill-white ml-0.5" />
                )}
              </button>
            </div>

            {/* Badges sécurisés */}
            <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 pointer-events-none z-10">
              {Boolean(book.is_pinned) && (
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-lg flex items-center gap-1 border border-amber-300/60">
                  📌 Épinglé
                </span>
              )}
              {book.content_type && book.content_type !== 'audiobook' && (
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-lg text-slate-950 flex items-center gap-1 border border-white/20 ${
                  book.content_type === 'podcast' ? 'bg-amber-400' :
                  book.content_type === 'music' ? 'bg-emerald-400' : 'bg-cyan-400'
                }`}>
                  {book.content_type === 'podcast' ? '🎙️ Podcast' :
                   book.content_type === 'music' ? '🎵 Musique' : '🎓 Masterclass'}
                </span>
              )}
              {Boolean(book.is_bestseller) && (
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 shadow-md">
                  Bestseller
                </span>
              )}
              {Boolean(book.is_featured) && (
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-600 text-white shadow-md border border-purple-400/30">
                  Tendance
                </span>
              )}
            </div>

            {copied && (
              <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-xl bg-emerald-500 text-slate-950 font-bold text-[10px] shadow-xl animate-fadeIn z-20">
                Lien copié !
              </div>
            )}
          </div>

          {/* Détails du livre */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-black text-purple-400 uppercase tracking-widest block">
              {book.content_type === 'podcast' ? '🎙️ Podcast' :
               book.content_type === 'music' ? '🎵 Musique' :
               book.content_type === 'masterclass' ? '🎓 Masterclass' :
               (book.category_name || 'Livre Audio')}
            </span>
            <h4 className="text-sm sm:text-base font-extrabold text-slate-100 line-clamp-1 group-hover:text-purple-300 transition-colors leading-snug font-['Outfit']">
              {book.title}
            </h4>
            <p className="text-xs text-slate-400 truncate font-medium">
              {book.content_type === 'podcast' ? 'Hôte : ' :
               book.content_type === 'music' ? 'Artiste : ' : 'Par '}
              <span className="text-slate-300 font-semibold">{book.author}</span>
            </p>
          </div>
        </div>

        {/* Footer Note et Prix */}
        <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/8 text-xs">
          <div className="flex items-center gap-1 text-amber-400 font-bold">
            <Star className="w-3.5 h-3.5 fill-amber-400" />
            <span>{book.rating || 5.0}</span>
          </div>
          <div className="font-black text-purple-300">
            {book.price === 0 || book.is_free_for_members ? (
              <span className="text-emerald-400 font-black px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px]">Gratuit</span>
            ) : book.discount_price ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500 line-through">{book.price} F</span>
                <span className="text-emerald-400 font-black">{book.discount_price.toLocaleString()} FCFA</span>
              </div>
            ) : (
              <span className="text-slate-100 font-extrabold">{book.price.toLocaleString()} FCFA</span>
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
      className="glass-card rounded-3xl p-4 sm:p-5 cursor-pointer group flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1.5"
      style={{
        boxShadow: isCurrentPlaying 
          ? '0 12px 36px rgba(168, 85, 247, 0.40), 0 0 0 1.5px rgba(208, 143, 255, 0.60)' 
          : undefined
      }}
    >
      <div>
        {/* Cover avec boutons flottants */}
        <div className="relative aspect-[4/3] sm:aspect-square rounded-2xl overflow-hidden mb-4 shadow-xl border border-white/10 group-hover:border-purple-500/30 transition-colors">
          <img
            src={coverSrc}
            alt={book.title}
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_COVER; }}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          />

          {/* Badges superposés */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 pointer-events-none z-10">
            {Boolean(book.is_pinned) && (
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-lg flex items-center gap-1 border border-amber-300/60">
                📌 Épinglé
              </span>
            )}
            {book.content_type && book.content_type !== 'audiobook' && (
              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-lg text-slate-950 flex items-center gap-1 border border-white/20 ${
                book.content_type === 'podcast' ? 'bg-amber-400' :
                book.content_type === 'music' ? 'bg-emerald-400' : 'bg-cyan-400'
              }`}>
                {book.content_type === 'podcast' ? '🎙️ Podcast' :
                 book.content_type === 'music' ? '🎵 Musique' : '🎓 Masterclass'}
              </span>
            )}
            {Boolean(book.is_bestseller) && (
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 shadow-md">
                Bestseller
              </span>
            )}
            {Boolean(book.is_featured) && (
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-600 text-white shadow-md border border-purple-400/30">
                Coup de Cœur
              </span>
            )}
          </div>

          {/* Bouton de Partage rapide */}
          <button
            onClick={handleShare}
            className="absolute bottom-3 left-3 w-10 h-10 rounded-full bg-slate-950/80 hover:bg-slate-900 text-white flex items-center justify-center backdrop-blur-md transition-all hover:scale-110 active:scale-95 shadow-xl border border-white/15 z-10"
            title="Partager cet audio"
          >
            <Share2 className="w-4 h-4 text-purple-300" />
          </button>

          {/* Bouton d'écoute rapide */}
          <button
            onClick={handleQuickPlay}
            className="absolute bottom-3 right-3 w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-pink-500 text-white flex items-center justify-center shadow-xl shadow-purple-950/80 group-hover:scale-110 active:scale-95 transition-all border border-white/20 z-10"
          >
            {isCurrentPlaying ? (
              <div className="flex items-center gap-0.5">
                <span className="w-1 h-3.5 bg-white rounded-full animate-pulse" />
                <span className="w-1 h-4.5 bg-white rounded-full animate-pulse delay-75" />
                <span className="w-1 h-2.5 bg-white rounded-full animate-pulse delay-150" />
              </div>
            ) : (
              <Play className="w-5 h-5 fill-white ml-0.5" />
            )}
          </button>

          {copied && (
            <div className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs shadow-2xl animate-fadeIn z-20">
              Lien copié !
            </div>
          )}
        </div>

        {/* Textes du Livre */}
        <div className="space-y-1.5 mb-4">
          <span className="text-[11px] font-black text-purple-400 uppercase tracking-widest block">
            {book.category_name || (book.content_type === 'podcast' ? 'Podcast' : book.content_type === 'music' ? 'Musique' : 'Livre Audio')}
          </span>
          <h3 className="text-base sm:text-lg font-extrabold text-slate-100 line-clamp-1 group-hover:text-purple-300 transition-colors leading-snug font-['Outfit']">
            {book.title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 line-clamp-1 font-medium">
            Par <span className="text-slate-200 font-semibold">{book.author}</span>
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
          {book.price === 0 || book.is_free_for_members ? (
            <span className="text-emerald-400 font-black px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-xs">Gratuit</span>
          ) : book.discount_price ? (
            <div>
              <span className="text-[11px] text-slate-500 line-through mr-1.5">{book.price} F</span>
              <span className="text-sm sm:text-base font-black text-emerald-400">{book.discount_price.toLocaleString()} FCFA</span>
            </div>
          ) : (
            <span className="text-sm sm:text-base font-black text-purple-300">{book.price.toLocaleString()} FCFA</span>
          )}
        </div>
      </div>
    </div>
  );
};
