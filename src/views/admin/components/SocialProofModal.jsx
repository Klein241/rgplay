import React from 'react';
import { Flame, X, ShieldCheck, Sparkles, Loader2, Save } from 'lucide-react';

export const SocialProofModal = ({
  socialModalBook,
  setSocialModalBook,
  socialPlays,
  setSocialPlays,
  socialReviews,
  setSocialReviews,
  socialRating,
  setSocialRating,
  isSavingSocial,
  setIsSavingSocial,
  apiClient,
  setBooks,
}) => {
  if (!socialModalBook) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-fadeIn">
      <div className="glass-card rounded-3xl w-full max-w-lg border border-amber-500/30 overflow-hidden shadow-2xl relative space-y-5 p-6">
        {/* Header de la modale */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 shadow-lg flex-shrink-0">
              <Flame className="w-5 h-5 fill-slate-950" />
            </div>
            <div>
              <h3 className="text-base font-black text-white font-['Outfit']">Effet de Masse & Preuve Sociale</h3>
              <p className="text-xs text-slate-400">Personnalisez les compteurs affichés aux visiteurs</p>
            </div>
          </div>
          <button
            onClick={() => setSocialModalBook(null)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Aperçu du Livre Sélectionné */}
        <div className="p-3 rounded-2xl bg-white/4 border border-white/8 flex items-center gap-3">
          <img
            src={socialModalBook.cover_url}
            alt={socialModalBook.title}
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=100&q=60'; }}
            className="w-12 h-12 rounded-xl object-cover border border-white/10 flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white truncate font-['Outfit']">{socialModalBook.title}</p>
            <p className="text-[11px] text-slate-400 truncate">Par {socialModalBook.author}</p>
          </div>
        </div>

        {/* Comparatif : Métriques Réelles vs Affichées */}
        <div className="grid grid-cols-2 gap-3">
          {/* 1. Réel (Admin Only) */}
          <div className="p-3 rounded-2xl bg-white/4 border border-white/6 space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-slate-400" /> Réel (Admin Seul)
            </span>
            <div className="text-xs space-y-1 text-slate-300">
              <p className="flex justify-between"><span>Vrais avis:</span> <strong className="text-white">{socialModalBook.rating_count || 0}</strong></p>
              <p className="flex justify-between"><span>Vraie note:</span> <strong className="text-amber-400">{socialModalBook.rating || 5.0}★</strong></p>
            </div>
          </div>

          {/* 2. Public (Effet de masse) */}
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 block flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" /> Affiché aux Clients
            </span>
            <div className="text-xs space-y-1 text-slate-200">
              <p className="flex justify-between"><span>Écoutes:</span> <strong className="text-amber-300">{Number(socialPlays).toLocaleString()}</strong></p>
              <p className="flex justify-between"><span>Avis:</span> <strong className="text-amber-300">{Number(socialReviews).toLocaleString()}</strong></p>
            </div>
          </div>
        </div>

        {/* Formulaire de Réglage des Chiffres Publics */}
        <div className="space-y-3.5">
          {/* Écoutes affichées */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Nombre d'Écoutes / Lectures Affichées</span>
              <span className="text-[11px] text-purple-300 font-mono font-black">{Number(socialPlays).toLocaleString()} écoutes</span>
            </label>
            <input
              type="number"
              value={socialPlays}
              onChange={(e) => setSocialPlays(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="Ex: 14500"
              className="rg-input text-xs w-full font-mono font-bold"
            />
          </div>

          {/* Avis affichés */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Nombre d'Avis Affichés</span>
              <span className="text-[11px] text-amber-300 font-mono font-black">{Number(socialReviews).toLocaleString()} avis</span>
            </label>
            <input
              type="number"
              value={socialReviews}
              onChange={(e) => setSocialReviews(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="Ex: 2800"
              className="rg-input text-xs w-full font-mono font-bold"
            />
          </div>

          {/* Note affichée */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Note Globale Affichée (sur 5.0)</span>
              <span className="text-[11px] text-amber-300 font-mono font-black">{socialRating} / 5.0</span>
            </label>
            <input
              type="number"
              step="0.05"
              min="1"
              max="5"
              value={socialRating}
              onChange={(e) => setSocialRating(parseFloat(e.target.value) || 4.9)}
              className="rg-input text-xs w-full font-mono font-bold"
            />
          </div>

          {/* Presets rapides d'Effet de Masse */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              ⚡ Remplissage Rapide en 1 Clic :
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setSocialPlays(12500); setSocialReviews(2400); setSocialRating(4.9); }}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-slate-300 text-left"
              >
                🌟 Populaire (12.5k / 2.4k avis)
              </button>
              <button
                type="button"
                onClick={() => { setSocialPlays(28000); setSocialReviews(5600); setSocialRating(4.95); }}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-slate-300 text-left"
              >
                🔥 Bestseller (28k / 5.6k avis)
              </button>
              <button
                type="button"
                onClick={() => { setSocialPlays(65000); setSocialReviews(12800); setSocialRating(4.98); }}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-slate-300 text-left"
              >
                🚀 Tendance Virale (65k / 12.8k avis)
              </button>
              <button
                type="button"
                onClick={() => { setSocialPlays(140000); setSocialReviews(28000); setSocialRating(5.0); }}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-slate-300 text-left"
              >
                👑 Culte (140k / 28k avis)
              </button>
            </div>
          </div>
        </div>

        {/* Bouton d'enregistrement */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={() => setSocialModalBook(null)}
            className="rg-btn-ghost px-4 py-2 rounded-xl text-xs font-bold"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={isSavingSocial}
            onClick={async () => {
              setIsSavingSocial(true);
              try {
                const metrics = {
                  display_plays_count: Number(socialPlays),
                  display_reviews_count: Number(socialReviews),
                  display_rating: Number(socialRating),
                };
                await apiClient.updateSocialMetrics(socialModalBook.id, metrics);
                setBooks(prev => prev.map(b => b.id === socialModalBook.id ? { ...b, ...metrics } : b));
                setSocialModalBook(null);
              } catch (e) {
                console.error('Erreur sauvegarde social metrics:', e);
              } finally {
                setIsSavingSocial(false);
              }
            }}
            className="btn-gradient px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xl shadow-amber-500/20"
          >
            {isSavingSocial ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Appliquer l'Effet de Masse</span>
          </button>
        </div>
      </div>
    </div>
  );
};
