import React, { useState } from 'react';
import {
  Users, Sparkles, Smartphone, Mail, Clock,
  Copy, Check, ExternalLink, UserPlus, Network,
  ShieldCheck, ShieldAlert, Award, ChevronRight, Coins
} from 'lucide-react';
import { getFlagEmoji, COUNTRY_NAMES } from '../../../services/tracker';

/**
 * Formatage lisible du temps d'écoute
 */
function formatListeningTime(minutes = 0) {
  const m = Math.max(0, Number(minutes) || 0);
  if (m === 0) return "0 min d'écoute";
  if (m < 60) return `${m} min d'écoute`;
  const hours = Math.floor(m / 60);
  const remainingMin = m % 60;
  return remainingMin > 0 ? `${hours}h ${remainingMin}m` : `${hours}h d'écoute`;
}

/**
 * Tableau moderne et haut de gamme de la liste des utilisateurs RG Play
 */
export const UsersTable = ({
  users = [],
  onOpenCreditModal,
  setActiveRubric,
  setAnalyticsSearchId,
}) => {
  const [copiedId, setCopiedId] = useState(null);

  const handleCopy = (text, id) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!users || users.length === 0) {
    return (
      <div className="p-12 rounded-3xl bg-slate-900/40 border border-white/10 flex flex-col items-center justify-center gap-3 text-center">
        <Users className="w-10 h-10 text-slate-600" />
        <h3 className="text-sm font-bold text-white">Aucun auditeur correspondant</h3>
        <p className="text-xs text-slate-400 max-w-sm">
          Aucun profil ne correspond aux critères de recherche ou aux filtres appliqués.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/70 backdrop-blur-xl overflow-hidden shadow-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-white/4 text-slate-400 text-[11px] font-black uppercase tracking-wider">
              <th className="py-3.5 px-4">Auditeur / Profil</th>
              <th className="py-3.5 px-4">Contact & WhatsApp</th>
              <th className="py-3.5 px-4">Rang & Titre XP</th>
              <th className="py-3.5 px-4">Solde Sky Points ⭐</th>
              <th className="py-3.5 px-4">Parrainage 🤝</th>
              <th className="py-3.5 px-4">IP & Sécurité 🛡️</th>
              <th className="py-3.5 px-4">Écoute & Inscription</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map((u) => {
              const initials = (u.name || 'RG')
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();

              const points = Math.max(0, Number(u.points) || 0);
              const xp = Math.max(0, Number(u.xp) || points);
              const level = Number(u.level) || 1;
              const levelTitle = u.level_title || `Niveau ${level}`;
              const levelColor = u.level_color || '#9d4edd';

              const cleanPhone = (u.phone || '').replace(/[^\d+]/g, '');
              const waLink = cleanPhone ? `https://wa.me/${cleanPhone.replace('+', '')}` : null;

              return (
                <tr key={u.id} className="hover:bg-white/4 transition-colors group">
                  {/* Colonne 1 : Avatar + Nom + ID */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-black text-xs shadow-md shrink-0 relative">
                        {u.avatar_url ? (
                          <img
                            src={u.avatar_url}
                            alt={u.name}
                            className="w-full h-full rounded-2xl object-cover"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          initials
                        )}
                        {u.plan === 'vip' || u.plan === 'premium' ? (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 border border-slate-900 text-[8px] flex items-center justify-center font-bold text-black shadow-xs">
                            ★
                          </span>
                        ) : null}
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-white text-xs flex items-center gap-1.5 flex-wrap">
                          <span className="truncate max-w-44">{u.name || 'Auditeur RG Play'}</span>
                          {u.plan === 'vip' || u.plan === 'premium' ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-black border border-amber-500/40">
                              VIP PRO
                            </span>
                          ) : u.is_registered ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30">
                              Inscrit
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-700/40 text-slate-400 font-medium border border-white/8">
                              Invité
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono mt-0.5">
                          <span className="truncate max-w-32">{u.id}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(u.id, u.id)}
                            className="hover:text-slate-300 transition-colors cursor-pointer"
                            title="Copier l'identifiant"
                          >
                            {copiedId === u.id ? (
                              <Check className="w-2.5 h-2.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-2.5 h-2.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Colonne 2 : Contact (Email, WhatsApp, Pays) */}
                  <td className="py-3 px-4 text-slate-300">
                    <div className="space-y-1 text-[11px]">
                      {u.phone ? (
                        <div className="flex items-center gap-1.5">
                          <Smartphone className="w-3 h-3 text-emerald-400 shrink-0" />
                          <a
                            href={waLink || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-emerald-300 hover:text-emerald-200 hover:underline transition-colors flex items-center gap-1 font-bold"
                            title="Ouvrir WhatsApp"
                          >
                            <span>{u.phone}</span>
                            <ChevronRight className="w-2.5 h-2.5 text-emerald-400" />
                          </a>
                        </div>
                      ) : null}

                      {u.email && (
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-40 font-medium">{u.email}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-slate-400 font-medium">
                        <span>{getFlagEmoji(u.country || 'GA')}</span>
                        <span>{COUNTRY_NAMES[u.country] || (u.country === 'GA' ? 'Gabon' : u.country) || 'Gabon'}</span>
                      </div>

                      {!u.phone && !u.email && (
                        <span className="text-[10px] text-slate-500 italic block">Profil invité</span>
                      )}
                    </div>
                  </td>

                  {/* Colonne 3 : Niveau & Titre XP */}
                  <td className="py-3 px-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="px-2 py-0.5 rounded-lg text-white font-black text-[10px] border shadow-xs"
                          style={{
                            backgroundColor: `${levelColor}25`,
                            borderColor: `${levelColor}50`,
                            color: levelColor
                          }}
                        >
                          Niv. {level}
                        </span>
                        <span className="text-[11px] font-bold text-white truncate max-w-28">
                          {levelTitle}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono font-medium">
                        {xp.toLocaleString()} XP
                      </div>
                    </div>
                  </td>

                  {/* Colonne 4 : Solde Sky Points */}
                  <td className="py-3 px-4 font-mono">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-black text-xs shadow-xs">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>{points.toLocaleString()} pts</span>
                    </div>
                  </td>

                  {/* Colonne 5 : Parrainage */}
                  <td className="py-3 px-4">
                    <div className="space-y-1">
                      {(u.referral_count || 0) > 0 ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-[11px]">
                          <UserPlus className="w-3 h-3 text-emerald-400" />
                          <span>{u.referral_count} filleul{u.referral_count > 1 ? 's' : ''}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-600 italic block">Aucun</span>
                      )}
                      {u.referral_code && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <span className="font-mono bg-slate-800/80 px-1.5 py-0.5 rounded border border-white/8 font-bold">
                            {u.referral_code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(u.referral_code, `ref-${u.id}`)}
                            className="hover:text-slate-300 transition-colors cursor-pointer"
                            title="Copier le code"
                          >
                            {copiedId === `ref-${u.id}` ? (
                              <Check className="w-2.5 h-2.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-2.5 h-2.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Colonne 6 : IP & Sécurité */}
                  <td className="py-3 px-4">
                    {u.ip_address ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Network className="w-3 h-3 text-cyan-400 shrink-0" />
                          <button
                            type="button"
                            onClick={() => handleCopy(u.ip_address, `ip-${u.id}`)}
                            className="font-mono text-[10px] text-cyan-300 hover:text-cyan-200 transition-colors flex items-center gap-1 cursor-pointer font-medium"
                            title="Copier l'adresse IP"
                          >
                            <span>{u.ip_address}</span>
                            {copiedId === `ip-${u.id}` ? (
                              <Check className="w-2.5 h-2.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-2.5 h-2.5 text-slate-500" />
                            )}
                          </button>
                        </div>
                        {u.ip_last_seen && (
                          <div className="text-[9px] text-slate-500">
                            {new Date(String(u.ip_last_seen).replace(' ', 'T')).toLocaleDateString('fr-FR', {
                              day: '2-digit', month: '2-digit', year: '2-digit',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] text-slate-600 italic">
                        <ShieldAlert className="w-3 h-3 text-slate-600" />
                        <span>Non capturée</span>
                      </div>
                    )}
                  </td>

                  {/* Colonne 7 : Temps d'écoute & Inscription */}
                  <td className="py-3 px-4 text-slate-300">
                    <div className="space-y-0.5">
                      <div className="font-bold text-xs text-white flex items-center gap-1">
                        <Clock className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span>{formatListeningTime(u.listening_minutes)}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {u.created_at ? (
                          <span>Inscrit le {new Date(String(u.created_at).replace(' ', 'T')).toLocaleDateString('fr-FR')}</span>
                        ) : (
                          <span>Actif récemment</span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Colonne 8 : Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex flex-col gap-1.5 items-end">
                      <button
                        type="button"
                        onClick={() => onOpenCreditModal && onOpenCreditModal(u)}
                        className="px-3 py-1.5 rounded-xl bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs inline-flex items-center gap-1.5 shadow-md shadow-amber-950/40 transition-all cursor-pointer hover:scale-105 active:scale-95 whitespace-nowrap"
                        title="Créditer ou déduire des Sky Points"
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>+ Créditer Points</span>
                      </button>

                      {setActiveRubric && (
                        <button
                          type="button"
                          onClick={() => {
                            if (setAnalyticsSearchId) setAnalyticsSearchId(u.id);
                            if (setActiveRubric) setActiveRubric('analytics');
                          }}
                          className="px-2.5 py-1 rounded-xl bg-purple-600/20 hover:bg-purple-600/35 border border-purple-500/30 text-purple-300 font-bold text-[11px] inline-flex items-center gap-1 transition-all cursor-pointer hover:scale-105 active:scale-95 whitespace-nowrap"
                          title="Voir dans Statistiques & Visiteurs"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Voir dans Stats</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
