/**
 * statusVideoGenerator.js
 * Moteur de rendu Video Statut WhatsApp / Story (9:16 - 720x1280)
 * H.264 + AAC via WebCodecs + mp4-muxer -> MP4 natif WhatsApp-compatible
 *
 * ARCHITECTURE :
 *   1. Priorite absolue WebCodecs + mp4-muxer  => Vrai MP4 ISO (H.264/AAC)
 *   2. Repli MediaRecorder uniquement si WebCodecs absent (Safari iOS <= 17)
 *      -> Alerte et export propre du vrai format produit (jamais de faux MP4)
 */

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  loadSafeImage,
  drawStatusFrame,
} from './statusCanvasRenderer';
import {
  AAC_CONFIG,
  AUDIO_SAMPLE_RATE,
  AUDIO_CHANNELS,
  isAacEncodingSupported,
  createStatusAudioEncoder,
} from './statusAudioEncoder';

const FPS = 30;

// ── Profils H.264 par ordre de preference (plus compatible -> moins compatible) ──
const CANDIDATE_VIDEO_CODECS = [
  'avc1.42001f', // Baseline 3.1  <- le plus universel
  'avc1.42E01F', // Constrained Baseline 3.1
  'avc1.4d001f', // Main 3.1
  'avc1.64001f', // High 3.1
];

/**
 * Detecte si WebCodecs VideoEncoder est disponible et supporte H.264
 */
async function detectWebCodecsVideoSupport() {
  if (
    typeof window === 'undefined' ||
    typeof window.VideoEncoder !== 'function' ||
    typeof window.VideoFrame !== 'function'
  ) return null;

  for (const codec of CANDIDATE_VIDEO_CODECS) {
    try {
      const res = await VideoEncoder.isConfigSupported({
        codec,
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        bitrate: 2_200_000,
        framerate: FPS,
      });
      if (res?.supported) return codec;
    } catch (_) {}
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// POINT D ENTREE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export async function generateWhatsAppStatusVideo({
  book,
  chapter,
  audioElement,
  startTime = 0,
  duration = 15,
  quoteText = '',
  onProgress = () => {},
  signal,
  isBackground = false,
}) {
  if (!book) throw new Error('Aucun livre specifie pour la generation');

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d', { alpha: false });

  // 1. Pre-chargement CORS-safe de la pochette
  const coverImg = await loadSafeImage(book.cover_url);

  // 2. Positionnement audio et capture du flux
  let audioStream = null;
  if (audioElement && !isBackground) {
    try {
      if (typeof startTime === 'number' && Math.abs(audioElement.currentTime - startTime) > 0.4) {
        audioElement.currentTime = startTime;
        await new Promise((res) => {
          const s = () => { audioElement.removeEventListener('seeked', s); res(); };
          audioElement.addEventListener('seeked', s);
          setTimeout(res, 700);
        });
      }
      if (audioElement.paused) await audioElement.play().catch(() => {});
    } catch (_) {}

    try {
      const captureMethod = audioElement.captureStream
        ? 'captureStream'
        : audioElement.mozCaptureStream
          ? 'mozCaptureStream'
          : null;
      if (captureMethod) {
        const rawStream = audioElement[captureMethod]();
        const clonedStream = new MediaStream();
        rawStream.getAudioTracks().forEach(t => clonedStream.addTrack(t.clone()));
        audioStream = clonedStream;
      }
    } catch (e) {
      console.warn('[StatusGenerator] captureStream:', e);
      audioStream = null;
    }
  }

  // 3. Choix du moteur d encodage
  const selectedVideoCodec = await detectWebCodecsVideoSupport();

  if (selectedVideoCodec) {
    try {
      return await recordWithWebCodecs({
        canvas, ctx, coverImg, book, chapter,
        audioStream, duration, quoteText, onProgress, signal,
        videoCodec: selectedVideoCodec,
      });
    } catch (webCodecsErr) {
      console.warn('[StatusGenerator] WebCodecs echec, repli MediaRecorder:', webCodecsErr);
    }
  }

  // 4. Repli MediaRecorder (uniquement si WebCodecs absent)
  if (typeof MediaRecorder !== 'undefined') {
    return await recordWithMediaRecorder({
      canvas, ctx, coverImg, book, chapter,
      audioStream, duration, quoteText, onProgress, signal,
    });
  }

  throw new Error("L'enregistrement video n'est pas supporte sur ce navigateur");
}

