import React from 'react';
import {
  BookOpen, Plus, Search, Sparkles, Check, ChevronRight, Wand2,
  Loader2, Edit3, Trash2, Flame, FileText, CheckCircle2, Headphones, RefreshCw,
  Image as ImageIcon
} from 'lucide-react';
import { DropZone } from '../components/DropZone';
import { formatSize } from '../utils/adminHelpers';

export const PublishEbookRubric = ({
  ebookSubTab,
  setEbookSubTab,
  ebooksList = [],
  resetEbookForm,
  editingBook,
  ebookSearch,
  setEbookSearch,
  books = [],
  setBooks,
  categories = [],
  setReadingEbook,
  setSocialModalBook,
  setSocialPlays,
  setSocialReviews,
  setSocialRating,
  handleEditEbook,
  handleDeleteBook,
  ebookStep,
  setEbookStep,
  ebookTitle,
  setEbookTitle,
  ebookAuthor,
  setEbookAuthor,
  ebookPublisher,
  setEbookPublisher,
  ebookCategoryId,
  setEbookCategoryId,
  ebookFormat,
  setEbookFormat,
  ebookPageCount,
  setEbookPageCount,
  ebookLanguage,
  setEbookLanguage,
  ebookPrice,
  setEbookPrice,
  ebookDiscountPrice,
  setEbookDiscountPrice,
  ebookUnlockPoints,
  setEbookUnlockPoints,
  ebookDescription,
  setEbookDescription,
  ebookSynopsis,
  setEbookSynopsis,
  ebookCoverData,
  setEbookCoverData,
  ebookFileData,
  setEbookFileData,
  ebookIsFeatured,
  setEbookIsFeatured,
  ebookIsPinned,
  setEbookIsPinned,
  isEbookAiGenerating,
  ebookAiSuccessMessage,
  handleDeepSeekEbookEnrich,
  ebookCompanionAudioId,
  setEbookCompanionAudioId,
  ebookMatchResult,
  setEbookMatchResult,
  isMatchingAudio,
  handleDeepSeekMatchAudio,
  isEbookSubmitting,
  handlePublishEbook,
  publishedEbookData,
  publishedEbookResult,
  apiClient,
  setActiveRubric = () => {},
}) => {
  return (
          <div className="space-y-6 animate-fadeIn">
            {/* Header de la rubrique avec Sub-Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Read's Great — Bibliothèque Numérique
                  </span>
                  <span className="text-[10px] font-bold text-amber-400">
                    ★ Liseuse PDF & EPUB
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit'] flex items-center gap-2.5">
                  <BookOpen className="w-7 h-7 text-purple-400" />
                  <span>Publier un E-Book / Livre PDF</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Consultez la liste des livres numériques publiés, ouvrez la liseuse en direct et téléversez de nouveaux PDF & EPUB.
                </p>
              </div>

              {/* Switcher d'onglets E-Books */}
              <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setEbookSubTab('list')}
                  className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                    ebookSubTab === 'list'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30 scale-[1.02]'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Livres PDF & EPUB Publiés ({ebooksList.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => { resetEbookForm(); setEbookSubTab('publish'); }}
                  className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                    ebookSubTab === 'publish'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black shadow-lg shadow-emerald-500/30 scale-[1.02]'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>{editingBook && editingBook.content_type === 'ebook' ? 'Modifier E-Book' : 'Nouveau Livre PDF'}</span>
                </button>
              </div>
            </div>

            {/* ── 1. SOUS-ONGLET : LISTE DES LIVRES PDF & EPUB PUBLIÉS ── */}
            {ebookSubTab === 'list' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Barre de Recherche E-Book */}
                <div className="card-lg space-y-4">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                      <input
                        type="text"
                        value={ebookSearch}
                        onChange={e => setEbookSearch(e.target.value)}
                        placeholder="Rechercher par titre, auteur, catégorie dans la bibliothèque Read's Great..."
                        className="rg-input w-full pl-11 pr-4 py-3 text-xs sm:text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => { resetEbookForm(); setEbookSubTab('publish'); }}
                      className="btn-gradient px-5 py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-xl whitespace-nowrap cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Publier un Livre PDF / EPUB</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-white/5">
                    <span>
                      {ebooksList.filter(b => {
                        const q = ebookSearch.toLowerCase().trim();
                        return !q || b.title?.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q) || b.category_name?.toLowerCase().includes(q);
                      }).length} livre{ebooksList.length > 1 ? 's' : ''} numérique{ebooksList.length > 1 ? 's' : ''} disponible{ebooksList.length > 1 ? 's' : ''} • Liseuse Read's Great Cloudflare D1
                    </span>
                    <span className="text-purple-400 font-bold">Gamification : 100 Pts / Livre</span>
                  </div>
                </div>

                {/* Grille des E-Books */}
                {ebooksList.filter(b => {
                  const q = ebookSearch.toLowerCase().trim();
                  return !q || b.title?.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q) || b.category_name?.toLowerCase().includes(q);
                }).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {ebooksList.filter(b => {
                      const q = ebookSearch.toLowerCase().trim();
                      return !q || b.title?.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q) || b.category_name?.toLowerCase().includes(q);
                    }).map((book) => {
                      const isEpub = book.format === 'epub' || book.pdf_url?.toLowerCase().endsWith('.epub');
                      return (
                        <div
                          key={book.id}
                          className="group relative rounded-3xl p-5 bg-gradient-to-b from-white/[0.07] to-white/[0.02] hover:from-white/[0.12] hover:to-white/[0.04] border border-white/10 hover:border-purple-500/40 transition-all duration-300 shadow-xl flex flex-col justify-between gap-4"
                        >
                          <div>
                            <div className="flex items-start gap-4">
                              {/* Couverture */}
                              <div className="relative w-24 h-32 rounded-2xl overflow-hidden shadow-2xl border border-white/10 shrink-0 group-hover:scale-105 transition-transform duration-300">
                                <img
                                  src={book.cover_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80'}
                                  alt={book.title}
                                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80'; }}
                                  className="w-full h-full object-cover"
                                />
                                <span className={`absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase text-white shadow-md ${
                                  isEpub ? 'bg-indigo-600' : 'bg-rose-600'
                                }`}>
                                  {isEpub ? 'EPUB' : 'PDF HD'}
                                </span>
                              </div>

                              {/* Infos E-Book */}
                              <div className="flex-1 min-w-0">
                                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block truncate">
                                  {book.category_name || 'Read\'s Great'}
                                </span>
                                <h3 className="text-base font-extrabold text-white truncate mt-0.5 font-['Outfit'] group-hover:text-purple-300 transition-colors">
                                  {book.title}
                                </h3>
                                <p className="text-xs text-purple-200 truncate mt-0.5">
                                  Par <span className="font-semibold text-white">{book.author}</span>
                                </p>
                                
                                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                                  <span className="px-2 py-0.5 rounded-lg bg-white/6 border border-white/8 text-[10px] text-slate-300 font-bold">
                                    📖 {book.page_count || 180} pages
                                  </span>
                                  <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-[10px] text-amber-300 font-black">
                                    ⭐ {book.unlock_points || 100} Pts
                                  </span>
                                  <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[10px] text-emerald-300 font-bold">
                                    {Number(book.price) === 0 ? 'Gratuit' : `${book.price} FCFA`}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Description / Synopsis */}
                            {book.description && (
                              <p className="text-xs text-slate-400 mt-3 line-clamp-2 leading-relaxed">
                                {book.description}
                              </p>
                            )}
                          </div>

                          {/* Barre d'Actions E-Book */}
                          <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                            {/* Bouton Lire / Liseuse */}
                            <button
                              type="button"
                              onClick={() => {
                                if (book.pdf_url) {
                                  setReadingEbook(book);
                                } else {
                                  alert('Aucun fichier PDF/EPUB lié à cet ouvrage.');
                                }
                              }}
                              className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/30 transition-all cursor-pointer active:scale-95"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>Ouvrir Liseuse</span>
                            </button>

                            {/* Bouton Épingler */}
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                const newPinned = !book.is_pinned;
                                setBooks(prev => prev.map(b => b.id === book.id ? { ...b, is_pinned: newPinned ? 1 : 0 } : b));
                                await apiClient.togglePinAudiobook(book.id, newPinned);
                              }}
                              className={`p-2 rounded-xl border text-xs transition-all active:scale-95 cursor-pointer ${
                                book.is_pinned
                                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                  : 'bg-white/5 hover:bg-amber-500/15 text-slate-400 hover:text-amber-300 border-white/10'
                              }`}
                              title={book.is_pinned ? 'Désépingler' : 'Épingler en haut'}
                            >
                              📌
                            </button>

                            {/* Bouton Effet de Masse */}
                            <button
                              type="button"
                              onClick={() => {
                                setSocialModalBook(book);
                                setSocialPlays(book.display_plays_count || (book.rating_count ? book.rating_count * 8 : 14200));
                                setSocialReviews(book.display_reviews_count || (book.rating_count ? book.rating_count : 2800));
                                setSocialRating(book.display_rating || book.rating || 4.95);
                              }}
                              className="p-2 rounded-xl border bg-white/5 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border-white/10 hover:border-amber-500/40 transition-all active:scale-95 cursor-pointer"
                              title="Effet de masse (Lectures & Avis)"
                            >
                              <Flame className="w-4 h-4 text-amber-400" />
                            </button>

                            {/* Bouton Éditer */}
                            <button
                              type="button"
                              onClick={() => handleEditEbook(book)}
                              className="p-2 rounded-xl border bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border-white/10 hover:border-cyan-500/40 transition-all active:scale-95 cursor-pointer"
                              title="Modifier cet E-Book"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {/* Bouton Supprimer */}
                            <button
                              type="button"
                              onClick={() => handleDeleteBook(book.id, book.title)}
                              className="p-2 rounded-xl border bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border-white/10 hover:border-rose-500/40 transition-all active:scale-95 cursor-pointer"
                              title="Supprimer cet E-Book"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Empty state */
                  <div className="card-lg text-center py-16 space-y-4">
                    <div className="w-20 h-20 rounded-3xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto text-purple-400 shadow-xl shadow-purple-500/10">
                      <BookOpen className="w-10 h-10" />
                    </div>
                    <div className="max-w-md mx-auto">
                      <h3 className="text-lg font-bold text-white">Aucun E-Book ou Livre PDF trouvé</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Publiez des ouvrages numériques PDF ou EPUB pour la bibliothèque Read's Great ou générez-les automatiquement via Manus IA / MCP.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { resetEbookForm(); setEbookSubTab('publish'); }}
                      className="btn-gradient px-6 py-3 rounded-2xl text-xs font-black inline-flex items-center gap-2 shadow-xl cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Publier mon premier E-Book & PDF</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── 2. SOUS-ONGLET : FORMULAIRE DE PUBLICATION STEPPER ── */}
            {ebookSubTab === 'publish' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setEbookSubTab('list')}
                    className="rg-btn-ghost px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>← Retour aux E-Books publiés ({ebooksList.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={resetEbookForm}
                    className="rg-btn-ghost px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Réinitialiser Formulaire</span>
                  </button>
                </div>

            {/* Stepper Read's Great */}
            <div
              className="p-2 sm:p-3 rounded-3xl flex items-center justify-between gap-2 backdrop-blur-xl"
              style={{
                background: 'rgba(14, 10, 34, 0.85)',
                border: '1px solid rgba(168, 85, 247, 0.25)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.40)',
              }}
            >
              {[
                { n: 1, label: '1. Fichier PDF/EPUB & Pochette' },
                { n: 2, label: '2. Métadonnées & Synopsis IA' },
                { n: 3, label: '3. Points & Tarification' },
                { n: 4, label: '4. Validation & Publication' },
              ].map((s) => (
                <button
                  key={s.n}
                  onClick={() => ebookStep > s.n && setEbookStep(s.n)}
                  className={`flex-1 py-3 px-2 sm:px-4 rounded-2xl text-xs font-black transition-all duration-300 text-center font-['Outfit'] tracking-wide cursor-pointer ${
                    ebookStep === s.n
                      ? 'text-white shadow-xl scale-[1.02]'
                      : ebookStep > s.n
                        ? 'text-purple-300 bg-white/6 hover:bg-purple-500/15'
                        : 'text-slate-500 bg-transparent opacity-60'
                  }`}
                  style={
                    ebookStep === s.n
                      ? {
                          background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)',
                          border: '1px solid rgba(255, 255, 255, 0.3)',
                          boxShadow: '0 8px 24px rgba(168, 85, 247, 0.40)',
                        }
                      : { border: '1px solid transparent' }
                  }
                >
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden font-black">Étape {s.n}</span>
                </button>
              ))}
            </div>

            {/* ── ÉTAPE 1 : FICHIERS & POCHETTE ── */}
            {ebookStep === 1 && (
              <div className="card-lg space-y-6 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-white font-['Outfit'] flex items-center gap-2">
                      <FileText className="w-5 h-5 text-purple-400" />
                      <span>Fichier Numérique & Couverture HD</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Glissez votre document (.pdf ou .epub) et sa pochette illustrée.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Uploader Fichier PDF / EPUB */}
                  <div className="space-y-3">
                    <DropZone
                      label="Document du Livre (PDF HD ou EPUB)"
                      accept=".pdf,.epub,application/pdf,application/epub+zip"
                      type="ebook"
                      icon={FileText}
                      value={ebookFileData?.public_url}
                      onUploaded={(data) => {
                        setEbookFileData(data);
                        if (!ebookTitle && data.file_name) {
                          const cleanName = data.file_name.replace(/\.(pdf|epub)$/i, '').replace(/[-_]/g, ' ');
                          setEbookTitle(cleanName);
                        }
                        if (data.format) setEbookFormat(data.format);
                      }}
                    />

                    {ebookFileData && (
                      <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/30 text-xs text-purple-200 space-y-1">
                        <div className="flex items-center justify-between font-bold text-white">
                          <span>✓ Fichier prêt pour la liseuse</span>
                          <span className="uppercase text-purple-400 font-mono">{ebookFileData.format || 'PDF'}</span>
                        </div>
                        <p className="text-[11px] text-slate-300">Taille : {ebookFileData.size_mb}</p>
                      </div>
                    )}
                  </div>

                  {/* Uploader Pochette HD */}
                  <div className="space-y-3">
                    <DropZone
                      label="Pochette / Couverture du Livre (3:4 ou Carré)"
                      accept="image/jpeg,image/png,image/webp"
                      type="cover"
                      icon={ImageIcon}
                      value={ebookCoverData?.public_url}
                      onUploaded={(data) => setEbookCoverData(data)}
                    />

                    {ebookCoverData && (
                      <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-200">
                        <span>✓ Image optimisée en WebP HD pour la liseuse</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      if (!ebookFileData?.public_url) {
                        alert("Veuillez téléverser le fichier PDF ou EPUB avant de continuer.");
                        return;
                      }
                      setEbookStep(2);
                    }}
                    className="btn-gradient px-8 py-3.5 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer shadow-xl shadow-purple-900/40"
                  >
                    <span>Passer aux Métadonnées & Synopsis</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ── ÉTAPE 2 : MÉTADONNÉES & IA ── */}
            {ebookStep === 2 && (
              <div className="card-lg space-y-6 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-white font-['Outfit']">
                      Métadonnées, Auteur & Synopsis
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Renseignez les détails bibliographiques de l'ouvrage ou laissez DeepSeek IA enrichir le contenu.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleDeepSeekEbookEnrich}
                    disabled={isEbookAiGenerating}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {isEbookAiGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Wand2 className="w-4 h-4" />
                    )}
                    <span>{isEbookAiGenerating ? 'Génération IA...' : '✨ Générer Synopsis avec IA'}</span>
                  </button>
                </div>

                {ebookAiSuccessMessage && (
                  <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{ebookAiSuccessMessage}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Titre de l'E-Book *</label>
                    <input
                      type="text"
                      value={ebookTitle}
                      onChange={(e) => setEbookTitle(e.target.value)}
                      placeholder="Ex: Les Clés de l'Émergence Financière"
                      className="rg-input w-full px-4 py-3 rounded-2xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Auteur(e) / Auteurs *</label>
                    <input
                      type="text"
                      value={ebookAuthor}
                      onChange={(e) => setEbookAuthor(e.target.value)}
                      placeholder="Ex: Dr. Christian Ndongo"
                      className="rg-input w-full px-4 py-3 rounded-2xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Éditeur / Maison d'édition</label>
                    <input
                      type="text"
                      value={ebookPublisher}
                      onChange={(e) => setEbookPublisher(e.target.value)}
                      placeholder="Ex: Éditions Read's Great"
                      className="rg-input w-full px-4 py-3 rounded-2xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Catégorie / Univers</label>
                    <select
                      value={ebookCategoryId}
                      onChange={(e) => setEbookCategoryId(e.target.value)}
                      className="rg-input w-full px-4 py-3 rounded-2xl text-sm"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Format de Lecture</label>
                    <select
                      value={ebookFormat}
                      onChange={(e) => setEbookFormat(e.target.value)}
                      className="rg-input w-full px-4 py-3 rounded-2xl text-sm"
                    >
                      <option value="pdf" className="bg-slate-900 text-white">📄 PDF Haute Définition (Pagination Fixe)</option>
                      <option value="epub" className="bg-slate-900 text-white">📗 EPUB Fluide (Mise en page dynamique)</option>
                      <option value="hybrid" className="bg-slate-900 text-white">🔥 Pack Hybride (E-Book + Audio)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">Nombre de Pages</label>
                      <input
                        type="number"
                        value={ebookPageCount}
                        onChange={(e) => setEbookPageCount(Number(e.target.value))}
                        className="rg-input w-full px-4 py-3 rounded-2xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">Langue</label>
                      <select
                        value={ebookLanguage}
                        onChange={(e) => setEbookLanguage(e.target.value)}
                        className="rg-input w-full px-4 py-3 rounded-2xl text-sm"
                      >
                        <option value="fr" className="bg-slate-900 text-white">Français</option>
                        <option value="en" className="bg-slate-900 text-white">English</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Description / Pitch du Livre</label>
                  <textarea
                    rows={3}
                    value={ebookDescription}
                    onChange={(e) => setEbookDescription(e.target.value)}
                    placeholder="Présentation générale du livre pour la vitrine de la bibliothèque..."
                    className="rg-input w-full px-4 py-3 rounded-2xl text-sm resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Sommaire & Table des matières</label>
                  <textarea
                    rows={3}
                    value={ebookSynopsis}
                    onChange={(e) => setEbookSynopsis(e.target.value)}
                    placeholder="Chapitre 1 — ..., Chapitre 2 — ..., Points clés abordés..."
                    className="rg-input w-full px-4 py-3 rounded-2xl text-sm resize-none"
                  />
                </div>

                {/* ── ASSOCIATION COMPAGNON AUDIO RG PLAY & DEEPSEEK IA (OPTIONNEL) ── */}
                <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-purple-950/40 via-indigo-950/25 to-black/40 border border-purple-500/30 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 flex-shrink-0">
                        <Headphones className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                          <span>Association Livre Audio RG Play</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                            Optionnel
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Par défaut, cet e-book est 100% autonome. Vous pouvez lui relier un livre audio existant ou laisser DeepSeek IA trouver le match.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDeepSeekMatchAudio}
                      disabled={isMatchingAudio}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
                    >
                      {isMatchingAudio ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      )}
                      <span>{isMatchingAudio ? 'Analyse DeepSeek...' : '🧠 Associer par DeepSeek IA'}</span>
                    </button>
                  </div>

                  {/* Résultat d'analyse DeepSeek */}
                  {ebookMatchResult && (
                    <div className={`p-3.5 rounded-2xl border text-xs space-y-2 ${
                      ebookMatchResult.matched
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                        : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                    }`}>
                      <div className="flex items-start gap-2">
                        <span className="text-base">{ebookMatchResult.matched ? '🎯' : '💡'}</span>
                        <div className="flex-1">
                          <p className="font-bold">
                            {ebookMatchResult.matched
                              ? `Correspondance trouvée : « ${ebookMatchResult.companion?.title} » (${Math.round((ebookMatchResult.confidence || 0.9) * 100)}% de certitude)`
                              : 'Aucune version audio identique trouvée — Recommandations IA du même genre :'}
                          </p>
                          <p className="text-[11px] opacity-80 mt-0.5">{ebookMatchResult.reason}</p>
                        </div>
                      </div>

                      {/* Recommandations alternatives si pas de match exact */}
                      {!ebookMatchResult.matched && ebookMatchResult.recommendations?.length > 0 && (
                        <div className="pt-2 border-t border-amber-500/20 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {ebookMatchResult.recommendations.map(rec => (
                            <button
                              key={rec.id}
                              type="button"
                              onClick={() => setEbookCompanionAudioId(rec.id)}
                              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                ebookCompanionAudioId === rec.id
                                  ? 'bg-amber-500/30 border-amber-400 text-white'
                                  : 'bg-black/30 border-white/10 hover:border-amber-400/50 text-slate-300'
                              }`}
                            >
                              <div className="font-bold truncate text-[11px]">🎧 {rec.title}</div>
                              <div className="text-[10px] text-slate-400 truncate">{rec.author} • {rec.reason}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sélecteur Manuel de Livre Audio */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      Sélectionner le livre audio lié du catalogue RG Play :
                    </label>
                    <select
                      value={ebookCompanionAudioId}
                      onChange={(e) => setEbookCompanionAudioId(e.target.value)}
                      className="rg-input w-full px-4 py-3 rounded-2xl text-xs sm:text-sm"
                    >
                      <option value="">🚫 Aucun livre audio lié (E-Book Read's Great pur et autonome)</option>
                      {books.filter(b => b.content_type !== 'ebook' && b.id !== editingBook?.id).map((b) => (
                        <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                          🎧 {b.title} — Par {b.author} ({b.category_name || 'RG Play'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setEbookStep(1)}
                    className="rg-btn-ghost px-6 py-3 rounded-2xl text-xs font-bold cursor-pointer"
                  >
                    ← Retour
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!ebookTitle.trim() || !ebookAuthor.trim()) {
                        alert("Veuillez renseigner au moins le titre et l'auteur.");
                        return;
                      }
                      setEbookStep(3);
                    }}
                    className="btn-gradient px-8 py-3.5 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer shadow-xl shadow-purple-900/40"
                  >
                    <span>Passer à la Tarification & Points</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ── ÉTAPE 3 : TARIFS & GAMIFICATION ── */}
            {ebookStep === 3 && (
              <div className="card-lg space-y-6 animate-fadeIn">
                <div className="border-b border-white/10 pb-4">
                  <h3 className="text-base font-bold text-white font-['Outfit']">
                    Tarification, Gamification & Visibilité
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Fixez les conditions d'accès : déblocage par points Read's Great ou achat en FCFA.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Points Read's Great */}
                  <div className="p-4 rounded-3xl bg-purple-950/40 border border-purple-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-purple-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span>Points de Déblocage Gratuit</span>
                      </label>
                      <span className="text-xs font-bold text-amber-400">Read's Great</span>
                    </div>
                    <input
                      type="number"
                      value={ebookUnlockPoints}
                      onChange={(e) => setEbookUnlockPoints(Number(e.target.value))}
                      className="rg-input w-full px-4 py-3 rounded-2xl text-sm"
                      placeholder="100"
                    />
                    <p className="text-[11px] text-purple-300/80">
                      Les membres peuvent débloquer cet ouvrage sans payer en utilisant leurs points accumulés en lisant.
                    </p>
                  </div>

                  {/* Prix FCFA */}
                  <div className="p-4 rounded-3xl bg-emerald-950/30 border border-emerald-500/30 space-y-2">
                    <label className="text-xs font-black text-emerald-300 uppercase tracking-wider block">
                      Prix Achat Direct (FCFA)
                    </label>
                    <input
                      type="number"
                      value={ebookPrice}
                      onChange={(e) => setEbookPrice(e.target.value)}
                      className="rg-input w-full px-4 py-3 rounded-2xl text-sm"
                      placeholder="0 (Gratuit) ou 2000"
                    />
                    <p className="text-[11px] text-emerald-300/80">
                      Mettez 0 pour un livre 100% gratuit, ou un montant en FCFA pour achat Mobile Money.
                    </p>
                  </div>
                </div>

                {/* Options de visibilité */}
                <div className="p-4 rounded-3xl bg-white/5 border border-white/10 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Mise en avant dans la bibliothèque</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={ebookIsFeatured}
                        onChange={(e) => setEbookIsFeatured(e.target.checked)}
                        className="w-4 h-4 accent-purple-600 rounded"
                      />
                      <div>
                        <span className="text-xs font-bold text-white block">⭐ Recommander à la Une</span>
                        <span className="text-[10px] text-slate-400">Affiche le livre en bannière vedette en haut de page</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={ebookIsPinned}
                        onChange={(e) => setEbookIsPinned(e.target.checked)}
                        className="w-4 h-4 accent-purple-600 rounded"
                      />
                      <div>
                        <span className="text-xs font-bold text-white block">🔥 Épingler en tête de catalogue</span>
                        <span className="text-[10px] text-slate-400">Positionne l'ouvrage en première position</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setEbookStep(2)}
                    className="rg-btn-ghost px-6 py-3 rounded-2xl text-xs font-bold cursor-pointer"
                  >
                    ← Retour
                  </button>

                  <button
                    type="button"
                    onClick={() => setEbookStep(4)}
                    className="btn-gradient px-8 py-3.5 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer shadow-xl shadow-purple-900/40"
                  >
                    <span>Vérifier & Publier</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ── ÉTAPE 4 : VALIDATION & PUBLICATION ── */}
            {ebookStep === 4 && (
              <div className="card-lg space-y-6 animate-fadeIn">
                {!publishedEbookData ? (
                  <>
                    <div className="border-b border-white/10 pb-4">
                      <h3 className="text-base font-bold text-white font-['Outfit']">
                        Aperçu Réel Avant Mise en Ligne
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Voici exactement comment cet e-book apparaîtra dans la bibliothèque Read's Great.
                      </p>
                    </div>

                    {/* Carte Preview Live */}
                    <div className="max-w-md mx-auto p-4 rounded-3xl bg-gradient-to-br from-[#1c0d38] to-[#120724] border border-purple-500/30 shadow-2xl space-y-4">
                      <div className="flex gap-4">
                        <div className="relative w-24 h-32 rounded-2xl overflow-hidden border border-white/10 shrink-0 shadow-lg">
                          <img
                            src={ebookCoverData?.public_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&q=70'}
                            alt="preview"
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-md bg-purple-950/85 text-[9px] font-black text-purple-300 uppercase">
                            {ebookFormat.toUpperCase()} HD
                          </span>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                          <div>
                            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                              {categories.find(c => c.id === ebookCategoryId)?.name || 'E-Books & PDF'}
                            </span>
                            <h4 className="text-sm font-bold text-white truncate mt-0.5">{ebookTitle || 'Titre du Livre'}</h4>
                            <p className="text-xs text-[#a78bfa] truncate mt-0.5">{ebookAuthor || 'Auteur Read’s Great'}</p>
                            <p className="text-[10px] text-slate-400 mt-1">{ebookPageCount} pages • {ebookUnlockPoints} Pts ⭐</p>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                            <span>{Number(ebookPrice) === 0 ? 'Gratuit avec Points' : `${ebookPrice} FCFA`}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Lire le Livre 📖</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => setEbookStep(3)}
                        disabled={isEbookSubmitting}
                        className="rg-btn-ghost px-6 py-3 rounded-2xl text-xs font-bold cursor-pointer disabled:opacity-50"
                      >
                        ← Modifier
                      </button>

                      <button
                        type="button"
                        onClick={handlePublishEbook}
                        disabled={isEbookSubmitting}
                        className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-sm flex items-center gap-2 cursor-pointer shadow-xl shadow-emerald-950/50 active:scale-95 disabled:opacity-50"
                      >
                        {isEbookSubmitting ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                            <span>Publication sur Cloudflare D1...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-5 h-5" />
                            <span>Confirmer & Publier l'E-Book 🚀</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  /* Écran Succès de Publication */
                  <div className="text-center py-10 space-y-5 animate-fadeIn">
                    <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400 shadow-2xl shadow-emerald-500/30">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>

                    <div>
                      <h3 className="text-2xl font-black text-white font-['Outfit']">
                        E-Book Publié avec Succès !
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-md mx-auto">
                        « <span className="font-bold text-purple-300">{publishedEbookData.title}</span> » est désormais en ligne dans la bibliothèque Read's Great et accessible sur tous les appareils.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setActiveRubric('catalog')}
                        className="rg-btn-ghost px-6 py-3 rounded-2xl text-xs font-bold cursor-pointer"
                      >
                        Voir dans le Catalogue
                      </button>

                      <button
                        type="button"
                        onClick={resetEbookForm}
                        className="btn-gradient px-6 py-3 rounded-2xl text-xs font-bold cursor-pointer shadow-lg"
                      >
                        + Publier un Autre E-Book
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
              </div>
            )}
          </div>
  );
};
