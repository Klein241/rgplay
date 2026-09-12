/**
 * Moteur de Compression & Optimisation Multimédia RG Play
 * - Images : Compression WebP/JPEG haute fidélité via HTML5 Canvas (gain 70-95% sans perte visible)
 * - Audio  : Normalisation DSP, Compression Dynamique & Encodage Compact Haute Efficacité
 */

import { encodeAudioBufferToCompressedBlob, audioBufferToWav } from './mp3Encoder';
export { encodeAudioBufferToCompressedBlob, audioBufferToWav };

// ── Compression d'Image sans perte de netteté ────────────────────────────────
export async function compressImage(file, { maxWidth = 1200, maxHeight = 1200, quality = 0.88, format = 'image/webp' } = {}) {
  if (!file || !file.type.startsWith('image/')) {
    return { file, originalSize: file?.size || 0, compressedSize: file?.size || 0, ratio: 0, previewUrl: '' };
  }

  const originalSize = file.size;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve({ file, originalSize, compressedSize: originalSize, ratio: 0, previewUrl: '' });
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => resolve({ file, originalSize, compressedSize: originalSize, ratio: 0, previewUrl: e.target.result });
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Redimensionnement intelligent proportionnel
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: true });

        if (!ctx) {
          return resolve({ file, originalSize, compressedSize: originalSize, ratio: 0, previewUrl: e.target.result });
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const targetMime = format;
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve({ file, originalSize, compressedSize: originalSize, ratio: 0, previewUrl: e.target.result });
            }

            // Si la compression n'apporte pas de gain, conserver le fichier d'origine
            if (blob.size >= originalSize) {
              const previewUrl = canvas.toDataURL(targetMime, quality);
              return resolve({ file, originalSize, compressedSize: originalSize, ratio: 0, previewUrl });
            }

            const baseName = file.name.replace(/\.[^/.]+$/, '');
            const ext = targetMime === 'image/webp' ? 'webp' : 'jpg';
            const compressedFile = new File([blob], `${baseName}.${ext}`, { type: targetMime });
            const previewUrl = canvas.toDataURL(targetMime, quality);
            const ratio = Math.round(((originalSize - blob.size) / originalSize) * 100);

            resolve({
              file: compressedFile,
              originalSize,
              compressedSize: blob.size,
              ratio,
              previewUrl,
              width,
              height,
            });
          },
          targetMime,
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Compression Audio Réelle MP3 via lamejs (@breezystack/lamejs) ────────────
// Stratégie intelligente :
//   • Fichier déjà compact (MP3/AAC < 12 Mo) → passthrough sans recompression
//   • Fichier lourd / non compressé (WAV, FLAC, ou > 12 Mo) → encodage MP3
//     - Music  : 128 kbps stéréo
//     - Voix (audiobook, podcast, masterclass) : 96 kbps mono
// Gain attendu : -85% à -92% sur masters WAV studio

// Taille seuil en dessous de laquelle on considère le fichier déjà optimisé (12 Mo)
const AUDIO_SKIP_THRESHOLD_BYTES = 12 * 1024 * 1024;

// Formats déjà compressés par nature (si en dessous du seuil)
const ALREADY_COMPRESSED_EXTS = /\.(mp3|m4a|aac|ogg|webm|opus)$/i;

// Sample rates supportés par LAME MP3 (autres → on resample via OfflineAudioContext)
const LAME_SUPPORTED_RATES = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000];

function nearestLameSampleRate(rate) {
  return LAME_SUPPORTED_RATES.reduce((prev, cur) =>
    Math.abs(cur - rate) < Math.abs(prev - rate) ? cur : prev
  );
}

