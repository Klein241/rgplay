import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Music } from 'lucide-react';

/**
 * ArtistMiniPlayer - Mini lecteur flottant persistant en bas d'écran (Screen 2)
 */
export const ArtistMiniPlayer = ({
  currentTrack,
  artist,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  onScrollToTop
}) => {
  if (!currentTrack) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:hidden z-50 animate-fade-in-up">
      <div
        className="flex items-center justify-between p-2.5 rounded-full backdrop-blur-2xl border border-white/15 shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(28, 16, 42, 0.92) 0%, rgba(12, 6, 22, 0.96) 100%)',
          boxShadow: '0 15px 35px rgba(0, 0, 0, 0.7), 0 0 20px rgba(168, 85, 247, 0.25) inset'
        }}
      >
        {/* Miniature et Titre */}
        <div
          onClick={onScrollToTop}
          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer pr-2"
        >
          <div className="w-10 h-10 rounded-full overflow-hidden bg-purple-950 border border-purple-500/30 flex-shrink-0">
            <img
              src={currentTrack.cover_url || artist.photo_url}
              alt={currentTrack.title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <h5 className="text-xs font-black text-white font-['Outfit'] truncate">
              {currentTrack.title}
            </h5>
            <p className="text-[10px] text-purple-300/80 truncate">
              {currentTrack.artist || artist.name}
            </p>
          </div>
        </div>

        {/* Contrôles Pill Flottants */}
        <div className="flex items-center gap-3 pr-2">
          <button
            onClick={onPrev}
            className="text-slate-300 hover:text-white p-1 active:scale-90"
            title="Précédent"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </button>

          <button
            onClick={onTogglePlay}
            className="p-2.5 rounded-full text-white flex items-center justify-center active:scale-90"
            style={{
              background: 'linear-gradient(135deg, #c084fc 0%, #a855f7 100%)',
              boxShadow: '0 0 15px rgba(192, 132, 252, 0.8)'
            }}
            title={isPlaying ? 'Pause' : 'Lecture'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current translate-x-0.5" />
            )}
          </button>

          <button
            onClick={onNext}
            className="text-slate-300 hover:text-white p-1 active:scale-90"
            title="Suivant"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>
        </div>
      </div>
    </div>
  );
};
