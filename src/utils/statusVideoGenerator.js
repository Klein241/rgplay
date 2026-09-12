/**
 * Moteur de rendu Vidéo Statut WhatsApp / Story (9:16 - 720x1280)
 * H.264 + AAC via WebCodecs + mp4-muxer → MP4 natif WhatsApp-compatible
 */

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  loadSafeImage,
  drawStatusFrame,
} from './statusCanvasRenderer';

const FPS = 30;
const AUDIO_SAMPLE_RATE = 44100;
const AUDIO_CHANNELS = 2;

/**
 * Générateur principal de statut WhatsApp
 */
export async function generateWhatsAppStatusVideo({
  book, chapter, audioElement, startTime = 0, duration = 15,
  quoteText = '', onProgress = () => {}, signal, isBackground = false,
}) {
  if (!book) throw new Error('Aucun livre spécifié pour la génération');

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d', { alpha: false });

  // 1. Pré-chargement de la pochette
  const coverImg = await loadSafeImage(book.cover_url);
  let audioStream = null;

  // 3. Détection WebCodecs complète (vidéo + audio)
  const hasWebCodecs = typeof window !== 'undefined' &&
    typeof window.VideoEncoder === 'function' &&
    typeof window.AudioEncoder === 'function' &&
    typeof window.VideoFrame === 'function';

  // 4. Préparation audio (uniquement si ce n'est pas un encodage silencieux d'arrière-plan)
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
  }

  // 5. Capture du flux audio
  if (audioElement) {
    try {
      if (typeof audioElement.captureStream === 'function') {
        audioStream = audioElement.captureStream();
      } else if (typeof audioElement.mozCaptureStream === 'function') {
        audioStream = audioElement.mozCaptureStream();
      }
    } catch (e) {
      console.warn('[StatusGenerator] captureStream:', e);
    }
  }

  // 6. Exécution : MediaRecorder en priorité (encodage synchrone matériel AV natif sans dépréciation)
  if (typeof MediaRecorder !== 'undefined') {
    try {
      return await recordWithMediaRecorder({
        canvas, ctx, coverImg, book, chapter, audioStream, duration, quoteText, onProgress, signal,
      });
    } catch (mediaRecorderErr) {
      console.warn('[StatusGenerator] MediaRecorder échoué, repli WebCodecs:', mediaRecorderErr);
    }
  }

  if (hasWebCodecs) {
    return await recordWithWebCodecs({
      canvas, ctx, coverImg, book, chapter, audioStream, duration, quoteText, onProgress, signal,
    });
  }

  throw new Error("L'enregistrement vidéo n'est pas supporté sur ce navigateur");
}



/**
 * Encodage MP4 H.264 + AAC via WebCodecs et MP4-Muxer
 */
