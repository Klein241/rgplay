import React, { useState, useEffect, useMemo } from 'react';
import { Users, Search, RefreshCw, ArrowUpDown, X } from 'lucide-react';
import { apiClient } from '../../../services/api';
import { COUNTRY_NAMES } from '../../../services/tracker';
import { UserDateFilterBar, getUserPresetRange, isUserInDateRange, parseDateSafe } from '../components/UserDateFilterBar';
import { UsersTable } from '../components/UsersTable';
import { UserCreditModal } from '../components/UserCreditModal';
import { UsersStatsCards } from '../components/UsersStatsCards';

/**
 * Normalise une chaîne en minuscules sans accents
 */
function normalizeText(val) {
  if (!val) return '';
  return String(val)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Rubrique Utilisateurs & Crédit Sky Points (Admin Studio RG Play)
 * Gestion communauté, recherche multi-critères, filtres et Sky Points.
 */
export const UsersRubric = ({ setActiveRubric, setAnalyticsSearchId } = {}) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created');
  const [datePreset, setDatePreset] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [creditModalUser, setCreditModalUser] = useState(null);

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

  // Callback de mise à jour instantanée du solde après crédit/débit
  const handlePointsUpdated = (userId, newPoints, newXp, newLevel) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            points: newPoints,
            xp: newXp,
            level: newLevel || u.level,
          };
        }
        return u;
      })
    );
  };

  // Plage de dates active
  const userDateRange = useMemo(() => {
    if (datePreset === 'custom') {
      const from = customFrom ? new Date(customFrom + 'T00:00:00') : null;
      const to = customTo ? new Date(customTo + 'T23:59:59') : null;
      if (from || to) return { from, to };
      return null;
    }
    return getUserPresetRange(datePreset);
  }, [datePreset, customFrom, customTo]);

  // Compteurs globaux pour les badges d'onglets
  const counts = useMemo(() => {
    const total = users.length;
    const registered = users.filter((u) => Boolean(u.is_registered)).length;
    const withPoints = users.filter((u) => (Number(u.points) || 0) > 0).length;
    const withWhatsapp = users.filter((u) => Boolean(u.has_whatsapp || (u.phone && u.phone.trim()))).length;
    const sponsors = users.filter((u) => (Number(u.referral_count) || 0) > 0).length;
    const vip = users.filter((u) => u.plan === 'vip' || u.plan === 'premium').length;
    const guests = users.filter((u) => !u.is_registered).length;
    const recent = users.filter((u) => {
      const d = parseDateSafe(u.created_at);
      return d && (Date.now() - d.getTime()) / (1000 * 3600 * 24) <= 7;
    }).length;

    return { total, registered, withPoints, withWhatsapp, sponsors, vip, guests, recent };
  }, [users]);

  // Filtrage, recherche multi-critères et tri réactifs
  const filteredUsers = useMemo(() => {
    const q = normalizeText(search);
    const qDigits = search.replace(/[^\d]/g, '');

    return users
      .filter((u) => {
        // 1. RECHERCHE MULTI-CRITÈRES PROFONDE
        if (q) {
          const normName = normalizeText(u.name);
          const normEmail = normalizeText(u.email);
          const normPhone = normalizeText(u.phone);
          const phoneDigits = (u.phone || '').replace(/[^\d]/g, '');
          const normId = normalizeText(u.id);
          const normIp = normalizeText(u.ip_address);
          const normRefCode = normalizeText(u.referral_code);
          const countryCode = normalizeText(u.country);
          const countryFullName = normalizeText(COUNTRY_NAMES[u.country] || (u.country === 'GA' ? 'Gabon' : ''));
          const normLevelTitle = normalizeText(u.level_title);
          const normPlan = normalizeText(u.plan);
          const statusKeyword = u.is_registered ? 'inscrit membre enregistre' : 'invite visiteur';

          const matchText =
            normName.includes(q) ||
            normEmail.includes(q) ||
            normPhone.includes(q) ||
            (qDigits.length >= 3 && phoneDigits.includes(qDigits)) ||
            normId.includes(q) ||
            normIp.includes(q) ||
            normRefCode.includes(q) ||
            countryCode === q ||
            countryFullName.includes(q) ||
            normLevelTitle.includes(q) ||
            normPlan.includes(q) ||
            statusKeyword.includes(q);

          if (!matchText) return false;
        }

        // 2. FILTRE PAR TYPE / ONGLET
        if (filter === 'registered' && !u.is_registered) return false;
        if (filter === 'with-points' && (Number(u.points) || 0) <= 0) return false;
        if (filter === 'whatsapp' && !Boolean(u.has_whatsapp || (u.phone && u.phone.trim()))) return false;
        if (filter === 'sponsors' && (Number(u.referral_count) || 0) <= 0) return false;
        if (filter === 'vip' && u.plan !== 'vip' && u.plan !== 'premium') return false;
        if (filter === 'guests' && u.is_registered) return false;
        if (filter === 'recent') {
          const d = parseDateSafe(u.created_at);
          const isRecent = d && (Date.now() - d.getTime()) / (1000 * 3600 * 24) <= 7;
          if (!isRecent) return false;
        }

        // 3. FILTRE TEMPOREL
        if (!isUserInDateRange(u, userDateRange)) return false;

        return true;
      })
      .sort((a, b) => {
        // 4. TRI PERSONNALISABLE
        if (sortBy === 'points') {
          return (Number(b.points) || 0) - (Number(a.points) || 0);
        }
        if (sortBy === 'listening') {
          return (Number(b.listening_minutes) || 0) - (Number(a.listening_minutes) || 0);
        }
        if (sortBy === 'xp') {
          return (Number(b.xp) || 0) - (Number(a.xp) || 0);
        }
        if (sortBy === 'referrals') {
          return (Number(b.referral_count) || 0) - (Number(a.referral_count) || 0);
        }
        if (sortBy === 'name') {
          return (a.name || '').localeCompare(b.name || '');
        }

        // Par défaut : 'created' (du plus récent au plus ancien)
        const timeA = parseDateSafe(a.created_at)?.getTime() || 0;
        const timeB = parseDateSafe(b.created_at)?.getTime() || 0;
        return timeB - timeA;
      });
  }, [users, search, filter, userDateRange, sortBy]);

  // Statistiques calculées sur les données réelles
  const stats = useMemo(() => {
    const total = users.length;
    const totalPoints = users.reduce((sum, u) => sum + (Number(u.points) || 0), 0);
    const totalMinutes = users.reduce((sum, u) => sum + (Number(u.listening_minutes) || 0), 0);
    const totalReferrals = users.reduce((sum, u) => sum + (Number(u.referral_count) || 0), 0);
    const sponsorsCount = users.filter((u) => (Number(u.referral_count) || 0) > 0).length;

    return {
      total,
      totalPoints,
      avgPoints: total > 0 ? Math.round(totalPoints / total) : 0,
      totalHours: Math.round(totalMinutes / 60),
      totalMinutes,
      totalReferrals,
      sponsorsCount,
    };
  }, [users]);

  // Réinitialisation globale de tous les filtres
  const handleResetAllFilters = () => {
    setSearch('');
    setFilter('all');
    setDatePreset('all');
    setCustomFrom('');
    setCustomTo('');
    setSortBy('created');
  };

  const isAnyFilterActive = search || filter !== 'all' || datePreset !== 'all' || sortBy !== 'created';

  // Onglets de filtre avec compteurs
  const FILTER_TABS = [
    { id: 'all', label: 'Tous', count: counts.total },
    { id: 'registered', label: '👤 Membres Inscrits', count: counts.registered },
    { id: 'with-points', label: '⭐ Avec Points', count: counts.withPoints },
    { id: 'whatsapp', label: '📱 WhatsApp Lié', count: counts.withWhatsapp },
    { id: 'sponsors', label: '🤝 Parrains Actifs', count: counts.sponsors },
    { id: 'vip', label: '👑 VIP / Pro', count: counts.vip },
    { id: 'guests', label: '🎧 Auditeurs Invités', count: counts.guests },
    { id: 'recent', label: 'Inscrits Récents (7j)', count: counts.recent },
  ];

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
            Consultez les membres réels, suivez le temps d'écoute et attribuez des Sky Points (XP) pour récompenser la fidélité.
          </p>
        </div>

        <button
          type="button"
          onClick={loadUsers}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-black transition-all border border-white/10 self-start sm:self-auto cursor-pointer hover:border-purple-400/40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* ── CARTES DE STATISTIQUES RÉELLES ── */}
      <UsersStatsCards stats={stats} counts={counts} />

      {/* ── FILTRE DE DATES (Style Alibaba) ── */}
      <UserDateFilterBar
        datePreset={datePreset}
        setDatePreset={setDatePreset}
        customFrom={customFrom}
        setCustomFrom={setCustomFrom}
        customTo={customTo}
        setCustomTo={setCustomTo}
        filteredCount={filteredUsers.length}
        totalCount={users.length}
      />

      {/* ── BARRE DE RECHERCHE, SÉLECTEUR DE TRI ET ONGLETS ── */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          
          {/* Champ de recherche insensible aux accents */}
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom, email, WhatsApp, pays (ex: Gabon), VIP, ID, IP..."
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-purple-500 focus:bg-purple-950/20 transition-all font-medium"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer p-0.5 rounded-full hover:bg-white/10"
                title="Effacer la recherche"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sélecteur de Tri & Reset */}
          <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-400 font-bold hidden sm:inline">Trier par :</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer [color-scheme:dark]"
              >
                <option value="created">Plus récents d'abord</option>
                <option value="points">Plus de Sky Points ⭐</option>
                <option value="listening">Temps d'écoute 🎧</option>
                <option value="xp">Niveau / XP le plus haut</option>
                <option value="referrals">Plus de filleuls 🤝</option>
                <option value="name">Nom alphabétique (A-Z)</option>
              </select>
            </div>

            {isAnyFilterActive && (
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 text-xs font-bold transition-all cursor-pointer"
                title="Réinitialiser tous les filtres et la recherche"
              >
                <X className="w-3.5 h-3.5" />
                <span>Effacer filtres</span>
              </button>
            )}
          </div>

        </div>

        {/* Onglets de filtrage avec compteurs */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/5 border border-white/10 overflow-x-auto">
          {FILTER_TABS.map((tab) => {
            const isActive = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-linear-to-r from-purple-600 to-indigo-600 text-white shadow-md font-black'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    isActive ? 'bg-black/30 text-white' : 'bg-white/10 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Barre d'état des résultats */}
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <div>
            Affichage de <span className="text-white font-black">{filteredUsers.length}</span> sur <span className="text-white font-black">{users.length}</span> auditeur{users.length > 1 ? 's' : ''}
          </div>
          {filteredUsers.length === 0 && users.length > 0 && (
            <button
              type="button"
              onClick={handleResetAllFilters}
              className="text-purple-400 hover:text-purple-300 underline font-bold cursor-pointer"
            >
              Aucun résultat pour cette combinaison · Réinitialiser les filtres
            </button>
          )}
        </div>
      </div>

      {/* ── TABLEAU DES AUDITEURS ── */}
      {loading ? (
        <div className="p-12 rounded-3xl bg-slate-900/40 border border-white/10 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
          <p className="text-xs text-slate-400 font-bold">Chargement des utilisateurs en direct depuis Cloudflare D1...</p>
        </div>
      ) : (
        <UsersTable
          users={filteredUsers}
          onOpenCreditModal={(user) => setCreditModalUser(user)}
          setActiveRubric={setActiveRubric}
          setAnalyticsSearchId={setAnalyticsSearchId}
        />
      )}

      {/* ── MODALE DE CRÉDIT DE SKY POINTS ── */}
      {creditModalUser && (
        <UserCreditModal
          user={creditModalUser}
          onClose={() => setCreditModalUser(null)}
          onPointsUpdated={handlePointsUpdated}
        />
      )}
    </div>
  );
};
