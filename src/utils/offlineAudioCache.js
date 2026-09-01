/**
 * offlineAudioCache.js - Gestionnaire de téléchargement & cache hors-connexion
 * Utilise la Cache API du navigateur (optimisée pour les gros fichiers audio binaires)
 * et stocke l'index des livres disponibles hors-ligne dans localStorage.
 */

const CACHE_NAME = 'rg-audio-offline-v1';
const OFFLINE_INDEX_KEY = 'rg_offline_audiobooks';

/**
 * Récupérer la liste des livres/chapitres stockés hors-ligne
 */
export function getOfflineBooks() {
  try {
    const raw = localStorage.getItem(OFFLINE_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Vérifier si un livre/chapitre est disponible hors-ligne
 */
export function isAudioOffline(audioUrl) {
  if (!audioUrl) return false;
  const list = getOfflineBooks();
  return list.some(item => item.audioUrl === audioUrl || item.cachedUrls?.includes(audioUrl));
}

/**
 * Télécharger et mettre en cache automatiquement l'audio d'un livre/chapitre
 * Déclenché dès qu'un utilisateur termine d'écouter ou clique sur télécharger
 */
export async function cacheAudioForOffline(book, chapter = null) {
  if (typeof window === 'undefined' || !('caches' in window)) return false;

  try {
    const cache = await caches.open(CACHE_NAME);
    const targetAudioUrl = chapter?.audio_url || book?.preview_url || book?.chapters?.[0]?.audio_url;

    if (!targetAudioUrl) return false;

    // 1. Mettre en cache le fichier audio
    const res = await fetch(targetAudioUrl, { mode: 'cors' });
    if (res.ok) {
      await cache.put(targetAudioUrl, res.clone());
    }

    // 2. Mettre en cache la couverture si présente
    if (book?.cover_url) {
      try {
        const coverRes = await fetch(book.cover_url, { mode: 'cors' });
        if (coverRes.ok) await cache.put(book.cover_url, coverRes.clone());
      } catch (_) {}
    }

    // 3. Mettre à jour l'index localStorage
    const currentList = getOfflineBooks();
    const existingIdx = currentList.findIndex(b => b.id === book.id);

    const offlineItem = {
      id: book.id,
      title: book.title,
      author: book.author,
      cover_url: book.cover_url,
      category_name: book.category_name || 'Audiobook',
      audioUrl: targetAudioUrl,
      cachedUrls: [targetAudioUrl, book.cover_url].filter(Boolean),
      downloaded_at: Date.now(),
      size_mb: 2.5,
    };

    let updatedList;
    if (existingIdx >= 0) {
      updatedList = [...currentList];
      updatedList[existingIdx] = { ...updatedList[existingIdx], ...offlineItem };
    } else {
      updatedList = [offlineItem, ...currentList];
    }

    localStorage.setItem(OFFLINE_INDEX_KEY, JSON.stringify(updatedList));

    // Déclencher un événement personnalisé pour notifier l'UI
    window.dispatchEvent(new CustomEvent('rg_offline_cache_updated', { detail: offlineItem }));
    console.log(`[Cache Hors-Ligne] ✓ Audio mis en cache pour : "${book.title}"`);
    return true;
  } catch (err) {
    console.warn('[Cache Hors-Ligne] Erreur mise en cache audio:', err);
    return false;
  }
}

/**
 * Récupérer une URL audio hors-ligne (depuis Cache API si réseau indisponible)
 */
export async function getOfflineAudioUrl(audioUrl) {
  if (!audioUrl || typeof window === 'undefined' || !('caches' in window)) return audioUrl;

  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(audioUrl);
    if (cachedResponse) {
      const blob = await cachedResponse.blob();
      return URL.createObjectURL(blob);
    }
  } catch (err) {
    console.warn('[Cache Hors-Ligne] Impossible de lire depuis le cache:', err);
  }
  return audioUrl;
}

/**
 * Supprimer un livre du cache hors-ligne
 */
export async function removeOfflineAudio(bookId) {
  try {
    const list = getOfflineBooks();
    const item = list.find(b => b.id === bookId);
    if (item && 'caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      if (item.audioUrl) await cache.delete(item.audioUrl);
      if (item.cover_url) await cache.delete(item.cover_url);
    }
    const updated = list.filter(b => b.id !== bookId);
    localStorage.setItem(OFFLINE_INDEX_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('rg_offline_cache_updated'));
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Télécharge physiquement un fichier MP3 sur l'appareil de l'utilisateur.
 * Accessible uniquement si le livre a été acheté.
 *
 * @param {object} book     - Le livre audio (doit contenir .id, .title, .author)
 * @param {object|null} chapter  - Le chapitre spécifique (optionnel, sinon = preview)
 * @param {boolean} isPurchased  - L'utilisateur a-t-il payé ce livre ?
 * @returns {'ok'|'not_purchased'|'error'}
 */
export async function downloadAudioMp3(book, chapter = null, isPurchased = false) {
  // Vérification d'accès : livre acheté, ou gratuit pour les membres
  const isFree = book?.price === 0 || book?.is_free_for_members === 1 || book?.is_free_for_members === true;
  if (!isPurchased && !isFree) {
    return 'not_purchased';
  }

  try {
    // Priorité : URL du chapitre > URL preview > URL audio du premier chapitre
    const audioUrl = chapter?.audio_url || book?.preview_url || book?.chapters?.[0]?.audio_url;
    if (!audioUrl) return 'error';

    // Nom de fichier propre (format [RG_Play] Titre - Chapitre.mp3)
    const safeTitle   = (book.title || 'Audio').replace(/[^a-zA-Z0-9\u00C0-\u024F\s'-]/g, '').trim().slice(0, 40);
    const safeChapter = chapter ? ` - ${chapter.title || `Ch.${chapter.chapter_number}`}`.slice(0, 30) : '';
    const fileName    = `[RG_Play] ${safeTitle}${safeChapter}.mp3`;

    // Tentative de téléchargement direct (via fetch + blob)
    const response = await fetch(audioUrl, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const blob   = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href     = blobUrl;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Libérer la mémoire après un court délai
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);

    console.log(`[MP3 Download] ✓ Téléchargement déclenché : "${fileName}"`);
    return 'ok';
  } catch (err) {
    console.warn('[MP3 Download] Erreur téléchargement:', err);

    // Fallback : ouvrir l'URL dans un nouvel onglet
    const audioUrl = chapter?.audio_url || book?.preview_url || book?.chapters?.[0]?.audio_url;
    if (audioUrl) {
      try { window.open(audioUrl, '_blank'); } catch (_) {}
    }
    return 'error';
  }
}

/**
 * Retourne l'espace total utilisé par les fichiers mis en cache hors-ligne (en Mo estimé).
 */
export async function getOfflineCacheSize() {
  try {
    if (!('storage' in navigator && 'estimate' in navigator.storage)) return null;
    const { usage } = await navigator.storage.estimate();
    return usage ? (usage / 1024 / 1024).toFixed(1) : null;
  } catch { return null; }
}
