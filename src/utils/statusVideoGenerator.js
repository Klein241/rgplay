/**
 * statusVideoGenerator.js
 * Moteur de rendu Vidéo Statut WhatsApp / Story RG Play (9:16 - 720x1280 ou 540x960).
 * Produit un MP4 ISO standard (H.264 / AVC + AAC) compatible 100% WhatsApp.
 *
 * ARCHITECTURE MODULAIRE :
 * - statusCanvasRenderer.js : Rendu graphique 2D & anti-taint ImageBitmap
 * - statusAudioExtractor.js  : Extraction PCM numérique directe (0 ms de son audible)
 * - statusAudioEncoder.js    : Encodage AAC f32-planar avec détection dynamique
 * - statusVideoGenerator.js   : Orchestration WebCodecs + mp4-muxer + repli iOS MP4
 */

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  loadSafeImage,
  drawStatusFrame,
} from './statusCanvasRenderer';
import { extractAudioSlice } from './statusAudioExtractor';
import { detectAacConfig, encodePcmSliceToAac } from './statusAudioEncoder';

const FPS = 30;

/**
 * Profils H.264 par ordre de priorité pour mobile & desktop
 */
const CANDIDATE_H264_CODECS = [
  'avc1.42001f', // Baseline 3.1
  'avc1.420028', // Baseline 4.0 (très répandu sur smartphones Android)
  'avc1.4d001f', // Main 3.1
  'avc1.4d0028', // Main 4.0
  'avc1.420020', // Baseline 3.2
  'avc1.420029', // Baseline 4.1
  'avc1.42E01F', // Constrained Baseline 3.1
  'avc1.64001f', // High 3.1
  'avc1.640028', // High 4.0
];

/**
 * Détecte la configuration optimale pour VideoEncoder H.264 (720p avec repli 540p)
 */
async function detectVideoEncoderConfig() {
  if (
    typeof window === 'undefined' ||
    typeof window.VideoEncoder !== 'function' ||
    typeof window.VideoFrame !== 'function'
  ) {
    return null;
  }

  const RESOLUTIONS = [
    { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, bitrate: 2_200_000 },
    { width: 540, height: 960, bitrate: 1_400_000 }, // Repli qHD si le processeur mobile bloque le 720p portrait
  ];

  for (const res of RESOLUTIONS) {
    for (const codec of CANDIDATE_H264_CODECS) {
      for (const hw of ['prefer-hardware', 'prefer-software', 'no-preference']) {
        try {
          const config = {
            codec,
            width: res.width,
            height: res.height,
            bitrate: res.bitrate,
            framerate: FPS,
            hardwareAcceleration: hw,
          };
          const supported = await VideoEncoder.isConfigSupported(config);
          if (supported?.supported) {
            return {
              codec,
              width: res.width,
              height: res.height,
              bitrate: res.bitrate,
              hardwareAcceleration: hw,
            };
          }
        } catch (_) {}
      }
    }
  }

  return null;
}

