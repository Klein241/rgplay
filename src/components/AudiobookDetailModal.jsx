import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Star, Play, Headphones, CheckCircle2, ShieldCheck,
  Smartphone, Sparkles, Share2, Download, AlertCircle, ChevronDown, ChevronUp, EyeOff, Eye,
  BookOpen, Gift, Lock
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useXp } from '../context/XpContext';
import { downloadAudioMp3, downloadBookForOffline, isAudioOffline, removeOfflineAudio } from '../utils/offlineAudioCache';
import { trackAction } from '../services/tracker';
import { BookChatModal } from './BookChatModal';
import { PdfReaderModal } from './PdfReaderModal';
import { AdBanner } from './AdBanner';
import { apiClient } from '../services/api';

export const AudiobookDetailModal = ({ book, isOpen, onClose, onBuy, isPurchased }) => {
  const { playPreview, playBook, currentBook, isPlaying } = useAudio();
  const { points, unlockBookWithPoints } = useXp();
  const [activeTab, setActiveTab] = useState('synopsis');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isPdfReaderOpen, setIsPdfReaderOpen] = useState(false);
  const [pointsUnlocking, setPointsUnlocking] = useState(false);
  const [pointsError, setPointsError] = useState(null);

  const [userRating, setUserRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [userReviewText, setUserReviewText] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState(null);
  const [reviewsHidden, setReviewsHidden] = useState(false); // admin toggle
  const [downloadProgress, setDownloadProgress] = useState(0);
  const isAudioXpDisabled = typeof window !== 'undefined' && localStorage.getItem('rg_settings_audio_xp_disabled') === 'true';

  // ── État réactif du cache hors-ligne ───────────────────────────────────────
  // IMPORTANT: On utilise un useState + useEffect pour être réactif aux mises
  // à jour du cache. Un simple `isAudioOffline(book.id)` calculé une seule fois
  // ne se mettrait jamais à jour après un téléchargement.
  const [isDownloaded, setIsDownloaded] = useState(() => book ? isAudioOffline(book.id) : false);

  useEffect(() => {
    // Recalculer quand le livre change
    setIsDownloaded(book ? isAudioOffline(book.id) : false);
  }, [book?.id]);

  useEffect(() => {
    // Écouter les mises à jour du cache hors-ligne
    const onCacheUpdate = () => {
      setIsDownloaded(book ? isAudioOffline(book.id) : false);
    };
    window.addEventListener('rg_offline_cache_updated', onCacheUpdate);
    return () => window.removeEventListener('rg_offline_cache_updated', onCacheUpdate);
  }, [book?.id]);

  const handleDownloadOffline = useCallback(async () => {
    if (!book) return;
    setIsDownloading(true);
    setDownloadProgress(0);
    try {
      if (isDownloaded) {
        await removeOfflineAudio(book.id);
        setIsDownloaded(false);
        setDownloadStatus({ type: 'warn', text: 'Retiré du mode hors-ligne' });
      } else {
        await downloadBookForOffline(book, (pct) => setDownloadProgress(pct));
        setIsDownloaded(true);
        setDownloadStatus({ type: 'success', text: '✓ Disponible hors-ligne — Écoutez sans connexion !' });
      }
    } catch (e) {
      console.error('[Offline] Erreur:', e);
      setDownloadStatus({ type: 'error', text: 'Erreur lors du téléchargement. Vérifiez votre connexion.' });
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
      setTimeout(() => setDownloadStatus(null), 4000);
    }
  }, [book, isDownloaded]);

  // ── Téléchargement MP3 physique sur l'appareil ─────────────────────────────
  const handleDownloadMp3 = useCallback(async () => {
    if (!book) return;
    setIsDownloading(true);
    setDownloadStatus(null);
    trackAction('download_mp3', book.id);
    const res = await downloadAudioMp3(book, null, isPurchased);
    if (res === 'ok') {
      setDownloadStatus({ type: 'success', text: '✓ Téléchargement MP3 démarré' });
    } else if (res === 'not_purchased') {
      setDownloadStatus({ type: 'error', text: 'Achetez ce livre pour télécharger le MP3' });
    } else {
      setDownloadStatus({ type: 'warn', text: 'Ouverture du flux audio...' });
    }
    setIsDownloading(false);
    setTimeout(() => setDownloadStatus(null), 4000);
  }, [book, isPurchased]);

  // Admin check
  const isAdmin = (() => {
    try { return localStorage.getItem('rg_admin_logged_in') === 'true'; } catch (_) { return false; }
  })();

  const getStoredReviews = () => {
    if (!book) return [];
    try {
      const stored = localStorage.getItem(`rg_reviews_${book.id}`);
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    return []; // Zéro faux avis par défaut
  };

  const [reviews, setReviews] = useState([]);

  React.useEffect(() => {
    if (book) {
      // Charger les avis réels depuis D1
      apiClient.getBookReviews(book.id).then(d1Reviews => {
        if (Array.isArray(d1Reviews) && d1Reviews.length > 0) {
          setReviews(d1Reviews.map(r => ({
            id: r.id,
            author_name: r.user_name || r.author_name || 'Auditeur RG Play',
            rating: r.rating || 5,
            date: r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR') : (r.date || "Récemment"),
            comment: r.comment || r.text || ''
          })));
        } else {
          setReviews(getStoredReviews());
        }
      });

      setReviewSubmitted(false);
      setUserReviewText('');
      setUserRating(5);
      setActiveTab('synopsis');

      // Inject dynamic OG meta tags for social share preview
      try {
        const ogImage = document.querySelector('meta[property="og:image"]');
        const ogTitle = document.querySelector('meta[property="og:title"]');
        const ogDesc = document.querySelector('meta[property="og:description"]');
        const ogUrl = document.querySelector('meta[property="og:url"]');

        const coverUrl = book.cover_url && !book.cover_url.includes('r2.cloudflarestorage.com')
          ? book.cover_url
          : `https://rg-play.pages.dev/api/r2/download?key=${encodeURIComponent(book.cover_r2_key || '')}`;

        if (ogImage) ogImage.setAttribute('content', coverUrl);
        if (ogTitle) ogTitle.setAttribute('content', `${book.title} — RG Play`);
        if (ogDesc) ogDesc.setAttribute('content', `🎧 Écoutez "${book.title}" par ${book.author}. ${book.description || ''}`);
        if (ogUrl) ogUrl.setAttribute('content', `${window.location.origin}/?book=${book.id}`);
      } catch (_) {}
    }
  }, [book?.id]);

  const handleSubmitReview = async () => {
    if (!userRating || !userReviewText.trim() || !book) return;
    let userName = 'Auditeur RG Play';
    try {
      const p = JSON.parse(localStorage.getItem('rg_user_profile') || '{}');
      if (p.name) userName = p.name;
    } catch (_) {}

    const newRev = {
      id: `rev-${Date.now()}`,
      author_name: userName,
      rating: userRating,
      date: "À l'instant",
      comment: userReviewText.trim(),
    };

    const updated = [newRev, ...reviews];
    setReviews(updated);
    setReviewSubmitted(true);
    setUserReviewText('');

    // Persister dans Cloudflare D1
    await apiClient.addBookReview(book.id, {
      rating: userRating,
      comment: newRev.comment,
      author: userName,
    });

    window.dispatchEvent(new CustomEvent('rg:book-rated', { detail: { bookId: book.id, rating: userRating } }));
  };

  // NOTE: All handler functions must be declared BEFORE the early return below
  if (!isOpen || !book) return null;

  const fmtCount = (n) => {
    if (!n || n === 0) return null;
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return `${n}`;
  };

  const isCurrentPlaying = currentBook?.id === book.id && isPlaying;
  const formattedDuration = `${Math.floor(book.duration_seconds / 3600)}h ${Math.floor((book.duration_seconds % 3600) / 60)}m`;
  const isEbookItem = Boolean(
    book?.content_type === 'ebook' ||
    book?.content_type === 'epub' ||
    book?.content_type === 'pdf' ||
    book?.format === 'ebook' ||
    book?.format === 'pdf' ||
    book?.format === 'epub' ||
    book?.is_ebook ||
    (typeof book?.pdf_url === 'string' && book.pdf_url.trim().length > 0) ||
    (typeof book?.pdfUrl === 'string' && book.pdfUrl.trim().length > 0)
  );

  const DEFAULT_COVER = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80';
  const coverSrc = !book.cover_url
    ? DEFAULT_COVER
    : book.cover_url.includes('r2.cloudflarestorage.com') && book.cover_r2_key
      ? `/api/r2/download?key=${encodeURIComponent(book.cover_r2_key)}`
      : book.cover_url.includes('r2.cloudflarestorage.com')
        ? DEFAULT_COVER
        : book.cover_url;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="glass-card rounded-3xl w-full max-w-2xl border border-purple-500/25 overflow-hidden shadow-2xl relative">

        {/* Boutons haut droite */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <button
            onClick={async () => {
              const url = `${window.location.origin}/?book=${book.id}`;
              if (navigator.share) {
                try {
                  await navigator.share({
                    title: `${book.title} — RG Play`,
                    text: `🎧 Écoutez "${book.title}" par ${book.author} sur RG Play`,
                    url,
                  });
                } catch (_) {}
              } else {
                navigator.clipboard.writeText(url);
                setShareCopied(true);
                setTimeout(() => setShareCopied(false), 2500);
              }
            }}
            className="p-2 rounded-full bg-black/50 hover:bg-black/80 text-slate-300 hover:text-white transition-all backdrop-blur-md flex items-center gap-1 text-xs"
            title="Partager ce livre audio"
          >
            <Share2 className="w-4 h-4 text-purple-300" />
            {shareCopied && <span className="text-[10px] text-emerald-400 font-bold pr-1">Copié !</span>}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-black/50 hover:bg-black/80 text-slate-300 hover:text-white transition-all backdrop-blur-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Bannière de fond */}
        <div className="relative h-44 sm:h-56 overflow-hidden">
          <img
            src={coverSrc}
            alt={book.title}
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_COVER; }}
            className="w-full h-full object-cover filter blur-xl scale-110 opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#161128] via-[#161128]/75 to-transparent" />

          {/* Header : Cover + Titre */}
          <div className="absolute bottom-4 left-5 right-5 flex items-end gap-4">
            <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 flex-shrink-0">
              <img
                src={coverSrc}
                alt={book.title}
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_COVER; }}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/30">
                {book.category_name || 'Livre Audio'}
              </span>
              <h2 className="text-lg sm:text-2xl font-extrabold text-white mt-1.5 line-clamp-2 leading-tight font-['Outfit']">
                {book.title}
              </h2>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Par <span className="text-purple-300">{book.author}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Métadonnées clés */}
        <div className="px-5 py-3 bg-white/4 border-y border-white/6 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="space-y-0.5">
            <span className="text-[9px] text-slate-400 font-medium block">{isEbookItem ? 'Lecteurs' : 'Lectures'}</span>
            <p className="font-bold text-purple-300 flex items-center justify-center gap-1">
              {isEbookItem ? <BookOpen className="w-3 h-3 text-purple-400" /> : <Headphones className="w-3 h-3 text-purple-400" />}
              {fmtCount(book.display_plays_count) || (book.rating_count ? `${book.rating_count * 8}` : '1.2k')}
            </p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[9px] text-slate-400 font-medium block">{isEbookItem ? 'Pages' : 'Durée'}</span>
            <p className="font-bold text-slate-200">{isEbookItem ? `${book.page_count || 120} p.` : formattedDuration}</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[9px] text-slate-400 font-medium block">Format</span>
            <p className="font-bold text-emerald-400 text-[10px]">{isEbookItem ? 'Livre E-Book & PDF' : 'Audio HD Stéréo'}</p>
          </div>
        </div>


        {/* Corps de la modale — aéré */}
        <div className="px-5 py-5 space-y-5">

          {/* Onglets */}
          <div className="flex gap-5 border-b border-white/10 pb-2">
            {[
              { id: 'synopsis', label: 'Synopsis' },
              ...(!isEbookItem ? [{ id: 'chapters', label: `Chapitres (${book.chapters?.length || 1})` }] : []),
              { id: 'reviews', label: `Avis (${book.display_reviews_count || book.rating_count || reviews.length})`, icon: <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-xs sm:text-sm font-bold pb-2 transition-all border-b-2 flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Synopsis ── */}
          {activeTab === 'synopsis' && (
            <div className="space-y-4">
              <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-3 max-h-48 overflow-y-auto pr-1">
                <p className="font-semibold text-slate-100">{book.description}</p>
                {book.synopsis && (
                  <p className="text-slate-400">{book.synopsis}</p>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-purple-300 pt-1 border-t border-white/6">
                <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Format Audio HD Stéréo • Téléchargeable pour écoute hors-ligne</span>
              </div>
            </div>
          )}

          {/* ── Chapitres ── */}
          {activeTab === 'chapters' && (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {(book.chapters?.length ? book.chapters : [{ id: 'ch0', title: 'Chapitre 1 : Introduction', duration_seconds: 1800 }]).map((chap, idx) => {
                const isFreePreviewChap = idx <= 1;
                const canPlay = isPurchased || book.price === 0 || isFreePreviewChap;

                return (
                  <div
                    key={chap.id || idx}
                    onClick={() => {
                      if (canPlay) {
                        playBook(book, idx, 0);
                        onClose();
                      } else {
                        onBuy(book);
                      }
                    }}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all cursor-pointer ${
                      canPlay
                        ? 'bg-white/6 hover:bg-white/12 border-white/10 hover:border-purple-400/40'
                        : 'bg-white/2 border-white/5 opacity-70 hover:opacity-100 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-6 h-6 rounded-lg font-bold flex items-center justify-center text-[10px] flex-shrink-0 ${
                        isFreePreviewChap && !isPurchased && book.price > 0
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-purple-500/20 text-purple-300'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-slate-200 truncate">{chap.title}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {isFreePreviewChap && !isPurchased && book.price > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[9px] font-extrabold border border-emerald-500/30 whitespace-nowrap">
                          Extrait Gratuit 🎁
                        </span>
                      )}
                      {!canPlay && (
                        <Lock className="w-3.5 h-3.5 text-slate-500" />
                      )}
                      <span className="text-slate-400 text-[11px] font-mono">
                        {Math.floor((chap.duration_seconds || 1800) / 60)} min
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Avis & Notes ── */}
          {activeTab === 'reviews' && (
            <div className="space-y-4">
              {/* Bannière d'information réelle pour l'Admin */}
              {isAdmin && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    Vue Admin : {reviews.length} avis réels • Effet de masse public ({book.display_reviews_count || 0} avis, {book.display_rating || book.rating || 5}★)
                  </span>
                </div>
              )}

              {/* Bouton masquer/afficher avis (admin uniquement) */}
              {isAdmin && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setReviewsHidden(h => !h)}
                    className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all"
                    style={reviewsHidden
                      ? { background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.3)', color: '#fca5a5' }
                      : { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.10)', color: '#94a3b8' }
                    }
                  >
                    {reviewsHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{reviewsHidden ? 'Afficher les commentaires' : 'Masquer les commentaires'}</span>
                  </button>
                </div>
              )}

              {/* Résumé de note (effet de masse — visible du public) */}
              {!reviewsHidden && (
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-amber-500/8 border border-amber-500/20">
                  <div className="text-center shrink-0">
                    <div className="text-4xl font-extrabold text-amber-400 leading-none">
                      {book.display_rating || book.rating || 4.9}
                    </div>
                    <div className="flex items-center justify-center gap-0.5 mt-1">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`w-3 h-3 ${s <= Math.round(book.display_rating || book.rating || 5) ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} />
                      ))}
                    </div>
                    <p className="text-[10px] text-amber-300/70 mt-0.5">
                      {book.display_reviews_count || book.rating_count || 0} avis
                    </p>
                  </div>
                  <div className="flex-1 space-y-1">
                    {[5,4,3,2,1].map(star => {
                      const total = book.display_reviews_count || book.rating_count || 1;
                      const rating = book.display_rating || book.rating || 5;
                      // Distribution réaliste centrée sur la note affichée
                      const pct = star === Math.round(rating) ? 70 : star === Math.round(rating) - 1 ? 18 : star === Math.round(rating) + 1 ? 8 : 2;
                      return (
                        <div key={star} className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 w-2 text-right">{star}</span>
                          <Star className="w-2.5 h-2.5 fill-amber-400/50 text-amber-400/50 shrink-0" />
                          <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-700"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-500 w-5 text-right">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Formulaire de dépôt d'avis */}
              {!reviewsHidden && (

                <div className="p-4 rounded-2xl bg-purple-500/8 border border-purple-500/20 space-y-3">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Donner votre note et votre avis</span>
                  </h4>

                  {/* Étoiles */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">Votre note :</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setUserRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="p-0.5 text-slate-500 hover:scale-125 transition-transform"
                        >
                          <Star className={`w-5 h-5 ${(hoverRating || userRating) >= star ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} />
                        </button>
                      ))}
                    </div>
                    <span className="text-xs font-bold text-amber-300">{userRating}/5</span>
                  </div>

                  {/* Textarea */}
                  <textarea
                    rows={2}
                    value={userReviewText}
                    onChange={(e) => setUserReviewText(e.target.value)}
                    placeholder="Qu'avez-vous pensé de la voix, de la clarté et de l'histoire ?"
                    className="rg-input text-xs py-2.5 resize-none w-full"
                  />

                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-500">Votre avis sera visible par toute la communauté</span>
                    <button
                      onClick={handleSubmitReview}
                      disabled={!userRating || !userReviewText.trim()}
                      className="btn-gradient px-4 py-1.5 rounded-xl text-xs font-bold disabled:opacity-40 cursor-pointer"
                    >
                      {reviewSubmitted ? '✓ Publié !' : 'Publier mon avis'}
                    </button>
                  </div>
                </div>
              )}

              {/* État vide si 0 avis */}
              {!reviewsHidden && reviews.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-white/10 rounded-2xl space-y-2">
                  <Star className="w-6 h-6 mx-auto text-amber-400/50" />
                  <p className="font-semibold text-slate-300">Aucun avis rédigé pour le moment</p>
                  <p className="text-[11px] text-slate-500">Soyez le premier auditeur à partager votre expérience ci-dessus !</p>
                </div>
              )}

              {/* Liste des avis */}
              {!reviewsHidden && reviews.length > 0 && (
                <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                  {reviews.map((rev) => (
                    <div key={rev.id} className="p-3.5 rounded-2xl bg-white/4 border border-white/6 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                            {(rev.author_name || 'U')[0].toUpperCase()}
                          </div>
                          <span className="text-xs font-bold text-white">{rev.author_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star key={s} className={`w-3 h-3 ${s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} />
                            ))}
                            <span className="text-[10px] text-slate-400 ml-1.5">{rev.date}</span>
                          </div>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (window.confirm('Supprimer cet avis ?')) {
                                  setReviews(prev => prev.filter(r => r.id !== rev.id));
                                  await apiClient.deleteReview(rev.id);
                                }
                              }}
                              className="text-rose-400 hover:text-rose-300 p-1 text-xs"
                              title="Supprimer cet avis (Admin)"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              )}

              {reviewsHidden && (
                <div className="py-6 text-center text-xs text-slate-500 border border-dashed border-white/10 rounded-2xl">
                  <EyeOff className="w-5 h-5 mx-auto mb-1.5 text-slate-600" />
                  Les commentaires sont masqués (admin)
                </div>
              )}
            </div>
          )}

          {/* Statut téléchargement */}
          {downloadStatus && (
            <div className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 animate-fadeIn ${
              downloadStatus.type === 'success' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' :
              downloadStatus.type === 'error' ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30' :
              'bg-amber-500/15 text-amber-300 border border-amber-500/30'
            }`}>
              {downloadStatus.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              <span>{downloadStatus.text}</span>
            </div>
          )}

          {/* ── BANNIÈRE SPONSORISÉE FICHE LIVRE ── */}
          <AdBanner
            placement="book_detail"
            onOpenRewardModal={() => window.dispatchEvent(new Event('rg:open-reward-ad'))}
            className="my-2"
          />

          {/* ── Zone Actions ── */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">

              {/* Bouton Extrait Gratuit — réservé aux livres audio (supprimé pour les livres PDF & ebook) */}
              {!isEbookItem && (
                <button
                  onClick={() => { playPreview(book); trackAction('preview_click', book.id); }}
                  className="sm:w-auto px-5 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 border"
                  style={{
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.20) 0%, rgba(5,150,105,0.25) 100%)',
                    borderColor: 'rgba(16,185,129,0.45)',
                    color: '#6ee7b7',
                    boxShadow: '0 0 12px rgba(16,185,129,0.25)',
                    animation: 'rgPulseBadge 2.5s ease-in-out infinite',
                  }}
                >
                  <Headphones className="w-4 h-4" />
                  <span>Extrait Gratuit</span>
                </button>
              )}

              {/* Bouton Agent SKY */}
              <button
                onClick={() => setIsChatOpen(true)}
                className="sm:w-auto px-4 py-3 rounded-2xl bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 hover:from-cyan-500/35 hover:to-indigo-500/35 text-cyan-200 border border-cyan-500/40 font-bold text-xs flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-md shadow-cyan-950/40 cursor-pointer"
                title="Discuter avec l'Agent SKY (Mentor & Tuteur IA)"
              >
                <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span>Agent SKY (Mentor IA)</span>
              </button>

              {/* Téléchargement Hors-Ligne (YouTube Style) & MP3 — UNIQUEMENT pour les livres audio */}
              {!isEbookItem && (
                <div className="flex flex-col gap-1.5 w-full sm:w-auto">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownloadOffline}
                      disabled={isDownloading}
                      className={`flex-1 sm:flex-none px-4 py-3 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        isDownloading
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                          : isDownloaded
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-md hover:bg-emerald-500/30'
                            : 'bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-200 border-indigo-500/30 hover:scale-[1.02]'
                      }`}
                      title={isDownloaded ? 'Cliquez pour supprimer du cache hors-ligne' : 'Télécharger pour écouter sans connexion (comme YouTube)'}
                    >
                      {isDownloading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                          <span>{downloadProgress > 0 ? `${downloadProgress}%` : 'Préparation...'}</span>
                        </>
                      ) : isDownloaded ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          <span>Hors-ligne ✓</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                          <span>Mode Hors-ligne</span>
                        </>
                      )}
                    </button>

                    {(isPurchased || book.price === 0 || book.is_free_for_members) && (
                      <button
                        onClick={handleDownloadMp3}
                        disabled={isDownloading}
                        className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-purple-300 border border-white/10 font-bold text-xs flex items-center justify-center transition-all disabled:opacity-50 cursor-pointer"
                        title="Télécharger le fichier MP3 sur votre appareil"
                      >
                        <Download className="w-4 h-4 text-purple-400" />
                      </button>
                    )}
                  </div>

                  {/* Barre de progression téléchargement hors-ligne */}
                  {isDownloading && downloadProgress > 0 && (
                    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                        style={{ width: `${downloadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Bouton E-Book Compagnon Read's Great — si audio */}
              {!isEbookItem && (book.companion_ebook_id || book.companion_ebook || (book.pdf_url && book.pdf_url.length > 0)) && (
                <button
                  onClick={() => setIsPdfReaderOpen(true)}
                  className="sm:w-auto px-4 py-3 rounded-2xl bg-gradient-to-r from-purple-600/20 to-pink-600/20 hover:from-purple-600/35 hover:to-pink-600/35 text-purple-200 border border-purple-500/40 font-bold text-xs flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-md shadow-purple-950/40 cursor-pointer"
                  title="Ouvrir la version livre numérique E-Book & PDF Read's Great"
                >
                  <BookOpen className="w-4 h-4 text-purple-400" />
                  <span>Lire l’E-Book Compagnon 📖</span>
                </button>
              )}

              {/* Bouton principal Écouter / Lire / Acheter / Débloquer par Points */}
              {(isPurchased || book.price === 0 || book.is_free_for_members) ? (
                isEbookItem ? (
                  <button
                    onClick={() => setIsPdfReaderOpen(true)}
                    className="flex-1 btn-gradient py-3 px-6 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold shadow-lg cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4 text-white" />
                    <span>{book.price === 0 ? 'Lire Gratuitement 📖' : 'Lire le Livre Numérique 📖'}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => { playBook(book, 0, 0); trackAction('play_full', book.id); onClose(); }}
                    className="flex-1 btn-gradient py-3 px-6 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold shadow-lg"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>{book.price === 0 ? 'Écouter Gratuitement' : 'Écouter le Livre Complet'}</span>
                  </button>
                )
              ) : (
                <div className="flex-1 flex flex-col sm:flex-row gap-2">
                  {/* ── PAIEMENT RÉEL — Mobile Money (FCFA) ── */}
                  <button
                    onClick={() => { trackAction('buy_click', book.id); onBuy(book); }}
                    className="flex-1 btn-gradient py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 text-xs sm:text-sm font-bold shadow-xl shadow-purple-600/30"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>
                      {(book.discount_price || book.price || 1500).toLocaleString('fr-FR')} FCFA
                      <span className="block text-[10px] font-normal opacity-80">Payer par Mobile Money</span>
                    </span>
                  </button>

                  {/* ── POINTS DE FIDÉLITÉ — Option secondaire (clairement séparée) ── */}
                  {(isEbookItem || !isAudioXpDisabled) && (
                    <button
                      onClick={async () => {
                        setPointsUnlocking(true);
                        setPointsError(null);
                        const cost = Number(book.unlock_points) || 100;
                        const res = await unlockBookWithPoints(book, cost);
                        if (!res.success) {
                          setPointsError(res.message);
                        }
                        setPointsUnlocking(false);
                      }}
                      disabled={pointsUnlocking}
                      className="px-4 py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/35 hover:to-orange-500/35 text-amber-300 border border-amber-500/40 hover:scale-[1.02] transition-all cursor-pointer whitespace-nowrap"
                      title={`Débloquer avec vos points de fidélité (Solde : ${points} pts)`}
                    >
                      <Gift className="w-3.5 h-3.5" />
                      <span>
                        {Number(book.unlock_points) || 100} pts ⭐
                        <span className="block text-[9px] font-normal opacity-70">Fidélité ({points} dispo)</span>
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Message d'erreur de solde de points */}
            {pointsError && (
              <div className="px-3 py-2 rounded-xl text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{pointsError}</span>
              </div>
            )}

            {/* Mentions paiement sécurisé */}
            <div className="flex items-center justify-center gap-4 text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Paiement 100% sécurisé
              </span>
              <span>•</span>
              <span>Orange Money / MTN MoMo{!isAudioXpDisabled ? ' / Points ⭐' : ''}</span>
            </div>
          </div>
        </div>
      </div>

      <BookChatModal
        book={book}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />

      {/* Liseuse E-Book / PDF Read's Great */}
      <PdfReaderModal
        book={book}
        isOpen={isPdfReaderOpen}
        onClose={() => setIsPdfReaderOpen(false)}
      />
    </div>
  );
};
