/**
 * statusAudioEncoder.js
 * Moteur d encodage audio AAC (mp4a.40.2 / f32-planar) pour Statut WhatsApp RG Play.
 * Decoupe et encode le flux audio numerique pur pour mp4-muxer.
 */

export const AUDIO_SAMPLE_RATE = 44100;
export const AUDIO_CHANNELS = 2;

export const AAC_CONFIG = {
  codec: 'mp4a.40.2',
  numberOfChannels: AUDIO_CHANNELS,
  sampleRate: AUDIO_SAMPLE_RATE,
  bitrate: 128_000,
};

/**
 * Verifie si le navigateur supporte l encodage materiel AAC via WebCodecs
 */
export async function isAacEncodingSupported() {
  if (typeof window === 'undefined' || typeof window.AudioEncoder !== 'function') return false;
  try {
    const res = await AudioEncoder.isConfigSupported(AAC_CONFIG).catch(() => null);
    return Boolean(res?.supported);
  } catch (_) { return false; }
}

/**
 * Initialise l enregistrement et l encodage audio AAC temps-reel synchronise
 * @param {{ audioTrack: MediaStreamTrack, muxer: import('mp4-muxer').Muxer }} options
 * @returns {Promise<{ canEncode: true, finish: () => Promise<void> } | null>}
 */
export async function createStatusAudioEncoder({ audioTrack, muxer }) {
  if (!audioTrack || !(await isAacEncodingSupported())) return null;

  let audioEncoder = null;
  let audioCtx = null;
  let scriptNode = null;
  let srcNode = null;
  let muteGain = null;
  let audioTs = 0;
  let isClosed = false;

  try {
    audioEncoder = new AudioEncoder({
      output: (chunk, meta) => { if (!isClosed && muxer) muxer.addAudioChunk(chunk, meta); },
      error: (e) => console.warn('[StatusAudioEncoder] Erreur AAC:', e),
    });
    audioEncoder.configure(AAC_CONFIG);

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass({ sampleRate: AUDIO_SAMPLE_RATE });

    if (audioCtx.state === 'suspended') await audioCtx.resume().catch(() => {});

    srcNode = audioCtx.createMediaStreamSource(new MediaStream([audioTrack]));

    // 2048 frames = taille optimale pour les blocs AAC
    scriptNode = audioCtx.createScriptProcessor(2048, AUDIO_CHANNELS, AUDIO_CHANNELS);

    scriptNode.onaudioprocess = (ev) => {
      if (isClosed || !audioEncoder || audioEncoder.state !== 'configured') return;
      try {
        const chL = ev.inputBuffer.getChannelData(0);
        const chR = ev.inputBuffer.numberOfChannels > 1
          ? ev.inputBuffer.getChannelData(1)
          : chL;
        const frames = chL.length;

        // FORMAT CRITIQUE : f32-planar (planaire) obligatoire pour AAC sur Chrome/Android
        // interleaved (f32) declenche une TypeError sur l encodeur materiel AAC
        const planarData = new Float32Array(frames * AUDIO_CHANNELS);
        planarData.set(chL, 0);
        planarData.set(chR, frames);

        const audioData = new AudioData({
          format: 'f32-planar',
          sampleRate: AUDIO_SAMPLE_RATE,
          numberOfFrames: frames,
          numberOfChannels: AUDIO_CHANNELS,
          timestamp: audioTs,
          data: planarData,
        });
        audioEncoder.encode(audioData);
        audioData.close();
        audioTs += Math.round((frames / AUDIO_SAMPLE_RATE) * 1_000_000);
      } catch (err) {
        console.warn('[StatusAudioEncoder] Exception traitement audio:', err);
      }
    };

    srcNode.connect(scriptNode);
    muteGain = audioCtx.createGain();
    muteGain.gain.value = 0;
    scriptNode.connect(muteGain);
    muteGain.connect(audioCtx.destination);

    return {
      canEncode: true,
      finish: async () => {
        isClosed = true;
        try {
          if (scriptNode) scriptNode.disconnect();
          if (srcNode) srcNode.disconnect();
          if (muteGain) muteGain.disconnect();
          if (audioEncoder?.state === 'configured') await audioEncoder.flush();
          if (audioCtx?.state !== 'closed') await audioCtx.close();
        } catch (e) {
          console.warn('[StatusAudioEncoder] Finalisation audio:', e);
        }
      },
    };
  } catch (initErr) {
    console.warn('[StatusAudioEncoder] Initialisation echouee:', initErr);
    if (scriptNode) try { scriptNode.disconnect(); } catch (_) {}
    if (audioCtx) try { audioCtx.close(); } catch (_) {}
    return null;
  }
}
