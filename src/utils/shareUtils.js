/**
 * shareUtils.js — Utilitaires de partage RG Play
 * Partage l'audio avec sa pochette ou une vidéo statut pré-encodée.
 */

import { getBackgroundVideo } from './backgroundVideoShare';

/**
 * Partage avec la vidéo pré-encodée si disponible, sinon avec la pochette.
 */
export async function shareAudioWithCover(book) {
  if (!book) return { success: false, reason: 'no_book' };

  const url = `${window.location.origin}/?book=${encodeURIComponent(book.id)}&play=1`;
  const shareTitle = `${book.title} — RG Play`;
  const shareText = `🎧 Écoutez "${book.title}" par ${book.author}\n👉 Écoutez gratuitement sur RG Play : ${url}\n📚 Bibliothèque READ'S GREAT`;

  if (typeof navigator === 'undefined' || !navigator.share) {
    return _fallbackClipboard(url);
  }

  // 1. Priorité : vidéo pré-encodée en arrière-plan
  const bgVideo = getBackgroundVideo(book.id);
  if (bgVideo?.file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [bgVideo.file] })) {
    try {
      await navigator.share({ title: shareTitle, text: shareText, files: [bgVideo.file] });
      return { success: true, method: 'video' };
    } catch (err) {
      if (err.name === 'AbortError') return { success: false, reason: 'cancelled' };
    }
  }

  // 2. Repli : pochette image
  try {
    let fileToShare = null;
    if (book.cover_url && typeof navigator.canShare === 'function') {
      try {
        const proxyUrl = book.cover_url.includes('r2.cloudflarestorage.com') && book.cover_r2_key
          ? `/api/r2/download?key=${encodeURIComponent(book.cover_r2_key)}`
          : book.cover_url;
        const res = await fetch(proxyUrl, { mode: 'cors' }).catch(() => null);
        if (res?.ok) {
          const blob = await res.blob();
          const file = new File(
            [blob],
            `${(book.title || 'book').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_cover.jpg`,
            { type: blob.type || 'image/jpeg' }
          );
          if (navigator.canShare({ files: [file] })) fileToShare = file;
        }
      } catch (_) {}
    }

    if (fileToShare) {
      await navigator.share({ title: shareTitle, text: shareText, url, files: [fileToShare] });
      return { success: true, method: 'files' };
    }

    await navigator.share({ title: shareTitle, text: shareText, url });
    return { success: true, method: 'native' };
  } catch (err) {
    if (err.name === 'AbortError') return { success: false, reason: 'cancelled' };
  }

  return _fallbackClipboard(url);
}

async function _fallbackClipboard(url) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return { success: true, method: 'clipboard' };
    }
  } catch (_) {}
  return { success: false, reason: 'unsupported' };
}
