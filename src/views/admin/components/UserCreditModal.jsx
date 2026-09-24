import React, { useState } from 'react';
import { Coins, CheckCircle2, AlertCircle, Loader2, Sparkles, X, PlusCircle, MinusCircle } from 'lucide-react';
import { apiClient } from '../../../services/api';

/**
 * Modale premium d'attribution ou de déduction de Sky Points (XP)
 * Permet à l'administrateur d'ajuster le solde avec motif et validation instantanée.
 */
export const UserCreditModal = ({ user, onClose, onPointsUpdated }) => {
  const [mode, setMode] = useState('add'); // 'add' | 'subtract'
  const [creditAmount, setCreditAmount] = useState(100);
  const [creditReason, setCreditReason] = useState("Bonus fidélité Read's Great");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!user) return null;

  const currentPoints = Number(user.points) || 0;
  const currentXp = Number(user.xp) || 0;

  const QUICK_AMOUNTS = [50, 100, 250, 500, 1000];
  const QUICK_REASONS = [
    "Bonus de bienvenue Read's Great",
    "Récompense concours / événement",
    "Fidélité communauté WhatsApp",
    "Déblocage de livre offert",
    "Régularisation de solde"
  ];

  const handleConfirm = async (e) => {
    e?.preventDefault();
    if (!creditAmount || creditAmount <= 0) return;

    setIsSubmitting(true);
    setSuccessMsg('');
    setErrorMsg('');

    const delta = mode === 'add' ? Number(creditAmount) : -Number(creditAmount);

    try {
      const res = await apiClient.creditUserPoints(user.id, delta, creditReason);

      if (res && (res.success || res.new_points !== undefined)) {
        const finalPts = res.new_points !== undefined ? res.new_points : Math.max(0, currentPoints + delta);
        const finalXp = res.new_xp !== undefined ? res.new_xp : Math.max(0, currentXp + (delta > 0 ? delta : 0));
        const finalLevel = res.level || user.level || 1;

        setSuccessMsg(
          `✓ ${delta > 0 ? `+${delta}` : delta} Sky Points ${delta > 0 ? 'crédités' : 'déduits'} avec succès ! Nouveau solde : ${finalPts.toLocaleString()} pts`
        );

        if (onPointsUpdated) {
          onPointsUpdated(user.id, finalPts, finalXp, finalLevel);
        }

        setTimeout(() => {
          onClose();
        }, 1600);
      } else {
        setErrorMsg(res?.error || "Erreur lors de l'enregistrement des points");
      }
    } catch (err) {
      setErrorMsg(err.message || 'Erreur réseau');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn font-['Outfit']">
      <div className="w-full max-w-md rounded-3xl bg-linear-to-b from-slate-900 via-[#0d0928] to-[#070417] border border-amber-500/35 p-6 space-y-5 shadow-2xl relative text-left">
        
        {/* Bouton Fermer */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* En-tête Modal */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-black shadow-lg shadow-amber-500/30 shrink-0">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">
              Gestion Sky Points & Fidélité
            </span>
            <h3 className="text-lg font-black text-white">
              Ajuster les Sky Points
            </h3>
          </div>
        </div>

        {/* Fiche Utilisateur Cible */}
        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-slate-400 font-bold block">Auditeur</span>
            <span className="text-xs font-black text-white truncate block">{user.name || 'Auditeur RG Play'}</span>
            <div className="text-[10px] font-mono text-slate-500 truncate">{user.id}</div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] text-slate-400 font-bold block">Solde actuel</span>
            <span className="text-xs font-mono font-black text-amber-300">
              {currentPoints.toLocaleString()} ⭐
            </span>
          </div>
        </div>

        {/* Sélecteur de Mode : Ajouter ou Déduire */}
        <div className="flex p-1 rounded-xl bg-white/5 border border-white/10">
          <button
            type="button"
            onClick={() => setMode('add')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'add'
                ? 'bg-amber-500 text-black shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Créditer (+)</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('subtract')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'subtract'
                ? 'bg-red-500/80 text-white shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MinusCircle className="w-3.5 h-3.5" />
            <span>Déduire (-)</span>
          </button>
        </div>

        {/* Formulaire de Crédit */}
        <form onSubmit={handleConfirm} className="space-y-4">
          
          {/* Boutons rapides de montants */}
          <div>
            <label className="text-2xs font-bold text-slate-300 block mb-2">
              Montant {mode === 'add' ? 'à créditer' : 'à déduire'} (Sky Points / XP) *
            </label>
            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {QUICK_AMOUNTS.map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setCreditAmount(amt)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    creditAmount === amt
                      ? 'bg-amber-500 text-black border-amber-400 font-black shadow-md'
                      : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {mode === 'add' ? `+${amt}` : `-${amt}`}
                </button>
              ))}
            </div>

            <div className="relative">
              <input
                type="number"
                min="1"
                value={creditAmount}
                onChange={e => setCreditAmount(Math.max(1, Number(e.target.value)))}
                className="w-full pl-4 pr-16 py-2.5 rounded-xl bg-slate-950/80 border border-amber-500/40 text-amber-300 font-mono font-bold text-sm focus:outline-none focus:border-amber-400"
                placeholder="Montant libre"
                required
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-amber-400">
                PTS ⭐
              </span>
            </div>
          </div>

          {/* Motif / Raison */}
          <div>
            <label className="text-2xs font-bold text-slate-300 block mb-1.5">
              Motif de l'opération
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {QUICK_REASONS.map((r, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCreditReason(r)}
                  className={`text-[10px] px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                    creditReason === r
                      ? 'bg-purple-600/30 border-purple-500 text-purple-200 font-bold'
                      : 'bg-white/4 border-white/8 text-slate-400 hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={creditReason}
              onChange={e => setCreditReason(e.target.value)}
              placeholder="Précisez un motif..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Messages d'état */}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !creditAmount || creditAmount <= 0}
              className="flex-1 py-3 rounded-xl bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-black font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Confirmer ({mode === 'add' ? `+${creditAmount}` : `-${creditAmount}`} pts)</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
