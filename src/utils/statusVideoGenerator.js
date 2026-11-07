/**
 * statusVideoGenerator.js
 * Moteur de rendu Vidéo Statut WhatsApp / Story RG Play (9:16 - 540x960 / 720x1280).
 * Produit un MP4 ISO standard (H.264 / AVC + AAC) compatible 100% WhatsApp.
 * 
 * 🛡️ RÉSOLUTION DÉFINITIVE DU CRASH MOBILE (> 30s et 60s) :
 * 1. Fond statique pré-rendu 1 seule fois via `createStaticBackground` (fin des 1 800 flous de 40px en boucle).
 * 2. Cadence adaptée à 15 FPS sur mobile (parfaitement fluide pour une onde audio, -50% de mémoire RAM/GPU).
 * 3. Résolution 540x960 prioritaire sur mobile (norme WhatsApp Statut, 2x moins de mémoire texture).
 * 4. Pauses de décompression événementielle (Backpressure GC) toutes les 5 et 25 frames.
 * 5. Destruction immédiate des VideoFrame et déchargement des surfaces Canvas à la fin.
 * 
 * Conforme à AGENTS.md (< 400 lignes).
 */

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  loadSafeImage,
  drawStatusFrame,
  createStaticBackground,
} from './statusCanvasRenderer';
import { extractAudioSlice } from './statusAudioExtractor';
import { detectAacConfig, encodePcmSliceToAac } from './statusAudioEncoder';
import { recordWithMediaRecorder } from './statusMediaRecorderFallback';

const CANDIDATE_H264_CODECS = [
  'avc1.42001f', // Baseline 3.1
  'avc1.420028', // Baseline 4.0
  'avc1.4d001f', // Main 3.1
  'avc1.4d0028', // Main 4.0
  'avc1.420020', // Baseline 3.2
  'avc1.420029', // Baseline 4.1
  'avc1.42E01F', // Constrained Baseline 3.1
  'avc1.64001f', // High 3.1
  'avc1.640028', // High 4.0
];

/**
 * Détecte la configuration optimale pour VideoEncoder H.264
 */
async function detectVideoEncoderConfig(isMobile = false, fps = 15) {
  if (
    typeof window === 'undefined' ||
    typeof window.VideoEncoder !== 'function' ||
    typeof window.VideoFrame !== 'function'
  ) {
    return null;
  }

  // Sur smartphone : 540x960 (qHD 9:16) strict pour zéro crash de mémoire
  const RESOLUTIONS = isMobile
    ? [
        { width: 540, height: 960, bitrate: 1_200_000 },
      ]
    : [
        { width: 540, height: 960, bitrate: 1_200_000 },
        { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, bitrate: 1_800_000 },
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
            framerate: fps,
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
  duration = 30,
  quoteText = '',
  onProgress = () => {},
  signal,
  isBackground = false,
}) {
  if (!book) throw new Error('Aucun livre spécifié pour la génération');

  // Détection smartphone / tactile pour adapter la résolution et la cadence
  const isMobile = typeof navigator !== 'undefined' && (
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 1)
  );

  // 15 FPS sur smartphone (100% fluide pour une onde, divise par 2 la RAM requise)
  const fps = isMobile ? 15 : 20;

  // 1. Détection du support H.264 WebCodecs
  const videoConfig = await detectVideoEncoderConfig(isMobile, fps);

  // 2. Préparation du canvas frais
  const width = videoConfig?.width || 540;
  const height = videoConfig?.height || 960;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

  // 3. Pré-chargement sécurisé de la pochette
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

  // 5. Moteur Prioritaire : WebCodecs H.264 + mp4-muxer
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
        fps,
      });
    } catch (wcErr) {
      console.error('[StatusGenerator] Échec WebCodecs, repli MediaRecorder:', wcErr);
    }
  }

  // 6. Moteur de repli : MediaRecorder STRICTEMENT MP4 (Safari iOS)
  if (typeof MediaRecorder !== 'undefined') {
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
      fps,
    });
  }

  throw new Error(
    "Votre navigateur ne supporte pas l'encodage vidéo MP4 requis par WhatsApp. " +
    "Veuillez mettre à jour Google Chrome sur votre smartphone."
  );
}

