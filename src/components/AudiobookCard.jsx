import React, { useState } from 'react';
import { Star, Play, Headphones, Sparkles, Share2, Volume2 } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { shareAudioWithCover } from '../utils/shareUtils';
import { trackAction } from '../services/tracker';

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80';

const fmtCount = (n) => {
  if (!n || n === 0) return null;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
};

export const AudiobookCard = ({ book, onSelect, isPurchased = false, layout = 'grid', onBuyClick }) => {
  const { currentBook, isPlaying, playPreview, playBook } = useAudio();
  const [copied, setCopied] = useState(false);

  const isCurrentPlaying = currentBook?.id === book.id && isPlaying;

  const handleQuickPlay = (e) => {
    e.stopPropagation();
    if (isPurchased || book.price === 0 || book.is_free_for_members) {
      playBook(book, 0, 0);
      trackAction('preview_click', book.id);
    } else {
      playPreview(book);
      trackAction('preview_click', book.id);
    }
  };

  const handleBuyClick = (e) => {
    e.stopPropagation();
    trackAction('buy_click', book.id);
    if (onBuyClick) onBuyClick(book);
    else onSelect(book);
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    const res = await shareAudioWithCover(book);
    if (res.method === 'clipboard') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const coverSrc = !book.cover_url
    ? DEFAULT_COVER
    : book.cover_url.includes('r2.cloudflarestorage.com') && book.cover_r2_key
      ? `/api/r2/download?key=${encodeURIComponent(book.cover_r2_key)}`
      : book.cover_url.includes('r2.cloudflarestorage.com')
        ? DEFAULT_COVER
        : book.cover_url;

  // ── CAROUSEL LAYOUT ──────────────────────────────────────────────────────────
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
        {/* Jaquette */}
        <div className="relative aspect-square rounded-2xl overflow-hidden mb-3.5 shadow-xl border border-white/10 group-hover:border-purple-500/30 transition-colors">
          <img
            src={coverSrc}
            alt={book.title}
            loading="lazy"
            decoding="async"
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_COVER; }}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          />

          {/* Overlay boutons */}
          <div className={`absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent transition-opacity duration-300 flex items-end justify-between p-3 ${
            isCurrentPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}>
            <button
              onClick={handleShare}
              className="w-10 h-10 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white flex items-center justify-center backdrop-blur-md transition-all hover:scale-110 active:scale-95 border border-white/10 shadow-lg"
              title="Partager"
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

          {/* Badges */}
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
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 shadow-md">Bestseller</span>
            )}
          </div>

          {copied && (
            <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-xl bg-emerald-500 text-slate-950 font-bold text-[10px] shadow-xl animate-fadeIn z-20">
              Lien copié !
            </div>
          )}
        </div>

        {/* Titre + Prix uniquement */}
        <div className="space-y-1.5">
          <h4 className="text-sm sm:text-base font-extrabold text-slate-100 line-clamp-2 group-hover:text-purple-300 transition-colors leading-snug font-['Outfit']">
            {book.title}
          </h4>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-amber-400 font-bold">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              <span>{book.display_rating || book.rating || 5.0}</span>
            </div>
            <div className="font-black text-purple-300">
              {book.price === 0 || book.is_free_for_members ? (
                <span className="text-emerald-400 font-black px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px]">Gratuit</span>
              ) : book.discount_price ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500 line-through">{book.price} F</span>
                  <span className="text-emerald-400 font-black">{book.discount_price.toLocaleString()} F</span>
                </div>
              ) : (
                <span className="text-slate-100 font-extrabold">{book.price.toLocaleString()} F</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── GRID LAYOUT (2 COLONNES MINIATURE) ────────────────────────────────────
  return (
    <div
      onClick={() => onSelect(book)}
      className="glass-card rounded-2xl sm:rounded-3xl cursor-pointer group flex flex-col transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 overflow-hidden"
      style={{
        boxShadow: isCurrentPlaying
          ? '0 12px 36px rgba(168, 85, 247, 0.40), 0 0 0 1.5px rgba(208, 143, 255, 0.60)'
          : undefined
      }}
    >
      {/* ── Cover pleine largeur ── */}
      <div className="relative aspect-square overflow-hidden">
        <img
          src={coverSrc}
          alt={book.title}
          loading="lazy"
          decoding="async"
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_COVER; }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
        />

        {/* Gradient overlay bas */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />

        {/* Badges top-left */}
        <div className="absolute top-1.5 left-1.5 flex flex-wrap gap-1 pointer-events-none z-10">
          {Boolean(book.is_pinned) && (
            <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 shadow-md">📌</span>
          )}
          {book.content_type && book.content_type !== 'audiobook' && (
            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-md text-slate-950 ${
              book.content_type === 'podcast' ? 'bg-amber-400' :
              book.content_type === 'music' ? 'bg-emerald-400' : 'bg-cyan-400'
            }`}>
              {book.content_type === 'podcast' ? '🎙️' :
               book.content_type === 'music' ? '🎵' : '🎓'}
            </span>
          )}
          {Boolean(book.is_bestseller) && (
            <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950">Top</span>
          )}
        </div>

        {/* Bouton partage top-right */}
        <button
          onClick={handleShare}
          className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm transition-all hover:scale-110 active:scale-95 z-10 border border-white/10"
          title="Partager"
        >
          <Share2 className="w-3 h-3 text-purple-300" />
        </button>

        {/* Notification copié */}
        {copied && (
          <div className="absolute top-9 right-1.5 px-2 py-0.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[9px] shadow-xl animate-fadeIn z-20">
            Copié !
          </div>
        )}

        {/* Bouton play bas-droite */}
        <button
          onClick={handleQuickPlay}
          className="absolute bottom-2 right-2 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-pink-500 text-white flex items-center justify-center shadow-lg shadow-purple-900/70 hover:scale-110 active:scale-95 transition-all border border-white/20 z-10"
        >
          {isCurrentPlaying ? (
            <div className="flex items-center gap-0.5">
              <span className="w-0.5 h-2.5 bg-white rounded-full animate-pulse" />
              <span className="w-0.5 h-3.5 bg-white rounded-full animate-pulse delay-75" />
              <span className="w-0.5 h-2 bg-white rounded-full animate-pulse delay-150" />
            </div>
          ) : (
            <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
          )}
        </button>

        {/* ── Bouton EXTRAIT GRATUIT — bas-gauche, clignotant ── */}
        {book.price !== 0 && !book.is_free_for_members && !isPurchased && (
          <button
            onClick={(e) => { e.stopPropagation(); playPreview(book); trackAction('preview_click', book.id); }}
            className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full text-[9px] sm:text-[10px] font-black z-10 shadow-lg border border-emerald-400/50 transition-all hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.90) 0%, rgba(5,150,105,0.95) 100%)',
              color: '#fff',
              boxShadow: '0 0 8px rgba(16,185,129,0.6), 0 2px 8px rgba(0,0,0,0.4)',
              animation: 'rgPulseBadge 2s ease-in-out infinite'
            }}
          >
            <Headphones className="w-2.5 h-2.5" />
            <span>Extrait</span>
          </button>
        )}

        {/* Prix en overlay bas (sur la cover) */}
        <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5 pt-4 flex items-end justify-between pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)' }}>
          <div className="flex items-center gap-0.5 text-amber-400">
            <Star className="w-2.5 h-2.5 fill-amber-400" />
            <span className="text-[10px] font-black">{book.display_rating || book.rating || 5.0}</span>
          </div>
          <div className="text-right">
            {book.price === 0 || book.is_free_for_members ? (
              <span className="text-[9px] font-black text-emerald-300 bg-emerald-500/25 px-1.5 py-0.5 rounded-full border border-emerald-400/30">Gratuit</span>
            ) : book.discount_price ? (
              <span className="text-[10px] font-black text-emerald-300">{book.discount_price.toLocaleString()} F</span>
            ) : (
              <span className="text-[10px] font-black text-purple-200">{book.price.toLocaleString()} F</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Bas de la carte : titre uniquement, compact ── */}
      <div className="px-2.5 py-2 sm:px-3 sm:py-2.5">
        <h3
          className="text-[11px] sm:text-xs font-extrabold text-slate-100 line-clamp-2 group-hover:text-purple-300 transition-colors leading-tight font-['Outfit']"
          title={book.title}
        >
          {book.title}
        </h3>
        {/* Social proof compact si disponible */}
        {(fmtCount(book.display_plays_count) || fmtCount(book.display_reviews_count)) && (
          <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-500">
            {fmtCount(book.display_plays_count) && (
              <span className="flex items-center gap-0.5">
                <Headphones className="w-2 h-2 text-purple-400" />
                {fmtCount(book.display_plays_count)}
              </span>
            )}
            {fmtCount(book.display_reviews_count) && (
              <span className="flex items-center gap-0.5">
                <Star className="w-2 h-2 fill-amber-400 text-amber-400" />
                {fmtCount(book.display_reviews_count)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