// ─────────────────────────────────────────────────────────────────────────────
// MOTEUR PRINCIPAL : WebCodecs + mp4-muxer (Vrai MP4 H.264 + AAC)
// ─────────────────────────────────────────────────────────────────────────────
async function recordWithWebCodecs({
  canvas, ctx, coverImg, book, chapter, audioStream, duration, quoteText, onProgress, signal, videoCodec,
}) {
  const totalMs = duration * 1000;
  const totalFrames = Math.round(duration * FPS);
  const hasQuote = Boolean(quoteText?.trim());
  const audioTrack = audioStream?.getAudioTracks()?.[0] ?? null;

  // 1. Configuration mp4-muxer
  const muxerOpts = {
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: CANVAS_WIDTH, height: CANVAS_HEIGHT, frameRate: FPS },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  };

  // On ajoute la piste audio uniquement si le materiel peut encoder AAC
  const canEncodeAudio = audioTrack && await isAacEncodingSupported();
  if (canEncodeAudio) {
    muxerOpts.audio = { codec: 'aac', numberOfChannels: AUDIO_CHANNELS, sampleRate: AUDIO_SAMPLE_RATE };
  }

  const muxer = new Muxer(muxerOpts);

  // 2. VideoEncoder H.264
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error('[VideoEncoder]', e),
  });
  videoEncoder.configure({
    codec: videoCodec,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    bitrate: 2_200_000,
    framerate: FPS,
  });

  // 3. AudioEncoder AAC f32-planar (module dedie)
  let audioHandle = null;
  if (canEncodeAudio) {
    audioHandle = await createStatusAudioEncoder({ audioTrack, muxer });
  }

  // 4. Boucle de rendu frame par frame
  for (let f = 0; f < totalFrames; f++) {
    if (signal?.aborted) throw new DOMException('Annule', 'AbortError');

    const elapsedMs = f * (1000 / FPS);
    drawStatusFrame(ctx, { elapsedMs, targetDurationMs: totalMs, duration, coverImg, book, chapter, quoteText, hasQuote });

    const ts = Math.round(f * (1_000_000 / FPS));
    const vf = new VideoFrame(canvas, { timestamp: ts });
    videoEncoder.encode(vf, { keyFrame: f % 60 === 0 });
    vf.close();

    onProgress(Math.round((f / totalFrames) * 100), Math.min(elapsedMs / 1000, duration));
    if (f % 10 === 0) await new Promise(r => setTimeout(r, 0));
  }

  // 5. Finalisation
  await videoEncoder.flush();
  if (audioHandle) await audioHandle.finish();
  muxer.finalize();

  const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
  const cleanTitle = (book.title || 'audiobook').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const file = new File([blob], `statut_rgplay_${cleanTitle}.mp4`, { type: 'video/mp4' });
  return { file, blob, url: URL.createObjectURL(blob) };
}

// ─────────────────────────────────────────────────────────────────────────────
// REPLI : MediaRecorder (Safari iOS uniquement, ou navigateur sans WebCodecs)
// ─────────────────────────────────────────────────────────────────────────────
async function recordWithMediaRecorder({
  canvas, ctx, coverImg, book, chapter, audioStream, duration, quoteText, onProgress, signal,
}) {
  // Ordre de preference : MP4 natif d abord, WebM seulement en dernier recours
  const MIME_CANDIDATES = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=h264,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];

  const recorderOptions = { videoBitsPerSecond: 2_500_000 };
  let selectedMime = '';
  for (const t of MIME_CANDIDATES) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
      selectedMime = t;
      recorderOptions.mimeType = t;
      break;
    }
  }

  const canvasStream = canvas.captureStream(FPS);
  const combinedStream = new MediaStream();
  canvasStream.getVideoTracks().forEach(t => combinedStream.addTrack(t));

  const audioTrack = audioStream?.getAudioTracks()?.[0];
  if (audioTrack) combinedStream.addTrack(audioTrack);

  const recorder = new MediaRecorder(combinedStream, recorderOptions);
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };

  return new Promise((resolve, reject) => {
    let animId = null;
    const startTime = performance.now();
    const targetDurationMs = duration * 1000;
    const hasQuote = Boolean(quoteText?.trim());

    const cleanup = () => {
      if (animId) cancelAnimationFrame(animId);
      try { canvasStream.getTracks().forEach(t => t.stop()); } catch (_) {}
    };

    recorder.onstop = () => {
      cleanup();
      // Detecter le VRAI format produit par le navigateur
      const realMime = recorder.mimeType || selectedMime || 'video/webm';
      const isRealMp4 = realMime.includes('mp4') && !realMime.includes('webm');
      const ext = isRealMp4 ? 'mp4' : 'webm';
      const outputMime = isRealMp4 ? 'video/mp4' : 'video/webm';

      const cleanTitle = (book.title || 'audiobook').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const blob = new Blob(chunks, { type: outputMime });
      const file = new File([blob], `statut_rgplay_${cleanTitle}.${ext}`, { type: outputMime });

      if (!isRealMp4) {
        console.warn(
          '[StatusGenerator] ATTENTION : Le navigateur a produit un fichier WebM, pas MP4.',
          'WhatsApp peut refuser ce fichier. Utilisez Chrome ou Edge sur PC pour un vrai MP4.'
        );
      }

      resolve({ file, blob, url: URL.createObjectURL(blob), isWebmFallback: !isRealMp4 });
    };

    recorder.onerror = (e) => { cleanup(); reject(e); };

    if (signal) {
      signal.addEventListener('abort', () => {
        cleanup();
        if (recorder.state !== 'inactive') recorder.stop();
        reject(new DOMException('Annule', 'AbortError'));
      });
    }

    recorder.start(100);

    const loop = (now) => {
      const elapsedMs = now - startTime;
      drawStatusFrame(ctx, { elapsedMs, targetDurationMs, duration, coverImg, book, chapter, quoteText, hasQuote });
      onProgress(Math.min(100, Math.round((elapsedMs / targetDurationMs) * 100)), Math.min(elapsedMs / 1000, duration));

      if (elapsedMs >= targetDurationMs) {
        if (recorder.state !== 'inactive') recorder.stop();
        return;
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
  });
}

/** Alias public pour dessiner une frame unique (usage arriere-plan) */
export { drawStatusFrame as drawStatusFramePublic };
