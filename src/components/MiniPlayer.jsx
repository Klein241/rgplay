import React from 'react';
import { Play, Pause, RotateCw, RotateCcw, Maximize2, Headphones } from 'lucide-react';
import { useAudio } from '../context/AudioContext';

export const MiniPlayer = () => {
  const {
    currentBook,
    currentChapter,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    skipForward,
    skipBackward,
    setIsFullScreenOpen,
    formatTime,
    isPreviewMode,
  } = useAudio();

  if (!currentBook) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div 
      onClick={() => setIsFullScreenOpen(true)}
      className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-35 w-[94%] max-w-2xl cursor-pointer transition-all duration-300 transform hover:-translate-y-0.5"
    >
      <div className="glass-panel rounded-2xl p-2.5 sm:p-3 border border-purple-500/30 shadow-2xl shadow-purple-950/60 flex items-center justify-between gap-3 relative overflow-hidden backdrop-blur-2xl">
        {/* Barre de progression supérieure fine */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/10">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400 transition-all duration-150"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Jaquette et Informations Livre */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="relative flex-shrink-0">
            <img
              src={(!currentBook.cover_url || currentBook.cover_url.includes('r2.cloudflarestorage.com')) ? 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80' : currentBook.cover_url}
              alt={currentBook.title}
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80'; }}
              className="w-12 h-12 rounded-xl object-cover shadow-md border border-white/10"
            />
            {isPlaying && (
              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full flex items-center justify-center border border-white">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                {currentBook.title}
              </p>
              {isPreviewMode && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Extrait
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {currentChapter?.title || currentBook.author}
            </p>
          </div>
        </div>

        {/* Horodatage */}
        <div className="hidden sm:block text-right pr-2">
          <span className="text-xs font-semibold text-slate-300 font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {/* Contrôles de lecture rapide */}
        <div className="flex items-center gap-1 sm:gap-2" onClick={(e) => e.stopPropagation()}>
          {/* -15s */}
          <button
            onClick={() => skipBackward(15)}
            title="Reculer de 15s"
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition-colors hidden xs:flex items-center justify-center"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Bouton Play / Pause avec lueur néon */}
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 text-white flex items-center justify-center shadow-lg shadow-purple-500/50 hover:scale-105 active:scale-95 transition-all"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-white" />
            ) : (
              <Play className="w-4 h-4 fill-white ml-0.5" />
            )}
          </button>

          {/* +30s */}
          <button
            onClick={() => skipForward(30)}
            title="Avancer de 30s"
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Ouvrir Plein Écran */}
          <button
            onClick={() => setIsFullScreenOpen(true)}
            title="Agrandir le lecteur"
            className="p-2 text-slate-400 hover:text-purple-300 hover:bg-white/10 rounded-full transition-colors hidden sm:flex"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
