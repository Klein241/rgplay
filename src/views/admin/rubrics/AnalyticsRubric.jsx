import React, { useState } from 'react';
import {
  Activity, Users, Zap, Headphones, TrendingUp,
  Share2, RefreshCw, Brain, AlertTriangle, DollarSign, BarChart2
} from 'lucide-react';

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


/**
 * Rubrique Statistiques & Analytics visiteurs
 * Props : books, analyticsData, loadingAnalytics, loadLiveAnalytics,
 *         selectedVisitorDetail, setSelectedVisitorDetail
 */
export const AnalyticsRubric = ({
  books,
  analyticsData,
  loadingAnalytics,
  loadLiveAnalytics,
  selectedVisitorDetail,
  setSelectedVisitorDetail,
}) => {
  const totalBooks = books.length;
  const {
    uniqueVisitors = 0,
    todayVisitors = 0,
    sources = [],
    topAudios = [],
    recentVisitors = [],
    convRate = '0.0',
  } = analyticsData || {};

  // ── Consommation API DeepSeek ──
  const [apiUsage] = useState(() => readApiUsageLog());
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

  return (

    <div className="space-y-6 animate-fadeIn">
      {/* Header avec bouton rafraîchir */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit'] flex items-center gap-2.5">
            <Activity className="w-7 h-7 text-emerald-400" />
            <span>Statistiques &amp; Visiteurs en Direct</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Suivi précis de tous les visiteurs (inscrits &amp; anonymes), sources d'acquisition et audios écoutés
          </p>
        </div>
        <button
          onClick={loadLiveAnalytics}
          disabled={loadingAnalytics}
          className="rg-btn-ghost px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingAnalytics ? 'animate-spin text-emerald-400' : ''}`} />
          <span>Actualiser</span>
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
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">Aujourd'hui</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-400 font-['Outfit']">{todayVisitors}</p>
          <p className="text-xs text-slate-400">Visites du Jour</p>
        </div>

        <div className="card-md space-y-1.5 border border-cyan-500/20 bg-cyan-950/10">
          <div className="flex items-center justify-between">
            <Headphones className="w-5 h-5 text-cyan-400" />
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">Écoutes</span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-cyan-300 font-['Outfit']">
            {topAudios.reduce((s, a) => s + (a.plays || 0), 0)}
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

      {/* ── SECTION DÉDIÉE : CONSOMMATION & COÛT DE L'API DEEPSEEK IA ── */}
      <div className="card-lg space-y-4 border border-indigo-500/25 bg-gradient-to-br from-[#120a26] via-[#160d30] to-[#0f0720]">
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
              <p className="text-[11px] text-slate-400">
                Suivi transparent des requêtes envoyées à DeepSeek (enrichissements, tuteur Agent SKY, recherche)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/30">
              ~0.5 FCFA / appel
            </span>
          </div>
        </div>

        {/* 4 Compteurs API */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-white/4 border border-white/8 space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aujourd'hui</p>
            <p className="text-xl sm:text-2xl font-black text-white font-['Outfit']">{todayCalls}</p>
            <p className="text-[10px] text-slate-400">appels IA envoyés</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/4 border border-white/8 space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">7 Derniers Jours</p>
            <p className="text-xl sm:text-2xl font-black text-cyan-300 font-['Outfit']">{weekCalls}</p>
            <p className="text-[10px] text-slate-400">appels sur la semaine</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/4 border border-white/8 space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Cumulé</p>
            <p className="text-xl sm:text-2xl font-black text-purple-300 font-['Outfit']">{totalCalls}</p>
            <p className="text-[10px] text-slate-400">requêtes enregistrées</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/4 border border-white/8 space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dépense Estimée</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-400 font-['Outfit']">
              {estimatedCostFcfa} <span className="text-xs font-normal text-slate-300">FCFA</span>
            </p>
            <p className="text-[10px] text-slate-400 font-mono">≈ ${((totalCalls * 0.0008) || 0).toFixed(3)} USD</p>
          </div>
        </div>

        {/* Note explicative rassurante sur les coûts */}
        <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 text-xs text-slate-300 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-indigo-200">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>Pourquoi le coût réel est infime malgré le nombre d'appels :</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            RG Play est verrouillé exclusivement sur le modèle <strong className="text-white font-mono">deepseek-v4-flash</strong>, qui est le plus rapide et économique du marché mondial (&lt;0.01$ sur votre tableau de bord).
            Les modèles coûteux (<strong className="text-slate-300 font-mono">deepseek-v4-pro</strong> et <strong className="text-slate-300 font-mono">vision</strong>) sont totalement neutralisés. De plus, nos prompts sont bridés à <strong>800 tokens max</strong>. Même avec 1 000 conversations complètes, la facture DeepSeek reste sous la barre de <strong>500 FCFA</strong> !
          </p>
        </div>

        {/* Dernières requêtes récentes */}
        {apiUsage.calls && apiUsage.calls.length > 0 && (
          <div className="pt-2 space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Derniers appels IA enregistrés ({Math.min(5, apiUsage.calls.length)})
            </p>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 no-scrollbar">
              {apiUsage.calls.slice(0, 5).map(c => (
                <div key={c.id} className="p-2 rounded-xl bg-white/4 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"></span>
                    <span className="font-bold text-white font-mono text-[11px]">{c.endpoint}</span>
                    <span className="text-slate-400 text-[10px] truncate">{c.title || c.query || c.type || ''}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">{c.time || c.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 2. SOURCES DE TRAFIC & AUDIOS RÉELLEMENT ÉCOUTÉS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Sources d'acquisition */}
        <div className="card-lg space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-purple-400" />
              <span>Origine du Trafic (D'où viennent vos visiteurs ?)</span>
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
                        className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-emerald-400 rounded-full transition-all duration-700"
                        style={{ width: `${src.pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Audios écoutés en direct */}
        <div className="card-lg space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Headphones className="w-4 h-4 text-emerald-400" />
              <span>Audios les Plus Écoutés (Statistiques Réelles)</span>
            </span>
            <span className="text-xs text-emerald-400 font-bold">Privé Admin</span>
          </h2>

          {topAudios.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">Aucune écoute enregistrée pour l'instant.</p>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 no-scrollbar">
              {topAudios.map((aud, idx) => (
                <div key={aud.id || idx} className="p-3 rounded-2xl bg-white/4 border border-white/6 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center text-[11px] flex-shrink-0 font-mono">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">{aud.title || aud.audiobook_title || 'Audiobook'}</p>
                      <p className="text-[10px] text-slate-400">
                        {aud.seconds || aud.total_seconds ? `~${Math.round((aud.seconds || aud.total_seconds) / 60)} min écoutées au total` : 'Écoutes en cours'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-black text-xs font-mono">
                      {aud.plays} écoute{aud.plays > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 3. JOURNAL DÉTAILLÉ DE TOUS LES VISITEURS (FEED EN DIRECT) ── */}
      <div className="card-lg space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>Flux des Visiteurs Récents ({recentVisitors.length})</span>
            </h2>
            <p className="text-xs text-slate-400">Cliquez sur un visiteur pour voir tous ses audios écoutés et interactions</p>
          </div>
          <span className="text-[11px] px-3 py-1 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold">Direct</span>
        </div>

        {recentVisitors.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <Users className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">Aucun visiteur enregistré dans la base pour le moment.</p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 no-scrollbar">
            {recentVisitors.map((vis) => {
              const isSelected = selectedVisitorDetail === vis.visitor_id;
              const hasAudios = (vis.audios && vis.audios.length > 0) || (vis.events && vis.events.some(e => e.event_type === 'audio_play'));
              const hasPurchases = (vis.actions && vis.actions.some(a => a.action === 'buy_click')) || (vis.events && vis.events.some(e => e.action === 'buy_click'));
              const timeAgo = vis.started_at ? new Date(vis.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'récent';

              return (
                <div
                  key={vis.visitor_id}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-purple-950/30 border-purple-500/50 shadow-lg'
                      : 'bg-white/4 border-white/6 hover:border-white/15'
                  }`}
                  onClick={() => setSelectedVisitorDetail(isSelected ? null : vis.visitor_id)}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center font-black text-xs text-white flex-shrink-0">
                        {vis.user_name ? vis.user_name[0].toUpperCase() : '👤'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-white truncate font-['Outfit']">
                            {vis.user_name || `Visiteur #${vis.visitor_id.slice(-6)}`}
                          </p>
                          {vis.user_email ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">Inscrit</span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-white/10 text-slate-400 font-bold">Anonyme</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">
                          {vis.device || 'Mobile'} • {vis.landing_url ? new URL(vis.landing_url).pathname : '/'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        vis.source === 'WhatsApp' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' :
                        vis.source === 'Facebook' ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' :
                        vis.source === 'TikTok' ? 'bg-pink-500/15 text-pink-300 border-pink-500/30' :
                        'bg-white/8 text-slate-300 border-white/10'
                      }`}>
                        {vis.source || 'Direct'}
                      </span>

                      {hasAudios && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold flex items-center gap-0.5">
                          <Headphones className="w-2.5 h-2.5" /> Écouté
                        </span>
                      )}

                      {hasPurchases && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                          🛒 Clic Achat
                        </span>
                      )}

                      <span className="text-[10px] text-slate-400 font-mono">{timeAgo}</span>
                    </div>
                  </div>

                  {/* Tiroir d'interaction détaillé */}
                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-white/10 space-y-2 text-xs animate-fadeIn">
                      <p className="font-bold text-purple-300 text-[11px] uppercase tracking-wider">
                        Historique d'Écoute &amp; Interactions de ce Visiteur :
                      </p>

                      {vis.audios && vis.audios.length > 0 ? (
                        <div className="space-y-1">
                          {vis.audios.map((a, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-white/4 text-slate-300 text-[11px]">
                              <span className="flex items-center gap-1.5 truncate">
                                <Headphones className="w-3 h-3 text-purple-400 flex-shrink-0" />
                                <span className="font-semibold text-white">{a.audiobook_title || 'Audio'}</span>
                              </span>
                              <span className="text-slate-400 font-mono">{a.seconds_listened || 0}s écoutées</span>
                            </div>
                          ))}
                        </div>
                      ) : vis.events && vis.events.filter(e => e.event_type === 'audio_play').length > 0 ? (
                        <div className="space-y-1">
                          {vis.events.filter(e => e.event_type === 'audio_play').map((a, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-white/4 text-slate-300 text-[11px]">
                              <span className="flex items-center gap-1.5 truncate">
                                <Headphones className="w-3 h-3 text-purple-400 flex-shrink-0" />
                                <span className="font-semibold text-white">{a.audiobook_title || 'Audio'}</span>
                              </span>
                              <span className="text-slate-400 font-mono">{a.seconds_listened || 0}s écoutées</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">Aucun extrait audio écouté lors de cette session.</p>
                      )}

                      {vis.actions && vis.actions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {vis.actions.map((act, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                              ⚡ Action : {act.action}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
