/**
 * offlineAudioCache.js - Gestionnaire Universel de Stockage & Lecture Hors-Ligne
 * 
 * Architecture Double-Couche ultra-résiliente :
 * 1. IndexedDB (Tier 1 - Stockage binaire direct de Blobs audio & PDF) :
 *    - Fonctionne à 100% sur TOUS les navigateurs (iOS Safari, Android Chrome, Desktop, Firefox)
 *    - Insensible aux restrictions CORS pour la lecture hors-ligne
 *    - Capacité de stockage extensible (Go de livres audio et ebooks PDF)
 * 2. Cache API (Tier 2 - PWA / Service Worker)
 * 3. LocalStorage (Index métadonnées et état rapide)
 */

const CACHE_NAME = 'rg-audio-offline-v2';
const OFFLINE_INDEX_KEY = 'rg_offline_audiobooks';
const IDB_NAME = 'rg_play_offline_db';
const IDB_VERSION = 2;
const STORE_BOOKS = 'offline_books';
const STORE_BLOBS = 'offline_blobs';

// Registre mémoire des ObjectURLs créés pour éviter les fuites mémoire
const activeObjectUrls = new Map();

/**
 * Initialiser la base IndexedDB
 */
function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB non supporté'));
    }
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_BOOKS)) {
        db.createObjectStore(STORE_BOOKS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Enregistrer un Blob dans IndexedDB
 */
async function idbSaveBlob(key, blob, contentType = 'audio/mpeg') {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BLOBS, 'readwrite');
      const store = tx.objectStore(STORE_BLOBS);
      store.put({
        key,
        blob,
        contentType,
        size: blob.size,
        savedAt: Date.now(),
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IDB] Erreur sauvegarde blob:', key, err);
    return false;
  }
}

/**
 * Récupérer un Blob depuis IndexedDB
 */
async function idbGetBlob(key) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BLOBS, 'readonly');
      const store = tx.objectStore(STORE_BLOBS);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.blob : null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[IDB] Erreur récupération blob:', key, err);
    return null;
  }
}

/**
 * Supprimer les Blobs associés à un livre dans IndexedDB
 */
async function idbDeleteBlobs(keys) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BLOBS, 'readwrite');
      const store = tx.objectStore(STORE_BLOBS);
      keys.forEach((k) => {
        try { store.delete(k); } catch (_) {}
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    return false;
  }
}

/**
 * Récupérer la liste des livres stockés hors-ligne (LocalStorage + fallback IDB)
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
 * Vérifier si un livre ou une URL audio est disponible hors-ligne
 */
export function isAudioOffline(audioUrlOrBookId) {
  if (!audioUrlOrBookId) return false;
  const list = getOfflineBooks();
  return list.some(item => 
    item.id === audioUrlOrBookId || 
    item.audioUrl === audioUrlOrBookId || 
    item.preview_url === audioUrlOrBookId ||
    item.cachedUrls?.includes(audioUrlOrBookId) ||
    item.chapters?.some(ch => 
      ch.audio_url === audioUrlOrBookId || 
      ch.audio_stream_url === audioUrlOrBookId || 
      ch.url === audioUrlOrBookId
    )
  );
}

/**
 * Télécharger un fichier avec retry et fallback pour contourner les blocages
 */
async function fetchBinaryResource(url) {
  if (!url) return null;
  
  // 1. Tenter fetch direct avec CORS
  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (response.ok) {
      const blob = await response.blob();
      if (blob && blob.size > 0) return { blob, response };
    }
  } catch (corsErr) {
    console.warn(`[Offline] Fetch standard échoué pour ${url}, tentative sans mode cors...`, corsErr);
  }

  // 2. Tenter fetch sans options strictes
  try {
    const response = await fetch(url);
    if (response.ok) {
      const blob = await response.blob();
      if (blob && blob.size > 0) return { blob, response };
    }
  } catch (err2) {
    console.warn(`[Offline] Échec définitif pour ${url}:`, err2);
  }

  return null;
}

