import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { apiClient } from '../services/api';
import { cacheAudioForOffline, getOfflineAudioUrl, getOfflineBooks, isAudioOffline } from '../utils/offlineAudioCache';
import { trackAudioPlay } from '../services/tracker';

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
  // Compteur de tentatives de reprise (évite la boucle infinie du garde-fou)
  const endedRetryCountRef = useRef(0);
  // Position sauvegardée avant un 'ended' prématuré pour la reprise exacte
  const stallSavedTimeRef = useRef(0);
  // Timer anti-stall : si l'audio est en lecture mais ne progresse pas pendant X secondes
  const stallWatchdogRef = useRef(null);
  const lastTimeUpdateRef = useRef(0);

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
    // 'auto' permet au décodeur natif d'engranger immédiatement les premiers paquets
    // sans attendre le clic utilisateur, réduisant le délai de démarrage à 0 ms (essentiel 2G/3G)
    audio.preload = 'auto';
    audio.playsInline = true;
    // Note : Ne pas forcer crossOrigin = 'anonymous' qui provoque des négociations pré-vol CORS
    // bloquantes sur mobile et connexions lentes africaines.

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      lastTimeUpdateRef.current = Date.now();
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
    const onStalled = () => {
      // 🛡️ L'événement 'stalled' indique que le navigateur a temporairement mis en pause
      // le téléchargement réseau car son buffer initial est déjà rempli (typiquement 15 à 25s).
      // Ne JAMAIS réaffecter audio.src ici, ce qui détruirait le buffer décodé !
      if (audio.paused && isPlaying) {
        audio.play().catch(() => {});
      }
    };
    const onPlaying = () => {
      setIsLoading(false);
      setIsPlaying(true);
    };
    const onPause = () => {
      setIsPlaying(false);
      if (currentBookRef.current) {
        trackAudioPlay(
          currentBookRef.current,
          currentBookRef.current?.chapters?.[currentChapterIndexRef.current],
          audio.currentTime
        );
      }
    };
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
      const book = currentBookRef.current;
      const chap = book?.chapters?.[currentChapterIndexRef.current];
      const declaredDuration = Number(chap?.duration_seconds || 0);
      const audioDuration = (audio.duration && isFinite(audio.duration) && audio.duration > 0)
        ? audio.duration
        : 0;

      // Durée de référence prioritaire : si le chapitre déclare une durée > 10s, elle prime
      const totalDuration = declaredDuration > 10 ? declaredDuration : audioDuration;

      // 🛡️ Garde-fou Anti-Coupure Ultime :
      // Si l'événement 'ended' survient alors qu'on est loin de la fin réelle du fichier
      // (ex: interruption socket réseau à 15s/25s sur un chapitre de 3 minutes),
      // il s'agit d'une interruption réseau prématurée et EN AUCUN CAS de la fin du chapitre.
      if (totalDuration > 15 && audio.currentTime < (totalDuration - 5)) {
        console.warn(`[AudioContext] 'ended' prématuré intercepté à ${audio.currentTime.toFixed(1)}s / ${totalDuration}s. Refus absolu de sauter au chapitre suivant.`);

        if (endedRetryCountRef.current < 3) {
          endedRetryCountRef.current += 1;
          setIsLoading(true);
          setTimeout(() => {
            audio.play().then(() => {
              setIsLoading(false);
              setIsPlaying(true);
            }).catch(() => {
              setIsLoading(false);
            });
          }, 600);
          return;
        }

        // Si le réseau est totalement indisponible après 3 reprises, pause propre à la position actuelle
        console.warn(`[AudioContext] Réseau indisponible à ${audio.currentTime.toFixed(1)}s. Mise en pause sécurisée sans saut de chapitre.`);
        setIsPlaying(false);
        setIsLoading(false);
        endedRetryCountRef.current = 0;
        return;
      }

      // La piste est VRAIMENT terminée
      endedRetryCountRef.current = 0;

      if (book) {
        trackAudioPlay(book, chap, totalDuration || audio.currentTime);
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
    audio.addEventListener('stalled', onStalled);
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
      audio.removeEventListener('stalled', onStalled);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      clearTimeout(stallWatchdogRef.current);
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
      const audio = audioRef.current;
      const curPos = audio.currentTime || 0;
      const curDur = (audio.duration && isFinite(audio.duration)) ? audio.duration : duration;
      const chapter = currentBook.chapters?.[currentChapterIndex];
      const percent = curDur > 0 ? Math.round((curPos / curDur) * 100) : 0;

      // Si l'écoute dépasse 90%, pré-mettre en cache une seule fois pour le mode hors-ligne
      const cacheKey = `${currentBook.id}_ch_${currentChapterIndex}`;
      if (percent >= 90 && currentBook && !hasCachedChaptersRef.current.has(cacheKey)) {
        hasCachedChaptersRef.current.add(cacheKey);
        cacheAudioForOffline(currentBook, chapter);
      }

      apiClient.saveProgress({
        audiobook_id: currentBook.id,
        chapter_id: chapter?.id,
        position_seconds: curPos,
        completed_percentage: percent,
        is_completed: percent >= 95,
      });
    }, 5000);

    return () => clearInterval(progressSaveTimerRef.current);
  }, [currentBook?.id, currentChapterIndex, isPlaying]);

  // Lancer la lecture d'un livre complet (démarrage ultra-rapide 0ms & support 100% hors-ligne)
  const playBook = (book, chapterIdx = 0, startTime = 0) => {
    if (!book) return;
    endedRetryCountRef.current = 0;
    setCurrentBook(book);
    setCurrentChapterIndex(chapterIdx);
    setIsPreviewMode(false);
    setIsLoading(true);
    setIsPlaying(true); // Feedback visuel instantané (0 ms)

    const chapter = book.chapters?.[chapterIdx];
    const rawAudioSrc = chapter?.audio_url || book.preview_url || 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';

    // Enregistrer immédiatement l'écoute pour les statistiques temps réel
    trackAudioPlay(book, chapter, startTime || 0);

    const audio = audioRef.current;
    audio.preload = 'auto';

    // Fonction interne pour affecter la source et lancer la lecture immédiatement
    const startPlayback = (targetUrl) => {
      const currentSrcNormalized = audio.src.replace(window.location.origin, '');
      const targetSrcNormalized = targetUrl.replace(window.location.origin, '');
      const isSameSource = audio.src === targetUrl || currentSrcNormalized === targetSrcNormalized;

      if (!isSameSource) {
        audio.src = targetUrl;
        audio.playbackRate = playbackRate;
        if (startTime > 0) {
          const onMetadata = () => {
            audio.currentTime = startTime;
            audio.removeEventListener('loadedmetadata', onMetadata);
          };
          audio.addEventListener('loadedmetadata', onMetadata);
        }
        // ⚠️ Ne JAMAIS appeler audio.load() ici : affecter audio.src déclenche déjà le fetch.
        // audio.load() annule brutalement la requête en vol et double le temps d'attente !
      } else if (startTime > 0 && Math.abs(audio.currentTime - startTime) > 1) {
        audio.currentTime = startTime;
      }

      // Déclenchement synchrone impératif dans le User Gesture pour mobile (iOS & Android)
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsPlaying(true);
          setIsLoading(false);
        }).catch(e => {
          console.warn('Lecture audio (tentative offline):', e);
          setIsLoading(false);
        });
      }
    };

    // Vérification hors-ligne synchrone ultra-rapide (0 ms)
    if (isAudioOffline(book.id) || isAudioOffline(rawAudioSrc)) {
      getOfflineAudioUrl(rawAudioSrc, book.id, chapterIdx).then(offlineSrc => {
        startPlayback(offlineSrc || rawAudioSrc);
      }).catch(() => startPlayback(rawAudioSrc));
    } else {
      // Cas standard (en ligne) : démarrage SYNCHRONE SANS AUCUN DÉLAI
      startPlayback(rawAudioSrc);
    }

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

  // Lancer la lecture d'un extrait gratuit (démarrage ultra-rapide 0ms)
  const playPreview = (book) => {
    if (!book) return;

    const hasExplicitPreview = Boolean(book.preview_url && book.preview_url.trim() && !book.preview_url.includes('pixabay'));

    if (!hasExplicitPreview && book.chapters && book.chapters.length > 0) {
      setIsPreviewMode(true);
      playBook(book, 0, 0);
      return;
    }

    setCurrentBook(book);
    setCurrentChapterIndex(0);
    setIsPreviewMode(true);
    setIsLoading(true);
    setIsPlaying(true);

    const rawAudioSrc = book.preview_url || book.chapters?.[0]?.audio_url || 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';

    // Enregistrer immédiatement l'écoute d'extrait pour les statistiques temps réel
    trackAudioPlay(book, book.chapters?.[0] || null, 0);

    const audio = audioRef.current;
    audio.preload = 'auto';

    const startPlayback = (targetUrl) => {
      const currentSrcNormalized = audio.src.replace(window.location.origin, '');
      const targetSrcNormalized = targetUrl.replace(window.location.origin, '');
      const isSameSource = audio.src === targetUrl || currentSrcNormalized === targetSrcNormalized;

      if (!isSameSource) {
        audio.src = targetUrl;
        audio.playbackRate = playbackRate;
      }

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsPlaying(true);
          setIsLoading(false);
        }).catch(e => {
          console.warn('Lecture restreinte par le navigateur:', e);
          setIsLoading(false);
        });
      }
    };

    if (isAudioOffline(book.id) || isAudioOffline(rawAudioSrc)) {
      getOfflineAudioUrl(rawAudioSrc, book.id, 'preview').then(offlineSrc => {
        startPlayback(offlineSrc || rawAudioSrc);
      }).catch(() => startPlayback(rawAudioSrc));
    } else {
      startPlayback(rawAudioSrc);
    }
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
        getAudioElement: () => audioRef.current,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => useContext(AudioContext);
