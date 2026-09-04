import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  FolderPlus, UploadCloud, CheckCircle2, AlertCircle, Loader2, X,
  FileText, Calendar, Clock, Zap, Pause, Play, RefreshCw, ChevronDown,
  ChevronUp, Settings, BookOpen, Layers, Check, AlertTriangle, Eye,
  Trash2, Download
} from 'lucide-react';

// ─── Normalise un titre pour comparaison ──────────────────────────────────────
const normalizeTitle = (str) => (str || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

// ─── Hash SHA-256 d'un ArrayBuffer ───────────────────────────────────────────
async function sha256(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Extraction du titre depuis le nom de fichier ────────────────────────────
function titleFromFilename(filename) {
  return filename
    .replace(/\.(pdf|epub)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ─── Extraction de l'auteur depuis le nom de fichier ─────────────────────────
// Formats supportés : "Titre - Auteur.pdf", "Auteur_Titre.pdf", "Titre by Auteur.pdf"
function authorFromFilename(filename) {
  const base = filename.replace(/\.(pdf|epub)$/i, '');
  // Pattern « Titre - Auteur »
  const dashMatch = base.match(/^.+?\s*[-–—]\s*(.+)$/);
  if (dashMatch && dashMatch[1].trim().length > 2 && dashMatch[1].trim().split(' ').length <= 5) {
    return dashMatch[1].trim();
  }
  // Pattern « by Auteur » ou « par Auteur »
  const byMatch = base.match(/(?:\bby\b|\bpar\b)\s+(.+)$/i);
  if (byMatch && byMatch[1].trim().length > 2) {
    return byMatch[1].trim();
  }
  return '';
}

// ─── Extraction des métadonnées PDF (titre, auteur) via PDF.js ────────────────
async function extractPdfMetadata(file) {
  try {
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const meta = await pdf.getMetadata().catch(() => ({}));
    const info = meta?.info || {};
    return {
      title: (info.Title || '').trim(),
      author: (info.Author || info.Creator || info.Producer || '').trim(),
    };
  } catch (_) {
    return { title: '', author: '' };
  }
}

// ─── Chargement dynamique de PDF.js via CDN ──────────────────────────────────
let pdfjsLoadingPromise = null;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfjsLoadingPromise) return pdfjsLoadingPromise;

  pdfjsLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      } else {
        reject(new Error('PDF.js non initialisé'));
      }
    };
    script.onerror = () => reject(new Error('Échec chargement PDF.js CDN'));
    document.head.appendChild(script);
  });

  return pdfjsLoadingPromise;
}

// ─── Génération d'une couverture SVG stylisée par défaut ─────────────────────
function generateFallbackCover(title, author) {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 900;
  const ctx = canvas.getContext('2d');

  // Dégradé sombre luxueux
  const grad = ctx.createLinearGradient(0, 0, 600, 900);
  grad.addColorStop(0, '#1a0b2e');
  grad.addColorStop(0.5, '#2e1065');
  grad.addColorStop(1, '#0f051d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 600, 900);

  // Bordure dorée subtile
  ctx.strokeStyle = '#c084fc44';
  ctx.lineWidth = 8;
  ctx.strokeRect(30, 30, 540, 840);

  // Badge READ'S GREAT
  ctx.fillStyle = '#a855f7';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText("READ'S GREAT — E-BOOK", 300, 100);

  // Titre centré
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px sans-serif';
  const words = (title || 'Livre Numérique').split(' ');
  let line = '';
  let y = 380;
  for (const w of words) {
    const testLine = line + w + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > 480 && line !== '') {
      ctx.fillText(line.trim(), 300, y);
      line = w + ' ';
      y += 50;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), 300, y);

  // Auteur
  ctx.fillStyle = '#c4b5fd';
  ctx.font = 'italic 26px sans-serif';
  ctx.fillText(author || 'Édition Spéciale', 300, y + 80);

  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), 'image/webp', 0.85);
  });
}

// ─── Capture de la première page PDF via PDF.js (CDN) ou Fallback ────────────
async function capturePdfCover(file, title, author) {
  try {
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.85);
    });
  } catch (err) {
    console.warn('[PDF Cover] Fallback sur couverture générée pour:', title, err.message);
    return generateFallbackCover(title, author);
  }
}