/**
 * Génère une vidéo MP4 authentique pour Statut WhatsApp
 */
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
  if (!book) throw new Error('Aucun livre spécifié pour la génération');

  // 1. Détection du support H.264 WebCodecs
  const videoConfig = await detectVideoEncoderConfig();

  // 2. Préparation du canvas frais (zéro contamination)
  const width = videoConfig?.width || CANVAS_WIDTH;
  const height = videoConfig?.height || CANVAS_HEIGHT;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });

  // 3. Pré-chargement sécurisé de la pochette (Blob / ImageBitmap)
  const coverImg = await loadSafeImage(book.cover_url, book.cover_r2_key);

  // 4. Extraction numérique propre de la piste audio
  let audioSlice = null;
  if (!isBackground) {
    onProgress(5, 0);
    try {
      audioSlice = await extractAudioSlice({ book, chapter, audioElement, startTime, duration });
    } catch (audioErr) {
      console.warn('[StatusGenerator] Extraction audio ignorée:', audioErr);
      audioSlice = null;
    }
  }

  // 5. Moteur Prioritaire : WebCodecs H.264 + mp4-muxer (MP4 universel)
  if (videoConfig) {
    try {
      return await recordWithWebCodecs({
        canvas,
        ctx,
        coverImg,
        book,
        chapter,
        audioSlice,
        duration,
        quoteText,
        onProgress,
        signal,
        videoConfig,
      });
    } catch (wcErr) {
      console.error('[StatusGenerator] Échec WebCodecs:', wcErr);
      // Ne pas propager aveuglément : tester le repli iOS MP4
    }
  }

  // 6. Moteur de repli : MediaRecorder STRICTEMENT MP4 (Safari iOS)
  if (typeof MediaRecorder !== 'undefined') {
    const isMp4Supported =
      MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2') ||
      MediaRecorder.isTypeSupported('video/mp4;codecs=avc1') ||
      MediaRecorder.isTypeSupported('video/mp4');

    if (isMp4Supported) {
      console.info('[StatusGenerator] Encodage MP4 natif via MediaRecorder (iOS Safari).');
      return await recordWithMediaRecorder({
        canvas,
        ctx,
        coverImg,
        book,
        chapter,
        audioElement,
        startTime,
        duration,
        quoteText,
        onProgress,
        signal,
      });
    }
  }

  // Si ni WebCodecs H.264 ni MediaRecorder MP4 ne sont disponibles
  throw new Error(
    "Votre navigateur ne supporte pas l'encodage vidéo MP4 requis par WhatsApp. " +
    "Veuillez mettre à jour Google Chrome sur votre smartphone ou utiliser un navigateur moderne."
  );
}

/**
 * Enregistre la vidéo avec WebCodecs et mp4-muxer (vrai MP4 H.264 + AAC)
 */
