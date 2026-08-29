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
