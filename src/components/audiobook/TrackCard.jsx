import React from 'react';
import { Star, Heart, Download, CheckCircle2, Loader2 } from 'lucide-react';
import { RatingPopover } from '../RatingPopover';

export const TrackCard = ({
  book,
  onSelect,
  logic,
}) => {
  const {
    isFavorite,
    handleToggleFavorite,
    isOffline,
    isDownloading,
    handleDownloadOffline,
    handleDirectDownloadMp3,
    isRatingOpen,
    setIsRatingOpen,
    hoverRating,
    setHoverRating,
    userRating,
    myRatingFeedback,
    ratingValue,
    reviewsCount,
    handleApplyRating,
    ratingRef,
    isCurrentPlaying,
    isPureEbook,
    handlePrewarm,
    coverSrc,
    isAccessible,
  } = logic;

  return (
    <div
      onClick={() => onSelect(book)}
      onMouseEnter={handlePrewarm}
      onTouchStart={handlePrewarm}
      className={`group relative flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all duration-300 glass-card ${
        isCurrentPlaying
          ? 'border-purple-400/80 shadow-[0_0_24px_rgba(168,85,247,0.35)]'
          : 'hover:scale-[1.01]'
      }`}
    >
      <div className="min-w-0 flex-1 pr-4">
        <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-purple-200 transition-colors">
          {book.title}
        </h4>
        <div className="flex items-center gap-2 mt-1 text-2xs text-[#a78bfa] flex-wrap">
          <span>{book.author}</span>
          <span>•</span>
          <div className="relative inline-block" ref={ratingRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsRatingOpen(prev => !prev);
              }}
              className="inline-flex items-center gap-0.5 text-amber-300 font-bold hover:scale-105 transition-transform cursor-pointer"
            >
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{ratingValue} ({reviewsCount})</span>
              {userRating && <span className="text-[9px] text-emerald-400 font-bold ml-0.5">Mon avis ✓</span>}
            </button>
            {isRatingOpen && (
              <RatingPopover
                userRating={userRating}
                hoverRating={hoverRating}
                setHoverRating={setHoverRating}
                onApplyRating={handleApplyRating}
                feedback={myRatingFeedback}
                positionClass="bottom-full mb-2 left-0"
              />
            )}
          </div>
          {isAccessible && (
            <>
              <span>•</span>
              <button
                type="button"
                onClick={handleDirectDownloadMp3}
                title="Télécharger sur votre appareil"
                className="text-cyan-300 hover:text-cyan-200 font-medium flex items-center gap-0.5 cursor-pointer text-2xs active:scale-95"
              >
                <Download className="w-2.5 h-2.5" />
                <span>Téléch.</span>
              </button>
            </>
          )}
        </div>

        {/* Barres d'égaliseur animé */}
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

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleToggleFavorite}
          title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          className="w-7 h-7 rounded-full glass-pill border border-white/15 text-white flex items-center justify-center transition-all"
        >
          <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'text-rose-400 fill-rose-400' : 'text-slate-400'}`} />
        </button>
        <button
          type="button"
          onClick={handleDownloadOffline}
          title={isOffline ? 'Disponible hors-ligne' : isPureEbook ? 'Télécharger PDF hors-ligne' : 'Télécharger audio hors-ligne'}
          disabled={isDownloading}
          className={`px-2 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1 transition-all ${
            isOffline
              ? 'glass-pill text-emerald-300 border-emerald-500/40'
              : 'glass-pill text-slate-300 border-white/15'
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

        <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden shrink-0 border border-white/20 shadow-md">
          <img
            src={coverSrc}
            alt={book.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        </div>
      </div>
    </div>
  );
};