async function recordWithWebCodecs({
  canvas,
  ctx,
  coverImg,
  book,
  chapter,
  audioSlice,
  duration,
  quoteText,
  onProgress,
  signal,
  videoConfig,
}) {
  const totalMs = duration * 1000;
  const totalFrames = Math.round(duration * FPS);
  const hasQuote = Boolean(quoteText?.trim());

  // Détecter si l'encodage AAC est supporté
  const aacConfig = audioSlice ? await detectAacConfig(audioSlice.sampleRate) : null;
  const hasAudio = Boolean(audioSlice && aacConfig);

  // Configuration du multiplexeur MP4 ISO
  const muxerOpts = {
    target: new ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width: videoConfig.width,
      height: videoConfig.height,
      frameRate: FPS,
    },
    fastStart: 'in-memory', // Positionne le 'moov' atom au début du fichier (obligatoire WhatsApp)
    firstTimestampBehavior: 'offset',
  };

  if (hasAudio) {
    muxerOpts.audio = {
      codec: 'aac',
      numberOfChannels: aacConfig.numberOfChannels,
      sampleRate: aacConfig.sampleRate,
    };
  }

  const muxer = new Muxer(muxerOpts);

  // Configuration de l'encodeur vidéo H.264
  let videoEncoderError = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      videoEncoderError = e;
      console.error('[StatusGenerator] Erreur VideoEncoder H.264:', e);
    },
  });

  videoEncoder.configure({
    codec: videoConfig.codec,
    width: videoConfig.width,
    height: videoConfig.height,
    bitrate: videoConfig.bitrate,
    framerate: FPS,
    hardwareAcceleration: videoConfig.hardwareAcceleration,
  });

  // Rendu et encodage image par image
  for (let f = 0; f < totalFrames; f++) {
    if (signal?.aborted) throw new DOMException('Annulé', 'AbortError');
    if (videoEncoderError) throw videoEncoderError;

    const elapsedMs = f * (1000 / FPS);
    drawStatusFrame(ctx, {
      elapsedMs,
      targetDurationMs: totalMs,
      duration,
      coverImg,
      book,
      chapter,
      quoteText,
      hasQuote,
    });

    const tsUs = Math.round(f * (1_000_000 / FPS));
    const vf = new VideoFrame(canvas, { timestamp: tsUs });

    try {
      videoEncoder.encode(vf, { keyFrame: f % 60 === 0 });
    } finally {
      vf.close();
    }

    const pct = Math.round((f / totalFrames) * 85);
    onProgress(pct, Math.min(elapsedMs / 1000, duration));

    if (f % 12 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  if (videoEncoderError) throw videoEncoderError;

  // Encodage de la piste audio AAC si présente
  if (hasAudio) {
    onProgress(90, duration);
    try {
      await encodePcmSliceToAac({
        pcmChannels: audioSlice.pcmChannels,
        sampleRate: aacConfig.sampleRate,
        muxer,
      });
    } catch (audioEncErr) {
      console.warn('[StatusGenerator] Échec encodage AAC:', audioEncErr);
    }
  }

  onProgress(96, duration);
  await videoEncoder.flush();
  videoEncoder.close();
  muxer.finalize();

  const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
  const cleanTitle = (book.title || 'audiobook').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const file = new File([blob], `statut_rgplay_${cleanTitle}.mp4`, { type: 'video/mp4' });

  onProgress(100, duration);
  console.info(`[StatusGenerator] MP4 généré avec succès (${(blob.size / 1024).toFixed(0)} Ko, ${duration}s)`);
  return { file, blob, url: URL.createObjectURL(blob) };
}

/**
 * Moteur de repli MediaRecorder MP4 (uniquement si le conteneur est un vrai MP4, ex: Safari iOS)
 */
async function recordWithMediaRecorder({
  canvas,
  ctx,
  coverImg,
  book,
  chapter,
  audioElement,
  startTime,
  duration,
  quoteText,
  onProgress,
  signal,
}) {
  const MIME_MP4 = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4',
  ].find((m) => MediaRecorder.isTypeSupported(m));

  if (!MIME_MP4) {
    throw new Error('MediaRecorder MP4 non supporté.');
  }

  const canvasStream = canvas.captureStream(FPS);
  const combinedStream = new MediaStream();
  canvasStream.getVideoTracks().forEach((t) => combinedStream.addTrack(t));

  // Capture audio temps réel si l'élément audio est fourni
  if (audioElement && typeof audioElement.captureStream === 'function') {
    try {
      if (typeof startTime === 'number' && Math.abs(audioElement.currentTime - startTime) > 0.4) {
        audioElement.currentTime = startTime;
      }
      if (audioElement.paused) await audioElement.play().catch(() => {});
      const aStream = audioElement.captureStream();
      const aTrack = aStream.getAudioTracks()?.[0];
      if (aTrack) combinedStream.addTrack(aTrack);
    } catch (_) {}
  }

  const recorder = new MediaRecorder(combinedStream, {
    mimeType: MIME_MP4,
    videoBitsPerSecond: 2_200_000,
  });

  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };

  return new Promise((resolve, reject) => {
    let animId = null;
    const startPerf = performance.now();
    const targetMs = duration * 1000;
    const hasQuote = Boolean(quoteText?.trim());

    const cleanup = () => {
      if (animId) cancelAnimationFrame(animId);
      try { canvasStream.getTracks().forEach((t) => t.stop()); } catch (_) {}
    };

    recorder.onstop = () => {
      cleanup();
      const cleanTitle = (book.title || 'audiobook').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const blob = new Blob(chunks, { type: 'video/mp4' });
      const file = new File([blob], `statut_rgplay_${cleanTitle}.mp4`, { type: 'video/mp4' });
      resolve({ file, blob, url: URL.createObjectURL(blob) });
    };

    recorder.onerror = (e) => { cleanup(); reject(e); };

    if (signal) {
      signal.addEventListener('abort', () => {
        cleanup();
        if (recorder.state !== 'inactive') recorder.stop();
        reject(new DOMException('Annulé', 'AbortError'));
      });
    }

    recorder.start(100);

    const loop = (now) => {
      const elapsedMs = now - startPerf;
      drawStatusFrame(ctx, {
        elapsedMs,
        targetDurationMs: targetMs,
        duration,
        coverImg,
        book,
        chapter,
        quoteText,
        hasQuote,
      });

      onProgress(
        Math.min(100, Math.round((elapsedMs / targetMs) * 100)),
        Math.min(elapsedMs / 1000, duration)
      );

      if (elapsedMs >= targetMs) {
        if (recorder.state !== 'inactive') recorder.stop();
        return;
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
  });
}

/** Alias public pour dessiner une frame unique (usage arrière-plan) */
export { drawStatusFrame as drawStatusFramePublic };