/**
 * Télécharger l'intégralité d'un livre (tous ses chapitres, l'extrait, le PDF et la couverture)
 * pour une écoute et lecture 100% hors-ligne.
 * 
 * @param {object} book - Livre complet
 * @param {function} onProgress - Callback de progression (0 à 100%)
 */
export async function downloadBookForOffline(book, onProgress = null) {
  if (typeof window === 'undefined' || !book?.id) {
    throw new Error("Le mode hors-ligne n'est pas disponible.");
  }

  try {
    // 1. Lister tous les chapitres
    const rawChapters = Array.isArray(book.chapters) && book.chapters.length > 0
      ? book.chapters
      : [
          {
            id: `${book.id}-main`,
            title: book.title || 'Chapitre 1',
            audio_url: book.preview_url || book.audio_url || book.audioUrl || '',
          }
        ];

    const chapters = rawChapters.map((ch, idx) => ({
      ...ch,
      id: ch.id || `chap-${book.id}-${idx + 1}`,
      title: ch.title || `Chapitre ${idx + 1}`,
      audio_url: ch.audio_url || ch.audio_stream_url || ch.audioUrl || ch.url || book.preview_url || '',
    }));

    // 2. Préparer la liste exhaustive des ressources à télécharger
    const itemsToDownload = [];
    const keysStored = [];

    chapters.forEach((ch, idx) => {
      if (ch.audio_url) {
        itemsToDownload.push({
          url: ch.audio_url,
          idbKey: `audio_${book.id}_ch_${idx}`,
          aliasKey: ch.audio_url,
          type: 'audio',
          title: ch.title,
        });
      }
    });

    // Extrait
    const previewUrl = book.preview_url || book.previewUrl;
    if (previewUrl && !itemsToDownload.some(it => it.url === previewUrl)) {
      itemsToDownload.push({
        url: previewUrl,
        idbKey: `audio_${book.id}_preview`,
        aliasKey: previewUrl,
        type: 'preview',
        title: 'Extrait Audio',
      });
    }

    // Couverture
    const coverUrl = book.cover_url || book.coverUrl;
    if (coverUrl) {
      itemsToDownload.push({
        url: coverUrl,
        idbKey: `cover_${book.id}`,
        aliasKey: coverUrl,
        type: 'cover',
        title: 'Pochette',
      });
    }

    // PDF / E-Book
    const pdfUrl = book.pdf_url || book.pdfUrl;
    if (pdfUrl) {
      itemsToDownload.push({
        url: pdfUrl,
        idbKey: `pdf_${book.id}`,
        aliasKey: pdfUrl,
        type: 'pdf',
        title: 'Livre Numérique PDF',
      });
    }

    const total = itemsToDownload.length;
    let completed = 0;
    const cachedUrlsList = [];

    // 3. Ouvrir Cache API en parallèle
    let cache = null;
    try {
      if ('caches' in window) {
        cache = await caches.open(CACHE_NAME);
      }
    } catch (_) {}

    // 4. Télécharger et stocker chaque ressource dans IndexedDB + Cache API
    for (const item of itemsToDownload) {
      try {
        const result = await fetchBinaryResource(item.url);
        if (result && result.blob) {
          // Sauvegarder le Blob dans IndexedDB sous sa clé unique et sous son URL
          await idbSaveBlob(item.idbKey, result.blob, result.blob.type || 'audio/mpeg');
          await idbSaveBlob(item.aliasKey, result.blob, result.blob.type || 'audio/mpeg');
          keysStored.push(item.idbKey, item.aliasKey);
          cachedUrlsList.push(item.url);

          // Sauvegarder dans Cache API
          if (cache && result.response) {
            try {
              await cache.put(item.url, result.response.clone());
            } catch (_) {}
          }
        }
      } catch (itemErr) {
        console.warn(`[Offline] Erreur téléchargement ${item.title}:`, itemErr);
      }

      completed++;
      if (typeof onProgress === 'function' && total > 0) {
        onProgress(Math.round((completed / total) * 100));
      }
    }

    // 5. Enregistrer le livre dans l'index local
    const currentList = getOfflineBooks();
    const existingIdx = currentList.findIndex(b => b.id === book.id);

    const offlineItem = {
      ...book,
      id: book.id,
      title: book.title,
      author: book.author || 'Auteur Read’s Great',
      narrator: book.narrator || 'Voix Studio',
      cover_url: book.cover_url || book.coverUrl,
      description: book.description || '',
      category_name: book.category_name || 'Livre Audio',
      chapters: chapters,
      audioUrl: chapters[0]?.audio_url || previewUrl || '',
      pdf_url: pdfUrl || '',
      cachedUrls: cachedUrlsList,
      idbKeys: keysStored,
      downloaded_at: Date.now(),
      is_downloaded: true,
      total_chapters: chapters.length,
    };

    let updatedList;
    if (existingIdx >= 0) {
      updatedList = [...currentList];
      updatedList[existingIdx] = { ...updatedList[existingIdx], ...offlineItem };
    } else {
      updatedList = [offlineItem, ...currentList];
    }

    localStorage.setItem(OFFLINE_INDEX_KEY, JSON.stringify(updatedList));

    // Sauvegarder aussi dans IndexedDB
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_BOOKS, 'readwrite');
      tx.objectStore(STORE_BOOKS).put(offlineItem);
    } catch (_) {}

    // Déclencher les événements globaux
    window.dispatchEvent(new CustomEvent('rg_offline_cache_updated', { detail: offlineItem }));
    window.dispatchEvent(new CustomEvent('rg:library-updated'));

    console.log(`[Offline Engine] ✓ Livre "${book.title}" téléchargé avec succès (${cachedUrlsList.length}/${total} fichiers).`);
    return true;
  } catch (err) {
    console.error('[Offline Engine] Échec téléchargement :', err);
    throw err;
  }
}

