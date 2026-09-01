/**
 * Utilitaire de partage avancé RG Play
 * Partage l'audio avec sa pochette d'illustration (Fichier Image) et son lien d'écoute
 */

export async function shareAudioWithCover(book) {
  if (!book) return { success: false, reason: 'no_book' };

  const url = `${window.location.origin}/?book=${encodeURIComponent(book.id)}`;
  const shareTitle = `${book.title} — RG Play`;
  const shareText = `🎧 Écoutez "${book.title}" par ${book.author} sur RG Play`;

  // 1. Tenter le partage natif avec fichier image (si supporté par le navigateur/mobile)
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      let fileToShare = null;

      if (book.cover_url && typeof navigator.canShare === 'function') {
        try {
          const proxyOrDirectUrl = book.cover_url.includes('r2.cloudflarestorage.com') && book.cover_r2_key
            ? `/api/r2/download?key=${encodeURIComponent(book.cover_r2_key)}`
            : book.cover_url;

          const response = await fetch(proxyOrDirectUrl, { mode: 'cors' }).catch(() => null);
          if (response && response.ok) {
            const blob = await response.blob();
            const fileName = `${(book.title || 'audiobook').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_cover.jpg`;
            const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });

            if (navigator.canShare({ files: [file] })) {
              fileToShare = file;
            }
          }
        } catch (imgErr) {
          console.warn('[Share] Impossible d\'incorporer l\'image en pièce jointe:', imgErr);
        }
      }

      if (fileToShare) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: url,
          files: [fileToShare],
        });
        return { success: true, method: 'files' };
      } else {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: url,
        });
        return { success: true, method: 'native' };
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        return { success: false, reason: 'cancelled' };
      }
      console.warn('[Share] Repli sur presse-papiers:', err);
    }
  }

  // 2. Repli Presse-papiers
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
      return { success: true, method: 'clipboard' };
    }
  } catch (_) {}

  return { success: false, reason: 'unsupported' };
}
