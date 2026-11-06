import React, { useState, useEffect } from 'react';
import { Sparkles, Headphones, X } from 'lucide-react';
import { apiClient } from '../services/api';
import { AudiobookCard } from '../components/AudiobookCard';
import { useAudio } from '../context/AudioContext';
import { useXp } from '../context/XpContext';
import { GlassHeroSection } from './discover/GlassHeroSection';
import { GlassSourcedFromNature } from './discover/GlassSourcedFromNature';
import { GlassFeaturesRow } from './discover/GlassFeaturesRow';
import { GlassVitaminsSection } from './discover/GlassVitaminsSection';

/**
 * DiscoverView — Vue Découverte 100% Conforme au Modèle Glassmorphism Axolotl
 * ─────────────────────────────────────────────────────────────────────────────
 * Architecture :
 * 1. Hero Vitrine avec Titre Grand Format, Jaquette 3D & 3 Badges Verticaux
 * 2. Panneau Panoramique 5 Univers ("SOURCED FROM NATURE")
 * 3. Grille de Livres en Verre Dépoli
 * 4. Rangée des 3 Piliers de Verre Verticaux
 * 5. Bloc Panoramique Split ("ESSENTIAL VITAMINS") & Ticker d'Engagements
 */

export const DiscoverView = ({ onSelectBook, onBuyBook, searchQuery }) => {
  const [activeFilter, setActiveFilter] = useState('all');
  const [audiobooks, setAudiobooks] = useState(() => {
    try {
      const cached = localStorage.getItem('rg_cached_books');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [];
  });
  const [localSearch, setLocalSearch] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  const { playBook } = useAudio();
  const { points, unlockBookWithPoints } = useXp();

  // Bibliothèque locale
  const [purchasedIds, setPurchasedIds] = useState(() => {
    try {
      const lib = JSON.parse(localStorage.getItem('rg_user_library') || '[]');
      return new Set(lib.map(b => b.id));
    } catch { return new Set(); }
  });

  const showToast = (msg, duration = 3500) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), duration);
  };

  const loadData = async () => {
    try {
      const books = await apiClient.getAudiobooks({ category: 'all' });
      if (Array.isArray(books) && books.length > 0) setAudiobooks(books);
    } catch (e) {
      console.error('[DiscoverView] Erreur chargement:', e);
    }
  };

  useEffect(() => {
    loadData();
    const handleSyncPurchases = () => {
      try {
        const lib = JSON.parse(localStorage.getItem('rg_user_library') || '[]');
        setPurchasedIds(new Set(lib.map(b => b.id)));
      } catch {}
    };

    const handleBookRated = (e) => {
      const { bookId, newAvg, newCount } = e.detail || {};
      if (bookId && newAvg) {
        setAudiobooks(prev => prev.map(b => b.id === bookId ? {
          ...b,
          rating: newAvg,
          rating_count: newCount || b.rating_count,
          display_rating: newAvg,
          display_reviews_count: newCount || b.display_reviews_count
        } : b));
      }
    };

    window.addEventListener('rg:book-purchased', handleSyncPurchases);
    window.addEventListener('rg:book-rated', handleBookRated);
    return () => {
      window.removeEventListener('rg:book-purchased', handleSyncPurchases);
      window.removeEventListener('rg:book-rated', handleBookRated);
    };
  }, []);

  const isPureAudio = (b) => {
    if (!b) return false;
    if (b.content_type === 'ebook' || b.format === 'pdf' || b.format === 'epub') return false;
    if (b.format === 'audio' || b.format === 'audiobook' || b.content_type === 'audiobook') return true;
    if (b.content_type === 'podcast' || b.content_type === 'music' || b.content_type === 'masterclass') return true;
    if ((Array.isArray(b.chapters) && b.chapters.length > 0) || b.audio_url || b.preview_url) return true;
    return false;
  };

  const audioOnlyCatalog = audiobooks.filter(isPureAudio);

  // Filtrage
  const filteredBooks = audioOnlyCatalog.filter((b) => {
    const q = (searchQuery || localSearch).toLowerCase().trim();
    if (q) {
      const match =
        (b.title && b.title.toLowerCase().includes(q)) ||
        (b.author && b.author.toLowerCase().includes(q)) ||
        (b.description && b.description.toLowerCase().includes(q));
      if (!match) return false;
    }

    if (activeFilter === 'all') return true;
    if (activeFilter === 'audiobook') return b.content_type === 'audiobook' || b.format === 'audiobook';
    if (activeFilter === 'ebook') return b.content_type === 'ebook' || b.is_ebook || b.pdf_url;
    if (activeFilter === 'podcast') return b.content_type === 'podcast' || b.category?.toLowerCase().includes('podcast');
    if (activeFilter === 'masterclass') return b.content_type === 'masterclass' || b.category?.toLowerCase().includes('masterclass');
    if (activeFilter === 'conference') return b.content_type === 'conference' || b.category?.toLowerCase().includes('conference');
    return true;
  });

  const featuredList = audioOnlyCatalog.filter(b => b.is_featured || b.is_pinned || b.badge === 'VEDETTE' || b.badge === 'À LA UNE');
  const currentFeatured = featuredList[0] || audioOnlyCatalog[0] || null;

  const handlePlayOrUnlockAudio = async (book) => {
    if (!book) return;
    const isPurchased = purchasedIds.has(book.id);
    const isTrulyFree = (book.price === 0 || !book.price) && !(Number(book.unlock_points) > 0);

    if (isPurchased || isTrulyFree || book.is_free_for_members) {
      playBook(book, 0, 0);
      return;
    }

    const cost = Number(book.unlock_points) > 0 ? Number(book.unlock_points) : 100;
    if (points >= cost) {
      try {
        const res = await unlockBookWithPoints(book, cost);
        if (res.success) {
          apiClient._addToLocalLibrary(book);
          setPurchasedIds(prev => new Set([...prev, book.id]));
          window.dispatchEvent(new CustomEvent('rg:book-purchased', { detail: { book } }));
          showToast(`🎉 "${book.title}" débloqué (-${cost} pts) !`);
          playBook(book, 0, 0);
          return;
        }
      } catch (err) {
        console.error('Erreur débit points:', err);
      }
    }

    showToast(`⚠️ Solde insuffisant (${points}/${cost} pts). Regardez une courte vidéo pour gagner des points !`, 4500);
    onSelectBook(book, { forceAudio: true });
  };

  const handleOpenDetails = (book) => {
    onSelectBook(book, { forceAudio: true });
  };

  return (
    <div className="relative space-y-8 sm:space-y-12 pb-56 sm:pb-64 animate-fadeIn select-none text-left max-w-7xl mx-auto">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full glass-panel border border-emerald-400/60 text-white font-bold text-xs sm:text-sm shadow-2xl backdrop-blur-2xl animate-slideDown flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-emerald-300 animate-spin" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── 1. VITRINE HÉROÏQUE STYLE AXOLOTL ── */}
      {activeFilter === 'all' && !searchQuery && !localSearch && currentFeatured && (
        <GlassHeroSection
          book={currentFeatured}
          onPlay={handlePlayOrUnlockAudio}
          onDetails={handleOpenDetails}
        />
      )}

      {/* ── 2. BLOC PANORAMIQUE 5 FORMATS ("SOURCED FROM NATURE") ── */}
      <GlassSourcedFromNature
        activeFilter={activeFilter}
        onSelectFilter={(id) => setActiveFilter(id)}
      />

      {/* ── 3. GRILLE DE LIVRES EN VERRE DÉPOLI ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider font-['Outfit']">
              {activeFilter === 'all' ? 'Sélection Recommandée' : 'Résultats de Sélection'}
            </h3>
            <span className="glass-pill px-3 py-1 rounded-full text-[10px] font-black text-emerald-300 uppercase tracking-wider">
              {filteredBooks.length} Titres
            </span>
          </div>

          {activeFilter !== 'all' && (
            <button
              onClick={() => setActiveFilter('all')}
              className="text-xs font-bold text-emerald-300 hover:text-white flex items-center gap-1 cursor-pointer glass-pill px-3 py-1 rounded-full border border-white/15"
            >
              <span>Tout afficher</span>
              <X size={14} />
            </button>
          )}
        </div>

        {filteredBooks.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {filteredBooks.map((book) => (
              <AudiobookCard
                key={`audio-${book.id}`}
                book={book}
                onSelect={handlePlayOrUnlockAudio}
                onViewDetails={handleOpenDetails}
                isPurchased={purchasedIds.has(book.id)}
                layout="square"
              />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center glass-panel p-8 rounded-3xl">
            <Headphones size={36} className="mx-auto text-emerald-300/60 mb-3" />
            <p className="text-sm text-slate-300 font-medium">
              Aucun contenu audio trouvé pour cette sélection.
            </p>
            <button
              onClick={() => setActiveFilter('all')}
              className="mt-4 px-6 py-2.5 rounded-full btn-emerald-pill text-xs font-black uppercase cursor-pointer"
            >
              Afficher tout le catalogue
            </button>
          </div>
        )}
      </section>

      {/* ── 4. LES 3 PILIERS AXOLOTL (NATURAL ENERGY...) ── */}
      {activeFilter === 'all' && (
        <GlassFeaturesRow
          onExplore={() => setActiveFilter('audiobook')}
          onOpenOffline={() => window.location.hash = '#library'}
          onOpenRewards={() => window.dispatchEvent(new Event('rg:open-reward-ad'))}
        />
      )}

      {/* ── 5. BLOC SPLIT & TICKER DE BAS DE PAGE ("ESSENTIAL VITAMINS") ── */}
      {activeFilter === 'all' && (
        <GlassVitaminsSection
          onExploreAuthors={() => window.location.hash = '#library'}
        />
      )}
    </div>
  );
};
