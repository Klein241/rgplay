import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Sparkles, Search, RefreshCw, Plus, CheckCircle2,
  AlertCircle, Loader2, ArrowUpRight, Award, Shield,
  Smartphone, Mail, Calendar, Clock, BookOpen, Gift, Coins,
  Copy, Check, ExternalLink, UserPlus, Network, ShieldAlert
} from 'lucide-react';
import { apiClient } from '../../../services/api';
import { getFlagEmoji, COUNTRY_NAMES } from '../../../services/tracker';

export const UsersRubric = ({ setActiveRubric, setAnalyticsSearchId } = {}) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'with-points' | 'recent'
  const [copiedId, setCopiedId] = useState(null);

  // État de la modal de crédit de Sky Points
  const [creditModalUser, setCreditModalUser] = useState(null);
  const [creditAmount, setCreditAmount] = useState(100);
  const [creditReason, setCreditReason] = useState('Bonus fidélité Read\'s Great');
  const [isSubmittingCredit, setIsSubmittingCredit] = useState(false);
  const [creditSuccessMsg, setCreditSuccessMsg] = useState('');
  const [creditErrorMsg, setCreditErrorMsg] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getAdminUsers();
      if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch (e) {
      console.error('Erreur chargement utilisateurs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCopy = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenCreditModal = (user) => {
    setCreditModalUser(user);
    setCreditAmount(100);
    setCreditReason('Bonus fidélité Read\'s Great');
    setCreditSuccessMsg('');
    setCreditErrorMsg('');
  };

  const handleConfirmCredit = async (e) => {
    e?.preventDefault();
    if (!creditModalUser || !creditAmount || creditAmount <= 0) return;

    setIsSubmittingCredit(true);
    setCreditSuccessMsg('');
    setCreditErrorMsg('');

    try {
      const res = await apiClient.creditUserPoints(
        creditModalUser.id,
        Number(creditAmount),
        creditReason
      );

      if (res.success) {
        setCreditSuccessMsg(`✓ +${creditAmount} Sky Points crédités avec succès !`);
        // Mettre à jour le solde dans la liste locale immédiatement
        setUsers(prev => prev.map(u => {
          if (u.id === creditModalUser.id) {
            return {
              ...u,
              points: (u.points || 0) + Number(creditAmount),
              xp: (u.xp || 0) + Number(creditAmount)
            };
          }
          return u;
        }));

        setTimeout(() => {
          setCreditModalUser(null);
          setCreditSuccessMsg('');
        }, 1800);
      } else {
        setCreditErrorMsg(res.error || 'Erreur lors de l\'attribution des points');
      }
    } catch (err) {
      setCreditErrorMsg(err.message || 'Erreur réseau');
    } finally {
      setIsSubmittingCredit(false);
    }
  };

  // Filtrage et recherche
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const q = search.toLowerCase().trim();
      const matchSearch = !q ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.phone && u.phone.toLowerCase().includes(q)) ||
        (u.id && u.id.toLowerCase().includes(q));

      let matchFilter = true;
      if (filter === 'with-points') matchFilter = (u.points || 0) > 0;
      if (filter === 'whatsapp') matchFilter = Boolean(u.phone && u.phone.trim());
      if (filter === 'sponsors') matchFilter = (u.referral_count || 0) > 0;
      if (filter === 'recent') {
        const days = u.created_at ? (Date.now() - new Date(u.created_at).getTime()) / (1000 * 3600 * 24) : 999;
        matchFilter = days <= 7;
      }

      return matchSearch && matchFilter;
    }).sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });
  }, [users, search, filter]);

  // Statistiques calculées
  const stats = useMemo(() => {
    const total = users.length;
    const totalPoints = users.reduce((sum, u) => sum + (Number(u.points) || 0), 0);
    const totalMinutes = users.reduce((sum, u) => sum + (Number(u.listening_minutes) || 0), 0);
    const totalReferrals = users.reduce((sum, u) => sum + (Number(u.referral_count) || 0), 0);
    const sponsorsCount = users.filter(u => (u.referral_count || 0) > 0).length;
    return {
      total,
      totalPoints,
      avgPoints: total > 0 ? Math.round(totalPoints / total) : 0,
      totalHours: Math.round(totalMinutes / 60),
      totalReferrals,
      sponsorsCount,
    };
  }, [users]);

  return (
    <div className="space-y-6 animate-fadeIn font-['Outfit']">
      
      {/* ── EN-TÊTE DE LA RUBRIQUE ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-linear-to-r from-purple-950/40 via-indigo-950/30 to-slate-900/60 border border-purple-500/20 backdrop-blur-xl shadow-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-black text-purple-400 uppercase tracking-widest">
            <Users className="w-4 h-4 text-purple-400" />
            <span>Gestion de la Communauté RG Play</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Utilisateurs & Crédit Sky Points
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Consultez tous les auditeurs inscrits, leur nom et attribuez des Sky Points (XP) pour débloquer les livres.
          </p>
        </div>

        <button
          type="button"
          onClick={loadUsers}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-black transition-all border border-white/10 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* ── CARTES DE STATISTIQUES ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 shadow-lg">
          <span className="text-2xs font-bold text-slate-400 block mb-1">Total Utilisateurs</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black text-white">{stats.total}</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/20 shadow-lg">
          <span className="text-2xs font-bold text-slate-400 block mb-1">Total Sky Points</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black text-amber-300 font-mono">
              {stats.totalPoints.toLocaleString()} ⭐
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 shadow-lg">
          <span className="text-2xs font-bold text-slate-400 block mb-1">Moyenne par Auditeur</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black text-emerald-400 font-mono">
              {stats.avgPoints} pts
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 shadow-lg">
          <span className="text-2xs font-bold text-slate-400 block mb-1">Temps d'Écoute</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black text-cyan-400 font-mono">
              {stats.totalHours}h
            </span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-indigo-500/20 shadow-lg col-span-2 sm:col-span-1">
          <span className="text-2xs font-bold text-slate-400 block mb-1">Parrains Actifs</span>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-2xl font-black text-indigo-300 font-mono">{stats.sponsorsCount}</span>
              <span className="text-2xs text-indigo-400/80 font-bold block">{stats.totalReferrals} filleuls</span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <UserPlus className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* ── BARRE DE RECHERCHE ET FILTRES ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, email, téléphone ou ID..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition-all font-medium"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/5 border border-white/10 self-start sm:self-auto">
          {[
            { id: 'all', label: 'Tous' },
            { id: 'with-points', label: 'Avec Points ⭐' },
            { id: 'sponsors', label: '🤝 Parrains Actifs' },
            { id: 'whatsapp', label: 'WhatsApp Lié 📱' },
            { id: 'recent', label: 'Inscrits Récents' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                filter === tab.id
                  ? 'bg-linear-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── LISTE DES UTILISATEURS ── */}
      {loading ? (
        <div className="p-12 rounded-3xl bg-slate-900/40 border border-white/10 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          <p className="text-xs text-slate-400 font-bold">Chargement des utilisateurs en direct depuis Cloudflare D1...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-12 rounded-3xl bg-slate-900/40 border border-white/10 flex flex-col items-center justify-center gap-3 text-center">
          <Users className="w-10 h-10 text-slate-600" />
          <h3 className="text-sm font-bold text-white">Aucun utilisateur trouvé</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            {search ? 'Aucun résultat ne correspond à votre recherche.' : 'Aucun auditeur enregistré pour l\'instant.'}
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-slate-900/70 backdrop-blur-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/4 text-slate-400 text-2xs font-black uppercase tracking-wider">
                  <th className="py-3.5 px-4">Utilisateur</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Niveau & Rang</th>
                  <th className="py-3.5 px-4">Solde Sky Points ⭐</th>
                  <th className="py-3.5 px-4">Parrainage 🤝</th>
                  <th className="py-3.5 px-4">IP / Anti-Fraude 🛡️</th>
                  <th className="py-3.5 px-4">Activité</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map((u) => {
                  const initials = (u.name || 'RG')
                    .split(' ')
                    .map(n => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  const points = Number(u.points) || 0;
                  const level = Number(u.level) || 1;

                  return (
                    <tr key={u.id} className="hover:bg-white/4 transition-colors group">
                      {/* Utilisateur : Avatar + Nom + ID */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-black text-xs shadow-md shrink-0">
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
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs flex items-center gap-1.5">
                              <span>{u.name || 'Auditeur RG Play'}</span>
                              {u.plan === 'premium' && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/40">
                                  PRO
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                              <span>{u.id}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(u.id, u.id)}
                                className="hover:text-slate-300 transition-colors"
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

                      {/* Contact */}
                      <td className="py-3 px-4 text-slate-300">
                        <div className="space-y-0.5 text-2xs">
                          {u.email && (
                            <div className="flex items-center gap-1.5 text-slate-300">
                              <Mail className="w-3 h-3 text-slate-500" />
                              <span className="truncate max-w-40">{u.email}</span>
                            </div>
                          )}
                          {u.phone && (
                            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                              <Smartphone className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span className="font-mono">{u.phone}</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                                WhatsApp
                              </span>
                            </div>
                          )}
                          {u.country && (
                            <div className="flex items-center gap-1.5 text-slate-400 font-medium">
                              <span>{getFlagEmoji(u.country)}</span>
                              <span>{COUNTRY_NAMES[u.country] || u.country}</span>
                            </div>
                          )}
                          {!u.email && !u.phone && !u.country && (
                            <span className="text-slate-500 italic">Non renseigné</span>
                          )}
                        </div>
                      </td>

                      {/* Niveau */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 font-black text-2xs border border-indigo-500/30">
                            Niv. {level}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ({u.xp || points} XP)
                          </span>
                        </div>
                      </td>

                      {/* Solde Sky Points */}
                      <td className="py-3 px-4 font-mono">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs">
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          <span>{points.toLocaleString()} pts</span>
                        </div>
                      </td>

                      {/* Parrainage */}
                      <td className="py-3 px-4">
                        <div className="space-y-1.5">
                          {(u.referral_count || 0) > 0 ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-xs">
                              <UserPlus className="w-3 h-3 text-emerald-400" />
                              <span>{u.referral_count} filleul{u.referral_count > 1 ? 's' : ''}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-600 italic">Aucun</span>
                          )}
                          {u.referral_code && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                              <span className="font-mono bg-slate-800/60 px-1.5 py-0.5 rounded border border-white/8">
                                {u.referral_code}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(u.referral_code, `ref-${u.id}`)}
                                className="hover:text-slate-300 transition-colors"
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

                      {/* IP Anti-Fraude */}
                      <td className="py-3 px-4">
                        {u.ip_address ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <Network className="w-3 h-3 text-cyan-400 shrink-0" />
                              <button
                                type="button"
                                onClick={() => handleCopy(u.ip_address, `ip-${u.id}`)}
                                className="font-mono text-[10px] text-cyan-300 hover:text-cyan-200 transition-colors flex items-center gap-1"
                                title="Copier l'adresse IP"
                              >
                                {u.ip_address}
                                {copiedId === `ip-${u.id}` ? (
                                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5 text-slate-500" />
                                )}
                              </button>
                            </div>
                            {u.ip_last_seen && (
                              <div className="text-[9px] text-slate-500">
                                Vu {new Date(u.ip_last_seen).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
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

                      {/* Activité */}
                      <td className="py-3 px-4 text-slate-400 text-2xs">
                        <div>{u.listening_minutes || 0} min d'écoute</div>
                        <div className="text-[10px] text-slate-500">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR') : 'Actif'}
                        </div>
                      </td>

                      {/* Boutons d'action */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex flex-col gap-1.5 items-end">
                          <button
                            type="button"
                            onClick={() => handleOpenCreditModal(u)}
                            className="px-3 py-1.5 rounded-xl bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs inline-flex items-center gap-1.5 shadow-md shadow-amber-950/40 transition-all cursor-pointer hover:scale-105 active:scale-95 whitespace-nowrap"
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
                              className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/35 border border-purple-500/30 text-purple-300 font-bold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105 active:scale-95 whitespace-nowrap"
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
      )}

      {/* ── MODALE : CRÉDITER DES SKY POINTS À UN UTILISATEUR ── */}
      {creditModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl bg-linear-to-b from-slate-900 to-[#0c0822] border border-amber-500/40 p-6 space-y-5 shadow-2xl relative">
            
            {/* Bouton Fermer */}
            <button
              type="button"
              onClick={() => setCreditModalUser(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-xs transition-colors"
            >
              ✕
            </button>

            {/* En-tête Modal */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-black shadow-lg shadow-amber-500/30">
                <Coins className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">
                  Attribution de Récompense
                </span>
                <h3 className="text-lg font-black text-white">
                  Créditer des Sky Points
                </h3>
              </div>
            </div>

            {/* Fiche Utilisateur Cible */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">Bénéficiaire</span>
                <span className="text-xs font-black text-white">{creditModalUser.name}</span>
                <div className="text-[10px] font-mono text-slate-500">{creditModalUser.id}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-bold block">Solde actuel</span>
                <span className="text-xs font-mono font-black text-amber-300">
                  {creditModalUser.points || 0} ⭐
                </span>
              </div>
            </div>

            {/* Formulaire de Crédit */}
            <form onSubmit={handleConfirmCredit} className="space-y-4">
              
              {/* Sélecteur de montants rapides */}
              <div>
                <label className="text-2xs font-bold text-slate-300 block mb-2">
                  Montant à créditer (Sky Points / XP) *
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[50, 100, 250, 500].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCreditAmount(amt)}
                      className={`py-2 rounded-xl text-xs font-black transition-all border ${
                        creditAmount === amt
                          ? 'bg-amber-500 text-black border-amber-400 shadow-md font-bold'
                          : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      +{amt}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={creditAmount}
                    onChange={e => setCreditAmount(Number(e.target.value))}
                    className="w-full pl-4 pr-12 py-2.5 rounded-xl bg-slate-950/80 border border-amber-500/40 text-amber-300 font-mono font-bold text-sm focus:outline-none focus:border-amber-400"
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
                  Motif ou Note de transaction
                </label>
                <input
                  type="text"
                  value={creditReason}
                  onChange={e => setCreditReason(e.target.value)}
                  placeholder="Ex: Bonus de bienvenue, Cadeau de concours, Déblocage spécial"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Messages d'état */}
              {creditSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{creditSuccessMsg}</span>
                </div>
              )}

              {creditErrorMsg && (
                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{creditErrorMsg}</span>
                </div>
              )}

              {/* Boutons d'action */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreditModalUser(null)}
                  className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingCredit || !creditAmount || creditAmount <= 0}
                  className="flex-1 py-3 rounded-xl bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-black font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
                >
                  {isSubmittingCredit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      <span>Attribution...</span>
                    </>
                  ) : (
                    <>
                      <Coins className="w-4 h-4" />
                      <span>Confirmer le Crédit</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
