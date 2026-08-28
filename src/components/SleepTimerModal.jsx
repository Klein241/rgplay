import React from 'react';
import { X, Moon, Check, Clock } from 'lucide-react';
import { useAudio } from '../context/AudioContext';

export const SleepTimerModal = ({ isOpen, onClose }) => {
  const { sleepTimerOption, sleepTimerSecondsLeft, setSleepTimer, formatTime } = useAudio();

  if (!isOpen) return null;

  const timerOptions = [
    { id: '15', label: '15 minutes', desc: 'Arrêt dans 15 min' },
    { id: '30', label: '30 minutes', desc: 'Arrêt dans 30 min' },
    { id: '45', label: '45 minutes', desc: 'Arrêt dans 45 min' },
    { id: '60', label: '60 minutes', desc: 'Arrêt dans 1 heure' },
    { id: 'end_chapter', label: 'Fin du chapitre', desc: 'Arrêt à la fin de la piste actuelle' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="glass-card rounded-3xl w-full max-w-sm p-6 border border-purple-500/30 relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center">
              <Moon className="w-4 h-4 text-purple-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Minuteur de Sommeil</h3>
              {sleepTimerSecondsLeft !== null && (
                <p className="text-xs text-purple-400 font-medium">
                  Reste : {formatTime(sleepTimerSecondsLeft)}
                </p>
              )}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 mb-4">
          {timerOptions.map((opt) => {
            const isSelected = sleepTimerOption === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => {
                  setSleepTimer(opt.id);
                  onClose();
                }}
                className={`w-full p-3 rounded-2xl flex items-center justify-between transition-all ${
                  isSelected
                    ? 'bg-gradient-to-r from-purple-600/80 to-pink-500/80 text-white font-bold border border-purple-400/40 shadow-lg shadow-purple-500/30'
                    : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Clock className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                  <div className="text-left">
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className="text-[11px] opacity-75">{opt.desc}</p>
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-white" />}
              </button>
            );
          })}
        </div>

        {sleepTimerOption && (
          <button
            onClick={() => {
              setSleepTimer(null);
              onClose();
            }}
            className="w-full py-2.5 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors"
          >
            Désactiver le minuteur
          </button>
        )}
      </div>
    </div>
  );
};
