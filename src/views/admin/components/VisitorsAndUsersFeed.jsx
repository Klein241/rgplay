import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, UserCheck, RefreshCw, Eye, Users,
  Search, X, Target, Calendar, ChevronDown, Filter,
  Headphones, BookOpen, Clock
} from 'lucide-react';
import { VisitorCard, segmentItem } from './VisitorCard';

// ─── Helpers date ────────────────────────────────────────────────────────────
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

const DATE_PRESETS = [
  { id: 'today',  label: "Aujourd'hui",  days: 0  },
  { id: '7d',     label: '7 jours',       days: 7  },
  { id: '30d',    label: '30 jours',      days: 30 },
  { id: 'all',    label: 'Tout',          days: -1 },
];

function getPresetRange(preset) {
  const now = new Date();
  if (preset === 'today') {
    return { from: startOfDay(now), to: now };
  }
  if (preset === '7d') {
    const from = new Date(now); from.setDate(now.getDate() - 7); from.setHours(0,0,0,0);
    return { from, to: now };
  }
  if (preset === '30d') {
    const from = new Date(now); from.setDate(now.getDate() - 30); from.setHours(0,0,0,0);
    return { from, to: now };
  }
  return null; // 'all'
}

function getVisitorDate(v) {
  const raw = v.last_seen || v.updated_at || v.created_at || v.first_seen;
  if (!raw) return null;
  return new Date(raw);
}

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

  // ── Filtre de dates ──
  const [datePreset, setDatePreset] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

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

  // ── Calcul plage de dates active ──
  const dateRange = useMemo(() => {
    if (datePreset === 'custom') {
      const from = customFrom ? new Date(customFrom + 'T00:00:00') : null;
      const to   = customTo   ? new Date(customTo   + 'T23:59:59') : null;
      if (from || to) return { from, to };
      return null;
    }
    return getPresetRange(datePreset);
  }, [datePreset, customFrom, customTo]);

  // ── Liste filtrée par date ──
  const dateFilteredVisitors = useMemo(() => {
    if (!dateRange) return recentVisitors;
    return recentVisitors.filter(v => {
      const d = getVisitorDate(v);
      if (!d) return true; // si pas de date → on l'inclut
      if (dateRange.from && d < dateRange.from) return false;
      if (dateRange.to   && d > dateRange.to)   return false;
      return true;
    });
  }, [recentVisitors, dateRange]);

  // ── Segmentation (sur la liste filtrée par date) ──
  const activeUsers     = useMemo(() => dateFilteredVisitors.filter(v => segmentItem(v).isUser), [dateFilteredVisitors]);
  const recurringUsers  = useMemo(() => dateFilteredVisitors.filter(v => Number(v.total_visits || v.visits_count || v.session_count) > 1 || Number(v.daily_streak || v.streak) > 1), [dateFilteredVisitors]);
  const passiveVisitors = useMemo(() => dateFilteredVisitors.filter(v => !segmentItem(v).isUser), [dateFilteredVisitors]);

  // ── Liste de base selon l'onglet ──
  const tabList = useMemo(() => {
    if (activeTab === 'users') return activeUsers;
    if (activeTab === 'recurring') return recurringUsers;
    if (activeTab === 'visitors') return passiveVisitors;
    return dateFilteredVisitors;
  }, [activeTab, activeUsers, recurringUsers, passiveVisitors, dateFilteredVisitors]);

  // ── Filtre supplémentaire par recherche texte / ID ──
  const displayedList = useMemo(() => {
    if (!searchQuery.trim()) return tabList;
    const q = searchQuery.trim().toLowerCase();
    return tabList.filter(v => {
      const vid  = String(v.visitor_id || '').toLowerCase();
      const uid  = String(v.user_id || v.id || '').toLowerCase();
      const sid  = String(v.session_id || '').toLowerCase();
      const name = String(v.registered_name || v.user_name || '').toLowerCase();
      const email= String(v.user_email || '').toLowerCase();
      const phone= String(v.phone || '').toLowerCase();
      return vid.includes(q) || uid.includes(q) || sid.includes(q) || name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [tabList, searchQuery]);

  // ── Synthèse des contenus consultés sur la période ──
  const periodContentStats = useMemo(() => {
    const audioMap = {};
    const ebookMap = {};
    dateFilteredVisitors.forEach(v => {
      (v.audios || []).forEach(a => {
        const key = a.id || a.audiobook_id || a.title;
        if (!key) return;
        if (!audioMap[key]) audioMap[key] = { title: a.title || a.audiobook_title || key, count: 0, cover: a.cover_url };
        audioMap[key].count += 1;
      });
      (v.ebooks || []).forEach(e => {
        const key = e.id || e.book_id || e.title;
        if (!key) return;
        if (!ebookMap[key]) ebookMap[key] = { title: e.title || e.book_title || key, count: 0, cover: e.cover_url };
        ebookMap[key].count += 1;
      });
    });
    const topAudios = Object.values(audioMap).sort((a,b) => b.count - a.count).slice(0, 5);
    const topEbooks = Object.values(ebookMap).sort((a,b) => b.count - a.count).slice(0, 5);
    return { topAudios, topEbooks, hasData: topAudios.length > 0 || topEbooks.length > 0 };
  }, [dateFilteredVisitors]);

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

      {/* ── 🗓 FILTRE DE DATES — Style Alibaba Analytics ── */}
      <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 via-violet-950/30 to-purple-950/40 p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Label */}
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
            <Filter className="w-3.5 h-3.5" />
            <span>Période d'analyse</span>
            {datePreset !== 'all' && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/25 border border-indigo-500/40 text-indigo-200 text-[10px] font-black animate-pulse">
                Filtre actif · {dateFilteredVisitors.length} / {recentVisitors.length} visiteur{recentVisitors.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Presets rapides */}
          <div className="flex items-center gap-1 flex-wrap">
            {DATE_PRESETS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setDatePreset(p.id); setShowDatePicker(false); }}
                className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                  datePreset === p.id
                    ? 'bg-indigo-500/30 border-indigo-500/50 text-indigo-200 shadow-sm shadow-indigo-950/40'
                    : 'bg-white/4 border-white/8 text-slate-400 hover:text-white hover:bg-white/8'
                }`}
              >
                {p.label}
              </button>
            ))}

            {/* Bouton plage personnalisée */}
            <button
              type="button"
              onClick={() => { setDatePreset('custom'); setShowDatePicker(v => !v); }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                datePreset === 'custom'
                  ? 'bg-violet-500/30 border-violet-500/50 text-violet-200'
                  : 'bg-white/4 border-white/8 text-slate-400 hover:text-white hover:bg-white/8'
              }`}
            >
              <Calendar className="w-3 h-3" />
              Plage
              <ChevronDown className={`w-3 h-3 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} />
            </button>

            {/* Reset date si filtre actif */}
            {(datePreset !== 'all') && (
              <button
                type="button"
                onClick={() => { setDatePreset('all'); setCustomFrom(''); setCustomTo(''); setShowDatePicker(false); }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
                title="Réinitialiser le filtre de dates"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Sélecteur plage personnalisée */}
        {showDatePicker && datePreset === 'custom' && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 border-t border-white/8 animate-fadeIn">
            <div className="flex items-center gap-2 flex-1">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <label className="text-[11px] text-slate-400 font-bold shrink-0">Du :</label>
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={e => setCustomFrom(e.target.value)}
                className="flex-1 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white text-[11px] focus:outline-none focus:border-indigo-500/60 focus:bg-indigo-950/20 transition-all [color-scheme:dark]"
              />
            </div>
            <div className="flex items-center gap-2 flex-1">
              <label className="text-[11px] text-slate-400 font-bold shrink-0">Au :</label>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={e => setCustomTo(e.target.value)}
                className="flex-1 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white text-[11px] focus:outline-none focus:border-indigo-500/60 focus:bg-indigo-950/20 transition-all [color-scheme:dark]"
              />
            </div>
            {(customFrom || customTo) && (
              <button
                type="button"
                onClick={() => { setCustomFrom(''); setCustomTo(''); }}
                className="text-[11px] font-bold text-slate-400 hover:text-red-300 transition-colors cursor-pointer shrink-0"
              >
                Effacer
              </button>
            )}
          </div>
        )}

        {/* Synthèse contenus de la période — s'affiche si filtre actif + données */}
        {datePreset !== 'all' && periodContentStats.hasData && (
          <div className="pt-2 border-t border-white/6 grid grid-cols-1 sm:grid-cols-2 gap-2 animate-fadeIn">
            {/* Top Audios */}
            {periodContentStats.topAudios.length > 0 && (
              <div className="rounded-xl bg-emerald-950/30 border border-emerald-500/15 p-2.5 space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Headphones className="w-3 h-3" /> Audios écoutés sur la période
                </p>
                {periodContentStats.topAudios.map((a, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-300 truncate max-w-[160px]">{a.title}</span>
                    <span className="text-[10px] font-black text-emerald-300 font-mono shrink-0">{a.count}×</span>
                  </div>
                ))}
              </div>
            )}
            {/* Top Ebooks */}
            {periodContentStats.topEbooks.length > 0 && (
              <div className="rounded-xl bg-blue-950/30 border border-blue-500/15 p-2.5 space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <BookOpen className="w-3 h-3" /> Livres PDF lus sur la période
                </p>
                {periodContentStats.topEbooks.map((e, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-300 truncate max-w-[160px]">{e.title}</span>
                    <span className="text-[10px] font-black text-blue-300 font-mono shrink-0">{e.count}×</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
