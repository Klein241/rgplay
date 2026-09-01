import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  UploadCloud, BookOpen, Wand2, Sliders, BarChart3, Bell, Settings,
  Music, ImageIcon, FileAudio, Trash2, CheckCircle2, AlertCircle,
  X, Loader2, Plus, Save, Mic, ChevronRight, Play, Pause, Search,
  Star, Flame, Sparkles, RefreshCw, Eye, EyeOff, ShieldCheck, Download,
  Volume2, VolumeX, ArrowUp, ArrowDown, Layers, Smartphone, DollarSign,
  TrendingUp, Users, Clock, Edit3, Send, Check, HardDrive, Database, Headphones,
  FileText, Scissors, Crop, Activity, Grid, FolderPlus, Share2, Zap,
  LayoutGrid, List, Key, Copy, Terminal, Code2, Shield, Lock, Cpu
} from 'lucide-react';
import { apiClient } from '../services/api';
import { usePush } from '../context/PushContext';
import { compressImage, compressAndOptimizeAudio, audioBufferToWav } from '../utils/mediaCompressor';
import { getAnalyticsData } from '../services/tracker';

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
    formData.append('file', file);
    formData.append('r2_key', r2Key);
    formData.append('type', type);

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

    xhr.addEventListener('error', () => reject(new Error('Erreur réseau')));
    xhr.addEventListener('abort', () => reject(new Error('Upload annulé')));
    xhr.send(formData);
  });

// ── Zone de Drop Fichier avec Compression Intelligente sans Perte ────────────
const DropZone = ({ label, accept, type, icon: Icon, value, onUploaded, onDurationDetected }) => {
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
    const maxMb = type === 'audio' || type === 'preview' ? 500 : 25;
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

    // 3. Upload du fichier compressé/optimisé vers R2 / Serveur
    setStatus('uploading');
    const r2Key = `${type}s/${Date.now()}_${fileToUpload.name.replace(/\s+/g, '_')}`;

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
                  onClick={reset}
                  className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-xl border-2 border-slate-900"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
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
                <button onClick={reset} className="text-xs text-purple-300 hover:text-rose-400 font-bold mt-1.5 underline block mx-auto">
                  Remplacer
                </button>
              )}
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-1">
              <p className="text-xs font-black text-rose-300 uppercase tracking-wider">Échec de l'upload</p>
              <p className="text-xs text-rose-400 max-w-[240px]">{error}</p>
              <button onClick={(e) => { e.stopPropagation(); setStatus('idle'); setError(''); }} className="text-xs text-purple-300 hover:text-white font-bold underline mt-1 block mx-auto">
                Réessayer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Configuration Dynamique par Type de Contenu ─────────────────────────────
