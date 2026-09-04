import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Sparkles, ChevronRight, Play, Headphones,
  Plus, X, Flame, Star
} from 'lucide-react';
import { apiClient } from '../services/api';
import { AudiobookCard } from '../components/AudiobookCard';
import { AdBanner } from '../components/AdBanner';
import { useAudio } from '../context/AudioContext';
import { useXp } from '../context/XpContext';

// ─── Options de Filtrage intégrées dans la Bulle (+) ────────────────────────
const MAIN_FILTERS = [
  { id: 'all',    label: 'TOUS LES AUDIOS', emoji: '🌟', color: 'from-purple-600 via-fuchsia-600 to-pink-600' },
  { id: 'new',    label: 'NOUVEAUTÉS',      emoji: '🔥', color: 'from-amber-500 via-rose-500 to-pink-600' },
  { id: 'points', label: 'POINTS RG ⭐',    emoji: '⭐', color: 'from-amber-400 to-orange-500' },
];

const AUDIO_FORMATS = [
  { id: 'audiobook',  label: 'Livres Audio', emoji: '📚', color: 'from-violet-600 to-purple-600', matchType: 'audiobook' },
  { id: 'podcast',    label: 'Podcasts',     emoji: '🎙️', color: 'from-rose-500 to-pink-600',    matchType: 'podcast' },
  { id: 'music',      label: 'Musiques',     emoji: '🎵', color: 'from-cyan-500 to-blue-600',     matchType: 'music' },
  { id: 'masterclass',label: 'Masterclass',  emoji: '🎓', color: 'from-indigo-600 to-blue-700',   matchType: 'masterclass' },
];