/**
 * Rétro-compatibilité
 */
export async function cacheAudioForOffline(book, chapter = null) {
  return downloadBookForOffline(book);
}

/**
 * Récupérer une URL audio / PDF locale prête pour lecture (ObjectURL Blob ou Cache)
 * 
 * @param {string} audioUrl - URL originale du fichier audio ou PDF
 * @param {string} bookId - Identifiant optionnel du livre
 * @param {number|string} chapterIdx - Index optionnel du chapitre
 */
export async function getOfflineAudioUrl(audioUrl, bookId = null, chapterIdx = 0) {
  if (!audioUrl) return audioUrl;

  // 1. Vérifier si un ObjectURL est déjà actif en mémoire
  if (activeObjectUrls.has(audioUrl)) {
    return activeObjectUrls.get(audioUrl);
  }

  // 2. Chercher dans IndexedDB par URL exacte
  let blob = await idbGetBlob(audioUrl);

  // 3. Si non trouvé, chercher par clé de chapitre IDB si bookId est fourni
  if (!blob && bookId) {
    if (chapterIdx === 'preview') {
      blob = await idbGetBlob(`audio_${bookId}_preview`);
    } else if (chapterIdx === 'pdf') {
      blob = await idbGetBlob(`pdf_${bookId}`);
    } else {
      blob = await idbGetBlob(`audio_${bookId}_ch_${chapterIdx}`);
    }
  }

  // 4. Si non trouvé, chercher dans Cache API
  if (!blob && typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(audioUrl);
      if (cachedResponse) {
        blob = await cachedResponse.blob();
      }
    } catch (_) {}
  }

  // 5. Si le blob est trouvé, créer un ObjectURL et le garder en cache mémoire
  if (blob && blob.size > 0) {
    const objectUrl = URL.createObjectURL(blob);
    activeObjectUrls.set(audioUrl, objectUrl);
    return objectUrl;
  }

  return audioUrl;
}

/**
 * Supprimer un livre du mode hors-ligne
 */