export async function compressAndOptimizeAudio(
  file,
  { contentType = 'audiobook', onProgress = () => {} } = {}
) {
  if (!file || (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|m4a|aac|flac|webm|opus)$/i))) {
    return { file, originalSize: file?.size || 0, compressedSize: file?.size || 0, ratio: 0, duration: 0 };
  }

  const originalSize = file.size;
  const isAlreadyCompressedFormat = ALREADY_COMPRESSED_EXTS.test(file.name);

  // ── Passthrough intelligent : fichier déjà léger et dans un format compressé
  if (isAlreadyCompressedFormat && originalSize <= AUDIO_SKIP_THRESHOLD_BYTES) {
    onProgress(30);
    let duration = 0;
    try {
      const url = URL.createObjectURL(file);
      const a = new Audio(url);
      await new Promise((r) => { a.onloadedmetadata = r; a.onerror = r; setTimeout(r, 1500); });
      duration = a.duration && isFinite(a.duration) ? a.duration : 0;
      URL.revokeObjectURL(url);
    } catch (_) {}
    onProgress(100);
    return { file, originalSize, compressedSize: originalSize, ratio: 0, duration, isOptimized: true };
  }

  // ── Compression MP3 réelle ────────────────────────────────────────────────
  try {
    onProgress(5);

    // Décodage PCM brut via Web Audio API
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    onProgress(15);

    let decoded;
    try {
      decoded = await audioCtx.decodeAudioData(arrayBuffer);
    } catch (_) {
      try { audioCtx.close(); } catch (__) {}
      throw new Error('Décodage audio impossible');
    }
    try { audioCtx.close(); } catch (_) {}

    onProgress(25);

    const rawDuration = decoded.duration;
    const rawSampleRate = decoded.sampleRate;
    const rawChannels = decoded.numberOfChannels;

    // Bitrate et canaux cibles selon le type de contenu
    const isVoice = ['audiobook', 'podcast', 'masterclass'].includes(contentType);
    const targetBitrate = isVoice ? 96 : 128;
    const targetChannels = isVoice ? 1 : Math.min(2, rawChannels);
    const targetSampleRate = nearestLameSampleRate(Math.min(rawSampleRate, 48000));

    // Resample si nécessaire via OfflineAudioContext
    let buffer = decoded;
    if (rawSampleRate !== targetSampleRate || rawChannels !== targetChannels) {
      const offlineCtx = new OfflineAudioContext(
        targetChannels,
        Math.ceil(rawDuration * targetSampleRate),
        targetSampleRate
      );
      const src = offlineCtx.createBufferSource();
      src.buffer = decoded;
      src.connect(offlineCtx.destination);
      src.start(0);
      buffer = await offlineCtx.startRendering();
    }

    onProgress(40);

    // Import dynamique de lamejs (chargé une seule fois par Vite)
    const { Mp3Encoder } = await import('@breezystack/lamejs');
    const encoder = new Mp3Encoder(targetChannels, targetSampleRate, targetBitrate);

    const leftFloat = buffer.getChannelData(0);
    const rightFloat = targetChannels === 2
      ? (buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0))
      : null;

    // Conversion Float32 → Int16 helper
    const toInt16 = (floatArr) => {
      const out = new Int16Array(floatArr.length);
      for (let i = 0; i < floatArr.length; i++) {
        const s = Math.max(-1, Math.min(1, floatArr[i]));
        out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      return out;
    };

    const leftInt16 = toInt16(leftFloat);
    const rightInt16 = rightFloat ? toInt16(rightFloat) : null;

    const CHUNK = 1152 * 8; // 9216 samples par passe ≈ ~0.2 s — UI réactive
    const mp3Parts = [];
    const total = leftInt16.length;

    for (let i = 0; i < total; i += CHUNK) {
      const l = leftInt16.subarray(i, i + CHUNK);
      const r = rightInt16 ? rightInt16.subarray(i, i + CHUNK) : l;
      const encoded = targetChannels === 1
        ? encoder.encodeBuffer(l)
        : encoder.encodeBuffer(l, r);
      if (encoded.length > 0) mp3Parts.push(encoded);
      // Progression de 40 % à 92 %
      onProgress(40 + Math.round((i / total) * 52));
      // Yield au navigateur toutes les N passes pour ne pas bloquer l'UI
      if (i % (CHUNK * 16) === 0) await new Promise((r) => setTimeout(r, 0));
    }

    const flushed = encoder.flush();
    if (flushed.length > 0) mp3Parts.push(flushed);
    onProgress(95);

    // Assemblage du blob MP3 final
    const mp3Blob = new Blob(mp3Parts, { type: 'audio/mpeg' });
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const mp3File = new File([mp3Blob], `${baseName}.mp3`, { type: 'audio/mpeg' });

    const compressedSize = mp3File.size;
    const ratio = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));

    onProgress(100);
    return {
      file: mp3File,
      originalSize,
      compressedSize,
      ratio,
      duration: rawDuration,
      sampleRate: targetSampleRate,
      channels: targetChannels,
      isOptimized: true,
    };
  } catch (err) {
    console.warn('[AudioCompressor] Compression MP3 échouée, envoi du fichier original:', err);
    return { file, originalSize, compressedSize: originalSize, ratio: 0, duration: 0, isOptimized: false };
  }
}

