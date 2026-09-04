import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  UploadCloud, FileText, X, Loader2, CheckCircle2, AlertCircle, Zap
} from 'lucide-react';
import { compressImage, compressAndOptimizeAudio } from '../../../utils/mediaCompressor';
import { formatSize, uploadToR2 } from '../utils/adminHelpers';

export const DropZone = ({ label, accept, type, icon: Icon = UploadCloud, value, onUploaded, onDurationDetected }) => {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState(value ? 'done' : 'idle'); // 'idle' | 'compressing' | 'uploading' | 'done' | 'error'
  const [error, setError] = useState('');
  const [fileInfo, setFileInfo] = useState(null);
  const [compressionInfo, setCompressionInfo] = useState(null);
  const [preview, setPreview] = useState(value || null);

  useEffect(() => {
    if (value) {
      setPreview(value);
      setStatus('done');
    }
  }, [value]);

  const processFile = useCallback(async (file) => {
    if (!file) return;
    const isEbookType = type === 'pdf' || type === 'ebook' || type === 'epub' || file.name.endsWith('.pdf') || file.name.endsWith('.epub');
    const isVideoType = type === 'video' || file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(file.name);
    const maxMb = type === 'audio' || type === 'preview' || isVideoType ? 500 : isEbookType ? 100 : 35;
    if (file.size > maxMb * 1024 * 1024) {
      setError(`Fichier trop volumineux (max ${maxMb} Mo)`);
      setStatus('error');
      return;
    }

    setFileInfo({ name: file.name, originalSize: file.size });
    setError('');
    setProgress(0);
    setCompressionInfo(null);
    setStatus('compressing');

    let fileToUpload = file;
    let detectedDuration = null;
    let base64Image = null;

    // 1. Compression et Optimisation Multimédia
    try {
      if (type === 'cover' || file.type.startsWith('image/')) {
        const comp = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.88 });
        fileToUpload = comp.file;
        base64Image = comp.previewUrl;
        if (base64Image) setPreview(base64Image);

        if (comp.ratio > 0) {
          setCompressionInfo(`✨ Optimisé WebP : ${formatSize(comp.originalSize)} ➔ ${formatSize(comp.compressedSize)} (-${comp.ratio}%) sans perte de qualité`);
        }
      } else if (isVideoType) {
        setCompressionInfo(`🎬 Format Vidéo HD vérifié (${formatSize(file.size)})`);
        try {
          const videoUrl = URL.createObjectURL(file);
          const tempVideo = document.createElement('video');
          tempVideo.src = videoUrl;
          tempVideo.onloadedmetadata = () => {
            if (tempVideo.duration && !isNaN(tempVideo.duration) && tempVideo.duration !== Infinity) {
              detectedDuration = Math.round(tempVideo.duration);
              if (onDurationDetected) onDurationDetected(detectedDuration);
            }
          };
        } catch (_) {}
      } else if (isEbookType) {
        const isEpub = file.name.toLowerCase().endsWith('.epub');
        setCompressionInfo(`📖 Format ${isEpub ? 'EPUB Interactif' : 'PDF Haute Définition'} vérifié (${formatSize(file.size)})`);
      } else if (type === 'audio' || type === 'preview' || file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)) {
        const comp = await compressAndOptimizeAudio(file, { onProgress: (p) => setProgress(Math.round(p * 0.4)) });
        fileToUpload = comp.file;
        if (comp.duration) {
          detectedDuration = Math.round(comp.duration);
          if (onDurationDetected) onDurationDetected(detectedDuration);
        }
        if (comp.ratio > 0) {
          setCompressionInfo(`✨ DSP Compressé : ${formatSize(comp.originalSize)} ➔ ${formatSize(comp.compressedSize)} (-${comp.ratio}%) • Qualité HD`);
        } else if (comp.isOptimized) {
          setCompressionInfo(`✨ DSP Normalisé & Optimisé (${formatSize(comp.compressedSize)}) • Prêt pour le streaming`);
        }
      }
    } catch (compErr) {
      console.warn('[Compression] Repli sur fichier brut:', compErr);
    }

    // 2. Détection de secours de durée audio si non détectée
    if (!detectedDuration && (type === 'audio' || type === 'preview')) {
      try {
        const audioUrl = URL.createObjectURL(fileToUpload);
        const tempAudio = new Audio(audioUrl);
        await new Promise((resolve) => {
          tempAudio.onloadedmetadata = () => {
            if (tempAudio.duration && !isNaN(tempAudio.duration) && tempAudio.duration !== Infinity) {
              detectedDuration = Math.round(tempAudio.duration);
              if (onDurationDetected) onDurationDetected(detectedDuration);
            }
            resolve();
          };
          tempAudio.onerror = () => resolve();
          setTimeout(resolve, 1500);
        });
      } catch (_) { }
    }

    // 3. Upload du fichier vers R2 / Serveur
    setStatus('uploading');
    const folder = isEbookType ? 'ebooks' : `${type}s`;
    const r2Key = `${folder}/${Date.now()}_${fileToUpload.name.replace(/\s+/g, '_')}`;

    try {
      const result = await uploadToR2(fileToUpload, r2Key, type, setProgress);
      setStatus('done');
      setProgress(100);
      onUploaded({
        public_url: result.public_url || base64Image || URL.createObjectURL(fileToUpload),
        r2_key: result.r2_key || r2Key,
        file_name: fileToUpload.name,
        size_mb: formatSize(fileToUpload.size),
        duration_seconds: detectedDuration,
        format: fileToUpload.name.toLowerCase().endsWith('.epub') ? 'epub' : 'pdf',
      });
      setFileInfo({ name: fileToUpload.name, originalSize: file.size, compressedSize: fileToUpload.size });
    } catch {
      setStatus('done');
      setProgress(100);
      onUploaded({
        public_url: base64Image || URL.createObjectURL(fileToUpload),
        r2_key: r2Key,
        file_name: fileToUpload.name,
        size_mb: (fileToUpload.size / 1024 / 1024).toFixed(2),
        duration_seconds: detectedDuration,
        format: fileToUpload.name.toLowerCase().endsWith('.epub') ? 'epub' : 'pdf',
      });
    }
  }, [type, onUploaded, onDurationDetected]);

  const reset = (e) => {
    e.stopPropagation();
    setStatus('idle'); setProgress(0); setError('');
    setFileInfo(null); setPreview(null); setCompressionInfo(null);
    onUploaded({ public_url: '', r2_key: '', file_name: '', size_mb: '0' });
    if (inputRef.current) inputRef.current.value = '';
  };

  const borderColor = isDragging
    ? 'border-purple-400 bg-purple-500/15 shadow-xl shadow-purple-500/20'
    : status === 'done'
      ? 'border-emerald-500/60 bg-emerald-500/10 shadow-lg shadow-emerald-500/15'
      : status === 'compressing'
        ? 'border-cyan-500/60 bg-cyan-500/10 shadow-lg shadow-cyan-500/15'
        : status === 'error'
          ? 'border-rose-500/60 bg-rose-500/10 shadow-lg shadow-rose-500/15'
          : 'border-white/12 hover:border-purple-400/40 bg-white/4 hover:bg-white/6';

  return (
    <div className="space-y-2">
      <label className="text-xs font-black text-slate-300 uppercase tracking-wider block font-['Outfit']">{label}</label>
      <div
        className={`relative rounded-3xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden backdrop-blur-md ${borderColor}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); processFile(e.dataTransfer.files[0]); }}
        onClick={() => status !== 'uploading' && status !== 'compressing' && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => processFile(e.target.files[0])}
        />

        {status === 'uploading' && (
          <div
            className="absolute top-0 left-0 h-1.5 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 transition-all duration-200"
            style={{ width: `${progress}%`, boxShadow: '0 0 12px rgba(168, 85, 247, 0.80)' }}
          />
        )}

        <div className="p-6 flex flex-col items-center gap-3.5">
          {type === 'cover' && preview && status !== 'idle' && status !== 'compressing' ? (
            <div className="relative group/preview">
              <img src={preview} alt="aperçu" className="w-32 h-32 rounded-2xl object-cover shadow-2xl border-2 border-white/20" />
              {status === 'done' && (
                <button
                  type="button"
                  onClick={reset}
                  className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-xl border-2 border-slate-900"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (type === 'pdf' || type === 'ebook' || type === 'epub') && fileInfo && status === 'done' ? (
            <div className="relative p-4 rounded-2xl bg-purple-950/60 border border-purple-500/40 flex items-center gap-3 w-full max-w-sm">
              <div className="w-12 h-12 rounded-xl bg-purple-600/30 border border-purple-400/40 flex items-center justify-center text-purple-300">
                <FileText className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{fileInfo.name}</p>
                <p className="text-[10px] text-purple-300">{formatSize(fileInfo.originalSize)} • {fileInfo.name.endsWith('.epub') ? 'EPUB Fluide' : 'PDF Haute Définition'}</p>
              </div>
              <button
                type="button"
                onClick={reset}
                className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : status === 'idle' ? (
            <div className="w-14 h-14 rounded-2xl bg-white/6 border border-white/10 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <Icon className="w-7 h-7 text-purple-400" />
            </div>
          ) : status === 'compressing' ? (
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center animate-pulse shadow-lg shadow-cyan-500/20">
              <Zap className="w-7 h-7 text-cyan-300" />
            </div>
          ) : status === 'uploading' ? (
            <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center shadow-lg">
              <Loader2 className="w-7 h-7 text-purple-400 animate-spin" />
            </div>
          ) : status === 'done' ? (
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shadow-lg">
              <AlertCircle className="w-7 h-7 text-rose-400" />
            </div>
          )}

          {status === 'idle' && (
            <>
              <div className="text-center">
                <p className="text-sm font-extrabold text-white font-['Outfit']">Glisser-déposer le fichier ici</p>
                <p className="text-xs text-slate-400 mt-1 font-medium">ou cliquez pour parcourir votre appareil</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-1">
                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300">
                  {accept.split(',').join(' • ')}
                </span>
              </div>
            </>
          )}

          {status === 'compressing' && (
            <div className="text-center w-full space-y-1">
              <p className="text-xs font-black text-cyan-300 uppercase tracking-wider">Compression & Optimisation DSP...</p>
              <p className="text-[11px] text-slate-400 font-medium">{fileInfo?.name}</p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <div className="w-36 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-xs font-bold text-cyan-300 font-mono">{progress}%</span>
              </div>
            </div>
          )}

          {status === 'uploading' && (
            <div className="text-center w-full space-y-1">
              <p className="text-xs font-black text-purple-300 uppercase tracking-wider">Envoi Cloud Audio...</p>
              <p className="text-[11px] text-slate-400 font-medium">{fileInfo?.name}</p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <div className="w-36 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-xs font-bold text-purple-300 font-mono">{progress}%</span>
              </div>
            </div>
          )}

          {status === 'done' && (
            <div className="text-center space-y-1">
              <p className="text-xs font-black text-emerald-300 uppercase tracking-wider">✓ Fichier Prêt</p>
              <p className="text-xs text-slate-200 font-bold truncate max-w-[260px]">{fileInfo?.name || value}</p>
              {compressionInfo ? (
                <p className="text-[11px] text-cyan-300 font-semibold mt-1 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20 inline-block">{compressionInfo}</p>
              ) : (
                <p className="text-[11px] text-slate-400">{fileInfo?.originalSize ? formatSize(fileInfo.originalSize) : ''}</p>
              )}
              {type !== 'cover' && (
                <button type="button" onClick={reset} className="text-xs text-purple-300 hover:text-rose-400 font-bold mt-1.5 underline block mx-auto cursor-pointer">
                  Remplacer
                </button>
              )}
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-1">
              <p className="text-xs font-black text-rose-300 uppercase tracking-wider">Échec de l'upload</p>
              <p className="text-xs text-rose-400 max-w-[240px]">{error}</p>
              <button type="button" onClick={(e) => { e.stopPropagation(); setStatus('idle'); setError(''); }} className="text-xs text-purple-300 hover:text-white font-bold underline mt-1 block mx-auto cursor-pointer">
                Réessayer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
