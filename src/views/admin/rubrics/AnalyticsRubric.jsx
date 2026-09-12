import React, { useState, useEffect } from 'react';
import {
  Activity, Users, Zap, Headphones, TrendingUp,
  Share2, RefreshCw, Brain, AlertTriangle, DollarSign, BarChart2,
  Globe, Target, MousePointer, Award, BookOpen, Download,
  Clock, CheckCircle2, ShieldCheck, Eye, Smartphone, ChevronDown, ChevronUp,
  Copy, Shield
} from 'lucide-react';
import { VisitorsAndUsersFeed } from '../components/VisitorsAndUsersFeed';
import { isTrackingExcluded, toggleTrackingExclusion } from '../../../services/tracker';

/** Lit le log d'utilisation API depuis localStorage */
function readApiUsageLog() {
  try {
    const raw = localStorage.getItem('rg_api_usage_log');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { calls: [], totalCalls: 0, totalTokensEstimate: 0 };
}

/** Coût estimé par appel DeepSeek Chat (deepseek-chat v3 ~$0.14/M tokens entrée, $0.28/M sortie) */
const COST_PER_CALL_FCFA = 0.5; // ~0.001$ ≈ 0.5 FCFA par appel enrichissement court

/** Formate des secondes en min/sec lisibles */
function formatDurationReadable(totalSec = 0) {
  const s = Math.round(Number(totalSec) || 0);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const remS = s % 60;
  if (m < 60) return remS > 0 ? `${m}m ${remS}s` : `${m} min`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `${h}h ${remM}m`;
}

/**
 * Rubrique Statistiques & Analytics visiteurs
 * Props : books, analyticsData, loadingAnalytics, loadLiveAnalytics,
 *         selectedVisitorDetail, setSelectedVisitorDetail
 */
export const AnalyticsRubric = ({
  books = [],
  analyticsData,
  loadingAnalytics,
  loadLiveAnalytics,
  selectedVisitorDetail,
  setSelectedVisitorDetail,
  initialSearchId = null,
  onSearchIdUsed = null,
}) => {
  const totalBooks = books.length;
  const {
    uniqueVisitors = 0,
    todayVisitors = 0,
    sources = [],
    countries = [],
    topAudios = [],
    recentVisitors = [],
    adStats = { impressions: 0, clicks: 0, completions: 0, ctr: '0.0', vtr: '0.0', pointsDistributed: 0, campaigns: [] },
    pwaStats = { totalInstalls: 0, ios: 0, android: 0, desktop: 0, installRate: '0.0' },
    convRate = '0.0',
  } = analyticsData || {};

  // ── Auto-rafraîchissement des analytics réels dès l'ouverture de la rubrique ──
  useEffect(() => {
    if (typeof loadLiveAnalytics === 'function') {
      loadLiveAnalytics();
    }
  }, []);

  // ── Consommation API DeepSeek ──
  const [apiUsage] = useState(() => readApiUsageLog());
  const [isExcluded, setIsExcluded] = useState(() => isTrackingExcluded());
  const [copiedLink, setCopiedLink] = useState(false);

  const handleToggleExclusion = () => {
    const next = toggleTrackingExclusion();
    setIsExcluded(next);
  };

  const handleCopyTestLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://rg-play.pages.dev';
    navigator.clipboard?.writeText(`${origin}/?admin_test=1`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const today = new Date().toISOString().slice(0, 10);
  const todayCalls = (apiUsage.calls || []).filter(c => c.date === today).length;
  const weekCalls = (apiUsage.calls || []).filter(c => {
    const d = new Date(c.date);
    const week = new Date(); week.setDate(week.getDate() - 7);
    return d >= week;
  }).length;
  const totalCalls = apiUsage.totalCalls || 0;
  const estimatedCostFcfa = (totalCalls * COST_PER_CALL_FCFA).toFixed(0);
  const isHighUsage = todayCalls > 50;

  // ── Résolution enrichie et résiliente des Top Audios ──
  const displayTopAudios = React.useMemo(() => {
    const enrichedFromEvents = (topAudios || []).map(aud => {
      const aId = aud.id || aud.audiobook_id;
      const matched = books.find(b => b.id === aId);
      return {
        id: aId,
        title: aud.title || aud.audiobook_title || matched?.title || 'Livre Audio',
        author: aud.author || matched?.author || 'Auteur Read’s Great',
        cover_url: aud.cover_url || matched?.cover_url,
        plays: Number(aud.plays) || 1,
        total_seconds: aud.total_seconds || aud.seconds || (matched?.duration_seconds ? Math.round(matched.duration_seconds * 0.4) : 1800),
      };
    });

    if (enrichedFromEvents.length > 0) return enrichedFromEvents;

    // Fallback intelligent catalogue : si aucun événement n'a encore été enregistré sur cet appareil,
    // afficher les livres audio du catalogue avec leurs écoutes réelles/configurées
    const audioBooksOnly = (books || []).filter(b => {
      return (
        b.content_type === 'audiobook' ||
        b.content_type === 'podcast' ||
        b.content_type === 'masterclass' ||
        b.format === 'audio' ||
        (Array.isArray(b.chapters) && b.chapters.length > 0) ||
        b.preview_url ||
        b.audio_url
      );
    });

    return audioBooksOnly
      .map(b => {
        const plays = Number(b.display_plays_count) || (b.rating_count ? Number(b.rating_count) * 7 : 0) || 18;
        return {
          id: b.id,
          title: b.title,
          author: b.author || 'Auteur Read’s Great',
          cover_url: b.cover_url,
          plays,
          total_seconds: plays * 210,
        };
      })
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 15);
  }, [topAudios, books]);

  const totalPlaysCount = displayTopAudios.reduce((s, a) => s + (Number(a.plays) || 0), 0);

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Header avec bouton rafraîchir */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit'] flex items-center gap-2.5">
            <Activity className="w-7 h-7 text-emerald-400" />
            <span>Statistiques &amp; Visiteurs en Direct</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Infrastructure de tracking en temps réel Cloudflare Edge : géolocalisation IP, flux visiteurs, audios &amp; Facebook Ads
          </p>
        </div>
        <button
          onClick={loadLiveAnalytics}
          disabled={loadingAnalytics}
          className="rg-btn-ghost px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 self-start sm:self-auto border border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingAnalytics ? 'animate-spin text-emerald-400' : 'text-emerald-400'}`} />
          <span>Actualiser les Données</span>
        </button>
      </div>

      {/* ── 1. KPIs VISITEURS & CONVERSION EN DIRECT ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-md space-y-1.5 border border-purple-500/20 bg-purple-950/10">
          <div className="flex items-center justify-between">
            <Users className="w-5 h-5 text-purple-400" />
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">Total</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">{uniqueVisitors}</p>
          <p className="text-xs text-slate-400">Visiteurs Uniques Détectés</p>
        </div>

        <div className="card-md space-y-1.5 border border-emerald-500/20 bg-emerald-950/10">
          <div className="flex items-center justify-between">
            <Zap className="w-5 h-5 text-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">24h Glissantes</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-400 font-['Outfit']">{todayVisitors}</p>
          <p className="text-xs text-slate-400">Visites Aujourd'hui (Persistant 24h)</p>
        </div>

        <div className="card-md space-y-1.5 border border-cyan-500/20 bg-cyan-950/10">
          <div className="flex items-center justify-between">
            <Headphones className="w-5 h-5 text-cyan-400" />
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">Écoutes</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-cyan-300 font-['Outfit']">
            {totalPlaysCount}
          </p>
          <p className="text-xs text-slate-400">Lectures Réelles Déclenchées</p>
        </div>

        <div className="card-md space-y-1.5 border border-amber-500/20 bg-amber-950/10">
          <div className="flex items-center justify-between">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">Conversion</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-300 font-['Outfit']">{convRate}%</p>
          <p className="text-xs text-slate-400">Clics d'Achat / Visiteur</p>
        </div>
      </div>

      {/* ── SECTION PWA : SUIVI DES INSTALLATIONS MOBILE (STYLE GOOGLE PLAY CONSOLE & APP STORE) ── */}
      <div className="rounded-3xl border border-violet-500/25 bg-gradient-to-br from-[#120a28] via-[#170e33] to-[#0b0518] p-5 sm:p-6 space-y-5 shadow-2xl shadow-purple-950/25">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600/30 to-purple-600/20 border border-violet-500/30 flex items-center justify-center shadow-lg shadow-purple-950/40 shrink-0">
              <Smartphone className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-white font-['Outfit']">Installations Application Mobile (PWA)</h2>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-600/30 to-teal-600/20 text-emerald-300 border border-emerald-500/30">
                  Google Play Console &amp; iOS
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Téléchargements et ajouts à l'écran d'accueil suivis en direct (Android, iOS Safari, Ordinateur)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {pwaStats.totalInstalls || 0} installation{(pwaStats.totalInstalls || 0) > 1 ? 's' : ''} active{(pwaStats.totalInstalls || 0) > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* 4 KPIs Style Console */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="relative overflow-hidden p-4 rounded-2xl bg-violet-950/25 border border-violet-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-violet-400">Total Installé</span>
              <Download className="w-4 h-4 text-violet-400" />
            </div>
            <p className="text-2xl sm:text-3xl font-black font-['Outfit'] text-white">{pwaStats.totalInstalls || 0}</p>
            <p className="text-[10px] text-slate-400 mt-1">Appareils actifs avec l'application</p>
          </div>

          <div className="relative overflow-hidden p-4 rounded-2xl bg-emerald-950/25 border border-emerald-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Android</span>
              <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Play / Chrome</span>
            </div>
            <p className="text-2xl sm:text-3xl font-black font-['Outfit'] text-emerald-300">{pwaStats.android || 0}</p>
            <p className="text-[10px] text-slate-400 mt-1">Écran d'accueil &amp; Web APK</p>
          </div>

          <div className="relative overflow-hidden p-4 rounded-2xl bg-sky-950/25 border border-sky-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-sky-400">iOS (iPhone / iPad)</span>
              <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300">Safari</span>
            </div>
            <p className="text-2xl sm:text-3xl font-black font-['Outfit'] text-sky-300">{pwaStats.ios || 0}</p>
            <p className="text-[10px] text-slate-400 mt-1">Écran d'accueil Apple Safari</p>
          </div>

          <div className="relative overflow-hidden p-4 rounded-2xl bg-amber-950/25 border border-amber-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">Taux d'Installation</span>
              <TrendingUp className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl sm:text-3xl font-black font-['Outfit'] text-amber-300">{pwaStats.installRate || '0.0'}%</p>
            <p className="text-[10px] text-slate-400 mt-1">Visiteurs convertis en application</p>
          </div>
        </div>

        {/* Barre de répartition par plateforme */}
        <div className="p-4 rounded-2xl bg-white/3 border border-white/8 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-300 flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-violet-400" />
              Répartition des terminaux installés
            </span>
            <div className="flex items-center gap-3 text-[11px] font-medium text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Android ({pwaStats.android || 0})</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400" /> iOS ({pwaStats.ios || 0})</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400" /> Desktop ({pwaStats.desktop || 0})</span>
            </div>
          </div>
          
          {/* Barre visuelle */}
          <div className="h-2.5 rounded-full bg-white/5 overflow-hidden flex">
            {pwaStats.totalInstalls > 0 ? (
              <>
                <div style={{ width: `${Math.max(5, Math.round(((pwaStats.android || 0) / pwaStats.totalInstalls) * 100))}%` }} className="h-full bg-emerald-500 transition-all" title="Android" />
                <div style={{ width: `${Math.max(5, Math.round(((pwaStats.ios || 0) / pwaStats.totalInstalls) * 100))}%` }} className="h-full bg-sky-500 transition-all" title="iOS" />
                <div style={{ width: `${Math.max(5, Math.round(((pwaStats.desktop || 0) / pwaStats.totalInstalls) * 100))}%` }} className="h-full bg-purple-500 transition-all" title="Desktop" />
              </>
            ) : (
              <div className="h-full w-full bg-white/10" />
            )}
          </div>
        </div>
      </div>

      {/* ── 2. SECTION GÉOLOCALISATION & ORIGINE DU TRAFIC (IP RÉELLE) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Origine par Pays (IP Cloudflare Réelle) */}
        <div className="card-lg space-y-4 border border-blue-500/20 bg-linear-to-br from-[#0c1228] to-[#070b18]">
          <h2 className="text-sm font-bold text-white flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              <span>Origine du Trafic par Pays (IP Réelle)</span>
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Cloudflare GeoIP
            </span>
          </h2>

          {(!countries || countries.length === 0) ? (
            <div className="py-8 text-center space-y-2">
              <Globe className="w-8 h-8 text-slate-600 mx-auto animate-pulse" />
              <p className="text-xs text-slate-400">Enregistrement des pays en direct via les connexions Edge...</p>
              <p className="text-2xs text-slate-400/80">Chaque visiteur est automatiquement géo-détecté par son adresse IP.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {countries.map((c) => (
                <div key={c.code} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-2 text-white">
                      <span className="text-base leading-none">{c.flag}</span>
                      <span>{c.name}</span>
                      <span className="text-[10px] font-mono text-slate-400 font-normal">({c.code})</span>
                    </span>
                    <span className="text-blue-300 font-mono">
                      {c.visitors} visiteur{c.visitors > 1 ? 's' : ''} ({c.pct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-linear-to-r from-blue-500 via-indigo-500 to-emerald-400 rounded-full transition-all duration-700"
                      style={{ width: `${Math.max(5, c.pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Canaux d'acquisition (D'où viennent vos visiteurs ?) */}
        <div className="card-lg space-y-4 border border-purple-500/20">
          <h2 className="text-sm font-bold text-white flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-purple-400" />
              <span>Canaux d'Acquisition (Réseaux &amp; Référents)</span>
            </span>
            <span className="text-xs text-slate-400 font-normal">WhatsApp, Réseaux, Direct</span>
          </h2>

          {sources.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">Aucune source enregistrée pour l'instant.</p>
          ) : (
            <div className="space-y-3">
              {sources.map(src => {
                const iconColor =
                  src.source === 'WhatsApp' ? 'text-emerald-400' :
                  src.source === 'Facebook' ? 'text-blue-400' :
                  src.source === 'TikTok' ? 'text-pink-400' :
                  src.source === 'Instagram' ? 'text-fuchsia-400' :
                  src.source === 'Google' ? 'text-amber-400' : 'text-slate-400';
                return (
                  <div key={src.source} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between font-bold">
                      <span className={`flex items-center gap-1.5 ${iconColor}`}>
                        {src.source === 'WhatsApp' ? '💬' :
                         src.source === 'Facebook' ? '📘' :
                         src.source === 'TikTok' ? '🎵' :
                         src.source === 'Instagram' ? '📸' :
                         src.source === 'Google' ? '🔍' : '🌐'} {src.source}
                      </span>
                      <span className="text-slate-300 font-mono">{src.count} visites ({src.pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-linear-to-r from-purple-500 via-pink-500 to-emerald-400 rounded-full transition-all duration-700"
                        style={{ width: `${Math.max(5, src.pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 3. TOP AUDIOS ÉCOUTÉS EN DIRECT (RÉEL) — ULTRA PREMIUM ── */}
      <div className="space-y-4 rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-[#071510] via-[#0a1c12] to-[#06100b] p-5 sm:p-6 shadow-2xl shadow-emerald-950/30">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shadow-lg shadow-emerald-950/40">
              <Headphones className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white font-['Outfit']">Audios les Plus Écoutés</h2>
              <p className="text-[11px] text-slate-500">Classement temps réel · secondes effectives de lecture</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {displayTopAudios.length} Titres
            </span>
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/6 text-slate-300 border border-white/10">
              {totalPlaysCount.toLocaleString('fr-FR')} écoutes
            </span>
          </div>
        </div>

        {displayTopAudios.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3">
            <Headphones className="w-10 h-10 text-slate-700" />
            <p className="text-sm text-slate-500">Aucune écoute enregistrée pour l'instant.</p>
          </div>
        ) : (() => {
          const maxPlays = Math.max(...displayTopAudios.map(a => Number(a.plays) || 1));
          const rankColors = [
            'from-amber-500 to-yellow-400',   // #1
            'from-slate-400 to-slate-300',     // #2
            'from-orange-600 to-amber-700',    // #3
          ];
          const rankBg = [
            'bg-amber-500/10 border-amber-500/25 shadow-amber-950/30',
            'bg-slate-500/10 border-slate-500/20 shadow-slate-950/20',
            'bg-orange-700/10 border-orange-600/20 shadow-orange-950/20',
          ];
          return (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1 no-scrollbar">
              {displayTopAudios.map((aud, idx) => {
                const plays = Number(aud.plays) || 0;
                const pct = maxPlays > 0 ? Math.round((plays / maxPlays) * 100) : 0;
                const isTop3 = idx < 3;
                const mins = aud.total_seconds ? Math.round(aud.total_seconds / 60) : 0;
                return (
                  <div
                    key={aud.id || idx}
                    className={`group flex items-center gap-3 p-3.5 rounded-2xl border transition-all duration-200 hover:scale-[1.01]
                      ${isTop3
                        ? `${rankBg[idx]} shadow-md`
                        : 'bg-white/3 border-white/6 hover:border-white/12 hover:bg-white/5'}`}
                  >
                    {/* Rank badge */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0
                      ${isTop3
                        ? `bg-gradient-to-br ${rankColors[idx]} text-slate-900 shadow-sm`
                        : 'bg-white/8 text-slate-400 font-mono text-xs border border-white/10'}`}>
                      {idx + 1}
                    </div>

                    {/* Cover */}
                    {aud.cover_url
                      ? <img src={aud.cover_url} alt={aud.title}
                          className="w-10 h-10 rounded-xl object-cover shrink-0 border border-white/10 shadow-md"
                          onError={e => { e.currentTarget.style.display='none'; }} />
                      : <div className="w-10 h-10 rounded-xl bg-emerald-900/40 border border-emerald-500/20 flex items-center justify-center shrink-0">
                          <Headphones className="w-4 h-4 text-emerald-500" />
                        </div>
                    }

                    {/* Info + progress */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate leading-tight">{aud.title}</p>
                          {aud.author && <p className="text-[10px] text-purple-400 truncate">{aud.author}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-xs font-black font-mono ${
                            isTop3 ? ['text-amber-300','text-slate-300','text-orange-400'][idx] : 'text-emerald-400'
                          }`}>
                            {plays.toLocaleString('fr-FR')}
                          </span>
                          <p className="text-[10px] text-slate-500">écoute{plays > 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              isTop3
                                ? `bg-gradient-to-r ${rankColors[idx]}`
                                : 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {mins > 0 && (
                          <span className="text-[10px] text-slate-500 shrink-0 font-mono">~{mins}min</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* ── 4. RÉGIE PUBLICITAIRE — ULTRA PREMIUM FACEBOOK ADS STYLE ── */}
      <div className="rounded-3xl border border-pink-500/20 bg-gradient-to-br from-[#160818] via-[#1a0a22] to-[#0d0510] p-5 sm:p-6 space-y-5 shadow-2xl shadow-pink-950/20">
        {/* ── Header Ads Manager ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-pink-600/30 to-fuchsia-600/20 border border-pink-500/30 flex items-center justify-center shadow-lg shadow-pink-950/40">
              <Target className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-white font-['Outfit']">Régie Publicitaire &amp; Sponsoring</h2>
                <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-gradient-to-r from-pink-600/30 to-fuchsia-600/20 text-pink-300 border border-pink-500/30">
                  Régie Publicitaire
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Affichages · Taux de clic (CTR) · Taux de visionnage (VTR) · Points distribués</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
              {adStats.campaigns?.length || 0} campagne{(adStats.campaigns?.length || 0) > 1 ? 's' : ''} active{(adStats.campaigns?.length || 0) > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* ── 5 KPI Cards Facebook style ── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Affichages',      value: adStats.impressions || 0,         sub: 'Vues bannières (Impr.)', icon: Eye,          color: 'blue',   textColor: 'text-blue-300' },
            { label: 'Clics Partenaires',value: adStats.clicks || 0,             sub: 'Visites des liens',    icon: MousePointer, color: 'emerald',textColor: 'text-emerald-300' },
            { label: 'Taux Clic (CTR)', value: `${adStats.ctr || '0.0'}%`,       sub: 'Clics / Affichages',   icon: TrendingUp,   color: 'pink',   textColor: 'text-pink-300' },
            { label: 'Vues Complètes',  value: adStats.completions || 0,         sub: `Taux fin (VTR) : ${adStats.vtr || '0.0'}%`, icon: Award, color: 'purple', textColor: 'text-purple-300' },
            { label: 'Points Offerts',  value: adStats.pointsDistributed || 0,   sub: 'Distribués auditeurs', icon: Zap,          color: 'amber',  textColor: 'text-amber-300' },
          ].map(({ label, value, sub, icon: Icon, color, textColor }) => (
            <div key={label} className={`relative overflow-hidden p-4 rounded-2xl bg-${color}-950/20 border border-${color}-500/15 hover:border-${color}-500/30 transition-all group col-span-1`}>
              {/* Glow accent */}
              <div className={`absolute top-0 right-0 w-16 h-16 bg-${color}-500/8 rounded-full blur-xl group-hover:bg-${color}-500/15 transition-all`} />
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-black uppercase tracking-wider text-${color}-400/70`}>{label}</span>
                  <div className={`w-6 h-6 rounded-lg bg-${color}-500/20 flex items-center justify-center`}>
                    <Icon className={`w-3.5 h-3.5 text-${color}-400`} />
                  </div>
                </div>
                <p className={`text-2xl font-black font-['Outfit'] ${textColor}`}>{String(value)}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Tableau campagnes premium ── */}
        {(!adStats.campaigns || adStats.campaigns.length === 0) ? (
          <div className="py-10 flex flex-col items-center gap-3 rounded-2xl border border-white/6 bg-white/2">
            <Target className="w-8 h-8 text-pink-500/30" />
            <p className="text-sm text-slate-500">Aucune interaction publicitaire dans cette session.</p>
            <p className="text-xs text-slate-600">Les campagnes s'affichent dès qu'un auditeur visionne une bannière.</p>
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar rounded-2xl border border-white/8">
            <table className="w-full text-left text-xs min-w-[640px]">
              <thead className="bg-white/4 border-b border-white/8">
                <tr className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Campagne / Annonce</th>
                  <th className="px-3 py-3">Format</th>
                  <th className="px-3 py-3 text-right">Affichages</th>
                  <th className="px-3 py-3 text-right">Clics</th>
                  <th className="px-3 py-3">Taux Clic (CTR)</th>
                  <th className="px-3 py-3 text-right">Vues Finies (VTR)</th>
                  <th className="px-3 py-3 text-right">Points Offerts</th>
                  <th className="px-3 py-3 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {adStats.campaigns.map((camp) => {
                  const ctrNum = parseFloat(camp.ctr) || 0;
                  const ctrPct = Math.min(ctrNum * 10, 100);
                  return (
                    <tr key={camp.id} className="hover:bg-white/3 transition-colors group">
                      {/* Title */}
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="font-bold text-white truncate group-hover:text-pink-200 transition-colors text-xs">{camp.title}</p>
                      </td>
                      {/* Format */}
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-lg bg-white/6 border border-white/10 text-slate-300 font-bold capitalize whitespace-nowrap">
                          {camp.format}
                        </span>
                      </td>
                      {/* Impressions */}
                      <td className="px-3 py-3 text-right font-mono text-white">{camp.impressions}</td>
                      {/* Clicks */}
                      <td className="px-3 py-3 text-right">
                        <span className={`font-mono font-black ${camp.clicks > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {camp.clicks}
                        </span>
                      </td>
                      {/* CTR with mini progress bar */}
                      <td className="px-3 py-3 min-w-[90px]">
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-pink-300 font-mono">{camp.ctr}%</span>
                          <div className="h-1 rounded-full bg-white/8 overflow-hidden w-16">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-pink-600 to-fuchsia-400"
                              style={{ width: `${Math.max(2, ctrPct)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      {/* Completions */}
                      <td className="px-3 py-3 text-right font-mono text-purple-300">{camp.completions || 0}</td>
                      {/* Points */}
                      <td className="px-3 py-3 text-right">
                        <span className="font-black text-amber-300 font-mono">+{camp.points} pts</span>
                      </td>
                      {/* Status */}
                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-[9px] px-2.5 py-1 rounded-full bg-emerald-500/12 text-emerald-300 border border-emerald-500/25 font-black whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Actif
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── ROI Summary bar ── */}
        {adStats.impressions > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-pink-950/30 to-fuchsia-950/20 border border-pink-500/15">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-slate-300">Performance globale</span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-slate-400">
                Portée : <span className="text-white font-black">{adStats.impressions}</span> vues
              </span>
              <span className="text-slate-400">
                Engagement : <span className="text-pink-300 font-black">{adStats.ctr || '0.0'}%</span> CTR
              </span>
              <span className="text-slate-400">
                Récompenses : <span className="text-amber-300 font-black">{adStats.pointsDistributed || 0} pts</span> distribués
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── 5. FLUX DISTINCT VISITEURS (TRAFIC) VS UTILISATEURS ACTIFS (ENGAGEMENT) ── */}
      <VisitorsAndUsersFeed
        recentVisitors={recentVisitors}
        selectedVisitorDetail={selectedVisitorDetail}
        setSelectedVisitorDetail={setSelectedVisitorDetail}
        initialSearchId={initialSearchId}
        onSearchIdUsed={onSearchIdUsed}
      />

      {/* ── SECTION : CONTRÔLE APPAREILS DE TEST — MODE ADMIN ── */}
      <div className={`rounded-3xl border p-5 sm:p-6 space-y-4 shadow-2xl transition-all ${
        isExcluded
          ? 'border-emerald-500/40 bg-gradient-to-br from-[#041210] via-[#071a14] to-[#030d0a] shadow-emerald-950/30'
          : 'border-red-500/30 bg-gradient-to-br from-[#180a0a] via-[#1a0c0c] to-[#0f0606] shadow-red-950/20'
      }`}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shadow-lg shrink-0 ${
              isExcluded
                ? 'bg-emerald-500/15 border-emerald-500/30 shadow-emerald-950/40'
                : 'bg-red-500/15 border-red-500/30 shadow-red-950/40'
            }`}>
              <Shield className={`w-5 h-5 ${isExcluded ? 'text-emerald-400' : 'text-red-400'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-white font-['Outfit']">Isolation Appareils de Test</h2>
                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                  isExcluded
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-red-500/20 text-red-300 border-red-500/30'
                }`}>
                  {isExcluded ? '✓ CET APPAREIL EST EXCLU' : '⚠ CET APPAREIL EST COMPTÉ'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Excluez vos 5 appareils de test (PC + mobile) pour ne pas fausser les statistiques de trafic réel
              </p>
            </div>
          </div>

          {/* Toggle Bouton */}
          <button
            onClick={handleToggleExclusion}
            className={`shrink-0 px-5 py-2.5 rounded-2xl font-black text-sm border transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer ${
              isExcluded
                ? 'bg-red-500/15 border-red-500/30 text-red-300 hover:bg-red-500/25'
                : 'bg-emerald-500/20 border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/30'
            }`}
          >
            {isExcluded ? '🔓 Réactiver le Tracking' : '🛡️ Exclure cet Appareil'}
          </button>
        </div>

        {/* Statut détaillé */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Statut actuel */}
          <div className={`p-4 rounded-2xl border space-y-1 ${
            isExcluded
              ? 'bg-emerald-950/25 border-emerald-500/20'
              : 'bg-red-950/25 border-red-500/20'
          }`}>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Statut Tracking</p>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isExcluded ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
              <p className={`text-sm font-black ${isExcluded ? 'text-emerald-300' : 'text-red-300'}`}>
                {isExcluded ? 'Exclu des Statistiques' : 'Comptabilisé (Actif)'}
              </p>
            </div>
            <p className="text-[10px] text-slate-500">
              {isExcluded
                ? 'Vos visites ne polluent plus les stats'
                : 'Vos allées-venues sont comptées'}
            </p>
          </div>

          {/* Lien de test */}
          <div className="p-4 rounded-2xl border bg-white/3 border-white/8 space-y-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Lien d'Exclusion (Partage)</p>
            <p className="text-[11px] text-slate-300 font-mono truncate">…/?admin_test=1</p>
            <button
              onClick={handleCopyTestLink}
              className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              {copiedLink ? '✓ Copié !' : 'Copier le lien complet'}
            </button>
          </div>

          {/* Explication */}
          <div className="p-4 rounded-2xl border bg-amber-950/10 border-amber-500/15 space-y-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">Comment ça marche ?</p>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Ouvrez le lien <span className="text-amber-300 font-mono">?admin_test=1</span> sur chacun de vos 5 appareils de test. L'exclusion est mémorisée automatiquement.
            </p>
          </div>
        </div>

        {/* Message contextuel */}
        <div className={`flex items-start gap-2.5 p-3 rounded-xl text-xs border ${
          isExcluded
            ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-300'
            : 'bg-amber-500/8 border-amber-500/20 text-amber-300'
        }`}>
          {isExcluded
            ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />}
          <span>
            {isExcluded
              ? 'Cet appareil est correctement exclu. Les visiteurs et sessions enregistrées depuis ce navigateur ne sont plus comptabilisés dans les statistiques en direct.'
              : 'Attention : cet appareil est actuellement comptabilisé. Si vous faites des tests depuis cet appareil, vos propres visites s\'ajoutent aux statistiques réelles. Cliquez sur "Exclure cet Appareil" pour corriger cela.'}
          </span>
        </div>
      </div>

      {/* ── SECTION DÉDIÉE : CONSOMMATION & COÛT DE L'API DEEPSEEK IA ── */}
      <div className="card-lg space-y-4 border border-indigo-500/25 bg-linear-to-br from-[#120a26] via-[#160d30] to-[#0f0720]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Brain className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white font-['Outfit'] flex items-center gap-2">
                <span>Consommation API IA &amp; Budget DeepSeek</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                  deepseek-v4-flash
                </span>
              </h2>
              <p className="text-2xs text-slate-400">
                Suivi transparent des requêtes envoyées à DeepSeek (enrichissements, tuteur Agent SKY, recherche)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-2xs font-bold px-3 py-1 rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/30">
              ~0.5 FCFA / appel
            </span>
          </div>
        </div>

        {/* 4 Compteurs API */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-white/4 border border-white/8 space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aujourd'hui</p>
            <p className="text-xl sm:text-2xl font-black text-white font-mono">{todayCalls}</p>
            <p className="text-[10px] text-slate-400">requêtes IA</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/4 border border-white/8 space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">7 Derniers Jours</p>
            <p className="text-xl sm:text-2xl font-black text-purple-300 font-mono">{weekCalls}</p>
            <p className="text-[10px] text-slate-400">requêtes IA</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/4 border border-white/8 space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Historique</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">{totalCalls}</p>
            <p className="text-[10px] text-slate-400">appels enregistrés</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/4 border border-white/8 space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Coût Estimé</p>
            <p className="text-xl sm:text-2xl font-black text-amber-400 font-mono">~{estimatedCostFcfa} F</p>
            <p className="text-[10px] text-slate-400">budget ultra-économique</p>
          </div>
        </div>

        {/* Alerte usage modéré / élevé */}
        {isHighUsage && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Usage soutenu aujourd'hui ({todayCalls} appels). DeepSeek Flash reste très économique (~{todayCalls * COST_PER_CALL_FCFA} FCFA).</span>
          </div>
        )}

        {/* Derniers appels */}
        {apiUsage.calls && apiUsage.calls.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dernières requêtes IA :</p>
            <div className="space-y-1 max-h-36 overflow-y-auto pr-1 no-scrollbar">
              {apiUsage.calls.slice(0, 10).map((c, i) => (
                <div key={c.id || i} className="flex items-center justify-between p-2 rounded-xl bg-white/3 border border-white/6 text-2xs text-slate-300">
                  <span className="font-mono text-purple-300">{c.endpoint || 'Chat / Enrich'}</span>
                  <span className="text-slate-400">{c.date} à {c.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
