import React, { useState } from 'react';
import { Calendar, ChevronDown, Filter, X, Clock } from 'lucide-react';

export const USER_DATE_PRESETS = [
  { id: 'all',   label: 'Tout',          days: -1 },
  { id: 'today', label: "Aujourd'hui",   days: 0  },
  { id: '7d',    label: '7 jours',       days: 7  },
  { id: '30d',   label: '30 jours',      days: 30 },
];

export function getUserPresetRange(preset) {
  const now = new Date();
  if (preset === 'today') {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    return { from, to: now };
  }
  if (preset === '7d') {
    const from = new Date(now);
    from.setDate(now.getDate() - 7);
    from.setHours(0, 0, 0, 0);
    return { from, to: now };
  }
  if (preset === '30d') {
    const from = new Date(now);
    from.setDate(now.getDate() - 30);
    from.setHours(0, 0, 0, 0);
    return { from, to: now };
  }
  return null;
}

export function isUserInDateRange(user, dateRange) {
  if (!dateRange) return true;
  const raw = user.ip_last_seen || user.created_at;
  if (!raw) return true;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return true;
  if (dateRange.from && d < dateRange.from) return false;
  if (dateRange.to && d > dateRange.to) return false;
  return true;
}

/**
 * Composant de filtre temporel pour la rubrique Utilisateurs de l'Admin Studio
 */
export const UserDateFilterBar = ({
  datePreset = 'all',
  setDatePreset,
  customFrom = '',
  setCustomFrom,
  customTo = '',
  setCustomTo,
  filteredCount = 0,
  totalCount = 0,
}) => {
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const isFilterActive = datePreset !== 'all';

  const handleReset = () => {
    setDatePreset('all');
    setCustomFrom('');
    setCustomTo('');
    setShowCustomPicker(false);
  };

  return (
    <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900/40 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Intitulé & Badge */}
        <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
          <Filter className="w-3.5 h-3.5 text-purple-400" />
          <span>Période de visite / inscription :</span>
          {isFilterActive && (
            <span className="px-2 py-0.5 rounded-full bg-purple-500/25 border border-purple-500/40 text-purple-200 text-[10px] font-black animate-pulse">
              Filtre actif · {filteredCount} / {totalCount} auditeur{totalCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Presets rapides */}
        <div className="flex items-center gap-1 flex-wrap">
          {USER_DATE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setDatePreset(p.id);
                setShowCustomPicker(false);
              }}
              className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                datePreset === p.id
                  ? 'bg-purple-500/30 border-purple-500/50 text-purple-200 shadow-sm shadow-purple-950/40'
                  : 'bg-white/4 border-white/8 text-slate-400 hover:text-white hover:bg-white/8'
              }`}
            >
              {p.label}
            </button>
          ))}

          {/* Bouton Plage personnalisée */}
          <button
            type="button"
            onClick={() => {
              setDatePreset('custom');
              setShowCustomPicker((prev) => !prev);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
              datePreset === 'custom'
                ? 'bg-indigo-500/30 border-indigo-500/50 text-indigo-200'
                : 'bg-white/4 border-white/8 text-slate-400 hover:text-white hover:bg-white/8'
            }`}
          >
            <Calendar className="w-3 h-3" />
            <span>Plage</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showCustomPicker ? 'rotate-180' : ''}`} />
          </button>

          {/* Bouton Reset */}
          {isFilterActive && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
              title="Réinitialiser le filtre de date"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Champs Date Plage Personnalisée */}
      {showCustomPicker && datePreset === 'custom' && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 border-t border-white/8 animate-fadeIn">
          <div className="flex items-center gap-2 flex-1">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <label className="text-[11px] text-slate-400 font-bold shrink-0">Du :</label>
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="flex-1 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white text-[11px] focus:outline-none focus:border-purple-500/60 focus:bg-purple-950/20 transition-all [color-scheme:dark]"
            />
          </div>
          <div className="flex items-center gap-2 flex-1">
            <label className="text-[11px] text-slate-400 font-bold shrink-0">Au :</label>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => setCustomTo(e.target.value)}
              className="flex-1 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white text-[11px] focus:outline-none focus:border-purple-500/60 focus:bg-purple-950/20 transition-all [color-scheme:dark]"
            />
          </div>
          {(customFrom || customTo) && (
            <button
              type="button"
              onClick={() => {
                setCustomFrom('');
                setCustomTo('');
              }}
              className="text-[11px] font-bold text-slate-400 hover:text-red-300 transition-colors cursor-pointer shrink-0"
            >
              Effacer
            </button>
          )}
        </div>
      )}
    </div>
  );
};