export const DiscoverView = ({ onSelectBook, onBuyBook, searchQuery }) => {
  const [activeFilter, setActiveFilter] = useState('all');
  const [isBubbleOpen, setIsBubbleOpen] = useState(false);
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const bubbleRef = useRef(null);

  const { playPreview } = useAudio();
  const { points } = useXp();

  const loadData = async () => {
    try {
      const books = await apiClient.getAudiobooks({ category: 'all' });
      if (Array.isArray(books) && books.length > 0) setAudiobooks(books);
    } catch (e) { console.error('Erreur chargement:', e); }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('rg:book-created', loadData);
    window.addEventListener('rg:book-deleted', loadData);
    return () => {
      window.removeEventListener('rg:book-created', loadData);
      window.removeEventListener('rg:book-deleted', loadData);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target)) setIsBubbleOpen(false);
    };
    if (isBubbleOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isBubbleOpen]);

  // ════════════════════════════════════════════════════════════════════════════
  // DÉCOUVRIR = 100% AUDIO. AUCUN livre PDF ni eBook ne doit y figurer !
  // ════════════════════════════════════════════════════════════════════════════
  const isPureAudio = (b) => {
    if (!b) return false;
    // Exclure formellement tout format ou type explicitement écrit (epub, ebook, pdf sans pistes audio)
    if (b.format === 'epub' || b.content_type === 'epub' || b.content_type === 'ebook' || b.is_ebook) return false;
    // Format ou type audio explicite
    if (b.format === 'audiobook' || b.content_type === 'audiobook' || b.content_type === 'podcast' || b.content_type === 'music' || b.content_type === 'masterclass') return true;
    // Possède des chapitres audio, un audio_url ou une preview_url
    if ((Array.isArray(b.chapters) && b.chapters.length > 0) || b.audio_url || b.preview_url) return true;
    return false;
  };

  // Catalogue exclusivement audio
  const audioOnlyCatalog = audiobooks.filter(isPureAudio);

  // Filtrage selon la sélection Bulle (+) ou la recherche
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
    if (activeFilter === 'new') return b.is_featured || b.is_pinned || b.price === 0;
    if (activeFilter === 'points') return (b.unlock_points && Number(b.unlock_points) > 0) || b.price === 0;

    const formatMatch = AUDIO_FORMATS.find(f => f.id === activeFilter);
    if (formatMatch) {
      return b.content_type === formatMatch.matchType || (formatMatch.id === 'audiobook' && b.format === 'audiobook');
    }

    return true;
  });

  const featuredList = audioOnlyCatalog.filter(b => b.is_featured || b.is_pinned).slice(0, 4);
  const currentFeatured = featuredList[0] || audioOnlyCatalog[0] || null;
  const newBooks = audioOnlyCatalog.slice(0, 6);
  const recommendations = audioOnlyCatalog.slice(2, 6);

  // Info sur le filtre actif
  const currentFilterInfo =
    MAIN_FILTERS.find(f => f.id === activeFilter) ||
    AUDIO_FORMATS.find(f => f.id === activeFilter) ||
    MAIN_FILTERS[0];

  // Gestion du clic : TOUJOURS forcer le lecteur audio car Découvrir est 100% audio
  const handleSelectAudio = (book) => {
    onSelectBook(book, { forceAudio: true });
  };

  return (
    <div className="relative space-y-6 pb-36 sm:pb-40 animate-fadeIn select-none">

      {/* ── EN-TÊTE DÉCOUVRIR AVEC LA BULLE (+) HÉROS (identique à l'Agent SKY) ── */}
      <div className="flex items-center justify-between pt-1 gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black tracking-widest text-white uppercase font-heading">
              DÉCOUVRIR
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-400/30 text-[10px] font-extrabold uppercase text-purple-300">
              <Headphones className="w-3 h-3 text-purple-400" /> 100% Audio
            </span>
          </div>

          {/* Badge du filtre actif */}
          {activeFilter !== 'all' ? (
            <div className="flex items-center gap-1.5 mt-1.5 animate-fadeIn">
              <span className="text-xs font-bold text-purple-200 flex items-center gap-1 bg-purple-900/40 px-2.5 py-1 rounded-full border border-purple-500/30">
                <span>{currentFilterInfo.emoji}</span>
                <span className="font-extrabold text-white">{currentFilterInfo.label}</span>
                <span className="text-purple-400 font-mono">({filteredBooks.length})</span>
              </span>
              <button
                onClick={() => setActiveFilter('all')}
                className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-purple-200 transition-colors cursor-pointer"
                title="Tout réafficher"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <p className="text-[11px] sm:text-xs text-[#a78bfa] mt-1 font-medium">
              Explorez nos livres audio, podcasts et narrations immersives
            </p>
          )}
        </div>

        {/* Actions Droite : Recherche & BULLE (+) GÉANTE HERO (comme Agent SKY) */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0" ref={bubbleRef}>
          {/* Bouton recherche */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(prev => !prev)}
            className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-[#c4b0e8] hover:text-white transition-colors cursor-pointer border border-white/10"
            title="Rechercher un audio"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* ── LA BULLE (+) GÉANTE HERO (style et taille exacte Agent SKY) ── */}
          <div className="relative">
            <button
              onClick={() => setIsBubbleOpen(prev => !prev)}
              className="group relative w-13 h-13 sm:w-14 sm:h-14 rounded-full p-0.5 flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer shadow-2xl"
              style={{
                background: 'linear-gradient(135deg, #c084fc, #9333ea, #3b82f6)',
                boxShadow: '0 0 25px rgba(168, 85, 247, 0.65), 0 8px 20px rgba(0,0,0,0.6)',
              }}
              title={isBubbleOpen ? 'Fermer le menu' : 'Filtres et formats (+)'}
            >
              <div className="w-full h-full rounded-full bg-[#180b30] flex items-center justify-center overflow-hidden border border-white/25">
                {isBubbleOpen ? (
                  <X className="w-6 h-6 text-white transition-transform" />
                ) : activeFilter !== 'all' ? (
                  <span className="text-xl leading-none">{currentFilterInfo.emoji}</span>
                ) : (
                  <Plus className="w-6 h-6 text-white stroke-[2.5]" />
                )}
              </div>

              {/* Glowing active pulse ring */}
              <span className="absolute -inset-1 rounded-full border-2 border-purple-400/60 animate-ping pointer-events-none" />
            </button>

            {/* Menu Déroulant Bulle (+) */}
            {isBubbleOpen && (
              <div className="absolute right-0 top-16 z-50 w-72 sm:w-80 p-4 rounded-3xl bg-[#130726]/95 border border-purple-500/40 shadow-2xl backdrop-blur-2xl animate-slideDown space-y-3.5">
                {/* 1. FILTRES PRINCIPAUX DÉPLACÉS DANS LA BULLE (+) */}
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-purple-300 px-1 mb-2 block">
                    ⚡ Filtres Principaux
                  </span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {MAIN_FILTERS.map((f) => {
                      const isActive = activeFilter === f.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => {
                            setActiveFilter(f.id);
                            setIsBubbleOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all cursor-pointer border ${
                            isActive
                              ? `bg-gradient-to-r ${f.color} text-white border-white/40 shadow-lg scale-[1.02]`
                              : 'bg-white/5 hover:bg-white/10 text-purple-100 border-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">{f.emoji}</span>
                            <span>{f.label}</span>
                          </div>
                          {isActive && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. FORMATS & GENRES AUDIO EXCLUSIFS */}
                <div className="pt-2 border-t border-white/10">
                  <span className="text-[10px] uppercase font-black tracking-wider text-purple-300 px-1 mb-2 block">
                    🎧 Formats & Genres Audio
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {AUDIO_FORMATS.map((f) => {
                      const isActive = activeFilter === f.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => {
                            setActiveFilter(f.id);
                            setIsBubbleOpen(false);
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                            isActive
                              ? `bg-gradient-to-r ${f.color} text-white border-white/40 shadow-md scale-[1.02]`
                              : 'bg-white/5 hover:bg-white/10 text-purple-200 border-white/10'
                          }`}
                        >
                          <span className="text-base">{f.emoji}</span>
                          <span className="truncate">{f.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── BARRE DE RECHERCHE ── */}
      {isSearchOpen && (
        <div className="relative animate-slideDown">
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Rechercher un livre audio, podcast, auteur..."
            className="w-full bg-[#200e39]/90 border border-purple-500/40 rounded-2xl px-4 py-3 pl-11 text-sm text-white placeholder-[#8b75b2] focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 shadow-xl"
            autoFocus
          />
          <Search className="w-5 h-5 text-[#c4b0e8] absolute left-3.5 top-3.5" />
        </div>
      )}

      {/* ── CONTENU DU FLUX AUDIO ── */}
      {activeFilter !== 'all' ? (
        /* VUE FILTRÉE */
        <div className="space-y-5 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-4 rounded-2xl bg-purple-950/40 border border-purple-500/30">
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>{currentFilterInfo.emoji}</span>
                <span>{currentFilterInfo.label}</span>
              </h2>
              <p className="text-xs text-purple-300/80 mt-0.5">
                {activeFilter === 'points'
                  ? `Votre solde : ${points} Points. Débloquez sans carte bancaire.`
                  : `${filteredBooks.length} titres audio disponibles`}
              </p>
            </div>
            <button
              onClick={() => setActiveFilter('all')}
              className="text-xs font-bold text-purple-300 hover:text-white px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
            >
              Afficher tous les audios
            </button>
          </div>

          {filteredBooks.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {filteredBooks.map((book) => (
                <AudiobookCard
                  key={`filtered-${book.id}`}
                  book={book}
                  onSelect={handleSelectAudio}
                  layout="square"
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <span className="text-6xl">{currentFilterInfo.emoji}</span>
              <p className="text-[#8b75b2] text-sm font-medium">
                Aucun contenu audio trouvé pour ce filtre.<br />
                Modifiez vos critères ou réinitialisez le filtre.
              </p>
            </div>
          )}
        </div>

      ) : (
        /* VUE PRINCIPALE (TOUS LES AUDIOS) */
        <div className="space-y-8 animate-fadeIn">

          {/* 1. HERO ALBUM VEDETTE */}
          {currentFeatured && (
            <div
              onClick={() => handleSelectAudio(currentFeatured)}
              className="relative rounded-3xl overflow-hidden cursor-pointer group shadow-2xl transition-all duration-500 hover:shadow-purple-900/40"
              style={{
                background: 'linear-gradient(135deg, #2d1354 0%, #16082c 60%, #0c0418 100%)',
                border: '1px solid rgba(168,85,247,0.30)',
              }}
            >
              <div className="relative p-5 sm:p-7 flex flex-col sm:flex-row items-center gap-5 sm:gap-7">
                <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden flex-shrink-0 shadow-2xl border border-purple-400/40 group-hover:scale-105 transition-transform duration-500">
                  <img
                    src={currentFeatured.cover_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80'}
                    alt={currentFeatured.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center text-white">
                    <Play className="w-5 h-5 ml-0.5 fill-white" />
                  </div>
                </div>

                <div className="flex-1 text-center sm:text-left min-w-0">
                  <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-400/30">
                    ⭐ Vedette de la semaine
                  </span>
                  <h2 className="text-lg sm:text-2xl font-black text-white mt-2 truncate font-heading group-hover:text-purple-200 transition-colors">
                    {currentFeatured.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#c4b0e8] mt-1 font-medium">
                    {currentFeatured.author || 'Auteur vérifié'}
                  </p>
                  <p className="text-xs text-[#8b75b2] mt-2 line-clamp-2 max-w-xl">
                    {currentFeatured.description || 'Une expérience sonore immersive et captivante.'}
                  </p>

                  <div className="flex items-center justify-center sm:justify-start gap-3 mt-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        playPreview(currentFeatured);
                      }}
                      className="btn-gradient px-5 py-2.5 rounded-2xl text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-purple-600/30 hover:scale-105 transition-all cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Écouter un extrait</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectAudio(currentFeatured);
                      }}
                      className="px-4 py-2.5 rounded-2xl text-xs font-bold text-purple-200 bg-white/10 hover:bg-white/20 border border-white/10 transition-all cursor-pointer"
                    >
                      Voir détails
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. BANNIÈRE SPONSORISÉE DU DÉBUT */}
          <AdBanner placement="discover_hero" onOpenRewardModal={() => window.dispatchEvent(new Event('rg:open-reward-ad'))} className="my-2" />

          {/* 3. SECTION NOUVEAUTÉS */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs sm:text-sm font-black tracking-widest text-[#e9d5ff] uppercase font-heading flex items-center gap-1.5">
                <span className="text-purple-400 font-bold">|</span> NOUVEAUX ALBUMS & SÉRIES
              </h2>
              <button
                onClick={() => setActiveFilter('new')}
                className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
              >
                <span>Voir tout</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {newBooks.map((book) => (
                <AudiobookCard key={`new-${book.id}`} book={book} onSelect={handleSelectAudio} layout="square" />
              ))}
            </div>
          </section>

          {/* 4. SECTION RECOMMANDATIONS */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs sm:text-sm font-black tracking-widest text-[#e9d5ff] uppercase font-heading flex items-center gap-1.5">
                <span className="text-pink-400 font-bold">|</span> RECOMMANDÉS POUR VOUS
              </h2>
              <span className="text-xs text-[#a78bfa] font-bold">Personnalisé</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recommendations.map((book) => (
                <AudiobookCard key={`rec-${book.id}`} book={book} onSelect={handleSelectAudio} layout="pill" />
              ))}
            </div>
          </section>

          {/* 5. BANNIÈRE SPONSORISÉE MILIEU DE FLUX */}
          <AdBanner placement="discover_feed" onOpenRewardModal={() => window.dispatchEvent(new Event('rg:open-reward-ad'))} className="my-3" />

          {/* 6. TOUT LE CATALOGUE AUDIO */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs sm:text-sm font-black tracking-widest text-[#e9d5ff] uppercase font-heading flex items-center gap-1.5">
                <span className="text-purple-400 font-bold">|</span> TOUT LE CATALOGUE AUDIO
              </h2>
              <span className="text-xs text-[#a78bfa] font-bold">{filteredBooks.length} titres</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {filteredBooks.map((book) => (
                <AudiobookCard key={`cat-${book.id}`} book={book} onSelect={handleSelectAudio} layout="square" />
              ))}
            </div>
          </section>

          {/* 7. BANNIÈRE SPONSORISÉE PIED DE PAGE */}
          <AdBanner placement="discover_bottom" onOpenRewardModal={() => window.dispatchEvent(new Event('rg:open-reward-ad'))} className="my-4" />
        </div>
      )}

    </div>
  );
};
