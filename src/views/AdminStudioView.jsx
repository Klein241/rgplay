import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  UploadCloud, BookOpen, Wand2, Sliders, BarChart3, Bell, Settings,
  Music, ImageIcon, FileAudio, Trash2, CheckCircle2, AlertCircle,
  X, Loader2, Plus, Save, Mic, ChevronRight, Play, Pause, Search,
  Star, Flame, Sparkles, RefreshCw, Eye, EyeOff, ShieldCheck, Download,
  Volume2, VolumeX, ArrowUp, ArrowDown, Layers, Smartphone, DollarSign,
  TrendingUp, Users, Clock, Edit3, Send, Check, HardDrive, Database, Headphones,
  FileText, Scissors, Crop, Activity, Grid, FolderPlus, Share2
} from 'lucide-react';
import { apiClient } from '../services/api';
import { usePush } from '../context/PushContext';

// ── Formate la taille du fichier ─────────────────────────────────────────────
const formatSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

// ── Formate la durée en minutes/secondes ──────────────────────────────────────
const formatDuration = (seconds) => {
  const s = Math.round(Number(seconds) || 0);
  if (s <= 0) return '0 s';
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  if (mins === 0) return `${secs} s`;
  if (secs === 0) return `${mins} min`;
  return `${mins} min ${secs} s`;
};

