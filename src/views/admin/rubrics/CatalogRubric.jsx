import {
  Plus, Search, LayoutGrid, List, BookOpen, Pause, Play,
  Flame, Edit3, Trash2, Clock, Send
} from 'lucide-react';

export const CatalogRubric = ({
  books = [],
  setBooks,
  loadingBooks = false,
  catalogSearch = '',
  setCatalogSearch,
  catalogTypeFilter = 'all',
  setCatalogTypeFilter,
  catalogViewMode = 'grid',
  setCatalogViewMode,
  filteredBooks = [],
  previewingBookId,
  setPreviewingBookId,
  catalogAudioRef,
  resetPublishForm,
  setActiveRubric,
  handleEditBook,
  handleDeleteBook,
  handlePublishImmediately,
  setSocialModalBook,
  setSocialPlays,
  setSocialReviews,
  setSocialRating,
  apiClient,
}) => {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header de la rubrique */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black text-white font-['Outfit'] tracking-tight">
            Catalogue & Audios
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
            {books.length} contenu{books.length > 1 ? 's' : ''} en ligne • Synchronisé avec Cloudflare D1
          </p>
        </div>
        <button
          onClick={() => { resetPublishForm('audiobook'); setActiveRubric('publish'); }}
          className="btn-gradient px-6 py-3.5 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 shadow-2xl active:scale-95 transition-all"
        >
          <Plus className="w-4.5 h-4.5" />
          <span>Publier un Nouveau Titre</span>
        </button>
      </div>

      {/* Barre de Recherche & Filtres avec Switcher Cartes / Liste */}
      <div className="card-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              value={catalogSearch}
              onChange={e => setCatalogSearch(e.target.value)}
              placeholder="Rechercher par titre ou auteur dans le catalogue..."
              className="rg-input pl-12 pr-4 py-3.5 rounded-2xl text-sm w-full"
            />
          </div>

          {/* Switcher Mode Vue : Cartes vs Liste */}
          <div className="flex items-center gap-1 bg-white/5 p-1.5 rounded-2xl border border-white/10 self-end sm:self-auto">
            <button
              onClick={() => setCatalogViewMode('grid')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                catalogViewMode === 'grid'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title="Affichage en petites cartes"
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Petites Cartes</span>
            </button>
            <button
              onClick={() => setCatalogViewMode('list')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                catalogViewMode === 'list'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title="Affichage en liste détaillée"
            >
              <List className="w-4 h-4" />
              <span>Liste</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'all', label: 'Tous', icon: '🌟', count: books.length },
            { id: 'scheduled', label: 'Programmés', icon: '⏰', count: books.filter(b => b.status === 'scheduled').length },
            { id: 'audiobook', label: 'Livres Audio', icon: '📚', count: books.filter(b => !b.content_type || b.content_type === 'audiobook').length },
            { id: 'ebook', label: 'E-Books PDF', icon: '📖', count: books.filter(b => b.content_type === 'ebook' || b.pdf_url).length },
            { id: 'hybrid', label: 'Pack Hybride', icon: '🔥', count: books.filter(b => b.content_type === 'hybrid').length },
            { id: 'podcast', label: 'Podcasts', icon: '🎙️', count: books.filter(b => b.content_type === 'podcast').length },
            { id: 'music', label: 'Musique & Lofi', icon: '🎵', count: books.filter(b => b.content_type === 'music').length },
            { id: 'masterclass', label: 'Masterclasses', icon: '🎓', count: books.filter(b => b.content_type === 'masterclass').length },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setCatalogTypeFilter(f.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                catalogTypeFilter === f.id
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400'
                  : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/8'
              }`}
            >
              <span>{f.icon}</span>
              <span>{f.label}</span>
              <span className="text-[10px] opacity-70 px-1.5 py-0.2 rounded-full bg-black/30 font-mono">{f.count}</span>
            </button>
          ))}
        </div>

        {/* Table / Grille des Livres */}
        {loadingBooks ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4">
            {[1, 2, 3, 4, 5].map(n => <div key={n} className="skeleton h-60 rounded-2xl" />)}
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <BookOpen className="w-14 h-14 mx-auto text-slate-600 opacity-60" />
            <p className="text-base text-slate-300 font-bold font-['Outfit']">Aucun contenu trouvé</p>
            <button onClick={() => setCatalogSearch('')} className="rg-btn-ghost text-xs px-4 py-2 rounded-xl">
              Effacer la recherche
            </button>
          </div>
        ) : catalogViewMode === 'grid' ? (
          /* ── 1. AFFICHAGE EN PETITES CARTES (GRID) ── */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4">
            {filteredBooks.map((book) => {
              const isPreviewing = previewingBookId === book.id;
              return (
                <div
                  key={book.id}
                  className="flex flex-col justify-between rounded-2xl p-3 transition-all duration-300 group relative overflow-hidden"
                  style={{
                    background: isPreviewing
                      ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.22), rgba(168, 85, 247, 0.15))'
                      : 'rgba(255, 255, 255, 0.035)',
                    border: isPreviewing
                      ? '1px solid rgba(168, 85, 247, 0.50)'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: isPreviewing ? '0 8px 30px rgba(168, 85, 247, 0.25)' : 'none',
                  }}
                >
                  {/* Cover avec ratio carré et bouton preview */}
                  <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2.5 bg-slate-900 border border-white/10">
                    <img
                      src={book.cover_url}
                      alt={book.title}
                      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=400&q=80'; }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Badges au-dessus de la cover */}
                    <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none gap-1 flex-wrap">
                      {Boolean(book.is_pinned) ? (
                        <span className="rg-badge bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-md border border-amber-300/40 text-[10px] px-2 py-0.5">
                          📌 Épinglé
                        </span>
                      ) : book.status === 'scheduled' && book.scheduled_at ? (
                        <span className="rg-badge bg-amber-500/90 text-slate-950 border border-amber-300/50 text-[9px] px-1.5 py-0.5 font-black flex items-center gap-0.5 shadow-md">
                          <Clock className="w-2.5 h-2.5" />
                          <span>Programmé</span>
                        </span>
                      ) : <span />}
                      {Boolean(book.is_featured) && (
                        <span className="rg-badge rg-badge--pink text-[10px] px-1.5 py-0.5">À la une</span>
                      )}
                    </div>

                    {/* Play / Pause button overlay */}
                    <button
                      onClick={() => {
                        if (isPreviewing) {
                          catalogAudioRef.current?.pause();
                          setPreviewingBookId(null);
                        } else {
                          setPreviewingBookId(book.id);
                          if (catalogAudioRef.current) {
                            catalogAudioRef.current.src = book.preview_url || book.chapters?.[0]?.audio_url || '';
                            catalogAudioRef.current.play();
                          }
                        }
                      }}
                      className={`absolute bottom-2 right-2 p-2 rounded-xl border backdrop-blur-md transition-all duration-200 active:scale-90 ${
                        isPreviewing
                          ? 'bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-500/40'
                          : 'bg-black/60 hover:bg-black/80 text-white border-white/20 opacity-90 group-hover:opacity-100'
                      }`}
                      title="Écouter l'extrait"
                    >
                      {isPreviewing ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white ml-0.5" />}
                    </button>
                  </div>

                  {/* Détails du livre */}
                  <div className="space-y-1 min-w-0 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider truncate">
                          {book.content_type === 'podcast' ? '🎙️ Podcast' :
                            book.content_type === 'music' ? '🎵 Musique' :
                              book.content_type === 'masterclass' ? '🎓 Masterclass' :
                                (book.category_name || 'Livre Audio')}
                        </span>
                      </div>
                      <h3 className="text-xs sm:text-sm font-extrabold text-white truncate font-['Outfit'] group-hover:text-purple-300 transition-colors" title={book.title}>
                        {book.title}
                      </h3>
                      <p className="text-[11px] text-slate-400 truncate" title={book.author}>
                        {book.author}
                      </p>
                    </div>

                    <div className="pt-2 mt-auto">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-emerald-400 font-extrabold">
                          {book.discount_price || book.price} FCFA
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {book.chapters?.length || 1} ch.
                        </span>
                      </div>

                      {/* Bouton Publication Immédiate si le livre est programmé */}
                      {book.status === 'scheduled' && (
                        <button
                          onClick={() => handlePublishImmediately?.(book)}
                          className="w-full mb-1.5 py-1 px-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-[10px] flex items-center justify-center gap-1 shadow-md active:scale-95 transition-all cursor-pointer"
                          title="Publier immédiatement pour tous les utilisateurs"
                        >
                          <Send className="w-3 h-3" />
                          <span>Publier maintenant</span>
                        </button>
                      )}

                      {/* Barre d'actions compacte (4 boutons) */}
                      <div className="grid grid-cols-4 gap-1 pt-1.5 border-t border-white/5">
                        {/* Épingler */}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const newPinned = !book.is_pinned;
                            setBooks(prev => prev.map(b => b.id === book.id ? { ...b, is_pinned: newPinned ? 1 : 0 } : b));
                            await apiClient.togglePinAudiobook(book.id, newPinned);
                          }}
                          className={`p-1.5 rounded-lg border text-center font-bold text-xs transition-all active:scale-95 flex items-center justify-center ${
                            book.is_pinned
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                              : 'bg-white/5 hover:bg-amber-500/15 text-slate-400 hover:text-amber-300 border-white/10'
                          }`}
                          title={book.is_pinned ? 'Désépingler cet audio' : 'Épingler cet audio en tête'}
                        >
                          <span>📌</span>
                        </button>

                        {/* Effet de masse / Social Proof */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSocialModalBook(book);
                            setSocialPlays(book.display_plays_count || (book.rating_count ? book.rating_count * 8 : 12500));
                            setSocialReviews(book.display_reviews_count || (book.rating_count ? book.rating_count : 2400));
                            setSocialRating(book.display_rating || book.rating || 4.9);
                          }}
                          className="p-1.5 rounded-lg border bg-white/5 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border-white/10 hover:border-amber-500/40 transition-all active:scale-95 flex items-center justify-center"
                          title="Personnaliser l'effet de masse (Écoutes & Avis affichés)"
                        >
                          <Flame className="w-3.5 h-3.5 text-amber-400" />
                        </button>

                        {/* Éditer */}
                        <button
                          onClick={() => handleEditBook(book)}
                          className="p-1.5 rounded-lg border bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border-white/10 hover:border-cyan-500/40 transition-all active:scale-95 flex items-center justify-center"
                          title="Modifier ce livre"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* Supprimer */}
                        <button
                          onClick={() => handleDeleteBook(book.id, book.title)}
                          className="p-1.5 rounded-lg border bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border-white/10 hover:border-rose-500/40 transition-all active:scale-95 flex items-center justify-center"
                          title="Supprimer ce livre"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── 2. AFFICHAGE EN LISTE DÉTAILLÉE (LIST) ── */
          <div className="space-y-3">
            {filteredBooks.map((book) => {
              const isPreviewing = previewingBookId === book.id;
              return (
                <div
                  key={book.id}
                  className="p-4 sm:p-5 rounded-2xl transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
                  style={{
                    background: isPreviewing
                      ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.18), rgba(168, 85, 247, 0.12))'
                      : 'rgba(255, 255, 255, 0.035)',
                    border: isPreviewing
                      ? '1px solid rgba(168, 85, 247, 0.50)'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: isPreviewing ? '0 8px 30px rgba(168, 85, 247, 0.20)' : 'none',
                  }}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="relative flex-shrink-0">
                      <img
                        src={book.cover_url}
                        alt={book.title}
                        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=400&q=80'; }}
                        className="w-16 h-16 rounded-2xl object-cover shadow-lg border border-white/10 group-hover:scale-105 transition-transform duration-300"
                      />
                      {isPreviewing && (
                        <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                          <span className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-ping" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {Boolean(book.is_pinned) && (
                          <span className="rg-badge bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-md border border-amber-300/40">
                            📌 Épinglé en tête
                          </span>
                        )}
                        {book.status === 'scheduled' && book.scheduled_at && (
                          <span className="rg-badge bg-amber-500/20 text-amber-300 border border-amber-400/40 font-bold flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span>Programmé : {new Date(book.scheduled_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </span>
                        )}
                        <span className="rg-badge rg-badge--purple">
                          {book.content_type === 'podcast' ? '🎙️ Podcast' :
                            book.content_type === 'music' ? '🎵 Musique' :
                              book.content_type === 'masterclass' ? '🎓 Masterclass' :
                                (book.category_name || 'Livre Audio')}
                        </span>
                        {Boolean(book.is_featured) && <span className="rg-badge rg-badge--pink">À la une</span>}
                        {Boolean(book.is_bestseller) && <span className="rg-badge rg-badge--amber">Bestseller</span>}
                      </div>
                      <h3 className="text-base sm:text-lg font-extrabold text-white truncate font-['Outfit'] group-hover:text-purple-300 transition-colors">
                        {book.title}
                      </h3>
                      <p className="text-xs text-slate-400 truncate">
                        Par <span className="text-slate-200 font-semibold">{book.author}</span> • {book.chapters?.length || 1} chapitre(s) • <span className="text-emerald-400 font-bold">{book.discount_price || book.price} FCFA</span>
                      </p>
                    </div>
                  </div>

                  {/* Actions boutons */}
                  <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0 flex-wrap sm:flex-nowrap">
                    {/* Bouton Publication Immédiate si le livre est programmé */}
                    {book.status === 'scheduled' && (
                      <button
                        onClick={() => handlePublishImmediately?.(book)}
                        className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer"
                        title="Publier immédiatement pour tous les utilisateurs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Publier maintenant</span>
                      </button>
                    )}

                    {/* Bouton Épingler */}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const newPinned = !book.is_pinned;
                        setBooks(prev => prev.map(b => b.id === book.id ? { ...b, is_pinned: newPinned ? 1 : 0 } : b));
                        await apiClient.togglePinAudiobook(book.id, newPinned);
                      }}
                      className={`px-3 py-2.5 rounded-xl border font-black text-xs transition-all duration-200 flex items-center gap-1.5 active:scale-95 ${
                        book.is_pinned
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-lg shadow-amber-500/20'
                          : 'bg-white/5 hover:bg-amber-500/15 text-slate-400 hover:text-amber-300 border-white/10'
                      }`}
                      title={book.is_pinned ? 'Désépingler cet audio' : 'Épingler cet audio en haut du catalogue'}
                    >
                      <span className="text-sm">📌</span>
                      <span className="hidden sm:inline">
                        {book.is_pinned ? 'Épinglé' : 'Épingler'}
                      </span>
                    </button>

                    {/* Bouton Effet de masse */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSocialModalBook(book);
                        setSocialPlays(book.display_plays_count || (book.rating_count ? book.rating_count * 8 : 12500));
                        setSocialReviews(book.display_reviews_count || (book.rating_count ? book.rating_count : 2400));
                        setSocialRating(book.display_rating || book.rating || 4.9);
                      }}
                      className="p-2.5 rounded-xl border bg-white/5 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border-white/10 hover:border-amber-500/40 transition-all duration-200 active:scale-95"
                      title="Personnaliser l'effet de masse (Écoutes & Avis affichés)"
                    >
                      <Flame className="w-4.5 h-4.5 text-amber-400" />
                    </button>

                    {/* Bouton Pré-écoute */}
                    <button
                      onClick={() => {
                        if (isPreviewing) {
                          catalogAudioRef.current?.pause();
                          setPreviewingBookId(null);
                        } else {
                          setPreviewingBookId(book.id);
                          if (catalogAudioRef.current) {
                            catalogAudioRef.current.src = book.preview_url || book.chapters?.[0]?.audio_url || '';
                            catalogAudioRef.current.play();
                          }
                        }
                      }}
                      className={`p-2.5 rounded-xl border transition-all duration-200 active:scale-95 ${
                        isPreviewing
                          ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-500/30'
                          : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/10'
                      }`}
                      title="Écouter l'extrait"
                    >
                      {isPreviewing ? <Pause className="w-4.5 h-4.5 fill-white" /> : <Play className="w-4.5 h-4.5 fill-white ml-0.5" />}
                    </button>

                    {/* Bouton Éditer */}
                    <button
                      onClick={() => handleEditBook(book)}
                      className="p-2.5 rounded-xl border bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border-white/10 hover:border-cyan-500/40 transition-all duration-200 active:scale-95"
                      title="Modifier ce livre"
                    >
                      <Edit3 className="w-4.5 h-4.5" />
                    </button>

                    {/* Bouton Supprimer */}
                    <button
                      onClick={() => handleDeleteBook(book.id, book.title)}
                      className="p-2.5 rounded-xl border bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border-white/10 hover:border-rose-500/40 transition-all duration-200 active:scale-95"
                      title="Supprimer ce livre"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <audio ref={catalogAudioRef} onEnded={() => setPreviewingBookId(null)} className="hidden" />
    </div>
  );
};
