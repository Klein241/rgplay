import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, Maximize2, Minimize2, ChevronLeft, ChevronRight, Bookmark,
  BookOpen, Sparkles, Moon, Sun, Coffee, Eye, Headphones,
  ZoomIn, ZoomOut, RotateCcw, FileText, ExternalLink, Download,
  Loader2, AlertCircle, RefreshCw, Layers
} from 'lucide-react';
import { useXp } from '../context/XpContext';
import { useAudio } from '../context/AudioContext';
import { apiClient } from '../services/api';
import { getOfflineAudioUrl } from '../utils/offlineAudioCache';
import { loadPdfJs } from '../utils/pdfLoader';

const READING_THEMES = {
  abyss: {
    id: 'abyss',
    name: 'Nuit Abyssale',
    bg: '#0c0617',
    text: '#e2d9f3',
    cardBg: '#170b2c',
    border: 'rgba(168, 85, 247, 0.25)',
    accent: '#a855f7',
    canvasFilter: 'invert(0.92) hue-rotate(180deg) contrast(1.06)',
    canvasBg: '#1b0d33',
    icon: Moon,
  },
  sepia: {
    id: 'sepia',
    name: 'Sépia Doux',
    bg: '#f8f1e5',
    text: '#3c2a1a',
    cardBg: '#efe4d2',
    border: 'rgba(180, 130, 80, 0.3)',
    accent: '#d97706',
    canvasFilter: 'sepia(0.38) contrast(0.96) brightness(0.98)',
    canvasBg: '#f5ecdc',
    icon: Coffee,
  },
  emerald: {
    id: 'emerald',
    name: 'Émeraude Zen',
    bg: '#061a14',
    text: '#d1fae5',
    cardBg: '#0b2e24',
    border: 'rgba(16, 185, 129, 0.25)',
    accent: '#10b981',
    canvasFilter: 'invert(0.90) hue-rotate(90deg) contrast(1.08)',
    canvasBg: '#0a3026',
    icon: Eye,
  },
  light: {
    id: 'light',
    name: 'Clair Moderne',
    bg: '#f8fafc',
    text: '#1e293b',
    cardBg: '#ffffff',
    border: 'rgba(0, 0, 0, 0.12)',
    accent: '#6366f1',
    canvasFilter: 'none',
    canvasBg: '#ffffff',
    icon: Sun,
  },
};

