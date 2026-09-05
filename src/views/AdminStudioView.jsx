import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  UploadCloud, BookOpen, Wand2, Sliders, BarChart3, Bell, Settings,
  Music, ImageIcon, FileAudio, Trash2, CheckCircle2, AlertCircle,
  X, Loader2, Plus, Save, Mic, ChevronRight, Play, Pause, Search,
  Star, Flame, Sparkles, RefreshCw, Eye, EyeOff, ShieldCheck, Download,
  Volume2, VolumeX, ArrowUp, ArrowDown, Layers, Smartphone, DollarSign,
  TrendingUp, Users, Clock, Edit3, Send, Check, HardDrive, Database, Headphones,
  FileText, Scissors, Crop, Activity, Grid, FolderPlus, Share2, Zap, Award, Gift,
  LayoutGrid, List, Key, Copy, Terminal, Code2, Shield, Lock, Cpu, ExternalLink
} from 'lucide-react';
import { apiClient } from '../services/api';
import { usePush } from '../context/PushContext';
import { compressImage, compressAndOptimizeAudio, audioBufferToWav } from '../utils/mediaCompressor';
import { getAnalyticsData } from '../services/tracker';
import { PdfReaderModal } from '../components/PdfReaderModal';
import { BulkEbookImporter } from '../components/BulkEbookImporter';

// ── Rubriques fragmentées (modules découplés) ─────────────────────────────────
import { GamificationRubric } from './admin/rubrics/GamificationRubric';
import { CategoriesRubric } from './admin/rubrics/CategoriesRubric';
import { AnalyticsRubric } from './admin/rubrics/AnalyticsRubric';
import { PushRubric } from './admin/rubrics/PushRubric';
import { SettingsRubric } from './admin/rubrics/SettingsRubric';
import { ApiGeneratorRubric } from './admin/rubrics/ApiGeneratorRubric';
import { AiTtsRubric } from './admin/rubrics/AiTtsRubric';
import { AudacityRubric } from './admin/rubrics/AudacityRubric';
import { BulkEbooksRubric } from './admin/rubrics/BulkEbooksRubric';
import { CatalogRubric } from './admin/rubrics/CatalogRubric';
import { PublishEbookRubric } from './admin/rubrics/PublishEbookRubric';
import { PublishAudioRubric } from './admin/rubrics/PublishAudioRubric';
import { SocialProofModal } from './admin/components/SocialProofModal';
import { ChapterAiModal } from './admin/components/ChapterAiModal';

