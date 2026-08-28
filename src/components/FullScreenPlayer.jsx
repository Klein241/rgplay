import React, { useState } from 'react';
import { 
  ChevronDown, Heart, RotateCcw, RotateCw, Play, Pause, SkipBack, SkipForward, 
  Moon, Gauge, Bookmark, ListMusic, Volume2, VolumeX, Share2, Plus, Trash2, CheckCircle2, Clock
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { SpeedSelectorModal } from './SpeedSelectorModal';
import { SleepTimerModal } from './SleepTimerModal';

export const FullScreenPlayer = () => {
  const {
    currentBook,
    currentChapterIndex,
    currentChapter,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    volume,
    isMuted,
    isPreviewMode,
    isFullScreenOpen,
    sleepTimerOption,
    sleepTimerSecondsLeft,
    bookmarks,
    togglePlay,
    seekTo,
    skipForward,
    skipBackward,
    handleNextChapter,
    handlePrevChapter,
    selectChapter,
    addBookmark,
    removeBookmark,
    formatTime,
    setIsFullScreenOpen,
  } = useAudio();

  const [activeTab, setActiveTab] = useState('player'); // 'player', 'chapters', 'bookmarks'
  const [isSpeedModalOpen, setIsSpeedModalOpen] = useState(false);
  const [isSleepModalOpen, setIsSleepModalOpen] = useState(false);
  const [newBookmarkNote, setNewBookmarkNote] = useState('');
  const [isAddingBookmark, setIsAddingBookmark] = useState(false);

  if (!isFullScreenOpen || !currentBook) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const remainingTime = Math.max(duration - currentTime, 0);

  const handleCreateBookmark = (e) => {
    e.preventDefault();
    addBookmark(newBookmarkNote);
    setNewBookmarkNote('');
    setIsAddingBookmark(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0a0714] text-slate-100 flex flex-col justify-between animate-fadeIn">
      {/* Fond flouté avec halo de jaquette */}
      <div 
        className="absolute inset-0 opacity-20 bg-cover bg-center filter blur-3xl scale-125 -z-10 pointer-events-none"
        style={{ backgroundImage: `url(${
          !currentBook.cover_url ? 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80'
          : currentBook.cover_url.includes('r2.cloudflarestorage.com') && currentBook.cover_r2_key
            ? `/api/r2/download?key=${encodeURIComponent(currentBook.cover_r2_key)}`
            : currentBook.cover_url.includes('r2.cloudflarestorage.com')
              ? 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80'
              : currentBook.cover_url
        })` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0714]/80 via-[#0f0c1b]/95 to-[#080511] -z-10" />

      {/* Header du lecteur */}
      <header className="px-6 py-4 flex items-center justify-between z-10 border-b border-white/5 backdrop-blur-md">
        <button
          onClick={() => setIsFullScreenOpen(false)}
          className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        <div className="text-center">
          <p className="text-[11px] uppercase tracking-widest font-bold text-purple-300">
            {isPreviewMode ? 'Extrait Démo Gratuit' : 'En Lecture'}
          </p>
          <p className="text-xs font-semibold text-slate-400 max-w-[200px] sm:max-w-xs truncate">
            {currentBook.title}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: currentBook.title,
                  text: `J'écoute ${currentBook.title} sur RG Play !`,
                  url: window.location.href,
                }).catch(() => {});
              }
            }}
            className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Onglets de navigation dans le lecteur */}
      <div className="flex justify-center px-6 pt-3 z-10">
        <div className="inline-flex p-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl">
          <button
            onClick={() => setActiveTab('player')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeTab === 'player'
                ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-md shadow-purple-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Lecteur
          </button>
          <button
            onClick={() => setActiveTab('chapters')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'chapters'
                ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-md shadow-purple-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListMusic className="w-3.5 h-3.5" />
            <span>Chapitres ({currentBook.chapters?.length || 1})</span>
          </button>
          <button
            onClick={() => setActiveTab('bookmarks')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'bookmarks'
                ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-md shadow-purple-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Signets</span>
          </button>
        </div>
      </div>

      {/* Contenu Principal selon l'onglet actif */}
      <main className="flex-1 flex flex-col justify-center max-w-xl mx-auto w-full px-6 py-4 z-10">
        {activeTab === 'player' && (
          <div className="flex flex-col items-center">
            {/* Jaquette avec halo lumineux et effet de lévitation */}
            <div className="relative my-3 group">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-pink-500 filter blur-2xl opacity-40 cover-halo -z-10"></div>
              <img
                src={
                  !currentBook.cover_url ? 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80'
                  : currentBook.cover_url.includes('r2.cloudflarestorage.com') && currentBook.cover_r2_key
                    ? `/api/r2/download?key=${encodeURIComponent(currentBook.cover_r2_key)}`
                    : currentBook.cover_url.includes('r2.cloudflarestorage.com')
                      ? 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80'
                      : currentBook.cover_url
                }
                alt={currentBook.title}
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80'; }}
                className="w-56 h-56 sm:w-64 sm:h-64 object-cover rounded-3xl shadow-2xl border border-white/20 transform transition-transform duration-500 group-hover:scale-102"
              />
            </div>

            {/* Visualiseur d'ondes sonores dynamique (Waveform Equalizer) */}
            <div className="flex items-center justify-center gap-1.5 my-3 h-8">
              {isPlaying ? (
                <>
                  <span className="waveform-bar"></span>
                  <span className="waveform-bar"></span>
                  <span className="waveform-bar"></span>
                  <span className="waveform-bar"></span>
                  <span className="waveform-bar"></span>
                  <span className="waveform-bar"></span>
                  <span className="waveform-bar"></span>
                  <span className="waveform-bar"></span>
                </>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                  <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                  <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                  <span>En pause</span>
                  <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                  <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                  <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                </div>
              )}
            </div>

            {/* Titre du livre et métadonnées */}
            <div className="w-full text-center mb-4">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-snug mb-1 line-clamp-1">
                {currentBook.title}
              </h1>
              <p className="text-sm font-semibold text-purple-300 mb-0.5">
                {currentChapter?.title || `Chapitre ${currentChapterIndex + 1}`}
              </p>
              <p className="text-xs text-slate-400">
                Par <span className="text-slate-200">{currentBook.author}</span> • Lu par <span className="text-slate-200">{currentBook.narrator}</span>
              </p>
            </div>

            {/* Barre de défilement temporelle (Seekbar) */}
            <div className="w-full space-y-2 mb-4">
              <div className="relative flex items-center">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={(e) => seekTo(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              <div className="flex justify-between text-xs font-mono text-slate-400 font-semibold px-0.5">
                <span>{formatTime(currentTime)}</span>
                <span>-{formatTime(remainingTime)}</span>
              </div>
            </div>

            {/* Rangée des outils secondaires : Vitesse, Sommeil, Signet */}
            <div className="flex items-center justify-between w-full px-4 mb-4 text-xs font-semibold">
              {/* Vitesse */}
              <button
                onClick={() => setIsSpeedModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors"
              >
                <Gauge className="w-3.5 h-3.5 text-purple-400" />
                <span>{playbackRate}x</span>
              </button>

              {/* Minuteur */}
              <button
                onClick={() => setIsSleepModalOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
                  sleepTimerOption
                    ? 'bg-purple-600/30 text-purple-200 border border-purple-400/50'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-pink-400" />
                <span>
                  {sleepTimerSecondsLeft !== null 
                    ? formatTime(sleepTimerSecondsLeft)
                    : sleepTimerOption === 'end_chapter' 
                    ? 'Fin chap.' 
                    : 'Sommeil'}
                </span>
              </button>

              {/* Ajouter un Signet rapide */}
              <button
                onClick={() => addBookmark(`Signet à ${formatTime(currentTime)}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors"
              >
                <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                <span>Signet</span>
              </button>

              {/* Partager le livre audio */}
              <button
                onClick={async () => {
                  const url = `${window.location.origin}/?book=${currentBook.id}`;
                  if (navigator.share) {
                    try {
                      await navigator.share({
                        title: currentBook.title,
                        text: `Écoutez "${currentBook.title}" par ${currentBook.author} sur RG Play`,
                        url,
                      });
                    } catch (_) {}
                  } else {
                    navigator.clipboard.writeText(url);
                    alert('✓ Lien du livre audio copié dans le presse-papiers !');
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors"
                title="Partager ce livre audio"
              >
                <Share2 className="w-3.5 h-3.5 text-purple-400" />
                <span>Partager</span>
              </button>
            </div>

            {/* Contrôles Principaux de Lecture */}
            <div className="flex items-center justify-center gap-4 sm:gap-6 w-full">
              {/* Chapitre Précédent */}
              <button
                onClick={handlePrevChapter}
                title="Chapitre précédent"
                className="p-3 text-slate-300 hover:text-white hover:bg-white/5 rounded-full transition-colors"
              >
                <SkipBack className="w-6 h-6" />
              </button>

              {/* -15s */}
              <button
                onClick={() => skipBackward(15)}
                title="Reculer de 15 secondes"
                className="p-3 text-slate-300 hover:text-white hover:bg-white/5 rounded-full transition-colors relative flex flex-col items-center"
              >
                <RotateCcw className="w-6 h-6" />
                <span className="text-[9px] font-bold mt-0.5">15s</span>
              </button>

              {/* Bouton Play / Pause Principal */}
              <button
                onClick={togglePlay}
                className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-pink-500 text-white flex items-center justify-center shadow-xl shadow-purple-600/50 hover:scale-105 active:scale-95 transition-all"
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7 fill-white" />
                ) : (
                  <Play className="w-7 h-7 fill-white ml-1" />
                )}
              </button>

              {/* +30s */}
              <button
                onClick={() => skipForward(30)}
                title="Avancer de 30 secondes"
                className="p-3 text-slate-300 hover:text-white hover:bg-white/5 rounded-full transition-colors relative flex flex-col items-center"
              >
                <RotateCw className="w-6 h-6" />
                <span className="text-[9px] font-bold mt-0.5">30s</span>
              </button>

              {/* Chapitre Suivant */}
              <button
                onClick={handleNextChapter}
                title="Chapitre suivant"
                className="p-3 text-slate-300 hover:text-white hover:bg-white/5 rounded-full transition-colors"
              >
                <SkipForward className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}

        {/* Vue Liste des Chapitres */}
        {activeTab === 'chapters' && (
          <div className="space-y-2.5 h-[420px] overflow-y-auto pr-1">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">
              Table des matières
            </h3>
            {currentBook.chapters?.map((chap, idx) => {
              const isCurrent = idx === currentChapterIndex;
              return (
                <div
                  key={chap.id || idx}
                  onClick={() => {
                    selectChapter(idx);
                    setActiveTab('player');
                  }}
                  className={`p-3.5 rounded-2xl flex items-center justify-between cursor-pointer transition-all ${
                    isCurrent
                      ? 'bg-gradient-to-r from-purple-600/40 to-pink-500/30 border border-purple-500/50 shadow-lg shadow-purple-500/20'
                      : 'bg-white/5 hover:bg-white/10 border border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold ${
                      isCurrent ? 'bg-purple-600 text-white' : 'bg-white/10 text-slate-400'
                    }`}>
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-sm font-bold truncate ${isCurrent ? 'text-white' : 'text-slate-200'}`}>
                        {chap.title}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Durée estimée : {formatTime(chap.duration_seconds || 1800)}
                      </p>
                    </div>
                  </div>

                  {isCurrent && isPlaying ? (
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-4 bg-purple-400 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-6 bg-pink-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1.5 h-3 bg-purple-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </div>
                  ) : (
                    <Play className="w-4 h-4 text-slate-400 opacity-60" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Vue Signets & Prise de Notes */}
        {activeTab === 'bookmarks' && (
          <div className="space-y-3 h-[420px] overflow-y-auto pr-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                Vos Signets Personnalisés
              </h3>
              <button
                onClick={() => setIsAddingBookmark(!isAddingBookmark)}
                className="px-3 py-1 rounded-full text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nouveau</span>
              </button>
            </div>

            {isAddingBookmark && (
              <form onSubmit={handleCreateBookmark} className="p-3.5 rounded-2xl glass-card border border-purple-500/40 mb-3 space-y-2.5">
                <p className="text-xs font-semibold text-purple-300">
                  Ajouter une note à {formatTime(currentTime)} ({currentChapter?.title})
                </p>
                <input
                  type="text"
                  value={newBookmarkNote}
                  onChange={(e) => setNewBookmarkNote(e.target.value)}
                  placeholder="Ex : Citation inspirante sur la persévérance..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingBookmark(false)}
                    className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:text-white"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white"
                  >
                    Sauvegarder
                  </button>
                </div>
              </form>
            )}

            {bookmarks.filter(b => b.audiobook_id === currentBook.id).length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Bookmark className="w-10 h-10 mx-auto mb-2 opacity-40 text-purple-400" />
                <p className="text-sm font-semibold">Aucun signet pour ce livre</p>
                <p className="text-xs mt-1">Créez un signet pour retrouver un passage marquant.</p>
              </div>
            ) : (
              bookmarks.filter(b => b.audiobook_id === currentBook.id).map((bm) => (
                <div
                  key={bm.id}
                  onClick={() => {
                    seekTo(bm.timestamp_seconds);
                    setActiveTab('player');
                  }}
                  className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-between cursor-pointer group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-amber-400 font-mono">
                        {formatTime(bm.timestamp_seconds)}
                      </span>
                      <span className="text-[11px] text-slate-400 truncate">
                        • {bm.chapter_title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 line-clamp-1">{bm.note}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBookmark(bm.id);
                    }}
                    className="p-2 text-slate-500 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Modals de réglage */}
      <SpeedSelectorModal 
        isOpen={isSpeedModalOpen}
        onClose={() => setIsSpeedModalOpen(false)}
      />

      <SleepTimerModal 
        isOpen={isSleepModalOpen}
        onClose={() => setIsSleepModalOpen(false)}
      />
    </div>
  );
};
