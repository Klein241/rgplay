import React, { useState, useEffect } from 'react';
import { Play, Pause, Headphones, Sparkles, Share2, Star, BookOpen, Heart, Download, CheckCircle2, Loader2 } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { shareAudioWithCover } from '../utils/shareUtils';
import { trackAction } from '../services/tracker';
import { downloadBookForOffline, getOfflineBooks } from '../utils/offlineAudioCache';

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

  // État Favoris (persistant localStorage & synchronisé)
  const [isFavorite, setIsFavorite] = useState(() => {
    try {
      const favs = JSON.parse(localStorage.getItem('rg_favorite_book_ids') || '[]');
      return favs.includes(book.id);
    } catch (_) {
      return false;
    }
  });

  // État Téléchargement Hors-ligne (IndexedDB & Cache API)
  const [isOffline, setIsOffline] = useState(() => {
    try {
      const list = getOfflineBooks();
      return list.some(b => b.id === book.id);
    } catch (_) {
      return false;
    }
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    const handleFavChange = () => {
      try {
        const favs = JSON.parse(localStorage.getItem('rg_favorite_book_ids') || '[]');
        setIsFavorite(favs.includes(book.id));
      } catch (_) {}
    };
    const handleOfflineChange = () => {
      try {
        const list = getOfflineBooks();
        setIsOffline(list.some(b => b.id === book.id));
      } catch (_) {}
    };

    window.addEventListener('rg:favorite-toggled', handleFavChange);
    window.addEventListener('rg_offline_cache_updated', handleOfflineChange);
    return () => {
      window.removeEventListener('rg:favorite-toggled', handleFavChange);
      window.removeEventListener('rg_offline_cache_updated', handleOfflineChange);
    };
  }, [book.id]);

  const handleToggleFavorite = (e) => {
    e.stopPropagation();
    try {
      const favs = JSON.parse(localStorage.getItem('rg_favorite_book_ids') || '[]');
      const next = favs.includes(book.id)
        ? favs.filter(id => id !== book.id)
        : [...favs, book.id];
      localStorage.setItem('rg_favorite_book_ids', JSON.stringify(next));
      setIsFavorite(next.includes(book.id));
      window.dispatchEvent(new CustomEvent('rg:favorite-toggled', { detail: { bookId: book.id, isFavorite: next.includes(book.id) } }));
      window.dispatchEvent(new CustomEvent('rg:library-updated'));
    } catch (_) {}
  };

  const handleDownloadOffline = async (e) => {
    e.stopPropagation();
    if (isDownloading) return;
    if (isOffline) return;
    setIsDownloading(true);
    setDownloadProgress(15);
    try {
      await downloadBookForOffline(book, (pct) => setDownloadProgress(pct));
      setIsOffline(true);
      trackAction('download_offline', book.id);
    } catch (err) {
      console.warn('Erreur téléchargement hors-ligne:', err);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  // État de Notation Immédiate (ne redirige pas vers la description)
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const [userRating, setUserRating] = useState(() => {
    try {
      return Number(localStorage.getItem(`rg_rated_${book.id}`)) || null;
    } catch {
      return null;
    }
  });
  const [myRatingFeedback, setMyRatingFeedback] = useState(null);
  const [currentRating, setCurrentRating] = useState(() => book.rating ? Number(book.rating) : 4.9);
  const [currentReviews, setCurrentReviews] = useState(() => Number(book.display_reviews_count || book.rating_count || 32));

  const handleApplyRating = (value, e) => {
    if (e) e.stopPropagation();
    setUserRating(value);
    setIsRatingOpen(false);

    const nextReviews = currentReviews + (userRating ? 0 : 1);
    const nextAvg = Number(((currentRating * currentReviews + value) / nextReviews).toFixed(1));
    setCurrentRating(nextAvg);
    setCurrentReviews(nextReviews);
    setMyRatingFeedback(`✓ Noté ${value}/5 !`);
    setTimeout(() => setMyRatingFeedback(null), 3000);

    try {
      localStorage.setItem(`rg_rated_${book.id}`, String(value));
    } catch (_) {}

    window.dispatchEvent(new CustomEvent('rg:award-points', {
      detail: {
        points: 10,
        xp: 20,
        description: `⭐ Avis enregistré : ${value}/5 (+10 pts)`
      }
    }));

    try {
      if (apiClient && apiClient.rateAudiobook) {
        apiClient.rateAudiobook(book.id, value);
      }
    } catch (_) {}
  };

  const ratingValue = currentRating.toFixed(1);
  const reviewsCount = currentReviews;
  const downloadsCount = (() => {
    const raw = book.downloads_count || book.downloads || Math.round(currentReviews * 3.2);
    if (raw >= 1000) return `${(raw / 1000).toFixed(1)}k`;
    return raw;
  })();

  const isCurrentPlaying = currentBook?.id === book.id && isPlaying;

  // Un livre est un livre audio s'il a un format audio, content_type audio/podcast ou des pistes audio
  const isAudiobook = Boolean(
    book.format === 'audio' ||
    book.format === 'audiobook' ||
    book.content_type === 'audiobook' ||
    book.content_type === 'podcast' ||
    book.content_type === 'music' ||
    book.content_type === 'masterclass' ||
    (Array.isArray(book.chapters) && book.chapters.length > 0) ||
    book.audio_url ||
    book.preview_url
  );

  // Un livre est un ebook/PDF pur uniquement s'il n'est PAS un livre audio
  const isPureEbook = !isAudiobook && Boolean(
    book.content_type === 'ebook' ||
    book.content_type === 'epub' ||
    book.content_type === 'pdf' ||
    book.format === 'ebook' ||
    book.format === 'pdf' ||
    book.format === 'epub' ||
    book.is_ebook ||
    (typeof book.pdf_url === 'string' && book.pdf_url.trim().length > 0) ||
    (typeof book.pdfUrl === 'string' && book.pdfUrl.trim().length > 0)
  );

  // Un livre est vraiment gratuit SEULEMENT si price=0 ET pas de coût en points
  const isTrulyFree = (book.price === 0 || !book.price) && !(Number(book.unlock_points) > 0);

  const handleQuickPlay = (e) => {
    e.stopPropagation();
    // Les livres PDF/Ebook ouvrent la fiche ou la liseuse, pas le lecteur audio
    if (isPureEbook) {
      onSelect(book);
      return;
    }
    if (isPurchased || isTrulyFree || book.is_free_for_members) {
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

  const handlePrewarm = () => {
    if (isPureEbook) return;
    const audioUrl = book.chapters?.[0]?.audio_url || book.preview_url;
    if (audioUrl && !audioUrl.startsWith('blob:') && typeof document !== 'undefined') {
      try {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'fetch';
        link.href = audioUrl;
        document.head.appendChild(link);
      } catch (_) {}
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
        onMouseEnter={handlePrewarm}
        onTouchStart={handlePrewarm}
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
          <div className="flex items-center gap-2 text-[10px] text-[#c4b0e8] font-medium truncate mt-0.5">
            <span>{book.author || 'Read’s Great'}</span>
            <span>•</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsRatingOpen(prev => !prev);
              }}
              className="inline-flex items-center gap-0.5 text-amber-300 font-bold hover:scale-105 transition-transform cursor-pointer"
              title="Noter immédiatement"
            >
              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
              <span>{ratingValue}</span>
            </button>
            <span>•</span>
            <span className="text-cyan-300">{downloadsCount} téléch.</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={handleToggleFavorite}
            title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center justify-center transition-all hover:scale-105"
          >
            <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'text-rose-400 fill-rose-400' : 'text-slate-400'}`} />
          </button>
          <button
            type="button"
            onClick={handleDownloadOffline}
            title={isOffline ? 'Disponible hors-ligne' : isPureEbook ? 'Télécharger PDF hors-ligne' : 'Télécharger audio hors-ligne'}
            disabled={isDownloading}
            className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all hover:scale-105 ${
              isOffline
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
            }`}
          >
            {isDownloading ? (
              <Loader2 className="w-3 h-3 animate-spin text-cyan-300" />
            ) : isOffline ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            ) : (
              <Download className="w-3 h-3 text-white/80" />
            )}
          </button>
          <button
            type="button"
            onClick={handleQuickPlay}
            className="w-8 h-8 rounded-full bg-purple-600/30 hover:bg-purple-600/60 border border-purple-400/40 text-white flex items-center justify-center transition-all"
          >
            {isCurrentPlaying ? <Pause className="w-3.5 h-3.5 text-cyan-300" /> : <Play className="w-3.5 h-3.5 text-white ml-0.5" />}
          </button>
        </div>
      </div>
    );
  }

  // ── 2. TRACK ROW LAYOUT (Screen 4 Tracks) ──────────────────────────────────
  if (layout === 'track') {
    return (
      <div
        onClick={() => onSelect(book)}
        onMouseEnter={handlePrewarm}
        onTouchStart={handlePrewarm}
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
          <div className="flex items-center gap-2 mt-1 text-[11px] text-[#a78bfa] flex-wrap">
            <span>{book.author}</span>
            <span>•</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsRatingOpen(prev => !prev);
              }}
              className="inline-flex items-center gap-0.5 text-amber-300 font-bold hover:scale-105 transition-transform cursor-pointer"
              title="Noter immédiatement"
            >
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{ratingValue} ({reviewsCount})</span>
            </button>
            <span>•</span>
            <span className="text-cyan-300 font-medium flex items-center gap-0.5">
              <Download className="w-2.5 h-2.5" />
              <span>{downloadsCount}</span>
            </span>
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

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleToggleFavorite}
            title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center justify-center transition-all"
          >
            <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'text-rose-400 fill-rose-400' : 'text-slate-400'}`} />
          </button>
          <button
            type="button"
            onClick={handleDownloadOffline}
            title={isOffline ? 'Disponible hors-ligne' : isPureEbook ? 'Télécharger PDF hors-ligne' : 'Télécharger audio hors-ligne'}
            disabled={isDownloading}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-1 transition-all ${
              isOffline
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
            }`}
          >
            {isDownloading ? (
              <Loader2 className="w-3 h-3 animate-spin text-cyan-300" />
            ) : isOffline ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            ) : (
              <Download className="w-3 h-3 text-white/80" />
            )}
          </button>

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
      </div>
    );
  }

  // ── 3. SIGNATURE SQUARE ALBUM CARD (@iSalmanArt Screens 1, 2, 3) ────────────
  return (
    <div
      onClick={() => onSelect(book)}
      onMouseEnter={handlePrewarm}
      onTouchStart={handlePrewarm}
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

        {/* Hover / Play Overlay — Masqué ou mode lecture pour livres PDF & ebook */}
        {!isPureEbook ? (
          <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent transition-opacity duration-300 flex items-center justify-center p-3 ${
            isCurrentPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}>
            <button
              type="button"
              onClick={handleQuickPlay}
              className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border border-white/40 text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all"
              title="Écouter"
            >
              {isCurrentPlaying ? (
                <Pause className="w-5 h-5 text-cyan-300" />
              ) : (
                <Play className="w-5 h-5 text-white ml-0.5 fill-white" />
              )}
            </button>
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-3">
            <span className="px-3.5 py-2 rounded-full bg-pink-600/90 backdrop-blur-md border border-pink-400/50 text-white text-xs font-bold flex items-center gap-1.5 shadow-xl group-hover:scale-105 transition-transform">
              <BookOpen className="w-4 h-4 text-white" />
              <span>Lire le livre</span>
            </span>
          </div>
        )}

        {/* Price / Free Badge + Bouton Favoris (❤️) */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
          <button
            type="button"
            onClick={handleToggleFavorite}
            title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            className="w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-md"
          >
            <Heart className={`w-3.5 h-3.5 transition-colors ${isFavorite ? 'text-rose-400 fill-rose-400' : 'text-white/90'}`} />
          </button>

          <div className="flex flex-col items-end gap-1">
            {isTrulyFree || book.is_free_for_members ? (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/30 border border-emerald-400/50 text-emerald-300 backdrop-blur-md shadow-sm">
                GRATUIT
              </span>
            ) : Number(book.unlock_points) > 0 && !book.price ? (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/30 border border-amber-400/50 text-amber-300 backdrop-blur-md shadow-sm">
                {book.unlock_points} pts ⭐
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
        </div>

        {/* Format & Tags Badge (VEDETTE, À LA UNE, NOUVEAU, etc.) */}
        <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1 items-start">
          {book.is_featured || book.badge === 'VEDETTE' ? (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 font-['Outfit'] shadow-md border border-amber-300/60 flex items-center gap-1 backdrop-blur-md">
              ⭐ VEDETTE
            </span>
          ) : book.is_pinned || book.badge === 'À LA UNE' ? (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-pink-600 via-rose-500 to-fuchsia-600 text-white font-['Outfit'] shadow-md border border-pink-300/50 flex items-center gap-1 backdrop-blur-md">
              🔥 À LA UNE
            </span>
          ) : book.is_new || book.badge === 'NOUVEAU' ? (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-cyan-500 text-white font-['Outfit'] shadow-md border border-cyan-300/50 flex items-center gap-1 backdrop-blur-md">
              ✨ NOUVEAU
            </span>
          ) : isPureEbook ? (
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

        {/* Bouton Téléchargement Hors-Ligne (PDF ou Audio) sur le coin inférieur */}
        <div className="absolute bottom-2.5 right-2.5 z-10">
          <button
            type="button"
            onClick={handleDownloadOffline}
            title={
              isOffline
                ? 'Contenu disponible hors-ligne'
                : isPureEbook
                  ? 'Télécharger le PDF / E-book pour lire hors-ligne'
                  : "Télécharger l'audio pour écouter hors-ligne"
            }
            disabled={isDownloading}
            className={`px-2 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1 backdrop-blur-md transition-all shadow-lg active:scale-95 border ${
              isOffline
                ? 'bg-emerald-950/85 text-emerald-300 border-emerald-400/50 hover:bg-emerald-900/90'
                : isDownloading
                  ? 'bg-purple-950/90 text-cyan-300 border-cyan-400/50'
                  : 'bg-black/70 hover:bg-purple-600/90 text-white border-white/25 hover:border-purple-400/60'
            }`}
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-cyan-300" />
                <span>{downloadProgress > 0 ? `${downloadProgress}%` : '...'}</span>
              </>
            ) : isOffline ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span className="text-[9px]">Hors-ligne</span>
              </>
            ) : (
              <>
                <Download className="w-3 h-3 text-white" />
                <span className="text-[9px]">{isPureEbook ? 'PDF' : 'Audio'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Text Info Below Artwork (@iSalmanArt signature styling) */}
      <div className="w-full text-center mt-2 px-1">
        <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-purple-200 transition-colors">
          {book.title}
        </h4>
        <p className="text-[11px] text-[#c4b0e8] font-medium truncate mt-0.5">
          {book.author || 'Read’s Great'}
        </p>

        {/* Ligne Engagement : Avis & Téléchargements */}
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-1.5 text-[10px] text-slate-300 flex-wrap relative">
          {/* Note & Avis Interactif Immédiat */}
          <div className="relative inline-block">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsRatingOpen(prev => !prev);
              }}
              title="Cliquez pour noter ce livre immédiatement"
              className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-lg border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                userRating
                  ? 'bg-amber-500/25 text-amber-300 border-amber-400/50 shadow-sm shadow-amber-500/20'
                  : 'bg-amber-500/15 text-amber-300 border-amber-400/30 hover:bg-amber-500/25'
              }`}
            >
              <Star className={`w-2.5 h-2.5 ${userRating ? 'fill-amber-300 text-amber-300' : 'fill-amber-400 text-amber-400'}`} />
              <span>{ratingValue}</span>
              <span className="text-amber-300/80 font-normal">({reviewsCount})</span>
              {userRating && <span className="text-[9px] text-emerald-400 font-bold ml-0.5">✓</span>}
            </button>

            {/* Popover de notation immédiate */}
            {isRatingOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 p-2.5 rounded-2xl bg-[#180930]/98 border border-purple-400/60 shadow-[0_10px_30px_rgba(0,0,0,0.85)] backdrop-blur-2xl flex flex-col items-center gap-1.5 whitespace-nowrap animate-slideUp"
              >
                <span className="text-[9.5px] font-black text-purple-200 uppercase tracking-wider">
                  {userRating ? `Votre avis : ${userRating}/5` : 'Noter cet audio :'}
                </span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={(e) => handleApplyRating(star, e)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 hover:scale-130 active:scale-90 transition-transform cursor-pointer"
                      title={`Donner ${star} étoile${star > 1 ? 's' : ''}`}
                    >
                      <Star
                        className={`w-4 h-4 transition-colors ${
                          (hoverRating || userRating || 0) >= star
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-500 fill-slate-700/50'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {myRatingFeedback ? (
                  <span className="text-[9px] text-emerald-400 font-bold animate-pulse">
                    {myRatingFeedback}
                  </span>
                ) : (
                  <span className="text-[8.5px] text-purple-300/70">
                    Application immédiate (+10 pts ⭐)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Téléchargements */}
          <span className="inline-flex items-center gap-1 font-semibold text-cyan-300 bg-cyan-500/15 px-1.5 py-0.5 rounded-md border border-cyan-400/30">
            <Download className="w-2.5 h-2.5 text-cyan-300" />
            <span>{downloadsCount} téléch.</span>
          </span>
        </div>
      </div>
    </div>
  );
};
