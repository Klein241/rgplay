import React, { useState, useEffect } from 'react';
import { 
  BookMarked, Play, Clock, CheckCircle2, Heart, Download, 
  Sparkles, RotateCcw, AlertCircle, Headphones, Trash2, X
} from 'lucide-react';
import { apiClient } from '../services/api';
import { useAudio } from '../context/AudioContext';

export const LibraryView = ({ onSelectBook, onGoToDiscover }) => {
  const [libraryBooks, setLibraryBooks] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all', 'in_progress', 'completed', 'favorites'
  const [isLoading, setIsLoading] = useState(true);

  const { playBook, currentBook, isPlaying, formatTime } = useAudio();

  const loadLibrary = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getLibrary();
      setLibraryBooks(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLibrary();
    window.addEventListener('rg:library-updated', loadLibrary);
    return () => window.removeEventListener('rg:library-updated', loadLibrary);
  }, []);

  const handleRemove = async (e, bookId, bookTitle) => {
    e.stopPropagation();
    if (window.confirm(`Voulez-vous retirer "${bookTitle}" de votre bibliothèque ?`)) {
      await apiClient.removeFromLibrary(bookId);
      setLibraryBooks(prev => prev.filter(b => b.id !== bookId));
    }
  };

  const handleToggleFav = async (e, bookId) => {
    e.stopPropagation();
    await apiClient.toggleFavorite(bookId);
    setLibraryBooks(prev => prev.map(b => b.id === bookId ? { ...b, is_favorite: !b.is_favorite } : b));
  };

  // Calcul du temps total écouté réel
  const totalSecondsListened = libraryBooks.reduce((sum, b) => sum + (b.position_seconds || 0), 0);
  const hoursListened = Math.floor(totalSecondsListened / 3600);
  const minutesListened = Math.floor((totalSecondsListened % 3600) / 60);

  const filteredBooks = libraryBooks.filter((book) => {
    if (filter === 'in_progress') return (book.completed_percentage || 0) < 95;
    if (filter === 'completed') return (book.completed_percentage || 0) >= 95 || book.is_completed;
    if (filter === 'favorites') return Boolean(book.is_favorite);
    return true;
  });

  return (
    <div className="space-y-6 pb-28 md:pb-20 animate-fadeIn">
      {/* En-tête de la bibliothèque avec statistiques d'écoute réelles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card rounded-3xl p-6 border border-purple-500/20">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/40">
            <BookMarked className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white font-['Outfit']">Ma Bibliothèque</h1>
            <p className="text-xs text-slate-400">
              Synchronisée en temps réel sur tous vos appareils
            </p>
          </div>
        </div>

        {/* Badges de stats rapides réelles */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-center">
            <span className="text-xs text-slate-400 block">Livres Achetés</span>
            <span className="text-sm font-extrabold text-white">{libraryBooks.length}</span>
          </div>
          <div className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-center">
            <span className="text-xs text-slate-400 block">Temps Écouté</span>
            <span className="text-sm font-extrabold text-purple-300">
              {hoursListened > 0 ? `${hoursListened}h ${minutesListened}m` : `${minutesListened} min`}
            </span>
          </div>
        </div>
      </div>

      {/* Onglets de filtrage */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'all', label: 'Tous les livres', count: libraryBooks.length },
          { id: 'in_progress', label: 'En cours d\'écoute', count: libraryBooks.filter(b => (b.completed_percentage || 0) < 95).length },
          { id: 'completed', label: 'Terminés', count: libraryBooks.filter(b => (b.completed_percentage || 0) >= 95 || b.is_completed).length },
          { id: 'favorites', label: 'Favoris ❤️', count: libraryBooks.filter(b => Boolean(b.is_favorite)).length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              filter === tab.id
                ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-md shadow-purple-600/30'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
            }`}
          >
            <span>{tab.label}</span>
            <span className="text-[10px] opacity-75">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Liste des livres dans la bibliothèque */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div key={n} className="h-32 rounded-3xl glass-card animate-pulse bg-white/5" />
          ))}
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="text-center py-16 glass-card rounded-3xl border border-white/5 space-y-4">
          <Headphones className="w-12 h-12 mx-auto text-purple-400 opacity-50" />
          <div>
            <h3 className="text-base font-bold text-white">Aucun livre dans cette section</h3>
            <p className="text-xs text-slate-400 mt-1">Découvrez notre catalogue et enrichissez votre bibliothèque.</p>
          </div>
          <button
            onClick={onGoToDiscover}
            className="btn-gradient px-6 py-2.5 rounded-full text-xs font-bold shadow-lg"
          >
            Explorer la boutique
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {filteredBooks.map((book) => {
            const isCurrentPlaying = currentBook?.id === book.id && isPlaying;
            const percent = book.completed_percentage || 0;

            return (
              <div
                key={book.id}
                onClick={() => onSelectBook(book)}
                className="glass-card rounded-3xl p-4 sm:p-5 border border-purple-500/20 hover:border-purple-500/40 cursor-pointer flex flex-col justify-between group transition-all relative"
              >
                <div>
                  <div className="flex gap-4">
                    {/* Jaquette */}
                    <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shadow-lg flex-shrink-0">
                      <img
                        src={
                          !book.cover_url ? 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80'
                          : book.cover_url.includes('r2.cloudflarestorage.com') && book.cover_r2_key
                            ? `/api/r2/download?key=${encodeURIComponent(book.cover_r2_key)}`
                            : book.cover_url.includes('r2.cloudflarestorage.com')
                              ? 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80'
                              : book.cover_url
                        }
                        alt={book.title}
                        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80'; }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          playBook(book, 0, book.position_seconds || 0);
                        }}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg">
                          <Play className="w-4 h-4 fill-white ml-0.5" />
                        </div>
                      </button>
                    </div>

                    {/* Informations */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                          {book.category_name || 'Audiobook'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {percent >= 95 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Terminé
                            </span>
                          )}
                          {/* Bouton Favori */}
                          <button
                            onClick={(e) => handleToggleFav(e, book.id)}
                            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 transition-colors"
                            title={book.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                          >
                            <Heart className={`w-3.5 h-3.5 ${book.is_favorite ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
                          </button>
                          {/* Bouton Enlever de la bibliothèque */}
                          <button
                            onClick={(e) => handleRemove(e, book.id, book.title)}
                            className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Retirer de ma bibliothèque"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-white line-clamp-1 group-hover:text-purple-300 transition-colors">
                        {book.title}
                      </h3>
                      <p className="text-xs text-slate-400 truncate">Par {book.author}</p>
                      
                      <p className="text-[11px] text-purple-300 font-medium truncate mt-1">
                        {book.current_chapter_title || 'Chapitre 1'}
                      </p>
                    </div>
                  </div>

                  {/* Barre de Progression d'Écoute */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-[11px] font-semibold text-slate-400">
                      <span>Progression</span>
                      <span className="text-slate-200">{percent}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Bouton de reprise d'écoute directe */}
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Position : {formatTime(book.position_seconds || 0)}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playBook(book, 0, book.position_seconds || 0);
                    }}
                    className="px-4 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white font-bold text-xs flex items-center gap-2 border border-purple-500/40 transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Reprendre ({formatTime(book.position_seconds || 0)})</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