export function PdfReaderModal({ book, isOpen, onClose }) {
  const { recordReadingTime, awardPointsAndXp } = useXp();
  const { playBook } = useAudio();

  const isMobile = typeof window !== 'undefined' &&
    (window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

  const hasPdf = Boolean(book?.pdf_url || book?.pdfUrl);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [themeKey, setThemeKey] = useState('abyss');
  const [fontSize, setFontSize] = useState(18);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [readingSeconds, setReadingSeconds] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [viewMode, setViewMode] = useState(() => (hasPdf ? 'pdf' : 'text'));
  const [useNativeViewer, setUseNativeViewer] = useState(false); // Mode iframe bureau
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);

  // PDF.js State
  const [pdfDoc, setPdfDoc] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const [pageRendering, setPageRendering] = useState(false);
  const [zoomScale, setZoomScale] = useState(1.0); // Échelle utilisateur : 0.85, 1.0, 1.25, 1.5, 2.0

  const containerRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const readingTimerRef = useRef(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const theme = READING_THEMES[themeKey] || READING_THEMES.abyss;

  // Résolution de l'URL du PDF (en ligne ou hors-ligne dans IndexedDB)
  const [effectivePdfUrl, setEffectivePdfUrl] = useState(() => book?.pdf_url || book?.pdfUrl || '');

  useEffect(() => {
    if (!book) return;
    const rawPdf = book.pdf_url || book.pdfUrl;
    if (rawPdf) {
      getOfflineAudioUrl(rawPdf, book.id, 'pdf')
        .then((resolved) => {
          setEffectivePdfUrl(resolved || rawPdf);
        })
        .catch(() => {
          setEffectivePdfUrl(rawPdf);
        });
    } else {
      setEffectivePdfUrl('');
    }
  }, [book?.id, book?.pdf_url, book?.pdfUrl]);

  const pdfSourceUrl = effectivePdfUrl || book?.pdf_url || book?.pdfUrl;

  // Initialisation et reprise de la dernière position
  useEffect(() => {
    if (!isOpen || !book) return;

    // Mode par défaut : TOUJOURS 'pdf' si un PDF existe, 'text' sinon
    const bookHasPdf = Boolean(book.pdf_url || book.pdfUrl);
    setViewMode(bookHasPdf ? 'pdf' : 'text');

    const saved = localStorage.getItem(`rg_ebook_progress_${book.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.currentPage) setCurrentPage(parsed.currentPage);
        if (parsed.totalPages) setTotalPages(parsed.totalPages);
        if (parsed.activeChapterIndex !== undefined) setActiveChapterIndex(parsed.activeChapterIndex);
        if (parsed.themeKey && READING_THEMES[parsed.themeKey]) setThemeKey(parsed.themeKey);
      } catch {}
    }

    // Compteur de temps de lecture pour l'XP
    readingTimerRef.current = setInterval(() => {
      setReadingSeconds(prev => {
        const next = prev + 1;
        if (next > 0 && next % 180 === 0) {
          recordReadingTime(3);
        }
        return next;
      });
    }, 1000);

    return () => {
      if (readingTimerRef.current) clearInterval(readingTimerRef.current);
    };
  }, [isOpen, book?.id, recordReadingTime]);

  // Sauvegarde de la progression
  useEffect(() => {
    if (!book || !isOpen) return;
    const progressData = {
      currentPage,
      totalPages,
      activeChapterIndex,
      themeKey,
      lastReadAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(`rg_ebook_progress_${book.id}`, JSON.stringify(progressData));
    } catch {}

    apiClient.syncEbookProgress?.(book.id, progressData).catch(() => {});
  }, [book?.id, isOpen, currentPage, totalPages, activeChapterIndex, themeKey]);

  // Chargement du document PDF via PDF.js
  const loadPdfDocument = useCallback(async () => {
    if (!pdfSourceUrl || viewMode !== 'pdf') return;

    setLoadingPdf(true);
    setPdfError(null);

    try {
      const pdfjsLib = await loadPdfJs();
      const loadingTask = pdfjsLib.getDocument({
        url: pdfSourceUrl,
        withCredentials: false,
      });

      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setTotalPages(doc.numPages);
      setLoadingPdf(false);
    } catch (err) {
      console.error('[PdfReaderModal] Erreur chargement document PDF:', err);
      setPdfError(err?.message || 'Échec du chargement du fichier PDF.');
      setLoadingPdf(false);
    }
  }, [pdfSourceUrl, viewMode]);

  useEffect(() => {
    if (isOpen && viewMode === 'pdf' && pdfSourceUrl) {
      loadPdfDocument();
    }
  }, [isOpen, viewMode, pdfSourceUrl, loadPdfDocument]);

  // Rendu de la page courante sur le Canvas HTML5
  const renderCurrentPage = useCallback(async () => {
    if (!pdfDoc || viewMode !== 'pdf' || useNativeViewer) return;

    const pageNum = Math.min(Math.max(1, currentPage), pdfDoc.numPages);
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      setPageRendering(true);

      // Annuler le rendu précédent si toujours en cours
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
      }

      const page = await pdfDoc.getPage(pageNum);

      // Calcul de la largeur optimale d'affichage
      const containerWidth = canvasContainerRef.current?.clientWidth || window.innerWidth;
      // Marge de sécurité responsive
      const availableWidth = Math.max(280, containerWidth - (isMobile ? 16 : 48));
      const unscaledViewport = page.getViewport({ scale: 1 });

      // Échelle de base pour remplir la largeur disponible
      const baseScale = availableWidth / unscaledViewport.width;
      const finalScale = Math.max(0.4, baseScale * zoomScale);
      const viewport = page.getViewport({ scale: finalScale });

      // Support haute résolution Retina / Écrans OLED
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.5);
      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      await renderTask.promise;

      setPageRendering(false);
    } catch (err) {
      if (err?.name !== 'RenderingCancelledException') {
        console.warn('[PdfReaderModal] Erreur de rendu de page:', err);
        setPageRendering(false);
      }
    }
  }, [pdfDoc, currentPage, zoomScale, viewMode, useNativeViewer, isMobile]);

  useEffect(() => {
    renderCurrentPage();
  }, [renderCurrentPage]);

  // Recalcul lors du redimensionnement de la fenêtre
  useEffect(() => {
    const handleResize = () => {
      renderCurrentPage();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderCurrentPage]);

  // Navigation pages
  const goToPrevPage = useCallback(() => {
    setCurrentPage(p => Math.max(1, p - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setCurrentPage(p => {
      if (p < totalPages) return p + 1;
      // Fin du livre atteinte
      awardPointsAndXp({
        xp: 120,
        points: 50,
        type: 'reading_reward',
        description: `Lecture terminée : ${book?.title || 'E-Book'} 🏆`,
        badgeId: 'badge-first-read',
      });
      return p;
    });
  }, [totalPages, awardPointsAndXp, book?.title]);

  // Navigation clavier
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') goToPrevPage();
      if (e.key === 'ArrowRight') goToNextPage();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, goToPrevPage, goToNextPage, onClose]);

  // Gestuelle tactile (Swipe horizontal pour tourner les pages)
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    if (!touchStartX.current) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Détection d'un swipe horizontal franc (> 45px et plus horizontal que vertical)
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
      if (deltaX < 0) {
        goToNextPage();
      } else {
        goToPrevPage();
      }
    }
    touchStartX.current = 0;
    touchStartY.current = 0;
  };

  // Plein écran
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  if (!isOpen || !book) return null;

  const chapters = book.chapters || [
    { title: 'Introduction & Sommaire', text: book.description || 'Bienvenue dans la lecture numérique de cet ouvrage...' },
    { title: 'Partie 1 — Fondations', text: 'Ce livre est au format PDF original Read’s Great. Utilisez la bascule en haut pour basculer sur le document PDF en pleine résolution.' },
  ];

  const currentChapter = chapters[activeChapterIndex] || chapters[0];

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] h-[100dvh] w-full flex flex-col transition-colors duration-300 select-text overflow-hidden"
      style={{
        backgroundColor: theme.bg,
        color: theme.text,
      }}
    >
      {/* ── BARRE SUPÉRIEURE DU LECTEUR ───────────────────────────────────────── */}
      <header
        className="px-2.5 sm:px-4 py-2 sm:py-2.5 border-b flex items-center justify-between gap-2 flex-shrink-0 z-10 shadow-sm"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.border,
        }}
      >
        {/* Titre et Bouton Retour */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600 text-white font-bold text-xs sm:text-sm border border-purple-400/40 transition-all cursor-pointer shadow-sm active:scale-95 flex-shrink-0"
            title="Quitter la liseuse"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
            <span className="hidden xs:inline font-semibold">Fermer</span>
          </button>
          <div className="min-w-0">
            <h2 className="font-bold text-xs sm:text-sm md:text-base truncate leading-tight flex items-center gap-1.5">
              <span className="truncate">{book.title}</span>
              <span className="hidden md:inline text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border border-purple-500/30 text-purple-300 bg-purple-500/10 flex-shrink-0">
                E-Book PDF
              </span>
            </h2>
            <p className="text-[10px] sm:text-xs opacity-75 truncate">{book.author || 'Éditions Read’s Great'}</p>
          </div>
        </div>

        {/* Contrôles & Modes */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {/* Bascule PDF / Texte si applicable */}
          {Boolean(pdfSourceUrl) && (
            <div className="flex items-center p-0.5 rounded-xl bg-black/30 border border-white/10">
              <button
                type="button"
                onClick={() => setViewMode('pdf')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'pdf'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm'
                    : 'text-purple-300 opacity-70 hover:opacity-100'
                }`}
                title="Afficher les pages du document PDF"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('text')}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'text'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm'
                    : 'text-purple-300 opacity-70 hover:opacity-100'
                }`}
                title="Afficher le texte reformaté"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Texte</span>
              </button>
            </div>
          )}

          {/* Version Audio Compagnon */}
          {(book.companion_audio || book.companion_audio_id || book.audio_url) && (
            <button
              onClick={() => {
                if (book.companion_audio) {
                  playBook(book.companion_audio);
                } else {
                  playBook(book);
                }
              }}
              className="px-2.5 py-1 sm:py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title="Écouter le livre audio lié"
            >
              <Headphones className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Audio</span>
            </button>
          )}

          {/* Zoom (PDF Canvas) */}
          {viewMode === 'pdf' && !useNativeViewer && (
            <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-black/20 border border-white/5">
              <button
                onClick={() => setZoomScale(s => Math.max(0.7, Number((s - 0.2).toFixed(2))))}
                className="p-1 sm:p-1.5 rounded-lg opacity-70 hover:opacity-100 cursor-pointer"
                title="Dézoomer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoomScale(1.0)}
                className="text-[10px] font-mono px-1 opacity-80 hover:opacity-100 cursor-pointer"
                title="Réinitialiser zoom"
              >
                {Math.round(zoomScale * 100)}%
              </button>
              <button
                onClick={() => setZoomScale(s => Math.min(2.4, Number((s + 0.2).toFixed(2))))}
                className="p-1 sm:p-1.5 rounded-lg opacity-70 hover:opacity-100 cursor-pointer"
                title="Zoomer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Sélecteur de Thème (Thèmes adaptés à la lecture de nuit et repos des yeux) */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-black/20 border border-white/5">
            {Object.values(READING_THEMES).map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setThemeKey(t.id)}
                  className={`p-1 sm:p-1.5 rounded-lg transition-all cursor-pointer ${
                    themeKey === t.id ? 'bg-white/20 scale-110 shadow-sm' : 'opacity-50 hover:opacity-100'
                  }`}
                  title={t.name}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: t.accent }} />
                </button>
              );
            })}
          </div>

          {/* Menu Secours : Ouvrir dans lecteur externe / Télécharger */}
          {Boolean(pdfSourceUrl) && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => window.open(pdfSourceUrl, '_blank')}
                className="p-1.5 rounded-xl opacity-75 hover:opacity-100 hover:bg-white/10 transition-all cursor-pointer text-purple-300"
                title="Ouvrir dans le lecteur PDF natif de l'appareil"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
              <a
                href={pdfSourceUrl}
                download
                target="_blank"
                rel="noreferrer"
                className="hidden sm:flex p-1.5 rounded-xl opacity-75 hover:opacity-100 hover:bg-white/10 transition-all cursor-pointer text-purple-300"
                title="Télécharger le fichier PDF"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
          )}

          {/* Plein écran (bureau) */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-xl opacity-75 hover:opacity-100 hover:bg-white/10 hidden md:block cursor-pointer"
            title={isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* ── ZONE DE LECTURE CENTRALE ─────────────────────────────────────────── */}
      <main
        ref={canvasContainerRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex-1 overflow-y-auto overflow-x-auto relative flex flex-col items-center justify-start p-2 sm:p-4 overscroll-contain"
      >
        {viewMode === 'pdf' && pdfSourceUrl ? (
          useNativeViewer ? (
            /* Mode iframe natif bureau optionnel */
            <div
              className="w-full h-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl border flex flex-col"
              style={{ borderColor: theme.border, backgroundColor: theme.cardBg }}
            >
              <iframe
                src={`${pdfSourceUrl}#toolbar=1&navpanes=0&scrollbar=1&page=${currentPage}`}
                className="w-full h-full min-h-[75vh] border-0"
                title={book.title}
              />
            </div>
          ) : (
            /* Lecteur PDF Canvas Universel Haute Définition (Mobile & Bureau) */
            <div className="w-full max-w-4xl flex flex-col items-center gap-3">
              {/* Indicateur de chargement initial */}
              {loadingPdf && (
                <div className="flex flex-col items-center justify-center p-12 gap-3 text-center">
                  <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
                  <p className="font-semibold text-sm text-purple-200">
                    Chargement du document PDF en haute résolution...
                  </p>
                  <p className="text-xs opacity-60">Préparation de la lecture optimisée mobile</p>
                </div>
              )}

              {/* Erreur de chargement avec bouton de repli */}
              {pdfError && (
                <div
                  className="w-full max-w-md p-6 rounded-2xl border text-center flex flex-col items-center gap-3 my-8"
                  style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
                >
                  <AlertCircle className="w-10 h-10 text-amber-400" />
                  <h3 className="font-bold text-base">Affichage du PDF</h3>
                  <p className="text-xs opacity-75">
                    {pdfError || 'Le document nécessite une ouverture externe sur cet appareil.'}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                    <button
                      onClick={() => loadPdfDocument()}
                      className="px-4 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600 text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Réessayer</span>
                    </button>
                    <button
                      onClick={() => window.open(pdfSourceUrl, '_blank')}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Ouvrir dans le lecteur natif</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Conteneur de la page PDF rendue */}
              {!loadingPdf && !pdfError && (
                <div className="relative flex flex-col items-center justify-center transition-all duration-300">
                  {/* Effet d'ombrage et cadre de page de livre */}
                  <div
                    className="rounded-xl overflow-hidden shadow-2xl transition-all duration-300 relative"
                    style={{
                      backgroundColor: theme.canvasBg || '#ffffff',
                      border: `1px solid ${theme.border}`,
                    }}
                  >
                    <canvas
                      ref={canvasRef}
                      className="block max-w-full h-auto select-none transition-all duration-200"
                      style={{
                        filter: theme.canvasFilter,
                      }}
                    />

                    {/* Voile discret pendant le rendu de la page suivante */}
                    {pageRendering && (
                      <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
                        <div className="p-3 rounded-2xl bg-black/70 border border-white/10 flex items-center gap-2 shadow-xl">
                          <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                          <span className="text-xs font-semibold text-white">Page {currentPage}...</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Astuce de swipe tactile pour mobile */}
                  {isMobile && (
                    <div className="flex items-center justify-between w-full px-2 mt-2 text-[10px] opacity-60">
                      <span>👈 Glisser pour page précédente</span>
                      <span>Glisser pour page suivante 👉</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        ) : (
          /* Mode Reformaté Texte & Chapitres */
          <article
            className="max-w-3xl w-full mx-auto p-4 sm:p-10 rounded-3xl shadow-xl border transition-all duration-300"
            style={{
              backgroundColor: theme.cardBg,
              borderColor: theme.border,
            }}
          >
            {/* Si le livre possède un PDF, inviter le lecteur à utiliser le mode PDF complet */}
            {Boolean(pdfSourceUrl) && (
              <div className="mb-6 p-3 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-purple-200">
                  <FileText className="w-4 h-4 text-purple-300 flex-shrink-0" />
                  <span>Document original haute fidélité disponible avec mise en page complète.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setViewMode('pdf')}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex-shrink-0 cursor-pointer shadow-sm transition-all"
                >
                  Afficher le PDF
                </button>
              </div>
            )}

            <header className="mb-6 border-b pb-4" style={{ borderColor: theme.border }}>
              <div className="flex items-center justify-between gap-4 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider opacity-60">
                  Chapitre {activeChapterIndex + 1} sur {chapters.length}
                </span>
                <button
                  onClick={() => setIsBookmarked(b => !b)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    isBookmarked ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
                  <span>{isBookmarked ? 'Page Enregistrée' : 'Ajouter un signet'}</span>
                </button>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                {currentChapter.title}
              </h1>
            </header>

            <div
              className="leading-relaxed font-serif space-y-6"
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: 1.8,
              }}
            >
              {(currentChapter?.text || currentChapter?.description || book?.description || 'Contenu en cours de numérisation...')
                .split('\n\n')
                .map((para, i) => (
                  <p key={i} className="text-justify first-letter:text-3xl first-letter:font-bold first-letter:mr-1">
                    {para}
                  </p>
                ))}
            </div>

            <footer className="mt-10 pt-4 border-t flex items-center justify-between text-xs opacity-75" style={{ borderColor: theme.border }}>
              <span>Lecture numérique · Read's Great</span>
              <span className="font-mono">Page {currentPage} / {totalPages}</span>
            </footer>
          </article>
        )}
      </main>

      {/* ── BARRE INFÉRIEURE DE NAVIGATION ET PROGRESSION ───────────────────────── */}
      <footer
        className="px-3 sm:px-4 py-2 sm:py-2.5 border-t flex items-center justify-between gap-2 sm:gap-4 flex-shrink-0 z-10"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.border,
        }}
      >
        {/* Précédent */}
        <button
          onClick={viewMode === 'pdf' ? goToPrevPage : () => {
            if (activeChapterIndex > 0) {
              setActiveChapterIndex(i => i - 1);
              setCurrentPage(p => Math.max(1, p - 5));
            }
          }}
          disabled={viewMode === 'pdf' ? currentPage <= 1 : activeChapterIndex === 0}
          className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Précédent</span>
        </button>

        {/* Curseur et compteur de pages */}
        <div className="flex-1 max-w-md flex items-center gap-2 sm:gap-3">
          <input
            type="range"
            min="1"
            max={Math.max(1, totalPages)}
            value={currentPage}
            onChange={(e) => setCurrentPage(parseInt(e.target.value, 10))}
            className="w-full accent-purple-500 cursor-pointer h-1.5 rounded-lg bg-black/40"
          />
          <span className="text-[11px] sm:text-xs font-mono font-bold whitespace-nowrap opacity-90 px-1.5 py-0.5 rounded bg-black/20">
            {currentPage} / {totalPages}
          </span>
        </div>

        {/* Suivant / Terminer */}
        <button
          onClick={viewMode === 'pdf' ? goToNextPage : () => {
            if (activeChapterIndex < chapters.length - 1) {
              setActiveChapterIndex(i => i + 1);
              setCurrentPage(p => Math.min(totalPages, p + 5));
            } else {
              awardPointsAndXp({
                xp: 120,
                points: 50,
                type: 'reading_reward',
                description: `Lecture terminée : ${book.title} 🏆`,
                badgeId: 'badge-first-read',
              });
            }
          }}
          className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:scale-105 active:scale-95 transition-all shadow-md shadow-purple-600/20 cursor-pointer"
        >
          <span>
            {viewMode === 'pdf'
              ? (currentPage < totalPages ? 'Suivant' : 'Terminer')
              : (activeChapterIndex < chapters.length - 1 ? 'Suivant' : 'Terminer')}
          </span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </footer>
    </div>
  );
}
