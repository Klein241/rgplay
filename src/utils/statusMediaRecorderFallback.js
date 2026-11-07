/**
 * statusMediaRecorderFallback.js
 * Moteur de repli MediaRecorder MP4 (utilisé principalement sur Safari iOS si WebCodecs est absent).
 * Respect strict de AGENTS.md (< 400 lignes).
 */

import { drawStatusFrame, createStaticBackground } from './statusCanvasRenderer';

export async function recordWithMediaRecorder({
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
  fps = 15,
}) {
  const MIME_MP4 = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4',
  ].find((m) => MediaRecorder.isTypeSupported(m));

  if (!MIME_MP4) {
    throw new Error('MediaRecorder MP4 non supporté.');
  }

  const canvasStream = canvas.captureStream(fps);
  const combinedStream = new MediaStream();
  canvasStream.getVideoTracks().forEach((t) => combinedStream.addTrack(t));

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
    videoBitsPerSecond: 1_200_000,
  });

  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };

  const hasQuote = Boolean(quoteText?.trim());
  const staticBg = createStaticBackground({
    coverImg,
    book,
    quoteText,
    hasQuote,
    targetWidth: canvas.width,
    targetHeight: canvas.height,
  });

  const eqBaseY = hasQuote ? 960 : 890;
  const cachedGrad = ctx.createLinearGradient(0, eqBaseY - 50, 0, eqBaseY + 50);
  cachedGrad.addColorStop(0, '#34d399');
  cachedGrad.addColorStop(0.5, '#22d3ee');
  cachedGrad.addColorStop(1, '#10b981');

  return new Promise((resolve, reject) => {
    let animId = null;
    const startPerf = performance.now();
    const targetMs = duration * 1000;

    const cleanup = () => {
      if (animId) cancelAnimationFrame(animId);
      try { canvasStream.getTracks().forEach((t) => t.stop()); } catch (_) {}
      staticBg.width = 1;
      staticBg.height = 1;
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
        staticBg,
        elapsedMs,
        targetDurationMs: targetMs,
        duration,
        hasQuote,
        cachedGrad,
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
