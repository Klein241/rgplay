import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, UserCheck, RefreshCw, Eye, Users,
  Search, X, Target
} from 'lucide-react';
import { VisitorCard, segmentItem } from './VisitorCard';

// ─── Main component ───────────────────────────────────────────────────────────
export const VisitorsAndUsersFeed = ({
  recentVisitors = [],
  selectedVisitorDetail,
  setSelectedVisitorDetail,
  initialSearchId = null,
  onSearchIdUsed = null,
}) => {
  const [activeTab, setActiveTab] = useState('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedId, setHighlightedId] = useState(null);

  // ── Prise en charge de la recherche directe par ID transmis (ex: depuis UsersRubric) ──
  useEffect(() => {
    if (initialSearchId) {
      setSearchQuery(initialSearchId);
      setHighlightedId(initialSearchId);
      setActiveTab('all'); // Basculer sur 'all' pour s'assurer que l'utilisateur n'est pas masqué

      // Trouver et ouvrir la fiche correspondante
      const found = recentVisitors.find(v =>
        String(v.id) === String(initialSearchId) ||
        String(v.user_id) === String(initialSearchId) ||
        String(v.visitor_id) === String(initialSearchId) ||
        String(v.session_id) === String(initialSearchId)
      );

      if (found) {
        setSelectedVisitorDetail(found.visitor_id);
      }

      if (onSearchIdUsed) {
        onSearchIdUsed();
      }
    }
  }, [initialSearchId, recentVisitors]);

  // Segmentation
  const activeUsers     = useMemo(() => recentVisitors.filter(v => segmentItem(v).isUser), [recentVisitors]);
  const recurringUsers  = useMemo(() => recentVisitors.filter(v => Number(v.total_visits || v.visits_count || v.session_count) > 1 || Number(v.daily_streak || v.streak) > 1), [recentVisitors]);
  const passiveVisitors = useMemo(() => recentVisitors.filter(v => !segmentItem(v).isUser), [recentVisitors]);

  // Liste de base selon l'onglet
  const tabList = useMemo(() => {
    if (activeTab === 'users') return activeUsers;
    if (activeTab === 'recurring') return recurringUsers;
    if (activeTab === 'visitors') return passiveVisitors;
    return recentVisitors;
  }, [activeTab, activeUsers, recurringUsers, passiveVisitors, recentVisitors]);

  // Filtre supplémentaire par recherche texte / ID
  const displayedList = useMemo(() => {
    if (!searchQuery.trim()) return tabList;
    const q = searchQuery.trim().toLowerCase();

    return tabList.filter(v => {
      const vid = String(v.visitor_id || '').toLowerCase();
      const uid = String(v.user_id || v.id || '').toLowerCase();
      const sid = String(v.session_id || '').toLowerCase();
      const name = String(v.registered_name || v.user_name || '').toLowerCase();
      const email = String(v.user_email || '').toLowerCase();
      const phone = String(v.phone || '').toLowerCase();

      return vid.includes(q) || uid.includes(q) || sid.includes(q) || name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [tabList, searchQuery]);

  // Metrics
  const conversionRate = recentVisitors.length > 0
    ? Math.round((activeUsers.length / recentVisitors.length) * 100)
    : 0;

  const tabs = [
    { id: 'users',     label: 'Utilisateurs',       count: activeUsers.length,     icon: UserCheck, color: 'purple' },
    { id: 'recurring', label: 'Fidèles & Récurrents', count: recurringUsers.length, icon: RefreshCw, color: 'cyan' },
    { id: 'visitors',  label: 'Visiteurs',          count: passiveVisitors.length,  icon: Eye,       color: 'emerald' },
    { id: 'all',       label: 'Tous',               count: recentVisitors.length,   icon: Users,     color: 'slate' },
  ];

  const tabActiveClass = {
    purple:  'bg-purple-600/25 text-purple-300 border border-purple-500/40 shadow-sm',
    cyan:    'bg-cyan-600/25 text-cyan-300 border border-cyan-500/40 shadow-sm',
    emerald: 'bg-emerald-600/25 text-emerald-300 border border-emerald-500/40 shadow-sm',
    slate:   'bg-white/12 text-white border border-white/20 shadow-sm',
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setHighlightedId(null);
  };

  return (
    <div className="space-y-4 font-['Outfit']">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            Flux en Temps Réel
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Taux de conversion : <span className="text-purple-300 font-bold">{conversionRate}%</span>
            <span className="mx-1.5 text-slate-700">·</span>
            <span className="text-emerald-400 font-bold">{activeUsers.length}</span>
            <span className="text-slate-500"> actifs sur </span>
            <span className="text-white font-bold">{recentVisitors.length}</span>
            <span className="text-slate-500"> sessions</span>
          </p>
        </div>

        {/* Conversion mini-bar */}
        <div className="flex items-center gap-2 text-[11px]">
          <div className="w-28 h-2 rounded-full bg-white/6 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-700"
              style={{ width: `${conversionRate}%` }}
            />
          </div>
          <span className="text-purple-300 font-bold">{conversionRate}%</span>
        </div>
      </div>

      {/* ── Barre de recherche par ID / Nom / Email + Onglets ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 flex-wrap">
        {/* Tab switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-white/4 rounded-2xl border border-white/8 w-fit overflow-x-auto max-w-full">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap
                  ${isActive ? tabActiveClass[tab.color] : 'text-slate-400 hover:text-white hover:bg-white/6'}`}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center
                  ${isActive ? 'bg-white/15' : 'bg-white/6 text-slate-500'}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Recherche par ID */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par ID, nom, email..."
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-purple-500/60 focus:bg-purple-950/20 transition-all font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              title="Effacer la recherche"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Bannière active si recherche ciblée depuis la rubrique Utilisateurs ── */}
      {highlightedId && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-purple-950/50 border border-purple-500/30 text-purple-200 text-xs shadow-lg animate-fadeIn">
          <div className="flex items-center gap-2 truncate">
            <Target className="w-4 h-4 text-purple-400 shrink-0" />
            <span>Filtre appliqué pour l'ID utilisateur : <strong className="font-mono text-purple-100">{highlightedId}</strong></span>
          </div>
          <button
            type="button"
            onClick={handleClearSearch}
            className="text-[11px] font-black text-purple-300 hover:text-white px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 shrink-0 cursor-pointer"
          >
            Réinitialiser le filtre
          </button>
        </div>
      )}

      {/* ── Empty state ── */}
      {displayedList.length === 0 ? (
        <div className="py-14 flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/6 bg-white/2">
          {searchQuery ? (
            <>
              <Search className="w-10 h-10 text-slate-600" />
              <p className="text-sm font-bold text-slate-400">
                Aucun visiteur ou utilisateur trouvé pour "{searchQuery}"
              </p>
              <p className="text-xs text-slate-600 max-w-xs text-center">
                L'utilisateur n'a peut-être pas encore de session enregistrée récemment sur cet appareil.
              </p>
              <button
                type="button"
                onClick={handleClearSearch}
                className="mt-2 text-xs font-bold text-purple-400 hover:text-purple-300 underline"
              >
                Afficher tous les visiteurs
              </button>
            </>
          ) : (
            <>
              {activeTab === 'users'
                ? <UserCheck className="w-10 h-10 text-purple-500/30" />
                : <Eye className="w-10 h-10 text-slate-600" />
              }
              <p className="text-sm font-bold text-slate-400">
                {activeTab === 'users' ? 'Aucun utilisateur actif pour l\'instant' : 'Aucun visiteur passif'}
              </p>
              <p className="text-xs text-slate-600 max-w-xs text-center">
                {activeTab === 'users'
                  ? 'Les auditeurs apparaîtront ici dès qu\'ils écoutent un audio ou accumulent des points.'
                  : 'Les visiteurs sans interaction apparaîtront ici.'}
              </p>
            </>
          )}
        </div>
      ) : (
        /* ── Feed list ── */
        <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1 no-scrollbar">
          {displayedList.map((vis) => {
            const isMatch = highlightedId && (
              String(vis.id) === String(highlightedId) ||
              String(vis.user_id) === String(highlightedId) ||
              String(vis.visitor_id) === String(highlightedId)
            );
            return (
              <VisitorCard
                key={vis.session_id || vis.visitor_id}
                vis={vis}
                isSelected={selectedVisitorDetail === vis.visitor_id}
                isHighlighted={Boolean(isMatch)}
                onToggle={() => setSelectedVisitorDetail(
                  selectedVisitorDetail === vis.visitor_id ? null : vis.visitor_id
                )}
              />
            );
          })}

          {/* Bottom gradient fade */}
          {displayedList.length > 5 && (
            <div className="sticky bottom-0 h-8 bg-gradient-to-t from-slate-900/80 to-transparent pointer-events-none -mt-8" />
          )}
        </div>
      )}
    </div>
  );
};
