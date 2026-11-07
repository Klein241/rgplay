import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, Share2, Sparkles, Check, Mic, Disc, Loader2 } from 'lucide-react';
import { artistApi, DEFAULT_ARTIST_VICTOIRE_K } from '../services/api/artistApi';
import { ArtistHeroPlayer } from './artist/ArtistHeroPlayer';
import { ArtistDiscographyGrid } from './artist/ArtistDiscographyGrid';
import { ArtistMiniPlayer } from './artist/ArtistMiniPlayer';

/**
 * ArtistPageView - Vue complète dédiée à une page d'artiste
 * Conforme au design pur glassmorphism / music player soumis par l'utilisateur.
 */
export const ArtistPageView = ({ slug = 'victoireK', onBack }) => {
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const audioRef = useRef(null);

  // Charger le profil de l'artiste
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    artistApi.getArtistBySlug(slug).then((data) => {
      if (!isMounted) return;
      if (data) {
        setArtist(data);
      } else {
        setArtist(DEFAULT_ARTIST_VICTOIRE_K);
      }
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

  // ── LECTURE AUDIO & AUTOPLAY AUTOMATIQUE ──
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
      setDuration(audio.duration || currentTrack.duration_seconds || 210);
    };
    const onEnded = () => handleNext();

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    // Tentative d'autoplay immédiat dès le chargement de la page
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          setAutoplayBlocked(false);
        })
        .catch((err) => {
          console.log('[Autoplay]: Interaction utilisateur requise par le navigateur', err);
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

  // Déblocage autoplay au premier clic de l'utilisateur
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

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleShareWhatsApp = () => {
    const url = window.location.href;
    const text = encodeURIComponent(`Écoutez les albums et chansons de ${artist?.name || 'l\'artiste'} sur RG Play 🎵 :\n${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0614] flex flex-col items-center justify-center text-white space-y-4">
        <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
        <p className="text-xs font-bold text-slate-400 font-['Outfit'] tracking-wider uppercase">
          Chargement de l'univers musical...
        </p>
      </div>
    );
  }

  return (
    <div
      onClick={handleUserFirstGesture}
      className="min-h-screen relative text-white overflow-x-hidden selection:bg-purple-500 selection:text-white"
      style={{
        background: 'radial-gradient(circle at 50% 20%, #1f0d36 0%, #0d0614 70%, #06020a 100%)',
      }}
    >
      {/* ── BARRE DE NAVIGATION SUPÉRIEURE ── */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-black/30 border-b border-white/8 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (onBack) {
                onBack();
              } else {
                window.location.href = '/';
              }
            }}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Retour à RG Play"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-wider text-purple-200 font-['Outfit']">
              Page Artiste Certifiée
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer border border-white/10"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 text-[11px]">Lien Copié</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">Partager</span>
              </>
            )}
          </button>

          <button
            onClick={handleShareWhatsApp}
            className="px-3.5 py-1.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-black font-['Outfit'] transition-all flex items-center gap-1.5 cursor-pointer"
          >
            WhatsApp
          </button>
        </div>
      </header>

      {/* ── BANNIÈRE AUTOPLAY (Si le navigateur a bloqué le son initial) ── */}
      {autoplayBlocked && (
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-center text-xs font-black font-['Outfit'] text-white flex items-center justify-center gap-2 cursor-pointer shadow-lg animate-pulse">
          <Sparkles className="w-4 h-4" />
          <span>Appuyez ici pour lancer la lecture de {artist?.name || 'l\'artiste'}</span>
        </div>
      )}

      {/* ── CONTENU PRINCIPAL RESPONSIVE (Side-by-Side sur Desktop, Stack sur Mobile) ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-6 pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* COLONNE GAUCHE (Écran 1 / Hero Player Radial) */}
          <div className="lg:col-span-5 lg:sticky lg:top-24">
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
              isShuffle={isShuffle}
              onToggleShuffle={() => setIsShuffle(!isShuffle)}
              isRepeat={isRepeat}
              onToggleRepeat={() => setIsRepeat(!isRepeat)}
            />
          </div>

          {/* COLONNE DROITE (Écran 2 / Dropdown & Cartes 2 Colonnes) */}
          <div className="lg:col-span-7">
            <ArtistDiscographyGrid
              artist={artist}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onSelectTrack={handleSelectTrack}
              onTogglePlay={handleTogglePlay}
              isShuffle={isShuffle}
              onToggleShuffle={() => setIsShuffle(!isShuffle)}
            />
          </div>
        </div>
      </main>

      {/* ── MINI LECTEUR PERSISTANT EN BAS (Mobile) ── */}
      <ArtistMiniPlayer
        currentTrack={currentTrack}
        artist={artist}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onNext={handleNext}
        onPrev={handlePrev}
        onScrollToTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />
    </div>
  );
};
