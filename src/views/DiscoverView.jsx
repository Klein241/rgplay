import React, { useState, useEffect } from 'react';
import {
  Star, Play, Headphones, Clock,
  ChevronRight, Flame, Compass, Search
} from 'lucide-react';
import { apiClient } from '../services/api';
import { AudiobookCard } from '../components/AudiobookCard';
import { useAudio } from '../context/AudioContext';

export const DiscoverView = ({ onSelectBook, onBuyBook, searchQuery }) => {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [audiobooks, setAudiobooks] = useState([]);
  const [featuredBook, setFeaturedBook] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const { playPreview } = useAudio();

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cats, books] = await Promise.all([
        apiClient.getCategories(),
        apiClient.getAudiobooks({ category: selectedCategory, search: searchQuery }),
      ]);
      setCategories(cats);
      setAudiobooks(books);
      if (books.length > 0) {
        const featured = books.find(b => Boolean(b.is_featured)) || books[0];
        setFeaturedBook(featured);
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
    window.addEventListener('rg:book-created', handleRefresh);
    window.addEventListener('rg:book-deleted', handleRefresh);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('rg:book-created', handleRefresh);
      window.removeEventListener('rg:book-deleted', handleRefresh);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [selectedCategory, searchQuery]);

  const trendingBooks = audiobooks.slice(0, 6);

  return (
    <div className="pb-28 md:pb-10 animate-fadeIn max-w-7xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* ── 1. Hero Featured ── */}
      {!searchQuery && featuredBook && (
        <section>
          <div className="relative rounded-3xl overflow-hidden shadow-2xl" style={{
            border: '1px solid rgba(157,78,221,0.28)',
            background: 'rgba(22,17,46,0.82)',
            padding: 'clamp(1.5rem, 4vw, 2.5rem)',
          }}>
            <div className="absolute inset-0 bg-cover bg-center blur-3xl opacity-15 scale-110 pointer-events-none"
              style={{ backgroundImage: `url(${featuredBook.cover_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80'})` }} />
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'linear-gradient(110deg, rgba(7,4,26,0.98) 40%, rgba(7,4,26,0.55) 100%)' }} />

            <div className="relative flex flex-col-reverse lg:flex-row items-center gap-8">
              <div className="flex-1 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
                  style={{ background: 'rgba(247,37,133,0.15)', border: '1px solid rgba(247,37,133,0.28)', color: '#f984b4' }}>
                  <Flame className="w-3.5 h-3.5 fill-pink-400 text-pink-400" />
                  Tendance du Moment
                </div>

                <h1 className="text-2xl sm:text-4xl font-black leading-tight" style={{ color: 'var(--color-text-primary)' }}>
                  {featuredBook.title}
                </h1>

                <p className="text-sm leading-relaxed max-w-2xl line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
                  {featuredBook.description}
                </p>

                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <span style={{ color: '#c77dff', fontWeight: 700 }}>Par {featuredBook.author}</span>
                  <span style={{ color: 'rgba(157,78,221,0.40)' }}>•</span>
                  <span className="flex items-center gap-1" style={{ color: '#ffbe0b', fontWeight: 700 }}>
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    {featuredBook.rating} ({(featuredBook.rating_count || 100).toLocaleString('fr-FR')} avis)
                  </span>
                  <span style={{ color: 'rgba(157,78,221,0.40)' }}>•</span>
                  <span className="flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
                    <Clock className="w-3.5 h-3.5" />
                    {Math.floor((featuredBook.duration_seconds || 3600) / 3600)}h d'écoute
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button onClick={() => playPreview(featuredBook)}
                    className="btn-gradient py-3 px-6 rounded-2xl text-sm font-bold flex items-center gap-2">
                    <Headphones className="w-4 h-4" />
                    Écouter l'Extrait
                  </button>
                  <button onClick={() => onSelectBook(featuredBook)}
                    className="rg-btn-ghost py-3 px-5 rounded-2xl text-sm">
                    Détails — {featuredBook.discount_price || featuredBook.price} FCFA
                  </button>
                </div>
              </div>

              <div onClick={() => onSelectBook(featuredBook)}
                className="relative w-44 h-44 sm:w-56 sm:h-56 rounded-3xl overflow-hidden shadow-2xl flex-shrink-0 cursor-pointer group"
                style={{ border: '2px solid rgba(255,255,255,0.14)' }}>
                <img
                  src={
                    !featuredBook.cover_url ? 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80'
                    : featuredBook.cover_url.includes('r2.cloudflarestorage.com') && featuredBook.cover_r2_key
                      ? `/api/r2/download?key=${encodeURIComponent(featuredBook.cover_r2_key)}`
                      : featuredBook.cover_url.includes('r2.cloudflarestorage.com')
                        ? 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80'
                        : featuredBook.cover_url
                  }
                  alt={featuredBook.title}
                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80'; }}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.50)' }}>
                  <div className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #9d4edd, #f72585)' }}>
                    <Play className="w-6 h-6 fill-white ml-0.5 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 2. Catégories (dans un conteneur distinct) ── */}
      <section>
        <div className="card-lg space-y-4">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-purple-400" />
            <h2 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>Explorer par Catégorie</h2>
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

      {/* ── 3. Carrousel Tendances ── */}
      {!searchQuery && selectedCategory === 'all' && trendingBooks.length > 0 && (
        <section>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black" style={{ color: 'var(--color-text-primary)' }}>Pour Vous</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                  Sélectionnés selon vos préférences d'écoute
                </p>
              </div>
              <button onClick={() => setSelectedCategory('cat-1')}
                className="text-xs font-bold flex items-center gap-1 transition-colors"
                style={{ color: 'var(--color-rg-violet)' }}>
                Voir tout <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-stretch gap-4 overflow-x-auto pb-3 no-scrollbar">
              {trendingBooks.map((book) => (
                <AudiobookCard key={book.id} book={book} layout="carousel" onSelect={onSelectBook} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 4. Grille Principale ── */}
      <section>
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black" style={{ color: 'var(--color-text-primary)' }}>
                {searchQuery ? `Résultats pour "${searchQuery}"` : 'Tous les Livres Audio'}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                {audiobooks.length} {audiobooks.length > 1 ? 'titres disponibles' : 'titre disponible'} en haute fidélité
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="skeleton rounded-3xl h-80" />
              ))}
            </div>
          ) : audiobooks.length === 0 ? (
            <div className="text-center py-16 card-lg space-y-4">
              <Search className="w-12 h-12 mx-auto opacity-35" style={{ color: 'var(--color-text-tertiary)' }} />
              <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>Aucun livre trouvé</h3>
              <p className="text-sm max-w-sm mx-auto" style={{ color: 'var(--color-text-tertiary)' }}>
                Essayez une autre catégorie ou effectuez une nouvelle recherche.
              </p>
              <button onClick={() => setSelectedCategory('all')} className="rg-btn-primary px-5 py-2.5 rounded-full text-sm">
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
