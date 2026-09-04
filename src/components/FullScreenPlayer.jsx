import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronDown, Heart, RotateCcw, Play, Pause, SkipBack, SkipForward, 
  Moon, Gauge, Bookmark, ListMusic, Volume2, VolumeX, Share2, Sparkles,
  Search, Menu, CheckCircle2, Star, ChevronLeft, ChevronRight, X, Square
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { apiClient } from '../services/api';
import { shareAudioWithCover } from '../utils/shareUtils';
import { SpeedSelectorModal } from './SpeedSelectorModal';
import { SleepTimerModal } from './SleepTimerModal';
import { BookChatModal } from './BookChatModal';

export const FullScreenPlayer = () => {
  const {
    currentBook,
    currentChapterIndex,
    currentChapter,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    isMuted,
    isPreviewMode,
    isFullScreenOpen,
    sleepTimerOption,
    togglePlay,
    stopAudio,
    seekTo,
    handleNextChapter,
    handlePrevChapter,
    selectChapter,
    formatTime,
    setIsFullScreenOpen,
    playBook,
  } = useAudio();

  const [activeView, setActiveView] = useState('player'); // 'player' | 'chapters'
  const [isSpeedModalOpen, setIsSpeedModalOpen] = useState(false);
  const [isSleepModalOpen, setIsSleepModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [shareToast, setShareToast] = useState('');
  const [recentPlaylist, setRecentPlaylist] = useState([]);

  // Calcul du pourcentage de progression
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const remainingTime = Math.max(duration - currentTime, 0);

  // Charger les livres de la playlist récente / recommandations
  useEffect(() => {
    if (!currentBook?.id) return;
    apiClient.getAudiobooks({ category: 'all' }).then((books) => {
      if (Array.isArray(books)) {
        setRecentPlaylist(books.filter(b => b.id !== currentBook.id).slice(0, 8));
      }
    }).catch(() => {});
  }, [currentBook?.id]);

  if (!isFullScreenOpen || !currentBook) return null;

  const handleShare = async () => {
    const res = await shareAudioWithCover(currentBook);
    if (res.method === 'clipboard') {
      setShareToast('✓ Lien copié !');
      setTimeout(() => setShareToast(''), 2500);
    }
  };

  const currentCover = currentBook.cover_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80';
  const radius = 108;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (progressPercent / 100) * circumference;

  // Calcul du chapitre précédent et suivant pour les vignettes de navigation
  const prevChapterTitle = currentChapterIndex > 0 
    ? (currentBook.chapters?.[currentChapterIndex - 1]?.title || `Chapitre ${currentChapterIndex}`)
    : 'Début';

  const nextChapterTitle = currentBook.chapters && currentChapterIndex < currentBook.chapters.length - 1
    ? (currentBook.chapters?.[currentChapterIndex + 1]?.title || `Chapitre ${currentChapterIndex + 2}`)
    : 'Fin';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0d0618] text-slate-100 flex flex-col justify-between animate-fadeIn select-none">
      
      {/* ── FOND ROYALE PLUM & HALO SUBTIL ── */}
      <div 
        className="absolute inset-0 opacity-20 bg-cover bg-center filter blur-3xl scale-125 -z-10 pointer-events-none"
        style={{ backgroundImage: `url(${currentCover})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#140826]/90 via-[#0e0618]/95 to-[#08030f] -z-10" />

      {/* ── EN-TÊTE SUPÉRIEUR (@iSalmanArt Screen 3) ── */}
      <header className="px-5 sm:px-8 py-4 flex items-center justify-between z-10">
        <button
          onClick={() => setIsFullScreenOpen(false)}
          className="p-2.5 rounded-full hover:bg-white/10 text-[#c4b0e8] hover:text-white transition-colors cursor-pointer"
          title="Fermer"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        <div className="text-center">
          <h2 className="text-sm sm:text-base font-black tracking-widest text-[#e9d5ff] uppercase font-heading">
            LECTEUR AUDIO
          </h2>
          <span className="text-[10px] text-purple-300 font-semibold">
            {currentBook.chapters?.length ? `${currentBook.chapters.length} chapitres disponibles` : 'Piste Unique'}
          </span>
        </div>

        <button
          onClick={() => setActiveView(prev => prev === 'player' ? 'chapters' : 'player')}
          className={`p-2.5 rounded-2xl flex items-center gap-1.5 transition-all cursor-pointer border ${
            activeView === 'chapters'
              ? 'bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-600/40'
              : 'bg-white/10 hover:bg-white/20 text-[#c4b0e8] hover:text-white border-white/10'
          }`}
          title="Ouvrir la liste des chapitres et séries"
        >
          <ListMusic className="w-5 h-5 text-purple-300" />
          <span className="text-xs font-bold hidden sm:inline">
            {activeView === 'chapters' ? 'Lecteur' : 'Chapitres'}
          </span>
        </button>
      </header>

      {/* ── VUE PRINCIPALE DU LECTEUR ── */}
      {activeView === 'player' ? (
        <main className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full px-4 sm:px-6 py-2 z-10">
          
          {/* Titre & Auteur de l'œuvre (@iSalmanArt) */}
          <div className="text-center mb-4 max-w-sm">
            <h1 className="text-lg sm:text-2xl font-bold text-white tracking-wide truncate">
              {currentChapter?.title || currentBook.title}
            </h1>
            <p className="text-xs sm:text-sm text-[#c4b0e8] font-medium truncate mt-1">
              {currentBook.author || 'Auteur inconnu'} • {formatTime(duration)}
            </p>
          </div>

          {/* ── CADRAN RADIAL CIRCULAIRE SIGNATURE (@iSalmanArt Screen 3) ── */}
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 my-3 flex items-center justify-center">
            
            {/* Visualiseur d'ondes audio en arrière-plan */}
            <div className="absolute inset-0 flex items-center justify-between px-2 opacity-30 pointer-events-none">
              <div className="flex items-center gap-1">
                <span className="w-1 rounded-full bg-purple-400 eq-bar-1" />
                <span className="w-1 rounded-full bg-cyan-300 eq-bar-2" />
                <span className="w-1 rounded-full bg-purple-300 eq-bar-3" />
                <span className="w-1 rounded-full bg-pink-400 eq-bar-4" />
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1 rounded-full bg-purple-300 eq-bar-5" />
                <span className="w-1 rounded-full bg-pink-400 eq-bar-2" />
                <span className="w-1 rounded-full bg-cyan-300 eq-bar-3" />
                <span className="w-1 rounded-full bg-purple-400 eq-bar-1" />
              </div>
            </div>

            {/* SVG Ring circulaire de progression */}
            <svg className="absolute inset-0 w-full h-full -rotate-90 transform drop-shadow-[0_0_20px_rgba(168,85,247,0.4)]" viewBox="0 0 250 250">
              <defs>
                <linearGradient id="salmanRadialGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#d8b4fe" />
                  <stop offset="50%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
              {/* Cercle de fond */}
              <circle
                cx="125"
                cy="125"
                r={radius}
                fill="transparent"
                stroke="rgba(168, 85, 247, 0.18)"
                strokeWidth="7"
              />
              {/* Arc de progression dynamique */}
              <circle
                cx="125"
                cy="125"
                r={radius}
                fill="transparent"
                stroke="url(#salmanRadialGrad)"
                strokeWidth="7"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
                className="transition-all duration-150"
              />
            </svg>

            {/* Disque central avec jaquette translucide & Bouton Play/Pause */}
            <div className="relative w-48 h-48 sm:w-54 sm:h-54 rounded-full overflow-hidden border border-purple-400/30 shadow-2xl flex items-center justify-center group">
              <img
                src={currentCover}
                alt={currentBook.title}
                className={`w-full h-full object-cover filter brightness-90 ${isPlaying ? 'animate-[spin_20s_linear_infinite]' : ''}`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-purple-950/40 to-transparent" />

              {/* Bouton Play/Pause Central en verre dépoli (@iSalmanArt signature) */}
              <button
                type="button"
                onClick={togglePlay}
                className="relative z-10 w-16 h-16 rounded-full bg-white/20 backdrop-blur-xl border border-white/40 text-white flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.6)] hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
                title={isPlaying ? "Pause" : "Lecture"}
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7 text-white fill-white" />
                ) : (
                  <Play className="w-7 h-7 text-white fill-white ml-1" />
                )}
              </button>
            </div>
          </div>

          {/* ── TIMESTAMPS & ACTIONS SECONDAIRES ── */}
          <div className="w-full max-w-xs flex items-center justify-between text-xs font-mono font-bold text-[#c4b0e8] px-2 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Barre d'outils interactifs (Stop, Vitesse, Favori, Partage, Agent SKY) */}
          <div className="flex items-center justify-center gap-6 my-3 text-[#c4b0e8]">
            <button
              onClick={() => setIsSpeedModalOpen(true)}
              className="p-2 rounded-full hover:bg-white/10 hover:text-white transition-colors cursor-pointer text-xs font-bold"
              title="Vitesse de lecture"
            >
              {playbackRate}x
            </button>

            {/* STOP — Arrêt complet */}
            <button
              onClick={stopAudio}
              className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-red-500/15 transition-colors cursor-pointer group"
              title="Arrêter la lecture"
            >
              <div className="w-9 h-9 rounded-full flex items-center justify-center border border-red-500/40 bg-red-500/10 group-hover:bg-red-500/25 group-hover:border-red-400/60 transition-all">
                <Square className="w-4 h-4 text-red-400 fill-red-400" />
              </div>
              <span className="text-[9px] font-bold text-red-400/80 uppercase tracking-wider">Stop</span>
            </button>

            <button
              onClick={() => setIsFavorite(prev => !prev)}
              className={`p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer ${
                isFavorite ? 'text-rose-400 fill-rose-400' : 'hover:text-white'
              }`}
              title="Ajouter aux favoris"
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-rose-400' : ''}`} />
            </button>

            <button
              onClick={handleShare}
              className="p-2 rounded-full hover:bg-white/10 hover:text-white transition-colors cursor-pointer relative"
              title="Partager l'audio"
            >
              <Share2 className="w-5 h-5" />
              {shareToast && (
                <span className="absolute bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-bold text-[10px] shadow-xl animate-fadeIn">
                  {shareToast}
                </span>
              )}
            </button>

            {/* Bouton Chapitres & Séries dédié */}
            <button
              onClick={() => setActiveView('chapters')}
              className="px-3 py-1.5 rounded-full bg-purple-500/20 hover:bg-purple-500/35 text-purple-200 border border-purple-500/40 text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-105 cursor-pointer shadow-md"
              title="Voir tous les chapitres de ce livre"
            >
              <ListMusic className="w-3.5 h-3.5 text-purple-300" />
              <span>Chapitres ({currentBook.chapters?.length || 1})</span>
            </button>

            <button
              onClick={() => setIsChatOpen(true)}
              className="p-2 rounded-full bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-300 border border-cyan-500/40 transition-all hover:scale-105 cursor-pointer"
              title="Discuter avec l'Agent SKY"
            >
              <Sparkles className="w-5 h-5 text-cyan-300 animate-pulse" />
            </button>
          </div>

          {/* ── SÉLECTEURS DE CHAPITRES PRÉCÉDENT / SUIVANT AVEC VIGNETTES ── */}
          <div className="w-full grid grid-cols-2 gap-3 my-2 max-w-sm">
            {/* Précédent */}
            <button
              onClick={handlePrevChapter}
              className="flex items-center gap-2 p-2 rounded-xl bg-[#210f3a]/60 hover:bg-[#2d164f] border border-purple-500/20 text-left transition-all cursor-pointer group"
            >
              <ChevronLeft className="w-5 h-5 text-[#c4b0e8] group-hover:text-white flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-[#a78bfa] uppercase font-bold truncate">Précédent</p>
                <p className="text-xs font-bold text-white truncate">{prevChapterTitle}</p>
              </div>
            </button>

            {/* Suivant */}
            <button
              onClick={handleNextChapter}
              className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#210f3a]/60 hover:bg-[#2d164f] border border-purple-500/20 text-left transition-all cursor-pointer group"
            >
              <div className="min-w-0 pl-1">
                <p className="text-[10px] text-[#a78bfa] uppercase font-bold truncate">Suivant</p>
                <p className="text-xs font-bold text-white truncate">{nextChapterTitle}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-[#c4b0e8] group-hover:text-white flex-shrink-0" />
            </button>
          </div>

          {/* ── SECTION INFÉRIEURE : PLAYLIST RÉCENTE (@iSalmanArt Screen 3) ── */}
          <div className="w-full mt-3 pt-2 border-t border-purple-500/20">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-black tracking-wider text-[#e9d5ff] uppercase font-heading">
                PLAYLIST RÉCENTE
              </h3>
              <span className="text-[11px] text-[#a78bfa] font-bold">
                {recentPlaylist.length} titres
              </span>
            </div>

            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2">
              {recentPlaylist.map((b) => (
                <div
                  key={b.id}
                  onClick={() => playBook(b, 0, 0)}
                  className="flex-shrink-0 w-24 sm:w-28 text-center cursor-pointer group"
                >
                  <div className="relative aspect-square rounded-2xl overflow-hidden mb-1.5 border border-purple-500/30 group-hover:border-purple-400 shadow-md">
                    <img
                      src={b.cover_url || currentCover}
                      alt={b.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <p className="text-[11px] font-bold text-white truncate group-hover:text-purple-200">
                    {b.title}
                  </p>
                  <p className="text-[9.5px] text-[#c4b0e8] truncate">
                    :: {b.author || '2026'} ::
                  </p>
                </div>
              ))}
            </div>
          </div>

        </main>
      ) : (
        /* ── VUE LISTE DES CHAPITRES & SÉRIES (Screen 4 intégré) ── */
        <main className="flex-1 max-w-xl mx-auto w-full px-4 sm:px-6 py-4 overflow-y-auto z-10 scrollbar-thin scrollbar-thumb-purple-900/50 space-y-4">
          <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-black tracking-wider text-[#e9d5ff] uppercase font-heading flex items-center gap-2">
                <ListMusic className="w-5 h-5 text-purple-400" />
                <span>Chapitres & Séries</span>
              </h3>
              <p className="text-xs text-purple-300/70">{currentBook.title} — {currentBook.author}</p>
            </div>
            <button
              onClick={() => setActiveView('player')}
              className="px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/40 text-xs text-white font-bold transition-all cursor-pointer"
            >
              Retour au Lecteur ✕
            </button>
          </div>

          {/* 1. Liste des chapitres de l'œuvre */}
          <div className="space-y-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#a78bfa] block px-1">
              Chapitres de l'œuvre ({currentBook.chapters?.length || 1})
            </span>
            {(currentBook.chapters || [{ id: 'ch-1', title: currentBook.title, duration_seconds: currentBook.duration_seconds }]).map((ch, idx) => {
              const isCurrent = currentChapterIndex === idx;
              return (
                <div
                  key={ch.id || idx}
                  onClick={() => selectChapter(idx)}
                  className={`flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all ${
                    isCurrent
                      ? 'bg-gradient-to-r from-[#3b176d] via-[#2a1052] to-[#1c0a38] border border-purple-400/60 shadow-lg shadow-purple-950/60 scale-[1.01]'
                      : 'bg-white/4 hover:bg-white/8 border border-white/5'
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-3 flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black ${
                      isCurrent ? 'bg-purple-500 text-white shadow-md' : 'bg-white/10 text-purple-300'
                    }`}>
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <h4 className={`text-xs sm:text-sm font-bold truncate ${isCurrent ? 'text-white' : 'text-slate-200'}`}>
                        {ch.title || `Chapitre ${idx + 1}`}
                      </h4>
                      <p className="text-[10px] text-[#a78bfa] mt-0.5">
                        {Math.round((ch.duration_seconds || 1800) / 60)} min
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCurrent && (
                      <div className="flex items-end gap-1 h-3 mr-1">
                        <span className="w-1 rounded-full bg-purple-400 eq-bar-1" />
                        <span className="w-1 rounded-full bg-cyan-300 eq-bar-2" />
                        <span className="w-1 rounded-full bg-purple-300 eq-bar-3" />
                      </div>
                    )}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border ${
                      isCurrent ? 'bg-purple-600 text-white border-purple-400' : 'bg-white/10 text-slate-300 border-white/10'
                    }`}>
                      {isCurrent && isPlaying ? <Pause className="w-3.5 h-3.5 text-cyan-300" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 2. Autres Épisodes / Séries similaires */}
          {recentPlaylist.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-purple-500/20">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#a78bfa] block px-1">
                Autres Titres & Séries Recommandés
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {recentPlaylist.map(b => (
                  <div
                    key={b.id}
                    onClick={() => {
                      playBook(b, 0, 0);
                      setActiveView('player');
                    }}
                    className="p-2.5 rounded-2xl bg-white/4 hover:bg-white/8 border border-white/5 flex items-center gap-3 cursor-pointer transition-all group"
                  >
                    <img
                      src={b.cover_url || currentCover}
                      alt={b.title}
                      className="w-11 h-11 rounded-xl object-cover border border-white/10 group-hover:scale-105 transition-transform shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate group-hover:text-purple-300">{b.title}</p>
                      <p className="text-[10px] text-purple-300/70 truncate">{b.author}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      )}

      {/* ── MODALS CONNECTÉES ── */}
      <SpeedSelectorModal
        isOpen={isSpeedModalOpen}
        onClose={() => setIsSpeedModalOpen(false)}
      />

      <SleepTimerModal
        isOpen={isSleepModalOpen}
        onClose={() => setIsSleepModalOpen(false)}
      />

      <BookChatModal
        book={currentBook}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />

    </div>
  );
};