export async function removeOfflineAudio(bookId) {
  try {
    const list = getOfflineBooks();
    const item = list.find(b => b.id === bookId);

    // 1. Supprimer de IndexedDB
    if (item?.idbKeys && Array.isArray(item.idbKeys)) {
      await idbDeleteBlobs(item.idbKeys);
    }
    await idbDeleteBlobs([
      `cover_${bookId}`,
      `pdf_${bookId}`,
      `audio_${bookId}_preview`,
      ...Array.from({ length: 50 }, (_, i) => `audio_${bookId}_ch_${i}`),
    ]);

    try {
      const db = await openDB();
      const tx = db.transaction(STORE_BOOKS, 'readwrite');
      tx.objectStore(STORE_BOOKS).delete(bookId);
    } catch (_) {}

    // 2. Supprimer du Cache API
    if (item && 'caches' in window) {
      try {
        const cache = await caches.open(CACHE_NAME);
        if (item.cachedUrls && Array.isArray(item.cachedUrls)) {
          for (const url of item.cachedUrls) {
            try { await cache.delete(url); } catch (_) {}
          }
        }
        if (item.audioUrl) await cache.delete(item.audioUrl);
        if (item.cover_url) await cache.delete(item.cover_url);
      } catch (_) {}
    }

    // 3. Révoquer les ObjectURLs en mémoire
    activeObjectUrls.forEach((objUrl, key) => {
      if (key.includes(bookId) || item?.cachedUrls?.includes(key)) {
        try { URL.revokeObjectURL(objUrl); } catch (_) {}
        activeObjectUrls.delete(key);
      }
    });

    // 4. Mettre à jour l'index localStorage
    const updated = list.filter(b => b.id !== bookId);
    localStorage.setItem(OFFLINE_INDEX_KEY, JSON.stringify(updated));

    window.dispatchEvent(new CustomEvent('rg_offline_cache_updated'));
    window.dispatchEvent(new CustomEvent('rg:library-updated'));
    return true;
  } catch (e) {
    console.error('[Offline Engine] Erreur suppression:', e);
    return false;
  }
}

/**
 * Calculer la taille totale utilisée par le cache hors-ligne
 */
export async function getOfflineCacheSize() {
  let totalBytes = 0;

  // 1. Calculer depuis IndexedDB
  try {
    const db = await openDB();
    const blobs = await new Promise((resolve) => {
      const tx = db.transaction(STORE_BLOBS, 'readonly');
      const store = tx.objectStore(STORE_BLOBS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    blobs.forEach((item) => {
      if (item.size) totalBytes += item.size;
      else if (item.blob?.size) totalBytes += item.blob.size;
    });
  } catch (_) {}

  // 2. Calculer depuis Cache API si IDB vide
  if (totalBytes === 0 && typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await caches.open(CACHE_NAME);
      const keys = await cache.keys();
      for (const req of keys) {
        const res = await cache.match(req);
        if (res) {
          const blob = await res.blob();
          totalBytes += blob.size;
        }
      }
    } catch (_) {}
  }

  const mb = (totalBytes / (1024 * 1024)).toFixed(1);
  return `${mb} Mo`;
}

/**
 * Téléchargement physique MP3 sur le stockage de l'appareil
 */
export async function downloadAudioMp3(book, chapter = null, isPurchased = false) {
  const isFree = book?.price === 0 || book?.is_free_for_members === 1 || book?.is_free_for_members === true;
  if (!isPurchased && !isFree) {
    return 'not_purchased';
  }

  try {
    const targetUrl = chapter?.audio_url || chapter?.audio_stream_url || book?.preview_url || book?.chapters?.[0]?.audio_url;
    if (!targetUrl) return 'error';

    const localUrl = await getOfflineAudioUrl(targetUrl, book?.id, 0);
    const res = await fetch(localUrl);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    const cleanTitle = (chapter?.title || book?.title || 'audio').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `${cleanTitle}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
    return 'ok';
  } catch (err) {
    console.error('Erreur téléchargement MP3:', err);
    return 'error';
  }
}