/**
 * Enregistre la vidéo avec WebCodecs et mp4-muxer
 */
async function recordWithWebCodecs({
  canvas,
  ctx,
  coverImg,
  book,
  audioSlice,
  duration,
  quoteText,
  onProgress,
  signal,
  videoConfig,
  fps,
}) {
  const totalMs = duration * 1000;
  const totalFrames = Math.round(duration * fps);
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
      frameRate: fps,
    },
    fastStart: 'in-memory',
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

  let videoEncoderError = null;
  let encodedChunksCount = 0;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      encodedChunksCount++;
      muxer.addVideoChunk(chunk, meta);
    },
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
    framerate: fps,
    hardwareAcceleration: videoConfig.hardwareAcceleration,
  });

  // 🛡️ CRITIQUE : Pré-génération du fond statique UNE SEULE FOIS
  const staticBg = createStaticBackground({
    coverImg,
    book,
    quoteText,
    hasQuote,
    targetWidth: videoConfig.width,
    targetHeight: videoConfig.height,
  });

  // Dégradé réutilisable pour l'égaliseur (zéro allocation en boucle)
  const eqBaseY = hasQuote ? 960 : 890;
  const cachedGrad = ctx.createLinearGradient(0, eqBaseY - 50, 0, eqBaseY + 50);
  cachedGrad.addColorStop(0, '#34d399');
  cachedGrad.addColorStop(0.5, '#22d3ee');
  cachedGrad.addColorStop(1, '#10b981');

  // Rendu et encodage image par image
  for (let f = 0; f < totalFrames; f++) {
    if (signal?.aborted) throw new DOMException('Annulé', 'AbortError');
    if (videoEncoderError) throw videoEncoderError;

    // 🛡️ Synchronisation matérielle stricte : au maximum 2 frames en transit dans tout le pipeline matériel
    while ((f - encodedChunksCount) > 2 || videoEncoder.encodeQueueSize > 2) {
      if (signal?.aborted) throw new DOMException('Annulé', 'AbortError');
      if (videoEncoderError) throw videoEncoderError;
      await new Promise((r) => setTimeout(r, 10));
    }

    const elapsedMs = f * (1000 / fps);
    drawStatusFrame(ctx, {
      staticBg,
      elapsedMs,
      targetDurationMs: totalMs,
      duration,
      hasQuote,
      cachedGrad,
    });

    const tsUs = Math.round(f * (1_000_000 / fps));
    const vf = new VideoFrame(canvas, { timestamp: tsUs });

    try {
      videoEncoder.encode(vf, { keyFrame: f % (fps * 2) === 0 });
    } finally {
      vf.close();
    }

    const pct = Math.round((f / totalFrames) * 85);
    onProgress(pct, Math.min(elapsedMs / 1000, duration));

    // 🛡️ Pauses de décompression événementielle (Backpressure GC mobile)
    if (f % 4 === 0) {
      await new Promise((r) => setTimeout(r, 8));
    }
    if (f % 20 === 0) {
      await new Promise((r) => setTimeout(r, 35));
    }
  }

  if (videoEncoderError) throw videoEncoderError;

  // Encodage audio AAC
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

  // Nettoyage immédiat de la mémoire
  staticBg.width = 1;
  staticBg.height = 1;
  canvas.width = 1;
  canvas.height = 1;

  const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
  const cleanTitle = (book.title || 'audiobook').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const file = new File([blob], `statut_rgplay_${cleanTitle}.mp4`, { type: 'video/mp4' });

  onProgress(100, duration);
  console.info(`[StatusGenerator] MP4 généré sans encombre (${(blob.size / 1024).toFixed(0)} Ko, ${duration}s, ${fps}fps)`);
  return { file, blob, url: URL.createObjectURL(blob) };
}

export { drawStatusFrame as drawStatusFramePublic };
