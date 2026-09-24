/**
 * statusAudioEncoder.js
 * Moteur d'encodage audio AAC (mp4a.40.2 / f32-planar) pour Statut WhatsApp RG Play.
 * 
 * Supporte :
 * 1. Encodage direct et ultra-rapide depuis des tranches PCM mémoires Float32Array (idéal, 0 ms d'attente)
 * 2. Encodage temps réel synchronisé depuis un flux MediaStreamTrack (fallback)
 * 3. Détection dynamique de la configuration AAC supportée par le matériel (44.1kHz vs 48kHz, stéréo vs mono)
 */

export const DEFAULT_SAMPLE_RATE = 44100;
export const DEFAULT_CHANNELS = 2;

/**
 * Détecte la configuration AAC supportée par l'appareil
 * @param {number} [preferredSampleRate=44100]
 * @returns {Promise<{ codec: string, sampleRate: number, numberOfChannels: number, bitrate: number } | null>}
 */
export async function detectAacConfig(preferredSampleRate = DEFAULT_SAMPLE_RATE) {
  if (typeof window === 'undefined' || typeof window.AudioEncoder !== 'function') return null;

  const sampleRates = preferredSampleRate === 48000 ? [48000, 44100] : [44100, 48000];
  const channelConfigs = [2, 1];

  for (const sr of sampleRates) {
    for (const ch of channelConfigs) {
      try {
        const config = {
          codec: 'mp4a.40.2',
          sampleRate: sr,
          numberOfChannels: ch,
          bitrate: 128_000,
        };
        const res = await AudioEncoder.isConfigSupported(config).catch(() => null);
        if (res?.supported) {
          return config;
        }
      } catch (_) {}
    }
  }

  return null;
}

/**
 * Encode directement une tranche PCM Float32Array en AAC vers le muxer MP4
 * @param {object} options
 * @param {[Float32Array, Float32Array]} options.pcmChannels - Canaux [gauche, droite]
 * @param {number} options.sampleRate - Fréquence d'échantillonnage de la source
 * @param {import('mp4-muxer').Muxer} options.muxer - Instance active de mp4-muxer
 * @returns {Promise<boolean>} true si au moins un chunk AAC a été encodé avec succès
 */
export async function encodePcmSliceToAac({ pcmChannels, sampleRate, muxer }) {
  if (!pcmChannels || !pcmChannels[0] || !muxer) return false;

  const aacConfig = await detectAacConfig(sampleRate);
  if (!aacConfig) {
    console.warn('[StatusAudioEncoder] Encodage AAC non supporté sur ce navigateur/matériel.');
    return false;
  }

  let chunksAdded = 0;
  let encoderError = null;

  const encoder = new AudioEncoder({
    output: (chunk, meta) => {
      chunksAdded++;
      muxer.addAudioChunk(chunk, meta);
    },
    error: (e) => {
      encoderError = e;
      console.warn('[StatusAudioEncoder] Erreur AudioEncoder:', e);
    },
  });

  try {
    encoder.configure(aacConfig);
  } catch (confErr) {
    console.warn('[StatusAudioEncoder] Échec de configuration AAC:', confErr);
    return false;
  }

  const ch0 = pcmChannels[0];
  const ch1 = pcmChannels[1] || ch0;
  const totalFrames = ch0.length;
  const CHUNK_FRAMES = 1024; // Taille standard d'une frame audio AAC

  let audioTsUs = 0;

  for (let offset = 0; offset < totalFrames; offset += CHUNK_FRAMES) {
    if (encoderError) break;

    const frames = Math.min(CHUNK_FRAMES, totalFrames - offset);
    const sub0 = ch0.subarray(offset, offset + frames);
    const sub1 = ch1.subarray(offset, offset + frames);

    // Format f32-planar requis pour AAC sur Chromium/WebCodecs
    const planarData = new Float32Array(frames * 2);
    planarData.set(sub0, 0);
    planarData.set(sub1, frames);

    try {
      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate: aacConfig.sampleRate,
        numberOfFrames: frames,
        numberOfChannels: 2,
        timestamp: audioTsUs,
        data: planarData,
      });

      encoder.encode(audioData);
      audioData.close();
    } catch (encErr) {
      console.warn('[StatusAudioEncoder] Erreur encodage frame audio:', encErr);
      break;
    }

    audioTsUs += Math.round((frames / aacConfig.sampleRate) * 1_000_000);
  }

  try {
    if (!encoderError) {
      await encoder.flush();
    }
  } catch (flushErr) {
    console.warn('[StatusAudioEncoder] Erreur flush audio:', flushErr);
  }

  try {
    encoder.close();
  } catch (_) {}

  return chunksAdded > 0;
}
