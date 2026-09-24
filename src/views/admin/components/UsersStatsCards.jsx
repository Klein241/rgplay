import React from 'react';
import { Users, Sparkles, Award, Clock, UserPlus } from 'lucide-react';

/**
 * Cartes statistiques réelles de la communauté RG Play
 */
export const UsersStatsCards = ({ stats, counts }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      {/* Total Auditeurs */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 shadow-lg">
        <span className="text-2xs font-bold text-slate-400 block mb-1">Total Auditeurs</span>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-black text-white">{stats.total}</span>
            <span className="text-[10px] text-purple-300 font-bold block mt-0.5">
              {counts.registered} inscrits · {counts.guests} invités
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Users className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Total Sky Points */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/20 shadow-lg">
        <span className="text-2xs font-bold text-slate-400 block mb-1">Total Sky Points</span>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-black text-amber-300 font-mono">
            {stats.totalPoints.toLocaleString()} ⭐
          </span>
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Moyenne par Auditeur */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 shadow-lg">
        <span className="text-2xs font-bold text-slate-400 block mb-1">Moyenne par Auditeur</span>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-black text-emerald-400 font-mono">
            {stats.avgPoints.toLocaleString()} pts
          </span>
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Award className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Temps d'Écoute Global */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 shadow-lg">
        <span className="text-2xs font-bold text-slate-400 block mb-1">Temps d'Écoute Global</span>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-black text-cyan-400 font-mono">
              {stats.totalHours}h
            </span>
            <span className="text-[10px] text-cyan-300/80 font-bold block mt-0.5">
              {stats.totalMinutes.toLocaleString()} minutes
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
            <Clock className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Parrains Actifs */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-indigo-500/20 shadow-lg col-span-2 sm:col-span-1">
        <span className="text-2xs font-bold text-slate-400 block mb-1">Parrains Actifs</span>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-black text-indigo-300 font-mono">{stats.sponsorsCount}</span>
            <span className="text-[10px] text-indigo-400/80 font-bold block mt-0.5">
              {stats.totalReferrals} filleul{stats.totalReferrals > 1 ? 's' : ''}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <UserPlus className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
};