async function recordWithWebCodecs({
  canvas, ctx, coverImg, book, chapter, audioStream, duration, quoteText, onProgress, signal
}) {
  const totalMs = duration * 1000;
  const totalFrames = Math.round(duration * FPS);
  const hasQuote = Boolean(quoteText?.trim());
  const audioTrack = audioStream?.getAudioTracks()?.[0];

  const muxerOpts = {
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: CANVAS_WIDTH, height: CANVAS_HEIGHT, frameRate: FPS },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  };
  if (audioTrack) {
    muxerOpts.audio = { codec: 'aac', numberOfChannels: AUDIO_CHANNELS, sampleRate: AUDIO_SAMPLE_RATE };
  }

  const muxer = new Muxer(muxerOpts);

  // Encodeur vidéo H.264
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: e => console.error('[VideoEncoder]', e),
  });
  videoEncoder.configure({
    codec: 'avc1.42001f',
    width: CANVAS_WIDTH, height: CANVAS_HEIGHT,
    bitrate: 2_200_000, framerate: FPS,
  });

  // Encodeur audio AAC
  let audioEncoder = null;
  let audioCtx = null;
  let scriptNode = null;
  if (audioTrack) {
    try {
      audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
        error: e => console.warn('[AudioEncoder]', e),
      });
      audioEncoder.configure({
        codec: 'mp4a.40.2', // AAC-LC
        numberOfChannels: AUDIO_CHANNELS,
        sampleRate: AUDIO_SAMPLE_RATE,
        bitrate: 128_000,
      });

      audioCtx = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
      const srcNode = audioCtx.createMediaStreamSource(new MediaStream([audioTrack]));
      let audioTs = 0;
      let audioProcessErrorLogged = false;
      scriptNode = audioCtx.createScriptProcessor(4096, AUDIO_CHANNELS, AUDIO_CHANNELS);
      scriptNode.onaudioprocess = (ev) => {
        try {
          if (audioEncoder?.state !== 'configured') return;
          const chL = ev.inputBuffer.getChannelData(0);
          const chR = ev.inputBuffer.getChannelData(1);
          const frames = chL.length;
          const interleaved = new Float32Array(frames * AUDIO_CHANNELS);
          for (let i = 0; i < frames; i++) {
            interleaved[i * 2] = chL[i];
            interleaved[i * 2 + 1] = chR[i];
          }
          const ad = new AudioData({
            format: 'f32',
            sampleRate: AUDIO_SAMPLE_RATE,
            numberOfFrames: frames,
            numberOfChannels: AUDIO_CHANNELS,
            timestamp: audioTs,
            data: interleaved,
          });
          audioEncoder.encode(ad);
          ad.close();
          audioTs += Math.round((frames / AUDIO_SAMPLE_RATE) * 1_000_000);
        } catch (e) {
          if (!audioProcessErrorLogged) {
            audioProcessErrorLogged = true;
            console.warn('[AudioProcess] WebCodecs AudioData non supporté sur ce navigateur, repli muet:', e?.message || e);
          }
          try { scriptNode.disconnect(); } catch (_) {}
        }
      };
      srcNode.connect(scriptNode);
      const muteGain = audioCtx.createGain();
      muteGain.gain.value = 0;
      scriptNode.connect(muteGain);
      muteGain.connect(audioCtx.destination);
    } catch (ae) {
      console.warn('[StatusGen] AudioEncoder setup échoué:', ae);
      audioEncoder = null;
    }
  }

  // Boucle d'encodage vidéo
  for (let f = 0; f < totalFrames; f++) {
    if (signal?.aborted) throw new DOMException('Annulé', 'AbortError');
    const elapsedMs = f * (1000 / FPS);
    drawStatusFrame(ctx, { elapsedMs, targetDurationMs: totalMs, duration, coverImg, book, chapter, quoteText, hasQuote });
    const ts = Math.round(f * (1_000_000 / FPS));
    const vf = new VideoFrame(canvas, { timestamp: ts });
    videoEncoder.encode(vf, { keyFrame: f % 60 === 0 });
    vf.close();
    onProgress(Math.round((f / totalFrames) * 100), Math.min(elapsedMs / 1000, duration));
    if (f % 10 === 0) await new Promise(r => setTimeout(r, 0));
  }

  await videoEncoder.flush();
  if (audioEncoder) { try { await audioEncoder.flush(); } catch (_) {} }
  if (scriptNode) { try { scriptNode.disconnect(); } catch (_) {} }
  if (audioCtx) { try { await audioCtx.close(); } catch (_) {} }

  muxer.finalize();

  const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
  const cleanTitle = (book.title || 'audiobook').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const file = new File([blob], `statut_rgplay_${cleanTitle}.mp4`, { type: 'video/mp4' });
  return { file, blob, url: URL.createObjectURL(blob) };
}

/**
 * Repli standard MediaRecorder
 */
async function recordWithMediaRecorder({
  canvas, ctx, coverImg, book, chapter, audioStream, duration, quoteText, onProgress, signal
}) {
  const types = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
  const recorderOptions = { videoBitsPerSecond: 2500000 };
  let selectedMime = '';
  for (const t of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
      selectedMime = t;
      recorderOptions.mimeType = t;
      break;
    }
  }

  const canvasStream = canvas.captureStream(30);
  const combinedStream = new MediaStream();
  canvasStream.getVideoTracks().forEach(t => combinedStream.addTrack(t));

  const audioTrack = audioStream?.getAudioTracks()?.[0];
  if (audioTrack) {
    combinedStream.addTrack(audioTrack);
  }

  const recorder = new MediaRecorder(combinedStream, recorderOptions);

  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  return new Promise((resolve, reject) => {
    let animId = null;
    const startTime = performance.now();
    const targetDurationMs = duration * 1000;
    const hasQuote = Boolean(quoteText && quoteText.trim());

    const cleanup = () => {
      if (animId) cancelAnimationFrame(animId);
      try { canvasStream.getTracks().forEach(t => t.stop()); } catch (_) {}
    };

    recorder.onstop = () => {
      cleanup();
      const outputMime = recorder.mimeType || selectedMime || 'video/mp4';
      const blob = new Blob(chunks, { type: outputMime });
      const cleanTitle = (book.title || 'audiobook').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
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

/**
 * Alias public pour pouvoir dessiner une frame unique (usage arrière-plan)
 */
export { drawStatusFrame as drawStatusFramePublic };
