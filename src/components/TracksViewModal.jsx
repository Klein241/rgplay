import React, { useState } from 'react';
import { Search, Menu, Play, Pause, ChevronLeft, X } from 'lucide-react';
import { useAudio } from '../context/AudioContext';

export const TracksViewModal = ({ isOpen, onClose, onSelectBook }) => {
  const { currentBook, isPlaying, togglePlay, playBook, selectChapter, currentChapterIndex } = useAudio();
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const chapters = currentBook?.chapters || [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0d0618] text-slate-100 flex flex-col justify-between animate-fadeIn select-none p-4 sm:p-6">
      
      {/* ── EN-TÊTE SUPÉRIEUR (@iSalmanArt Screen 4) ── */}
      <header className="flex items-center justify-between pb-4 border-b border-purple-500/20">
        <button
          onClick={onClose}
          className="p-2.5 rounded-full hover:bg-white/10 text-[#c4b0e8] hover:text-white transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <h2 className="text-sm sm:text-base font-black tracking-widest text-[#e9d5ff] uppercase font-display">
          CHAPITRES & TITRES
        </h2>

        <button
          onClick={onClose}
          className="p-2.5 rounded-full hover:bg-white/10 text-[#c4b0e8] hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full space-y-6 py-4">
        
        {/* ── SECTION 1 : AJOUTÉS RÉCEMMENT (@iSalmanArt Screen 4) ── */}
        <section className="space-y-3">
          <h3 className="text-xs font-black tracking-widest text-[#e9d5ff] uppercase font-display">
            RÉCEMMENT AJOUTÉS
          </h3>

          <div className="grid grid-cols-3 gap-3">
            {chapters.slice(0, 3).map((ch, idx) => (
              <div
                key={ch.id || idx}
                onClick={() => selectChapter(idx)}
                className="cursor-pointer group text-center"
              >
                <div className="relative aspect-square rounded-2xl overflow-hidden mb-1.5 border border-purple-500/30 group-hover:border-purple-400 shadow-md">
                  <img
                    src={currentBook?.cover_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80'}
                    alt={ch.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <p className="text-[11px] font-bold text-white truncate">
                  {ch.title || `Chapitre ${idx + 1}`}
                </p>
                <p className="text-[9.5px] text-[#c4b0e8] truncate">
                  :: {currentBook?.author || '2026'} ::
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 2 : TOUS LES TITRES (@iSalmanArt Screen 4) ── */}
        <section className="space-y-3 pt-2">
          <h3 className="text-xs font-black tracking-widest text-[#e9d5ff] uppercase font-display">
            TOUS LES CHAPITRES
          </h3>

          <div className="space-y-2">
            {chapters.map((ch, idx) => {
              const isCurrent = currentChapterIndex === idx;
              return (
                <div
                  key={ch.id || idx}
                  onClick={() => selectChapter(idx)}
                  className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${
                    isCurrent
                      ? 'bg-gradient-to-r from-[#34185d]/90 to-[#200d3a]/90 border border-purple-400/50 shadow-md'
                      : 'hover:bg-[#200d3a]/60 border border-purple-500/10'
                  }`}
                >
                  {/* Left info & animated equalizer if current */}
                  <div className="min-w-0 flex-1 pr-4">
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                      {ch.title || `Chapitre ${idx + 1}`}
                    </h4>
                    <p className="text-[11px] text-[#a78bfa] mt-0.5">
                      {currentBook?.author || 'Auteur'} • {Math.round((ch.duration_seconds || 1800) / 60)}:00
                    </p>

                    {/* Equalizer bars under track text */}
                    {isCurrent && (
                      <div className="flex items-end gap-1 mt-2 h-3.5">
                        <span className="w-1 rounded-full bg-purple-400 eq-bar-1" />
                        <span className="w-1 rounded-full bg-cyan-300 eq-bar-2" />
                        <span className="w-1 rounded-full bg-purple-300 eq-bar-3" />
                        <span className="w-1 rounded-full bg-pink-400 eq-bar-4" />
                        <span className="w-1 rounded-full bg-purple-400 eq-bar-5" />
                      </div>
                    )}
                  </div>

                  {/* Right Thumbnail */}
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-purple-500/30 shadow-md">
                    <img
                      src={currentBook?.cover_url}
                      alt={ch.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </main>

    </div>
  );
};
