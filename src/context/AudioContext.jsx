import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { apiClient } from '../services/api';
import { cacheAudioForOffline, getOfflineAudioUrl, getOfflineBooks, isAudioOffline } from '../utils/offlineAudioCache';

const AudioContext = createContext();

export const AudioProvider = ({ children }) => {
  // État du livre et chapitre actif
  const [currentBook, setCurrentBook] = useState(null);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [offlineBooks, setOfflineBooks] = useState(() => getOfflineBooks());

  // État du lecteur plein écran
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);

  // Minuteur de mise en veille (Sleep Timer)
  const [sleepTimerOption, setSleepTimerOption] = useState(null); // '15', '30', '45', '60', 'end_chapter'
  const [sleepTimerSecondsLeft, setSleepTimerSecondsLeft] = useState(null);

  // Signets
  const [bookmarks, setBookmarks] = useState(() => {
    return JSON.parse(localStorage.getItem('rg_bookmarks') || '[]');
  });

  // Référence Audio HTML5
  const audioRef = useRef(new Audio());
  const progressSaveTimerRef = useRef(null);
  const handleNextChapterRef = useRef(null);
  const currentBookRef = useRef(null);
  const currentChapterIndexRef = useRef(0);

  useEffect(() => { currentBookRef.current = currentBook; }, [currentBook]);
  useEffect(() => { currentChapterIndexRef.current = currentChapterIndex; }, [currentChapterIndex]);

  // Écouter les mises à jour du cache hors ligne
  useEffect(() => {
    const onCacheUpdate = () => setOfflineBooks(getOfflineBooks());
    window.addEventListener('rg_offline_cache_updated', onCacheUpdate);
    return () => window.removeEventListener('rg_offline_cache_updated', onCacheUpdate);
  }, []);

  // Stopper le lecteur si le livre en cours d'écoute est supprimé (Admin ou sync)
  useEffect(() => {
    const onBookDeleted = (e) => {
      const deletedId = e.detail?.id;
      if (!deletedId) return;
      if (currentBookRef.current?.id === deletedId) {
        audioRef.current.pause();
        audioRef.current.src = '';
        setIsPlaying(false);
        setCurrentBook(null);
        setCurrentChapterIndex(0);
        setCurrentTime(0);
        setDuration(0);
        setIsFullScreenOpen(false);
        console.log(`[AudioContext] Lecture stoppée: livre supprimé (${deletedId})`);
      }
    };
    window.addEventListener('rg:book-deleted', onBookDeleted);
    return () => window.removeEventListener('rg:book-deleted', onBookDeleted);
  }, []); // Montage uniquement — on lit via ref

  // Ref pour sleepTimerOption (évite closure stale sans recréer les listeners)
  const sleepTimerOptionRef = useRef(sleepTimerOption);
  useEffect(() => { sleepTimerOptionRef.current = sleepTimerOption; }, [sleepTimerOption]);

  // Synchronisation initiale de l'élément audio (montage uniquement)
  useEffect(() => {
    const audio = audioRef.current;
    audio.preload = 'auto';

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setIsLoading(false);
    };

    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => {
      setIsLoading(false);
      setIsPlaying(true);
    };
    const onPause = () => setIsPlaying(false);
    const onError = async (e) => {
      console.warn('Erreur audio réseau, tentative de fallback hors-ligne :', audio.src);
      // Tentative de récupération depuis le cache hors-ligne si erreur réseau
      if (audio.src && !audio.src.startsWith('blob:')) {
        const offlineUrl = await getOfflineAudioUrl(audio.src);
        if (offlineUrl && offlineUrl !== audio.src) {
          audio.src = offlineUrl;
          audio.play().catch(() => {});
          return;
        }
      }
      setIsLoading(false);
    };

    const onEnded = () => {
      // ── Auto-téléchargement et mise en cache hors-connexion dès que l'audio est terminé
      if (currentBookRef.current) {
        const book = currentBookRef.current;
        const chap = book.chapters?.[currentChapterIndexRef.current];
        cacheAudioForOffline(book, chap);
      }

      if (sleepTimerOptionRef.current === 'end_chapter') {
        setIsPlaying(false);
        setSleepTimerOption(null);
        setSleepTimerSecondsLeft(null);
        return;
      }
      handleNextChapterRef.current?.();
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, []); // Montage uniquement

  // Gestion du compte à rebours du Sleep Timer
  useEffect(() => {
    if (sleepTimerSecondsLeft === null || sleepTimerSecondsLeft <= 0) return;

    const interval = setInterval(() => {
      setSleepTimerSecondsLeft(prev => {
        if (prev <= 1) {
          audioRef.current.pause();
          setIsPlaying(false);
          setSleepTimerOption(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerSecondsLeft]);

  // Sauvegarde automatique de la progression toutes les 5 secondes
  useEffect(() => {
    if (!currentBook || !isPlaying) return;

    if (progressSaveTimerRef.current) clearInterval(progressSaveTimerRef.current);

    progressSaveTimerRef.current = setInterval(() => {
      const chapter = currentBook.chapters?.[currentChapterIndex];
      const percent = duration > 0 ? Math.round((currentTime / duration) * 100) : 0;

      // Si l'écoute dépasse 90%, pré-mettre en cache pour le mode hors-ligne
      if (percent >= 90 && currentBook) {
        cacheAudioForOffline(currentBook, chapter);
      }

      apiClient.saveProgress({
        audiobook_id: currentBook.id,
        chapter_id: chapter?.id,
        position_seconds: currentTime,
        completed_percentage: percent,
        is_completed: percent >= 95,
      });
    }, 5000);

    return () => clearInterval(progressSaveTimerRef.current);
  }, [currentBook, currentChapterIndex, currentTime, duration, isPlaying]);

  // Lancer la lecture d'un livre complet (démarrage immédiat 0ms)
  const playBook = (book, chapterIdx = 0, startTime = 0) => {
    setCurrentBook(book);
    setCurrentChapterIndex(chapterIdx);
    setIsPreviewMode(false);
    setIsLoading(true);

    const chapter = book.chapters?.[chapterIdx];
    const rawAudioSrc = chapter?.audio_url || book.preview_url || 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';

    // Démarrer la lecture immédiatement
    audioRef.current.src = rawAudioSrc;
    audioRef.current.playbackRate = playbackRate;
    audioRef.current.currentTime = startTime || 0;
    audioRef.current.play().catch(e => console.warn('Lecture restreinte:', e));
    setIsPlaying(true);

    // Vérifier en arrière-plan si une version hors-ligne plus rapide existe
    getOfflineAudioUrl(rawAudioSrc).then(cachedSrc => {
      if (cachedSrc && cachedSrc !== rawAudioSrc && audioRef.current && audioRef.current.src === rawAudioSrc) {
        const curTime = audioRef.current.currentTime;
        audioRef.current.src = cachedSrc;
        audioRef.current.currentTime = curTime;
        audioRef.current.play().catch(() => {});
      }
    }).catch(() => {});
  };

  // Télécharger explicitement un livre pour lecture hors-ligne
  const downloadForOffline = async (book) => {
    return await cacheAudioForOffline(book);
  };

  // Lancer la lecture d'un extrait gratuit (démarrage immédiat)
  const playPreview = (book) => {
    setCurrentBook(book);
    setCurrentChapterIndex(0);
    setIsPreviewMode(true);
    setIsLoading(true);

    const rawAudioSrc = book.preview_url || 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';

    audioRef.current.src = rawAudioSrc;
    audioRef.current.playbackRate = playbackRate;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(e => console.warn('Lecture restreinte:', e));
    setIsPlaying(true);

    getOfflineAudioUrl(rawAudioSrc).then(cachedSrc => {
      if (cachedSrc && cachedSrc !== rawAudioSrc && audioRef.current && audioRef.current.src === rawAudioSrc) {
        audioRef.current.src = cachedSrc;
        audioRef.current.play().catch(() => {});
      }
    }).catch(() => {});
  };

  // Basculer Play / Pause
  const togglePlay = () => {
    if (!currentBook) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(e => console.warn(e));
      setIsPlaying(true);
    }
  };

  // Naviguer dans le temps
  const seekTo = (seconds) => {
    audioRef.current.currentTime = seconds;
    setCurrentTime(seconds);
  };

  const skipForward = (seconds = 30) => {
    const target = Math.min(audioRef.current.currentTime + seconds, duration || Infinity);
    seekTo(target);
  };

  const skipBackward = (seconds = 15) => {
    const target = Math.max(audioRef.current.currentTime - seconds, 0);
    seekTo(target);
  };

  // Gestion de la vitesse de lecture
  const changePlaybackRate = (rate) => {
    setPlaybackRate(rate);
    audioRef.current.playbackRate = rate;
  };

  // Gestion des chapitres
  const handleNextChapter = () => {
    if (!currentBook?.chapters) return;
    if (currentChapterIndex < currentBook.chapters.length - 1) {
      playBook(currentBook, currentChapterIndex + 1, 0);
    } else {
      setIsPlaying(false);
    }
  };
  // Maintenir la ref à jour pour le listener 'ended' (évite closure stale)
  handleNextChapterRef.current = handleNextChapter;

  const handlePrevChapter = () => {
    if (!currentBook?.chapters) return;
    if (currentTime > 5) {
      // Recommencer le chapitre en cours si déjà avancé
      seekTo(0);
    } else if (currentChapterIndex > 0) {
      playBook(currentBook, currentChapterIndex - 1, 0);
    }
  };

  const selectChapter = (index) => {
    if (!currentBook) return;
    playBook(currentBook, index, 0);
  };

  // Programmation du Minuteur de sommeil
  const setSleepTimer = (option) => {
    setSleepTimerOption(option);
    if (option === 'end_chapter') {
      setSleepTimerSecondsLeft(null);
    } else if (option) {
      const minutes = parseInt(option, 10);
      setSleepTimerSecondsLeft(minutes * 60);
    } else {
      setSleepTimerSecondsLeft(null);
    }
  };

  // Ajout de signet
  const addBookmark = (note = '') => {
    if (!currentBook) return;
    const chapter = currentBook.chapters?.[currentChapterIndex];
    const newBookmark = {
      id: `bm-${Date.now()}`,
      audiobook_id: currentBook.id,
      book_title: currentBook.title,
      chapter_title: chapter?.title || `Chapitre ${currentChapterIndex + 1}`,
      timestamp_seconds: currentTime,
      note: note || `Signet à ${formatTime(currentTime)}`,
      created_at: new Date().toISOString(),
    };

    const updated = [newBookmark, ...bookmarks];
    setBookmarks(updated);
    localStorage.setItem('rg_bookmarks', JSON.stringify(updated));
    return newBookmark;
  };

  const removeBookmark = (id) => {
    const updated = bookmarks.filter(b => b.id !== id);
    setBookmarks(updated);
    localStorage.setItem('rg_bookmarks', JSON.stringify(updated));
  };

  // Formatage secondes -> mm:ss ou hh:mm:ss
  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const currentChapter = currentBook?.chapters?.[currentChapterIndex] || {
    title: isPreviewMode ? 'Extrait audio gratuit' : 'Chapitre 1',
    duration_seconds: duration,
  };

  return (
    <AudioContext.Provider
      value={{
        currentBook,
        currentChapterIndex,
        currentChapter,
        isPlaying,
        isLoading,
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
        offlineBooks,
        downloadForOffline,
        isAudioOffline,
        playBook,
        playPreview,
        togglePlay,
        seekTo,
        skipForward,
        skipBackward,
        changePlaybackRate,
        handleNextChapter,
        handlePrevChapter,
        selectChapter,
        setSleepTimer,
        addBookmark,
        removeBookmark,
        formatTime,
        setIsFullScreenOpen,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => useContext(AudioContext);
