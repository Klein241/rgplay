import { useEffect, useRef } from 'react';
import { useAudio } from '../context/AudioContext';
import { startBackgroundEncode, resetBackgroundEncode } from '../utils/backgroundVideoShare';

/**
 * BackgroundVideoWorker.jsx
 * Composant sans interface visuelle qui prépare silencieusement en arrière-plan
 * un clip vidéo 9:16 de 20s après 5 secondes d'écoute active d'un livre audio.
 */
export const BackgroundVideoWorker = () => {
  const { currentBook, currentChapter, isPlaying, currentTime, getAudioElement } = useAudio();
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isPlaying || !currentBook) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    // Après 5 secondes de lecture continue, démarrer la préparation du clip
    timerRef.current = setTimeout(() => {
      const audioEl = getAudioElement?.();
      if (audioEl && isPlaying) {
        startBackgroundEncode(currentBook, currentChapter, audioEl, currentTime);
      }
    }, 5000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, currentBook?.id, currentChapter?.id]);

  return null;
};