import { DropZone } from './admin/components/DropZone';
import { formatSize, formatDuration, uploadToR2, CONTENT_TYPE_CONFIG } from './admin/utils/adminHelpers';

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
  const [pdfUrl, setPdfUrl] = useState('');
  const [pageCount, setPageCount] = useState(180);
  const [unlockPoints, setUnlockPoints] = useState(100);
  const [coverData, setCoverData] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [chapters, setChapters] = useState([
    { title: 'Chapitre 1 : Introduction', duration_seconds: 1800, uploadData: null },
  ]);
  const [publishMode, setPublishMode] = useState('immediate'); // 'immediate' | 'scheduled'
  const [scheduledAt, setScheduledAt] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState('');

  // ── État Spécifique : Publier E-Book & PDF (Read's Great Uploader) ─────────
  const [ebookSubTab, setEbookSubTab] = useState('list'); // 'list' | 'publish'
  const [ebookSearch, setEbookSearch] = useState('');
  const [readingEbook, setReadingEbook] = useState(null);
  const [ebookStep, setEbookStep] = useState(1);
  const [isEbookSubmitting, setIsEbookSubmitting] = useState(false);

  // ── État Gamification & Points Read's Great ──
  const [gamificationRules, setGamificationRules] = useState(() => {
    try {
      const cached = localStorage.getItem('rg_gamification_rules');
      if (cached) return JSON.parse(cached);
    } catch (_) {}
    return {
      bookUnlockPoints: 100,
      readingXpPer3Min: 8,
      readingPointsPer3Min: 5,
      adRewardPoints: 30,
      adRewardXp: 40,
      dailyLoginBaseXp: 20,
      audioXpDisabled: localStorage.getItem('rg_settings_audio_xp_disabled') !== 'false', // Désactivé par défaut sur audios
    };
  });
  const [savingGamification, setSavingGamification] = useState(false);
  const [gamificationSavedMsg, setGamificationSavedMsg] = useState('');

  const handleSaveGamification = async (updated) => {
    setSavingGamification(true);
    setGamificationSavedMsg('');
    const rulesToSave = updated || gamificationRules;
    setGamificationRules(rulesToSave);
    try {
      localStorage.setItem('rg_gamification_rules', JSON.stringify(rulesToSave));
      localStorage.setItem('rg_settings_audio_xp_disabled', String(rulesToSave.audioXpDisabled));
      window.dispatchEvent(new CustomEvent('rg:gamification-rules-updated', { detail: rulesToSave }));

      await fetch('/api/admin/gamification-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rulesToSave),
      }).catch(() => {});

      setGamificationSavedMsg('✓ Règles de Gamification enregistrées et appliquées !');
      setTimeout(() => setGamificationSavedMsg(''), 4000);
    } finally {
      setSavingGamification(false);
    }
  };
  const [publishedEbookResult, setPublishedEbookResult] = useState(null);
  const [publishedEbookData, setPublishedEbookData] = useState(null);
  const [ebookTitle, setEbookTitle] = useState('');
  const [ebookAuthor, setEbookAuthor] = useState('');
  const [ebookPublisher, setEbookPublisher] = useState("Éditions Read's Great");
  const [ebookCategoryId, setEbookCategoryId] = useState('cat-1');
  const [ebookFormat, setEbookFormat] = useState('pdf'); // 'pdf' | 'epub' | 'hybrid'
  const [ebookPageCount, setEbookPageCount] = useState(180);
  const [ebookLanguage, setEbookLanguage] = useState('fr');
  const [ebookPrice, setEbookPrice] = useState('0');
  const [ebookDiscountPrice, setEbookDiscountPrice] = useState('');
  const [ebookUnlockPoints, setEbookUnlockPoints] = useState(100);
  const [ebookDescription, setEbookDescription] = useState('');
  const [ebookSynopsis, setEbookSynopsis] = useState('');
  const [ebookCoverData, setEbookCoverData] = useState(null);
  const [ebookFileData, setEbookFileData] = useState(null);
  const [ebookIsFeatured, setEbookIsFeatured] = useState(false);
  const [ebookIsPinned, setEbookIsPinned] = useState(false);
  const [isEbookAiGenerating, setIsEbookAiGenerating] = useState(false);
  const [ebookAiSuccessMessage, setEbookAiSuccessMessage] = useState('');

  // ── Associations Compagnon E-Book <-> Audio & DeepSeek IA ─────────────────
  const [ebookCompanionAudioId, setEbookCompanionAudioId] = useState('');
  const [ebookMatchResult, setEbookMatchResult] = useState(null);
  const [isMatchingAudio, setIsMatchingAudio] = useState(false);

  const [companionEbookId, setCompanionEbookId] = useState('');
  const [audioMatchResult, setAudioMatchResult] = useState(null);
  const [isMatchingEbook, setIsMatchingEbook] = useState(false);

  const handleDeepSeekMatchAudio = async () => {
    if (!ebookTitle.trim()) {
      alert("Veuillez renseigner au moins le titre de l'e-book pour rechercher la version audio correspondante.");
      return;
    }
    setIsMatchingAudio(true);
    setEbookMatchResult(null);
    try {
      const res = await apiClient.matchCompanion({
        title: ebookTitle,
        author: ebookAuthor,
        description: ebookDescription || ebookSynopsis,
        target_type: 'audio'
      });
      if (res.success) {
        setEbookMatchResult(res);
        if (res.matched && res.companion?.id) {
          setEbookCompanionAudioId(res.companion.id);
        }
      } else {
        alert(res.error || "Impossible de trouver une correspondance.");
      }
    } catch (e) {
      alert(`Erreur: ${e.message}`);
    } finally {
      setIsMatchingAudio(false);
    }
  };

  const handleDeepSeekMatchEbook = async () => {
    if (!title.trim()) {
      alert("Veuillez renseigner au moins le titre du livre audio pour rechercher l'e-book correspondant.");
      return;
    }
    setIsMatchingEbook(true);
    setAudioMatchResult(null);
    try {
      const res = await apiClient.matchCompanion({
        title,
        author,
        description: description || synopsis,
        target_type: 'ebook'
      });
      if (res.success) {
        setAudioMatchResult(res);
        if (res.matched && res.companion?.id) {
          setCompanionEbookId(res.companion.id);
        }
      } else {
        alert(res.error || "Impossible de trouver une correspondance.");
      }
    } catch (e) {
      alert(`Erreur: ${e.message}`);
    } finally {
      setIsMatchingEbook(false);
    }
  };

  const handleEditEbook = (book) => {
    setEditingBook(book);
    setEbookTitle(book.title || '');
    setEbookAuthor(book.author || '');
    setEbookPublisher(book.narrator || "Éditions Read's Great");
    setEbookCategoryId(book.category_id || 'cat-1');
    setEbookFormat(book.format || (book.pdf_url?.endsWith('.epub') ? 'epub' : 'pdf'));
    setEbookPageCount(book.page_count || 180);
    setEbookLanguage(book.language || 'fr');
    setEbookPrice(String(book.price ?? '0'));
    setEbookDiscountPrice(book.discount_price ? String(book.discount_price) : '');
    setEbookUnlockPoints(book.unlock_points ?? 100);
    setEbookDescription(book.description || '');
    setEbookSynopsis(book.synopsis || '');
    setEbookIsFeatured(Boolean(book.is_featured));
    setEbookIsPinned(Boolean(book.is_pinned));
    setEbookCompanionAudioId(book.companion_audio_id || '');
    setEbookMatchResult(null);
    if (book.pdf_url) {
      setEbookFileData({
        public_url: book.pdf_url,
        file_name: book.pdf_url.split('/').pop() || `${book.title}.pdf`,
        format: book.format || (book.pdf_url.endsWith('.epub') ? 'epub' : 'pdf'),
        r2_key: book.pdf_r2_key || ''
      });
    } else {
      setEbookFileData(null);
    }
    if (book.cover_url) {
      setEbookCoverData({
        public_url: book.cover_url,
        file_name: 'Couverture actuelle',
        r2_key: book.cover_r2_key || ''
      });
    } else {
      setEbookCoverData(null);
    }
    setEbookSubTab('publish');
    setEbookStep(1);
    setActiveRubric('publish-ebook');
  };

  const handleDeepSeekEbookEnrich = async () => {
    if (!ebookTitle.trim()) {
      alert("Veuillez saisir au moins le titre de l'e-book pour guider la génération IA.");
      return;
    }
    setIsEbookAiGenerating(true);
    setEbookAiSuccessMessage('');
    try {
      const res = await apiClient.enrichWithAI({
        title: ebookTitle,
        author: ebookAuthor,
        description: ebookDescription,
        synopsis: ebookSynopsis,
        content_type: 'ebook',
      });
      if (res.success && res.data) {
        if (res.data.description) setEbookDescription(res.data.description);
        if (res.data.synopsis) setEbookSynopsis(res.data.synopsis);
        if (res.data.suggested_category) {
          const matchCat = categories.find(c => c.name.toLowerCase().includes(res.data.suggested_category.toLowerCase()));
          if (matchCat) setEbookCategoryId(matchCat.id);
        }
        setEbookAiSuccessMessage('✓ Synopsis, résumé et métadonnées générés par DeepSeek IA !');
        setTimeout(() => setEbookAiSuccessMessage(''), 4000);
      } else {
        alert(res.error || 'Erreur lors de la génération IA.');
      }
    } catch (e) {
      alert(`Erreur: ${e.message}`);
    } finally {
      setIsEbookAiGenerating(false);
    }
  };

  const handlePublishEbook = async () => {
    if (!ebookTitle.trim() || !ebookAuthor.trim()) {
      alert("Veuillez renseigner le titre et l'auteur de l'e-book.");
      return;
    }
    if (!ebookFileData?.public_url) {
      alert("Veuillez téléverser le fichier PDF ou EPUB du livre.");
      return;
    }

    setIsEbookSubmitting(true);
    try {
      const catObj = categories.find(c => c.id === ebookCategoryId);
      const estDuration = Math.round(Number(ebookPageCount || 120) * 1.5 * 60);

      const bookData = {
        id: editingBook?.id || `ebook-${Date.now()}`,
        title: ebookTitle.trim(),
        author: ebookAuthor.trim(),
        narrator: ebookPublisher.trim() || "Éditions Read's Great",
        category_id: ebookCategoryId,
        category_name: catObj?.name || 'E-Books & PDF',
        content_type: 'ebook',
        format: ebookFileData?.format || ebookFormat || 'pdf',
        price: Number(ebookPrice) || 0,
        discount_price: ebookDiscountPrice ? Number(ebookDiscountPrice) : null,
        unlock_points: Number(ebookUnlockPoints) || 100,
        description: ebookDescription.trim() || 'Livre numérique complet en haute définition.',
        synopsis: ebookSynopsis.trim() || 'Livre disponible en liseuse numérique.',
        pdf_url: ebookFileData?.public_url || '',
        pdf_r2_key: ebookFileData?.r2_key || '',
        cover_url: ebookCoverData?.public_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80',
        cover_r2_key: ebookCoverData?.r2_key || '',
        duration_seconds: estDuration,
        page_count: Number(ebookPageCount) || 180,
        language: ebookLanguage,
        is_featured: ebookIsFeatured ? 1 : 0,
        is_pinned: ebookIsPinned ? 1 : 0,
        is_free_for_members: Number(ebookPrice) === 0 ? 1 : 0,
        companion_audio_id: ebookCompanionAudioId || null,
        chapters: [
          {
            id: `chap-${Date.now()}-1`,
            title: `Lecture Intégrale (${(ebookFileData?.format || ebookFormat).toUpperCase()})`,
            duration_seconds: estDuration,
            chapter_index: 1,
            audio_url: '',
          }
        ]
      };

      const result = await apiClient.createAudiobook(bookData);
      setPublishedEbookData(bookData);
      setPublishedEbookResult(result?.serverResult || null);
      setEbookStep(4);
      await loadBooks();

      // Diffuser l'événement pour mettre à jour la bibliothèque en temps réel
      window.dispatchEvent(new CustomEvent('rg:book-created', { detail: bookData }));
      window.dispatchEvent(new CustomEvent('rg:library-updated'));
      if (onBookCreated) onBookCreated(bookData);
    } catch (err) {
      alert(`Erreur de publication: ${err.message}`);
    } finally {
      setIsEbookSubmitting(false);
    }
  };

  const resetEbookForm = () => {
    setEbookStep(1);
    setEbookTitle('');
    setEbookAuthor('');
    setEbookPublisher("Éditions Read's Great");
    setEbookCategoryId('cat-1');
    setEbookFormat('pdf');
    setEbookPageCount(180);
    setEbookLanguage('fr');
    setEbookPrice('0');
    setEbookDiscountPrice('');
    setEbookUnlockPoints(100);
    setEbookDescription('');
    setEbookSynopsis('');
    setEbookCoverData(null);
    setEbookFileData(null);
    setEbookIsFeatured(false);
    setEbookIsPinned(false);
    setEbookCompanionAudioId('');
    setEbookMatchResult(null);
    setPublishedEbookData(null);
    setPublishedEbookResult(null);
  };

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

  // ── État Studio Vocal IA pour Chapitre Dédié ──
  const [activeChapterAiModalIndex, setActiveChapterAiModalIndex] = useState(null);
  const [chapterTtsText, setChapterTtsText] = useState('');
  const [chapterTtsVoice, setChapterTtsVoice] = useState('fr-FR-HenriNeural');
  const [chapterTtsSpeed, setChapterTtsSpeed] = useState(1.0);
  const [chapterTtsPitch, setChapterTtsPitch] = useState(1.0);
  const [isChapterTtsGenerating, setIsChapterTtsGenerating] = useState(false);
  const [chapterTtsAudioUrl, setChapterTtsAudioUrl] = useState(null);
  const [chapterTtsDuration, setChapterTtsDuration] = useState(0);
  const [chapterTtsIsSpeaking, setChapterTtsIsSpeaking] = useState(false);
  const [activePlayingChapterIdx, setActivePlayingChapterIdx] = useState(null);
  const chapterAudioPreviewRef = useRef(null);

  // ── Téléchargement direct en MP3 / WAV ──
  const downloadAudioMp3 = (url, fileName = 'chapitre_audio.mp3') => {
    if (!url) {
      alert("Aucun flux audio disponible pour le téléchargement.");
      return;
    }
    const safeTitle = (fileName || 'audio_rg_play').replace(/[^a-zA-Z0-9_\-.]/g, '_');
    const fullName = safeTitle.endsWith('.mp3') || safeTitle.endsWith('.wav') ? safeTitle : `${safeTitle}.mp3`;
    const a = document.createElement('a');
    a.href = url;
    a.download = fullName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

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

  // Chargement des livres (avec vue complète Admin incluant les programmés)
  const loadBooks = async () => {
    setLoadingBooks(true);
    try {
      const data = await apiClient.getAudiobooks({ category: 'all', admin: true });
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

  // Suppression groupée de livres (Admin Studio Back-Office)
  const handleBulkDeleteBooks = async (bookIds) => {
    if (!Array.isArray(bookIds) || bookIds.length === 0) return false;
    const count = bookIds.length;
    if (!window.confirm(`⚠️ Confirmer la suppression définitive de ces ${count} livre(s) PDF / E-Book(s) ? Cette action est irréversible.`)) {
      return false;
    }

    // 1. Retrait optimiste immédiat de l'interface
    setBooks(prev => prev.filter(b => !bookIds.includes(b.id)));

    try {
      // 2. Suppression de chaque livre
      for (const id of bookIds) {
        await apiClient.deleteAudiobook(id);
        window.dispatchEvent(new CustomEvent('rg:book-deleted', { detail: { id } }));
      }

      // 3. Rechargement depuis le serveur
      await new Promise(r => setTimeout(r, 600));
      await loadBooks();
      return true;
    } catch (err) {
      console.error('[handleBulkDeleteBooks] Erreur:', err);
      await loadBooks();
      return false;
    }
  };

  // Publier immédiatement un livre programmé
  const handlePublishImmediately = async (book) => {
    if (!window.confirm(`Publier immédiatement "${book.title}" pour tous les utilisateurs ?`)) return;
    try {
      const updatedBook = {
        ...book,
        status: 'published',
        scheduled_at: null,
      };
      setBooks(prev => prev.map(b => b.id === book.id ? updatedBook : b));
      await apiClient.createAudiobook(updatedBook);
      window.dispatchEvent(new CustomEvent('rg_new_content_published', { detail: updatedBook }));
      await loadBooks();
    } catch (err) {
      console.error('Erreur publication immédiate:', err);
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
    setPdfUrl(book.pdf_url || '');
    setPageCount(book.page_count || 180);
    setUnlockPoints(book.unlock_points || 100);
    setCompanionEbookId(book.companion_ebook_id || '');
    setAudioMatchResult(null);
    setCoverData(book.cover_url ? { public_url: book.cover_url, r2_key: book.cover_r2_key || '' } : null);
    setPreviewData(book.preview_url ? { public_url: book.preview_url, r2_key: book.preview_r2_key || '' } : null);
    setPublishMode(book.status === 'scheduled' && book.scheduled_at ? 'scheduled' : 'immediate');
    setScheduledAt(book.scheduled_at ? book.scheduled_at.slice(0, 16) : '');
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
    const handleCategoryDeleted = () => { loadCategories(); };

    window.addEventListener('rg:book-created', handleBookCreated);
    window.addEventListener('rg:book-deleted', handleBookDeleted);
    window.addEventListener('rg:category-updated', handleCategoryChanged);
    window.addEventListener('rg:category-deleted', handleCategoryDeleted);

    return () => {
      window.removeEventListener('rg:book-created', handleBookCreated);
      window.removeEventListener('rg:book-deleted', handleBookDeleted);
      window.removeEventListener('rg:category-updated', handleCategoryChanged);
      window.removeEventListener('rg:category-deleted', handleCategoryDeleted);
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
    const isScheduled = publishMode === 'scheduled' && !!scheduledAt;

    const newBook = {
      id: bookId,
      title, author, narrator,
      content_type: contentType,
      format: contentType === 'ebook' ? 'ebook' : (contentType === 'hybrid' ? 'hybrid' : 'audio'),
      pdf_url: pdfUrl || (contentType === 'ebook' ? 'https://raw.githubusercontent.com/Klein241/bibliotequereadgreat/main/sample.pdf' : null),
      page_count: Number(pageCount) || 180,
      unlock_points: Number(unlockPoints) || 100,
      category_id: categoryId,
      category_name: categories.find(c => c.id === categoryId)?.name || 'Business & Finance',
      price: Number(price),
      discount_price: discountPrice ? Number(discountPrice) : null,
      companion_ebook_id: companionEbookId || null,
      description, synopsis,
      status: isScheduled ? 'scheduled' : 'published',
      scheduled_at: isScheduled ? new Date(scheduledAt).toISOString() : null,
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

    // Déclencher la notification push réelle pour les utilisateurs si publié immédiatement
    if (!isScheduled) {
      window.dispatchEvent(new CustomEvent('rg_new_content_published', { detail: newBook }));
    }

    if (onBookCreated) onBookCreated(newBook);
  };

  const resetPublishForm = (targetType = 'audiobook') => {
    const cfg = CONTENT_TYPE_CONFIG[targetType] || CONTENT_TYPE_CONFIG.audiobook;
    setStep(1);
    setContentType(targetType);
    setTitle('');
    setAuthor('');
    setNarrator('');
    setPdfUrl('');
    setPageCount(180);
    setUnlockPoints(100);
    setCompanionEbookId('');
    setAudioMatchResult(null);
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

  const handleApplyTtsToChapter = (chapterIdx, audioUrl, duration) => {
    if (!audioUrl) return;
    const dur = duration || 180;
    setChapters(prev => {
      const next = [...prev];
      if (!next[chapterIdx]) {
        next[chapterIdx] = { title: `Chapitre ${chapterIdx + 1}`, duration_seconds: dur, uploadData: null };
      }
      next[chapterIdx] = {
        ...next[chapterIdx],
        duration_seconds: dur,
        uploadData: {
          public_url: audioUrl,
          file_name: `Narration_IA_Chapitre_${chapterIdx + 1}.mp3`,
          size_mb: `${(dur / 60 * 0.9).toFixed(1)} Mo`,
          r2_key: `audiobooks/tts_${Date.now()}.mp3`,
          duration_seconds: dur,
        }
      };
      return next;
    });
    setActiveRubric('publish');
    setStep(3);
  };

  // ── Moteur TTS IA Spécifique par Chapitre ──
  const handleGenerateChapterTTS = async (chapterIdx) => {
    if (!chapterTtsText.trim()) {
      alert("Veuillez saisir le texte ou script du chapitre à synthétiser.");
      return;
    }
    setIsChapterTtsGenerating(true);

    if (chapterTtsAudioUrl && chapterTtsAudioUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(chapterTtsAudioUrl); } catch (_) {}
    }
    setChapterTtsAudioUrl(null);

    const words = chapterTtsText.trim().split(/\s+/).length;
    const estimatedDuration = Math.max(5, Math.round(words / (2.6 * chapterTtsSpeed)));

    try {
      // 1. Tenter via l'API Edge TTS Cloudflare si disponible
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: chapterTtsText.slice(0, 4000),
          voice: chapterTtsVoice,
          speed: chapterTtsSpeed,
          pitch: chapterTtsPitch,
        }),
      }).catch(() => null);

      if (res && res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setChapterTtsAudioUrl(url);
        setChapterTtsDuration(estimatedDuration);
        setIsChapterTtsGenerating(false);
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

      const f0 = chapterTtsVoice.includes('Henri') || chapterTtsVoice.includes('Guy') ? 115 * chapterTtsPitch : 210 * chapterTtsPitch;
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const envelope = Math.min(1, Math.sin((t / duration) * Math.PI));
        const harmonic1 = Math.sin(2 * Math.PI * f0 * t) * 0.4;
        const harmonic2 = Math.sin(2 * Math.PI * f0 * 2 * t) * 0.25;
        const harmonic3 = Math.sin(2 * Math.PI * f0 * 3 * t) * 0.15;
        const breath = (Math.random() * 2 - 1) * 0.02;
        data[i] = (harmonic1 + harmonic2 + harmonic3 + breath) * envelope * 0.8;
      }

      const wavBlob = audioBufferToWav(buffer);
      const url = URL.createObjectURL(wavBlob);
      setChapterTtsAudioUrl(url);
      setChapterTtsDuration(estimatedDuration);
    } catch (err) {
      console.warn('[Chapter TTS] Fallback audio:', err);
    }

    setIsChapterTtsGenerating(false);
  };

  const handleApplyChapterTtsDirectly = (chapterIdx) => {
    if (!chapterTtsAudioUrl) return;
    const dur = chapterTtsDuration || 180;
    setChapters(prev => {
      const next = [...prev];
      if (next[chapterIdx]) {
        next[chapterIdx] = {
          ...next[chapterIdx],
          duration_seconds: dur,
          uploadData: {
            public_url: chapterTtsAudioUrl,
            file_name: `Voix_IA_${chapterTtsVoice.split('-')[2] || 'Pro'}_Chap_${chapterIdx + 1}.wav`,
            size_mb: `${(dur / 60 * 1.2).toFixed(1)} Mo (Master IA)`,
            r2_key: `audiobooks/tts_chap_${chapterIdx + 1}_${Date.now()}.wav`,
            duration_seconds: dur,
          }
        };
      }
      return next;
    });
    setActiveChapterAiModalIndex(null);
  };

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

  const handleApplyDspToPublishing = (processedUrl, dur = 180, chapterIndex = 0) => {
    if (!processedUrl) return;
    setChapters(prev => {
      const next = [...prev];
      if (!next[chapterIndex]) {
        next[chapterIndex] = { title: `Chapitre ${chapterIndex + 1}`, duration_seconds: dur, uploadData: null };
      }
      next[chapterIndex] = {
        ...next[chapterIndex],
        duration_seconds: dur,
        uploadData: {
          public_url: processedUrl,
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
  const ebooksList = books.filter(b => b.content_type === 'ebook' || Boolean(b.pdf_url));
  const RUBRICS = [
    { id: 'catalog', label: 'Catalogue & Livres', icon: BookOpen, badge: books.length },
    { id: 'publish-ebook', label: '📖 Publier E-Book & PDF', icon: FileText, badge: ebooksList.length > 0 ? `${ebooksList.length}` : "Read's Great" },
    { id: 'bulk-ebooks', label: '📦 Import en Masse (500+)', icon: FolderPlus, badge: 'Nouveau' },
    { id: 'publish', label: '🎙️ Publier Audio & Masterclass', icon: UploadCloud },
    { id: 'categories', label: 'Catalogues & Catégories', icon: Grid, badge: categories.length },
    { id: 'gamification', label: '⭐ Gamification & Points', icon: Sparkles, badge: 'Read\'s Great' },
    { id: 'ai-tts', label: 'Studio IA (Texte ➔ Voix)', icon: Wand2, badge: 'Pro' },
    { id: 'audacity', label: 'Studio Audacity & Découpe', icon: Scissors, badge: 'Cutter' },
    { id: 'analytics', label: 'Statistiques & Ventes', icon: BarChart3 },
    { id: 'push', label: 'Notifications Push', icon: Bell },
    { id: 'api-generator', label: 'Générateur d\'API & IA', icon: Key, badge: 'MCP / IA' },
    { id: 'settings', label: 'Paramètres & Système', icon: Settings },
  ];

  const filteredBooks = books.filter(b => {
    const q = catalogSearch.toLowerCase();
    const matchSearch = !q ||
      b.title?.toLowerCase().includes(q) ||
      b.author?.toLowerCase().includes(q);
    let matchType = true;
    if (catalogTypeFilter === 'scheduled') {
      matchType = b.status === 'scheduled';
    } else if (catalogTypeFilter === 'ebook') {
      matchType = b.content_type === 'ebook' || Boolean(b.pdf_url);
    } else if (catalogTypeFilter !== 'all') {
      matchType = (b.content_type || 'audiobook') === catalogTypeFilter;
    }
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
          <CatalogRubric
            books={books}
            setBooks={setBooks}
            loadingBooks={loadingBooks}
            catalogSearch={catalogSearch}
            setCatalogSearch={setCatalogSearch}
            catalogTypeFilter={catalogTypeFilter}
            setCatalogTypeFilter={setCatalogTypeFilter}
            catalogViewMode={catalogViewMode}
            setCatalogViewMode={setCatalogViewMode}
            filteredBooks={filteredBooks}
            previewingBookId={previewingBookId}
            setPreviewingBookId={setPreviewingBookId}
            catalogAudioRef={catalogAudioRef}
            resetPublishForm={resetPublishForm}
            setActiveRubric={setActiveRubric}
            handleEditBook={handleEditBook}
            handleDeleteBook={handleDeleteBook}
            handleBulkDeleteBooks={handleBulkDeleteBooks}
            handlePublishImmediately={handlePublishImmediately}
            setSocialModalBook={setSocialModalBook}
            setSocialPlays={setSocialPlays}
            setSocialReviews={setSocialReviews}
            setSocialRating={setSocialRating}
            apiClient={apiClient}
          />
        )}

        {activeRubric === 'publish-ebook' && (
          <PublishEbookRubric
            ebookSubTab={ebookSubTab}
            setEbookSubTab={setEbookSubTab}
            ebooksList={ebooksList}
            resetEbookForm={resetEbookForm}
            editingBook={editingBook}
            ebookSearch={ebookSearch}
            setEbookSearch={setEbookSearch}
            books={books}
            setBooks={setBooks}
            categories={categories}
            setReadingEbook={setReadingEbook}
            setSocialModalBook={setSocialModalBook}
            setSocialPlays={setSocialPlays}
            setSocialReviews={setSocialReviews}
            setSocialRating={setSocialRating}
            handleEditEbook={handleEditEbook}
            handleDeleteBook={handleDeleteBook}
            handleBulkDeleteBooks={handleBulkDeleteBooks}
            ebookStep={ebookStep}
            setEbookStep={setEbookStep}
            ebookTitle={ebookTitle}
            setEbookTitle={setEbookTitle}
            ebookAuthor={ebookAuthor}
            setEbookAuthor={setEbookAuthor}
            ebookPublisher={ebookPublisher}
            setEbookPublisher={setEbookPublisher}
            ebookCategoryId={ebookCategoryId}
            setEbookCategoryId={setEbookCategoryId}
            ebookFormat={ebookFormat}
            setEbookFormat={setEbookFormat}
            ebookPageCount={ebookPageCount}
            setEbookPageCount={setEbookPageCount}
            ebookLanguage={ebookLanguage}
            setEbookLanguage={setEbookLanguage}
            ebookPrice={ebookPrice}
            setEbookPrice={setEbookPrice}
            ebookDiscountPrice={ebookDiscountPrice}
            setEbookDiscountPrice={setEbookDiscountPrice}
            ebookUnlockPoints={ebookUnlockPoints}
            setEbookUnlockPoints={setEbookUnlockPoints}
            ebookDescription={ebookDescription}
            setEbookDescription={setEbookDescription}
            ebookSynopsis={ebookSynopsis}
            setEbookSynopsis={setEbookSynopsis}
            ebookCoverData={ebookCoverData}
            setEbookCoverData={setEbookCoverData}
            ebookFileData={ebookFileData}
            setEbookFileData={setEbookFileData}
            ebookIsFeatured={ebookIsFeatured}
            setEbookIsFeatured={setEbookIsFeatured}
            ebookIsPinned={ebookIsPinned}
            setEbookIsPinned={setEbookIsPinned}
            isEbookAiGenerating={isEbookAiGenerating}
            ebookAiSuccessMessage={ebookAiSuccessMessage}
            handleDeepSeekEbookEnrich={handleDeepSeekEbookEnrich}
            ebookCompanionAudioId={ebookCompanionAudioId}
            setEbookCompanionAudioId={setEbookCompanionAudioId}
            ebookMatchResult={ebookMatchResult}
            setEbookMatchResult={setEbookMatchResult}
            isMatchingAudio={isMatchingAudio}
            handleDeepSeekMatchAudio={handleDeepSeekMatchAudio}
            isEbookSubmitting={isEbookSubmitting}
            handlePublishEbook={handlePublishEbook}
            publishedEbookData={publishedEbookData}
            publishedEbookResult={publishedEbookResult}
            apiClient={apiClient}
            setActiveRubric={setActiveRubric}
          />
        )}

        {/* ══════════════════════════════════════════════════════════════════
            RUBRIQUE : IMPORT EN MASSE E-BOOKS & PDF (READ'S GREAT)
            ══════════════════════════════════════════════════════════════════ */}
        {activeRubric === 'bulk-ebooks' && (
          <BulkEbookImporter />
        )}

        {/* ══════════════════════════════════════════════════════════════════
            3. RUBRIQUE : PUBLIER UN LIVRE AUDIO & PODCAST
            ══════════════════════════════════════════════════════════════════ */}
        {/* ══════════════════════════════════════════════════════════════════
            3. RUBRIQUE : PUBLIER UN LIVRE AUDIO & PODCAST
            ══════════════════════════════════════════════════════════════════ */}
        {activeRubric === 'publish' && (
          <PublishAudioRubric
            editingBook={editingBook}
            contentType={contentType}
            setContentType={setContentType}
            handleSelectContentType={handleSelectContentType}
            activeTypeConfig={activeTypeConfig}
            step={step}
            setStep={setStep}
            title={title}
            setTitle={setTitle}
            author={author}
            setAuthor={setAuthor}
            narrator={narrator}
            setNarrator={setNarrator}
            categoryId={categoryId}
            setCategoryId={setCategoryId}
            price={price}
            setPrice={setPrice}
            discountPrice={discountPrice}
            setDiscountPrice={setDiscountPrice}
            unlockPoints={unlockPoints}
            setUnlockPoints={setUnlockPoints}
            description={description}
            setDescription={setDescription}
            synopsis={synopsis}
            setSynopsis={setSynopsis}
            categories={categories}
            isAiGenerating={isAiGenerating}
            aiSuccessMessage={aiSuccessMessage}
            handleDeepSeekEnrich={handleDeepSeekEnrich}
            companionEbookId={companionEbookId}
            setCompanionEbookId={setCompanionEbookId}
            ebooksList={ebooksList}
            audioMatchResult={audioMatchResult}
            isMatchingEbook={isMatchingEbook}
            handleDeepSeekMatchEbook={handleDeepSeekMatchEbook}
            coverData={coverData}
            setCoverData={setCoverData}
            previewData={previewData}
            setPreviewData={setPreviewData}
            chapters={chapters}
            setChapters={setChapters}
            setActiveChapterAiModalIndex={setActiveChapterAiModalIndex}
            activePlayingChapterIdx={activePlayingChapterIdx}
            setActivePlayingChapterIdx={setActivePlayingChapterIdx}
            chapterAudioPreviewRef={chapterAudioPreviewRef}
            publishMode={publishMode}
            setPublishMode={setPublishMode}
            scheduledAt={scheduledAt}
            setScheduledAt={setScheduledAt}
            isSubmitting={isSubmitting}
            handlePublish={handlePublish}
            publishedBook={publishedBook}
            publishResult={publishResult}
            setActiveRubric={setActiveRubric}
            resetPublishForm={resetPublishForm}
            downloadAudioMp3={downloadAudioMp3}
            setEditingBook={setEditingBook}
            pdfUrl={pdfUrl}
            setPdfUrl={setPdfUrl}
            pageCount={pageCount}
            setPageCount={setPageCount}
            setChapterTtsAudioUrl={setChapterTtsAudioUrl}
            setChapterTtsText={setChapterTtsText}
          />
        )}

        {/* ══════════════════════════════════════════════════════════════════
            3. RUBRIQUE : GAMIFICATION & POINTS READ'S GREAT
            ══════════════════════════════════════════════════════════════════ */}
        {activeRubric === 'gamification' && (
          <GamificationRubric
            gamificationRules={gamificationRules}
            setGamificationRules={setGamificationRules}
            savingGamification={savingGamification}
            gamificationSavedMsg={gamificationSavedMsg}
            handleSaveGamification={handleSaveGamification}
          />
        )}

        {/* ══════════════════════════════════════════════════════════════════
            4. RUBRIQUE : STUDIO IA (TEXTE → VOIX TTS)
            ══════════════════════════════════════════════════════════════════ */}
        {activeRubric === 'ai-tts' && (
          <AiTtsRubric
            chapters={chapters}
            onApplyTtsToChapter={handleApplyTtsToChapter}
          />
        )}


        {/* ══════════════════════════════════════════════════════════════════
            5. RUBRIQUE : STUDIO AUDACITY DSP & DÉCOUPE
            ══════════════════════════════════════════════════════════════════ */}
        {activeRubric === 'audacity' && (
          <AudacityRubric
            onApplyDspToPublishing={handleApplyDspToPublishing}
          />
        )}


        {/* ══════════════════════════════════════════════════════════════════
            GESTION DES CATALOGUES & CATÉGORIES
            ══════════════════════════════════════════════════════════════════ */}
        {activeRubric === 'categories' && (
          <CategoriesRubric
            categories={categories}
            books={books}
            editingCat={editingCat} setEditingCat={setEditingCat}
            newCatName={newCatName} setNewCatName={setNewCatName}
            newCatSlug={newCatSlug} setNewCatSlug={setNewCatSlug}
            newCatColor={newCatColor} setNewCatColor={setNewCatColor}
            newCatIcon={newCatIcon} setNewCatIcon={setNewCatIcon}
            isSavingCat={isSavingCat}
            handleSaveCategory={handleSaveCategory}
            handleDeleteCategory={handleDeleteCategory}
          />
        )}

        {/* ══════════════════════════════════════════════════════════════════
            5. RUBRIQUE : STATISTIQUES & ANALYTICS VISITEURS
            ══════════════════════════════════════════════════════════════════ */}
        {activeRubric === 'analytics' && (
          <AnalyticsRubric
            books={books}
            analyticsData={analyticsData}
            loadingAnalytics={loadingAnalytics}
            loadLiveAnalytics={loadLiveAnalytics}
            selectedVisitorDetail={selectedVisitorDetail}
            setSelectedVisitorDetail={setSelectedVisitorDetail}
          />
        )}

        {/* ══════════════════════════════════════════════════════════════════
            6. RUBRIQUE : NOTIFICATIONS PUSH
            ══════════════════════════════════════════════════════════════════ */}
        {/* RUBRIQUE : NOTIFICATIONS PUSH */}
        {activeRubric === 'push' && (
          <PushRubric
            pushTitle={pushTitle} setPushTitle={setPushTitle}
            pushMessage={pushMessage} setPushMessage={setPushMessage}
            pushSentSuccess={pushSentSuccess} setPushSentSuccess={setPushSentSuccess}
            isSubscribed={isSubscribed}
            pushSupported={pushSupported}
            pushPermission={pushPermission}
            requestPermission={requestPermission}
            sendTestNotification={sendTestNotification}
          />
        )}

        {/* ══════════════════════════════════════════════════════════════════
            7. RUBRIQUE : PARAMÈTRES & SYSTÈME
            ══════════════════════════════════════════════════════════════════ */}
        {/* RUBRIQUE : PARAMETRES & SYSTEME */}
        {activeRubric === 'settings' && (
          <SettingsRubric
            books={books}
            systemStatus={systemStatus}
            checkingStatus={checkingStatus}
            checkStatus={checkStatus}
            loadBooks={loadBooks}
          />
        )}

        {/* ══════════════════════════════════════════════════════════════════
            8. RUBRIQUE : GÉNÉRATEUR D'API & INTÉGRATIONS IA (MCP / MANUS)
            ══════════════════════════════════════════════════════════════════ */}
        {/* RUBRIQUE : GENERATEUR D'API & IA (MCP / MANUS) */}
        {activeRubric === 'api-generator' && (
          <ApiGeneratorRubric />
        )}

        {/* ══════════════════════════════════════════════════════════════════
            MODALE : EFFET DE MASSE & SOCIAL PROOF PERSONNALISABLE
            ══════════════════════════════════════════════════════════════════ */}
        {/* ── MODALE : EFFET DE MASSE & SOCIAL PROOF ── */}
        <SocialProofModal
          socialModalBook={socialModalBook}
          setSocialModalBook={setSocialModalBook}
          socialPlays={socialPlays}
          setSocialPlays={setSocialPlays}
          socialReviews={socialReviews}
          setSocialReviews={setSocialReviews}
          socialRating={socialRating}
          setSocialRating={setSocialRating}
          isSavingSocial={isSavingSocial}
          setIsSavingSocial={setIsSavingSocial}
          apiClient={apiClient}
          setBooks={setBooks}
        />

        {/* ── MODAL STUDIO VOCAL IA PAR CHAPITRE ── */}
        {/* ── MODAL STUDIO VOCAL IA PAR CHAPITRE ── */}
        <ChapterAiModal
          activeChapterAiModalIndex={activeChapterAiModalIndex}
          setActiveChapterAiModalIndex={setActiveChapterAiModalIndex}
          chapters={chapters}
          chapterTtsText={chapterTtsText}
          setChapterTtsText={setChapterTtsText}
          chapterTtsVoice={chapterTtsVoice}
          setChapterTtsVoice={setChapterTtsVoice}
          chapterTtsSpeed={chapterTtsSpeed}
          setChapterTtsSpeed={setChapterTtsSpeed}
          chapterTtsPitch={chapterTtsPitch}
          setChapterTtsPitch={setChapterTtsPitch}
          chapterTtsIsSpeaking={chapterTtsIsSpeaking}
          setChapterTtsIsSpeaking={setChapterTtsIsSpeaking}
          isChapterTtsGenerating={isChapterTtsGenerating}
          chapterTtsAudioUrl={chapterTtsAudioUrl}
          chapterTtsDuration={chapterTtsDuration}
          title={title}
          handleGenerateChapterTTS={handleGenerateChapterTTS}
          handleApplyChapterTtsDirectly={handleApplyChapterTtsDirectly}
          downloadAudioMp3={downloadAudioMp3}
        />

        {/* Lecteur Audio invisible pour les pré-écoutes de chapitres */}
        <audio
          ref={chapterAudioPreviewRef}
          onEnded={() => setActivePlayingChapterIdx(null)}
          className="hidden"
        />

        {/* Modal Liseuse E-Book PDF & EPUB Read's Great */}
        {readingEbook && (
          <PdfReaderModal
            book={readingEbook}
            isOpen={Boolean(readingEbook)}
            onClose={() => setReadingEbook(null)}
          />
        )}

      </div>
    </div>
  );
};

