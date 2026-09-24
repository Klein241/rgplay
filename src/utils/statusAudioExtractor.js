/**
 * statusAudioExtractor.js
 * Extracteur et décodeur audio numérique pour vidéo de statut WhatsApp / Story RG Play.
 * 
 * Avantages décisifs par rapport à captureStream() :
 * 1. Extraction en mémoire instantanée (0 ms de lecture réelle à attendre)
 * 2. Aucun son craché par les haut-parleurs du téléphone pendant la génération
 * 3. Données PCM pures 100% sans contamination CORS (AudioBuffer)
 * 4. Synchronisation frame-accurate parfaite avec la vidéo
 */

/**
 * Récupère un Blob depuis IndexedDB si disponible dans le cache hors-ligne
 */
async function getCachedBlob(urlOrKey) {
  if (typeof window === 'undefined' || !window.indexedDB || !urlOrKey) return null;
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('rg_play_offline_db', 2);
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('offline_blobs')) {
          db.close();
          return resolve(null);
        }
        const tx = db.transaction('offline_blobs', 'readonly');
        const store = tx.objectStore('offline_blobs');
        const getReq = store.get(urlOrKey);
        getReq.onsuccess = () => {
          db.close();
          resolve(getReq.result?.blob || null);
        };
        getReq.onerror = () => {
          db.close();
          resolve(null);
        };
      };
    } catch (_) {
      resolve(null);
    }
  });
}

/**
 * Télécharge ou récupère le binaire audio pour un chapitre/livre donné
 */
async function fetchAudioArrayBuffer({ book, chapter, audioElement }) {
  const targetUrl = chapter?.audio_url || book?.preview_url || audioElement?.src;
  if (!targetUrl) return null;

  // 1. Tenter le cache hors-ligne IndexedDB
  const cachedBlob = (await getCachedBlob(targetUrl)) || 
                     (chapter?.id ? await getCachedBlob(`audio_${chapter.id}`) : null) ||
                     (book?.id ? await getCachedBlob(`audio_${book.id}_main`) : null);

  if (cachedBlob) {
    try {
      return await cachedBlob.arrayBuffer();
    } catch (_) {}
  }

  // 2. Tenter un fetch direct avec CORS
  try {
    const res = await fetch(targetUrl, { mode: 'cors', credentials: 'omit' });
    if (res.ok) {
      return await res.arrayBuffer();
    }
  } catch (err) {
    console.warn('[StatusAudio] Fetch CORS audio direct échoué, essai simple:', err?.message || err);
  }

  // 3. Repli sans options strictes
  try {
    const res = await fetch(targetUrl);
    if (res.ok) {
      return await res.arrayBuffer();
    }
  } catch (err2) {
    console.warn('[StatusAudio] Impossible de télécharger le fichier audio complet:', err2?.message || err2);
  }

  return null;
}

/**
 * Extrait une tranche PCM Float32Array nette pour le segment demandé
 * @param {object} options
 * @param {object} options.book - Livre actif
 * @param {object} options.chapter - Chapitre actif
 * @param {HTMLAudioElement} options.audioElement - Balise audio en cours
 * @param {number} options.startTime - Début de l'extrait en secondes
 * @param {number} options.duration - Durée de l'extrait en secondes
 * @returns {Promise<{ pcmChannels: [Float32Array, Float32Array], sampleRate: number, duration: number } | null>}
 */
export async function extractAudioSlice({ book, chapter, audioElement, startTime = 0, duration = 30 }) {
  try {
    const arrayBuffer = await fetchAudioArrayBuffer({ book, chapter, audioElement });
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return null;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    const audioCtx = new AudioContextClass();
    let audioBuffer = null;

    try {
      // Cloner l'ArrayBuffer avant decodeAudioData car certains navigateurs le détachent
      const bufferCopy = arrayBuffer.slice(0);
      audioBuffer = await audioCtx.decodeAudioData(bufferCopy);
    } catch (decodeErr) {
      console.warn('[StatusAudio] Décodage audio échoué:', decodeErr?.message || decodeErr);
      try { await audioCtx.close(); } catch (_) {}
      return null;
    }

    try { await audioCtx.close(); } catch (_) {}

    if (!audioBuffer) return null;

    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.max(0, Math.floor(startTime * sampleRate));
    const maxSamples = Math.floor(duration * sampleRate);
    const availableSamples = Math.max(0, audioBuffer.length - startSample);
    const sliceSamples = Math.min(maxSamples, availableSamples);

    if (sliceSamples <= 0) return null;

    // Extraire les canaux gauche et droite
    const srcCh0 = audioBuffer.getChannelData(0);
    const ch0 = srcCh0.slice(startSample, startSample + sliceSamples);

    let ch1 = ch0;
    if (audioBuffer.numberOfChannels > 1) {
      const srcCh1 = audioBuffer.getChannelData(1);
      ch1 = srcCh1.slice(startSample, startSample + sliceSamples);
    }

    // Compléter avec du silence si la tranche disponible est plus courte que la durée demandée
    let finalCh0 = ch0;
    let finalCh1 = ch1;
    if (sliceSamples < maxSamples) {
      finalCh0 = new Float32Array(maxSamples);
      finalCh0.set(ch0, 0);
      finalCh1 = new Float32Array(maxSamples);
      finalCh1.set(ch1, 0);
    }

    return {
      pcmChannels: [finalCh0, finalCh1],
      sampleRate,
      duration,
      numberOfChannels: 2,
    };
  } catch (err) {
    console.warn('[StatusAudio] Exception extraction audio PCM:', err);
    return null;
  }
}
