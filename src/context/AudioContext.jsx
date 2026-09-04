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
    try { return JSON.parse(localStorage.getItem('rg_bookmarks') || '[]'); } catch { return []; }
  });

  // Référence Audio HTML5
  const audioRef = useRef(new Audio());
  const progressSaveTimerRef = useRef(null);
  const handleNextChapterRef = useRef(null);
  const currentBookRef = useRef(null);
  const currentChapterIndexRef = useRef(0);
  const hasCachedChaptersRef = useRef(new Set());

  useEffect(() => { currentBookRef.current = currentBook; }, [currentBook]);
  useEffect(() => { currentChapterIndexRef.current = currentChapterIndex; }, [currentChapterIndex]);

  // Écouter les mises à jour du cache hors ligne
  useEffect(() => {
    const onCacheUpdate = () => setOfflineBooks(getOfflineBooks());
    window.addEventListener('rg_offline_cache_updated', onCacheUpdate);
    return () => window.removeEventListener('rg_offline_cache_updated', onCacheUpdate);
  }, []);

  // Charger les signets depuis D1
  useEffect(() => {
    apiClient.getBookmarks().then(bms => {
      if (Array.isArray(bms) && bms.length > 0) {
        setBookmarks(bms);
      }
    });
  }, []);

  // Déclencher la lecture audio globale depuis le Chat SKY
  useEffect(() => {
    const handleTriggerPlay = (e) => {
      if (e.detail?.book) {
        playBook(e.detail.book, e.detail.chapterIndex || 0);
      }
    };
    window.addEventListener('rg:trigger-play-book', handleTriggerPlay);
    return () => window.removeEventListener('rg:trigger-play-book', handleTriggerPlay);
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

  // Synchronisation de l'élément audio (montage uniquement)
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

    const onCanPlay = () => {
      setIsLoading(false);
    };

    const onLoadedData = () => {
      setIsLoading(false);
    };

    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => {
      setIsLoading(false);
      setIsPlaying(true);
    };
    const onPause = () => setIsPlaying(false);
    const onError = async () => {
      console.warn('Erreur audio réseau, tentative de fallback hors-ligne :', audio.src);
      const currentBook = currentBookRef.current;
      const currentChapIdx = currentChapterIndexRef.current;
      if (audio.src && !audio.src.startsWith('blob:')) {
        const offlineUrl = await getOfflineAudioUrl(audio.src, currentBook?.id, currentChapIdx);
        if (offlineUrl && offlineUrl !== audio.src) {
          audio.src = offlineUrl;
          audio.play().catch(() => {});
          return;
        }
      }
      setIsLoading(false);
    };

    const onEnded = () => {
      // 🛡️ Garde-fou Anti-Coupure : Si la durée réelle est connue et qu'on est loin de la fin (coupure réseau / buffer vide)
      if (audio.duration && isFinite(audio.duration) && audio.duration > 10 && audio.currentTime < (audio.duration - 3)) {
        console.warn(`[AudioContext] Événement 'ended' prématuré détecté à ${audio.currentTime.toFixed(1)}s / ${audio.duration.toFixed(1)}s (interruption de flux). Tentative de reprise...`);
        audio.play().catch(() => {});
        return;
      }

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
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('loadeddata', onLoadedData);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('loadeddata', onLoadedData);
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

      // Si l'écoute dépasse 90%, pré-mettre en cache une seule fois pour le mode hors-ligne
      const cacheKey = `${currentBook.id}_ch_${currentChapterIndex}`;
      if (percent >= 90 && currentBook && !hasCachedChaptersRef.current.has(cacheKey)) {
        hasCachedChaptersRef.current.add(cacheKey);
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

  // Lancer la lecture d'un livre complet (démarrage ultra-rapide 0ms)
  // Lancer la lecture d'un livre complet (démarrage ultra-rapide 0ms & support 100% hors-ligne)
  const playBook = async (book, chapterIdx = 0, startTime = 0) => {
    setCurrentBook(book);
    setCurrentChapterIndex(chapterIdx);
    setIsPreviewMode(false);
    setIsLoading(true);

    const chapter = book.chapters?.[chapterIdx];
    const rawAudioSrc = chapter?.audio_url || book.preview_url || 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';

    // Résoudre l'URL locale si stockée dans le cache hors-ligne (IndexedDB ou Cache API)
    let finalAudioSrc = rawAudioSrc;
    try {
      const offlineSrc = await getOfflineAudioUrl(rawAudioSrc, book.id, chapterIdx);
      if (offlineSrc) finalAudioSrc = offlineSrc;
    } catch (_) {}

    const audio = audioRef.current;
    audio.preload = 'auto';

    // Ne recharger le src que si la piste a changé
    const currentSrcNormalized = audio.src.replace(window.location.origin, '');
    const targetSrcNormalized = finalAudioSrc.replace(window.location.origin, '');
    const isSameSource = audio.src === finalAudioSrc || currentSrcNormalized === targetSrcNormalized;

    if (!isSameSource) {
      audio.src = finalAudioSrc;
      audio.playbackRate = playbackRate;
      if (startTime > 0) {
        const onMetadata = () => {
          audio.currentTime = startTime;
          audio.removeEventListener('loadedmetadata', onMetadata);
        };
        audio.addEventListener('loadedmetadata', onMetadata);
      }
      audio.load();
    } else if (startTime > 0 && Math.abs(audio.currentTime - startTime) > 1) {
      audio.currentTime = startTime;
    }

    audio.play().then(() => {
      setIsPlaying(true);
      setIsLoading(false);
    }).catch(e => {
      console.warn('Lecture audio (tentative offline):', e);
      setIsLoading(false);
    });

    setIsPlaying(true);

    // Précharger discrètement le chapitre suivant en tâche de fond pour une transition instantanée
    if (book.chapters && book.chapters[chapterIdx + 1]?.audio_url) {
      const nextUrl = book.chapters[chapterIdx + 1].audio_url;
      const prefetchLink = document.createElement('link');
      prefetchLink.rel = 'prefetch';
      prefetchLink.href = nextUrl;
      prefetchLink.as = 'fetch';
      document.head.appendChild(prefetchLink);
    }
  };

  // Télécharger explicitement un livre pour lecture hors-ligne
  const downloadForOffline = async (book, onProgress = null) => {
    return await cacheAudioForOffline(book, null);
  };

  // Lancer la lecture d'un extrait gratuit (démarrage ultra-rapide)
  // Si un audio n'a pas d'extrait dédié, ce sont les chapitres 1 et 2 qui lisent par défaut !
  const playPreview = async (book) => {
    if (!book) return;

    const hasExplicitPreview = Boolean(book.preview_url && book.preview_url.trim() && !book.preview_url.includes('pixabay'));

    if (!hasExplicitPreview && book.chapters && book.chapters.length > 0) {
      // Chapitre 1 par défaut, enchaîné sur le chapitre 2
      setIsPreviewMode(true);
      playBook(book, 0, 0);
      return;
    }

    setCurrentBook(book);
    setCurrentChapterIndex(0);
    setIsPreviewMode(true);
    setIsLoading(true);

    const rawAudioSrc = book.preview_url || book.chapters?.[0]?.audio_url || 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';

    let finalAudioSrc = rawAudioSrc;
    try {
      const offlineSrc = await getOfflineAudioUrl(rawAudioSrc, book.id, 'preview');
      if (offlineSrc) finalAudioSrc = offlineSrc;
    } catch (_) {}

    const audio = audioRef.current;
    audio.preload = 'auto';

    const currentSrcNormalized = audio.src.replace(window.location.origin, '');
    const targetSrcNormalized = finalAudioSrc.replace(window.location.origin, '');
    const isSameSource = audio.src === finalAudioSrc || currentSrcNormalized === targetSrcNormalized;

    if (!isSameSource) {
      audio.src = finalAudioSrc;
      audio.playbackRate = playbackRate;
      audio.load();
    }

    audio.play().then(() => {
      setIsPlaying(true);
      setIsLoading(false);
    }).catch(e => {
      console.warn('Lecture restreinte par le navigateur:', e);
      setIsLoading(false);
    });

    setIsPlaying(true);
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

  // Arrêt complet : pause + remise à zéro + fermeture du lecteur
  const stopAudio = () => {
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current.src = '';
    setIsPlaying(false);
    setCurrentBook(null);
    setCurrentChapterIndex(0);
    setCurrentTime(0);
    setDuration(0);
    setIsPreviewMode(false);
    setIsFullScreenOpen(false);
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

    if (isPreviewMode) {
      // En mode extrait gratuit : chapitre 1 enchaîne sur le chapitre 2
      if (currentChapterIndex === 0 && currentBook.chapters.length > 1) {
        playBook(currentBook, 1, 0);
        return;
      } else {
        // Fin de l'extrait gratuit (chapitre 2 terminé)
        setIsPlaying(false);
        setIsPreviewMode(false);
        window.dispatchEvent(new CustomEvent('rg:preview-ended', { detail: { book: currentBook } }));
        return;
      }
    }

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

  // Ajout de signet (D1 + Local)
  const addBookmark = async (note = '') => {
    if (!currentBook) return;
    const chapter = currentBook.chapters?.[currentChapterIndex];
    const newBookmark = {
      id: `bm-${Date.now()}`,
      audiobook_id: currentBook.id,
      book_title: currentBook.title,
      chapter_id: chapter?.id || null,
      chapter_number: (currentChapterIndex || 0) + 1,
      chapter_title: chapter?.title || `Chapitre ${currentChapterIndex + 1}`,
      timestamp_seconds: currentTime,
      note: note || `Signet à ${formatTime(currentTime)}`,
      created_at: new Date().toISOString(),
    };

    const updated = [newBookmark, ...bookmarks];
    setBookmarks(updated);
    localStorage.setItem('rg_bookmarks', JSON.stringify(updated));

    // Persistance D1
    await apiClient.addBookmark(newBookmark);
    return newBookmark;
  };

  const removeBookmark = async (id) => {
    const updated = bookmarks.filter(b => b.id !== id);
    setBookmarks(updated);
    localStorage.setItem('rg_bookmarks', JSON.stringify(updated));

    // Suppression D1
    await apiClient.removeBookmark(id);
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
        stopAudio,
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
