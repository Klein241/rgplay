import React from 'react';
import { X, Gauge, Check } from 'lucide-react';
import { useAudio } from '../context/AudioContext';

export const SpeedSelectorModal = ({ isOpen, onClose }) => {
  const { playbackRate, changePlaybackRate } = useAudio();

  if (!isOpen) return null;

  const speeds = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="glass-card rounded-3xl w-full max-w-sm p-6 border border-purple-500/30 relative">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center">
              <Gauge className="w-4 h-4 text-purple-300" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Vitesse de Lecture</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {speeds.map((spd) => {
            const isSelected = playbackRate === spd;
            return (
              <button
                key={spd}
                onClick={() => {
                  changePlaybackRate(spd);
                  onClose();
                }}
                className={`py-3 px-3 rounded-2xl text-sm font-bold flex flex-col items-center justify-center transition-all ${
                  isSelected
                    ? 'bg-gradient-to-tr from-purple-600 to-pink-500 text-white shadow-lg shadow-purple-500/40 scale-105'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
                }`}
              >
                <span>{spd}x</span>
                {spd === 1.0 && <span className="text-[9px] font-normal opacity-80">Standard</span>}
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-center text-slate-400">
          La vitesse sélectionnée est conservée pour tous vos livres audio.
        </p>
      </div>
    </div>
  );
};
