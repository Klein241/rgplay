import React from 'react';
import { Play, Pause, Star, BookOpen, Heart, Download, CheckCircle2, Loader2, Info } from 'lucide-react';
import { RatingPopover } from '../RatingPopover';

export const SquareCard = ({
  book,
  onSelect,
  onViewDetails,
  logic,
}) => {
  const {
    isFavorite,
    handleToggleFavorite,
    isOffline,
    isDownloading,
    downloadProgress,
    downloadError,
    pointsWarning,
    handleDownloadOffline,
    handleDirectDownloadMp3,
    downloadsCount,
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
    handleQuickPlay,
    handlePrewarm,
    coverSrc,
    isAccessible,
    isTrulyFree,
  } = logic;

  return (
    <div
      onClick={() => onSelect(book)}
      onMouseEnter={handlePrewarm}
      onTouchStart={handlePrewarm}
      className="group flex flex-col items-center cursor-pointer transition-all duration-300 select-none"
    >
      {/* Artwork Container avec bordure de verre dépolie Axolotl */}
      <div
        className={`relative w-full aspect-square rounded-2xl overflow-hidden glass-card transition-all duration-300 ${
          isCurrentPlaying
            ? 'border-purple-400 shadow-[0_0_28px_rgba(168,85,247,0.50)] scale-[1.02]'
            : 'border-white/15 group-hover:border-white/35 group-hover:shadow-[0_16px_36px_rgba(0,0,0,0.55)] group-hover:scale-[1.03]'
        }`}
      >
        <img
          src={coverSrc}
          alt={book.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
        />

        {/* Hover / Play Overlay */}
        {!isPureEbook ? (
          <div
            className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent transition-opacity duration-300 flex items-center justify-center p-3 ${
              isCurrentPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            <button
              type="button"
              onClick={handleQuickPlay}
              className="w-12 h-12 rounded-full glass-pill border border-white/40 text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all"
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
            <span className="px-3.5 py-2 rounded-full glass-pill border border-pink-400/50 text-white text-xs font-bold flex items-center gap-1.5 shadow-xl group-hover:scale-105 transition-transform">
              <BookOpen className="w-4 h-4 text-white" />
              <span>Lire le livre</span>
            </span>
          </div>
        )}

        {/* Boutons d'action supérieurs (Favoris, Détails, Prix) */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onViewDetails) onViewDetails(book);
              else onSelect(book);
            }}
            title="Consulter la fiche"
            className="w-7 h-7 rounded-full glass-pill border border-white/20 flex items-center justify-center text-white/90 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-md cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleToggleFavorite}
            title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            className="w-7 h-7 rounded-full glass-pill border border-white/20 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-md cursor-pointer"
          >
            <Heart className={`w-3.5 h-3.5 transition-colors ${isFavorite ? 'text-rose-400 fill-rose-400' : 'text-white/90'}`} />
          </button>

          <div className="flex flex-col items-end gap-1">
            {isTrulyFree || book.is_free_for_members ? (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full glass-pill border border-emerald-400/50 text-emerald-300">
                GRATUIT
              </span>
            ) : Number(book.unlock_points) > 0 && !book.price ? (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full glass-pill border border-amber-400/50 text-amber-300">
                {book.unlock_points} pts ⭐
              </span>
            ) : book.discount_price ? (
              <>
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded text-slate-400 line-through">
                  {book.price} F
                </span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full glass-pill border border-emerald-400/40 text-emerald-300">
                  {book.discount_price} FCFA
                </span>
              </>
            ) : (
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full glass-pill border border-white/20 text-white">
                {book.price} FCFA
              </span>
            )}
          </div>
        </div>

        {/* Badges gauche (NOUVEAU, VEDETTE, AUDIO, EBOOK) */}
        <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1 items-start">
          {book.is_featured || book.badge === 'VEDETTE' ? (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full glass-pill border border-amber-300/60 text-amber-300 flex items-center gap-1">
              ⭐ VEDETTE
            </span>
          ) : book.is_pinned || book.badge === 'À LA UNE' ? (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full glass-pill border border-rose-300/60 text-rose-300 flex items-center gap-1">
              🔥 À LA UNE
            </span>
          ) : book.is_new || book.badge === 'NOUVEAU' ? (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full glass-pill border border-cyan-300/60 text-cyan-300 flex items-center gap-1">
              ✨ NOUVEAU
            </span>
          ) : isPureEbook ? (
            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full glass-pill border border-pink-400/40 text-pink-200">
              📖 E-BOOK
            </span>
          ) : (
            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full glass-pill border border-cyan-400/40 text-cyan-200">
              🎧 AUDIO
            </span>
          )}
        </div>

        {/* Bouton Téléchargement Hors-Ligne */}
        <div className="absolute bottom-2.5 right-2.5 z-10">
          <button
            type="button"
            onClick={handleDownloadOffline}
            title={isOffline ? 'Contenu disponible hors-ligne' : isPureEbook ? 'Télécharger le PDF hors-ligne' : "Télécharger l'audio hors-ligne"}
            disabled={isDownloading}
            className={`px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 glass-pill transition-all active:scale-95 border ${
              isOffline
                ? 'text-emerald-300 border-emerald-400/60'
                : isDownloading
                  ? 'text-cyan-300 border-cyan-400/60'
                  : 'text-white/90 border-white/25 hover:border-white/50'
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
                <span className="text-[9px]">Hors-ligne ✓ · {downloadsCount}</span>
              </>
            ) : downloadError ? (
              <span className="text-[9px] text-rose-400">⚠ Réessayer</span>
            ) : pointsWarning ? (
              <span className="text-[9px] text-amber-300 font-semibold">{pointsWarning}</span>
            ) : (
              <>
                <Download className="w-3 h-3 text-white" />
                <span className="text-[9px]">{isPureEbook ? 'PDF' : 'Audio'} · {downloadsCount}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Titre et détails sous la pochette */}
      <div className="w-full text-center mt-2.5 px-1">
        <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-purple-200 transition-colors">
          {book.title}
        </h4>
        <p className="text-2xs text-[#c4b0e8] font-medium truncate mt-0.5">
          {book.author || 'Read’s Great'}
        </p>

        {/* Ligne Avis & Téléchargement physique */}
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-1.5 text-[10px] text-slate-300 flex-wrap relative">
          <div className="relative inline-block" ref={ratingRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsRatingOpen(prev => !prev);
              }}
              title={userRating ? `Votre note : ${userRating}/5 — Modifier` : 'Noter immédiatement'}
              className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                userRating
                  ? 'glass-pill text-emerald-300 border-emerald-400/50'
                  : 'glass-pill text-amber-300 border-amber-400/30'
              }`}
            >
              <Star className={`w-2.5 h-2.5 ${userRating ? 'fill-emerald-300 text-emerald-300' : 'fill-amber-400 text-amber-400'}`} />
              <span>{ratingValue}</span>
              <span className={userRating ? "text-emerald-400/80 font-normal" : "text-amber-300/80 font-normal"}>({reviewsCount})</span>
              {userRating && <span className="text-[9px] text-emerald-400 font-black ml-0.5">Mon avis ✓</span>}
            </button>

            {isRatingOpen && (
              <RatingPopover
                userRating={userRating}
                hoverRating={hoverRating}
                setHoverRating={setHoverRating}
                onApplyRating={handleApplyRating}
                feedback={myRatingFeedback}
                positionClass="bottom-full mb-2 left-1/2 -translate-x-1/2"
              />
            )}
          </div>

          {isAccessible && (
            <button
              type="button"
              onClick={handleDirectDownloadMp3}
              title="Télécharger le fichier sur votre appareil"
              className="inline-flex items-center gap-1 font-semibold text-cyan-300 glass-pill px-2 py-0.5 rounded-full border border-cyan-400/30 transition-all cursor-pointer active:scale-95"
            >
              <Download className="w-2.5 h-2.5 text-cyan-300" />
              <span>Téléch.</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
