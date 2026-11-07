import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Sparkles, ChevronLeft } from 'lucide-react';
import { artistApi, DEFAULT_ARTIST_VICTOIRE_K } from '../services/api/artistApi';
import { ArtistHeroPlayer } from './artist/ArtistHeroPlayer';
import { ArtistDiscographyGrid } from './artist/ArtistDiscographyGrid';
import { ArtistMiniPlayer } from './artist/ArtistMiniPlayer';

/**
 * ArtistPageView - Vue dédiée 100% isolée pour la page artiste
 * Architecture conforme AGENTS.md (< 400 lignes)
 * Respecte à la lettre le design fourni par l'utilisateur (media_1794049220110_9436cca2.jpg)
 */
export const ArtistPageView = ({ slug = 'victoireK', onBack }) => {
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);
  const [mobileScreen, setMobileScreen] = useState('player'); // 'player' (Screen 1) | 'list' (Screen 2)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const audioRef = useRef(null);

  // Charger les données artiste
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    artistApi.getArtistBySlug(slug).then((data) => {
      if (!isMounted) return;
      setArtist(data || DEFAULT_ARTIST_VICTOIRE_K);
      setLoading(false);
    }).catch(() => {
      if (!isMounted) return;
      setArtist(DEFAULT_ARTIST_VICTOIRE_K);
      setLoading(false);
    });

    return () => { isMounted = false; };
  }, [slug]);

  const tracks = artist?.tracks || [];
  const currentTrack = tracks[currentTrackIndex] || tracks[0] || null;

  // ── GESTION DE LA LECTURE AUDIO & AUTOPLAY IMMÉDIAT ──
  useEffect(() => {
    if (!currentTrack?.audio_url) return;

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    const audio = audioRef.current;
    audio.src = currentTrack.audio_url;
    audio.load();

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      setDuration(audio.duration || currentTrack.duration_seconds || 240);
    };
    const onEnded = () => handleNext();

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    // Tentative d'autoplay immédiat
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          setAutoplayBlocked(false);
        })
        .catch(() => {
          setIsPlaying(false);
          setAutoplayBlocked(true);
        });
    }

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.pause();
    };
  }, [currentTrack]);

  const handleUserFirstGesture = () => {
    if (autoplayBlocked && audioRef.current) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        setAutoplayBlocked(false);
      }).catch(() => {});
    }
  };

  const handleTogglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        setAutoplayBlocked(false);
      }).catch(() => {});
    }
  };

  const handleSeek = (newTime) => {
    if (audioRef.current && Number.isFinite(newTime)) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleNext = () => {
    if (!tracks.length) return;
    if (isShuffle) {
      const nextIdx = Math.floor(Math.random() * tracks.length);
      setCurrentTrackIndex(nextIdx);
    } else {
      setCurrentTrackIndex((prev) => (prev + 1) % tracks.length);
    }
  };

  const handlePrev = () => {
    if (!tracks.length) return;
    setCurrentTrackIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
  };

  const handleSelectTrack = (track) => {
    const idx = tracks.findIndex((t) => t.id === track.id);
    if (idx >= 0) {
      setCurrentTrackIndex(idx);
    }
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07030c] flex flex-col items-center justify-center text-white space-y-4">
        <Loader2 className="w-9 h-9 text-purple-400 animate-spin" />
        <p className="text-[11px] font-bold text-slate-400 font-['Outfit'] tracking-widest uppercase">
          Chargement de l'univers de Chantre Victoire K...
        </p>
      </div>
    );
  }

  return (
    <div
      onClick={handleUserFirstGesture}
      className="min-h-screen relative text-white overflow-x-hidden selection:bg-purple-500 selection:text-white"
      style={{
        background: 'radial-gradient(circle at 50% 15%, #180928 0%, #07030c 75%, #030106 100%)',
      }}
    >
      {/* Bannière de reprise autoplay si bloqué par le navigateur */}
      {autoplayBlocked && (
        <div
          onClick={handleUserFirstGesture}
          className="fixed top-0 inset-x-0 z-50 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 px-4 py-2 text-center text-xs font-black font-['Outfit'] text-white flex items-center justify-center gap-2 cursor-pointer shadow-lg animate-pulse"
        >
          <Sparkles className="w-4 h-4" />
          <span>Appuyez pour activer le son de Chantre Victoire K</span>
        </div>
      )}

      {/* ── RENDU DESKTOP : AFFICHAGE CÔTE À CÔTE ÉLÉGANT ── */}
      <div className="hidden lg:grid max-w-6xl mx-auto px-8 py-8 grid-cols-12 gap-10 items-start">
        {/* Écran 1 (Gauche) */}
        <div className="col-span-5 sticky top-8">
          <ArtistHeroPlayer
            artist={artist}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            progress={progress}
            onTogglePlay={handleTogglePlay}
            onNext={handleNext}
            onPrev={handlePrev}
            onSeek={handleSeek}
            onOpenList={() => {}}
            onBack={onBack}
          />
        </div>

        {/* Écran 2 (Droite) */}
        <div className="col-span-7 bg-white/[0.02] border border-white/10 rounded-3xl p-6 backdrop-blur-xl">
          <ArtistDiscographyGrid
            artist={artist}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onSelectTrack={handleSelectTrack}
            onTogglePlay={handleTogglePlay}
            isShuffle={isShuffle}
            onToggleShuffle={() => setIsShuffle(!isShuffle)}
            onBackToPlayer={() => {}}
          />
        </div>
      </div>

      {/* ── RENDU MOBILE (100% FIDÈLE AUX DEUX ÉCRANS DU SCREENSHOT) ── */}
      <div className="block lg:hidden min-h-screen">
        {mobileScreen === 'player' ? (
          <ArtistHeroPlayer
            artist={artist}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            progress={progress}
            onTogglePlay={handleTogglePlay}
            onNext={handleNext}
            onPrev={handlePrev}
            onSeek={handleSeek}
            onOpenList={() => setMobileScreen('list')}
            onBack={onBack}
          />
        ) : (
          <>
            <ArtistDiscographyGrid
              artist={artist}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onSelectTrack={handleSelectTrack}
              onTogglePlay={handleTogglePlay}
              isShuffle={isShuffle}
              onToggleShuffle={() => setIsShuffle(!isShuffle)}
              onBackToPlayer={() => setMobileScreen('player')}
            />

            <ArtistMiniPlayer
              currentTrack={currentTrack}
              artist={artist}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onNext={handleNext}
              onPrev={handlePrev}
              onScrollToTop={() => setMobileScreen('player')}
            />
          </>
        )}
      </div>
    </div>
  );
};

// Export par défaut pour chargement différé (Code-Splitting React.lazy)
export default ArtistPageView;