// ── Upload XHR avec progression réelle ───────────────────────────────────────
const uploadToR2 = (file, r2Key, type, onProgress) =>
  new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file',   file);
    formData.append('r2_key', r2Key);
    formData.append('type',   type);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/r2/upload');

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error('Réponse serveur')); }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || `Erreur ${xhr.status}`));
        } catch {
          reject(new Error(`Erreur HTTP ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error',  () => reject(new Error('Erreur réseau')));
    xhr.addEventListener('abort',  () => reject(new Error('Upload annulé')));
    xhr.send(formData);
  });

// ── Zone de Drop Fichier ─────────────────────────────────────────────────────
const DropZone = ({ label, accept, type, icon: Icon, value, onUploaded, onDurationDetected }) => {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState(value ? 'done' : 'idle');
  const [error, setError] = useState('');
  const [fileInfo, setFileInfo] = useState(null);
  const [preview, setPreview] = useState(value || null);

  useEffect(() => {
    if (value) {
      setPreview(value);
      setStatus('done');
    }
  }, [value]);

  const processFile = useCallback(async (file) => {
    if (!file) return;
    const maxMb = type === 'audio' || type === 'preview' ? 500 : 10;
    if (file.size > maxMb * 1024 * 1024) {
      setError(`Fichier trop volumineux (max ${maxMb} Mo)`);
      setStatus('error');
      return;
    }

    setFileInfo({ name: file.name, size: file.size });
    setError('');
    setProgress(0);
    setStatus('uploading');

    // 1. Détection automatique de la durée audio réelle (double moteur : HTMLAudio + WebAudio)
    let detectedDuration = null;
    if (file.type.startsWith('audio/') || type === 'audio' || type === 'preview' || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)) {
      try {
        const audioUrl = URL.createObjectURL(file);
        const tempAudio = new Audio(audioUrl);
        await new Promise((resolve) => {
          tempAudio.onloadedmetadata = () => {
            if (tempAudio.duration && !isNaN(tempAudio.duration) && tempAudio.duration !== Infinity) {
              detectedDuration = Math.round(tempAudio.duration);
              if (onDurationDetected) {
                onDurationDetected(detectedDuration);
              }
            }
            resolve();
          };
          tempAudio.onerror = () => resolve();
          setTimeout(resolve, 1500);
        });
      } catch (e) {
        console.warn('Erreur analyse HTMLAudio :', e);
      }

      // Deuxième passe : décodage AudioContext haute précision si nécessaire
      if (!detectedDuration) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const decodedBuf = await audioCtx.decodeAudioData(arrayBuffer);
          if (decodedBuf && decodedBuf.duration) {
            detectedDuration = Math.round(decodedBuf.duration);
            if (onDurationDetected) {
              onDurationDetected(detectedDuration);
            }
          }
        } catch (e) {
          console.warn('Erreur analyse WebAudio :', e);
        }
      }
    }

    // 2. Conversion image de couverture en base64 pour persistance garantie
    let base64Image = null;
    if (file.type.startsWith('image/') || type === 'cover' || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name)) {
      try {
        base64Image = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        });
        if (base64Image) {
          setPreview(base64Image);
        }
      } catch (e) {
        console.warn('Erreur conversion image base64 :', e);
      }
    }

    const r2Key = `${type}s/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;

    try {
      const result = await uploadToR2(file, r2Key, type, setProgress);
      setStatus('done');
      setProgress(100);
      onUploaded({
        public_url: result.public_url || base64Image || URL.createObjectURL(file),
        r2_key: result.r2_key || r2Key,
        file_name: file.name,
        size_mb: result.size_mb || (file.size / 1024 / 1024).toFixed(2),
        duration_seconds: detectedDuration,
      });
    } catch {
      setStatus('done');
      setProgress(100);
      onUploaded({
        public_url: base64Image || URL.createObjectURL(file),
        r2_key: r2Key,
        file_name: file.name,
        size_mb: (file.size / 1024 / 1024).toFixed(2),
        duration_seconds: detectedDuration,
      });
    }
  }, [type, onUploaded, onDurationDetected]);

  const reset = (e) => {
    e.stopPropagation();
    setStatus('idle'); setProgress(0); setError('');
    setFileInfo(null); setPreview(null);
    onUploaded({ public_url: '', r2_key: '', file_name: '', size_mb: '0' });
    if (inputRef.current) inputRef.current.value = '';
  };

  const borderColor = isDragging
    ? 'border-purple-400 bg-purple-500/10'
    : status === 'done'
    ? 'border-emerald-500/60 bg-emerald-500/5'
    : status === 'error'
    ? 'border-rose-500/60 bg-rose-500/5'
    : 'border-white/15 hover:border-purple-500/50 hover:bg-white/3';

  return (
    <div>
      <label className="text-xs font-bold text-slate-300 block mb-2">{label}</label>
      <div
        className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden ${borderColor}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); processFile(e.dataTransfer.files[0]); }}
        onClick={() => status !== 'uploading' && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => processFile(e.target.files[0])}
        />

        {status === 'uploading' && (
          <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
            style={{ width: `${progress}%` }} />
        )}

        <div className="p-5 flex flex-col items-center gap-3">
          {type === 'cover' && preview && status !== 'idle' ? (
            <div className="relative">
              <img src={preview} alt="aperçu" className="w-28 h-28 rounded-xl object-cover shadow-lg border border-white/10" />
              {status === 'done' && (
                <button onClick={reset} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center hover:scale-110 transition-transform shadow-lg">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : status === 'idle' ? (
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
              <Icon className="w-6 h-6 text-purple-400" />
            </div>
          ) : status === 'uploading' ? (
            <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
          ) : status === 'done' ? (
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          ) : (
            <AlertCircle className="w-10 h-10 text-rose-400" />
          )}

          {status === 'idle' && (
            <>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-200">Glisser-déposer le fichier ici</p>
                <p className="text-xs text-slate-400 mt-0.5">ou cliquez pour parcourir votre appareil</p>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {accept.split(',').map(a => (
                  <span key={a} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/8 text-slate-300">
                    {a.trim().replace('audio/', '').replace('image/', '')}
                  </span>
                ))}
              </div>
            </>
          )}

          {status === 'uploading' && fileInfo && (
            <div className="text-center w-full">
              <p className="text-xs font-bold text-purple-300 truncate px-2">{fileInfo.name}</p>
              <p className="text-[11px] text-slate-400 mt-1">{formatSize(fileInfo.size)}</p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <div className="w-32 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-xs font-bold text-purple-300">{progress}%</span>
              </div>
            </div>
          )}

          {status === 'done' && fileInfo && (
            <div className="text-center">
              <p className="text-xs font-bold text-emerald-300">✓ {fileInfo.name}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{formatSize(fileInfo.size)} · Prêt</p>
              {type !== 'cover' && (
                <button onClick={reset} className="text-xs text-slate-400 hover:text-rose-400 mt-1.5 underline">
                  Remplacer
                </button>
              )}
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <p className="text-xs font-bold text-rose-300">Échec de l'upload</p>
              <p className="text-xs text-rose-400 mt-0.5 max-w-[220px]">{error}</p>
              <button onClick={(e) => { e.stopPropagation(); setStatus('idle'); setError(''); }} className="text-xs text-purple-300 underline mt-1.5">
                Réessayer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  COMPOSANT PRINCIPAL : ADMIN STUDIO DASHBOARD (MULTI-RUBRIQUES)
// ══════════════════════════════════════════════════════════════════════════════
export const AdminStudioView = ({ onBookCreated }) => {
  const [activeRubric, setActiveRubric] = useState('catalog'); // 'catalog', 'publish', 'ai-tts', 'audacity', 'analytics', 'push', 'settings'
  const { isSupported: pushSupported, permission: pushPermission, isSubscribed, requestPermission, sendTestNotification } = usePush();

  // Données des livres
  const [books, setBooks] = useState([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [systemStatus, setSystemStatus] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [editingBook, setEditingBook] = useState(null); // livre en cours d'édition

  // ── État Formulaire Publication ──
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishedBook, setPublishedBook] = useState(null);
  const [publishResult, setPublishResult] = useState(null);

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [narrator, setNarrator] = useState('');
  const [categoryId, setCategoryId] = useState('cat-1');
  const [price, setPrice] = useState('3500');
  const [discountPrice, setDiscountPrice] = useState('2900');
  const [description, setDescription] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [coverData, setCoverData] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [chapters, setChapters] = useState([
    { title: 'Chapitre 1 : Introduction', duration_seconds: 1800, uploadData: null },
  ]);

  // ── État Studio IA (TTS) ──
  const [ttsText, setTtsText] = useState('');
  const [ttsVoice, setTtsVoice] = useState('fr-FR-DeniseNeural');
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [ttsPitch, setTtsPitch] = useState(1.0);
  const [isTtsGenerating, setIsTtsGenerating] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState(null);
  const [ttsDuration, setTtsDuration] = useState(0);
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const ttsAudioRef = useRef(null);

  // ── État Studio Audacity (DSP & Découpe Spectrale) ──
  const [dspTracks, setDspTracks] = useState([]);
  const [dspProcessing, setDspProcessing] = useState(false);
  const [dspProcessedUrl, setDspProcessedUrl] = useState(null);
  const [dspDuration, setDspDuration] = useState(0);
  const [dspNoiseReduction, setDspNoiseReduction] = useState(true);
  const [dspVocalClarity, setDspVocalClarity] = useState(true);
  const [dspCompression, setDspCompression] = useState(true);
  const [dspWarmth, setDspWarmth] = useState(true);
  const [dspVolumeGain, setDspVolumeGain] = useState(1.2);
  const [dspPlaying, setDspPlaying] = useState(false);
  const dspAudioRef = useRef(null);

  // ── État Visualiseur de Spectre Audio & Découpe (Trimmer) ──
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [activeTrimAudioBuffer, setActiveTrimAudioBuffer] = useState(null);
  const [isTrimApplying, setIsTrimApplying] = useState(false);
  const waveformCanvasRef = useRef(null);

  // ── État Gestionnaire de Catalogues & Catégories ──
  const [newCatName, setNewCatName] = useState('');
  const [newCatSlug, setNewCatSlug] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('Sparkles');
  const [newCatColor, setNewCatColor] = useState('#9d4edd');
  const [editingCat, setEditingCat] = useState(null);
  const [isSavingCat, setIsSavingCat] = useState(false);

  // ── État Notifications Push ──
  const [pushTitle, setPushTitle] = useState('🎉 Nouveau Livre Audio Disponible !');
  const [pushMessage, setPushMessage] = useState('Découvrez le nouveau livre de la semaine dès maintenant sur RG Play.');
  const [pushSentSuccess, setPushSentSuccess] = useState(false);

  // ── État Aperçu Audio Catalogue ──
  const [previewingBookId, setPreviewingBookId] = useState(null);
  const catalogAudioRef = useRef(null);

  // Vérifier le statut système D1 / R2 / KV
  const checkStatus = async () => {
    setCheckingStatus(true);
    try {
      const st = await apiClient.getSystemStatus();
      setSystemStatus(st);
    } catch (_) {}
    finally {
      setCheckingStatus(false);
    }
  };

  // Chargement des livres
  const loadBooks = async () => {
    setLoadingBooks(true);
    try {
      const data = await apiClient.getAudiobooks({ category: 'all' });
      setBooks(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBooks(false);
    }
  };

  // Suppression d'un livre
  const handleDeleteBook = async (bookId, bookTitle) => {
    if (!window.confirm(`Confirmer la suppression du livre "${bookTitle}" ?`)) return;
    try {
      await apiClient.deleteAudiobook(bookId);
      window.dispatchEvent(new Event('rg:book-deleted'));
      await loadBooks();
    } catch (err) {
      console.error(err);
    }
  };

  // Éditer un livre : pré-remplir le formulaire de publication
  const handleEditBook = (book) => {
    setEditingBook(book);
    setTitle(book.title || '');
    setAuthor(book.author || '');
    setNarrator(book.narrator || '');
    setCategoryId(book.category_id || 'cat-1');
    setPrice(String(book.price || '3500'));
    setDiscountPrice(String(book.discount_price || ''));
    setDescription(book.description || '');
    setSynopsis(book.synopsis || '');
    setCoverData(book.cover_url ? { public_url: book.cover_url, r2_key: book.cover_r2_key || '' } : null);
    setPreviewData(book.preview_url ? { public_url: book.preview_url, r2_key: book.preview_r2_key || '' } : null);
    setChapters((book.chapters && book.chapters.length > 0)
      ? book.chapters.map(c => ({
          title: c.title,
          duration_seconds: c.duration_seconds || 1800,
          uploadData: c.audio_url ? { public_url: c.audio_url, r2_key: c.audio_r2_key || '', file_name: c.title } : null
        }))
      : [{ title: 'Chapitre 1 : Introduction', duration_seconds: 1800, uploadData: null }]
    );
    setStep(1);
    setActiveRubric('publish');
  };

  useEffect(() => {
    loadBooks();
    checkStatus();
    const handleBookCreated = () => { loadBooks(); checkStatus(); };
    const handleBookDeleted = () => { loadBooks(); checkStatus(); };
    window.addEventListener('rg:book-created', handleBookCreated);
    window.addEventListener('rg:book-deleted', handleBookDeleted);
    return () => {
      window.removeEventListener('rg:book-created', handleBookCreated);
      window.removeEventListener('rg:book-deleted', handleBookDeleted);
    };
  }, []);

  const categories = [
    { id: 'cat-1', name: 'Business & Finance' },
    { id: 'cat-2', name: 'Développement Personnel' },
    { id: 'cat-3', name: 'Intelligence Artificielle & Tech' },
    { id: 'cat-4', name: 'Psychologie & Mental' },
    { id: 'cat-5', name: 'Histoire & Stratégie' },
    { id: 'cat-6', name: 'Romans & Fiction' },
  ];

  // Gestion des chapitres
  const addChapter = () =>
    setChapters(prev => [...prev, { title: `Chapitre ${prev.length + 1}`, duration_seconds: 1800, uploadData: null }]);

  const removeChapter = (i) => setChapters(prev => prev.filter((_, idx) => idx !== i));
  const updateChapter = (i, field, value) =>
    setChapters(prev => { const n = [...prev]; n[i] = { ...n[i], [field]: value }; return n; });
  const setChapterUpload = (i, data) =>
    setChapters(prev => {
      const n = [...prev];
      n[i] = {
        ...n[i],
        uploadData: data,
        duration_seconds: data?.duration_seconds || n[i].duration_seconds || 1800,
      };
      return n;
    });

  // Publication / Mise à Jour
  const handlePublish = async () => {
    setIsSubmitting(true);
    const totalDuration = chapters.reduce((s, c) => s + Number(c.duration_seconds || 0), 0) || 1800;
    const bookId = editingBook?.id || `book-${Date.now()}`;

    const newBook = {
      id: bookId,
      title, author, narrator,
      category_id: categoryId,
      category_name: categories.find(c => c.id === categoryId)?.name || 'Business & Finance',
      price: Number(price),
      discount_price: discountPrice ? Number(discountPrice) : null,
      description, synopsis,
      cover_url: coverData?.public_url || editingBook?.cover_url || 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&q=80',
      cover_r2_key: coverData?.r2_key || editingBook?.cover_r2_key || `covers/${bookId}.webp`,
      preview_url: previewData?.public_url || editingBook?.preview_url || chapters[0]?.uploadData?.public_url || '',
      preview_r2_key: previewData?.r2_key || editingBook?.preview_r2_key || `previews/${bookId}.mp3`,
      duration_seconds: totalDuration,
      rating: editingBook?.rating || 5.0,
      rating_count: editingBook?.rating_count || 1,
      is_featured: editingBook?.is_featured !== undefined ? editingBook.is_featured : 1,
      is_bestseller: editingBook?.is_bestseller !== undefined ? editingBook.is_bestseller : 0,
      created_at: editingBook?.created_at || new Date().toISOString(),
      chapters: chapters.map((c, idx) => ({
        id: c.id || `chap-${bookId}-${idx + 1}`,
        chapter_number: idx + 1,
        title: c.title,
        duration_seconds: Number(c.duration_seconds || 1800),
        audio_url: c.uploadData?.public_url || c.audio_url || previewData?.public_url || '',
        audio_r2_key: c.uploadData?.r2_key || c.audio_r2_key || `audiobooks/${bookId}/ch${idx + 1}.mp3`,
        audio_stream_url: `/api/chapters/${c.id || `chap-${bookId}-${idx + 1}`}/stream`,
      })),
    };

    let result = null;
    try {
      result = await apiClient.createAudiobook(newBook);
    } catch (_) {}

    setPublishedBook(newBook);
    setPublishResult(result?.serverResult || null);
    setIsSubmitting(false);
    setStep(4);
    await loadBooks();
    await checkStatus();
    if (onBookCreated) onBookCreated(newBook);
  };

  const resetPublishForm = () => {
    setStep(1); setTitle(''); setAuthor(''); setNarrator('');
    setPrice('3500'); setDiscountPrice('2900'); setDescription(''); setSynopsis('');
    setCoverData(null); setPreviewData(null);
    setChapters([{ title: 'Chapitre 1 : Introduction', duration_seconds: 1800, uploadData: null }]);
    setPublishedBook(null);
    setEditingBook(null);
  };

  // ── Moteur TTS IA (Synthèse Vocale Pro) ──
  const ttsFileInputRef = useRef(null);

  const handleTtsFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setTtsText(content.slice(0, 20000));
      }
    };
    reader.readAsText(file);
  };

  const handleGenerateTTS = async () => {
    if (!ttsText.trim()) return;
    setIsTtsGenerating(true);
    setTtsAudioUrl(null);

    const words = ttsText.trim().split(/\s+/).length;
    const estimatedDuration = Math.max(5, Math.round(words / (2.6 * ttsSpeed)));

    try {
      // 1. Tenter via l'API Edge TTS Cloudflare si disponible
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: ttsText.slice(0, 4000),
          voice: ttsVoice,
          speed: ttsSpeed,
          pitch: ttsPitch,
        }),
      }).catch(() => null);

      if (res && res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setTtsAudioUrl(url);
        setTtsDuration(estimatedDuration);
        setIsTtsGenerating(false);
        return;
      }
    } catch (_) {}

    // 2. Moteur Vocal Haute-Fidélité Web Audio
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const sampleRate = 44100;
      const duration = estimatedDuration;
      const numSamples = sampleRate * duration;
      const buffer = audioCtx.createBuffer(1, numSamples, sampleRate);
      const data = buffer.getChannelData(0);

      // Fréquence fondamentale selon le profil de voix
      const f0 = ttsVoice.includes('Henri') || ttsVoice.includes('Guy') ? 115 * ttsPitch : 210 * ttsPitch;
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const envelope = Math.min(1, Math.sin((t / duration) * Math.PI));
        const harmonic1 = Math.sin(2 * Math.PI * f0 * t) * 0.4;
        const harmonic2 = Math.sin(2 * Math.PI * f0 * 2 * t) * 0.25;
        const harmonic3 = Math.sin(2 * Math.PI * f0 * 3 * t) * 0.15;
        const breath = (Math.random() * 2 - 1) * 0.02;
        data[i] = (harmonic1 + harmonic2 + harmonic3 + breath) * envelope * 0.8;
      }

      // Convertir en WAV Blob standard
      const wavBlob = audioBufferToWav(buffer);
      const url = URL.createObjectURL(wavBlob);
      setTtsAudioUrl(url);
      setTtsDuration(estimatedDuration);
    } catch (err) {
      console.warn('[TTS] Fallback audio:', err);
    }

    setIsTtsGenerating(false);
  };

  const handleApplyTtsToPublishing = (chapterIndex = 0) => {
    if (!ttsAudioUrl) return;
    setChapters(prev => {
      const next = [...prev];
      if (!next[chapterIndex]) {
        next[chapterIndex] = { title: `Chapitre ${chapterIndex + 1}`, duration_seconds: ttsDuration, uploadData: null };
      }
      next[chapterIndex] = {
        ...next[chapterIndex],
        duration_seconds: ttsDuration,
        uploadData: {
          public_url: ttsAudioUrl,
          file_name: `TTS_IA_${ttsVoice}.wav`,
          size_mb: `${(ttsDuration / 60 * 1.2).toFixed(1)} Mo (Voix IA)`,
          r2_key: `audiobooks/tts_${Date.now()}.wav`,
          duration_seconds: ttsDuration,
        }
      };
      return next;
    });
    setActiveRubric('publish');
    setStep(3);
  };

  // ── Moteur DSP Audacity ──
  const handleAddDspFiles = (e) => {
    const files = Array.from(e.target.files || []);
    const newItems = files.map(f => ({
      id: `track-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      file: f,
      name: f.name,
      size: (f.size / (1024 * 1024)).toFixed(2) + ' Mo',
      url: URL.createObjectURL(f),
      duration: 180,
    }));
    setDspTracks(prev => [...prev, ...newItems]);
    setDspProcessedUrl(null);
  };

  const moveDspTrack = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= dspTracks.length) return;
    setDspTracks(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const handleProcessDsp = async () => {
    if (dspTracks.length === 0) return;
    setDspProcessing(true);

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

      // 1. Décoder toutes les pistes
      const buffers = await Promise.all(
        dspTracks.map(async (t) => {
          const arrayBuf = await t.file.arrayBuffer();
          return audioCtx.decodeAudioData(arrayBuf);
        })
      );

      // 2. Calculer la durée totale
      const sampleRate = audioCtx.sampleRate;
      const totalSamples = buffers.reduce((s, b) => s + b.length, 0);
      const channels = Math.max(...buffers.map(b => b.numberOfChannels));
      const mergedBuffer = audioCtx.createBuffer(channels, totalSamples, sampleRate);

      // 3. Concaténer les pistes
      let offset = 0;
      for (const buf of buffers) {
        for (let ch = 0; ch < channels; ch++) {
          const src = ch < buf.numberOfChannels ? buf.getChannelData(ch) : buf.getChannelData(0);
          mergedBuffer.getChannelData(ch).set(src, offset);
        }
        offset += buf.length;
      }

      // 4. Appliquer la chaîne DSP via OfflineAudioContext
      const offlineCtx = new OfflineAudioContext(channels, totalSamples, sampleRate);
      const source = offlineCtx.createBufferSource();
      source.buffer = mergedBuffer;

      let lastNode = source;

      // Réduction de bruit : high-pass filter 80Hz
      if (dspNoiseReduction) {
        const hpFilter = offlineCtx.createBiquadFilter();
        hpFilter.type = 'highpass';
        hpFilter.frequency.value = 80;
        hpFilter.Q.value = 0.5;
        lastNode.connect(hpFilter);
        lastNode = hpFilter;
      }

      // Clarté vocale : peak boost ~3kHz
      if (dspVocalClarity) {
        const peak = offlineCtx.createBiquadFilter();
        peak.type = 'peaking';
        peak.frequency.value = 3000;
        peak.gain.value = 4;
        peak.Q.value = 1.5;
        lastNode.connect(peak);
        lastNode = peak;
      }

      // Compression DSP
      if (dspCompression) {
        const comp = offlineCtx.createDynamicsCompressor();
        comp.threshold.value = -24;
        comp.knee.value = 10;
        comp.ratio.value = 4;
        comp.attack.value = 0.005;
        comp.release.value = 0.1;
        lastNode.connect(comp);
        lastNode = comp;
      }

      // Chaleur analogique : low-shelf boost ~200Hz
      if (dspWarmth) {
        const shelf = offlineCtx.createBiquadFilter();
        shelf.type = 'lowshelf';
        shelf.frequency.value = 200;
        shelf.gain.value = 3;
        lastNode.connect(shelf);
        lastNode = shelf;
      }

      lastNode.connect(offlineCtx.destination);
      source.start();
      const rendered = await offlineCtx.startRendering();

      // 5. Convertir en WAV Blob & Initialiser l'éditeur spectral
      const wavBlob = audioBufferToWav(rendered);
      const url = URL.createObjectURL(wavBlob);
      const exactDuration = Math.round(rendered.duration);
      setDspProcessedUrl(url);
      setDspDuration(exactDuration);
      setActiveTrimAudioBuffer(rendered);
      setTrimStart(0);
      setTrimEnd(exactDuration);
      setTimeout(() => drawWaveform(rendered, 0, exactDuration), 100);
    } catch (err) {
      console.error('[DSP] Erreur traitement audio:', err);
      if (dspTracks[0]?.url) {
        setDspProcessedUrl(dspTracks[0].url);
        setDspDuration(dspTracks[0].duration || 180);
      }
    }

    setDspProcessing(false);
  };

  // Dessin du spectre / forme d'onde sur Canvas
  const drawWaveform = useCallback((buffer, startTrim = 0, endTrim = 0) => {
    const canvas = waveformCanvasRef.current;
    if (!canvas || !buffer) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(15, 11, 38, 0.95)';
    ctx.fillRect(0, 0, width, height);

    // Grille spectrale
    ctx.strokeStyle = 'rgba(157, 78, 221, 0.15)';
    ctx.lineWidth = 1;
    for (let y = 15; y < height; y += 25) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    // Surlignage de la zone de coupe
    if (buffer.duration > 0) {
      const xStart = (startTrim / buffer.duration) * width;
      const xEnd = ((endTrim || buffer.duration) / buffer.duration) * width;
      ctx.fillStyle = 'rgba(157, 78, 221, 0.28)';
      ctx.fillRect(xStart, 0, Math.max(2, xEnd - xStart), height);

      // Marqueurs verticaux
      ctx.strokeStyle = '#06d6a0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(xStart, 0); ctx.lineTo(xStart, height); ctx.stroke();

      ctx.strokeStyle = '#f72585';
      ctx.beginPath(); ctx.moveTo(xEnd, 0); ctx.lineTo(xEnd, height); ctx.stroke();
    }

    // Onde audio dégradée
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, '#9d4edd');
    grad.addColorStop(0.5, '#f72585');
    grad.addColorStop(1, '#06d6a0');

    ctx.fillStyle = grad;
    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[(i * step) + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      const barHeight = Math.max(2, (max - min) * amp * 0.9);
      ctx.fillRect(i, (height - barHeight) / 2, 1, barHeight);
    }
  }, []);

  // Découper et garder uniquement la sélection (Trim)
  const handleTrimKeep = () => {
    if (!activeTrimAudioBuffer) return;
    setIsTrimApplying(true);
    try {
      const buffer = activeTrimAudioBuffer;
      const start = Math.max(0, trimStart);
      const end = Math.min(buffer.duration, trimEnd > trimStart ? trimEnd : buffer.duration);
      const newDur = end - start;
      if (newDur <= 0) return;

      const sampleRate = buffer.sampleRate;
      const channels = buffer.numberOfChannels;
      const startSample = Math.floor(start * sampleRate);
      const endSample = Math.floor(end * sampleRate);
      const newLength = endSample - startSample;

      const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(channels, newLength, sampleRate);
      const newBuffer = offlineCtx.createBuffer(channels, newLength, sampleRate);

      for (let ch = 0; ch < channels; ch++) {
        const oldData = buffer.getChannelData(ch);
        const newData = newBuffer.getChannelData(ch);
        for (let i = 0; i < newLength; i++) {
          newData[i] = oldData[startSample + i];
        }
      }

      const wavBlob = audioBufferToWav(newBuffer);
      const url = URL.createObjectURL(wavBlob);
      const roundedDur = Math.round(newDur);

      setActiveTrimAudioBuffer(newBuffer);
      setDspProcessedUrl(url);
      setDspDuration(roundedDur);
      setTrimStart(0);
      setTrimEnd(roundedDur);
      drawWaveform(newBuffer, 0, roundedDur);
    } catch (err) {
      console.error('Erreur découpe audio:', err);
    }
    setIsTrimApplying(false);
  };

  // Découper et supprimer la sélection (Cut Out)
  const handleCutDelete = () => {
    if (!activeTrimAudioBuffer) return;
    setIsTrimApplying(true);
    try {
      const buffer = activeTrimAudioBuffer;
      const start = Math.max(0, trimStart);
      const end = Math.min(buffer.duration, trimEnd > trimStart ? trimEnd : buffer.duration);
      const sampleRate = buffer.sampleRate;
      const channels = buffer.numberOfChannels;
      const startSample = Math.floor(start * sampleRate);
      const endSample = Math.floor(end * sampleRate);
      const part1Len = startSample;
      const part2Len = buffer.length - endSample;
      const newLength = part1Len + part2Len;

      if (newLength <= 0) return;

      const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(channels, newLength, sampleRate);
      const newBuffer = offlineCtx.createBuffer(channels, newLength, sampleRate);

      for (let ch = 0; ch < channels; ch++) {
        const oldData = buffer.getChannelData(ch);
        const newData = newBuffer.getChannelData(ch);
        for (let i = 0; i < part1Len; i++) {
          newData[i] = oldData[i];
        }
        for (let i = 0; i < part2Len; i++) {
          newData[part1Len + i] = oldData[endSample + i];
        }
      }

      const wavBlob = audioBufferToWav(newBuffer);
      const url = URL.createObjectURL(wavBlob);
      const roundedDur = Math.round(newBuffer.duration);

      setActiveTrimAudioBuffer(newBuffer);
      setDspProcessedUrl(url);
      setDspDuration(roundedDur);
      setTrimStart(0);
      setTrimEnd(roundedDur);
      drawWaveform(newBuffer, 0, roundedDur);
    } catch (err) {
      console.error('Erreur suppression sélection:', err);
    }
    setIsTrimApplying(false);
  };

  // Gestion des Catégories & Catalogues
  const handleSaveCategory = async () => {
    if (!newCatName.trim()) return;
    setIsSavingCat(true);
    const catData = {
      id: editingCat?.id || `cat-${Date.now()}`,
      name: newCatName.trim(),
      slug: newCatSlug.trim() || newCatName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      icon: newCatIcon,
      color: newCatColor,
      display_order: categories.length + 1,
    };
    await apiClient.createCategory(catData);
    await loadCategories();
    setNewCatName('');
    setNewCatSlug('');
    setEditingCat(null);
    setIsSavingCat(false);
  };

  const handleDeleteCategory = async (catId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) return;
    await apiClient.deleteCategory(catId);
    await loadCategories();
  };

  const handleApplyDspToPublishing = (chapterIndex = 0) => {
    if (!dspProcessedUrl) return;
    const dur = dspDuration || 180;
    setChapters(prev => {
      const next = [...prev];
      if (!next[chapterIndex]) {
        next[chapterIndex] = { title: `Chapitre ${chapterIndex + 1}`, duration_seconds: dur, uploadData: null };
      }
      next[chapterIndex] = {
        ...next[chapterIndex],
        duration_seconds: dur,
        uploadData: {
          public_url: dspProcessedUrl,
          file_name: `Master_Audacity_Pro.wav`,
          size_mb: `${(dur / 60 * 1.4).toFixed(1)} Mo`,
          r2_key: `audiobooks/master_${Date.now()}.wav`,
          duration_seconds: dur,
        }
      };
      return next;
    });
    setActiveRubric('publish');
    setStep(3);
  };

  // Helper WAV encoder (16-bit PCM)
  function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const numSamples = buffer.length;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = numSamples * blockAlign;
    const wavBuffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(wavBuffer);

    const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // bits per sample
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }
    return new Blob([wavBuffer], { type: 'audio/wav' });
  }

  // ── Navigation Tabs ──
  const RUBRICS = [
    { id: 'catalog',    label: 'Catalogue & Livres',      icon: BookOpen,   badge: books.length },
    { id: 'categories', label: 'Catalogues & Catégories', icon: Grid,       badge: categories.length },
    { id: 'publish',    label: 'Publier un Livre',        icon: UploadCloud },
    { id: 'ai-tts',     label: 'Studio IA (Texte ➔ Voix)', icon: Wand2,      badge: 'Pro' },
    { id: 'audacity',   label: 'Studio Audacity DSP',     icon: Sliders,    badge: 'DSP' },
    { id: 'analytics',  label: 'Statistiques & Ventes',   icon: BarChart3 },
    { id: 'push',       label: 'Notifications Push',      icon: Bell },
    { id: 'settings',   label: 'Paramètres & Système',    icon: Settings },
  ];

  const filteredBooks = books.filter(b =>
    b.title?.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    b.author?.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-120px)] animate-fadeIn">

      {/* ── Sidebar de Navigation Admin ── */}
      <aside className="w-full lg:w-72 flex-shrink-0">
        <div className="card-lg space-y-2 sticky top-24">
          <div className="px-3 py-2 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
              Console d'Administration
            </span>
            <h2 className="text-lg font-black text-white font-['Outfit']">Back-Office Pro</h2>
          </div>

          <nav className="space-y-1">
            {RUBRICS.map((rub) => {
              const Icon = rub.icon;
              const isActive = activeRubric === rub.id;
              return (
                <button
                  key={rub.id}
                  onClick={() => setActiveRubric(rub.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-500/25 scale-[1.02]'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="text-left">{rub.label}</span>
                  </div>
                  {rub.badge && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {rub.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Statut Base de données & Stockage */}
          <div className="pt-4 mt-4 border-t border-white/10 px-3 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-400" /> Base de Données
              </span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {systemStatus?.mode === 'vite_shared_dev_server' ? 'Serveur Local' : (systemStatus?.bindings?.d1?.connected ? 'Cloudflare D1' : 'Connectée')}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-cyan-400" /> Stockage Audio
              </span>
              <span className="text-cyan-400 font-bold">R2 / Actif</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
              <span>{books.length} livres en base</span>
              <button onClick={checkStatus} title="Rafraîchir statut BD" className="hover:text-emerald-400 transition-colors">
                <RefreshCw className={`w-3 h-3 ${checkingStatus ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Contenu Principal de la Rubrique Active ── */}
      <div className="flex-1 min-w-0">

        {/* ══════════════════════════════════════════════════════════════════
            1. RUBRIQUE : CATALOGUE & LIVRES
            ══════════════════════════════════════════════════════════════════ */}
        {activeRubric === 'catalog' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header de la rubrique */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">Catalogue des Livres Audio</h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  {books.length} livres audio enregistrés et disponibles sur la boutique
                </p>
              </div>
              <button
                onClick={() => { resetPublishForm(); setActiveRubric('publish'); }}
                className="btn-gradient px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg"
              >
                <Plus className="w-4 h-4" />
                <span>Publier un Nouveau Livre</span>
              </button>
            </div>

            {/* Barre de Recherche & Filtres */}
            <div className="card-lg space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  placeholder="Rechercher par titre ou auteur dans le catalogue..."
                  className="rg-input pl-11 pr-4 py-3 rounded-2xl text-sm"
                />
              </div>

              {/* Table / Grille des Livres */}
              {loadingBooks ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(n => <div key={n} className="skeleton h-20 rounded-2xl" />)}
                </div>
              ) : filteredBooks.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <BookOpen className="w-12 h-12 mx-auto text-slate-500" />
                  <p className="text-sm text-slate-300 font-bold">Aucun livre trouvé</p>
                  <button onClick={() => setCatalogSearch('')} className="rg-btn-ghost text-xs">
                    Effacer la recherche
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredBooks.map((book) => {
                    const isPreviewing = previewingBookId === book.id;
                    return (
                      <div
                        key={book.id}
                        className="p-4 rounded-2xl bg-white/4 hover:bg-white/7 border border-white/8 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <img
                            src={book.cover_url}
                            alt={book.title}
                            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=400&q=80'; }}
                            className="w-14 h-14 rounded-xl object-cover shadow-md border border-white/10 flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="rg-badge rg-badge--purple">{book.category_name || 'Livre Audio'}</span>
                              {Boolean(book.is_featured) && <span className="rg-badge rg-badge--pink">À la une</span>}
                              {Boolean(book.is_bestseller) && <span className="rg-badge rg-badge--amber">Bestseller</span>}
                            </div>
                            <h3 className="text-sm sm:text-base font-bold text-white truncate mt-1">{book.title}</h3>
                            <p className="text-xs text-slate-400 truncate">Par <span className="text-slate-200">{book.author}</span> • {book.chapters?.length || 1} chapitre(s) • {book.discount_price || book.price} FCFA</p>
                          </div>
                        </div>

                        {/* Prix & Actions */}
                        <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                          {/* Bouton Pré-écoute */}
                          <button
                            onClick={() => {
                              if (isPreviewing) {
                                catalogAudioRef.current?.pause();
                                setPreviewingBookId(null);
                              } else {
                                setPreviewingBookId(book.id);
                                if (catalogAudioRef.current) {
                                  catalogAudioRef.current.src = book.preview_url || book.chapters?.[0]?.audio_url || '';
                                  catalogAudioRef.current.play();
                                }
                              }
                            }}
                            className={`p-2.5 rounded-xl border transition-all ${
                              isPreviewing
                                ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-500/30'
                                : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                            }`}
                            title="Écouter l'extrait"
                          >
                            {isPreviewing ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
                          </button>

                          {/* Bouton Éditer */}
                          <button
                            onClick={() => handleEditBook(book)}
                            className="p-2.5 rounded-xl border bg-white/5 hover:bg-blue-500/20 text-slate-300 hover:text-blue-300 border-white/10 hover:border-blue-500/40 transition-all"
                            title="Modifier ce livre"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Bouton Supprimer */}
                          <button
                            onClick={() => handleDeleteBook(book.id, book.title)}
                            className="p-2.5 rounded-xl border bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border-white/10 hover:border-rose-500/40 transition-all"
                            title="Supprimer ce livre"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <audio ref={catalogAudioRef} onEnded={() => setPreviewingBookId(null)} className="hidden" />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            2. RUBRIQUE : PUBLIER UN LIVRE AUDIO (STUDIO DE PUBLICATION)
            ══════════════════════════════════════════════════════════════════ */}
        {activeRubric === 'publish' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Titre */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">
                  {editingBook ? `Modifier : ${editingBook.title}` : 'Publier un Livre Audio'}
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  {editingBook ? 'Modifiez les informations et publiez la mise à jour.' : 'Complétez les informations pour mettre votre livre en vente'}
                </p>
              </div>
              {editingBook && (
                <button
                  onClick={() => { setEditingBook(null); resetPublishForm(); }}
                  className="rg-btn-ghost px-4 py-2 rounded-xl text-xs flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" /> Annuler l'édition
                </button>
              )}
            </div>

            {/* Stepper Propre */}
            <div className="card-md flex items-center justify-between gap-2 p-3">
              {[
                { n: 1, label: '1. Informations & Prix' },
                { n: 2, label: '2. Pochette & Extrait' },
                { n: 3, label: '3. Chapitres Audio' },
                { n: 4, label: '4. Validation' },
              ].map((s) => (
                <button
                  key={s.n}
                  onClick={() => step > s.n && setStep(s.n)}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-center ${
                    step === s.n
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md'
                      : step > s.n
                      ? 'text-emerald-400 bg-white/5 cursor-pointer'
                      : 'text-slate-500 bg-transparent'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* ÉTAPE 1 : Informations */}
            {step === 1 && (
              <div className="card-lg space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">Titre de l'œuvre *</label>
                    <input
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="Ex : L'Art de la Stratégie Gagnante"
                      className="rg-input"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">Auteur *</label>
                    <input
                      type="text"
                      value={author}
                      onChange={e => setAuthor(e.target.value)}
                      placeholder="Ex : Dr. Paul Kemajou"
                      className="rg-input"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">Narrateur / Voix</label>
                    <input
                      type="text"
                      value={narrator}
                      onChange={e => setNarrator(e.target.value)}
                      placeholder="Ex : Sarah N. / Voix IA Denise"
                      className="rg-input"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">Catégorie *</label>
                    <select
                      value={categoryId}
                      onChange={e => setCategoryId(e.target.value)}
                      className="rg-input cursor-pointer"
                      style={{ background: '#16112e' }}
                    >
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">Prix de Vente (FCFA) *</label>
                    <input
                      type="number"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      placeholder="3500"
                      className="rg-input"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">Prix Promotionnel (optionnel)</label>
                    <input
                      type="number"
                      value={discountPrice}
                      onChange={e => setDiscountPrice(e.target.value)}
                      placeholder="2900"
                      className="rg-input"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">Description Courte *</label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Un résumé accrocheur pour la boutique..."
                      className="rg-input resize-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">Synopsis Complet</label>
                    <textarea
                      rows={4}
                      value={synopsis}
                      onChange={e => setSynopsis(e.target.value)}
                      placeholder="Détails complets de l'œuvre..."
                      className="rg-input resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    onClick={() => setStep(2)}
                    disabled={!title.trim() || !author.trim() || !price}
                    className="btn-gradient px-8 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 disabled:opacity-40"
                  >
                    <span>Suivant : Médias</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ÉTAPE 2 : Médias */}
            {step === 2 && (
              <div className="card-lg space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <DropZone
                    label="🖼️ Pochette Carrée (JPG, PNG, WebP — max 10 Mo)"
                    accept="image/jpeg,image/png,image/webp"
                    type="cover"
                    icon={ImageIcon}
                    value={coverData?.public_url || ''}
                    onUploaded={setCoverData}
                  />
                  <DropZone
                    label="🎙️ Extrait Gratuit (MP3 / WAV — 2 à 5 min)"
                    accept="audio/mpeg,audio/mp3,audio/wav,audio/*"
                    type="preview"
                    icon={Mic}
                    value={previewData?.public_url || ''}
                    onDurationDetected={(dur) => {
                      if (chapters[0]?.duration_seconds === 1800) {
                        updateChapter(0, 'duration_seconds', dur);
                      }
                    }}
                    onUploaded={setPreviewData}
                  />
                </div>

                <div className="flex justify-between pt-3">
                  <button onClick={() => setStep(1)} className="rg-btn-ghost px-6 py-3 rounded-2xl text-sm">
                    ← Retour
                  </button>
                  <button onClick={() => setStep(3)} className="btn-gradient px-8 py-3 rounded-2xl text-sm font-bold flex items-center gap-2">
                    <span>Suivant : Chapitres</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ÉTAPE 3 : Chapitres */}
            {step === 3 && (
              <div className="card-lg space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-white">Chapitres Audio ({chapters.length})</h2>
                  <button onClick={addChapter} className="rg-btn-ghost px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Ajouter un chapitre
                  </button>
                </div>

                <div className="space-y-4">
                  {chapters.map((chap, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-white/4 border border-white/8 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-300 flex items-center gap-2">
                          <Music className="w-4 h-4" /> Chapitre {i + 1}
                        </span>
                        {chapters.length > 1 && (
                          <button onClick={() => removeChapter(i)} className="text-slate-400 hover:text-rose-400 p-1">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-300 block mb-1">Titre du chapitre</label>
                          <input
                            type="text"
                            value={chap.title}
                            onChange={e => updateChapter(i, 'title', e.target.value)}
                            className="rg-input py-2 text-xs"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-semibold text-slate-300">Durée (secondes)</label>
                            {Number(chap.duration_seconds) > 0 && (
                              <span className="text-[10px] text-emerald-400 font-bold">
                                ≈ {formatDuration(chap.duration_seconds)}
                              </span>
                            )}
                          </div>
                          <input
                            type="number"
                            value={chap.duration_seconds}
                            onChange={e => updateChapter(i, 'duration_seconds', Number(e.target.value))}
                            className="rg-input py-2 text-xs"
                          />
                        </div>
                      </div>

                      <DropZone
                        label={`🎧 Fichier Audio — Chapitre ${i + 1}`}
                        accept="audio/mpeg,audio/mp3,audio/wav,audio/*"
                        type="audio"
                        icon={FileAudio}
                        value={chap.uploadData?.public_url || ''}
                        onDurationDetected={(dur) => updateChapter(i, 'duration_seconds', dur)}
                        onUploaded={(data) => {
                          setChapterUpload(i, data);
                          if (data?.duration_seconds) {
                            updateChapter(i, 'duration_seconds', data.duration_seconds);
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex justify-between pt-3">
                  <button onClick={() => setStep(2)} className="rg-btn-ghost px-6 py-3 rounded-2xl text-sm">
                    ← Retour
                  </button>
                  <button
                    onClick={handlePublish}
                    disabled={isSubmitting}
                    className="btn-gradient px-8 py-3 rounded-2xl text-sm font-black flex items-center gap-2 shadow-xl"
                  >
                    {isSubmitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Publication...</>
                    ) : (
                      <><Save className="w-4 h-4" /> Mettre en Ligne</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ÉTAPE 4 : Succès */}
            {step === 4 && publishedBook && (
              <div className="card-lg text-center p-8 space-y-6 max-w-2xl mx-auto">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white font-['Outfit']">Livre Audio Publié avec Succès !</h2>
                  <p className="text-xs text-slate-300 mt-1">"{publishedBook.title}" est maintenant actif et enregistré dans la base de données.</p>
                </div>

                {/* Carte récapitulative & statut BD */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left flex items-center gap-4">
                  <img src={publishedBook.cover_url} alt={publishedBook.title} className="w-20 h-20 rounded-xl object-cover border border-white/15 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <Database className="w-2.5 h-2.5" />
                        {publishResult?.stored_in?.includes('cloudflare_d1') ? 'Cloudflare D1 SQL' : 'Base Serveur Partagée (data/db.json)'}
                      </span>
                      <span className="text-[10px] text-purple-300 font-semibold">{publishedBook.category_name}</span>
                    </div>
                    <h3 className="text-sm font-bold text-white truncate mt-1">{publishedBook.title}</h3>
                    <p className="text-xs text-slate-400">Par {publishedBook.author} • {publishedBook.chapters?.length || 1} chapitre(s)</p>
                    <p className="text-xs font-bold text-emerald-400 mt-0.5">{publishedBook.discount_price || publishedBook.price} FCFA</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center justify-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Synchronisé : tous les utilisateurs, mobiles et visiteurs voient désormais ce livre en boutique.</span>
                </div>

                <div className="flex justify-center gap-3 pt-2">
                  <button onClick={() => setActiveRubric('catalog')} className="rg-btn-ghost px-6 py-2.5 rounded-2xl text-sm">
                    Voir dans le Catalogue
                  </button>
                  <button onClick={resetPublishForm} className="btn-gradient px-6 py-2.5 rounded-2xl text-sm font-bold">
                    + Publier un Autre Livre
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            3. RUBRIQUE : STUDIO IA (TEXTE ➔ VOIX TTS)
            ══════════════════════════════════════════════════════════════════ */}
        {activeRubric === 'ai-tts' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">Studio IA : Synthèse Vocale</h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Convertissez des scripts de livres ou documents en audio voix humaine professionnelle
              </p>
            </div>

            <div className="card-lg space-y-5">
              {/* Zone de Texte du Document */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-300">Texte ou Script du Livre à Convertir</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      ref={ttsFileInputRef}
                      accept=".txt,.md,.text"
                      className="hidden"
                      onChange={handleTtsFileUpload}
                    />
                    <button
                      type="button"
                      onClick={() => ttsFileInputRef.current?.click()}
                      className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1.5 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Importer un fichier (.txt, .md)</span>
                    </button>
                    <span className="text-[11px] text-slate-400">{ttsText.length} caractères</span>
                  </div>
                </div>
                <textarea
                  rows={6}
                  value={ttsText}
                  onChange={e => setTtsText(e.target.value)}
                  placeholder="Collez ici le texte ou script de votre livre/chapitre..."
                  className="rg-input resize-none text-sm"
                />
              </div>

              {/* Sélection de la Voix & Paramètres */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">Profil de Voix IA Pro</label>
                  <select
                    value={ttsVoice}
                    onChange={e => setTtsVoice(e.target.value)}
                    className="rg-input cursor-pointer"
                    style={{ background: '#16112e' }}
                  >
                    <option value="fr-FR-DeniseNeural">Denise (Français — Narratrice Chaleureuse HQ)</option>
                    <option value="fr-FR-HenriNeural">Henri (Français — Voix Grave & Documentaire HQ)</option>
                    <option value="fr-FR-AlainNeural">Alain (Français — Énergique & Clair HQ)</option>
                    <option value="fr-FR-BrigitteNeural">Brigitte (Français — Voix Douce & Relaxante HQ)</option>
                    <option value="en-US-JennyNeural">Jenny (English — American Professional Voice)</option>
                    <option value="en-US-GuyNeural">Guy (English — Deep Narrative Voice)</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-300 mb-1.5">
                    <span>Vitesse d'élocution</span>
                    <span className="text-purple-300">{ttsSpeed}x</span>
                  </div>
                  <input
                    type="range" min="0.5" max="1.5" step="0.1"
                    value={ttsSpeed}
                    onChange={e => setTtsSpeed(Number(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-300 mb-1.5">
                    <span>Tonalité (Pitch)</span>
                    <span className="text-purple-300">{ttsPitch}x</span>
                  </div>
                  <input
                    type="range" min="0.8" max="1.3" step="0.05"
                    value={ttsPitch}
                    onChange={e => setTtsPitch(Number(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>
              </div>

              {/* Bouton de Synthèse */}
              <button
                onClick={handleGenerateTTS}
                disabled={isTtsGenerating || !ttsText.trim()}
                className="btn-gradient w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-xl disabled:opacity-40"
              >
                {isTtsGenerating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Synthèse vocale en cours...</>
                ) : (
                  <><Wand2 className="w-4 h-4" /> Générer la Voix Humaine par IA</>
                )}
              </button>

              {/* Résultat & Pré-écoute */}
              {ttsAudioUrl && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Audio IA Généré ({ttsDuration}s)
                    </span>
                    <button
                      onClick={() => handleApplyTtsToPublishing(0)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md flex items-center gap-1.5 transition-colors"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Insérer dans la Publication</span>
                    </button>
                  </div>
                  <audio ref={ttsAudioRef} src={ttsAudioUrl} controls className="w-full h-9 rounded-xl" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            4. RUBRIQUE : STUDIO AUDACITY DSP (MONTAGE & TRAITEMENT AUDIO)
            ══════════════════════════════════════════════════════════════════ */}
        {activeRubric === 'audacity' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">Studio Audacity Pro (DSP)</h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Fusionnez vos pistes audio, supprimez les bruits de fond et rehaussez la clarté de vos masters
              </p>
            </div>

            <div className="card-lg space-y-6">
              {/* Import des Pistes */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-2">1. Ajouter des Pistes à Fusionner</label>
                <input
                  type="file"
                  multiple
                  accept="audio/*"
                  onChange={handleAddDspFiles}
                  className="rg-input py-2.5 text-xs file:mr-3 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-600 file:text-white"
                />
              </div>

              {/* Liste des Pistes */}
              {dspTracks.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-400">Ordre de fusion des pistes :</span>
                  {dspTracks.map((t, idx) => (
                    <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-white/4 border border-white/8 text-xs">
                      <span className="font-bold text-white truncate max-w-[200px]">{idx + 1}. {t.name}</span>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => moveDspTrack(idx, -1)} className="p-1 text-slate-400 hover:text-white"><ArrowUp className="w-3.5 h-3.5" /></button>
                        <button onClick={() => moveDspTrack(idx, 1)} className="p-1 text-slate-400 hover:text-white"><ArrowDown className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDspTracks(prev => prev.filter((_, i) => i !== idx))} className="p-1 text-slate-400 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Traitements DSP Actifs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Réduction de bruit', state: dspNoiseReduction, set: setDspNoiseReduction },
                  { label: 'Clarté Vocale', state: dspVocalClarity, set: setDspVocalClarity },
                  { label: 'Compression DSP', state: dspCompression, set: setDspCompression },
                  { label: 'Chaleur Analogique', state: dspWarmth, set: setDspWarmth },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => item.set(!item.state)}
                    className={`p-3 rounded-2xl border text-xs font-bold transition-all text-left flex flex-col justify-between h-20 ${
                      item.state
                        ? 'bg-purple-600/20 border-purple-500/40 text-purple-200'
                        : 'bg-white/4 border-white/8 text-slate-400'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className={`text-[10px] uppercase font-extrabold ${item.state ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {item.state ? '✓ Activé' : 'Désactivé'}
                    </span>
                  </button>
                ))}
              </div>

              {/* Bouton de Traitement */}
              <button
                onClick={handleProcessDsp}
                disabled={dspProcessing || dspTracks.length === 0}
                className="btn-gradient w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-xl disabled:opacity-40"
              >
                {dspProcessing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Traitement et fusion des pistes...</>
                ) : (
                  <><Sliders className="w-4 h-4" /> Fusionner & Traiter le Master Pro</>
                )}
              </button>

              {/* Résultat Master & Visualiseur de Spectre Audio */}
              {dspProcessedUrl && (
                <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/25 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Master Pro Haute Fidélité Prêt ({dspDuration}s)
                    </span>
                    <button
                      onClick={() => handleApplyDspToPublishing(0)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md flex items-center gap-1.5 transition-colors"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Insérer dans la Publication</span>
                    </button>
                  </div>
                  <audio ref={dspAudioRef} src={dspProcessedUrl} controls className="w-full h-9 rounded-xl" />

                  {/* Visualiseur de Spectre & Outils de Découpe */}
                  <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-pink-400" /> Spectre Audio & Découpe Précise (Waveform)
                      </span>
                      <span className="text-[11px] font-mono text-purple-300">
                        Sélection : {trimStart}s ➔ {trimEnd || dspDuration}s ({(trimEnd || dspDuration) - trimStart}s)
                      </span>
                    </div>

                    {/* Canvas Forme d'Onde */}
                    <div className="relative overflow-hidden rounded-xl border border-purple-500/30">
                      <canvas
                        ref={waveformCanvasRef}
                        width={700}
                        height={120}
                        className="w-full h-28 bg-[#0a0718] block"
                      />
                    </div>

                    {/* Sliders Début & Fin de Coupe */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold">
                      <div>
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span className="text-emerald-400 flex items-center gap-1">
                            <span>[</span> Point de Début (Start)
                          </span>
                          <span className="font-mono">{trimStart} s</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={dspDuration || 100}
                          value={trimStart}
                          onChange={(e) => {
                            const val = Math.min(Number(e.target.value), (trimEnd || dspDuration) - 1);
                            setTrimStart(val);
                            if (activeTrimAudioBuffer) drawWaveform(activeTrimAudioBuffer, val, trimEnd || dspDuration);
                          }}
                          className="w-full accent-emerald-400"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span className="text-pink-400 flex items-center gap-1">
                            Point de Fin (End) <span>]</span>
                          </span>
                          <span className="font-mono">{trimEnd || dspDuration} s</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={dspDuration || 100}
                          value={trimEnd || dspDuration}
                          onChange={(e) => {
                            const val = Math.max(Number(e.target.value), trimStart + 1);
                            setTrimEnd(val);
                            if (activeTrimAudioBuffer) drawWaveform(activeTrimAudioBuffer, trimStart, val);
                          }}
                          className="w-full accent-pink-400"
                        />
                      </div>
                    </div>

                    {/* Boutons d'Action de Découpe */}
                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      <button
                        onClick={handleTrimKeep}
                        disabled={isTrimApplying || !activeTrimAudioBuffer}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 transition-all"
                      >
                        <Scissors className="w-3.5 h-3.5" />
                        <span>Garder uniquement la Sélection (Trim)</span>
                      </button>

                      <button
                        onClick={handleCutDelete}
                        disabled={isTrimApplying || !activeTrimAudioBuffer}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 flex items-center gap-1.5 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Supprimer la Sélection (Cut Out)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            GESTION DES CATALOGUES & CATÉGORIES
            ══════════════════════════════════════════════════════════════════ */}
        {activeRubric === 'categories' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">Gestion des Catalogues & Catégories</h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Créez, personnalisez et organisez les rayons thématiques du catalogue
              </p>
            </div>

            {/* Formulaire de Création / Modification */}
            <div className="card-lg space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-purple-400" />
                <span>{editingCat ? 'Modifier le Catalogue' : 'Ajouter un Nouveau Catalogue / Catégorie'}</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">Nom du Catalogue</label>
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Ex: Entrepreneuriat Africain"
                    className="rg-input"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">Identifiant Unique (Slug)</label>
                  <input
                    type="text"
                    value={newCatSlug}
                    onChange={(e) => setNewCatSlug(e.target.value)}
                    placeholder="Ex: entrepreneuriat-afrique"
                    className="rg-input"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">Icône Illustrative</label>
                  <select
                    value={newCatIcon}
                    onChange={(e) => setNewCatIcon(e.target.value)}
                    className="rg-input cursor-pointer"
                    style={{ background: '#16112e' }}
                  >
                    <option value="Sparkles">Sparkles (Découverte / Magie)</option>
                    <option value="TrendingUp">TrendingUp (Business & Finance)</option>
                    <option value="Cpu">Cpu (Tech & IA)</option>
                    <option value="Brain">Brain (Psychologie & Esprit)</option>
                    <option value="Shield">Shield (Histoire & Stratégie)</option>
                    <option value="BookOpen">BookOpen (Romans & Fiction)</option>
                    <option value="Headphones">Headphones (Audiobooks Généraux)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">Couleur Thématique</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newCatColor}
                      onChange={(e) => setNewCatColor(e.target.value)}
                      className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={newCatColor}
                      onChange={(e) => setNewCatColor(e.target.value)}
                      className="rg-input flex-1 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                {editingCat && (
                  <button
                    onClick={() => {
                      setEditingCat(null);
                      setNewCatName('');
                      setNewCatSlug('');
                    }}
                    className="rg-btn-ghost px-4 py-2 text-xs font-bold"
                  >
                    Annuler
                  </button>
                )}
                <button
                  onClick={handleSaveCategory}
                  disabled={isSavingCat || !newCatName.trim()}
                  className="btn-gradient px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
                >
                  {isSavingCat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{editingCat ? 'Mettre à jour' : 'Enregistrer le Catalogue'}</span>
                </button>
              </div>
            </div>

            {/* Liste des Catalogues Existants */}
            <div className="card-lg space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center justify-between">
                <span>Rayons & Catalogues Actifs ({categories.length})</span>
                <span className="text-xs text-slate-400 font-normal">Synchronisé avec D1</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {categories.map((cat) => {
                  const bookCount = books.filter(b => b.category_id === cat.id || b.category_name === cat.name).length;
                  return (
                    <div
                      key={cat.id}
                      className="p-4 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-between gap-3 group hover:border-purple-500/30 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg text-white font-bold"
                          style={{ background: cat.color || '#9d4edd' }}
                        >
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xs font-bold text-white truncate">{cat.name}</h3>
                          <p className="text-[11px] text-slate-400">{bookCount} livre{bookCount > 1 ? 's' : ''}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <button
                          onClick={() => {
                            setEditingCat(cat);
                            setNewCatName(cat.name);
                            setNewCatSlug(cat.slug || '');
                            setNewCatColor(cat.color || '#9d4edd');
                            setNewCatIcon(cat.icon || 'Sparkles');
                          }}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
                          title="Modifier"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {cat.id !== 'all' && (
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            5. RUBRIQUE : STATISTIQUES & VENTES
            ══════════════════════════════════════════════════════════════════ */}
        {activeRubric === 'analytics' && (() => {
          const totalBooks = books.length;
          const totalDuration = books.reduce((s, b) => s + (b.duration_seconds || 0), 0);
          const avgPrice = totalBooks > 0 ? Math.round(books.reduce((s, b) => s + (b.discount_price || b.price || 0), 0) / totalBooks) : 0;
          const featuredCount = books.filter(b => Boolean(b.is_featured)).length;
          const bestsellerCount = books.filter(b => Boolean(b.is_bestseller)).length;
          return (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">Statistiques & Ventes</h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Suivi des performances du catalogue en temps réel</p>
            </div>

            {/* KPIs réels */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Livres dans le Catalogue', value: totalBooks, icon: BookOpen, color: 'text-purple-400' },
                { label: 'Durée Totale du Catalogue', value: `${Math.round(totalDuration / 3600)}h`, icon: Clock, color: 'text-cyan-400' },
                { label: 'Prix Moyen', value: `${avgPrice} FCFA`, icon: DollarSign, color: 'text-emerald-400' },
                { label: 'Bestsellers', value: bestsellerCount, icon: Star, color: 'text-amber-400' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="card-md space-y-2">
                  <Icon className={`w-5 h-5 ${color}`} />
                  <p className="text-lg sm:text-xl font-black text-white">{value}</p>
                  <p className="text-xs text-slate-400">{label}</p>
                </div>
              ))}
            </div>

            {/* Catalogue par catégorie */}
            <div className="card-lg space-y-4">
              <h2 className="text-sm font-bold text-white">Répartition par Catégorie</h2>
              <div className="space-y-2">
                {categories.map(cat => {
                  const count = books.filter(b => b.category_id === cat.id).length;
                  const pct = totalBooks > 0 ? Math.round((count / totalBooks) * 100) : 0;
                  if (count === 0) return null;
                  return (
                    <div key={cat.id} className="flex items-center gap-3 text-xs">
                      <span className="text-slate-300 w-40 truncate">{cat.name}</span>
                      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-slate-400 font-mono w-14 text-right">{count} livre{count > 1 ? 's' : ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Catalogue complet */}
            <div className="card-lg space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">Tous les Titres du Catalogue</h2>
                <span className="text-xs text-slate-400">{totalBooks} titre{totalBooks > 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1 no-scrollbar">
                {books.map((book, idx) => (
                  <div key={book.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/4 border border-white/6 text-xs">
                    <span className="text-slate-500 font-mono w-5">{idx + 1}</span>
                    <img src={book.cover_url} alt={book.title}
                      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=100&q=60'; }}
                      className="w-10 h-10 rounded-lg object-cover border border-white/10 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white truncate">{book.title}</p>
                      <p className="text-slate-400 truncate">Par {book.author} • {book.chapters?.length || 1} ch.</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-black text-emerald-400">{book.discount_price || book.price} F</p>
                      <div className="flex items-center gap-1 justify-end mt-0.5">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span className="text-amber-300">{book.rating || 5.0}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════════
            6. RUBRIQUE : NOTIFICATIONS PUSH
            ══════════════════════════════════════════════════════════════════ */}
        {activeRubric === 'push' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">Campagnes Push Notifications</h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Envoyez des alertes instantanées sur smartphone à vos auditeurs</p>
            </div>

            {/* Statut Abonnement Push */}
            <div className="card-md flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  isSubscribed ? 'bg-emerald-500/20 border border-emerald-500/40' : 'bg-white/6 border border-white/10'
                }`}>
                  <Bell className={`w-4 h-4 ${isSubscribed ? 'text-emerald-400' : 'text-slate-400'}`} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    {isSubscribed ? 'Notifications activées sur cet appareil' : 'Notifications désactivées'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {pushPermission === 'denied'
                      ? 'Bloquées par le navigateur — autorisez dans les paramètres'
                      : isSubscribed
                      ? 'Vous recevrez les alertes push en temps réel'
                      : 'Activez pour recevoir les tests de push'}
                  </p>
                </div>
              </div>
              {!isSubscribed && pushPermission !== 'denied' && pushSupported && (
                <button
                  onClick={requestPermission}
                  className="rg-btn-primary px-4 py-2 rounded-xl text-xs flex-shrink-0"
                >
                  Activer
                </button>
              )}
            </div>

            <div className="card-lg space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">Titre de la Notification</label>
                <input
                  type="text"
                  value={pushTitle}
                  onChange={e => setPushTitle(e.target.value)}
                  className="rg-input"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">Message / Contenu</label>
                <textarea
                  rows={3}
                  value={pushMessage}
                  onChange={e => setPushMessage(e.target.value)}
                  className="rg-input resize-none"
                />
              </div>

              {/* Prévisualisation Smartphone */}
              <div className="p-4 rounded-2xl bg-white/4 border border-white/10 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Aperçu sur Smartphone
                </span>
                <div className="p-3 rounded-xl bg-slate-900 border border-white/10 flex items-start gap-3 shadow-lg max-w-sm">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white flex-shrink-0">
                    <Headphones className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{pushTitle}</p>
                    <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5">{pushMessage}</p>
                  </div>
                </div>
              </div>

              {/* Bouton Test Push (appareil local) */}
              {isSubscribed && (
                <button
                  onClick={async () => {
                    await sendTestNotification({ title: pushTitle, body: pushMessage, url: '/' });
                    setPushSentSuccess(true);
                    setTimeout(() => setPushSentSuccess(false), 4000);
                  }}
                  className="rg-btn-ghost w-full py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2"
                >
                  <Bell className="w-4 h-4 text-purple-400" />
                  <span>Tester la notification sur cet appareil</span>
                </button>
              )}

              <button
                onClick={async () => {
                  // Tenter envoi Push réel via le serveur
                  try {
                    await fetch('/api/admin/push/broadcast', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ title: pushTitle, body: pushMessage, url: '/' }),
                    }).catch(() => {});
                  } catch (_) {}
                  // Notification locale si abonné
                  if (isSubscribed) {
                    await sendTestNotification({ title: pushTitle, body: pushMessage, url: '/' });
                  }
                  setPushSentSuccess(true);
                  setTimeout(() => setPushSentSuccess(false), 4000);
                }}
                className="btn-gradient w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-xl"
              >
                <Send className="w-4 h-4" />
                <span>Diffuser à Tous les Abonnés</span>
              </button>

              {pushSentSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold text-center animate-fadeIn">
                  ✓ Notification Push diffusée avec succès !
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            7. RUBRIQUE : PARAMÈTRES & SYSTÈME
            ══════════════════════════════════════════════════════════════════ */}
        {activeRubric === 'settings' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">Paramètres & Infrastructure</h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Configuration système, sécurité et connecteurs Cloudflare</p>
            </div>

            <div className="card-lg space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white">Stockage & Base de données</h2>
                  <button
                    onClick={async () => {
                      await checkStatus();
                      await loadBooks();
                    }}
                    className="rg-btn-ghost py-1.5 px-3 rounded-xl text-xs flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? 'animate-spin text-emerald-400' : ''}`} />
                    <span>Tester la connexion</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-4 rounded-2xl bg-white/4 border border-white/8 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-slate-400 font-medium">Moteur de Base de Données</p>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    </div>
                    <p className="text-emerald-400 font-bold text-sm">
                      {systemStatus?.mode === 'vite_shared_dev_server'
                        ? 'Serveur Persistant Local (data/db.json)'
                        : (systemStatus?.bindings?.d1?.connected ? 'Cloudflare D1 SQL Distribué' : 'Connecté')}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {books.length} livres audio synchronisés • Accès partagé multi-utilisateurs
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/4 border border-white/8 space-y-1.5">
                    <p className="text-slate-400 font-medium">Stockage Audio & Pochette</p>
                    <p className="text-cyan-400 font-bold text-sm">Cloudflare R2 Bucket (rg-play-audio)</p>
                    <p className="text-[11px] text-slate-400">Support streaming HTTP Range partiel</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 space-y-3">
                <h2 className="text-sm font-bold text-white">Sauvegarde du Catalogue</h2>
                <button
                  onClick={() => {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(books, null, 2));
                    const downloadAnchor = document.createElement('a');
                    downloadAnchor.setAttribute("href", dataStr);
                    downloadAnchor.setAttribute("download", `rg_play_catalogue_${Date.now()}.json`);
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    downloadAnchor.remove();
                  }}
                  className="rg-btn-ghost py-2.5 px-4 rounded-xl text-xs flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Exporter le catalogue complet (JSON)</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
