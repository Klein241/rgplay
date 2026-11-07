import React, { useState } from 'react';
import {
  ListMusic, Heart, Shuffle, Disc, Music, Play, Pause,
  ChevronDown, Check, Smartphone, Volume2, ChevronLeft, ChevronRight
} from 'lucide-react';

/**
 * ArtistDiscographyGrid - Rendu exact de l'écran 2 (Discographie & Liste)
 */
export const ArtistDiscographyGrid = ({
  artist,
  currentTrack,
  isPlaying,
  onSelectTrack,
  onTogglePlay,
  isShuffle,
  onToggleShuffle,
  onBackToPlayer,
}) => {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'favorites'
  const [selectedAlbumFilter, setSelectedAlbumFilter] = useState('all');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const albums = artist.albums || [];
  const allTracks = artist.tracks || [];

  const filteredTracks = allTracks.filter((track) => {
    if (activeTab === 'favorites' && !track.is_favorite) return false;
    if (selectedAlbumFilter !== 'all' && track.album_id !== selectedAlbumFilter && track.album !== selectedAlbumFilter) {
      return false;
    }
    return true;
  });

  const selectedAlbumObj = albums.find(a => a.id === selectedAlbumFilter || a.title === selectedAlbumFilter);
  const dropdownLabel = selectedAlbumFilter === 'all'
    ? 'Tous les Albums & Singles'
    : (selectedAlbumObj?.title || selectedAlbumFilter);

  return (
    <div className="w-full max-w-sm sm:max-w-md mx-auto space-y-4 select-none px-3 pt-2 pb-24">
      {/* ── HAUT DE L'ÉCRAN 2 : EN-TÊTE COMPACT AVEC MINI ARCHE ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToPlayer}
          className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          title="Retour au lecteur immersif"
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
        </button>

        <span className="text-[11px] font-black uppercase tracking-widest text-purple-300 font-['Outfit']">
          Discographie Complète
        </span>

        <button
          onClick={onBackToPlayer}
          className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          title="Fermer"
        >
          <ChevronRight className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {/* Mini Arche en haut de l'écran 2 comme sur le modèle */}
      <div className="relative flex flex-col items-center justify-center pt-1 pb-3">
        <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-purple-500/30 shadow-xl">
          <img
            src={currentTrack?.cover_url || artist.photo_url}
            alt={artist.name}
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        </div>

        <div className="text-center mt-2">
          <h3 className="text-sm font-black text-white font-['Outfit'] truncate max-w-[240px]">
            {currentTrack?.title || 'Emmanuel'}
          </h3>
          <p className="text-[10px] text-purple-300/80 font-medium">
            {currentTrack?.artist || artist.name}
          </p>
        </div>
      </div>

      {/* ── BARRE DE CONTRÔLE : SHUFFLE ET MENU DÉROULANT DES ALBUMS ── */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onToggleShuffle}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
            isShuffle
              ? 'bg-purple-500/25 text-purple-300 border border-purple-500/50'
              : 'text-slate-400 hover:text-white bg-white/5 border border-white/10'
          }`}
          title="Lecture aléatoire"
        >
          <Shuffle className="w-3.5 h-3.5" />
          <span>Aléatoire</span>
        </button>

        {/* Sélecteur déroulant des albums */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/8 hover:bg-white/15 border border-white/15 text-[11px] font-bold text-white transition-all cursor-pointer shadow-lg"
          >
            <Disc className="w-3.5 h-3.5 text-purple-400" />
            <span className="max-w-[140px] truncate">{dropdownLabel}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDropdownOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-64 rounded-2xl p-2 z-50 backdrop-blur-2xl border border-white/15 shadow-2xl space-y-1 animate-fade-in"
              style={{
                background: 'linear-gradient(160deg, rgba(25, 14, 40, 0.98) 0%, rgba(10, 5, 20, 0.98) 100%)',
              }}
            >
              <button
                onClick={() => {
                  setSelectedAlbumFilter('all');
                  setIsDropdownOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                  selectedAlbumFilter === 'all'
                    ? 'bg-purple-500/25 text-purple-300 border border-purple-500/40'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span>Tous les morceaux ({allTracks.length})</span>
                {selectedAlbumFilter === 'all' && <Check className="w-3.5 h-3.5 text-purple-400" />}
              </button>

              <div className="my-1 border-t border-white/10" />

              {albums.map((alb) => {
                const count = allTracks.filter(t => t.album_id === alb.id || t.album === alb.title).length;
                const isSelected = selectedAlbumFilter === alb.id || selectedAlbumFilter === alb.title;
                return (
                  <button
                    key={alb.id}
                    onClick={() => {
                      setSelectedAlbumFilter(alb.id);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-purple-500/25 text-purple-300 border border-purple-500/40'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/40">
                        {alb.type || 'Album'}
                      </span>
                      <span className="truncate">{alb.title}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono ml-2">({count})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── ONGLETS : ALL MUSICS & FAVORITES ── */}
      <div className="flex items-center gap-6 border-b border-white/10 pb-2 text-xs font-black font-['Outfit']">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 pb-1.5 transition-all cursor-pointer relative ${
            activeTab === 'all' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ListMusic className="w-4 h-4 text-purple-400" />
          <span>All Musics</span>
          {activeTab === 'all' && (
            <span className="absolute -bottom-2 inset-x-0 h-0.5 bg-gradient-to-r from-purple-400 to-indigo-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('favorites')}
          className={`flex items-center gap-2 pb-1.5 transition-all cursor-pointer relative ${
            activeTab === 'favorites' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Heart className={`w-4 h-4 ${activeTab === 'favorites' ? 'text-red-400 fill-current' : 'text-slate-400'}`} />
          <span>Favorites</span>
          {activeTab === 'favorites' && (
            <span className="absolute -bottom-2 inset-x-0 h-0.5 bg-gradient-to-r from-red-400 to-purple-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]" />
          )}
        </button>
      </div>

      {/* ── LISTE / CARTES EN 2 COLONNES (2-COLUMN CARDS) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {filteredTracks.map((track) => {
          const isThisPlaying = currentTrack?.id === track.id;
          return (
            <div
              key={track.id}
              onClick={() => {
                if (isThisPlaying) {
                  onTogglePlay();
                } else {
                  onSelectTrack(track);
                }
              }}
              className={`group relative p-2.5 rounded-2xl transition-all duration-300 cursor-pointer flex items-center justify-between gap-3 border ${
                isThisPlaying
                  ? 'bg-gradient-to-r from-purple-900/40 via-purple-950/50 to-slate-900/60 border-purple-500/50 shadow-lg shadow-purple-500/20'
                  : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/8 hover:border-white/15'
              }`}
              style={{ backdropFilter: 'blur(16px)' }}
            >
              <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-purple-950/60 border border-white/10 flex-shrink-0">
                <img
                  src={track.cover_url || artist.photo_url}
                  alt={track.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className={`absolute inset-0 flex items-center justify-center bg-black/40 ${
                  isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                } transition-opacity`}>
                  {isThisPlaying && isPlaying ? (
                    <div className="flex items-end gap-0.5 h-3.5">
                      <span className="w-0.5 bg-purple-300 animate-[bounce_0.6s_infinite] h-2.5" />
                      <span className="w-0.5 bg-purple-300 animate-[bounce_0.8s_infinite] h-3.5" />
                      <span className="w-0.5 bg-purple-300 animate-[bounce_0.5s_infinite] h-2" />
                    </div>
                  ) : (
                    <Play className="w-3.5 h-3.5 text-white fill-current" />
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0 pr-1">
                <h4 className={`text-xs font-black font-['Outfit'] truncate ${
                  isThisPlaying ? 'text-purple-200' : 'text-white'
                }`}>
                  {track.title}
                </h4>
                <p className="text-[10px] text-slate-400 flex items-center gap-1 truncate mt-0.5 font-medium">
                  <Smartphone className="w-2.5 h-2.5 text-purple-400/80 flex-shrink-0" />
                  <span className="truncate">{track.artist || artist.name}</span>
                  {isThisPlaying && isPlaying && (
                    <span className="inline-flex items-end gap-0.5 h-2.5 ml-1 flex-shrink-0">
                      <span className="w-0.5 bg-purple-400 animate-[bounce_0.6s_infinite] h-2" />
                      <span className="w-0.5 bg-purple-400 animate-[bounce_0.8s_infinite] h-2.5" />
                      <span className="w-0.5 bg-purple-400 animate-[bounce_0.5s_infinite] h-1.5" />
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] font-mono text-slate-400">
                  {track.duration || '03:30'}
                </span>
                <div className="flex flex-col gap-0.5 opacity-60 group-hover:opacity-100">
                  <span className="w-3 h-0.5 bg-white/70 rounded-full" />
                  <span className="w-3 h-0.5 bg-white/70 rounded-full" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
