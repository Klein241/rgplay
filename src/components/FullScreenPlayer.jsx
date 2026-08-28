import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronDown, Heart, RotateCcw, RotateCw, Play, Pause, SkipBack, SkipForward, 
  Moon, Gauge, Bookmark, ListMusic, Volume2, VolumeX, Share2, Plus, Trash2, CheckCircle2, Clock,
  Star, Sparkles, UserPlus, X, ChevronRight, Headphones, Radio, Music, GraduationCap
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { apiClient } from '../services/api';
import { shareAudioWithCover } from '../utils/shareUtils';
import { SpeedSelectorModal } from './SpeedSelectorModal';
import { SleepTimerModal } from './SleepTimerModal';
import { UserProfileModal } from './UserProfileModal';

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
    playBook,
    playPreview,
  } = useAudio();

  const [activeTab, setActiveTab] = useState('player'); // 'player', 'chapters', 'bookmarks'
  const [isSpeedModalOpen, setIsSpeedModalOpen] = useState(false);
  const [isSleepModalOpen, setIsSleepModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [newBookmarkNote, setNewBookmarkNote] = useState('');
  const [isAddingBookmark, setIsAddingBookmark] = useState(false);

  // ── Recommandations dans le lecteur ──
  const [recommendations, setRecommendations] = useState([]);

  // ── États pour Avis (20s) et Inscription (25s) ──
  const [hasRated, setHasRated] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [dismissedReview, setDismissedReview] = useState(false);

  const [isUserRegistered, setIsUserRegistered] = useState(() => {
    try {
      const stored = localStorage.getItem('rg_user_profile');
      if (stored) {
        const p = JSON.parse(stored);
        return Boolean(p.is_registered);
      }
    } catch {}
    return false;
  });
  const [dismissedRegister, setDismissedRegister] = useState(false);
  const [shareToast, setShareToast] = useState('');

  // Vérifier statut d'avis existant pour ce livre
  useEffect(() => {
    if (currentBook?.id) {
      const savedRating = localStorage.getItem(`rg_rated_${currentBook.id}`);
      setHasRated(Boolean(savedRating));
      setDismissedReview(false);
      setDismissedRegister(false);
      setReviewSubmitted(false);
    }
  }, [currentBook?.id]);

  // Écouter les mises à jour utilisateur
  useEffect(() => {
    const handleUserUpdate = () => {
      try {
        const stored = localStorage.getItem('rg_user_profile');
        if (stored) {
          const p = JSON.parse(stored);
          setIsUserRegistered(Boolean(p.is_registered));
        }
      } catch {}
    };
    window.addEventListener('rg:user-updated', handleUserUpdate);
    return () => window.removeEventListener('rg:user-updated', handleUserUpdate);
  }, []);

  // Charger les recommandations basées sur l'audio actuel
  useEffect(() => {
    if (!currentBook?.id) return;
    apiClient.getAudiobooks({
      category: currentBook.category_id || 'all',
      type: currentBook.content_type || 'all',
    }).then((books) => {
      if (Array.isArray(books)) {
        setRecommendations(books.filter(b => b.id !== currentBook.id).slice(0, 5));
      }
    }).catch(() => {});
  }, [currentBook?.id, currentBook?.category_id, currentBook?.content_type]);

  if (!isFullScreenOpen || !currentBook) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const remainingTime = Math.max(duration - currentTime, 0);

  // Détection du déclenchement Avis (à partir de 20s ou fin)
  const isEligibleForReview = (currentTime >= 20 || (duration > 0 && currentTime >= duration - 5)) && !hasRated && !dismissedReview;

  // Détection du déclenchement Inscription (à partir de 25s si non inscrit)
  const isEligibleForRegister = currentTime >= 25 && !isUserRegistered && !dismissedRegister;

  const handleCreateBookmark = (e) => {
    e.preventDefault();
    addBookmark(newBookmarkNote);
    setNewBookmarkNote('');
    setIsAddingBookmark(false);
  };

  const handleShare = async () => {
    const res = await shareAudioWithCover(currentBook);
    if (res.method === 'clipboard') {
      setShareToast('✓ Lien copié dans le presse-papiers !');
      setTimeout(() => setShareToast(''), 2500);
    }
  };

  const handleSubmitReview = (e) => {
    e.preventDefault();
    try {
      localStorage.setItem(`rg_rated_${currentBook.id}`, String(reviewRating));
      setHasRated(true);
      setReviewSubmitted(true);
      setTimeout(() => {
        setDismissedReview(true);
      }, 2000);
    } catch (_) {}
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0a0714] text-slate-100 flex flex-col justify-between animate-fadeIn">
      {/* Fond flouté avec halo de jaquette */}
      <div 
        className="absolute inset-0 opacity-25 bg-cover bg-center filter blur-3xl scale-125 -z-10 pointer-events-none"
        style={{ backgroundImage: `url(${currentBook.cover_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80'})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0714]/85 via-[#0f0c1b]/95 to-[#080511] -z-10" />

      {/* Header du lecteur */}
      <header className="px-4 sm:px-6 py-4 flex items-center justify-between z-10 border-b border-white/5 backdrop-blur-md">
        <button
          onClick={() => setIsFullScreenOpen(false)}
          className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          title="Fermer le lecteur plein écran"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        <div className="text-center min-w-0 px-2">
          <p className="text-[11px] uppercase tracking-widest font-extrabold text-purple-300">
            {isPreviewMode ? 'Extrait Démo Gratuit' : 'En Lecture'}
          </p>
          <p className="text-xs sm:text-sm font-bold text-white max-w-[200px] sm:max-w-md truncate">
            {currentBook.title}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors relative"
            title="Partager avec la pochette"
          >
            <Share2 className="w-5 h-5" />
            {shareToast && (
              <span className="absolute right-0 top-12 whitespace-nowrap px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-xl animate-fadeIn">
                {shareToast}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── 1. ONGLETS DE NAVIGATION AGRANDIS ET BIEN PRÉSENTABLES ── */}
      <div className="flex justify-center px-4 pt-3 z-10 w-full">
        <div className="flex items-center justify-center p-1.5 rounded-2xl bg-slate-900/90 border border-white/15 backdrop-blur-2xl shadow-xl gap-2 max-w-lg w-full">
          <button
            onClick={() => setActiveTab('player')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-200 flex items-center justify-center gap-1.5 ${
              activeTab === 'player'
                ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-lg shadow-purple-500/40 ring-1 ring-white/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Headphones className="w-4 h-4 flex-shrink-0" />
            <span>Lecteur</span>
          </button>

          <button
            onClick={() => setActiveTab('chapters')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-200 flex items-center justify-center gap-1.5 ${
              activeTab === 'chapters'
                ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-lg shadow-purple-500/40 ring-1 ring-white/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <ListMusic className="w-4 h-4 flex-shrink-0" />
            <span>Chapitres ({currentBook.chapters?.length || 1})</span>
          </button>

          <button
            onClick={() => setActiveTab('bookmarks')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-200 flex items-center justify-center gap-1.5 ${
              activeTab === 'bookmarks'
                ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-lg shadow-purple-500/40 ring-1 ring-white/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Bookmark className="w-4 h-4 flex-shrink-0" />
            <span>Signets</span>
          </button>
        </div>
      </div>

      {/* Contenu Principal selon l'onglet actif */}
      <main className="flex-1 flex flex-col justify-center max-w-xl mx-auto w-full px-4 sm:px-6 py-4 z-10">
        {activeTab === 'player' && (
          <div className="flex flex-col items-center">

            {/* ── 2. PROMPT AVIS À 20 SECONDES ── */}
            {isEligibleForReview && (
              <div className="w-full mb-4 p-3.5 rounded-2xl glass-card border border-amber-500/40 bg-amber-950/30 shadow-xl animate-slideDown relative">
                <button
                  onClick={() => setDismissedReview(true)}
                  className="absolute top-2.5 right-2.5 text-slate-400 hover:text-white p-1"
                >
                  <X size={14} />
                </button>

                {reviewSubmitted ? (
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold py-1">
                    <CheckCircle2 size={16} />
                    <span>Merci pour votre avis ! Votre note a été enregistrée.</span>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitReview} className="space-y-2">
                    <div className="flex items-center justify-between pr-6">
                      <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <Star size={14} className="fill-amber-400 text-amber-400" />
                        Donnez votre avis sur cet audio
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setReviewRating(star)}
                            className="p-1 text-amber-400 hover:scale-125 transition-transform"
                          >
                            <Star
                              size={18}
                              className={star <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}
                            />
                          </button>
                        ))}
                      </div>

                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-xs font-extrabold shadow-md active:scale-95 transition-all"
                      >
                        Noter ({reviewRating}/5)
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* ── 3. PROMPT INSCRIPTION À 25 SECONDES ── */}
            {isEligibleForRegister && (
              <div className="w-full mb-4 p-3.5 rounded-2xl glass-card border border-purple-500/40 bg-gradient-to-r from-purple-950/40 to-pink-950/40 shadow-2xl animate-slideDown flex items-center justify-between gap-3 relative">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 flex-shrink-0 animate-pulse">
                    <Sparkles size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white leading-tight truncate">
                      Créez votre profil en 1 clic
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Sauvegardez vos playlists & signets
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => setIsProfileModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-black shadow-md shadow-purple-600/30 whitespace-nowrap active:scale-95 transition-all flex items-center gap-1"
                  >
                    <span>Inscris-toi maintenant !</span>
                    <ChevronRight size={13} />
                  </button>
                  <button
                    onClick={() => setDismissedRegister(true)}
                    className="text-slate-500 hover:text-slate-300 p-1"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Jaquette avec halo lumineux et effet de lévitation */}
            <div className="relative my-2 sm:my-3 group">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-pink-500 filter blur-2xl opacity-40 cover-halo -z-10"></div>
              <img
                src={currentBook.cover_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80'}
                alt={currentBook.title}
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80'; }}
                className="w-48 h-48 sm:w-60 sm:h-60 object-cover rounded-3xl shadow-2xl border border-white/20 transform transition-transform duration-500 group-hover:scale-102"
              />
            </div>

            {/* Visualiseur d'ondes sonores dynamique (Waveform Equalizer) */}
            <div className="flex items-center justify-center gap-1.5 my-2 h-7">
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
                  <span>En pause</span>
                  <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                  <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                </div>
              )}
            </div>

            {/* Titre du livre et métadonnées */}
            <div className="w-full text-center mb-3">
              <h1 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight leading-snug mb-1 line-clamp-1">
                {currentBook.title}
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-purple-300 mb-0.5 truncate">
                {currentChapter?.title || `Chapitre ${currentChapterIndex + 1}`}
              </p>
              <p className="text-xs text-slate-400">
                {currentBook.content_type === 'podcast' ? 'Hôte : ' : currentBook.content_type === 'music' ? 'Artiste : ' : 'Par '}
                <span className="text-slate-200">{currentBook.author}</span> • Voix : <span className="text-slate-200">{currentBook.narrator || 'RG Studio'}</span>
              </p>
            </div>

            {/* Barre de défilement temporelle (Seekbar) */}
            <div className="w-full space-y-1.5 mb-3">
              <div className="relative flex items-center">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={(e) => seekTo(parseFloat(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>
              <div className="flex justify-between text-xs font-mono text-slate-400 font-semibold px-0.5">
                <span>{formatTime(currentTime)}</span>
                <span>-{formatTime(remainingTime)}</span>
              </div>
            </div>

            {/* Rangée des outils secondaires : Vitesse, Sommeil, Signet, Partager */}
            <div className="flex items-center justify-between w-full px-2 sm:px-4 mb-4 text-xs font-semibold">
              <button
                onClick={() => setIsSpeedModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors"
              >
                <Gauge className="w-3.5 h-3.5 text-purple-400" />
                <span>{playbackRate}x</span>
              </button>

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

              <button
                onClick={() => addBookmark(`Signet à ${formatTime(currentTime)}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors"
              >
                <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                <span>Signet</span>
              </button>

              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors"
                title="Partager avec la jaquette"
              >
                <Share2 className="w-3.5 h-3.5 text-purple-400" />
                <span>Partager</span>
              </button>
            </div>

            {/* Contrôles Principaux de Lecture */}
            <div className="flex items-center justify-center gap-4 sm:gap-6 w-full mb-6">
              <button
                onClick={handlePrevChapter}
                title="Chapitre précédent"
                className="p-3 text-slate-300 hover:text-white hover:bg-white/5 rounded-full transition-colors"
              >
                <SkipBack className="w-6 h-6" />
              </button>

              <button
                onClick={() => skipBackward(15)}
                title="Reculer de 15 secondes"
                className="p-3 text-slate-300 hover:text-white hover:bg-white/5 rounded-full transition-colors relative flex flex-col items-center"
              >
                <RotateCcw className="w-6 h-6" />
                <span className="text-[9px] font-bold mt-0.5">15s</span>
              </button>

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

              <button
                onClick={() => skipForward(30)}
                title="Avancer de 30 secondes"
                className="p-3 text-slate-300 hover:text-white hover:bg-white/5 rounded-full transition-colors relative flex flex-col items-center"
              >
                <RotateCw className="w-6 h-6" />
                <span className="text-[9px] font-bold mt-0.5">30s</span>
              </button>

              <button
                onClick={handleNextChapter}
                title="Chapitre suivant"
                className="p-3 text-slate-300 hover:text-white hover:bg-white/5 rounded-full transition-colors"
              >
                <SkipForward className="w-6 h-6" />
              </button>
            </div>

            {/* ── 4. RECOMMANDATIONS D'AUTRES AUDIOS EN DESSOUS DU LECTEUR ── */}
            {recommendations.length > 0 && (
              <div className="w-full pt-4 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={14} className="text-purple-400" />
                    Recommandé pour vous
                  </h3>
                  <span className="text-[11px] text-purple-400 font-bold">Écoute en 1 clic</span>
                </div>

                <div className="space-y-2">
                  {recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      onClick={() => {
                        if (rec.price === 0 || rec.is_free_for_members) {
                          playBook(rec, 0, 0);
                        } else {
                          playPreview(rec);
                        }
                      }}
                      className="p-2.5 rounded-2xl bg-white/5 hover:bg-purple-600/20 border border-white/5 hover:border-purple-500/30 flex items-center justify-between cursor-pointer group transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={rec.cover_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80'}
                          alt={rec.title}
                          className="w-11 h-11 rounded-xl object-cover border border-white/10 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate group-hover:text-purple-300">
                            {rec.title}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {rec.author}
                          </p>
                        </div>
                      </div>

                      <button className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 flex-shrink-0 transition-transform">
                        <Play size={14} className="fill-white ml-0.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onProfileSaved={(profile) => {
          setIsUserRegistered(true);
          setDismissedRegister(true);
        }}
      />
    </div>
  );
};
