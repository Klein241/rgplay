import React, { useState, useEffect } from 'react';
import { 
  Music, ChevronRight, Headphones, Heart, BookOpen, User, Play, Sparkles,
  Search, Bookmark, CheckCircle2, Flame, ArrowRight, Eye, ShieldCheck, Gift,
  FileText, Download, WifiOff, Wifi, Trash2
} from 'lucide-react';
import { apiClient } from '../services/api';
import { AudiobookCard } from '../components/AudiobookCard';
import { AdBanner } from '../components/AdBanner';
import { useAudio } from '../context/AudioContext';
import { useXp } from '../context/XpContext';
import { getOfflineBooks, removeOfflineAudio } from '../utils/offlineAudioCache';

const SUB_TABS = [
  { id: 'ebooks', label: '📖 Catalogue PDF' },
  { id: 'offline', label: '💾 Hors-ligne' },
  { id: 'favorites', label: '❤️ Favoris' },
  { id: 'authors', label: '✍️ Auteurs' },
  { id: 'purchases', label: '✓ Débloqués' },
];

export const LibraryView = ({ onSelectBook, onGoToDiscover }) => {
  const [activeSubTab, setActiveSubTab] = useState('ebooks');
  const [libraryBooks, setLibraryBooks] = useState([]);
  const [allCatalog, setAllCatalog] = useState([]);
  const [offlineBooks, setOfflineBooks] = useState(() => getOfflineBooks());
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteIds, setFavoriteIds] = useState(() => {
    try {
      const saved = localStorage.getItem('rg_favorite_book_ids');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [];
  });
  const [selectedEbook, setSelectedEbook] = useState(null);
  const [selectedAuthor, setSelectedAuthor] = useState(null);

  const { playBook, currentBook, isPlaying } = useAudio();
  const { readingMinutes, listeningMinutes, points } = useXp();

  const loadData = async () => {
    try {
      const [lib, catalog] = await Promise.all([
        apiClient.getLibrary(),
        apiClient.getAudiobooks({ category: 'all' }),
      ]);
      setLibraryBooks(Array.isArray(lib) ? lib : []);
      setAllCatalog(Array.isArray(catalog) ? catalog : []);
      setOfflineBooks(getOfflineBooks());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
    const handleOfflineUpdate = () => setOfflineBooks(getOfflineBooks());
    window.addEventListener('rg:library-updated', loadData);
    window.addEventListener('rg:book-deleted', loadData);
    window.addEventListener('rg_offline_cache_updated', handleOfflineUpdate);
    return () => {
      window.removeEventListener('rg:library-updated', loadData);
      window.removeEventListener('rg:book-deleted', loadData);
      window.removeEventListener('rg_offline_cache_updated', handleOfflineUpdate);
    };
  }, []);

  const toggleFavorite = (bookId, e) => {
    if (e) e.stopPropagation();
    setFavoriteIds(prev => {
      const updated = prev.includes(bookId)
        ? prev.filter(id => id !== bookId)
        : [...prev, bookId];
      try {
        localStorage.setItem('rg_favorite_book_ids', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  // 1. Filtrage exclusif des livres PDF & E-Books uploadés par l'admin
  const sourceBooks = allCatalog.length > 0 ? allCatalog : libraryBooks;
  
  // Uniquement les livres publiés par l'admin avec un fichier PDF/EPUB réel (publiés via "Publier E-Book" ou "Import en masse")
  const ebookBooks = sourceBooks.filter((b) => {
    const isEbook = (
      b.content_type === 'ebook' ||
      b.content_type === 'epub' ||
      (typeof b.pdf_url === 'string' && b.pdf_url.trim().length > 0)
    );
    if (!isEbook) return false;

    // Filtre de recherche textuelle
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const match =
        (b.title && b.title.toLowerCase().includes(q)) ||
        (b.author && b.author.toLowerCase().includes(q)) ||
        (b.category_name && b.category_name.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  // 2. Favoris
  const favoriteBooks = ebookBooks.filter(b => favoriteIds.includes(b.id));
  const displayFavorites = favoriteBooks.length > 0 ? favoriteBooks : ebookBooks.slice(0, 6);

  // 3. Auteurs
  const authorsMap = ebookBooks.reduce((acc, book) => {
    const authorName = (book.author || 'Éditions Read\'s Great').trim();
    if (!acc[authorName]) {
      acc[authorName] = {
        name: authorName,
        books: [],
        avatar: book.cover_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=200&q=60'
      };
    }
    acc[authorName].books.push(book);
    return acc;
  }, {});
  const authorsList = Object.values(authorsMap);

  // 4. Achats & Débloqués avec des points (100 Pts)
  const purchasedDisplay = libraryBooks.length > 0 ? libraryBooks : ebookBooks.slice(0, 4);

  return (
    <div className="space-y-6 pb-36 sm:pb-40 animate-fadeIn select-none">
      
      {/* ── EN-TÊTE BIBLIOTHÈQUE ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Bibliothèque Numérique Read's Great
            </span>
            {/* Solde de points — clairement étiqueté comme monnaie de fidélité */}
            <span className="text-xs text-amber-400 font-bold flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
              <Sparkles className="w-3 h-3" /> {points} pts fidélité
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-widest text-white uppercase font-heading mt-1">
            E-Books & PDF Numériques
          </h1>
          <p className="text-[11px] text-[#a78bfa]">
            Livres PDF &amp; EPUB publiés par Read's Great • Achat Mobile Money ou points de fidélité
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
            {readingMinutes || 0} min lues 📖
          </span>
          {/* Bouton pub — récompense réelle = 3 pts (pas 25) */}
          <button
            onClick={() => window.dispatchEvent(new Event('rg:open-reward-ad'))}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Gift className="w-3.5 h-3.5" />
            <span>+3 pts pub</span>
          </button>
        </div>
      </div>

      {/* Barre de recherche dans les E-Books */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher un e-book, livre PDF, auteur..."
          className="w-full bg-[#1b0d33]/80 border border-purple-500/30 rounded-2xl px-4 py-3 pl-11 text-xs sm:text-sm text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 shadow-xl"
        />
        <Search className="w-4.5 h-4.5 text-purple-400 absolute left-3.5 top-3.5" />
      </div>

      {/* ── BANNIÈRE SPONSORISÉE HAUT DE BIBLIOTHÈQUE ── */}
      <AdBanner
        placement="library_top"
        onOpenRewardModal={() => window.dispatchEvent(new Event('rg:open-reward-ad'))}
        className="my-1"
      />

      {/* ── SOUS-ONGLETS DE FILTRES FLUIDES (@iSalmanArt) ── */}
      <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar border-b border-purple-500/20 pb-3 px-1">
        {SUB_TABS.map((tab) => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`whitespace-nowrap px-4 py-2 rounded-2xl text-xs sm:text-sm tracking-wider uppercase font-heading font-extrabold transition-all cursor-pointer flex-shrink-0 flex items-center gap-1.5 border ${
                isActive
                  ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 text-white border-purple-400/80 shadow-lg shadow-purple-600/40 scale-105'
                  : 'bg-white/5 hover:bg-white/10 text-[#8b75b2] hover:text-white border-white/10'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          1. ONGLET : CATALOGUE PDF & E-BOOKS (GALERIE MINIATURES ÉPURÉE)
          ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'ebooks' && (
        <div className="space-y-5 animate-fadeIn">

          {/* Compteur + info */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-purple-300/80">
              <span className="font-bold text-white">{ebookBooks.length}</span> livre{ebookBooks.length !== 1 ? 's' : ''} numérique{ebookBooks.length !== 1 ? 's' : ''} disponible{ebookBooks.length !== 1 ? 's' : ''}
            </p>
            <span className="text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/20">
              +1 pt de fidélité / 3 min de lecture
            </span>
          </div>

          {/* État vide */}
          {ebookBooks.length === 0 && (
            <div className="py-16 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-3xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-purple-400" />
              </div>
              <p className="text-sm font-bold text-white">Aucun livre numérique pour le moment</p>
              <p className="text-xs text-purple-300/70 max-w-xs">
                L'administrateur n'a pas encore publié de livres PDF ou EPUB.
              </p>
            </div>
          )}

          {/* ── GALERIE MINIATURES LIVRES (format portrait, style librairie) ── */}
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {ebookBooks.map((book) => {
              let progressPercent = 0;
              let lastPage = 1;
              try {
                const prog = localStorage.getItem(`rg_ebook_progress_${book.id}`);
                if (prog) {
                  const parsed = JSON.parse(prog);
                  progressPercent = parsed.percentage || 0;
                  lastPage = parsed.page || 1;
                }
              } catch (_) {}

              const isFav = favoriteIds.includes(book.id);
              const isStarted = progressPercent > 0;
              const isFree = book.price === 0 || !book.price;
              const hasPtsUnlock = book.unlock_points && Number(book.unlock_points) > 0;

              return (
                <div
                  key={`ebook-${book.id}`}
                  onClick={() => onSelectBook(book)}
                  className="group cursor-pointer flex flex-col gap-2"
                >
                  {/* ── Couverture portrait (ratio 2:3 comme un vrai livre) ── */}
                  <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden border border-white/10 shadow-lg group-hover:shadow-purple-900/50 group-hover:border-purple-400/40 transition-all duration-300 group-hover:scale-[1.03]">
                    <img
                      src={book.cover_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&q=70'}
                      alt={book.title}
                      loading="lazy"
                      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&q=70'; }}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />

                    {/* Overlay lecture au survol */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                      <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
                        <BookOpen className="w-4 h-4 text-white" />
                      </div>
                    </div>

                    {/* Badge format coin sup gauche */}
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[8px] font-black text-purple-300 border border-purple-400/30 uppercase">
                      {book.format === 'epub' ? 'EPUB' : 'PDF'}
                    </span>

                    {/* Badge prix coin sup droit — FCFA OU Gratuit, jamais XP seul */}
                    <div className="absolute top-1.5 right-1.5">
                      {isFree ? (
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/30 backdrop-blur-md text-[8px] font-black text-emerald-300 border border-emerald-400/30">
                          GRATUIT
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-md bg-purple-950/80 backdrop-blur-md text-[8px] font-black text-white border border-purple-400/30 whitespace-nowrap">
                          {(book.discount_price || book.price).toLocaleString('fr-FR')} F
                        </span>
                      )}
                    </div>

                    {/* Barre de progression (si livre commencé) */}
                    {isStarted && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-amber-400"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    )}

                    {/* Favori */}
                    <button
                      type="button"
                      onClick={(e) => toggleFavorite(book.id, e)}
                      className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Heart className={`w-3 h-3 ${isFav ? 'text-rose-400 fill-rose-400' : 'text-white'}`} />
                    </button>
                  </div>

                  {/* Info texte sous la couverture */}
                  <div className="px-0.5">
                    <h4 className="text-[11px] sm:text-xs font-bold text-white line-clamp-2 leading-tight group-hover:text-purple-200 transition-colors">
                      {book.title}
                    </h4>
                    <p className="text-[10px] text-purple-300/70 truncate mt-0.5">
                      {book.author || "Read's Great"}
                    </p>
                    {/* Infos d'accès — clairement séparées : Prix réel OU Points fidélité */}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {!isFree && (
                        <span className="text-[9px] font-semibold text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          Mobile Money
                        </span>
                      )}
                      {hasPtsUnlock && (
                        <span className="text-[9px] font-semibold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                          {book.unlock_points} pts ⭐
                        </span>
                      )}
                      {isStarted && (
                        <span className="text-[9px] font-semibold text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                          {progressPercent}% lu
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Audio associé — Audio companion info banner */}
          {ebookBooks.some(b => b.companion_audio || b.companion_audio_id) && (
            <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center gap-3">
              <Headphones className="w-4 h-4 text-purple-400 shrink-0" />
              <p className="text-xs text-purple-200/80">
                Certains livres ont une <span className="font-bold text-white">version audio liée</span>. Ouvrez le livre pour écouter.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          2. ONGLET : HORS-LIGNE (LIVRES & AUDIOS TÉLÉCHARGÉS SUR L'APPAREIL)
          ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'offline' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Bannière Mode Hors-Ligne */}
          <div className="p-4 rounded-3xl bg-gradient-to-r from-cyan-950/80 via-blue-950/80 to-purple-950/80 border border-cyan-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 text-2xl shadow-lg">
                <WifiOff className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-white font-['Outfit']">
                  Mode 100% Hors-Ligne
                </h3>
                <p className="text-xs text-cyan-200/80">
                  {offlineBooks.length} ouvrage{offlineBooks.length > 1 ? 's' : ''} enregistré{offlineBooks.length > 1 ? 's' : ''} en mémoire locale • Écoutez et lisez sans connexion internet
                </p>
              </div>
            </div>

            <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-cyan-400" />
              <span>Stockage Résilient IndexedDB</span>
            </span>
          </div>

          {offlineBooks.length === 0 ? (
            <div className="p-10 rounded-3xl bg-purple-950/30 border border-purple-500/20 text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto text-cyan-400">
                <WifiOff className="w-8 h-8" />
              </div>
              <p className="text-base font-bold text-white">Aucun livre audio ou e-book hors-ligne pour le moment</p>
              <p className="text-xs text-purple-300/80 max-w-md mx-auto">
                Sur n'importe quel livre du catalogue ou e-book, cliquez sur le bouton <span className="font-bold text-cyan-300">« Mode Hors-ligne »</span> pour le télécharger directement sur votre téléphone ou ordinateur.
              </p>
              <button
                type="button"
                onClick={() => setActiveSubTab('ebooks')}
                className="mt-3 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-xs shadow-lg cursor-pointer"
              >
                Parcourir le catalogue
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {offlineBooks.map((book) => (
                <div
                  key={`offline-card-${book.id}`}
                  className="p-4 rounded-3xl bg-gradient-to-br from-[#121c2d]/90 to-[#0e1322]/95 border border-cyan-500/30 hover:border-cyan-400/60 shadow-xl transition-all flex flex-col justify-between"
                >
                  <div className="flex gap-4">
                    <div className="relative w-24 h-32 rounded-2xl overflow-hidden border border-cyan-500/30 shrink-0 shadow-lg">
                      <img
                        src={book.cover_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&q=70'}
                        alt={book.title}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-md bg-cyan-950/85 backdrop-blur-md text-[9px] font-black text-cyan-300 border border-cyan-400/40 uppercase">
                        HORS-LIGNE
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
                      <div>
                        <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider truncate block">
                          Disponible sans connexion
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate mt-0.5">
                          {book.title}
                        </h4>
                        <p className="text-[11px] text-[#a78bfa] truncate mt-0.5">
                          {book.author || 'Auteur Read\'s Great'}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {book.total_chapters || book.chapters?.length || 1} chapitre(s) audio • E-book
                        </p>
                      </div>

                      <div className="flex items-center gap-1 text-[10px] text-cyan-300 font-semibold pt-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Téléchargé & Sécurisé</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3.5 mt-3 border-t border-cyan-500/20 flex items-center justify-between gap-2">
                    {!(book.content_type === 'ebook' || book.content_type === 'epub' || book.content_type === 'pdf' || book.pdf_url) && (
                      <button
                        type="button"
                        onClick={() => playBook(book, 0, 0)}
                        className="flex-1 py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-cyan-900/30"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Écouter 🎧</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedEbook(book)}
                      className="flex-1 py-2 px-3 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Lire 📖</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        await removeOfflineAudio(book.id);
                        setOfflineBooks(getOfflineBooks());
                      }}
                      className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/20 transition-all cursor-pointer"
                      title="Supprimer du cache hors-ligne"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          3. ONGLET : MES FAVORIS
          ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'favorites' && (
        <div className="space-y-6 animate-fadeIn">
          {favoriteBooks.length === 0 && (
            <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/30 text-xs text-purple-200 flex items-center justify-between">
              <span>💡 Cliquez sur le cœur ❤️ d'un livre pour l'épingler dans vos favoris permanents.</span>
            </div>
          )}

          {/* Section 1 : Grille 3x2 Artwork Square */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs sm:text-sm font-black tracking-widest text-[#e9d5ff] uppercase font-heading flex items-center gap-1.5">
                <span className="text-purple-400 font-bold">|</span> LIVRES FAVORIS
              </h2>
              <span className="text-xs text-purple-300 font-bold">{displayFavorites.length} titres</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {displayFavorites.map((book) => (
                <div
                  key={`fav-card-${book.id}`}
                  onClick={() => setSelectedEbook(book)}
                  className="p-3 rounded-2xl bg-purple-950/50 border border-purple-500/30 hover:border-purple-400 transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-2">
                    <img
                      src={book.cover_url}
                      alt={book.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[8px] font-bold text-purple-300">
                      PDF
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-white truncate">{book.title}</h4>
                  <p className="text-[10px] text-purple-300/80 truncate">{book.author}</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEbook(book);
                    }}
                    className="mt-2 w-full py-1.5 rounded-lg bg-purple-600/40 text-white text-[11px] font-bold"
                  >
                    Lire 📖
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          3. ONGLET : AUTEURS
          ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'authors' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {authorsList.map((auth, idx) => (
              <div
                key={`author-${idx}`}
                onClick={() => setSelectedAuthor(selectedAuthor?.name === auth.name ? null : auth)}
                className={`p-4 rounded-3xl border transition-all cursor-pointer ${
                  selectedAuthor?.name === auth.name
                    ? 'bg-gradient-to-br from-purple-950/70 to-pink-950/50 border-purple-400 shadow-xl shadow-purple-950/50 scale-[1.02]'
                    : 'bg-gradient-to-br from-[#1c0d38]/60 to-[#120724]/80 border-purple-500/20 hover:border-purple-400/40'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden border border-purple-400/40 shrink-0 shadow-lg">
                    <img
                      src={auth.avatar}
                      alt={auth.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Auteur
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-white truncate mt-1">
                      {auth.name}
                    </h3>
                    <p className="text-xs text-[#c4b0e8] mt-0.5 font-mono">
                      {auth.books.length} {auth.books.length > 1 ? 'livres PDF' : 'livre PDF'}
                    </p>
                  </div>
                </div>

                {selectedAuthor?.name === auth.name && (
                  <div className="mt-4 pt-3 border-t border-purple-500/20 space-y-2 animate-fadeIn">
                    <span className="text-[10px] uppercase font-bold text-purple-300 block">
                      Livres de {auth.name} :
                    </span>
                    <div className="space-y-2">
                      {auth.books.map(b => (
                        <div
                          key={`auth-book-${b.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEbook(b);
                          }}
                          className="p-2.5 rounded-xl bg-black/30 hover:bg-black/50 border border-white/5 flex items-center justify-between text-xs transition-colors"
                        >
                          <span className="font-semibold text-white truncate pr-2">{b.title}</span>
                          <span className="text-purple-400 font-bold text-[11px] shrink-0">Lire 📖</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          4. ONGLET : DÉBLOQUÉS (achat FCFA ou points de fidélité)
          ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'purchases' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs sm:text-sm font-black tracking-widest text-[#e9d5ff] uppercase font-heading flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span> Vos E-Books Débloqués
              </h2>
              <span className="text-xs text-emerald-400 font-bold">{purchasedDisplay.length} titres actifs</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {purchasedDisplay.map((book) => (
                <div
                  key={`purchased-${book.id}`}
                  onClick={() => setSelectedEbook(book)}
                  className="p-3.5 rounded-2xl bg-gradient-to-br from-[#1e0e38]/90 to-[#120724]/90 border border-emerald-500/30 hover:border-emerald-400/60 transition-all flex items-center gap-3.5 cursor-pointer group shadow-lg"
                >
                  <img
                    src={book.cover_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=200&q=60'}
                    alt={book.title}
                    className="w-16 h-20 rounded-xl object-cover border border-white/10 shrink-0 group-hover:scale-105 transition-transform"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-[9.5px] font-extrabold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Débloqué — Accès illimité
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate mt-0.5">
                      {book.title}
                    </h4>
                    <p className="text-[11px] text-[#a78bfa] truncate">
                      {book.author}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectBook(book);
                        }}
                        className="px-3 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer active:scale-95 transition-all shadow-md"
                      >
                        <BookOpen className="w-3 h-3" />
                        <span>Lire le PDF</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
