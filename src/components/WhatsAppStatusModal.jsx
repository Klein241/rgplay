import React, { useState, useRef, useEffect } from 'react';
import { X, Share2, Download, RefreshCw, Film, Volume2, CheckCircle2, Play, Pause } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { generateWhatsAppStatusVideo } from '../utils/statusVideoGenerator';
import { StatusQuoteInput, DEFAULT_PROMO_TEXT } from './StatusQuoteInput';

export const WhatsAppStatusModal = ({ isOpen, onClose, book, chapter }) => {
  const { getAudioElement, isPlaying, togglePlay, currentTime, duration: totalAudioDuration, formatTime } = useAudio();
  
  // Point de départ de l'extrait audio
  const [startTime, setStartTime] = useState(() => Math.floor(currentTime || 0));
  // Durée de la vidéo (15, 30, 60, ou 'all')
  const [durationOption, setDurationOption] = useState('30');
  // Transcription / Citation en grande police : message par défaut RG Play promo
  const [quoteText, setQuoteText] = useState(DEFAULT_PROMO_TEXT);
  const [showQuoteInput, setShowQuoteInput] = useState(true);

  const [isGenerating, setIsGenerating] = useState(false);
  const [recordedDuration, setRecordedDuration] = useState(30);
  const [progress, setProgress] = useState(0);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [generatedVideo, setGeneratedVideo] = useState(null);
  const [feedbackToast, setFeedbackToast] = useState('');
  const abortControllerRef = useRef(null);

  // Synchroniser le point de départ avec la position actuelle à l'ouverture
  useEffect(() => {
    if (isOpen) {
      const initialPos = Math.floor(currentTime || 0);
      setStartTime(initialPos);
      if (!quoteText) {
        setQuoteText(DEFAULT_PROMO_TEXT);
      }
    }
  }, [isOpen, book, chapter, currentTime]);

  // Nettoyage de l'URL vidéo à la fermeture
  useEffect(() => {
    return () => {
      if (generatedVideo?.url) URL.revokeObjectURL(generatedVideo.url);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [generatedVideo]);

  if (!isOpen || !book) return null;

  // Calcul de la durée effective en secondes
  const maxPossibleDuration = Math.max(10, Math.floor((totalAudioDuration || 600) - startTime));
  const effectiveDuration = durationOption === 'all'
    ? maxPossibleDuration
    : Math.min(Number(durationOption), maxPossibleDuration);

  // Écouter l'extrait choisi
  const handlePreviewAudio = () => {
    const audioEl = getAudioElement?.();
    if (!audioEl) return;
    audioEl.currentTime = startTime;
    if (audioEl.paused) audioEl.play().catch(() => {});
  };

  const handleStartGeneration = async () => {
    const audioEl = getAudioElement?.();
    const targetDur = effectiveDuration;
    setRecordedDuration(targetDur);
    setIsGenerating(true);
    setProgress(0);
    setSecondsElapsed(0);
    setGeneratedVideo(null);
    setFeedbackToast('');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await generateWhatsAppStatusVideo({
        book,
        chapter,
        audioElement: audioEl,
        startTime,
        duration: targetDur,
        quoteText: showQuoteInput ? quoteText.trim() : '',
        onProgress: (pct, sec) => {
          setProgress(pct);
          setSecondsElapsed(sec);
        },
        signal: controller.signal,
      });

      setGeneratedVideo(result);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error('[WhatsAppStatus] Erreur génération:', err);
        setFeedbackToast('❌ Erreur lors de la génération vidéo');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setIsGenerating(false);
    setProgress(0);
  };

  const handleShareWhatsApp = async () => {
    if (!generatedVideo?.file) return;
    const file = generatedVideo.file;
    const isWebmFallback = generatedVideo.isWebmFallback === true;

    // Avertissement si le navigateur a produit du WebM (impossible de le renommer en MP4)
    if (isWebmFallback) {
      setFeedbackToast('⚠️ Fichier WebM : WhatsApp peut refuser. Utilisez Chrome/Edge sur PC.');
      setTimeout(() => setFeedbackToast(''), 5000);
      handleDownload();
      return;
    }

    const playUrl = `${window.location.origin}/?book=${encodeURIComponent(book.id || '')}&play=1`;
    const shareText = `🎧 Écoutez "${book.title}" par ${book.author} sur RG Play\n👉 Écoutez gratuitement ici : ${playUrl}\n📚 Bibliothèque READ'S GREAT`;
    const shareData = {
      title: `${book.title} — RG Play`,
      text: shareText,
      url: playUrl,
      files: [file],
    };

    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share(shareData);
        setFeedbackToast('✓ Prêt pour WhatsApp !');
        setTimeout(() => setFeedbackToast(''), 3000);
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
        // Partage échoué : informer l utilisateur et proposer le téléchargement manuel
        setFeedbackToast('📥 Partage non disponible — téléchargez puis importez sur WhatsApp');
        setTimeout(() => setFeedbackToast(''), 4000);
        // Ne PAS déclencher handleDownload() automatiquement pour éviter les doubles fichiers
        return;
      }
    }

    // navigator.share non disponible (PC sans extension mobile) -> copier le lien et télécharger
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(shareText);
    } catch (_) {}
    setFeedbackToast('📋 Lien copié ! Téléchargez la vidéo ci-dessous pour la partager manuellement.');
    setTimeout(() => setFeedbackToast(''), 5000);
  };

  const handleDownload = () => {
    if (!generatedVideo?.url) return;
    const a = document.createElement('a');
    a.href = generatedVideo.url;
    // Respecter le vrai nom de fichier produit par le générateur (mp4 ou webm)
    const fileName = generatedVideo.file?.name || 'statut_rgplay.mp4';
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    const isWebm = fileName.endsWith('.webm');
    const toast = isWebm
      ? '⬇️ Fichier WebM téléchargé (WhatsApp peut le refuser — utilisez Chrome sur PC pour un vrai MP4)'
      : '✓ Vidéo MP4 téléchargée ! Importez-la sur votre statut WhatsApp';
    setFeedbackToast(toast);
    setTimeout(() => setFeedbackToast(''), 4000);
  };

  const handleReset = () => {
    if (generatedVideo?.url) URL.revokeObjectURL(generatedVideo.url);
    setGeneratedVideo(null);
    setProgress(0);
    setSecondsElapsed(0);
  };

  return (
    <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="relative w-full max-w-md rounded-3xl border border-purple-500/40 bg-[#120524] shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_50px_rgba(168,85,247,0.35)] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Entête */}
        <div className="p-3.5 sm:p-4 border-b border-purple-500/20 flex items-center justify-between shrink-0 bg-black/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
              <Film size={17} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider font-['Outfit']">
                Statut WhatsApp &amp; Story 📲
              </h3>
              <p className="text-[10px] text-purple-200/80">Vidéo animée 9:16 + Audio pur</p>
            </div>
          </div>

          <button
            onClick={() => { handleCancel(); onClose(); }}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Corps défilable */}
        <div className="p-3.5 sm:p-4 overflow-y-auto space-y-3.5 flex-1 min-h-0 scrollbar-thin scrollbar-thumb-purple-900/50">
          {/* Aperçu compact 9:16 */}
          <div className="relative w-36 h-56 mx-auto rounded-2xl overflow-hidden border border-purple-400/50 shadow-xl bg-[#0e061c] shrink-0">
            {generatedVideo?.url ? (
              <video src={generatedVideo.url} controls playsInline autoPlay loop className="w-full h-full object-cover" />
            ) : (
              <div className="relative w-full h-full flex flex-col items-center justify-between p-2 select-none">
                <div className="absolute inset-0 bg-cover bg-center blur-sm opacity-35" style={{ backgroundImage: `url(${book.cover_url})` }} />
                <div className="absolute inset-0 bg-linear-to-b from-black/50 via-purple-950/40 to-black/80" />
                <span className="relative z-10 text-[7.5px] font-bold text-cyan-300 bg-cyan-950/80 px-1.5 py-0.5 rounded-full border border-cyan-400/30">
                  🎧 RG PLAY
                </span>
                <img src={book.cover_url} alt="" className="relative z-10 w-20 h-20 rounded-xl object-cover border border-white/20 shadow-md my-auto" />
                {showQuoteInput && quoteText && (
                  <p className="relative z-10 text-[8.5px] font-bold text-amber-200 text-center px-1.5 py-0.5 line-clamp-3 italic bg-purple-950/85 rounded-lg border border-amber-400/30 max-w-[92%] shadow-md leading-tight">
                    “ {quoteText.trim().replace(/^["“«]+|["”»]+$/g, '')} ”
                  </p>
                )}
                <div className="relative z-10 text-center w-full">
                  <p className="text-[9px] font-bold text-white truncate">{book.title}</p>
                  <p className="text-[7.5px] text-purple-200 truncate">{book.author}</p>
                </div>
              </div>
            )}
          </div>

          {feedbackToast && (
            <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold text-center flex items-center justify-center gap-1.5 animate-fadeIn">
              <CheckCircle2 size={14} />
              <span>{feedbackToast}</span>
            </div>
          )}

          {!generatedVideo && !isGenerating && (
            <>
              {/* 1. Sélecteur du point de départ dans l'audio */}
              <div className="p-3 rounded-2xl bg-white/4 border border-white/8 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-purple-200 flex items-center gap-1">
                    ⏱️ Début de l'extrait : <strong className="text-cyan-300 font-mono text-xs">{formatTime(startTime)}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handlePreviewAudio}
                    className="px-2 py-0.5 rounded-lg bg-purple-500/25 hover:bg-purple-500/40 border border-purple-400/40 text-purple-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Play size={10} /> Écouter
                  </button>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(30, Math.floor(totalAudioDuration || 600))}
                  value={startTime}
                  onChange={(e) => setStartTime(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-purple-950 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-purple-300/70 font-mono">
                  <button type="button" onClick={() => setStartTime(s => Math.max(0, s - 10))} className="hover:text-white cursor-pointer">-10s</button>
                  <button type="button" onClick={() => setStartTime(Math.floor(currentTime || 0))} className="text-cyan-300 hover:underline cursor-pointer">Repère actuel</button>
                  <button type="button" onClick={() => setStartTime(s => Math.min((totalAudioDuration || 600) - 10, s + 10))} className="hover:text-white cursor-pointer">+10s</button>
                </div>
              </div>

              {/* 2. Durée étendue */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-bold text-purple-200 uppercase tracking-wider block">
                  Durée de l'enregistrement
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: '15', label: '15s' },
                    { id: '30', label: '30s' },
                    { id: '60', label: '1 min' },
                    { id: 'all', label: 'Complet' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDurationOption(item.id)}
                      className={`py-1.5 px-2 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                        durationOption === item.id
                          ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow-md shadow-emerald-500/20'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Message personnalisé ou Citation / Transcription */}
              <StatusQuoteInput
                quoteText={quoteText}
                onChange={setQuoteText}
                showQuoteInput={showQuoteInput}
                onToggleShowQuote={setShowQuoteInput}
                book={book}
                chapter={chapter}
                maxLength={160}
              />
            </>
          )}

          {/* En cours d'enregistrement */}
          {isGenerating && (
            <div className="space-y-2 py-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-purple-200 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  Capture en cours...
                </span>
                <span className="text-cyan-300 font-mono">
                  {secondsElapsed.toFixed(1)}s / {recordedDuration}s
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full transition-all duration-150"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #22d3ee 0%, #c084fc 50%, #ec4899 100%)',
                  }}
                />
              </div>
              <p className="text-[10px] text-purple-200/60 text-center">
                Audio numérique pur en cours d'encodage...
              </p>
            </div>
          )}
        </div>

        {/* PIED FIXE / TOUJOURS VISIBLE */}
        <div className="p-3.5 sm:p-4 border-t border-purple-500/25 bg-[#0f041e] shrink-0 space-y-2">
          {!generatedVideo ? (
            isGenerating ? (
              <button
                type="button"
                onClick={handleCancel}
                className="w-full py-3 rounded-2xl bg-red-500/20 hover:bg-red-500/30 border border-red-400/40 text-red-300 text-xs font-black transition-all cursor-pointer"
              >
                Annuler l'enregistrement
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartGeneration}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                  color: '#020617',
                  boxShadow: '0 8px 24px -4px rgba(16, 185, 129, 0.45)',
                }}
                className="w-full py-3.5 rounded-2xl hover:opacity-95 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Film size={18} className="text-[#020617]" />
                <span className="font-extrabold tracking-wide">
                  LANCER L'ENREGISTREMENT ({effectiveDuration}S)
                </span>
              </button>
            )
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="w-full py-3.5 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-emerald-500/40 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Share2 size={18} />
                <span>PARTAGER SUR MON STATUT WHATSAPP</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download size={14} />
                  <span>Télécharger</span>
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 text-purple-200 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={13} />
                  <span>Recommencer</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
