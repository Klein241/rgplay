import React from 'react';
import { Play, Pause, RotateCw, RotateCcw, Maximize2, ChevronUp } from 'lucide-react';
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

  const coverSrc = (!currentBook.cover_url || currentBook.cover_url.includes('r2.cloudflarestorage.com'))
    ? 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80'
    : currentBook.cover_url;

  return (
    <div
      onClick={() => setIsFullScreenOpen(true)}
      className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-35 w-[92%] max-w-2xl cursor-pointer group"
    >
      {/* Glow halo derrière le player */}
      <div
        className="absolute -inset-2 rounded-3xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 100%, rgba(168,85,247,0.25) 0%, transparent 70%)`,
          filter: 'blur(20px)',
        }}
      />

      <div
        className="relative rounded-2xl overflow-hidden transition-all duration-300 group-hover:-translate-y-1"
        style={{
          background: 'linear-gradient(145deg, rgba(20, 15, 45, 0.96) 0%, rgba(12, 9, 30, 0.98) 100%)',
          backdropFilter: 'blur(32px) saturate(200%)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%)',
          border: '1px solid rgba(168, 85, 247, 0.32)',
          boxShadow: `
            0 24px 60px rgba(0,0,0,0.70),
            0 8px 24px rgba(0,0,0,0.50),
            0 0 0 1px rgba(168, 85, 247, 0.12),
            0 1px 0 rgba(255,255,255,0.07) inset
          `,
        }}
      >
        {/* Barre de progression PREMIUM — plus épaisse avec glow */}
        <div className="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl overflow-hidden">
          {/* Track fond */}
          <div className="w-full h-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
          {/* Track actif avec glow */}
          <div
            className="absolute top-0 left-0 h-full rounded-full transition-all duration-150"
            style={{
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, #7c3aed, #a855f7, #e879f9, #f43f8b)',
              boxShadow: '0 0 10px rgba(168, 85, 247, 0.80), 0 0 24px rgba(168, 85, 247, 0.35)',
            }}
          />
          {/* Curseur lumineux en bout de progression */}
          {progressPercent > 2 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full transition-all duration-150"
              style={{
                left: `calc(${progressPercent}% - 5px)`,
                background: '#ffffff',
                boxShadow: '0 0 8px rgba(208, 143, 255, 1), 0 0 16px rgba(168, 85, 247, 0.80)',
              }}
            />
          )}
        </div>

        {/* Contenu du player */}
        <div className="flex items-center gap-3 p-3 sm:p-3.5 mt-1">

          {/* Jaquette */}
          <div className="relative flex-shrink-0">
            <div
              className="rounded-xl overflow-hidden"
              style={{
                width: '52px',
                height: '52px',
                boxShadow: `0 4px 16px rgba(0,0,0,0.55), 0 0 20px rgba(168, 85, 247, 0.25)`,
              }}
            >
              <img
                src={coverSrc}
                alt={currentBook.title}
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80'; }}
                className="w-full h-full object-cover"
                style={{
                  filter: isPlaying ? 'brightness(1.05) saturate(1.1)' : 'brightness(0.85)',
                  transition: 'filter 400ms',
                }}
              />
            </div>

            {/* Indicateur lecture animé */}
            {isPlaying && (
              <div
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #e879f9)',
                  boxShadow: '0 0 8px rgba(168, 85, 247, 0.80)',
                  border: '1.5px solid rgba(8, 5, 22, 0.95)',
                }}
              >
                <span
                  className="w-1.5 h-1.5 bg-white rounded-full animate-ping"
                  style={{ animationDuration: '1.2s' }}
                />
              </div>
            )}
          </div>

          {/* Titre + Chapitre */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-bold truncate" style={{ color: '#F5F3FF' }}>
                {currentBook.title}
              </p>
              {isPreviewMode && (
                <span
                  className="flex-shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(251, 191, 36, 0.15)',
                    color: '#fbbf24',
                    border: '1px solid rgba(251, 191, 36, 0.30)',
                  }}
                >
                  Extrait
                </span>
              )}
            </div>
            <p className="text-xs truncate" style={{ color: 'rgba(139, 135, 168, 0.9)' }}>
              {currentChapter?.title || currentBook.author}
            </p>
          </div>

          {/* Horodatage */}
          <div className="hidden sm:block text-right pr-1 flex-shrink-0">
            <span className="text-xs font-mono" style={{ color: 'rgba(139, 135, 168, 0.8)' }}>
              {formatTime(currentTime)}
            </span>
            <span className="text-xs" style={{ color: 'rgba(82, 78, 110, 0.9)' }}>
              {' / '}{formatTime(duration)}
            </span>
          </div>

          {/* Contrôles */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {/* -15s */}
            <button
              onClick={() => skipBackward(15)}
              title="Reculer 15s"
              className="hidden xs:flex p-2 rounded-full transition-all hover:scale-110 active:scale-95"
              style={{
                color: 'rgba(139, 135, 168, 0.9)',
                background: 'rgba(255,255,255,0.05)',
              }}
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Play / Pause PRINCIPAL */}
            <button
              onClick={togglePlay}
              className="flex items-center justify-center rounded-full transition-all duration-200 hover:scale-110 active:scale-90"
              style={{
                width: '44px',
                height: '44px',
                background: 'linear-gradient(135deg, #7c3aed, #a855f7, #c026d3)',
                boxShadow: isPlaying
                  ? '0 0 20px rgba(168, 85, 247, 0.70), 0 4px 16px rgba(0,0,0,0.50)'
                  : '0 4px 20px rgba(168, 85, 247, 0.50), 0 2px 8px rgba(0,0,0,0.40)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-white text-white" />
              ) : (
                <Play className="w-4 h-4 fill-white text-white ml-0.5" />
              )}
            </button>

            {/* +30s */}
            <button
              onClick={() => skipForward(30)}
              title="Avancer 30s"
              className="p-2 rounded-full transition-all hover:scale-110 active:scale-95"
              style={{
                color: 'rgba(139, 135, 168, 0.9)',
                background: 'rgba(255,255,255,0.05)',
              }}
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Plein écran */}
            <button
              onClick={() => setIsFullScreenOpen(true)}
              title="Agrandir"
              className="hidden sm:flex p-2 rounded-full transition-all hover:scale-110 active:scale-95"
              style={{
                color: 'rgba(139, 135, 168, 0.9)',
                background: 'rgba(255,255,255,0.05)',
              }}
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
