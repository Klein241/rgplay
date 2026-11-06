import { useState, useEffect, useRef } from 'react';
import { useAudio } from '../../context/AudioContext';
import { shareAudioWithCover } from '../../utils/shareUtils';
import { trackAction } from '../../services/tracker';
import { downloadBookForOffline, getOfflineBooks, downloadAudioMp3 } from '../../utils/offlineAudioCache';
import { useXp } from '../../context/XpContext';
import { incrementBookDownloads, fetchBookReviews, rateAudiobook } from '../../services/api/audioApi';

export const DEFAULT_COVER = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80';

export function useAudiobookCardLogic({ book, onSelect, isPurchased = false, onViewDetails }) {
  const { currentBook, isPlaying } = useAudio();
  const { points = 0, unlockBookWithPoints } = useXp();
  const [copied, setCopied] = useState(false);
  const [unlockedLocally, setUnlockedLocally] = useState(false);
  const [pointsWarning, setPointsWarning] = useState(null);

  // État Favoris (persistant localStorage & synchronisé)
  const [isFavorite, setIsFavorite] = useState(() => {
    try {
      const favs = JSON.parse(localStorage.getItem('rg_favorite_book_ids') || '[]');
      return favs.includes(book?.id);
    } catch (_) {
      return false;
    }
  });

  // État Téléchargement Hors-ligne (IndexedDB & Cache API)
  const [isOffline, setIsOffline] = useState(() => {
    try {
      const list = getOfflineBooks();
      return list.some(b => b.id === book?.id);
    } catch (_) {
      return false;
    }
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState(false);

  useEffect(() => {
    if (!book?.id) return;
    const handleFavChange = () => {
      try {
        const favs = JSON.parse(localStorage.getItem('rg_favorite_book_ids') || '[]');
        setIsFavorite(favs.includes(book.id));
      } catch (_) {}
    };
    const handleOfflineChange = () => {
      try {
        const list = getOfflineBooks();
        setIsOffline(list.some(b => b.id === book.id));
      } catch (_) {}
    };

    window.addEventListener('rg:favorite-toggled', handleFavChange);
    window.addEventListener('rg_offline_cache_updated', handleOfflineChange);
    return () => {
      window.removeEventListener('rg:favorite-toggled', handleFavChange);
      window.removeEventListener('rg_offline_cache_updated', handleOfflineChange);
    };
  }, [book?.id]);

  const handleToggleFavorite = (e) => {
    e?.stopPropagation();
    if (!book?.id) return;
    try {
      const favs = JSON.parse(localStorage.getItem('rg_favorite_book_ids') || '[]');
      const next = favs.includes(book.id) ? favs.filter(id => id !== book.id) : [...favs, book.id];
      localStorage.setItem('rg_favorite_book_ids', JSON.stringify(next));
      setIsFavorite(next.includes(book.id));
      window.dispatchEvent(new CustomEvent('rg:favorite-toggled', { detail: { bookId: book.id, isFavorite: next.includes(book.id) } }));
      window.dispatchEvent(new CustomEvent('rg:library-updated'));
    } catch (_) {}
  };

  // Droits d'accès
  const isAlreadyOwned = Boolean(
    isPurchased ||
    unlockedLocally ||
    (() => {
      try {
        const lib = JSON.parse(localStorage.getItem('rg_user_library') || '[]');
        return lib.some(b => b.id === book?.id);
      } catch (_) {
        return false;
      }
    })()
  );

  const isTrulyFree = (book?.price === 0 || !book?.price) && !(Number(book?.unlock_points) > 0);
  const isAccessible = Boolean(isAlreadyOwned || isTrulyFree || book?.is_free_for_members === 1 || book?.is_free_for_members === true);

  // Téléchargements D1 & compteur
  const [localDownloads, setLocalDownloads] = useState(() => {
    if (!book?.id) return 0;
    const savedDl = Number(localStorage.getItem(`rg_book_downloads_${book.id}`)) || 0;
    const propVal = Number(book.downloads_count || book.downloads || book.display_plays_count || 0);
    const val = Math.max(savedDl, propVal);
    if (val > 0) return val;
    const seed = book.id ? Math.abs(book.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) : 120;
    return (seed % 350) + 48;
  });

  useEffect(() => {
    if (!book?.id) return;
    const savedDl = Number(localStorage.getItem(`rg_book_downloads_${book.id}`)) || 0;
    const propVal = Number(book.downloads_count || book.downloads || book.display_plays_count || 0);
    const resolved = Math.max(savedDl, propVal);
    if (resolved > 0) setLocalDownloads(prev => Math.max(prev, resolved));
  }, [book?.id, book?.downloads_count, book?.downloads, book?.display_plays_count]);

  useEffect(() => {
    if (!book?.id) return;
    const handleDlInc = (e) => {
      if (e.detail?.bookId === book.id && e.detail.downloadsCount) {
        setLocalDownloads(e.detail.downloadsCount);
        try { localStorage.setItem(`rg_book_downloads_${book.id}`, String(e.detail.downloadsCount)); } catch (_) {}
      }
    };
    window.addEventListener('rg:book-download-incremented', handleDlInc);
    return () => window.removeEventListener('rg:book-download-incremented', handleDlInc);
  }, [book?.id]);

  const downloadsCount = localDownloads >= 1000 ? `${(localDownloads / 1000).toFixed(1)}k` : localDownloads;

  const handleDownloadOffline = async (e) => {
    e?.stopPropagation();
    if (isDownloading || isOffline || !book?.id) return;

    if (!isAccessible) {
      const cost = Number(book.unlock_points) > 0 ? Number(book.unlock_points) : 100;
      if (points < cost) {
        setPointsWarning(`Solde ${points}/${cost} pts`);
        setTimeout(() => setPointsWarning(null), 3500);
        if (onViewDetails) onViewDetails(book);
        else if (onSelect) onSelect(book);
        return;
      }
      setIsDownloading(true);
      setDownloadProgress(2);
      try {
        const unlockRes = await unlockBookWithPoints(book, cost);
        if (!unlockRes?.success) {
          setPointsWarning(unlockRes?.message || 'Erreur points');
          setTimeout(() => setPointsWarning(null), 3500);
          setIsDownloading(false);
          setDownloadProgress(0);
          return;
        }
        setUnlockedLocally(true);
      } catch (err) {
        setDownloadError(true);
        setIsDownloading(false);
        setDownloadProgress(0);
        setTimeout(() => setDownloadError(false), 4000);
        return;
      }
    }

    setIsDownloading(true);
    setDownloadError(false);
    setDownloadProgress(5);
    try {
      await downloadBookForOffline(book, (pct) => setDownloadProgress(Math.max(5, pct)));
      setIsOffline(true);
      const incRes = await incrementBookDownloads(book.id);
      const nextCount = incRes?.downloads_count || incRes?.display_plays_count || (localDownloads + 1);
      setLocalDownloads(nextCount);
      try { localStorage.setItem(`rg_book_downloads_${book.id}`, String(nextCount)); } catch (_) {}
      window.dispatchEvent(new CustomEvent('rg:book-download-incremented', { detail: { bookId: book.id, downloadsCount: nextCount } }));
      trackAction('download_offline', book.id);
    } catch (err) {
      setDownloadError(true);
      setTimeout(() => setDownloadError(false), 4000);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const handleDirectDownloadMp3 = (e) => {
    e?.stopPropagation();
    if (!book?.id) return;
    incrementBookDownloads(book.id).then(res => {
      const next = res?.downloads_count || res?.display_plays_count;
      if (next) {
        setLocalDownloads(next);
        try { localStorage.setItem(`rg_book_downloads_${book.id}`, String(next)); } catch (_) {}
        window.dispatchEvent(new CustomEvent('rg:book-download-incremented', { detail: { bookId: book.id, downloadsCount: next } }));
      }
    }).catch(() => {});
    downloadAudioMp3(book, null, true);
  };

  // Notation
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const ratingRef = useRef(null);

  const [userRating, setUserRating] = useState(() => {
    try { return Number(localStorage.getItem(`rg_rated_${book?.id}`)) || null; } catch { return null; }
  });
  const [myRatingFeedback, setMyRatingFeedback] = useState(null);
  const [currentRating, setCurrentRating] = useState(() => {
    const savedAvg = Number(localStorage.getItem(`rg_rating_avg_${book?.id}`));
    const r = Number(book?.rating || book?.display_rating);
    const resolved = savedAvg > 0 ? savedAvg : (r > 0 ? r : 5.0);
    return Math.min(5.0, Math.max(1.0, resolved));
  });
  const [currentReviews, setCurrentReviews] = useState(() => {
    const savedCount = Number(localStorage.getItem(`rg_rating_count_${book?.id}`));
    const c = Number(book?.rating_count || book?.display_reviews_count);
    return Math.max(savedCount || 0, c > 0 ? c : 0);
  });

  useEffect(() => {
    if (!book?.id) return;
    const savedAvg = Number(localStorage.getItem(`rg_rating_avg_${book.id}`));
    const r = Number(book.rating || book.display_rating);
    if (savedAvg > 0) setCurrentRating(Math.min(5.0, Math.max(1.0, savedAvg)));
    else if (r > 0) setCurrentRating(Math.min(5.0, Math.max(1.0, r)));

    const savedCount = Number(localStorage.getItem(`rg_rating_count_${book.id}`));
    const c = Number(book.rating_count || book.display_reviews_count);
    setCurrentReviews(prev => Math.max(prev, Math.max(savedCount || 0, c > 0 ? c : 0)));

    try {
      const saved = Number(localStorage.getItem(`rg_rated_${book.id}`));
      if (saved) setUserRating(saved);
    } catch (_) {}
  }, [book?.id, book?.rating, book?.display_rating, book?.rating_count, book?.display_reviews_count]);

  useEffect(() => {
    if (!isRatingOpen) return;
    const handleClickOutside = (e) => {
      if (ratingRef.current && !ratingRef.current.contains(e.target)) setIsRatingOpen(false);
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [isRatingOpen]);

  useEffect(() => {
    if (!book?.id) return;
    const handleRated = (e) => {
      if (e.detail?.bookId === book.id) {
        if (e.detail.rating) setUserRating(e.detail.rating);
        if (e.detail.newAvg) setCurrentRating(Math.min(5.0, Math.max(1.0, Number(e.detail.newAvg))));
        if (e.detail.newCount) setCurrentReviews(prev => Math.max(prev, Number(e.detail.newCount)));
      }
    };
    window.addEventListener('rg:book-rated', handleRated);
    return () => window.removeEventListener('rg:book-rated', handleRated);
  }, [book?.id]);

  useEffect(() => {
    if (!book?.id) return;
    fetchBookReviews(book.id).then(res => {
      if (res?.success) {
        if (res.userRating) {
          setUserRating(res.userRating);
          try { localStorage.setItem(`rg_rated_${book.id}`, String(res.userRating)); } catch (_) {}
        }
        if (res.averageRating) {
          const finalAvg = Math.min(5.0, Math.max(1.0, Number(res.averageRating)));
          setCurrentRating(finalAvg);
          try { localStorage.setItem(`rg_rating_avg_${book.id}`, String(finalAvg)); } catch (_) {}
        }
        if (typeof res.totalReviews === 'number') {
          setCurrentReviews(res.totalReviews);
          try { localStorage.setItem(`rg_rating_count_${book.id}`, String(res.totalReviews)); } catch (_) {}
        }
      }
    }).catch(() => {});
  }, [book?.id]);

  const handleApplyRating = (value) => {
    if (!book?.id) return;
    const isFirstRating = !userRating;
    const nextReviews = isFirstRating ? currentReviews + 1 : currentReviews;
    const nextAvg = isFirstRating
      ? ((currentRating * currentReviews) + value) / nextReviews
      : ((currentRating * currentReviews) - (userRating || currentRating) + value) / (currentReviews || 1);

    setUserRating(value);
    setIsRatingOpen(false);
    setCurrentRating(nextAvg);
    setCurrentReviews(nextReviews);
    setMyRatingFeedback(`✓ Noté ${value}/5 !`);
    setTimeout(() => setMyRatingFeedback(null), 3000);

    try {
      localStorage.setItem(`rg_rated_${book.id}`, String(value));
      localStorage.setItem(`rg_rating_avg_${book.id}`, String(nextAvg));
      localStorage.setItem(`rg_rating_count_${book.id}`, String(nextReviews));
    } catch (_) {}

    window.dispatchEvent(new CustomEvent('rg:book-rated', {
      detail: { bookId: book.id, rating: value, newAvg: nextAvg, newCount: nextReviews }
    }));

    if (isFirstRating) {
      window.dispatchEvent(new CustomEvent('rg:award-points', {
        detail: { points: 10, xp: 20, description: `⭐ Avis enregistré : ${value}/5 (+10 pts)` }
      }));
    }

    rateAudiobook(book.id, value).catch(() => {});
  };

  const ratingValue = currentRating.toFixed(1);
  const reviewsCount = currentReviews;
  const isCurrentPlaying = currentBook?.id === book?.id && isPlaying;

  const isAudiobook = Boolean(
    book?.format === 'audio' ||
    book?.format === 'audiobook' ||
    book?.content_type === 'audiobook' ||
    book?.content_type === 'podcast' ||
    book?.content_type === 'music' ||
    book?.content_type === 'masterclass' ||
    (Array.isArray(book?.chapters) && book.chapters.length > 0) ||
    book?.audio_url ||
    book?.preview_url
  );

  const isPureEbook = !isAudiobook && Boolean(
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

  const handleQuickPlay = (e) => {
    e?.stopPropagation();
    if (isPureEbook) {
      if (onViewDetails) onViewDetails(book);
      else if (onSelect) onSelect(book);
      return;
    }
    if (onSelect) onSelect(book);
    if (book?.id) trackAction('preview_click', book.id);
  };

  const handleShare = async (e) => {
    e?.stopPropagation();
    if (!book) return;
    const res = await shareAudioWithCover(book);
    if (res?.method === 'clipboard') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrewarm = () => {
    if (isPureEbook || !book) return;
    const audioUrl = book.chapters?.[0]?.audio_url || book.preview_url;
    if (audioUrl && !audioUrl.startsWith('blob:') && typeof document !== 'undefined') {
      try {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'fetch';
        link.href = audioUrl;
        document.head.appendChild(link);
      } catch (_) {}
    }
  };

  const coverSrc = !book?.cover_url
    ? DEFAULT_COVER
    : book.cover_url.includes('r2.cloudflarestorage.com') && book.cover_r2_key
      ? `/api/r2/download?key=${encodeURIComponent(book.cover_r2_key)}`
      : book.cover_url.includes('r2.cloudflarestorage.com')
        ? DEFAULT_COVER
        : book.cover_url;

  return {
    isFavorite,
    handleToggleFavorite,
    isOffline,
    isDownloading,
    downloadProgress,
    downloadError,
    pointsWarning,
    handleDownloadOffline,
    handleDirectDownloadMp3,
    downloadsCount,
    isRatingOpen,
    setIsRatingOpen,
    hoverRating,
    setHoverRating,
    userRating,
    myRatingFeedback,
    ratingValue,
    reviewsCount,
    handleApplyRating,
    ratingRef,
    isCurrentPlaying,
    isAudiobook,
    isPureEbook,
    handleQuickPlay,
    handleShare,
    copied,
    handlePrewarm,
    coverSrc,
    isAccessible,
    isTrulyFree,
  };
}