// ─── Upload d'un fichier vers R2 via XHR avec progression & annulation instantanée ────
const uploadToR2WithProgress = (file, r2Key, type, onProgress, onRegisterXhr) =>
  new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('r2_key', r2Key);
    formData.append('type', type);

    const xhr = new XMLHttpRequest();
    if (onRegisterXhr) onRegisterXhr(xhr);
    xhr.open('POST', '/api/r2/upload');
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error('Réponse serveur invalide')); }
      } else {
        try { reject(new Error(JSON.parse(xhr.responseText).error || `HTTP ${xhr.status}`)); }
        catch { reject(new Error(`HTTP ${xhr.status}`)); }
      }
    });
    xhr.addEventListener('error', () => reject(new Error('Erreur réseau')));
    xhr.addEventListener('abort', () => reject(new Error('IMPORT_CANCELLED')));
    xhr.send(formData);
  });

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = {
    pending:     { color: 'bg-slate-600/30 text-slate-300 border-slate-500/30',   icon: '⏳', label: 'En attente' },
    analyzing:   { color: 'bg-blue-600/20 text-blue-300 border-blue-500/30',      icon: '🔍', label: 'Analyse...' },
    cover:       { color: 'bg-cyan-600/20 text-cyan-300 border-cyan-500/30',      icon: '🖼️', label: 'Couverture...' },
    uploading:   { color: 'bg-amber-600/20 text-amber-300 border-amber-500/30',   icon: '⬆️', label: 'Upload...' },
    publishing:  { color: 'bg-purple-600/20 text-purple-300 border-purple-500/30',icon: '📤', label: 'Publication...' },
    done:        { color: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30', icon: '✅', label: 'Publié' },
    scheduled:   { color: 'bg-teal-600/20 text-teal-300 border-teal-500/30',      icon: '📅', label: 'Planifié' },
    error:       { color: 'bg-rose-600/20 text-rose-300 border-rose-500/30',      icon: '❌', label: 'Erreur' },
    skipped:     { color: 'bg-slate-500/20 text-slate-400 border-slate-500/20',   icon: '⏭️', label: 'Ignoré' },
    duplicate:   { color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',   icon: '🟡', label: 'Doublon' },
  }[status] || { color: 'bg-slate-500/20 text-slate-300', icon: '?', label: status };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${cfg.color}`}>
      <span>{cfg.icon}</span>{cfg.label}
    </span>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  COMPOSANT PRINCIPAL : BULK EBOOK IMPORTER
// ══════════════════════════════════════════════════════════════════════════════
export const BulkEbookImporter = () => {
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  // ── Phase 1 : Fichiers sélectionnés ──
  const [files, setFiles] = useState([]);

  // ── Phase 2 : Configuration globale ──
  const [globalConfig, setGlobalConfig] = useState({
    categoryId: 'cat-1',
    price: '3500',
    discountPrice: '',
    unlockPoints: '100',
    language: 'fr',
    publishMode: 'immediate', // 'immediate' | 'progressive' | 'individual'
    progressiveBatchSize: '5',       // livres/jour
    progressiveStartDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    progressiveHour: '09',
  });

  // ── Phase 3 : Contrôle de la file ──
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const pauseRef = useRef(false);
  const abortRef = useRef(false);
  const activeXhrsRef = useRef(new Set());

  // ── Stats & Catégories ──
  const [phase, setPhase] = useState('idle');
  const [categories, setCategories] = useState([]);
  const [showConfig, setShowConfig] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setCategories(data);
      })
      .catch(() => {});
  }, []);

  // ── Calculs ──
  const totalFiles = files.length;
  const doneCount = files.filter(f => f.status === 'done' || f.status === 'scheduled').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const pendingCount = files.filter(f => f.status === 'pending' || f.status === 'duplicate').length;
  const progressPct = totalFiles > 0 ? Math.round((doneCount / totalFiles) * 100) : 0;

  const filteredFiles = files.filter(f => {
    if (filterStatus === 'all') return true;
    return f.status === filterStatus;
  });

  // ─── Mise à jour d'un fichier individuel ──────────────────────────────────
  const updateFile = useCallback((idx, updates) => {
    setFiles(prev => {
      const copy = [...prev];
      if (copy[idx]) {
        copy[idx] = { ...copy[idx], ...updates };
      }
      return copy;
    });
  }, []);

  // ─── Phase 1 : Ajout de fichiers ─────────────────────────────────────────
  const processSelectedFiles = useCallback(async (rawFiles) => {
    const valid = Array.from(rawFiles).filter(f =>
      f.name.toLowerCase().endsWith('.pdf') || f.name.toLowerCase().endsWith('.epub')
    );
    if (valid.length === 0) return;

    setPhase('analyzing');
    const newEntries = [];

    for (const file of valid) {
      const isAlreadyAdded = files.some(f => f.filename === file.name && f.sizeBytes === file.size);
      if (isAlreadyAdded) continue;

      let hash = '';
      try {
        const slice = await file.slice(0, 1024 * 1024).arrayBuffer(); // hash du premier Mo pour rapidité
        hash = await sha256(slice);
      } catch (_) {}

      // Extraction auteur depuis métadonnées PDF ou nom de fichier
      let detectedAuthor = '';
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const meta = await extractPdfMetadata(file).catch(() => ({ title: '', author: '' }));
        detectedAuthor = meta.author || '';
      }
      if (!detectedAuthor) {
        detectedAuthor = authorFromFilename(file.name);
      }

      const titleFromMeta = '';

      newEntries.push({
        file,
        filename: file.name,
        sha256: hash,
        title: titleFromFilename(file.name),
        author: detectedAuthor,
        sizeBytes: file.size,
        sizeMb: (file.size / 1024 / 1024).toFixed(2),
        format: file.name.toLowerCase().endsWith('.epub') ? 'epub' : 'pdf',
        status: 'pending',
        duplicateInfo: null,
        progress: 0,
        errorMsg: '',
        coverR2Key: null,
        pdfR2Key: null,
        scheduledAt: null,
        excluded: false,
      });
    }

    setFiles(prev => [...prev, ...newEntries]);
    setPhase('checking');

    // Vérification doublons côté serveur
    const toCheck = newEntries.map(e => ({ filename: e.filename, sha256: e.sha256, title: e.title }));
    try {
      const res = await fetch('/api/admin/bulk-check-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: toCheck }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        setFiles(prev => {
          const updated = [...prev];
          data.results.forEach(result => {
            const globalIdx = updated.findIndex(f => f.filename === result.filename && f.status === 'pending');
            if (globalIdx !== -1 && result.isDuplicate) {
              updated[globalIdx] = { ...updated[globalIdx], status: 'duplicate', duplicateInfo: result };
            }
          });
          return updated;
        });
      }
    } catch (err) {
      console.warn('[bulk-check] Vérification doublons impossible:', err.message);
    }

    setPhase('idle');
  }, [files]);

  // ─── Calcul de la date planifiée pour chaque fichier (mode progressif) ───
  const computeScheduledAt = useCallback((fileIndex) => {
    if (globalConfig.publishMode === 'immediate') return null;
    if (globalConfig.publishMode === 'individual') return null;

    const batchSize = parseInt(globalConfig.progressiveBatchSize, 10) || 5;
    const dayOffset = Math.floor(fileIndex / batchSize);
    const start = new Date(`${globalConfig.progressiveStartDate}T${globalConfig.progressiveHour}:00:00`);
    start.setDate(start.getDate() + dayOffset);
    return start.toISOString();
  }, [globalConfig]);

  // ─── Annulation complète & immédiate de la file ──────────────────────────
  const cancelProcessing = useCallback(() => {
    abortRef.current = true;
    pauseRef.current = false;
    // Interrompre immédiatement les transferts HTTP en cours
    activeXhrsRef.current.forEach(xhr => {
      try { xhr.abort(); } catch (_) {}
    });
    activeXhrsRef.current.clear();

    setIsRunning(false);
    setIsPaused(false);
    setFiles(prev => prev.map(f => {
      if (f.status === 'cover' || f.status === 'uploading' || f.status === 'publishing') {
        return { ...f, status: 'pending', progress: 0 };
      }
      return f;
    }));
  }, []);

  // ─── Lance la file de traitement ─────────────────────────────────────────
  const startProcessing = useCallback(async () => {
    if (isRunning) return;
    pauseRef.current = false;
    abortRef.current = false;
    setIsRunning(true);
    setIsPaused(false);

    const toProcess = files
      .map((f, idx) => ({ ...f, _idx: idx }))
      .filter(f => !f.excluded && (f.status === 'pending' || f.status === 'duplicate'));

    let schedulableIndex = 0;
    const CONCURRENCY = 2; // Concurrence modérée pour éviter surcharge mémoire sur 50+ PDF

    // Helper pour attendre pendant la pause ou sortir sur annulation
    const checkPauseOrAbort = async () => {
      if (abortRef.current) throw new Error('IMPORT_CANCELLED');
      while (pauseRef.current) {
        if (abortRef.current) throw new Error('IMPORT_CANCELLED');
        await new Promise(r => setTimeout(r, 200));
      }
      if (abortRef.current) throw new Error('IMPORT_CANCELLED');
    };

    for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
      if (abortRef.current) break;
      await checkPauseOrAbort();

      const batch = toProcess.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async (entry) => {
        const idx = entry._idx;

        try {
          await checkPauseOrAbort();

          // ── Étape 1 : Capture et compression couverture (WebP HD) ─────────
          let coverR2Key = null;
          let coverUrl = '/icons/icon-192.png';

          updateFile(idx, { status: 'cover', progress: 0 });
          try {
            const coverBlob = entry.format === 'pdf'
              ? await capturePdfCover(entry.file, entry.title, entry.author)
              : await generateFallbackCover(entry.title, entry.author);

            await checkPauseOrAbort();

            if (coverBlob) {
              const coverFile = new File([coverBlob], `cover_${entry.sha256 || Date.now()}.webp`, { type: 'image/webp' });
              const covR2Key = `covers/ebook-${entry.sha256 || Date.now()}.webp`;
              const covResult = await uploadToR2WithProgress(
                coverFile,
                covR2Key,
                'cover',
                () => {},
                (xhr) => {
                  activeXhrsRef.current.add(xhr);
                  xhr.onloadend = () => activeXhrsRef.current.delete(xhr);
                }
              );
              if (covResult.success) {
                coverR2Key = covResult.r2_key;
                coverUrl = covResult.public_url;
              }
            }
          } catch (covErr) {
            if (covErr.message === 'IMPORT_CANCELLED') throw covErr;
            console.warn('[Cover] Échec couverture:', covErr.message);
          }

          await checkPauseOrAbort();

          // ── Étape 2 : Upload du fichier PDF/EPUB ─────────────────────────
          updateFile(idx, { status: 'uploading', progress: 0 });
          const safeName = entry.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
          const pdfR2Key = `ebooks/${Date.now()}_${safeName}`;
          const pdfResult = await uploadToR2WithProgress(
            entry.file,
            pdfR2Key,
            'ebook',
            (pct) => {
              if (!abortRef.current) updateFile(idx, { progress: pct });
            },
            (xhr) => {
              activeXhrsRef.current.add(xhr);
              xhr.onloadend = () => activeXhrsRef.current.delete(xhr);
            }
          );

          if (abortRef.current) throw new Error('IMPORT_CANCELLED');
          if (!pdfResult.success) throw new Error(pdfResult.error || 'Upload échoué');

          await checkPauseOrAbort();

          // ── Étape 3 : Publication dans D1 ──────────────────────────────────
          updateFile(idx, { status: 'publishing', progress: 100 });
          const scheduledAt = globalConfig.publishMode === 'progressive'
            ? computeScheduledAt(schedulableIndex)
            : entry.scheduledAt || null;
          schedulableIndex++;

          const bookId = `ebook-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const publishRes = await fetch('/api/admin/bulk-publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              books: [{
                id: bookId,
                title: entry.title,
                author: entry.author || 'N/D',
                pdf_url: pdfResult.public_url,
                pdf_r2_key: pdfR2Key,
                cover_url: coverUrl,
                cover_r2_key: coverR2Key,
                category_id: globalConfig.categoryId,
                price: Number(globalConfig.price || 3500),
                discount_price: Number(globalConfig.discountPrice || 0),
                unlock_points: Number(globalConfig.unlockPoints || 100),
                language: globalConfig.language,
                format: entry.format,
                scheduled_at: scheduledAt,
              }]
            }),
          });

          if (abortRef.current) throw new Error('IMPORT_CANCELLED');

          const publishData = await publishRes.json();
          if (!publishData.success || publishData.published === 0) {
            throw new Error(publishData.errors?.[0]?.error || 'Publication échouée');
          }

          updateFile(idx, {
            status: scheduledAt ? 'scheduled' : 'done',
            pdfR2Key,
            coverR2Key,
            scheduledAt,
            progress: 100,
          });

        } catch (err) {
          if (err.message === 'IMPORT_CANCELLED') {
            updateFile(idx, { status: 'pending', progress: 0, errorMsg: '' });
          } else {
            updateFile(idx, { status: 'error', errorMsg: err.message, progress: 0 });
          }
        }
      }));
    }

    setIsRunning(false);
    setIsPaused(false);
    setPhase('done');
  }, [files, isRunning, globalConfig, computeScheduledAt, updateFile]);

  // ─── Actions de gestion ───────────────────────────────────────────────────
  const retryErrors = useCallback(() => {
    setFiles(prev => prev.map(f => f.status === 'error' ? { ...f, status: 'pending', errorMsg: '', progress: 0 } : f));
  }, []);

  const clearAll = useCallback(() => {
    if (isRunning) return;
    setFiles([]);
    setPhase('idle');
  }, [isRunning]);

  // ─── Drag & Drop ──────────────────────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const items = e.dataTransfer.items;
    const rawFiles = [];

    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) rawFiles.push(file);
        }
      }
    } else {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        rawFiles.push(e.dataTransfer.files[i]);
      }
    }
    processSelectedFiles(rawFiles);
  }, [processSelectedFiles]);

  return (
    <div className="space-y-6 animate-fadeIn">

      {/* ── En-tête ── */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit'] flex items-center gap-2.5">
          <FolderPlus className="w-7 h-7 text-sky-400" />
          <span>Import en Masse — Read's Great</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5 font-medium">
          Importez des centaines de livres PDF & EPUB en une seule opération. Détection automatique des doublons, capture de couverture, publication progressive et planifiée.
        </p>
      </div>

      {/* ── Zone de Drop Dossier ── */}
      <div
        className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer
          ${isDragging
            ? 'border-sky-400 bg-sky-500/10 scale-[1.01]'
            : 'border-white/15 bg-white/3 hover:border-sky-500/50 hover:bg-sky-500/5'
          }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => folderInputRef.current?.click()}
      >
        <input
          ref={folderInputRef}
          type="file"
          accept=".pdf,.epub"
          multiple
          webkitdirectory=""
          directory=""
          className="hidden"
          onChange={(e) => processSelectedFiles(e.target.files)}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.epub"
          multiple
          className="hidden"
          onChange={(e) => processSelectedFiles(e.target.files)}
        />

        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
            <FolderPlus className="w-8 h-8 text-sky-400" />
          </div>
          <div>
            <p className="text-lg font-black text-white font-['Outfit']">
              {isDragging ? '📂 Relâchez pour importer' : 'Glissez votre dossier entier de livres ici'}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              PDF & EPUB • 500+ fichiers supportés • Détection automatique des doublons
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-sky-900/40 cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" /> Sélectionner un Dossier
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              className="px-5 py-2.5 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-white font-bold text-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <FileText className="w-4 h-4" /> Sélectionner des Fichiers
            </button>
          </div>
        </div>
      </div>

      {/* ── Configuration Globale de Publication ── */}
      {totalFiles > 0 && (
        <div className="card-lg space-y-4">
          <button
            type="button"
            onClick={() => setShowConfig(c => !c)}
            className="w-full flex items-center justify-between text-sm font-bold text-white cursor-pointer"
          >
            <span className="flex items-center gap-2"><Settings className="w-4 h-4 text-purple-400" /> Configuration de Publication par Lot</span>
            {showConfig ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {showConfig && (
            <div className="space-y-5 pt-2 border-t border-white/8 animate-fadeIn">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Catégorie par Défaut</label>
                  <select
                    value={globalConfig.categoryId}
                    onChange={e => setGlobalConfig(c => ({ ...c, categoryId: e.target.value }))}
                    className="rg-input text-xs w-full cursor-pointer"
                    style={{ background: '#16112e' }}
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Prix (FCFA)</label>
                  <input type="number" value={globalConfig.price} onChange={e => setGlobalConfig(c => ({ ...c, price: e.target.value }))} className="rg-input text-xs w-full" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Prix Réduit</label>
                  <input type="number" value={globalConfig.discountPrice} placeholder="Optionnel" onChange={e => setGlobalConfig(c => ({ ...c, discountPrice: e.target.value }))} className="rg-input text-xs w-full" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Points de Déblocage</label>
                  <input type="number" value={globalConfig.unlockPoints} onChange={e => setGlobalConfig(c => ({ ...c, unlockPoints: e.target.value }))} className="rg-input text-xs w-full" />
                </div>
              </div>

              {/* Modes de Publication */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-200">Stratégie de Publication</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'immediate', icon: '⚡', label: 'Immédiate', desc: 'Tous les livres disponibles dès l\'upload' },
                    { id: 'progressive', icon: '📅', label: 'Planifiée Progressive', desc: 'X livres par jour pour alimenter le flux' },
                    { id: 'individual', icon: '🗓️', label: 'Dates Individuelles', desc: 'Régler la date pour chaque ouvrage' },
                  ].map(mode => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setGlobalConfig(c => ({ ...c, publishMode: mode.id }))}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        globalConfig.publishMode === mode.id
                          ? 'border-purple-500 bg-purple-600/20 text-white'
                          : 'border-white/10 bg-white/4 text-slate-400 hover:bg-white/8'
                      }`}
                    >
                      <p className="text-sm font-bold">{mode.icon} {mode.label}</p>
                      <p className="text-[11px] mt-0.5 opacity-80">{mode.desc}</p>
                    </button>
                  ))}
                </div>

                {globalConfig.publishMode === 'progressive' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 animate-fadeIn">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-purple-300">Livres / Jour</label>
                      <input type="number" min="1" max="100" value={globalConfig.progressiveBatchSize} onChange={e => setGlobalConfig(c => ({ ...c, progressiveBatchSize: e.target.value }))} className="rg-input text-xs w-full" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-purple-300">Date de Première Parution</label>
                      <input type="date" value={globalConfig.progressiveStartDate} onChange={e => setGlobalConfig(c => ({ ...c, progressiveStartDate: e.target.value }))} className="rg-input text-xs w-full" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-purple-300">Heure Quotidienne</label>
                      <select value={globalConfig.progressiveHour} onChange={e => setGlobalConfig(c => ({ ...c, progressiveHour: e.target.value }))} className="rg-input text-xs w-full cursor-pointer" style={{ background: '#16112e' }}>
                        {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                          <option key={h} value={h}>{h}:00</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-full text-[11px] text-purple-300">
                      💡 Avec {totalFiles} livres et {globalConfig.progressiveBatchSize}/jour : parution étalée sur{' '}
                      <strong>{Math.ceil(totalFiles / (parseInt(globalConfig.progressiveBatchSize, 10) || 1))} jours</strong> à partir du {globalConfig.progressiveStartDate}.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── File d'Attente & Tableau de Bord ── */}
      {totalFiles > 0 && (
        <div className="space-y-4">
          <div className="card-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-white">
                  {doneCount}/{totalFiles} livres traités
                  {errorCount > 0 && <span className="ml-2 text-rose-400">• {errorCount} erreurs</span>}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {pendingCount} en attente • {files.filter(f => f.status === 'duplicate').length} doublons détectés
                </p>
              </div>
              <div className="flex items-center gap-2">
                {errorCount > 0 && !isRunning && (
                  <button
                    type="button"
                    onClick={retryErrors}
                    className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Réessayer les erreurs
                  </button>
                )}
                {!isRunning && totalFiles > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Vider
                  </button>
                )}
              </div>
            </div>

            {/* Barre de progression globale */}
            <div className="relative h-2.5 bg-white/8 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPct}%`,
                  background: 'linear-gradient(90deg, #7c3aed, #06b6d4)',
                }}
              />
            </div>
            <p className="text-xs text-slate-400 text-right -mt-2">{progressPct}%</p>

            {/* Boutons de Contrôle Principal */}
            <div className="flex flex-col sm:flex-row gap-3">
              {!isRunning ? (
                <>
                  <button
                    type="button"
                    onClick={startProcessing}
                    disabled={pendingCount === 0}
                    className="flex-1 py-3.5 rounded-2xl btn-gradient font-black text-sm flex items-center justify-center gap-2 shadow-xl cursor-pointer disabled:opacity-40"
                  >
                    <UploadCloud className="w-5 h-5" />
                    {pendingCount > 0
                      ? `🚀 Lancer l'Import — ${pendingCount} fichiers`
                      : phase === 'done' ? '✅ Import Terminé !' : 'Aucun fichier en attente'
                    }
                  </button>

                  {totalFiles > 0 && (
                    <button
                      type="button"
                      onClick={clearAll}
                      className="py-3.5 px-6 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 bg-white/5 hover:bg-rose-600/20 border border-white/10 hover:border-rose-500/40 text-slate-300 hover:text-rose-200 transition-all cursor-pointer"
                      title="Vider et annuler la sélection de fichiers"
                    >
                      <Trash2 className="w-4 h-4 text-rose-400" />
                      <span>Annuler / Vider ({totalFiles})</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      pauseRef.current = !pauseRef.current;
                      setIsPaused(p => !p);
                    }}
                    className={`flex-1 py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all ${
                      isPaused
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse'
                        : 'bg-amber-600 hover:bg-amber-500 text-white'
                    }`}
                  >
                    {isPaused ? <><Play className="w-5 h-5" /> Reprendre l'Import</> : <><Pause className="w-5 h-5" /> Mettre en Pause</>}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Êtes-vous sûr de vouloir annuler l'import massif ? Les transferts en cours seront immédiatement interrompus.")) {
                        cancelProcessing();
                      }
                    }}
                    className="py-3.5 px-6 rounded-2xl font-black text-sm flex items-center justify-center gap-2 bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/40 text-rose-300 hover:text-white transition-all cursor-pointer shadow-lg"
                  >
                    <X className="w-5 h-5" />
                    <span>Annuler Immédiatement</span>
                  </button>
                </>
              )}
            </div>

            {/* Information Compression & Qualité PDF */}
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-200">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Compression & Qualité :</strong> Les couvertures sont automatiquement compressées en <strong>WebP HD (~50 Ko)</strong> pour un affichage instantané. Les fichiers <strong>PDF & EPUB</strong> sont préservés à 100% de leur qualité originale et distribués en streaming ultra-rapide via Cloudflare R2 CDN.
              </span>
            </div>
          </div>

          {/* ── Filtres de Statut ── */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: 'all', label: `Tous (${totalFiles})` },
              { id: 'pending', label: `En attente (${pendingCount})` },
              { id: 'duplicate', label: `Doublons (${files.filter(f => f.status === 'duplicate').length})` },
              { id: 'done', label: `Publiés (${doneCount})` },
              { id: 'scheduled', label: `Planifiés (${files.filter(f => f.status === 'scheduled').length})` },
              { id: 'error', label: `Erreurs (${errorCount})` },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStatus(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  filterStatus === tab.id
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-white/6 text-slate-400 hover:text-white border border-white/8'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Liste Défilante des Fichiers ── */}
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {filteredFiles.map((entry) => {
              const realIdx = files.indexOf(entry);
              return (
                <div
                  key={`${entry.filename}-${realIdx}`}
                  className={`p-3 rounded-2xl border transition-all ${
                    entry.excluded
                      ? 'bg-white/2 border-white/5 opacity-40'
                      : entry.status === 'error'
                      ? 'bg-rose-500/5 border-rose-500/20'
                      : entry.status === 'duplicate'
                      ? 'bg-amber-500/5 border-amber-500/20'
                      : entry.status === 'done' || entry.status === 'scheduled'
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : 'bg-white/3 border-white/8'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 w-full">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => updateFile(realIdx, { excluded: !entry.excluded })}
                        disabled={entry.status === 'done' || entry.status === 'scheduled' || isRunning}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                          entry.excluded
                            ? 'bg-slate-600 border-slate-500'
                            : 'bg-white/5 border-white/20 hover:bg-white/10'
                        }`}
                        title={entry.excluded ? 'Réinclure cet e-book' : 'Exclure cet e-book'}
                      >
                        {entry.excluded && <Check className="w-3 h-3 text-slate-300" />}
                      </button>

                      {/* Icône Livre Moderne (au lieu de l'emoji) */}
                      <div className="flex-shrink-0 w-9 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shadow-inner">
                        {entry.format === 'epub' ? (
                          <BookOpen className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <FileText className="w-4 h-4 text-purple-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <input
                          type="text"
                          value={entry.title}
                          onChange={e => updateFile(realIdx, { title: e.target.value })}
                          disabled={entry.status === 'done' || entry.status === 'scheduled' || isRunning}
                          className="bg-transparent text-xs font-bold text-white w-full focus:outline-none focus:underline truncate block"
                          title={entry.filename}
                        />
                        <input
                          type="text"
                          value={entry.author}
                          onChange={e => updateFile(realIdx, { author: e.target.value })}
                          disabled={entry.status === 'done' || entry.status === 'scheduled' || isRunning}
                          placeholder="Auteur (optionnel)"
                          className="bg-transparent text-[11px] text-slate-400 focus:outline-none focus:text-slate-200 w-full truncate block"
                        />

                        {entry.duplicateInfo && entry.status === 'duplicate' && (
                          <p className="text-[10px] text-amber-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Doublon détecté avec : « {entry.duplicateInfo.existingTitle} » ({entry.duplicateInfo.confidence}% certitude) —
                            <button
                              type="button"
                              onClick={() => updateFile(realIdx, { status: 'pending', duplicateInfo: null })}
                              className="underline hover:text-amber-300 cursor-pointer ml-0.5"
                            >Importer quand même</button>
                          </p>
                        )}

                        {(entry.status === 'uploading' || entry.status === 'cover') && (
                          <div className="h-1.5 bg-white/8 rounded-full overflow-hidden w-full max-w-xs mt-1">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-purple-500 transition-all duration-300"
                              style={{ width: `${entry.progress}%` }}
                            />
                          </div>
                        )}

                        {entry.status === 'error' && entry.errorMsg && (
                          <p className="text-[10px] text-rose-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {entry.errorMsg}
                          </p>
                        )}

                        {(entry.status === 'scheduled' || globalConfig.publishMode === 'individual') && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-teal-400" />
                            <input
                              type="datetime-local"
                              value={(entry.scheduledAt || computeScheduledAt(realIdx) || '').slice(0, 16)}
                              onChange={e => updateFile(realIdx, { scheduledAt: e.target.value })}
                              disabled={isRunning}
                              className="text-[11px] text-teal-300 bg-transparent focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bloc droit aligné sans débordement */}
                    <div className="flex items-center gap-2.5 shrink-0 pl-2">
                      <StatusBadge status={entry.status} />
                      <div className="text-right text-[10px] text-slate-400 font-mono w-16 shrink-0 leading-tight">
                        <div className="text-slate-200 font-semibold">{entry.sizeMb} Mo</div>
                        <div className="uppercase font-bold text-purple-400 text-[9px]">{entry.format}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── État vide ── */}
      {totalFiles === 0 && phase === 'idle' && (
        <div className="text-center py-12 text-slate-500">
          <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-bold">Aucun fichier dans la file d'attente</p>
          <p className="text-xs mt-1">Sélectionnez un dossier de PDF/EPUB pour lancer la préparation</p>
        </div>
      )}

      {/* ── Analyse en cours ── */}
      {(phase === 'analyzing' || phase === 'checking') && (
        <div className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-300">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm font-bold">
            {phase === 'analyzing' ? 'Analyse des fichiers en cours...' : 'Vérification des doublons en base...'}
          </span>
        </div>
      )}

    </div>
  );
};
