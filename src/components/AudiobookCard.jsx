import React, { useState } from 'react';
import { Play, Pause, Headphones, Sparkles, Share2, Star, BookOpen } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { shareAudioWithCover } from '../utils/shareUtils';
import { trackAction } from '../services/tracker';

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80';

export const AudiobookCard = ({
  book,
  onSelect,
  isPurchased = false,
  layout = 'square', // 'square' | 'pill' | 'track' | 'grid'
  onBuyClick
}) => {
  const { currentBook, isPlaying, playPreview, playBook } = useAudio();
  const [copied, setCopied] = useState(false);

  const isCurrentPlaying = currentBook?.id === book.id && isPlaying;

  // Un livre est "audio" s'il a des chapitres audio ou une preview_url (pas seulement un PDF)
  const isPureEbook = Boolean(
    (book.content_type === 'ebook' || book.content_type === 'epub' || book.content_type === 'pdf') &&
    !book.chapters?.length &&
    !book.preview_url
  );

  const handleQuickPlay = (e) => {
    e.stopPropagation();
    // Les livres PDF/Ebook sans audio ouvrent le lecteur PDF, pas le lecteur audio
    if (isPureEbook) {
      onSelect(book);
      return;
    }
    if (isPurchased || book.price === 0 || book.is_free_for_members) {
      playBook(book, 0, 0);
      trackAction('preview_click', book.id);
    } else {
      playPreview(book);
      trackAction('preview_click', book.id);
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

  const coverSrc = !book.cover_url
    ? DEFAULT_COVER
    : book.cover_url.includes('r2.cloudflarestorage.com') && book.cover_r2_key
      ? `/api/r2/download?key=${encodeURIComponent(book.cover_r2_key)}`
      : book.cover_url.includes('r2.cloudflarestorage.com')
        ? DEFAULT_COVER
        : book.cover_url;

  // ── 1. PILL / CAPSULE LAYOUT (@iSalmanArt Favorite Albums / Recommendations) ──
  if (layout === 'pill') {
    return (
      <div
        onClick={() => onSelect(book)}
        className={`group relative flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer transition-all duration-300 ${
          isCurrentPlaying
            ? 'bg-[#2d164f] border border-purple-400/60 shadow-[0_0_20px_rgba(168,85,247,0.35)]'
            : 'card-salman-pill hover:scale-[1.02]'
        }`}
      >
        <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-purple-500/30">
          <img
            src={coverSrc}
            alt={book.title}
            loading="lazy"
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_COVER; }}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {isCurrentPlaying && (
            <div className="absolute inset-0 bg-purple-950/60 flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-cyan-300 animate-ping" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-purple-200 transition-colors">
            {book.title}
          </h4>
          <p className="text-[11px] text-[#c4b0e8] font-medium truncate mt-0.5">
            :: {book.author || '2026'} ::
          </p>
        </div>
        <button
          type="button"
          onClick={handleQuickPlay}
          className="w-8 h-8 rounded-full bg-purple-600/30 hover:bg-purple-600/60 border border-purple-400/40 text-white flex items-center justify-center transition-all flex-shrink-0"
        >
          {isCurrentPlaying ? <Pause className="w-3.5 h-3.5 text-cyan-300" /> : <Play className="w-3.5 h-3.5 text-white ml-0.5" />}
        </button>
      </div>
    );
  }

  // ── 2. TRACK ROW LAYOUT (Screen 4 Tracks) ──────────────────────────────────
  if (layout === 'track') {
    return (
      <div
        onClick={() => onSelect(book)}
        className={`group relative flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all duration-300 ${
          isCurrentPlaying
            ? 'bg-gradient-to-r from-[#34185d]/90 via-[#261044]/90 to-[#1b0a32]/90 border border-purple-400/50 shadow-lg shadow-purple-950/50'
            : 'hover:bg-[#22103f]/60 border border-transparent hover:border-purple-500/20'
        }`}
      >
        <div className="min-w-0 flex-1 pr-4">
          <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-purple-200 transition-colors">
            {book.title}
          </h4>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-[#a78bfa]">
            <span>{book.author}</span>
            <span>•</span>
            <span>{Math.round((book.duration_seconds || 1800) / 60)} min</span>
          </div>

          {/* Equalizer lines under currently playing track */}
          {isCurrentPlaying && (
            <div className="flex items-end gap-1 mt-2 h-4">
              <span className="w-1 rounded-full bg-purple-400 eq-bar-1" />
              <span className="w-1 rounded-full bg-cyan-300 eq-bar-2" />
              <span className="w-1 rounded-full bg-purple-300 eq-bar-3" />
              <span className="w-1 rounded-full bg-pink-400 eq-bar-4" />
              <span className="w-1 rounded-full bg-purple-400 eq-bar-5" />
              <span className="w-1 rounded-full bg-cyan-300 eq-bar-1" />
              <span className="w-1 rounded-full bg-purple-300 eq-bar-2" />
            </div>
          )}
        </div>

        <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden flex-shrink-0 border border-purple-500/30 shadow-md">
          <img
            src={coverSrc}
            alt={book.title}
            loading="lazy"
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_COVER; }}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        </div>
      </div>
    );
  }

  // ── 3. SIGNATURE SQUARE ALBUM CARD (@iSalmanArt Screens 1, 2, 3) ────────────
  return (
    <div
      onClick={() => onSelect(book)}
      className="group flex flex-col items-center cursor-pointer transition-all duration-300 select-none"
    >
      {/* Artwork Container */}
      <div
        className={`relative w-full aspect-square rounded-2xl overflow-hidden border transition-all duration-300 ${
          isCurrentPlaying
            ? 'border-purple-400 shadow-[0_0_24px_rgba(168,85,247,0.55)] scale-[1.02]'
            : 'border-purple-500/30 group-hover:border-purple-400/60 group-hover:shadow-[0_12px_28px_rgba(0,0,0,0.6)] group-hover:scale-[1.03]'
        }`}
        style={{
          background: 'linear-gradient(180deg, #241142 0%, #160a2c 100%)',
        }}
      >
        <img
          src={coverSrc}
          alt={book.title}
          loading="lazy"
          decoding="async"
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_COVER; }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
        />

        {/* Hover / Play Overlay */}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent transition-opacity duration-300 flex items-center justify-center p-3 ${
          isCurrentPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}>
          <button
            type="button"
            onClick={handleQuickPlay}
            className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border border-white/40 text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all"
            title={isPureEbook ? 'Lire le livre' : 'Écouter'}
          >
            {isPureEbook ? (
              <BookOpen className="w-5 h-5 text-pink-300" />
            ) : isCurrentPlaying ? (
              <Pause className="w-5 h-5 text-cyan-300" />
            ) : (
              <Play className="w-5 h-5 text-white ml-0.5 fill-white" />
            )}
          </button>
        </div>

        {/* Price / Free Badge — FCFA uniquement, sans ambiguïté Points */}
        <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1">
          {book.price === 0 || book.is_free_for_members ? (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/30 border border-emerald-400/50 text-emerald-300 backdrop-blur-md shadow-sm">
              GRATUIT
            </span>
          ) : book.discount_price ? (
            <>
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded text-slate-400 line-through backdrop-blur-md">
                {book.price} F
              </span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 backdrop-blur-md shadow-sm">
                {book.discount_price} FCFA
              </span>
            </>
          ) : (
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-950/70 border border-purple-500/40 text-purple-200 backdrop-blur-md shadow-sm">
              {book.price} FCFA
            </span>
          )}
        </div>

        {/* Format Badge (Audio / PDF / Hybride) */}
        <div className="absolute top-2.5 left-2.5">
          {isPureEbook ? (
            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-pink-500/30 border border-pink-400/50 text-pink-200 backdrop-blur-md">
              📖 E-BOOK
            </span>
          ) : (book.pdf_url || book.pdfUrl) && book.chapters?.length ? (
            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-amber-500/30 border border-amber-400/50 text-amber-200 backdrop-blur-md">
              🎧📖 HYBRIDE
            </span>
          ) : (
            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 backdrop-blur-md">
              🎧 AUDIO
            </span>
          )}
        </div>
      </div>

      {/* Text Info Below Artwork (@iSalmanArt signature styling) */}
      <div className="w-full text-center mt-2 px-1">
        <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-purple-200 transition-colors">
          {book.title}
        </h4>
        <p className="text-[11px] text-[#c4b0e8] font-medium truncate mt-0.5">
          :: {book.author || '2026'} ::
        </p>
      </div>
    </div>
  );
};
