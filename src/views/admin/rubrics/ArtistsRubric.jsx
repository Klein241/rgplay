import React, { useState, useEffect } from 'react';
import {
  Mic, Plus, Trash2, Edit3, ExternalLink, Copy, Check, Search,
  Disc, Music, Sparkles, Image as ImageIcon, Link as LinkIcon,
  Play, ShieldCheck, ChevronDown, ChevronRight, X, AlertCircle
} from 'lucide-react';
import { artistApi, DEFAULT_ARTIST_VICTOIRE_K } from '../../../services/api/artistApi';

export const ArtistsRubric = ({ books = [] }) => {
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingArtist, setEditingArtist] = useState(null);
  const [copiedSlug, setCopiedSlug] = useState(null);
  const [notification, setNotification] = useState(null);

  // Charger la liste des artistes
  const loadArtists = async () => {
    setLoading(true);
    try {
      const list = await artistApi.getArtists();
      setArtists(list || [DEFAULT_ARTIST_VICTOIRE_K]);
    } catch (_) {
      setArtists([DEFAULT_ARTIST_VICTOIRE_K]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArtists();
  }, []);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleCopyLink = (slug) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://rg-play-10s.pages.dev';
    const link = `${origin}/artiste/${slug}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedSlug(slug);
      showNotification(`Lien copié : ${link}`);
      setTimeout(() => setCopiedSlug(null), 2500);
    });
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Confirmer la suppression définitive de l'artiste "${name}" ?`)) return;
    await artistApi.deleteArtist(id);
    showNotification(`Artiste "${name}" supprimé`);
    loadArtists();
  };

  const handleOpenCreate = () => {
    setEditingArtist({
      id: '',
      name: '',
      slug: '',
      tagline: '',
      bio: '',
      photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
      cover_url: '',
      albums: [
        { id: `alb-${Date.now()}`, title: 'Premier Album', type: 'album', year: '2026', cover_url: '' }
      ],
      tracks: [
        {
          id: `trk-${Date.now()}`,
          title: 'Titre 1',
          album: 'Premier Album',
          duration: '03:30',
          audio_url: '',
          cover_url: ''
        }
      ]
    });
  };

  const handleSaveForm = async (e) => {
    e.preventDefault();
    if (!editingArtist.name || !editingArtist.slug) {
      showNotification('Le nom et le lien (slug) sont obligatoires', 'error');
      return;
    }

    try {
      await artistApi.saveArtist(editingArtist);
      showNotification(`Artiste "${editingArtist.name}" enregistré avec succès !`);
      setEditingArtist(null);
      loadArtists();
    } catch (err) {
      showNotification(`Erreur : ${err.message}`, 'error');
    }
  };

  const filteredArtists = artists.filter(a =>
    a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.slug?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Toast de notification */}
      {notification && (
        <div className={`p-4 rounded-2xl flex items-center justify-between text-sm font-bold shadow-xl border animate-fade-in ${
          notification.type === 'error'
            ? 'bg-red-500/15 border-red-500/30 text-red-300'
            : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
        }`}>
          <span>{notification.msg}</span>
          <button onClick={() => setNotification(null)} className="p-1 hover:bg-white/10 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Rubrique */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-purple-950/40 via-purple-900/20 to-slate-900/60 border border-purple-500/20 backdrop-blur-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Expérience VIP Studio
            </span>
            <span className="text-xs text-slate-400">Design Pure Music Player</span>
          </div>
          <h2 className="text-2xl font-black text-white font-['Outfit'] tracking-tight flex items-center gap-2.5">
            <Mic className="w-6 h-6 text-purple-400" />
            Pages Artistes & Discographies
          </h2>
          <p className="text-xs text-slate-300 max-w-xl">
            Créez des pages vitrines immersives et personnalisées pour vos artistes. Chaque page dispose de son propre lien public direct (ex: <code className="text-purple-300 bg-purple-950/60 px-1.5 py-0.5 rounded">/artiste/victoireK</code>) avec lecteur circulaire automatique, gestion des albums et grille de titres en 2 colonnes.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-500 text-white font-black text-xs hover:scale-105 active:scale-95 transition-all shadow-lg shadow-purple-500/25 cursor-pointer font-['Outfit']"
        >
          <Plus className="w-4 h-4" />
          Créer un Nouvel Artiste
        </button>
      </div>

      {/* Barre de recherche */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un artiste par nom ou lien..."
          className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-purple-400/50 transition-all font-['Outfit']"
        />
      </div>

      {/* Liste des Artistes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredArtists.map((artist) => {
          const trackCount = artist.tracks?.length || 0;
          const albumCount = artist.albums?.length || 0;
          return (
            <div
              key={artist.id || artist.slug}
              className="p-5 rounded-3xl bg-gradient-to-br from-slate-900/80 via-purple-950/20 to-slate-900/90 border border-white/10 hover:border-purple-500/30 transition-all group flex flex-col justify-between gap-4"
            >
              <div className="flex items-start gap-4">
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-purple-950/60 border border-purple-500/30 flex-shrink-0">
                  <img
                    src={artist.photo_url || DEFAULT_ARTIST_VICTOIRE_K.photo_url}
                    alt={artist.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-all"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white font-['Outfit'] truncate">
                      {artist.name}
                    </h3>
                    <ShieldCheck className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  </div>
                  <p className="text-[11px] text-purple-300/80 truncate font-mono">
                    /artiste/{artist.slug}
                  </p>
                  <p className="text-xs text-slate-400 line-clamp-1 mt-1">
                    {artist.tagline || artist.bio}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 font-bold">
                    <span className="flex items-center gap-1">
                      <Disc className="w-3.5 h-3.5 text-purple-400" />
                      {albumCount} album{albumCount > 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <Music className="w-3.5 h-3.5 text-indigo-400" />
                      {trackCount} titre{trackCount > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-white/5 text-xs">
                <button
                  onClick={() => handleCopyLink(artist.slug)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer font-['Outfit']"
                >
                  {copiedSlug === artist.slug ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Lien Copié !</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copier le Lien</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <a
                    href={`/artiste/${artist.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-white transition-all"
                    title="Voir la page publique"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => setEditingArtist(artist)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
                    title="Modifier"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  {artist.slug !== 'victoireK' && (
                    <button
                      onClick={() => handleDelete(artist.id, artist.name)}
                      className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all cursor-pointer"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL DE CRÉATION / MODIFICATION ARTISTE */}
      {editingArtist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 to-purple-950 border border-purple-500/30 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-purple-500/20 text-purple-300">
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white font-['Outfit']">
                    {editingArtist.id ? "Modifier l'Artiste" : "Créer une Nouvelle Page Artiste"}
                  </h3>
                  <p className="text-xs text-slate-400">Configurez l'identité, les albums et les titres</p>
                </div>
              </div>
              <button
                onClick={() => setEditingArtist(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                    Nom de l'artiste *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingArtist.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      const slug = editingArtist.slug || name.replace(/[^a-zA-Z0-9]/g, '');
                      setEditingArtist({ ...editingArtist, name, slug });
                    }}
                    placeholder="Ex: Victoire K"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                    Slug URL Unique * (ex: /artiste/slug)
                  </label>
                  <input
                    type="text"
                    required
                    value={editingArtist.slug}
                    onChange={(e) => setEditingArtist({ ...editingArtist, slug: e.target.value.replace(/\s+/g, '') })}
                    placeholder="Ex: victoireK"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Tagline / Sous-titre
                </label>
                <input
                  type="text"
                  value={editingArtist.tagline || ''}
                  onChange={(e) => setEditingArtist({ ...editingArtist, tagline: e.target.value })}
                  placeholder="Ex: Artiste Chanteuse & Auteure-Compositrice"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Photo de l'Artiste (Portrait URL)
                </label>
                <div className="flex gap-3 items-center">
                  <input
                    type="url"
                    value={editingArtist.photo_url || ''}
                    onChange={(e) => setEditingArtist({ ...editingArtist, photo_url: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-400"
                  />
                  {editingArtist.photo_url && (
                    <img
                      src={editingArtist.photo_url}
                      alt="Aperçu"
                      className="w-10 h-10 rounded-xl object-cover border border-purple-500/40"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Biographie
                </label>
                <textarea
                  rows="2"
                  value={editingArtist.bio || ''}
                  onChange={(e) => setEditingArtist({ ...editingArtist, bio: e.target.value })}
                  placeholder="Présentation de l'artiste..."
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-400 resize-none"
                />
              </div>

              {/* Résumé Albums & Titres */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <Music className="w-4 h-4 text-purple-400" />
                    Chansons & Discographie ({editingArtist.tracks?.length || 0} titres)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const newTrack = {
                        id: `trk-${Date.now()}`,
                        title: `Titre ${(editingArtist.tracks?.length || 0) + 1}`,
                        artist: editingArtist.name || 'Artiste',
                        album: editingArtist.albums?.[0]?.title || 'Single',
                        duration: '03:40',
                        duration_seconds: 220,
                        audio_url: 'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/no_curator/Tours/Enthusiast/Tours_-_01_-_Enthusiast.mp3',
                        cover_url: editingArtist.photo_url
                      };
                      setEditingArtist({
                        ...editingArtist,
                        tracks: [...(editingArtist.tracks || []), newTrack]
                      });
                    }}
                    className="text-[11px] font-bold text-purple-300 hover:text-white flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Ajouter un Titre
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {(editingArtist.tracks || []).map((t, i) => (
                    <div key={t.id || i} className="flex items-center gap-2 text-xs bg-black/40 p-2.5 rounded-xl border border-white/5">
                      <span className="w-5 text-center text-slate-500 font-mono text-[10px]">{i + 1}</span>
                      <input
                        type="text"
                        value={t.title}
                        onChange={(e) => {
                          const updated = [...editingArtist.tracks];
                          updated[i].title = e.target.value;
                          setEditingArtist({ ...editingArtist, tracks: updated });
                        }}
                        className="flex-1 bg-transparent border-none text-white text-xs font-bold focus:outline-none"
                        placeholder="Titre de la chanson"
                      />
                      <input
                        type="text"
                        value={t.duration || '03:30'}
                        onChange={(e) => {
                          const updated = [...editingArtist.tracks];
                          updated[i].duration = e.target.value;
                          setEditingArtist({ ...editingArtist, tracks: updated });
                        }}
                        className="w-14 text-center bg-transparent border-none text-slate-400 text-[11px] font-mono focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = editingArtist.tracks.filter((_, idx) => idx !== i);
                          setEditingArtist({ ...editingArtist, tracks: updated });
                        }}
                        className="text-red-400/60 hover:text-red-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bouton Enregistrer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingArtist(null)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold font-['Outfit']"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-purple-500/25 font-['Outfit']"
                >
                  Enregistrer l'Artiste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
