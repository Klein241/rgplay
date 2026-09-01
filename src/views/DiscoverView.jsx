import React, { useState, useEffect } from 'react';
import {
  Star, Play, Headphones, Clock,
  ChevronRight, Flame, Compass, Search,
  Radio, Music, GraduationCap, BookOpen, Sparkles
} from 'lucide-react';
import { apiClient } from '../services/api';
import { AudiobookCard } from '../components/AudiobookCard';
import { useAudio } from '../context/AudioContext';

const CONTENT_TYPES = [
  { id: 'all', label: 'Tous les Univers', icon: Sparkles, color: 'from-purple-600 to-pink-600' },
  { id: 'audiobook', label: 'Livres Audio', icon: BookOpen, color: 'from-purple-600 to-indigo-600' },
  { id: 'podcast', label: 'Podcasts', icon: Radio, color: 'from-amber-500 to-orange-600' },
  { id: 'music', label: 'Musique & Lofi', icon: Music, color: 'from-emerald-500 to-teal-600' },
  { id: 'masterclass', label: 'Masterclasses', icon: GraduationCap, color: 'from-cyan-500 to-blue-600' },
];

export const DiscoverView = ({ onSelectBook, onBuyBook, searchQuery }) => {
  const [selectedType, setSelectedType] = useState('all');
  const [categories, setCategories] = useState(() => [
    { id: 'all', name: 'Tous les genres', slug: 'all', icon: 'Sparkles', color: '#9d4edd' },
    { id: 'cat-1', name: 'Business & Finance', slug: 'business-finance', icon: 'TrendingUp', color: '#9d4edd' },
    { id: 'cat-2', name: 'Développement Personnel', slug: 'dev-perso', icon: 'Sparkles', color: '#c77dff' },
    { id: 'cat-3', name: 'Intelligence Artificielle & Tech', slug: 'tech-ia', icon: 'Cpu', color: '#3a86ff' },
    { id: 'cat-4', name: 'Psychologie & Mental', slug: 'psychologie', icon: 'Brain', color: '#ff006e' },
    { id: 'cat-5', name: 'Histoire & Stratégie', slug: 'strategie', icon: 'Shield', color: '#fb5607' },
    { id: 'cat-6', name: 'Romans & Fiction', slug: 'fiction', icon: 'BookOpen', color: '#ffbe0b' },
  ]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [audiobooks, setAudiobooks] = useState(() => {
    try {
      const cached = localStorage.getItem('rg_cached_books');
      const delCached = localStorage.getItem('rg_deleted_books');
      const deletedIds = new Set(delCached ? JSON.parse(delCached) : []);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter(b => !deletedIds.has(b.id));
        }
      }
    } catch (_) {}
    return [];
  });
  const [featuredBook, setFeaturedBook] = useState(() => {
    try {
      const cached = localStorage.getItem('rg_cached_books');
      const delCached = localStorage.getItem('rg_deleted_books');
      const deletedIds = new Set(delCached ? JSON.parse(delCached) : []);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter(b => !deletedIds.has(b.id));
          return valid.find(b => Boolean(b.is_featured)) || valid[0] || null;
        }
      }
    } catch (_) {}
    return null;
  });
  const [isLoading, setIsLoading] = useState(() => {
    try {
      const cached = localStorage.getItem('rg_cached_books');
      return !cached || JSON.parse(cached).length === 0;
    } catch (_) {
      return true;
    }
  });

  const [aiSearchReason, setAiSearchReason] = useState('');
  const [isAiSearching, setIsAiSearching] = useState(false);

  const { playPreview, playBook } = useAudio();

  const loadData = async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const [cats, books] = await Promise.all([
        apiClient.getCategories(),
        apiClient.getAudiobooks({
          category: selectedCategory,
          search: searchQuery,
          type: selectedType
        }),
      ]);
      if (cats && cats.length > 0) setCategories(cats);
      
      let finalBooks = Array.isArray(books) ? books : [];

      // Recherche sémantique IA si la requête contient du texte
      if (searchQuery && searchQuery.trim().length >= 4) {
        try {
          setIsAiSearching(true);
          const aiRes = await apiClient.semanticSearch(searchQuery);
          if (aiRes && aiRes.success && Array.isArray(aiRes.matched_ids) && aiRes.matched_ids.length > 0) {
            setAiSearchReason(aiRes.reason || 'Recommandation IA personnalisée pour votre intention');
            const allAvailable = await apiClient.getAudiobooks({ category: 'all', type: 'all' });
            const matchedBooks = [];
            const otherBooks = [];
            const matchedSet = new Set(aiRes.matched_ids);

            for (const id of aiRes.matched_ids) {
              const found = (allAvailable || []).find(b => b.id === id);
              if (found && !matchedBooks.some(m => m.id === found.id)) {
                matchedBooks.push(found);
              }
            }
            for (const b of finalBooks) {
              if (!matchedSet.has(b.id)) otherBooks.push(b);
            }
            if (matchedBooks.length > 0) {
              finalBooks = [...matchedBooks, ...otherBooks];
            }
          } else {
            setAiSearchReason('');
          }
        } catch (_) {
          setAiSearchReason('');
        } finally {
          setIsAiSearching(false);
        }
      } else {
        setAiSearchReason('');
      }

      if (finalBooks && Array.isArray(finalBooks)) {
        setAudiobooks(finalBooks);
        if (finalBooks.length > 0) {
          const featured = finalBooks.find(b => Boolean(b.is_featured)) || finalBooks[0];
          setFeaturedBook(featured);
        } else {
          setFeaturedBook(null);
        }
      }
    } catch (e) {
      console.error('Erreur chargement données:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleRefresh();
    };
    // Retrait instantané de l'état local (optimiste) + rechargement serveur
    const handleBookDeleted = (e) => {
      const deletedId = e.detail?.id;
      if (deletedId) {
        setAudiobooks(prev => prev.filter(b => b.id !== deletedId));
        setFeaturedBook(prev => (prev?.id === deletedId ? null : prev));
      }
      loadData();
    };
    window.addEventListener('rg:book-created', handleRefresh);
    window.addEventListener('rg:book-deleted', handleBookDeleted);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('rg:book-created', handleRefresh);
      window.removeEventListener('rg:book-deleted', handleBookDeleted);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [selectedType, selectedCategory, searchQuery]);

  const pinnedBooks = audiobooks.filter(b => Boolean(b.is_pinned));
  const trendingBooks = audiobooks.slice(0, 6);
  const podcasts = audiobooks.filter(b => b.content_type === 'podcast');
  const musicTracks = audiobooks.filter(b => b.content_type === 'music');
  const masterclasses = audiobooks.filter(b => b.content_type === 'masterclass');

  return (
    <div className="pb-28 md:pb-10 animate-fadeIn max-w-7xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* ── 1. Sélecteur des Types de Contenu ── */}
      <section className="sticky top-16 z-20 -mx-4 px-4 sm:mx-0 sm:px-0 py-3">
        <div
          className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-1"
          style={{
            background: 'rgba(5, 3, 17, 0.80)',
            backdropFilter: 'blur(28px) saturate(200%)',
            WebkitBackdropFilter: 'blur(28px) saturate(200%)',
            border: '1px solid rgba(168, 85, 247, 0.12)',
            borderRadius: '1.5rem',
            boxShadow: '0 4px 24px rgba(0,0,0,0.40), 0 1px 0 rgba(255,255,255,0.04) inset',
          }}
        >
          {CONTENT_TYPES.map((type) => {
            const Icon = type.icon;
            const isSelected = selectedType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => {
                  setSelectedType(type.id);
                  setSelectedCategory('all');
                }}
                className="flex-shrink-0 flex items-center gap-2 font-bold transition-all duration-300"
                style={{
                  padding: '0.65rem 1.1rem',
                  borderRadius: '1.25rem',
                  fontSize: '0.8125rem',
                  background: isSelected
                    ? `linear-gradient(135deg, ${type.color.includes('purple') ? '#6d28d9, #9333ea' : type.color.includes('amber') ? '#b45309, #d97706' : type.color.includes('emerald') ? '#065f46, #059669' : '#0e7490, #0284c7'})`
                    : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isSelected ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)'}`,
                  color: isSelected ? '#ffffff' : 'rgba(139,135,168,0.9)',
                  boxShadow: isSelected
                    ? '0 4px 20px rgba(0,0,0,0.40), 0 1px 0 rgba(255,255,255,0.10) inset'
                    : 'none',
                  transform: isSelected ? 'scale(1.04)' : 'scale(1)',
                }}
              >
                <Icon size={15} style={{ strokeWidth: isSelected ? 2.2 : 1.8 }} />
                <span>{type.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 2. Hero Featured PREMIUM ── */}
      {!searchQuery && featuredBook && (
        <section>
          <div
            className="relative rounded-3xl overflow-hidden"
            style={{
              border: '1px solid rgba(168, 85, 247, 0.30)',
              padding: 'clamp(1.75rem, 5vw, 3rem)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.60), 0 0 0 1px rgba(168,85,247,0.10)',
            }}
          >
            {/* Cover blur background — 35% opacity */}
            <div
              className="absolute inset-0 scale-110 pointer-events-none"
              style={{
                backgroundImage: `url(${featuredBook.cover_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80'})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(40px) saturate(130%)',
                opacity: 0.35,
              }}
            />
            {/* Gradient directionnel fort */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'linear-gradient(115deg, rgba(5,3,17,0.98) 35%, rgba(5,3,17,0.72) 65%, rgba(5,3,17,0.45) 100%)' }}
            />
            {/* Orb accent */}
            <div
              className="absolute -top-20 -right-20 w-72 h-72 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.22) 0%, transparent 70%)', filter: 'blur(30px)' }}
            />

            <div className="relative flex flex-col-reverse lg:flex-row items-center gap-8 lg:gap-12">
              <div className="flex-1 space-y-5">
                <div
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold"
                  style={{ background: 'rgba(244,63,139,0.14)', border: '1px solid rgba(244,63,139,0.30)', color: '#fb7db8', boxShadow: '0 0 16px rgba(244,63,139,0.18)' }}
                >
                  <Flame className="w-3.5 h-3.5 fill-pink-400 text-pink-400" />
                  {featuredBook.content_type === 'podcast' ? '🎙️ Podcast Tendance' :
                   featuredBook.content_type === 'music' ? '🎵 Musique Tendance' :
                   featuredBook.content_type === 'masterclass' ? '🎓 Masterclass du Moment' :
                   '🔥 Tendance du Moment'}
                </div>

                <h1
                  className="text-2xl sm:text-4xl lg:text-5xl font-black leading-tight"
                  style={{
                    background: 'linear-gradient(135deg, #F5F3FF 0%, #E9D5FF 50%, #D08FFF 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {featuredBook.title}
                </h1>

                <p className="text-sm sm:text-base leading-relaxed max-w-2xl line-clamp-2" style={{ color: 'rgba(196,191,224,0.90)' }}>
                  {featuredBook.description}
                </p>

                <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
                  <span style={{ color: '#d08fff', fontWeight: 700 }}>
                    {featuredBook.content_type === 'podcast' ? 'Hôte : ' :
                     featuredBook.content_type === 'music' ? 'Artiste : ' : 'Par '}
                    {featuredBook.author}
                  </span>
                  <span style={{ color: 'rgba(168,85,247,0.35)' }}>•</span>
                  <span className="flex items-center gap-1" style={{ color: '#fbbf24', fontWeight: 700 }}>
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    {featuredBook.rating} ({(featuredBook.rating_count || 100).toLocaleString('fr-FR')} avis)
                  </span>
                  <span style={{ color: 'rgba(168,85,247,0.35)' }}>•</span>
                  <span className="flex items-center gap-1" style={{ color: 'rgba(139,135,168,0.9)' }}>
                    <Clock className="w-3.5 h-3.5" />
                    {Math.floor((featuredBook.duration_seconds || 3600) / 3600)}h d'écoute
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button onClick={() => playPreview(featuredBook)} className="btn-gradient py-3.5 px-7 rounded-2xl text-sm font-bold flex items-center gap-2.5">
                    <Headphones className="w-4 h-4" />
                    {featuredBook.content_type === 'music' ? 'Écouter la Piste' : 'Écouter l\'Extrait'}
                  </button>
                  <button onClick={() => onSelectBook(featuredBook)} className="rg-btn-ghost py-3.5 px-6 rounded-2xl text-sm">
                    {featuredBook.price === 0 || featuredBook.is_free_for_members
                      ? 'Détails (Gratuit)'
                      : `Détails — ${(featuredBook.discount_price || featuredBook.price)?.toLocaleString()} FCFA`}
                  </button>
                </div>
              </div>

              {/* Cover premium avec halo */}
              <div
                onClick={() => onSelectBook(featuredBook)}
                className="relative flex-shrink-0 cursor-pointer group"
                style={{ width: 'clamp(160px, 22vw, 240px)', aspectRatio: '1' }}
              >
                <div
                  className="absolute -inset-4 rounded-3xl pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.38) 0%, transparent 70%)', filter: 'blur(22px)' }}
                />
                <div
                  className="relative w-full h-full rounded-3xl overflow-hidden"
                  style={{ border: '2px solid rgba(255,255,255,0.18)', boxShadow: '0 24px 60px rgba(0,0,0,0.70), 0 8px 24px rgba(168,85,247,0.28)' }}
                >
                  <img
                    src={featuredBook.cover_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80'}
                    alt={featuredBook.title}
                    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80'; }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    style={{ filter: 'brightness(0.95) saturate(1.1)' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: 'rgba(5,3,17,0.55)' }}>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7,#db2777)', boxShadow: '0 0 30px rgba(168,85,247,0.70)', border: '2px solid rgba(255,255,255,0.20)' }}>
                      <Play className="w-7 h-7 fill-white ml-1 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 3. Catégories Thématiques ── */}
      <section>
        <div className="card-lg space-y-4">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-purple-400" />
            <h2 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Catégories & Thèmes
            </h2>
          </div>
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                  className="flex-shrink-0 px-4 py-2 rounded-2xl text-xs font-semibold transition-all"
                  style={{
                    background: isSelected ? 'linear-gradient(135deg, #9d4edd, #f72585)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${isSelected ? 'rgba(157,78,221,0.50)' : 'rgba(255,255,255,0.08)'}`,
                    color: isSelected ? 'white' : 'var(--color-text-secondary)',
                    boxShadow: isSelected ? '0 4px 16px rgba(157,78,221,0.35)' : 'none',
                    transform: isSelected ? 'scale(1.04)' : 'scale(1)',
                  }}>
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 3.5. Section Audios Épinglés (Sélection Éditeur RG Play) ── */}
      {!searchQuery && selectedCategory === 'all' && pinnedBooks.length > 0 && (
        <section className="animate-fadeIn">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <span className="text-base">📌</span>
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">
                    Sélection Épinglée par l'Éditeur
                  </h2>
                  <p className="text-xs text-amber-300 font-medium">
                    {pinnedBooks.length} contenu{pinnedBooks.length > 1 ? 's' : ''} mis en avant
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-stretch gap-4 overflow-x-auto pb-3 no-scrollbar">
              {pinnedBooks.map((book) => (
                <AudiobookCard key={book.id} book={book} layout="carousel" onSelect={onSelectBook} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 4. Carrousel Pour Vous / Tendances ── */}
      {!searchQuery && selectedCategory === 'all' && trendingBooks.length > 0 && (
        <section>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black" style={{ color: 'var(--color-text-primary)' }}>
                  {selectedType === 'podcast' ? '🎙️ Podcasts Populaires' :
                   selectedType === 'music' ? '🎵 Musiques & Ambiance' :
                   selectedType === 'masterclass' ? '🎓 Masterclasses Recommandées' :
                   'Pour Vous'}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                  Sélectionnés selon vos préférences d'écoute
                </p>
              </div>
            </div>
            <div className="flex items-stretch gap-4 overflow-x-auto pb-3 no-scrollbar">
              {trendingBooks.map((book) => (
                <AudiobookCard key={book.id} book={book} layout="carousel" onSelect={onSelectBook} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 5. Grille Principale ── */}
      <section>
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black" style={{ color: 'var(--color-text-primary)' }}>
                {searchQuery
                  ? `Résultats pour "${searchQuery}"`
                  : selectedType === 'podcast' ? 'Tous les Podcasts'
                  : selectedType === 'music' ? 'Toutes les Pistes Musicales'
                  : selectedType === 'masterclass' ? 'Toutes les Masterclasses'
                  : 'Tous les Titres Audio'}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                {audiobooks.length} {audiobooks.length > 1 ? 'contenus disponibles' : 'contenu disponible'} en streaming HD
              </p>
            </div>
          </div>

          {/* Bannière Recommandation Sémantique DeepSeek */}
          {aiSearchReason && searchQuery && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/80 via-indigo-950/60 to-slate-900/90 border border-purple-500/40 flex items-start sm:items-center gap-3 text-xs text-purple-200 shadow-xl animate-fadeIn">
              <div className="w-8 h-8 rounded-xl bg-purple-500/25 flex items-center justify-center flex-shrink-0 text-purple-300 border border-purple-500/30">
                <Sparkles className="w-4 h-4 text-purple-300 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-xs">Recherche Intelligente DeepSeek</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-extrabold border border-purple-500/30">
                    IA Active
                  </span>
                </div>
                <p className="text-slate-300 text-xs">{aiSearchReason}</p>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <div key={n} className="skeleton rounded-2xl h-52 sm:h-64" />
              ))}
            </div>
          ) : audiobooks.length === 0 ? (
            <div className="text-center py-16 card-lg space-y-4">
              <Search className="w-12 h-12 mx-auto opacity-35" style={{ color: 'var(--color-text-tertiary)' }} />
              <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>Aucun contenu trouvé</h3>
              <p className="text-sm max-w-sm mx-auto" style={{ color: 'var(--color-text-tertiary)' }}>
                Essayez un autre univers ou modifiez vos critères de recherche.
              </p>
              <button
                onClick={() => {
                  setSelectedType('all');
                  setSelectedCategory('all');
                }}
                className="rg-btn-primary px-5 py-2.5 rounded-full text-sm"
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4">
              {audiobooks.map((book) => (
                <AudiobookCard key={book.id} book={book} layout="grid" onSelect={onSelectBook} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
