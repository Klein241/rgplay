import React from 'react';
import { FolderPlus, Save, Edit3, Trash2, Sparkles, Loader2 } from 'lucide-react';

/**
 * Rubrique Catalogues & Catégories
 * Props : categories, books, state et handlers issus du host AdminStudioView
 */
export const CategoriesRubric = ({
  categories,
  books,
  editingCat,
  setEditingCat,
  newCatName,
  setNewCatName,
  newCatSlug,
  setNewCatSlug,
  newCatColor,
  setNewCatColor,
  newCatIcon,
  setNewCatIcon,
  isSavingCat,
  handleSaveCategory,
  handleDeleteCategory,
}) => (
  <div className="space-y-6 animate-fadeIn">
    <div>
      <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">
        Gestion des Catalogues &amp; Catégories
      </h1>
      <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
        Créez, personnalisez et organisez les rayons thématiques du catalogue
      </p>
    </div>

    {/* Formulaire de Création / Modification */}
    <div className="card-lg space-y-4">
      <h2 className="text-sm font-bold text-white flex items-center gap-2">
        <FolderPlus className="w-4 h-4 text-purple-400" />
        <span>{editingCat ? 'Modifier le Catalogue' : 'Ajouter un Nouveau Catalogue / Catégorie'}</span>
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="text-xs font-bold text-slate-300 block mb-1.5">Nom du Catalogue</label>
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="Ex: Entrepreneuriat Africain"
            className="rg-input"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-300 block mb-1.5">Identifiant Unique (Slug)</label>
          <input
            type="text"
            value={newCatSlug}
            onChange={(e) => setNewCatSlug(e.target.value)}
            placeholder="Ex: entrepreneuriat-afrique"
            className="rg-input"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-300 block mb-1.5">Icône Illustrative</label>
          <select
            value={newCatIcon}
            onChange={(e) => setNewCatIcon(e.target.value)}
            className="rg-input cursor-pointer"
            style={{ background: '#16112e' }}
          >
            <option value="Sparkles">Sparkles (Découverte / Magie)</option>
            <option value="TrendingUp">TrendingUp (Business &amp; Finance)</option>
            <option value="Cpu">Cpu (Tech &amp; IA)</option>
            <option value="Brain">Brain (Psychologie &amp; Esprit)</option>
            <option value="Shield">Shield (Histoire &amp; Stratégie)</option>
            <option value="BookOpen">BookOpen (Romans &amp; Fiction)</option>
            <option value="Headphones">Headphones (Audiobooks Généraux)</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-300 block mb-1.5">Couleur Thématique</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={newCatColor}
              onChange={(e) => setNewCatColor(e.target.value)}
              className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0"
            />
            <input
              type="text"
              value={newCatColor}
              onChange={(e) => setNewCatColor(e.target.value)}
              className="rg-input flex-1 font-mono text-xs"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2.5 pt-2">
        {editingCat && (
          <button
            onClick={() => {
              setEditingCat(null);
              setNewCatName('');
              setNewCatSlug('');
            }}
            className="rg-btn-ghost px-4 py-2 text-xs font-bold"
          >
            Annuler
          </button>
        )}
        <button
          onClick={handleSaveCategory}
          disabled={isSavingCat || !newCatName.trim()}
          className="btn-gradient px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
        >
          {isSavingCat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>{editingCat ? 'Mettre à jour' : 'Enregistrer le Catalogue'}</span>
        </button>
      </div>
    </div>

    {/* Liste des Catalogues Existants */}
    <div className="card-lg space-y-4">
      <h2 className="text-sm font-bold text-white flex items-center justify-between">
        <span>Rayons &amp; Catalogues Actifs ({categories.length})</span>
        <span className="text-xs text-slate-400 font-normal">Synchronisé avec D1</span>
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map((cat) => {
          const bookCount = books.filter(b => b.category_id === cat.id || b.category_name === cat.name).length;
          return (
            <div
              key={cat.id}
              className="p-4 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-between gap-3 group hover:border-purple-500/30 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg text-white font-bold"
                  style={{ background: cat.color || '#9d4edd' }}
                >
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-white truncate">{cat.name}</h3>
                  <p className="text-[11px] text-slate-400">{bookCount} livre{bookCount > 1 ? 's' : ''}</p>
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                <button
                  onClick={() => {
                    setEditingCat(cat);
                    setNewCatName(cat.name);
                    setNewCatSlug(cat.slug || '');
                    setNewCatColor(cat.color || '#9d4edd');
                    setNewCatIcon(cat.icon || 'Sparkles');
                  }}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
                  title="Modifier"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                {cat.id !== 'all' && (
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);
