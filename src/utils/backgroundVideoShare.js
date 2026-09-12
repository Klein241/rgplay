/**
 * backgroundVideoShare.js
 * Encodeur vidéo d'arrière-plan pour le partage instantané sur WhatsApp / Stories.
 *
 * Comment ça marche :
 *   1. La lecture d'un livre déclenche startBackgroundEncode() après 5s (depuis AudioContext)
 *   2. Un clip de 20s est encodé silencieusement (H.264+AAC via WebCodecs)
 *   3. Quand l'utilisateur clique "Partager", shareAudioWithCover() utilise
 *      la vidéo prête pour un partage instantané
 *
 * Ce module est un singleton léger (pas de Worker, zero overhead de lecture).
 */

import { generateWhatsAppStatusVideo } from './statusVideoGenerator';

const BG_DURATION = 20; // secondes du clip de partage

let _state = {
  bookId: null,
  chapterIdx: null,
  status: 'idle', // 'idle' | 'encoding' | 'ready' | 'error'
  result: null,
  controller: null,
};

/**
 * Lance l'encodage en arrière-plan pour un livre/chapitre donné.
 * Idempotent : ne relance pas si déjà encodé pour le même livre.
 * Ne bloque jamais la lecture.
 *
 * @param {object} book - L'objet livre courant
 * @param {object|null} chapter - Le chapitre courant
 * @param {HTMLAudioElement} audioElement - L'élément audio en cours de lecture
 * @param {number} fromTime - Position de départ dans l'audio (secondes)
 */
export function startBackgroundEncode(book, chapter, audioElement, fromTime = 0) {
  if (!book?.id || !audioElement) return;

  const chIdx = chapter ? (book.chapters?.indexOf(chapter) ?? 0) : 0;

  // Pas de double-encodage pour le même livre+chapitre
  if (_state.bookId === book.id && _state.chapterIdx === chIdx &&
      (_state.status === 'encoding' || _state.status === 'ready')) {
    return;
  }

  // Annuler l'encodage précédent
  _state.controller?.abort();

  const controller = new AbortController();
  _state = { bookId: book.id, chapterIdx: chIdx, status: 'encoding', result: null, controller };

  // Encodage silencieux — pas de await intentionnel
  generateWhatsAppStatusVideo({
    book,
    chapter,
    audioElement,
    startTime: Math.max(0, fromTime),
    duration: BG_DURATION,
    quoteText: (book.synopsis || book.description?.split?.('.')?.[0] || '').slice(0, 140),
    onProgress: () => {},
    signal: controller.signal,
    isBackground: true,
  }).then((result) => {
    if (controller.signal.aborted) return;
    _state.status = 'ready';
    _state.result = result;
    window.dispatchEvent(new CustomEvent('rg:bg-video-ready', {
      detail: { bookId: book.id },
    }));
    console.info(`[BGVideo] ✅ Clip prêt pour "${book.title}" (${BG_DURATION}s)`);
  }).catch((err) => {
    if (err?.name === 'AbortError') return;
    console.warn('[BGVideo] Encodage échoué:', err?.message);
    _state.status = 'error';
  });
}

/**
 * Renvoie la vidéo pré-encodée si prête pour ce livre, sinon null.
 * @param {string|null} bookId
 * @returns {{ file: File, blob: Blob, url: string } | null}
 */
export function getBackgroundVideo(bookId = null) {
  if (_state.status !== 'ready') return null;
  if (bookId && _state.bookId !== bookId) return null;
  return _state.result;
}

/**
 * Renvoie le statut courant de l'encodage pour un livre donné.
 * @returns {'idle'|'encoding'|'ready'|'error'}
 */
export function getBackgroundEncodeStatus(bookId = null) {
  if (bookId && _state.bookId !== bookId) return 'idle';
  return _state.status;
}

/**
 * Annule l'encodage en cours et remet à zéro l'état.
 * Appeler lors du changement de livre ou de l'arrêt de la lecture.
 */
export function resetBackgroundEncode() {
  _state.controller?.abort();
  _state = { bookId: null, chapterIdx: null, status: 'idle', result: null, controller: null };
}