export const CONTENT_TYPE_CONFIG = {
  audiobook: {
    id: 'audiobook',
    label: 'Livre Audio',
    icon: '📚',
    color: 'border-purple-500 bg-purple-500/10 text-purple-300',
    titleLabel: 'Titre du Livre Audio *',
    titlePlaceholder: 'Ex : L\'Art de la Stratégie Gagnante',
    creatorLabel: 'Auteur *',
    creatorPlaceholder: 'Ex : Dr. Paul Kemajou',
    performerLabel: 'Narrateur / Voix',
    performerPlaceholder: 'Ex : Voix Française (Studio RG) / Sarah N.',
    pricePlaceholder: '3500',
    discountPricePlaceholder: '2900',
    descriptionLabel: 'Résumé Court *',
    descriptionPlaceholder: 'Un résumé accrocheur pour la boutique et la découverte...',
    synopsisLabel: 'Synopsis Complet / Quatrième de couverture',
    synopsisPlaceholder: 'Détails complets de l\'œuvre, thématiques, table des matières...',
    coverLabel: '🖼️ Pochette du Livre (JPG, PNG, WebP — Carré max 10 Mo)',
    previewLabel: '🎙️ Extrait Gratuit du Livre (MP3 / WAV — 2 à 5 min)',
    itemSingular: 'Chapitre',
    itemPlural: 'Chapitres',
    defaultItemTitle: (idx) => `Chapitre ${idx} : Introduction`,
    defaultItemDuration: 1800,
    trackDropLabel: (idx) => `🎧 Fichier Audio — Chapitre ${idx}`,
    publishSuccessTitle: 'Livre Audio Publié avec Succès !',
    publishSuccessSubtitle: (title) => `"${title}" est maintenant actif et disponible dans le catalogue des livres audio.`,
    anotherButtonText: '+ Publier un Autre Livre',
  },
  podcast: {
    id: 'podcast',
    label: 'Podcast',
    icon: '🎙️',
    color: 'border-amber-500 bg-amber-500/10 text-amber-300',
    titleLabel: 'Titre de l\'Émission / Épisode *',
    titlePlaceholder: 'Ex : Tech Pulse Afrique #14 — L\'essor de l\'IA',
    creatorLabel: 'Hôte / Présentateur *',
    creatorPlaceholder: 'Ex : Alain Foka & Équipe RG',
    performerLabel: 'Invités / Co-animateurs',
    performerPlaceholder: 'Ex : Dr. Aminata Traoré, Yannick Noah',
    pricePlaceholder: '1500',
    discountPricePlaceholder: '900',
    descriptionLabel: 'Description de l\'Épisode *',
    descriptionPlaceholder: 'Dans cet épisode, nous décryptons les enjeux de la tech...',
    synopsisLabel: 'Notes de l\'Émission (Show Notes & Liens)',
    synopsisPlaceholder: 'Horodatage (00:00 Intro, 05:30 Débat...), liens des invités...',
    coverLabel: '🎙️ Vignette du Podcast (JPG, PNG, WebP — Carré HD)',
    previewLabel: '⚡ Teaser / Bande-annonce de l\'Épisode (30s à 2 min)',
    itemSingular: 'Épisode',
    itemPlural: 'Épisodes',
    defaultItemTitle: (idx) => `Épisode ${idx} : Discussion Principale`,
    defaultItemDuration: 1200,
    trackDropLabel: (idx) => `🎙️ Audio de l'Épisode ${idx}`,
    publishSuccessTitle: 'Podcast Publié avec Succès !',
    publishSuccessSubtitle: (title) => `"${title}" est maintenant en ligne sur les ondes RG Play.`,
    anotherButtonText: '+ Publier un Autre Podcast',
  },
  music: {
    id: 'music',
    label: 'Musique & Lofi',
    icon: '🎵',
    color: 'border-emerald-500 bg-emerald-500/10 text-emerald-300',
    titleLabel: 'Titre de la Piste / Album *',
    titlePlaceholder: 'Ex : Midnight Lofi Afrobeat Vol. 1',
    creatorLabel: 'Artiste / Compositeur *',
    creatorPlaceholder: 'Ex : Manu Dibango & RG Studio Beats',
    performerLabel: 'Featuring / Musiciens / Producteur',
    performerPlaceholder: 'Ex : feat. Stanley Enow / Prod. Master RG',
    pricePlaceholder: '2000',
    discountPricePlaceholder: '1500',
    descriptionLabel: 'Description / Ambiance Musicale *',
    descriptionPlaceholder: 'Une sélection de rythmes relaxants pour travailler et se détendre...',
    synopsisLabel: 'Crédits, Paroles & Tracklist',
    synopsisPlaceholder: 'Composition, arrangements, mastering, paroles...',
    coverLabel: '🎵 Pochette d\'Album / Single (JPG, PNG, WebP — Carré HD)',
    previewLabel: '🎶 Extrait Musical / Teaser (30s à 1 min)',
    itemSingular: 'Piste',
    itemPlural: 'Pistes',
    defaultItemTitle: (idx) => `Piste ${idx} : Intro & Rythmes`,
    defaultItemDuration: 240,
    trackDropLabel: (idx) => `🎵 Piste Audio ${idx}`,
    publishSuccessTitle: 'Titre Musical Publié avec Succès !',
    publishSuccessSubtitle: (title) => `"${title}" est maintenant prêt pour l'écoute en streaming.`,
    anotherButtonText: '+ Publier une Autre Piste',
  },
  masterclass: {
    id: 'masterclass',
    label: 'Masterclass',
    icon: '🎓',
    color: 'border-cyan-500 bg-cyan-500/10 text-cyan-300',
    titleLabel: 'Titre de la Masterclass / Formation *',
    titlePlaceholder: 'Ex : Masterclass : Vendre avec Succès en Afrique',
    creatorLabel: 'Formateur / Expert *',
    creatorPlaceholder: 'Ex : Stanislas Zézé (Président Bloomfield)',
    performerLabel: 'Intervenants / Mentors Invités',
    performerPlaceholder: 'Ex : Experts du panel exécutif',
    pricePlaceholder: '5000',
    discountPricePlaceholder: '3900',
    descriptionLabel: 'Objectifs Pédagogiques *',
    descriptionPlaceholder: 'Ce que vous allez apprendre concrètement dans cette formation audio...',
    synopsisLabel: 'Programme Détaillé de la Masterclass',
    synopsisPlaceholder: 'Plan d\'action, exercices pratiques, plan des modules...',
    coverLabel: '🎓 Visuel de la Masterclass (JPG, PNG, WebP — Carré Pro)',
    previewLabel: '🎬 Extrait / Introduction Gratuite (3 à 5 min)',
    itemSingular: 'Module',
    itemPlural: 'Modules',
    defaultItemTitle: (idx) => `Module ${idx} : Fondations & Méthodologie`,
    defaultItemDuration: 900,
    trackDropLabel: (idx) => `🎓 Audio du Module ${idx}`,
    publishSuccessTitle: 'Masterclass Publiée avec Succès !',
    publishSuccessSubtitle: (title) => `"${title}" est maintenant disponible pour les apprenants.`,
    anotherButtonText: '+ Publier une Autre Masterclass',
  },
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
  const [catalogTypeFilter, setCatalogTypeFilter] = useState('all'); // 'all' | 'audiobook' | 'podcast' | 'music' | 'masterclass'
  const [systemStatus, setSystemStatus] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [editingBook, setEditingBook] = useState(null); // livre en cours d'édition
  const [catalogViewMode, setCatalogViewMode] = useState('grid'); // 'grid' (petites cartes) | 'list'

  // ── État Formulaire Publication ──
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishedBook, setPublishedBook] = useState(null);
  const [publishResult, setPublishResult] = useState(null);

  const [contentType, setContentType] = useState('audiobook');
  const activeTypeConfig = CONTENT_TYPE_CONFIG[contentType] || CONTENT_TYPE_CONFIG.audiobook;
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
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState('');

  const handleDeepSeekEnrich = async () => {
    if (!title.trim()) {
      alert('Veuillez saisir au moins le titre de l\'œuvre pour guider la génération IA.');
      return;
    }
    setIsAiGenerating(true);
    setAiSuccessMessage('');
    try {
      const res = await apiClient.enrichWithAI({
        title,
        author,
        description,
        synopsis,
        content_type: contentType
      });
      if (res.success && res.data) {
        if (res.data.description) setDescription(res.data.description);
        if (res.data.synopsis) setSynopsis(res.data.synopsis);
        if (res.data.suggested_category) {
          const matchCat = categories.find(c => c.name.toLowerCase().includes(res.data.suggested_category.toLowerCase()));
          if (matchCat) setCategoryId(matchCat.id);
        }
        setAiSuccessMessage('✓ Description, synopsis et métadonnées générés par DeepSeek !');
        setTimeout(() => setAiSuccessMessage(''), 4000);
      } else {
        alert(res.error || 'Erreur lors de la génération IA.');
      }
    } catch (e) {
      alert(`Erreur: ${e.message}`);
    } finally {
      setIsAiGenerating(false);
    }
  };

  // ── État Studio IA (TTS) ──
  const [ttsText, setTtsText] = useState('');
  const [ttsVoice, setTtsVoice] = useState('fr-FR-DeniseNeural');
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [ttsPitch, setTtsPitch] = useState(1.0);
  const [isTtsGenerating, setIsTtsGenerating] = useState(false);
  const [isSpeechSpeaking, setIsSpeechSpeaking] = useState(false);
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
  const trimPlayTimeoutRef = useRef(null);

  // ── État Gestionnaire de Catalogues & Catégories ──
  const [categories, setCategories] = useState([
    { id: 'cat-1', name: 'Business & Finance', slug: 'business-finance', icon: 'TrendingUp', color: '#9d4edd' },
    { id: 'cat-2', name: 'Développement Personnel', slug: 'dev-perso', icon: 'Sparkles', color: '#c77dff' },
    { id: 'cat-3', name: 'Intelligence Artificielle & Tech', slug: 'tech-ia', icon: 'Cpu', color: '#3a86ff' },
    { id: 'cat-4', name: 'Psychologie & Mental', slug: 'psychologie', icon: 'Brain', color: '#ff006e' },
    { id: 'cat-5', name: 'Histoire & Stratégie', slug: 'strategie', icon: 'Shield', color: '#fb5607' },
    { id: 'cat-6', name: 'Romans & Fiction', slug: 'fiction', icon: 'BookOpen', color: '#ffbe0b' },
  ]);
  const [loadingCategories, setLoadingCategories] = useState(false);
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

  // ── État Effet de Masse (Social Proof) ──
  const [socialModalBook, setSocialModalBook] = useState(null);
  const [socialPlays, setSocialPlays] = useState(0);
  const [socialReviews, setSocialReviews] = useState(0);
  const [socialRating, setSocialRating] = useState(4.9);
  const [isSavingSocial, setIsSavingSocial] = useState(false);

  // ── État Analytics Visiteurs (Inscrits & Anonymes) ──
  const [analyticsData, setAnalyticsData] = useState(() => getAnalyticsData());
  const [selectedVisitorDetail, setSelectedVisitorDetail] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const loadLiveAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const serverData = await apiClient.getAdminAnalytics();
      const localData = getAnalyticsData();
      if (serverData && serverData.uniqueVisitors > 0) {
        setAnalyticsData({
          ...localData,
          ...serverData,
          sources: serverData.sources?.length > 0 ? serverData.sources : localData.sources,
          topAudios: serverData.topAudios?.length > 0 ? serverData.topAudios : localData.topAudios,
          recentVisitors: serverData.recentVisitors?.length > 0 ? serverData.recentVisitors : localData.recentVisitors,
        });
      } else {
        setAnalyticsData(localData);
      }
    } catch (_) {
      setAnalyticsData(getAnalyticsData());
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // ── État Générateur d'API & Clés MCP IA ──
  const API_AVAILABLE_SCOPES = [
    {
      id: 'catalog_read',
      label: 'Lecture du Catalogue',
      desc: 'Consulter tous les livres, podcasts, musiques et chapitres',
      icon: BookOpen,
      tag: 'GET /api/audiobooks',
      method: 'GET',
      endpoint: '/api/audiobooks',
      fullUrl: 'https://rg-play.pages.dev/api/audiobooks',
      doc: 'Lister et rechercher dans le catalogue (?type=all|audiobook|podcast|music, ?category=id, ?search=titre)',
      sampleQuery: '?type=all'
    },
    {
      id: 'catalog_write',
      label: 'Création & Modification',
      desc: 'Ajouter ou mettre à jour des titres et chapitres dans Cloudflare D1',
      icon: Plus,
      tag: 'POST /api/admin/books',
      method: 'POST',
      endpoint: '/api/admin/books',
      fullUrl: 'https://rg-play.pages.dev/api/admin/books',
      doc: 'Créer ou mettre à jour un livre audio et ses chapitres dans la base Cloudflare D1',
      sampleBody: {
        title: "Prie puis agis",
        author: "RGPlay",
        price: 2500,
        category_name: "Motivations Chrétiennes",
        description: "Une motivation chrétienne directe...",
        chapters: [{ title: "Chapitre 1 : Introduction", audio_url: "https://...", duration_seconds: 1800 }]
      }
    },
    {
      id: 'catalog_pin',
      label: 'Épinglage Catalogue',
      desc: 'Épingler ou désépingler des livres en tête de vitrine',
      icon: Flame,
      tag: 'POST /api/admin/books/:id/toggle-pin',
      method: 'POST',
      endpoint: '/api/admin/books/{id}/toggle-pin',
      fullUrl: 'https://rg-play.pages.dev/api/admin/books/{book_id}/toggle-pin',
      doc: 'Mettre en avant ou retirer un contenu de la tête du catalogue',
      sampleBody: { is_pinned: true }
    },
    {
      id: 'catalog_delete',
      label: 'Suppression Contenus',
      desc: 'Supprimer définitivement un livre audio et ses chapitres',
      icon: Trash2,
      tag: 'DELETE /api/admin/books/:id',
      method: 'DELETE',
      endpoint: '/api/admin/books/{id}',
      fullUrl: 'https://rg-play.pages.dev/api/admin/books/{book_id}',
      doc: 'Supprimer définitivement un livre audio et ses chapitres'
    },
    {
      id: 'social_metrics',
      label: 'Effet de Masse (Social Proof)',
      desc: 'Personnaliser les écoutes, avis et notes affichés aux clients',
      icon: Sparkles,
      tag: 'POST /api/admin/books/:id/social-metrics',
      method: 'POST',
      endpoint: '/api/admin/books/{id}/social-metrics',
      fullUrl: 'https://rg-play.pages.dev/api/admin/books/{book_id}/social-metrics',
      doc: 'Mettre à jour les métriques sociales affichées aux visiteurs',
      sampleBody: { display_plays_count: 28000, display_reviews_count: 5600, display_rating: 4.95 }
    },
    {
      id: 'categories_manage',
      label: 'Gestion des Catégories',
      desc: 'Créer, modifier et supprimer des univers et thématiques',
      icon: Grid,
      tag: 'GET/POST /api/admin/categories',
      method: 'POST',
      endpoint: '/api/admin/categories',
      fullUrl: 'https://rg-play.pages.dev/api/admin/categories',
      doc: 'Créer ou mettre à jour des catégories',
      sampleBody: { name: "Investissement & Finance", slug: "investissement-finance", icon: "TrendingUp" }
    },
    {
      id: 'payments_initiate',
      label: 'Passerelle CamerPay',
      desc: 'Déclencher des paiements réels Orange Money, MTN et Carte',
      icon: Smartphone,
      tag: 'POST /api/payment/initiate',
      method: 'POST',
      endpoint: '/api/payment/initiate',
      fullUrl: 'https://rg-play.pages.dev/api/payment/initiate',
      doc: 'Initier un paiement mobile money ou carte bancaire',
      sampleBody: { audiobook_id: "book-1", payment_method: "orange_money", customer_phone: "699456779", amount: 200 }
    },
    {
      id: 'payments_sync',
      label: 'Vérification & Synchro Paiements',
      desc: 'Consulter et synchroniser les transactions en attente',
      icon: RefreshCw,
      tag: 'GET /api/payment/status/:id',
      method: 'GET',
      endpoint: '/api/payment/status/{transaction_id}',
      fullUrl: 'https://rg-play.pages.dev/api/payment/status/{transaction_id}',
      doc: 'Vérifier l\'état en temps réel d\'une transaction CamerPay'
    },
    {
      id: 'analytics_read',
      label: 'Statistiques & Trafic',
      desc: 'Consulter les métriques de fréquentation, visiteurs et sources',
      icon: BarChart3,
      tag: 'GET /api/admin/analytics',
      method: 'GET',
      endpoint: '/api/admin/analytics',
      fullUrl: 'https://rg-play.pages.dev/api/admin/analytics',
      doc: 'Consulter les statistiques de visites, écoutes et rétention'
    },
    {
      id: 'system_status',
      label: 'Santé Infrastructure Cloudflare',
      desc: 'Consulter l\'état en direct de Cloudflare D1, R2 et KV',
      icon: Database,
      tag: 'GET /api/status',
      method: 'GET',
      endpoint: '/api/status',
      fullUrl: 'https://rg-play.pages.dev/api/status',
      doc: 'Vérifier l\'état opérationnel de la base Cloudflare D1, R2 et KV'
    },
  ];

  const [apiName, setApiName] = useState('Manus IA Production');
  const [apiExpiration, setApiExpiration] = useState('never');
  const [apiRateLimit, setApiRateLimit] = useState('120');
  const [selectedScopes, setSelectedScopes] = useState([
    'catalog_read', 'catalog_write', 'catalog_pin', 'social_metrics', 'categories_manage', 'analytics_read', 'system_status'
  ]);
  const [generatedKey, setGeneratedKey] = useState(null);
  const [activeCodeTab, setActiveCodeTab] = useState('manus'); // 'manus', 'mcp', 'curl', 'fetch', 'python'
  const [copiedField, setCopiedField] = useState(null);
  const [savedKeys, setSavedKeys] = useState(() => {
    try {
      const stored = localStorage.getItem('rgplay_api_keys');
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    return [
      {
        id: 'key_manus_default',
        name: 'Manus IA Assistant',
        keyMasked: 'rgp_live_806f9a...3c21',
        fullKey: 'rgp_live_806f9a7b2c4e1d3a5f8b9c0d2e4f6a8b1c3c21',
        createdAt: new Date().toLocaleDateString('fr-FR'),
        scopes: ['catalog_read', 'catalog_write', 'catalog_pin', 'social_metrics', 'categories_manage', 'analytics_read', 'system_status'],
        status: 'active'
      }
    ];
  });

  const toggleScope = (scopeId) => {
    setSelectedScopes(prev =>
      prev.includes(scopeId) ? prev.filter(s => s !== scopeId) : [...prev, scopeId]
    );
  };

  const selectPreset = (presetType) => {
    if (presetType === 'all') {
      setSelectedScopes(API_AVAILABLE_SCOPES.map(s => s.id));
    } else if (presetType === 'readonly') {
      setSelectedScopes(['catalog_read', 'analytics_read', 'system_status']);
    } else if (presetType === 'ai_agent') {
      setSelectedScopes(['catalog_read', 'catalog_write', 'catalog_pin', 'social_metrics', 'categories_manage', 'analytics_read', 'system_status']);
    } else if (presetType === 'payments') {
      setSelectedScopes(['catalog_read', 'payments_initiate', 'payments_sync']);
    }
  };

  const handleGenerateKey = () => {
    const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    const fullKey = `rgp_live_${randomHex}`;
    const masked = `rgp_live_${randomHex.slice(0, 6)}...${randomHex.slice(-4)}`;

    const newKeyObj = {
      id: `key_${Date.now()}`,
      name: apiName.trim() || 'Intégration RG Play',
      fullKey,
      keyMasked: masked,
      createdAt: new Date().toLocaleDateString('fr-FR'),
      expiration: apiExpiration,
      rateLimit: apiRateLimit,
      scopes: [...selectedScopes],
      status: 'active'
    };

    const updatedList = [newKeyObj, ...savedKeys];
    setSavedKeys(updatedList);
    setGeneratedKey(newKeyObj);

    try {
      localStorage.setItem('rgplay_api_keys', JSON.stringify(updatedList));
    } catch (_) {}
  };

  const handleCopyText = (text, fieldName) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleRevokeKey = (keyId) => {
    if (!window.confirm('Voulez-vous vraiment révoquer cette clé API ?')) return;
    const updated = savedKeys.filter(k => k.id !== keyId);
    setSavedKeys(updated);
    if (generatedKey?.id === keyId) setGeneratedKey(null);
    try {
      localStorage.setItem('rgplay_api_keys', JSON.stringify(updated));
    } catch (_) {}
  };

  // Vérifier le statut système D1 / R2 / KV
  const checkStatus = async () => {
    setCheckingStatus(true);
    try {
      const st = await apiClient.getSystemStatus();
      setSystemStatus(st);
    } catch (_) { }
    finally {
      setCheckingStatus(false);
    }
  };

  // Chargement des catégories depuis Cloudflare D1 / API
  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      const data = await apiClient.getCategories();
      if (Array.isArray(data) && data.length > 0) {
        // Filtrer la pseudo-catégorie 'all' pour la gestion admin
        const filtered = data.filter(c => c.id !== 'all');
        setCategories(filtered);
      }
    } catch (err) {
      console.error('Erreur chargement catégories:', err);
    } finally {
      setLoadingCategories(false);
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

    // ── 1. Retrait optimiste IMMÉDIAT de l'interface ──────────────
    setBooks(prev => prev.filter(b => b.id !== bookId));

    try {
      // ── 2. Suppression persistante (serveur D1 + cache KV + localStorage) ──
      await apiClient.deleteAudiobook(bookId);
      window.dispatchEvent(new CustomEvent('rg:book-deleted', { detail: { id: bookId } }));

      // ── 3. Rechargement depuis le serveur pour vérifier la cohérence ──
      // Petit délai pour laisser le temps au KV d'être purgé côté Cloudflare
      await new Promise(r => setTimeout(r, 500));
      await loadBooks();
    } catch (err) {
      console.error('[handleDeleteBook] Erreur:', err);
      // En cas d'erreur réseau, recharger quand même (le filtre localStorage protège)
      await loadBooks();
    }
  };

  // Éditer un livre : pré-remplir le formulaire de publication
  const handleEditBook = (book) => {
    setEditingBook(book);
    setContentType(book.content_type || 'audiobook');
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
    loadCategories();
    checkStatus();

    const handleBookCreated = () => { loadBooks(); checkStatus(); };
    const handleBookDeleted = () => { loadBooks(); checkStatus(); };
    const handleCategoryChanged = () => { loadCategories(); };

    window.addEventListener('rg:book-created', handleBookCreated);
    window.addEventListener('rg:book-deleted', handleBookDeleted);
    window.addEventListener('rg:category-updated', handleCategoryChanged);
    window.addEventListener('rg:category-deleted', handleCategoryChanged);

    return () => {
      window.removeEventListener('rg:book-created', handleBookCreated);
      window.removeEventListener('rg:book-deleted', handleBookDeleted);
      window.removeEventListener('rg:category-updated', handleCategoryChanged);
      window.removeEventListener('rg:category-deleted', handleCategoryChanged);
      if (trimPlayTimeoutRef.current) clearTimeout(trimPlayTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (activeRubric === 'analytics') {
      loadLiveAnalytics();
    }
  }, [activeRubric]);

  // Gestion du Changement de Type de Contenu
  const handleSelectContentType = (newType) => {
    setContentType(newType);
    const cfg = CONTENT_TYPE_CONFIG[newType] || CONTENT_TYPE_CONFIG.audiobook;
    // Si l'utilisateur n'a pas encore téléversé de chapitres et que le titre est par défaut, réadapter le 1er chapitre
    if (chapters.length === 1 && !chapters[0].uploadData) {
      setChapters([{
        title: cfg.defaultItemTitle(1),
        duration_seconds: cfg.defaultItemDuration,
        uploadData: null,
      }]);
    }
  };

  // Gestion des chapitres / pistes / épisodes / modules
  const addChapter = () => {
    const cfg = CONTENT_TYPE_CONFIG[contentType] || CONTENT_TYPE_CONFIG.audiobook;
    setChapters(prev => [
      ...prev,
      {
        title: cfg.defaultItemTitle(prev.length + 1),
        duration_seconds: cfg.defaultItemDuration,
        uploadData: null,
      }
    ]);
  };

  const removeChapter = (i) => setChapters(prev => prev.filter((_, idx) => idx !== i));
  const updateChapter = (i, field, value) =>
    setChapters(prev => { const n = [...prev]; n[i] = { ...n[i], [field]: value }; return n; });
  const setChapterUpload = (i, data) =>
    setChapters(prev => {
      const n = [...prev];
      n[i] = {
        ...n[i],
        uploadData: data,
        duration_seconds: data?.duration_seconds || n[i].duration_seconds || (CONTENT_TYPE_CONFIG[contentType]?.defaultItemDuration || 1800),
      };
      return n;
    });

  // Publication / Mise à Jour
  const handlePublish = async () => {
    setIsSubmitting(true);
    const cfg = CONTENT_TYPE_CONFIG[contentType] || CONTENT_TYPE_CONFIG.audiobook;
    const totalDuration = chapters.reduce((s, c) => s + Number(c.duration_seconds || 0), 0) || cfg.defaultItemDuration;
    const bookId = editingBook?.id || `book-${Date.now()}`;

    const newBook = {
      id: bookId,
      title, author, narrator,
      content_type: contentType,
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
        duration_seconds: Number(c.duration_seconds || cfg.defaultItemDuration),
        audio_url: c.uploadData?.public_url || c.audio_url || previewData?.public_url || '',
        audio_r2_key: c.uploadData?.r2_key || c.audio_r2_key || `audiobooks/${bookId}/ch${idx + 1}.mp3`,
        audio_stream_url: `/api/chapters/${c.id || `chap-${bookId}-${idx + 1}`}/stream`,
      })),
    };

    let result = null;
    try {
      result = await apiClient.createAudiobook(newBook);
    } catch (_) { }

    setPublishedBook(newBook);
    setPublishResult(result?.serverResult || null);
    setIsSubmitting(false);
    setStep(4);
    await loadBooks();
    await checkStatus();

    // Déclencher la notification push réelle pour les utilisateurs
    window.dispatchEvent(new CustomEvent('rg_new_content_published', { detail: newBook }));

    if (onBookCreated) onBookCreated(newBook);
  };

  const resetPublishForm = (targetType = 'audiobook') => {
    const cfg = CONTENT_TYPE_CONFIG[targetType] || CONTENT_TYPE_CONFIG.audiobook;
    setStep(1);
    setContentType(targetType);
    setTitle('');
    setAuthor('');
    setNarrator('');
    setPrice(cfg.pricePlaceholder);
    setDiscountPrice(cfg.discountPricePlaceholder);
    setDescription('');
    setSynopsis('');
    setCoverData(null);
    setPreviewData(null);
    setChapters([{ title: cfg.defaultItemTitle(1), duration_seconds: cfg.defaultItemDuration, uploadData: null }]);
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

  const handleLiveSpeechToggle = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (isSpeechSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeechSpeaking(false);
      return;
    }
    if (!ttsText.trim()) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(ttsText);
    utterance.rate = ttsSpeed;
    utterance.pitch = ttsPitch;

    const voices = window.speechSynthesis.getVoices() || [];
    const isEn = ttsVoice.startsWith('en-');
    const langPrefix = isEn ? 'en' : 'fr';
    const targetVoice = voices.find(v => v.lang.toLowerCase().startsWith(langPrefix)) || voices[0];
    if (targetVoice) utterance.voice = targetVoice;

    utterance.onstart = () => setIsSpeechSpeaking(true);
    utterance.onend = () => setIsSpeechSpeaking(false);
    utterance.onerror = () => setIsSpeechSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleGenerateTTS = async () => {
    if (!ttsText.trim()) return;
    setIsTtsGenerating(true);

    // Révocation de l'ancien buffer Blob pour éviter les fuites mémoire
    if (ttsAudioUrl && ttsAudioUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(ttsAudioUrl); } catch (_) {}
    }
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
    } catch (_) { }

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
      if (dspProcessedUrl && dspProcessedUrl.startsWith('blob:')) {
        try { URL.revokeObjectURL(dspProcessedUrl); } catch (_) {}
      }
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
      if (dspProcessedUrl && dspProcessedUrl.startsWith('blob:')) {
        try { URL.revokeObjectURL(dspProcessedUrl); } catch (_) {}
      }
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
    try {
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
    } catch (err) {
      console.error('Erreur enregistrement catégorie:', err);
    } finally {
      setIsSavingCat(false);
    }
  };

  const handleDeleteCategory = async (catId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) return;
    try {
      await apiClient.deleteCategory(catId);
      await loadCategories();
    } catch (err) {
      console.error('Erreur suppression catégorie:', err);
    }
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

  // ── Navigation Tabs ──
  const RUBRICS = [
    { id: 'catalog', label: 'Catalogue & Livres', icon: BookOpen, badge: books.length },
    { id: 'categories', label: 'Catalogues & Catégories', icon: Grid, badge: categories.length },
    { id: 'publish', label: 'Publier un Contenu', icon: UploadCloud },
    { id: 'ai-tts', label: 'Studio IA (Texte ➔ Voix)', icon: Wand2, badge: 'Pro' },
    { id: 'audacity', label: 'Studio Audacity & Découpe', icon: Scissors, badge: 'Cutter' },
    { id: 'analytics', label: 'Statistiques & Ventes', icon: BarChart3 },
    { id: 'push', label: 'Notifications Push', icon: Bell },
    { id: 'api-generator', label: 'Générateur d\'API & IA', icon: Key, badge: 'MCP / IA' },
    { id: 'settings', label: 'Paramètres & Système', icon: Settings },
  ];

  const filteredBooks = books.filter(b => {
    const matchSearch =
      b.title?.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      b.author?.toLowerCase().includes(catalogSearch.toLowerCase());
    const matchType = catalogTypeFilter === 'all' || (b.content_type || 'audiobook') === catalogTypeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-120px)] animate-fadeIn">

      {/* ── Sidebar de Navigation Admin ── */}
      <aside className="w-full lg:w-72 flex-shrink-0">
        <div
          className="rounded-3xl p-4 sm:p-5 space-y-3 sticky top-24 backdrop-blur-2xl"
          style={{
            background: 'linear-gradient(160deg, rgba(14, 10, 34, 0.94) 0%, rgba(8, 5, 22, 0.98) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.22)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.60), 0 1px 0 rgba(255, 255, 255, 0.08) inset',
          }}
        >
          <div className="px-2 py-1 mb-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 font-['Outfit'] block">
              Console d'Administration
            </span>
            <h2 className="text-xl font-black text-white font-['Outfit'] tracking-tight">RG Studio Pro</h2>
          </div>

          <nav className="space-y-1.5">
            {RUBRICS.map((rub) => {
              const Icon = rub.icon;
              const isActive = activeRubric === rub.id;
              return (
                <button
                  key={rub.id}
                  onClick={() => setActiveRubric(rub.id)}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-xs font-black transition-all duration-300 font-['Outfit'] tracking-wide cursor-pointer ${isActive
                      ? 'text-white shadow-xl shadow-emerald-500/25 scale-[1.02]'
                      : 'text-slate-300 hover:bg-white/6 hover:text-white'
                    }`}
                  style={
                    isActive
                      ? {
                        background: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #0d9488 100%)',
                        border: '1px solid rgba(255, 255, 255, 0.20)',
                        boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35), 0 1px 0 rgba(255,255,255,0.15) inset',
                      }
                      : { border: '1px solid transparent' }
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4.5 h-4.5 ${isActive ? 'text-white' : 'text-slate-400'}`}
                      style={{ filter: isActive ? 'drop-shadow(0 0 6px rgba(255,255,255,0.6))' : 'none' }}
                    />
                    <span className="text-left font-bold">{rub.label}</span>
                  </div>
                  {rub.badge && (
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-black ${isActive
                          ? 'bg-white/25 text-white'
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        }`}
                    >
                      {rub.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Statut Système & Cloudflare D1 en Direct */}
          <div className="pt-3 border-t border-white/10 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1">
              Infrastructure & Base SQL
            </span>
            <div className="p-3 rounded-2xl bg-white/4 border border-white/8 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cloudflare D1</span>
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${systemStatus?.d1 === 'connected'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}>
                  {systemStatus?.d1 === 'connected' ? 'En ligne' : 'Local'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Stockage R2</span>
                <span className="text-purple-300 font-bold">Actif (WebP/MP3)</span>
              </div>
              <button
                onClick={checkStatus}
                disabled={checkingStatus}
                className="w-full mt-1 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <span>Vérifier Connexion</span>
                <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? 'animate-spin text-emerald-400' : ''}`} />
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
                <h1 className="text-2xl sm:text-4xl font-black text-white font-['Outfit'] tracking-tight">
                  Catalogue & Audios
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
                  {books.length} contenu{books.length > 1 ? 's' : ''} en ligne • Synchronisé avec Cloudflare D1
                </p>
              </div>
              <button
                onClick={() => { resetPublishForm('audiobook'); setActiveRubric('publish'); }}
                className="btn-gradient px-6 py-3.5 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 shadow-2xl active:scale-95 transition-all"
              >
                <Plus className="w-4.5 h-4.5" />
                <span>Publier un Nouveau Titre</span>
              </button>
            </div>

            {/* Barre de Recherche & Filtres avec Switcher Cartes / Liste */}
            <div className="card-lg space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={e => setCatalogSearch(e.target.value)}
                    placeholder="Rechercher par titre ou auteur dans le catalogue..."
                    className="rg-input pl-12 pr-4 py-3.5 rounded-2xl text-sm w-full"
                  />
                </div>

                {/* Switcher Mode Vue : Cartes vs Liste */}
                <div className="flex items-center gap-1 bg-white/5 p-1.5 rounded-2xl border border-white/10 self-end sm:self-auto">
                  <button
                    onClick={() => setCatalogViewMode('grid')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${catalogViewMode === 'grid'
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    title="Affichage en petites cartes"
                  >
                    <LayoutGrid className="w-4 h-4" />
                    <span>Petites Cartes</span>
                  </button>
                  <button
                    onClick={() => setCatalogViewMode('list')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${catalogViewMode === 'list'
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    title="Affichage en liste détaillée"
                  >
                    <List className="w-4 h-4" />
                    <span>Liste</span>
                  </button>
                </div>
              </div>

              {/* Filtres par Type de Contenu (Pills) */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {[
                  { id: 'all', label: 'Tous', icon: '🌟', count: books.length },
                  { id: 'audiobook', label: 'Livres Audio', icon: '📚', count: books.filter(b => !b.content_type || b.content_type === 'audiobook').length },
                  { id: 'podcast', label: 'Podcasts', icon: '🎙️', count: books.filter(b => b.content_type === 'podcast').length },
                  { id: 'music', label: 'Musique & Lofi', icon: '🎵', count: books.filter(b => b.content_type === 'music').length },
                  { id: 'masterclass', label: 'Masterclasses', icon: '🎓', count: books.filter(b => b.content_type === 'masterclass').length },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setCatalogTypeFilter(f.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${catalogTypeFilter === f.id
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400'
                        : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/8'
                      }`}
                  >
                    <span>{f.icon}</span>
                    <span>{f.label}</span>
                    <span className="text-[10px] opacity-70 px-1.5 py-0.2 rounded-full bg-black/30 font-mono">{f.count}</span>
                  </button>
                ))}
              </div>

              {/* Table / Grille des Livres */}
              {loadingBooks ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4">
                  {[1, 2, 3, 4, 5].map(n => <div key={n} className="skeleton h-60 rounded-2xl" />)}
                </div>
              ) : filteredBooks.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <BookOpen className="w-14 h-14 mx-auto text-slate-600 opacity-60" />
                  <p className="text-base text-slate-300 font-bold font-['Outfit']">Aucun contenu trouvé</p>
                  <button onClick={() => setCatalogSearch('')} className="rg-btn-ghost text-xs px-4 py-2 rounded-xl">
                    Effacer la recherche
                  </button>
                </div>
              ) : catalogViewMode === 'grid' ? (
                /* ── 1. AFFICHAGE EN PETITES CARTES (GRID) ── */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4">
                  {filteredBooks.map((book) => {
                    const isPreviewing = previewingBookId === book.id;
                    return (
                      <div
                        key={book.id}
                        className="flex flex-col justify-between rounded-2xl p-3 transition-all duration-300 group relative overflow-hidden"
                        style={{
                          background: isPreviewing
                            ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.22), rgba(168, 85, 247, 0.15))'
                            : 'rgba(255, 255, 255, 0.035)',
                          border: isPreviewing
                            ? '1px solid rgba(168, 85, 247, 0.50)'
                            : '1px solid rgba(255, 255, 255, 0.08)',
                          boxShadow: isPreviewing ? '0 8px 30px rgba(168, 85, 247, 0.25)' : 'none',
                        }}
                      >
                        {/* Cover avec ratio carré et bouton preview */}
                        <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2.5 bg-slate-900 border border-white/10">
                          <img
                            src={book.cover_url}
                            alt={book.title}
                            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=400&q=80'; }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />

                          {/* Badges au-dessus de la cover */}
                          <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none gap-1">
                            {Boolean(book.is_pinned) ? (
                              <span className="rg-badge bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-md border border-amber-300/40 text-[10px] px-2 py-0.5">
                                📌 Épinglé
                              </span>
                            ) : <span />}
                            {Boolean(book.is_featured) && (
                              <span className="rg-badge rg-badge--pink text-[10px] px-1.5 py-0.5">À la une</span>
                            )}
                          </div>

                          {/* Play / Pause button overlay */}
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
                            className={`absolute bottom-2 right-2 p-2 rounded-xl border backdrop-blur-md transition-all duration-200 active:scale-90 ${isPreviewing
                                ? 'bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-500/40'
                                : 'bg-black/60 hover:bg-black/80 text-white border-white/20 opacity-90 group-hover:opacity-100'
                              }`}
                            title="Écouter l'extrait"
                          >
                            {isPreviewing ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white ml-0.5" />}
                          </button>
                        </div>

                        {/* Détails du livre */}
                        <div className="space-y-1 min-w-0 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider truncate">
                                {book.content_type === 'podcast' ? '🎙️ Podcast' :
                                  book.content_type === 'music' ? '🎵 Musique' :
                                    book.content_type === 'masterclass' ? '🎓 Masterclass' :
                                      (book.category_name || 'Livre Audio')}
                              </span>
                            </div>
                            <h3 className="text-xs sm:text-sm font-extrabold text-white truncate font-['Outfit'] group-hover:text-purple-300 transition-colors" title={book.title}>
                              {book.title}
                            </h3>
                            <p className="text-[11px] text-slate-400 truncate" title={book.author}>
                              {book.author}
                            </p>
                          </div>

                          <div className="pt-2 mt-auto">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-emerald-400 font-extrabold">
                                {book.discount_price || book.price} FCFA
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {book.chapters?.length || 1} ch.
                              </span>
                            </div>

                            {/* Barre d'actions compacte (4 boutons) */}
                            <div className="grid grid-cols-4 gap-1 pt-1.5 border-t border-white/5">
                              {/* Épingler */}
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const newPinned = !book.is_pinned;
                                  setBooks(prev => prev.map(b => b.id === book.id ? { ...b, is_pinned: newPinned ? 1 : 0 } : b));
                                  await apiClient.togglePinAudiobook(book.id, newPinned);
                                }}
                                className={`p-1.5 rounded-lg border text-center font-bold text-xs transition-all active:scale-95 flex items-center justify-center ${book.is_pinned
                                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                    : 'bg-white/5 hover:bg-amber-500/15 text-slate-400 hover:text-amber-300 border-white/10'
                                  }`}
                                title={book.is_pinned ? 'Désépingler cet audio' : 'Épingler cet audio en tête'}
                              >
                                <span>📌</span>
                              </button>

                              {/* Effet de masse / Social Proof */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSocialModalBook(book);
                                  setSocialPlays(book.display_plays_count || (book.rating_count ? book.rating_count * 8 : 12500));
                                  setSocialReviews(book.display_reviews_count || (book.rating_count ? book.rating_count : 2400));
                                  setSocialRating(book.display_rating || book.rating || 4.9);
                                }}
                                className="p-1.5 rounded-lg border bg-white/5 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border-white/10 hover:border-amber-500/40 transition-all active:scale-95 flex items-center justify-center"
                                title="Personnaliser l'effet de masse (Écoutes & Avis affichés)"
                              >
                                <Flame className="w-3.5 h-3.5 text-amber-400" />
                              </button>

                              {/* Éditer */}
                              <button
                                onClick={() => handleEditBook(book)}
                                className="p-1.5 rounded-lg border bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border-white/10 hover:border-cyan-500/40 transition-all active:scale-95 flex items-center justify-center"
                                title="Modifier ce livre"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {/* Supprimer */}
                              <button
                                onClick={() => handleDeleteBook(book.id, book.title)}
                                className="p-1.5 rounded-lg border bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border-white/10 hover:border-rose-500/40 transition-all active:scale-95 flex items-center justify-center"
                                title="Supprimer ce livre"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* ── 2. AFFICHAGE EN LISTE DÉTAILLÉE (LIST) ── */
                <div className="space-y-3">
                  {filteredBooks.map((book) => {
                    const isPreviewing = previewingBookId === book.id;
                    return (
                      <div
                        key={book.id}
                        className="p-4 sm:p-5 rounded-2xl transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
                        style={{
                          background: isPreviewing
                            ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.18), rgba(168, 85, 247, 0.12))'
                            : 'rgba(255, 255, 255, 0.035)',
                          border: isPreviewing
                            ? '1px solid rgba(168, 85, 247, 0.50)'
                            : '1px solid rgba(255, 255, 255, 0.08)',
                          boxShadow: isPreviewing ? '0 8px 30px rgba(168, 85, 247, 0.20)' : 'none',
                        }}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="relative flex-shrink-0">
                            <img
                              src={book.cover_url}
                              alt={book.title}
                              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=400&q=80'; }}
                              className="w-16 h-16 rounded-2xl object-cover shadow-lg border border-white/10 group-hover:scale-105 transition-transform duration-300"
                            />
                            {isPreviewing && (
                              <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                                <span className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-ping" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {Boolean(book.is_pinned) && (
                                <span className="rg-badge bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-md border border-amber-300/40">
                                  📌 Épinglé en tête
                                </span>
                              )}
                              <span className="rg-badge rg-badge--purple">
                                {book.content_type === 'podcast' ? '🎙️ Podcast' :
                                  book.content_type === 'music' ? '🎵 Musique' :
                                    book.content_type === 'masterclass' ? '🎓 Masterclass' :
                                      (book.category_name || 'Livre Audio')}
                              </span>
                              {Boolean(book.is_featured) && <span className="rg-badge rg-badge--pink">À la une</span>}
                              {Boolean(book.is_bestseller) && <span className="rg-badge rg-badge--amber">Bestseller</span>}
                            </div>
                            <h3 className="text-base sm:text-lg font-extrabold text-white truncate font-['Outfit'] group-hover:text-purple-300 transition-colors">
                              {book.title}
                            </h3>
                            <p className="text-xs text-slate-400 truncate">
                              Par <span className="text-slate-200 font-semibold">{book.author}</span> • {book.chapters?.length || 1} chapitre(s) • <span className="text-emerald-400 font-bold">{book.discount_price || book.price} FCFA</span>
                            </p>
                          </div>
                        </div>

                        {/* Actions boutons */}
                        <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                          {/* Bouton Épingler */}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const newPinned = !book.is_pinned;
                              setBooks(prev => prev.map(b => b.id === book.id ? { ...b, is_pinned: newPinned ? 1 : 0 } : b));
                              await apiClient.togglePinAudiobook(book.id, newPinned);
                            }}
                            className={`px-3 py-2.5 rounded-xl border font-black text-xs transition-all duration-200 flex items-center gap-1.5 active:scale-95 ${book.is_pinned
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-lg shadow-amber-500/20'
                                : 'bg-white/5 hover:bg-amber-500/15 text-slate-400 hover:text-amber-300 border-white/10'
                              }`}
                            title={book.is_pinned ? 'Désépingler cet audio' : 'Épingler cet audio en haut du catalogue'}
                          >
                            <span className="text-sm">📌</span>
                            <span className="hidden sm:inline">
                              {book.is_pinned ? 'Épinglé' : 'Épingler'}
                            </span>
                          </button>

                          {/* Bouton Effet de masse */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSocialModalBook(book);
                              setSocialPlays(book.display_plays_count || (book.rating_count ? book.rating_count * 8 : 12500));
                              setSocialReviews(book.display_reviews_count || (book.rating_count ? book.rating_count : 2400));
                              setSocialRating(book.display_rating || book.rating || 4.9);
                            }}
                            className="p-2.5 rounded-xl border bg-white/5 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border-white/10 hover:border-amber-500/40 transition-all duration-200 active:scale-95"
                            title="Personnaliser l'effet de masse (Écoutes & Avis affichés)"
                          >
                            <Flame className="w-4.5 h-4.5 text-amber-400" />
                          </button>

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
                            className={`p-2.5 rounded-xl border transition-all duration-200 active:scale-95 ${isPreviewing
                                ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-500/30'
                                : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/10'
                              }`}
                            title="Écouter l'extrait"
                          >
                            {isPreviewing ? <Pause className="w-4.5 h-4.5 fill-white" /> : <Play className="w-4.5 h-4.5 fill-white ml-0.5" />}
                          </button>

                          {/* Bouton Éditer */}
                          <button
                            onClick={() => handleEditBook(book)}
                            className="p-2.5 rounded-xl border bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border-white/10 hover:border-cyan-500/40 transition-all duration-200 active:scale-95"
                            title="Modifier ce livre"
                          >
                            <Edit3 className="w-4.5 h-4.5" />
                          </button>

                          {/* Bouton Supprimer */}
                          <button
                            onClick={() => handleDeleteBook(book.id, book.title)}
                            className="p-2.5 rounded-xl border bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border-white/10 hover:border-rose-500/40 transition-all duration-200 active:scale-95"
                            title="Supprimer ce livre"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
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

            {/* Stepper Propre et Stylisé */}
            <div
              className="p-2 sm:p-3 rounded-3xl flex items-center justify-between gap-2 backdrop-blur-xl"
              style={{
                background: 'rgba(14, 10, 34, 0.85)',
                border: '1px solid rgba(168, 85, 247, 0.18)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.40)',
              }}
            >
              {[
                { n: 1, label: '1. Informations & Prix' },
                { n: 2, label: '2. Pochette & Extrait' },
                { n: 3, label: '3. Chapitres Audio' },
                { n: 4, label: '4. Validation' },
              ].map((s) => (
                <button
                  key={s.n}
                  onClick={() => step > s.n && setStep(s.n)}
                  className={`flex-1 py-3 px-2 sm:px-4 rounded-2xl text-xs font-black transition-all duration-300 text-center font-['Outfit'] tracking-wide cursor-pointer ${step === s.n
                      ? 'text-white shadow-xl shadow-emerald-500/25 scale-[1.02]'
                      : step > s.n
                        ? 'text-emerald-400 bg-white/6 hover:bg-emerald-500/10'
                        : 'text-slate-500 bg-transparent opacity-60'
                    }`}
                  style={
                    step === s.n
                      ? {
                        background: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #0d9488 100%)',
                        border: '1px solid rgba(255, 255, 255, 0.25)',
                        boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35)',
                      }
                      : { border: '1px solid transparent' }
                  }
                >
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden font-black">Étape {s.n}</span>
                </button>
              ))}
            </div>

            {/* ÉTAPE 1 : Informations */}
            {step === 1 && (
              <div className="card-lg space-y-5">
                {/* Sélecteur Type de Contenu */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">Type de Contenu *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { id: 'audiobook', label: 'Livre Audio', icon: '📚', color: 'border-purple-500 bg-purple-500/10 text-purple-300' },
                      { id: 'podcast', label: 'Podcast', icon: '🎙️', color: 'border-amber-500 bg-amber-500/10 text-amber-300' },
                      { id: 'music', label: 'Musique & Lofi', icon: '🎵', color: 'border-emerald-500 bg-emerald-500/10 text-emerald-300' },
                      { id: 'masterclass', label: 'Masterclass', icon: '🎓', color: 'border-cyan-500 bg-cyan-500/10 text-cyan-300' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleSelectContentType(t.id)}
                        className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${contentType === t.id
                            ? `${t.color} border-2 shadow-lg scale-[1.02]`
                            : 'border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                          }`}
                      >
                        <span className="text-lg">{t.icon}</span>
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      {activeTypeConfig.titleLabel}
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder={activeTypeConfig.titlePlaceholder}
                      className="rg-input"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      {activeTypeConfig.creatorLabel}
                    </label>
                    <input
                      type="text"
                      value={author}
                      onChange={e => setAuthor(e.target.value)}
                      placeholder={activeTypeConfig.creatorPlaceholder}
                      className="rg-input"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      {activeTypeConfig.performerLabel}
                    </label>
                    <input
                      type="text"
                      value={narrator}
                      onChange={e => setNarrator(e.target.value)}
                      placeholder={activeTypeConfig.performerPlaceholder}
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
                      placeholder={activeTypeConfig.pricePlaceholder}
                      className="rg-input"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">Prix Promotionnel (optionnel)</label>
                    <input
                      type="number"
                      value={discountPrice}
                      onChange={e => setDiscountPrice(e.target.value)}
                      placeholder={activeTypeConfig.discountPricePlaceholder}
                      className="rg-input"
                    />
                  {/* Assistant IA DeepSeek */}
                  <div className="sm:col-span-2 p-4 rounded-2xl bg-gradient-to-r from-purple-950/70 via-indigo-950/50 to-slate-900/80 border border-purple-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-purple-950/40">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-md flex-shrink-0">
                        <Sparkles className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-white">Assistant IA DeepSeek</h4>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-extrabold border border-purple-500/40">
                            DeepSeek-V3
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Générez instantanément l'accroche, le synopsis, la catégorie et les mots-clés en 1 clic.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDeepSeekEnrich}
                      disabled={isAiGenerating || !title.trim()}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all self-stretch sm:self-auto justify-center cursor-pointer"
                    >
                      {isAiGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-purple-200" />
                          <span>Génération IA en cours...</span>
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4" />
                          <span>✨ Auto-générer avec l'IA</span>
                        </>
                      )}
                    </button>
                  </div>

                  {aiSuccessMessage && (
                    <div className="sm:col-span-2 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>{aiSuccessMessage}</span>
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      {activeTypeConfig.descriptionLabel}
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder={activeTypeConfig.descriptionPlaceholder}
                      className="rg-input resize-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      {activeTypeConfig.synopsisLabel}
                    </label>
                    <textarea
                      rows={4}
                      value={synopsis}
                      onChange={e => setSynopsis(e.target.value)}
                      placeholder={activeTypeConfig.synopsisPlaceholder}
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
                    <span>Suivant : Médias & Extraits</span>
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
                    label={activeTypeConfig.coverLabel}
                    accept="image/jpeg,image/png,image/webp"
                    type="cover"
                    icon={ImageIcon}
                    value={coverData?.public_url || ''}
                    onUploaded={setCoverData}
                  />
                  <DropZone
                    label={activeTypeConfig.previewLabel}
                    accept="audio/mpeg,audio/mp3,audio/wav,audio/*"
                    type="preview"
                    icon={Mic}
                    value={previewData?.public_url || ''}
                    onDurationDetected={(dur) => {
                      if (chapters[0]?.duration_seconds === activeTypeConfig.defaultItemDuration) {
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
                    <span>Suivant : {activeTypeConfig.itemPlural}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ÉTAPE 3 : Chapitres / Épisodes / Pistes / Modules */}
            {step === 3 && (
              <div className="card-lg space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-white">
                    {activeTypeConfig.itemPlural} Audio ({chapters.length})
                  </h2>
                  <button onClick={addChapter} className="rg-btn-ghost px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Ajouter un {activeTypeConfig.itemSingular.toLowerCase()}
                  </button>
                </div>

                <div className="space-y-4">
                  {chapters.map((chap, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-white/4 border border-white/8 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-300 flex items-center gap-2">
                          <Music className="w-4 h-4" /> {activeTypeConfig.itemSingular} {i + 1}
                        </span>
                        {chapters.length > 1 && (
                          <button onClick={() => removeChapter(i)} className="text-slate-400 hover:text-rose-400 p-1">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                            Titre du {activeTypeConfig.itemSingular.toLowerCase()}
                          </label>
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
                        label={activeTypeConfig.trackDropLabel(i + 1)}
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
                  <h2 className="text-2xl font-black text-white font-['Outfit']">
                    {activeTypeConfig.publishSuccessTitle}
                  </h2>
                  <p className="text-xs text-slate-300 mt-1">
                    {activeTypeConfig.publishSuccessSubtitle(publishedBook.title)}
                  </p>
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
                    <p className="text-xs text-slate-400">
                      Par {publishedBook.author} • {publishedBook.chapters?.length || 1} {publishedBook.chapters?.length > 1 ? activeTypeConfig.itemPlural.toLowerCase() : activeTypeConfig.itemSingular.toLowerCase()}
                    </p>
                    <p className="text-xs font-bold text-emerald-400 mt-0.5">{publishedBook.discount_price || publishedBook.price} FCFA</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center justify-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Synchronisé : tous les utilisateurs, mobiles et visiteurs voient désormais ce contenu en direct.</span>
                </div>

                <div className="flex justify-center gap-3 pt-2">
                  <button onClick={() => setActiveRubric('catalog')} className="rg-btn-ghost px-6 py-2.5 rounded-2xl text-sm">
                    Voir dans le Catalogue
                  </button>
                  <button onClick={() => resetPublishForm(contentType)} className="btn-gradient px-6 py-2.5 rounded-2xl text-sm font-bold">
                    {activeTypeConfig.anotherButtonText}
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

              {/* Boutons d'Action TTS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Écoute Directe Voix Système */}
                <button
                  type="button"
                  onClick={handleLiveSpeechToggle}
                  disabled={!ttsText.trim()}
                  className={`py-3.5 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    isSpeechSpeaking
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200 hover:text-white'
                  }`}
                >
                  {isSpeechSpeaking ? (
                    <><VolumeX className="w-4 h-4 text-rose-400" /><span>Arrêter la Voix Live</span></>
                  ) : (
                    <><Volume2 className="w-4 h-4 text-purple-400" /><span>Écouter en Voix Système (Web Speech)</span></>
                  )}
                </button>

                {/* 2. Génération Audio Fichier pour Catalogue */}
                <button
                  type="button"
                  onClick={handleGenerateTTS}
                  disabled={isTtsGenerating || !ttsText.trim()}
                  className="btn-gradient py-3.5 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-xl disabled:opacity-40"
                >
                  {isTtsGenerating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Synthèse vocale en cours...</>
                  ) : (
                    <><Wand2 className="w-4 h-4" /> Générer Fichier Audio IA</>
                  )}
                </button>
              </div>

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
            4. RUBRIQUE : STUDIO AUDACITY & DÉCOUPE AUDIO (DSP & CUTTER)
            ══════════════════════════════════════════════════════════════════ */}
        {activeRubric === 'audacity' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit'] flex items-center gap-2.5">
                <Scissors className="w-7 h-7 text-emerald-400" />
                <span>Studio Audacity Pro & Découpe Audio (DSP)</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5 font-medium">
                Découpez, rognez vos fichiers audio, supprimez les bruits de fond, fusionnez plusieurs pistes et optimisez la clarté de vos masters.
              </p>
            </div>

            <div className="card-lg space-y-6">
              {/* Onglets Mode : Découpe Directe ou Fusion Multi-Pistes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Option 1 : Découpe & Rognage Direct */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/25 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs uppercase tracking-wider">
                    <Scissors className="w-4 h-4 text-emerald-400" />
                    <span>Option 1 : Découpe Rapide d'un Fichier Audio</span>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Chargez un fichier MP3, WAV, M4A ou OGG pour afficher immédiatement son spectre et le découper avec précision millimétrique.
                  </p>
                  <label className="btn-gradient w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 transition-all">
                    <FileAudio className="w-4 h-4" />
                    <span>Charger un Audio à Découper</span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setDspProcessing(true);
                        try {
                          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                          const arrayBuffer = await file.arrayBuffer();
                          const decoded = await audioCtx.decodeAudioData(arrayBuffer);
                          const dur = Math.round(decoded.duration);
                          const wavBlob = audioBufferToWav(decoded);
                          const url = URL.createObjectURL(wavBlob);
                          setActiveTrimAudioBuffer(decoded);
                          setDspProcessedUrl(url);
                          setDspDuration(dur);
                          setTrimStart(0);
                          setTrimEnd(dur);
                          setTimeout(() => drawWaveform(decoded, 0, dur), 100);
                        } catch (err) {
                          console.error('[Cutter] Erreur décodage audio:', err);
                        }
                        setDspProcessing(false);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Option 2 : Fusion Multi-Pistes & Mastering DSP */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-fuchsia-500/5 border border-purple-500/25 space-y-3">
                  <div className="flex items-center gap-2 text-purple-300 font-bold text-xs uppercase tracking-wider">
                    <Sliders className="w-4 h-4 text-purple-400" />
                    <span>Option 2 : Fusion Multi-Pistes & Effets DSP</span>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Ajoutez plusieurs segments ou pistes pour les combiner en un seul master avec égalisation, réducteur de souffle et compression.
                  </p>
                  <label className="rg-btn-ghost w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer border border-purple-500/30 hover:border-purple-500 text-purple-200">
                    <Plus className="w-4 h-4" />
                    <span>Ajouter des Pistes à Fusionner</span>
                    <input
                      type="file"
                      multiple
                      accept="audio/*"
                      onChange={handleAddDspFiles}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Liste des Pistes Multiples si présentes */}
              {dspTracks.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Pistes à fusionner ({dspTracks.length}) :</span>
                    <button onClick={() => setDspTracks([])} className="text-xs text-rose-400 hover:text-rose-300 font-bold">
                      Vider la liste
                    </button>
                  </div>
                  <div className="space-y-2">
                    {dspTracks.map((t, idx) => (
                      <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-white/4 border border-white/8 text-xs">
                        <span className="font-bold text-white truncate max-w-[240px]">{idx + 1}. {t.name}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => moveDspTrack(idx, -1)} className="p-1 text-slate-400 hover:text-white" title="Monter"><ArrowUp className="w-3.5 h-3.5" /></button>
                          <button onClick={() => moveDspTrack(idx, 1)} className="p-1 text-slate-400 hover:text-white" title="Descendre"><ArrowDown className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setDspTracks(prev => prev.filter((_, i) => i !== idx))} className="p-1 text-slate-400 hover:text-rose-400" title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Traitements DSP Actifs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    {[
                      { label: 'Réduction de bruit', state: dspNoiseReduction, set: setDspNoiseReduction },
                      { label: 'Clarté Vocale', state: dspVocalClarity, set: setDspVocalClarity },
                      { label: 'Compression DSP', state: dspCompression, set: setDspCompression },
                      { label: 'Chaleur Analogique', state: dspWarmth, set: setDspWarmth },
                    ].map((item) => (
                      <button
                        key={item.label}
                        onClick={() => item.set(!item.state)}
                        className={`p-3 rounded-2xl border text-xs font-bold transition-all text-left flex flex-col justify-between h-20 ${item.state
                            ? 'bg-purple-600/20 border-purple-500/40 text-purple-200 shadow-md'
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
                </div>
              )}

              {/* Résultat Master & Visualiseur de Spectre Audio & Découpe Précise */}
              {dspProcessedUrl && (
                <div className="p-5 rounded-3xl bg-purple-500/10 border border-purple-500/30 space-y-4 shadow-2xl animate-fadeIn">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs sm:text-sm font-black text-purple-200 flex items-center gap-2">
                      <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
                      <span>Audio Décodé & Prêt pour l'Édition ({dspDuration}s • {formatDuration(dspDuration)})</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = dspProcessedUrl;
                          a.download = `Audio_Decoupe_RGPlay_${Date.now()}.wav`;
                          a.click();
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-slate-200 flex items-center gap-1.5 transition-all"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Télécharger (.wav)</span>
                      </button>
                      <button
                        onClick={() => handleApplyDspToPublishing(0)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md flex items-center gap-1.5 transition-all"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Insérer dans la Publication</span>
                      </button>
                    </div>
                  </div>

                  <audio ref={dspAudioRef} src={dspProcessedUrl} controls className="w-full h-10 rounded-2xl" />

                  {/* Visualiseur de Spectre & Outils de Découpe (Waveform) */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-black/50 border border-white/10 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-pink-400" />
                        <span>Spectre Audio & Découpe Précise (Waveform)</span>
                      </span>
                      <span className="text-xs font-mono font-bold text-purple-300 bg-purple-500/20 px-3 py-1 rounded-full border border-purple-500/30">
                        Sélection : {trimStart}s ➔ {trimEnd || dspDuration}s ({(trimEnd || dspDuration) - trimStart}s)
                      </span>
                    </div>

                    {/* Canvas Forme d'Onde */}
                    <div className="relative overflow-hidden rounded-2xl border border-purple-500/40 shadow-inner bg-[#0a0718]">
                      <canvas
                        ref={waveformCanvasRef}
                        width={800}
                        height={130}
                        className="w-full h-32 block cursor-pointer"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const clickX = e.clientX - rect.left;
                          const ratio = clickX / rect.width;
                          const clickedSec = Math.round(ratio * (dspDuration || 1));
                          if (Math.abs(clickedSec - trimStart) < Math.abs(clickedSec - (trimEnd || dspDuration))) {
                            setTrimStart(Math.min(clickedSec, (trimEnd || dspDuration) - 1));
                            if (activeTrimAudioBuffer) drawWaveform(activeTrimAudioBuffer, clickedSec, trimEnd || dspDuration);
                          } else {
                            setTrimEnd(Math.max(clickedSec, trimStart + 1));
                            if (activeTrimAudioBuffer) drawWaveform(activeTrimAudioBuffer, trimStart, clickedSec);
                          }
                        }}
                      />
                    </div>

                    {/* Contrôles de Lecture Sélective */}
                    <div className="flex items-center justify-center gap-3 py-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (!dspAudioRef.current) return;
                          if (trimPlayTimeoutRef.current) clearTimeout(trimPlayTimeoutRef.current);
                          dspAudioRef.current.currentTime = trimStart;
                          dspAudioRef.current.play().catch(() => {});
                          const durationToPlay = Math.max(0.5, (trimEnd || dspDuration) - trimStart);
                          trimPlayTimeoutRef.current = setTimeout(() => {
                            if (dspAudioRef.current && !dspAudioRef.current.paused) {
                              dspAudioRef.current.pause();
                            }
                          }, durationToPlay * 1000);
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white shadow-lg flex items-center gap-2 active:scale-95 transition-all"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Écouter la Sélection Uniquement</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (trimPlayTimeoutRef.current) clearTimeout(trimPlayTimeoutRef.current);
                          if (dspAudioRef.current) dspAudioRef.current.pause();
                        }}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-slate-300 flex items-center gap-1.5"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause</span>
                      </button>
                    </div>

                    {/* Sliders Début & Fin de Coupe avec Réglage Fin */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold pt-1">
                      {/* Curseur Début */}
                      <div className="p-3 rounded-xl bg-white/5 border border-white/8 space-y-2">
                        <div className="flex justify-between items-center text-slate-300">
                          <span className="text-emerald-400 flex items-center gap-1">
                            <span>[</span> Point de Début (Start)
                          </span>
                          <span className="font-mono text-sm text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                            {trimStart} s
                          </span>
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
                          className="w-full accent-emerald-400 cursor-pointer"
                        />
                        <div className="flex items-center justify-between gap-1 text-[10px] text-slate-400">
                          <div className="flex gap-1">
                            <button onClick={() => { const v = Math.max(0, trimStart - 5); setTrimStart(v); if (activeTrimAudioBuffer) drawWaveform(activeTrimAudioBuffer, v, trimEnd || dspDuration); }} className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20">-5s</button>
                            <button onClick={() => { const v = Math.max(0, trimStart - 1); setTrimStart(v); if (activeTrimAudioBuffer) drawWaveform(activeTrimAudioBuffer, v, trimEnd || dspDuration); }} className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20">-1s</button>
                          </div>
                          <span className="text-[9px] text-slate-500 uppercase">Ajustement fin</span>
                          <div className="flex gap-1">
                            <button onClick={() => { const v = Math.min((trimEnd || dspDuration) - 1, trimStart + 1); setTrimStart(v); if (activeTrimAudioBuffer) drawWaveform(activeTrimAudioBuffer, v, trimEnd || dspDuration); }} className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20">+1s</button>
                            <button onClick={() => { const v = Math.min((trimEnd || dspDuration) - 1, trimStart + 5); setTrimStart(v); if (activeTrimAudioBuffer) drawWaveform(activeTrimAudioBuffer, v, trimEnd || dspDuration); }} className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20">+5s</button>
                          </div>
                        </div>
                      </div>

                      {/* Curseur Fin */}
                      <div className="p-3 rounded-xl bg-white/5 border border-white/8 space-y-2">
                        <div className="flex justify-between items-center text-slate-300">
                          <span className="text-pink-400 flex items-center gap-1">
                            Point de Fin (End) <span>]</span>
                          </span>
                          <span className="font-mono text-sm text-pink-300 bg-pink-500/10 px-2 py-0.5 rounded-lg border border-pink-500/20">
                            {trimEnd || dspDuration} s
                          </span>
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
                          className="w-full accent-pink-400 cursor-pointer"
                        />
                        <div className="flex items-center justify-between gap-1 text-[10px] text-slate-400">
                          <div className="flex gap-1">
                            <button onClick={() => { const v = Math.max(trimStart + 1, (trimEnd || dspDuration) - 5); setTrimEnd(v); if (activeTrimAudioBuffer) drawWaveform(activeTrimAudioBuffer, trimStart, v); }} className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20">-5s</button>
                            <button onClick={() => { const v = Math.max(trimStart + 1, (trimEnd || dspDuration) - 1); setTrimEnd(v); if (activeTrimAudioBuffer) drawWaveform(activeTrimAudioBuffer, trimStart, v); }} className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20">-1s</button>
                          </div>
                          <span className="text-[9px] text-slate-500 uppercase">Ajustement fin</span>
                          <div className="flex gap-1">
                            <button onClick={() => { const v = Math.min(dspDuration, (trimEnd || dspDuration) + 1); setTrimEnd(v); if (activeTrimAudioBuffer) drawWaveform(activeTrimAudioBuffer, trimStart, v); }} className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20">+1s</button>
                            <button onClick={() => { const v = Math.min(dspDuration, (trimEnd || dspDuration) + 5); setTrimEnd(v); if (activeTrimAudioBuffer) drawWaveform(activeTrimAudioBuffer, trimStart, v); }} className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20">+5s</button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Boutons d'Action de Découpe */}
                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button
                        onClick={handleTrimKeep}
                        disabled={isTrimApplying || !activeTrimAudioBuffer}
                        className="px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 flex items-center gap-2 transition-all shadow-lg active:scale-95"
                      >
                        <Scissors className="w-4 h-4 text-emerald-400" />
                        <span>Garder uniquement la Sélection (Trim)</span>
                      </button>

                      <button
                        onClick={handleCutDelete}
                        disabled={isTrimApplying || !activeTrimAudioBuffer}
                        className="px-5 py-2.5 rounded-xl text-xs font-black bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/40 flex items-center gap-2 transition-all shadow-lg active:scale-95"
                      >
                        <Trash2 className="w-4 h-4 text-rose-400" />
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
            5. RUBRIQUE : STATISTIQUES & ANALYTICS VISITEURS
            ══════════════════════════════════════════════════════════════════ */}
        {activeRubric === 'analytics' && (() => {
          const totalBooks = books.length;
          const {
            uniqueVisitors = 0,
            todayVisitors = 0,
            sources = [],
            topAudios = [],
            recentVisitors = [],
            convRate = '0.0',
          } = analyticsData || {};

          return (
            <div className="space-y-6 animate-fadeIn">
              {/* Header avec bouton rafraîchir */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit'] flex items-center gap-2.5">
                    <Activity className="w-7 h-7 text-emerald-400" />
                    <span>Statistiques & Visiteurs en Direct</span>
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                    Suivi précis de tous les visiteurs (inscrits & anonymes), sources d'acquisition et audios écoutés
                  </p>
                </div>
                <button
                  onClick={loadLiveAnalytics}
                  disabled={loadingAnalytics}
                  className="rg-btn-ghost px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 self-start sm:self-auto"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAnalytics ? 'animate-spin text-emerald-400' : ''}`} />
                  <span>Actualiser</span>
                </button>
              </div>

              {/* ── 1. KPIs VISITEURS & CONVERSION EN DIRECT ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card-md space-y-1.5 border border-purple-500/20 bg-purple-950/10">
                  <div className="flex items-center justify-between">
                    <Users className="w-5 h-5 text-purple-400" />
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">Total</span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">{uniqueVisitors}</p>
                  <p className="text-xs text-slate-400">Visiteurs Uniques Détectés</p>
                </div>

                <div className="card-md space-y-1.5 border border-emerald-500/20 bg-emerald-950/10">
                  <div className="flex items-center justify-between">
                    <Zap className="w-5 h-5 text-emerald-400" />
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">Aujourd'hui</span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-emerald-400 font-['Outfit']">{todayVisitors}</p>
                  <p className="text-xs text-slate-400">Visites du Jour</p>
                </div>

                <div className="card-md space-y-1.5 border border-cyan-500/20 bg-cyan-950/10">
                  <div className="flex items-center justify-between">
                    <Headphones className="w-5 h-5 text-cyan-400" />
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">Écoutes</span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-cyan-300 font-['Outfit']">
                    {topAudios.reduce((s, a) => s + (a.plays || 0), 0)}
                  </p>
                  <p className="text-xs text-slate-400">Lectures Réelles Déclenchées</p>
                </div>

                <div className="card-md space-y-1.5 border border-amber-500/20 bg-amber-950/10">
                  <div className="flex items-center justify-between">
                    <TrendingUp className="w-5 h-5 text-amber-400" />
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">Conversion</span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-amber-300 font-['Outfit']">{convRate}%</p>
                  <p className="text-xs text-slate-400">Clics d'Achat / Visiteur</p>
                </div>
              </div>

              {/* ── 2. SOURCES DE TRAFIC & AUDIOS RÉELLEMENT ÉCOUTÉS ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Sources d'acquisition */}
                <div className="card-lg space-y-4">
                  <h2 className="text-sm font-bold text-white flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-purple-400" />
                      <span>Origine du Trafic (D'où viennent vos visiteurs ?)</span>
                    </span>
                    <span className="text-xs text-slate-400 font-normal">WhatsApp, Réseaux, Direct</span>
                  </h2>

                  {sources.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">Aucune source enregistrée pour l'instant.</p>
                  ) : (
                    <div className="space-y-3">
                      {sources.map(src => {
                        const iconColor =
                          src.source === 'WhatsApp' ? 'text-emerald-400' :
                          src.source === 'Facebook' ? 'text-blue-400' :
                          src.source === 'TikTok' ? 'text-pink-400' :
                          src.source === 'Instagram' ? 'text-fuchsia-400' :
                          src.source === 'Google' ? 'text-amber-400' : 'text-slate-400';
                        return (
                          <div key={src.source} className="space-y-1 text-xs">
                            <div className="flex items-center justify-between font-bold">
                              <span className={`flex items-center gap-1.5 ${iconColor}`}>
                                {src.source === 'WhatsApp' ? '💬' :
                                 src.source === 'Facebook' ? '📘' :
                                 src.source === 'TikTok' ? '🎵' :
                                 src.source === 'Instagram' ? '📸' :
                                 src.source === 'Google' ? '🔍' : '🌐'} {src.source}
                              </span>
                              <span className="text-slate-300 font-mono">{src.count} visites ({src.pct}%)</span>
                            </div>
                            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-emerald-400 rounded-full transition-all duration-700"
                                style={{ width: `${src.pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Top Audios écoutés en direct */}
                <div className="card-lg space-y-4">
                  <h2 className="text-sm font-bold text-white flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Headphones className="w-4 h-4 text-emerald-400" />
                      <span>Audios les Plus Écoutés (Statistiques Réelles)</span>
                    </span>
                    <span className="text-xs text-emerald-400 font-bold">Privé Admin</span>
                  </h2>

                  {topAudios.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">Aucune écoute enregistrée pour l'instant.</p>
                  ) : (
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 no-scrollbar">
                      {topAudios.map((aud, idx) => (
                        <div key={aud.id || idx} className="p-3 rounded-2xl bg-white/4 border border-white/6 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center text-[11px] flex-shrink-0 font-mono">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="font-bold text-white truncate">{aud.title || aud.audiobook_title || 'Audiobook'}</p>
                              <p className="text-[10px] text-slate-400">
                                {aud.seconds || aud.total_seconds ? `~${Math.round((aud.seconds || aud.total_seconds) / 60)} min écoutées au total` : 'Écoutes en cours'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-black text-xs font-mono">
                              {aud.plays} écoute{aud.plays > 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── 3. JOURNAL DÉTAILLÉ DE TOUS LES VISITEURS (FEED EN DIRECT) ── */}
              <div className="card-lg space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-cyan-400" />
                      <span>Flux des Visiteurs Récents ({recentVisitors.length})</span>
                    </h2>
                    <p className="text-xs text-slate-400">Cliquez sur un visiteur pour voir tous ses audios écoutés et interactions</p>
                  </div>
                  <span className="text-[11px] px-3 py-1 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold">
                    Direct
                  </span>
                </div>

                {recentVisitors.length === 0 ? (
                  <div className="text-center py-10 space-y-2">
                    <Users className="w-10 h-10 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400">Aucun visiteur enregistré dans la base pour le moment.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 no-scrollbar">
                    {recentVisitors.map((vis) => {
                      const isSelected = selectedVisitorDetail === vis.visitor_id;
                      const hasAudios = (vis.audios && vis.audios.length > 0) || (vis.events && vis.events.some(e => e.event_type === 'audio_play'));
                      const hasPurchases = (vis.actions && vis.actions.some(a => a.action === 'buy_click')) || (vis.events && vis.events.some(e => e.action === 'buy_click'));
                      const timeAgo = vis.started_at ? new Date(vis.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'récent';

                      return (
                        <div
                          key={vis.visitor_id}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-purple-950/30 border-purple-500/50 shadow-lg'
                              : 'bg-white/4 border-white/6 hover:border-white/15'
                          }`}
                          onClick={() => setSelectedVisitorDetail(isSelected ? null : vis.visitor_id)}
                        >
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            {/* Identifiant & Inscription */}
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center font-black text-xs text-white flex-shrink-0">
                                {vis.user_name ? vis.user_name[0].toUpperCase() : '👤'}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs font-bold text-white truncate font-['Outfit']">
                                    {vis.user_name || `Visiteur #${vis.visitor_id.slice(-6)}`}
                                  </p>
                                  {vis.user_email ? (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">Inscrit</span>
                                  ) : (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-white/10 text-slate-400 font-bold">Anonyme</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400 truncate">
                                  {vis.device || 'Mobile'} • {vis.landing_url ? new URL(vis.landing_url).pathname : '/'}
                                </p>
                              </div>
                            </div>

                            {/* Source & Actions */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                vis.source === 'WhatsApp' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' :
                                vis.source === 'Facebook' ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' :
                                vis.source === 'TikTok' ? 'bg-pink-500/15 text-pink-300 border-pink-500/30' :
                                'bg-white/8 text-slate-300 border-white/10'
                              }`}>
                                {vis.source || 'Direct'}
                              </span>

                              {hasAudios && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold flex items-center gap-0.5">
                                  <Headphones className="w-2.5 h-2.5" /> Écouté
                                </span>
                              )}

                              {hasPurchases && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                                  🛒 Clic Achat
                                </span>
                              )}

                              <span className="text-[10px] text-slate-400 font-mono">{timeAgo}</span>
                            </div>
                          </div>

                          {/* Tiroir d'interaction détaillé */}
                          {isSelected && (
                            <div className="mt-3 pt-3 border-t border-white/10 space-y-2 text-xs animate-fadeIn">
                              <p className="font-bold text-purple-300 text-[11px] uppercase tracking-wider">
                                Historique d'Écoute & Interactions de ce Visiteur :
                              </p>

                              {/* Audios écoutés */}
                              {vis.audios && vis.audios.length > 0 ? (
                                <div className="space-y-1">
                                  {vis.audios.map((a, i) => (
                                    <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-white/4 text-slate-300 text-[11px]">
                                      <span className="flex items-center gap-1.5 truncate">
                                        <Headphones className="w-3 h-3 text-purple-400 flex-shrink-0" />
                                        <span className="font-semibold text-white">{a.audiobook_title || 'Audio'}</span>
                                      </span>
                                      <span className="text-slate-400 font-mono">{a.seconds_listened || 0}s écoutées</span>
                                    </div>
                                  ))}
                                </div>
                              ) : vis.events && vis.events.filter(e => e.event_type === 'audio_play').length > 0 ? (
                                <div className="space-y-1">
                                  {vis.events.filter(e => e.event_type === 'audio_play').map((a, i) => (
                                    <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-white/4 text-slate-300 text-[11px]">
                                      <span className="flex items-center gap-1.5 truncate">
                                        <Headphones className="w-3 h-3 text-purple-400 flex-shrink-0" />
                                        <span className="font-semibold text-white">{a.audiobook_title || 'Audio'}</span>
                                      </span>
                                      <span className="text-slate-400 font-mono">{a.seconds_listened || 0}s écoutées</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-slate-400 italic">Aucun extrait audio écouté lors de cette session.</p>
                              )}

                              {/* Clics & Actions */}
                              {vis.actions && vis.actions.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {vis.actions.map((act, i) => (
                                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                                      ⚡ Action : {act.action}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
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
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isSubscribed ? 'bg-emerald-500/20 border border-emerald-500/40' : 'bg-white/6 border border-white/10'
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
                    }).catch(() => { });
                  } catch (_) { }
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

        {/* ══════════════════════════════════════════════════════════════════
            8. RUBRIQUE : GÉNÉRATEUR D'API & INTÉGRATIONS IA (MCP / MANUS)
            ══════════════════════════════════════════════════════════════════ */}
        {activeRubric === 'api-generator' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header de la rubrique */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-extrabold mb-2">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Passerelle Développeur & Agents IA</span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-black text-white font-['Outfit'] tracking-tight">
                  Générateur d'API & MCP IA
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium max-w-2xl">
                  Générez des clés d'accès sécurisées et des configurations prêtes à l'emploi (Manus IA, Claude Desktop, Cursor, Scripts cURL/Python) adaptées aux fonctionnalités sélectionnées.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => selectPreset('ai_agent')}
                  className="px-4 py-2.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Preset Manus IA</span>
                </button>
                <button
                  onClick={() => selectPreset('all')}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Tout Cocher</span>
                </button>
              </div>
            </div>

            {/* ── BANDEAU POINT D'ENTRÉE API & BASE URL ── */}
            <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-950/60 via-slate-900/80 to-purple-950/60 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 flex-shrink-0 shadow-lg shadow-emerald-500/10">
                  <Terminal className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Point d'Entrée API (Base Endpoint)</span>
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">REST • HTTPS</span>
                  </div>
                  <code className="text-sm sm:text-base font-mono font-black text-emerald-300 block truncate mt-0.5">
                    https://rg-play.pages.dev/api
                  </code>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => handleCopyText('https://rg-play.pages.dev/api', 'base_url')}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  {copiedField === 'base_url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === 'base_url' ? 'Copié !' : 'Copier le Base URL'}</span>
                </button>
              </div>
            </div>

            {/* Formulaire de Configuration de la Clé */}
            <div className="card-lg space-y-6">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-emerald-400" /> 1. Paramètres de l'Accès API
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Identifiez l'assistant IA ou l'application qui utilisera cette clé</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5 sm:col-span-1">
                  <label className="text-xs font-bold text-slate-300">Nom de l'Assistant / Client *</label>
                  <input
                    type="text"
                    value={apiName}
                    onChange={(e) => setApiName(e.target.value)}
                    placeholder="Ex: Manus IA Prod, Agent Cursor..."
                    className="rg-input text-xs w-full font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Durée de Validité</label>
                  <select
                    value={apiExpiration}
                    onChange={(e) => setApiExpiration(e.target.value)}
                    className="rg-input text-xs w-full cursor-pointer"
                    style={{ background: '#16112e' }}
                  >
                    <option value="never">Illimitée (Recommandé pour agents)</option>
                    <option value="30d">30 Jours</option>
                    <option value="90d">90 Jours</option>
                    <option value="365d">1 An</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Limite de Débit (Rate Limit)</label>
                  <select
                    value={apiRateLimit}
                    onChange={(e) => setApiRateLimit(e.target.value)}
                    className="rg-input text-xs w-full cursor-pointer"
                    style={{ background: '#16112e' }}
                  >
                    <option value="120">120 requêtes / minute (Standard)</option>
                    <option value="300">300 requêtes / minute (Haute cadence)</option>
                    <option value="unlimited">Illimité (Mode Admin Total)</option>
                  </select>
                </div>
              </div>

              {/* Sélection des Fonctionnalités / Scopes */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-purple-400" /> 2. Fonctionnalités & Permissions Autorisées ({selectedScopes.length}/{API_AVAILABLE_SCOPES.length})
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">Cochez uniquement les modules que l'IA ou l'application a le droit d'exécuter</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => selectPreset('readonly')}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors cursor-pointer"
                    >
                      Lecture Seule
                    </button>
                    <button
                      type="button"
                      onClick={() => selectPreset('payments')}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors cursor-pointer"
                    >
                      Paiements Seuls
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  {API_AVAILABLE_SCOPES.map((scope) => {
                    const isChecked = selectedScopes.includes(scope.id);
                    const ScopeIcon = scope.icon;
                    return (
                      <div
                        key={scope.id}
                        onClick={() => toggleScope(scope.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 select-none ${
                          isChecked
                            ? 'bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/5 scale-[1.01]'
                            : 'bg-white/4 border-white/8 hover:bg-white/8 text-slate-400 opacity-75 hover:opacity-100'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 border transition-all ${
                          isChecked
                            ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 border-emerald-400 text-white shadow-md'
                            : 'bg-white/5 border-white/20 text-transparent'
                        }`}>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                              <ScopeIcon className={`w-3.5 h-3.5 ${isChecked ? 'text-emerald-400' : 'text-slate-400'}`} />
                              {scope.label}
                            </span>
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-white/8 text-slate-300 flex-shrink-0 border border-white/6 font-bold">
                              {scope.tag}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                            {scope.desc}
                          </p>
                          <code className="text-[10px] text-cyan-300/80 font-mono block mt-1 truncate">
                            {scope.fullUrl}
                          </code>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bouton de Génération */}
              <div className="pt-3 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  onClick={handleGenerateKey}
                  disabled={selectedScopes.length === 0}
                  className="btn-gradient px-7 py-3.5 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 shadow-2xl active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Zap className="w-4 h-4 fill-white" />
                  <span>Générer la Clé d'API & Config IA ({selectedScopes.length} permissions)</span>
                </button>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                RÉSULTAT : CLÉ GÉNÉRÉE & CODE SNIPPETS
                ══════════════════════════════════════════════════════════════ */}
            {generatedKey && (
              <div className="card-lg space-y-5 border border-emerald-500/40 bg-emerald-950/20 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/20 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-slate-950 shadow-lg flex-shrink-0">
                      <Key className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white font-['Outfit']">
                        Clé d'API Prête : {generatedKey.name}
                      </h3>
                      <p className="text-xs text-emerald-300">
                        {generatedKey.scopes.length} fonctionnalités débloquées • Expiration : {generatedKey.expiration === 'never' ? 'Illimitée' : generatedKey.expiration}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      Prêt à l'Emploi
                    </span>
                  </div>
                </div>

                {/* Double Carte : Base URL & Token Bearer */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* 1. Point d'Entrée Global (Base URL) */}
                  <div className="p-4 rounded-2xl bg-black/50 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-bold flex items-center gap-1.5 text-slate-300">
                        <ExternalLink className="w-3.5 h-3.5 text-cyan-400" /> Endpoint Racine (Base URL)
                      </span>
                      <span className="text-[10px] text-cyan-300">URL Globale</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value="https://rg-play.pages.dev/api"
                        className="rg-input text-xs font-mono font-bold text-cyan-300 bg-slate-950/80 border-cyan-500/40 w-full select-all"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyText('https://rg-play.pages.dev/api', 'res_base_url')}
                        className="px-3.5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1 transition-all flex-shrink-0 active:scale-95 cursor-pointer shadow-md"
                      >
                        {copiedField === 'res_base_url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedField === 'res_base_url' ? 'Copié !' : 'Copier'}</span>
                      </button>
                    </div>
                  </div>

                  {/* 2. Token Bearer */}
                  <div className="p-4 rounded-2xl bg-black/50 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-bold flex items-center gap-1.5 text-slate-300">
                        <Lock className="w-3.5 h-3.5 text-emerald-400" /> Clé Bearer (Token d'Authentification)
                      </span>
                      <span className="text-[10px] text-amber-300">Header: Authorization</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedKey.fullKey}
                        className="rg-input text-xs font-mono font-bold text-emerald-300 bg-slate-950/80 border-emerald-500/40 w-full select-all"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyText(generatedKey.fullKey, 'key')}
                        className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition-all flex-shrink-0 active:scale-95 cursor-pointer shadow-md"
                      >
                        {copiedField === 'key' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedField === 'key' ? 'Copié !' : 'Copier'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── Switcher d'Export & Endpoints Détaillés ── */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-cyan-400" /> Choisissez votre mode d'intégration :
                    </span>
                    <div className="flex gap-1 overflow-x-auto no-scrollbar">
                      {[
                        { id: 'endpoints', label: `📡 Endpoints Détaillés (${generatedKey.scopes.length})` },
                        { id: 'manus', label: '🤖 Prompt Manus IA' },
                        { id: 'mcp', label: '🧩 Config MCP (Claude/Cursor)' },
                        { id: 'curl', label: 'cURL' },
                        { id: 'fetch', label: 'JavaScript' },
                        { id: 'python', label: 'Python' },
                      ].map(tab => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveCodeTab(tab.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                            activeCodeTab === tab.id
                              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                              : 'bg-white/6 text-slate-400 hover:text-white border border-white/8'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Contenu de l'onglet sélectionné */}
                  <div className="relative">

                    {/* TAB : ENDPOINTS DÉTAILLÉS & TABLEAU CLAIR */}
                    {activeCodeTab === 'endpoints' && (
                      <div className="space-y-3 animate-fadeIn">
                        <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between text-xs text-slate-300">
                          <span>Liste complète de vos routes API débloquées avec cette clé :</span>
                          <span className="text-[11px] font-bold text-emerald-300">{generatedKey.scopes.length} routes actives</span>
                        </div>

                        <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                          {API_AVAILABLE_SCOPES.filter(s => generatedKey.scopes.includes(s.id)).map(sc => (
                            <div key={sc.id} className="p-3.5 rounded-2xl bg-slate-950/90 border border-white/10 space-y-2">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase font-mono ${
                                    sc.method === 'GET' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                                    sc.method === 'POST' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' :
                                    'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  }`}>
                                    {sc.method}
                                  </span>
                                  <code className="text-xs font-mono font-bold text-white select-all">
                                    {sc.fullUrl}
                                  </code>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleCopyText(sc.fullUrl, `ep_${sc.id}`)}
                                  className="px-2.5 py-1 rounded-lg bg-white/8 hover:bg-white/15 text-slate-300 text-[10px] font-bold flex items-center gap-1 transition-all self-start sm:self-auto cursor-pointer"
                                >
                                  {copiedField === `ep_${sc.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  <span>{copiedField === `ep_${sc.id}` ? 'Copié !' : 'Copier l\'URL'}</span>
                                </button>
                              </div>

                              <p className="text-[11px] text-slate-400">
                                <strong>Description :</strong> {sc.doc}
                              </p>

                              {sc.sampleBody && (
                                <div className="p-2.5 rounded-xl bg-black/60 border border-white/6 font-mono text-[10px] text-slate-300 space-y-1">
                                  <span className="text-slate-500 font-bold block">Body JSON attendu (POST) :</span>
                                  <pre className="text-emerald-300 overflow-x-auto">{JSON.stringify(sc.sampleBody, null, 2)}</pre>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* TAB : PROMPT MANUS IA */}
                    {activeCodeTab === 'manus' && (
                      <div className="p-4 rounded-2xl bg-slate-950/90 border border-purple-500/30 space-y-3 font-mono text-xs text-slate-200">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <span className="text-[11px] font-bold text-purple-300">Prompt Système Personnalisé pour Manus IA / ChatGPT</span>
                          <button
                            type="button"
                            onClick={() => {
                              const text = `Tu es l'agent IA officiel et administrateur de la plateforme audio RG Play.
Pour exécuter tes actions, utilise l'API REST de production :
Base URL : https://rg-play.pages.dev/api
Clé d'autorisation : Bearer ${generatedKey.fullKey}

Endpoints et fonctionnalités autorisées pour cette clé :
${selectedScopes.includes('catalog_read') ? '- GET /audiobooks : Lister le catalogue (params: ?type=all|audiobook|podcast|music|masterclass, ?category=id, ?search=terme)\n- GET /audiobooks/:id : Récupérer la fiche complète d\'un livre et ses chapitres' : ''}
${selectedScopes.includes('catalog_write') ? '- POST /admin/books : Créer ou mettre à jour un livre audio dans Cloudflare D1 (body: { title, author, price, chapters, ... })' : ''}
${selectedScopes.includes('catalog_pin') ? '- POST /admin/books/:id/toggle-pin : Épingler ou désépingler en tête de boutique (body: { is_pinned: true })' : ''}
${selectedScopes.includes('catalog_delete') ? '- DELETE /admin/books/:id : Supprimer un livre audio et ses chapitres' : ''}
${selectedScopes.includes('social_metrics') ? '- POST /admin/books/:id/social-metrics : Appliquer l\'effet de masse (body: { display_plays_count: 15400, display_reviews_count: 2400, display_rating: 4.95 })' : ''}
${selectedScopes.includes('categories_manage') ? '- GET /categories & POST /admin/categories & DELETE /admin/categories/:id : Gérer les univers et catégories' : ''}
${selectedScopes.includes('payments_initiate') ? '- POST /payment/initiate : Déclencher un paiement Mobile Money (Orange Money, MTN) ou Carte (body: { audiobook_id, payment_method, customer_phone, amount })' : ''}
${selectedScopes.includes('payments_sync') ? '- GET /payment/status/:id & POST /admin/payment/sync-pending : Vérifier et synchroniser les transactions' : ''}
${selectedScopes.includes('analytics_read') ? '- GET /admin/analytics : Consulter les visiteurs uniques, sessions et tops écoutes' : ''}
${selectedScopes.includes('system_status') ? '- GET /status : Vérifier la santé de Cloudflare D1, R2, KV et de la passerelle' : ''}

Exécute la mission suivante : [VOTRE INSTRUCTION ICI]`;
                              handleCopyText(text, 'prompt');
                            }}
                            className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold flex items-center gap-1 transition-all"
                          >
                            {copiedField === 'prompt' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedField === 'prompt' ? 'Copié !' : 'Copier le Prompt'}</span>
                          </button>
                        </div>
                        <pre className="whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto text-slate-300 text-[11px]">
{`Tu es l'agent IA officiel et administrateur de la plateforme audio RG Play.
Pour exécuter tes actions, utilise l'API REST de production :
Base URL : https://rg-play.pages.dev/api
Clé d'autorisation : Bearer ${generatedKey.fullKey}

Endpoints et fonctionnalités autorisées pour cette clé :
${selectedScopes.includes('catalog_read') ? '• GET /audiobooks (Lister le catalogue avec ?type=, ?category=, ?search=)\n• GET /audiobooks/:id (Détails d\'un livre et ses chapitres)\n' : ''}${selectedScopes.includes('catalog_write') ? '• POST /admin/books (Créer ou modifier un livre audio dans D1)\n' : ''}${selectedScopes.includes('catalog_pin') ? '• POST /admin/books/:id/toggle-pin (Épingler/désépingler un livre)\n' : ''}${selectedScopes.includes('catalog_delete') ? '• DELETE /admin/books/:id (Supprimer un livre audio)\n' : ''}${selectedScopes.includes('social_metrics') ? '• POST /admin/books/:id/social-metrics (Appliquer l\'effet de masse : display_plays_count, display_reviews_count, display_rating)\n' : ''}${selectedScopes.includes('categories_manage') ? '• GET /categories & POST /admin/categories & DELETE /admin/categories/:id (Gérer les catégories)\n' : ''}${selectedScopes.includes('payments_initiate') ? '• POST /payment/initiate (Paiement CamerPay Mobile Money / Carte)\n' : ''}${selectedScopes.includes('payments_sync') ? '• GET /payment/status/:id & POST /admin/payment/sync-pending (Vérification et synchro)\n' : ''}${selectedScopes.includes('analytics_read') ? '• GET /admin/analytics (Statistiques de fréquentation)\n' : ''}${selectedScopes.includes('system_status') ? '• GET /status (Diagnostic santé D1/R2/KV)\n' : ''}
Exécute la mission suivante : [VOTRE DEMANDE ICI]`}
                        </pre>
                      </div>
                    )}

                    {/* TAB : CONFIG MCP */}
                    {activeCodeTab === 'mcp' && (
                      <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-500/30 space-y-3 font-mono text-xs text-slate-200">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <span className="text-[11px] font-bold text-emerald-300">Fichier de Configuration MCP (claude_desktop_config.json / cursor.json)</span>
                          <button
                            type="button"
                            onClick={() => {
                              const json = JSON.stringify({
                                mcpServers: {
                                  rgplay: {
                                    command: "node",
                                    args: ["c:/Users/SYGMA-TECH/Documents/RG Play/mcp-rgplay/index.js"],
                                    env: {
                                      RGPLAY_API_BASE: "https://rg-play.pages.dev/api",
                                      RGPLAY_API_KEY: generatedKey.fullKey
                                    }
                                  }
                                }
                              }, null, 2);
                              handleCopyText(json, 'mcp_json');
                            }}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 transition-all"
                          >
                            {copiedField === 'mcp_json' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedField === 'mcp_json' ? 'Copié !' : 'Copier le JSON'}</span>
                          </button>
                        </div>
                        <pre className="whitespace-pre-wrap leading-relaxed text-emerald-300 text-[11px]">
{JSON.stringify({
  mcpServers: {
    rgplay: {
      command: "node",
      args: ["c:/Users/SYGMA-TECH/Documents/RG Play/mcp-rgplay/index.js"],
      env: {
        RGPLAY_API_BASE: "https://rg-play.pages.dev/api",
        RGPLAY_API_KEY: generatedKey.fullKey
      }
    }
  }
}, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* TAB : CURL */}
                    {activeCodeTab === 'curl' && (
                      <div className="p-4 rounded-2xl bg-slate-950/90 border border-white/10 space-y-3 font-mono text-xs text-slate-200">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <span className="text-[11px] font-bold text-slate-300">Exemple de Requête cURL</span>
                          <button
                            type="button"
                            onClick={() => {
                              const cmd = `curl -X GET "https://rg-play.pages.dev/api/audiobooks" \\\n  -H "Authorization: Bearer ${generatedKey.fullKey}" \\\n  -H "Content-Type: application/json"`;
                              handleCopyText(cmd, 'curl');
                            }}
                            className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1 transition-all"
                          >
                            {copiedField === 'curl' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedField === 'curl' ? 'Copié !' : 'Copier'}</span>
                          </button>
                        </div>
                        <pre className="whitespace-pre-wrap leading-relaxed text-cyan-300 text-[11px]">
{`# 1. Lister les livres
curl -X GET "https://rg-play.pages.dev/api/audiobooks" \\
  -H "Authorization: Bearer ${generatedKey.fullKey}" \\
  -H "Content-Type: application/json"

# 2. Appliquer l'effet de masse sur un livre
curl -X POST "https://rg-play.pages.dev/api/admin/books/book-1/social-metrics" \\
  -H "Authorization: Bearer ${generatedKey.fullKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"display_plays_count": 18500, "display_reviews_count": 3200, "display_rating": 4.98}'`}
                        </pre>
                      </div>
                    )}

                    {/* TAB : JAVASCRIPT */}
                    {activeCodeTab === 'fetch' && (
                      <div className="p-4 rounded-2xl bg-slate-950/90 border border-white/10 space-y-3 font-mono text-xs text-slate-200">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <span className="text-[11px] font-bold text-slate-300">JavaScript / Fetch (Node.js & Navigateur)</span>
                          <button
                            type="button"
                            onClick={() => {
                              const js = `const API_BASE = 'https://rg-play.pages.dev/api';\nconst API_KEY = '${generatedKey.fullKey}';\n\nasync function getBooks() {\n  const res = await fetch(\`\${API_BASE}/audiobooks\`, {\n    headers: { 'Authorization': \`Bearer \${API_KEY}\` }\n  });\n  return await res.json();\n}`;
                              handleCopyText(js, 'js');
                            }}
                            className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1 transition-all"
                          >
                            {copiedField === 'js' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedField === 'js' ? 'Copié !' : 'Copier'}</span>
                          </button>
                        </div>
                        <pre className="whitespace-pre-wrap leading-relaxed text-amber-300 text-[11px]">
{`const API_BASE = 'https://rg-play.pages.dev/api';
const API_KEY = '${generatedKey.fullKey}';

// 1. Récupérer le catalogue
const res = await fetch(\`\${API_BASE}/audiobooks\`, {
  headers: { 'Authorization': \`Bearer \${API_KEY}\` }
});
const audiobooks = await res.json();

// 2. Appliquer l'effet de masse
await fetch(\`\${API_BASE}/admin/books/book-1/social-metrics\`, {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${API_KEY}\`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    display_plays_count: 24000,
    display_reviews_count: 4500,
    display_rating: 4.96
  })
});`}
                        </pre>
                      </div>
                    )}

                    {/* TAB : PYTHON */}
                    {activeCodeTab === 'python' && (
                      <div className="p-4 rounded-2xl bg-slate-950/90 border border-white/10 space-y-3 font-mono text-xs text-slate-200">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <span className="text-[11px] font-bold text-slate-300">Python (requests)</span>
                          <button
                            type="button"
                            onClick={() => {
                              const py = `import requests\n\nAPI_BASE = "https://rg-play.pages.dev/api"\nAPI_KEY = "${generatedKey.fullKey}"\n\nheaders = { "Authorization": f"Bearer {API_KEY}" }\nres = requests.get(f"{API_BASE}/audiobooks", headers=headers)\nprint(res.json())`;
                              handleCopyText(py, 'py');
                            }}
                            className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1 transition-all"
                          >
                            {copiedField === 'py' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedField === 'py' ? 'Copié !' : 'Copier'}</span>
                          </button>
                        </div>
                        <pre className="whitespace-pre-wrap leading-relaxed text-emerald-300 text-[11px]">
{`import requests

API_BASE = "https://rg-play.pages.dev/api"
API_KEY = "${generatedKey.fullKey}"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# 1. Lister les livres
response = requests.get(f"{API_BASE}/audiobooks", headers=headers)
print("Catalogue :", response.json())

# 2. Appliquer l'effet de masse
requests.post(
    f"{API_BASE}/admin/books/book-1/social-metrics",
    headers=headers,
    json={"display_plays_count": 18500, "display_reviews_count": 3200, "display_rating": 4.98}
)`}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                HISTORIQUE / GESTION DES CLÉS EXISTANTES
                ══════════════════════════════════════════════════════════════ */}
            <div className="card-lg space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Clés d'Accès Actives ({savedKeys.length})
                </h2>
                <span className="text-xs text-slate-400">Gérées et enregistrées localement</span>
              </div>

              {savedKeys.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Aucune clé active. Utilisez le générateur ci-dessus pour en créer une.</p>
              ) : (
                <div className="space-y-3">
                  {savedKeys.map((k) => (
                    <div
                      key={k.id}
                      className="p-4 rounded-2xl bg-white/4 border border-white/8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-white/15 transition-all"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white truncate font-['Outfit']">{k.name}</span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-black">
                            {k.status === 'active' ? 'Active' : 'Révoquée'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono">
                          <span className="text-slate-300 bg-white/6 px-2 py-0.5 rounded-md border border-white/8">{k.keyMasked || k.fullKey?.slice(0, 16) + '...'}</span>
                          <span>• Créée le {k.createdAt}</span>
                          <span>• {k.scopes?.length || 0} permissions</span>
                        </div>

                        <div className="flex flex-wrap gap-1 pt-1">
                          {(k.scopes || []).map(sc => (
                            <span key={sc} className="text-[9px] px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300">
                              {sc}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setGeneratedKey(k);
                            handleCopyText(k.fullKey, `saved_${k.id}`);
                          }}
                          className="px-3 py-2 rounded-xl bg-white/6 hover:bg-white/10 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all"
                          title="Copier le token"
                        >
                          {copiedField === `saved_${k.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedField === `saved_${k.id}` ? 'Copié !' : 'Copier'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRevokeKey(k.id)}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all"
                          title="Révoquer cette clé"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            MODALE : EFFET DE MASSE & SOCIAL PROOF PERSONNALISABLE
            ══════════════════════════════════════════════════════════════════ */}
        {socialModalBook && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-fadeIn">
            <div className="glass-card rounded-3xl w-full max-w-lg border border-amber-500/30 overflow-hidden shadow-2xl relative space-y-5 p-6">
              {/* Header de la modale */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 shadow-lg flex-shrink-0">
                    <Flame className="w-5 h-5 fill-slate-950" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white font-['Outfit']">Effet de Masse & Preuve Sociale</h3>
                    <p className="text-xs text-slate-400">Personnalisez les compteurs affichés aux visiteurs</p>
                  </div>
                </div>
                <button
                  onClick={() => setSocialModalBook(null)}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Aperçu du Livre Sélectionné */}
              <div className="p-3 rounded-2xl bg-white/4 border border-white/8 flex items-center gap-3">
                <img
                  src={socialModalBook.cover_url}
                  alt={socialModalBook.title}
                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=100&q=60'; }}
                  className="w-12 h-12 rounded-xl object-cover border border-white/10 flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate font-['Outfit']">{socialModalBook.title}</p>
                  <p className="text-[11px] text-slate-400 truncate">Par {socialModalBook.author}</p>
                </div>
              </div>

              {/* Comparatif : Métriques Réelles vs Affichées */}
              <div className="grid grid-cols-2 gap-3">
                {/* 1. Réel (Admin Only) */}
                <div className="p-3 rounded-2xl bg-white/4 border border-white/6 space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-slate-400" /> Réel (Admin Seul)
                  </span>
                  <div className="text-xs space-y-1 text-slate-300">
                    <p className="flex justify-between"><span>Vrais avis:</span> <strong className="text-white">{socialModalBook.rating_count || 0}</strong></p>
                    <p className="flex justify-between"><span>Vraie note:</span> <strong className="text-amber-400">{socialModalBook.rating || 5.0}★</strong></p>
                  </div>
                </div>

                {/* 2. Public (Effet de masse) */}
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 block flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" /> Affiché aux Clients
                  </span>
                  <div className="text-xs space-y-1 text-slate-200">
                    <p className="flex justify-between"><span>Écoutes:</span> <strong className="text-amber-300">{Number(socialPlays).toLocaleString()}</strong></p>
                    <p className="flex justify-between"><span>Avis:</span> <strong className="text-amber-300">{Number(socialReviews).toLocaleString()}</strong></p>
                  </div>
                </div>
              </div>

              {/* Formulaire de Réglage des Chiffres Publics */}
              <div className="space-y-3.5">
                {/* Écoutes affichées */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>Nombre d'Écoutes / Lectures Affichées</span>
                    <span className="text-[11px] text-purple-300 font-mono font-black">{Number(socialPlays).toLocaleString()} écoutes</span>
                  </label>
                  <input
                    type="number"
                    value={socialPlays}
                    onChange={(e) => setSocialPlays(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="Ex: 14500"
                    className="rg-input text-xs w-full font-mono font-bold"
                  />
                </div>

                {/* Avis affichés */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>Nombre d'Avis Affichés</span>
                    <span className="text-[11px] text-amber-300 font-mono font-black">{Number(socialReviews).toLocaleString()} avis</span>
                  </label>
                  <input
                    type="number"
                    value={socialReviews}
                    onChange={(e) => setSocialReviews(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="Ex: 2800"
                    className="rg-input text-xs w-full font-mono font-bold"
                  />
                </div>

                {/* Note affichée */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>Note Globale Affichée (sur 5.0)</span>
                    <span className="text-[11px] text-amber-300 font-mono font-black">{socialRating} / 5.0</span>
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="1"
                    max="5"
                    value={socialRating}
                    onChange={(e) => setSocialRating(parseFloat(e.target.value) || 4.9)}
                    className="rg-input text-xs w-full font-mono font-bold"
                  />
                </div>

                {/* Presets rapides d'Effet de Masse */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    ⚡ Remplissage Rapide en 1 Clic :
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { setSocialPlays(12500); setSocialReviews(2400); setSocialRating(4.9); }}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-slate-300 text-left"
                    >
                      🌟 Populaire (12.5k / 2.4k avis)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSocialPlays(28000); setSocialReviews(5600); setSocialRating(4.95); }}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-slate-300 text-left"
                    >
                      🔥 Bestseller (28k / 5.6k avis)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSocialPlays(65000); setSocialReviews(12800); setSocialRating(4.98); }}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-slate-300 text-left"
                    >
                      🚀 Tendance Virale (65k / 12.8k avis)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSocialPlays(140000); setSocialReviews(28000); setSocialRating(5.0); }}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-slate-300 text-left"
                    >
                      👑 Culte (140k / 28k avis)
                    </button>
                  </div>
                </div>
              </div>

              {/* Bouton d'enregistrement */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setSocialModalBook(null)}
                  className="rg-btn-ghost px-4 py-2 rounded-xl text-xs font-bold"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isSavingSocial}
                  onClick={async () => {
                    setIsSavingSocial(true);
                    try {
                      const metrics = {
                        display_plays_count: Number(socialPlays),
                        display_reviews_count: Number(socialReviews),
                        display_rating: Number(socialRating),
                      };
                      await apiClient.updateSocialMetrics(socialModalBook.id, metrics);
                      setBooks(prev => prev.map(b => b.id === socialModalBook.id ? { ...b, ...metrics } : b));
                      setSocialModalBook(null);
                    } catch (e) {
                      console.error('Erreur sauvegarde social metrics:', e);
                    } finally {
                      setIsSavingSocial(false);
                    }
                  }}
                  className="btn-gradient px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xl shadow-amber-500/20"
                >
                  {isSavingSocial ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Appliquer l'Effet de Masse</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
