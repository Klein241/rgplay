import React, { useState } from 'react';
import {
  Headphones, BookOpen, Download, ShoppingBag,
  Zap, Clock, Smartphone, CheckCircle2, Radio,
  Sparkles, RefreshCw, Flame, ChevronUp, ChevronDown,
  Copy, Check
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────
export function formatDuration(totalSec = 0) {
  const s = Math.round(Number(totalSec) || 0);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function timeAgo(dateStr) {
  if (!dateStr) return 'récent';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'à l\'instant';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

// Source badge colors
export const SOURCE_STYLES = {
  WhatsApp:  { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/25', dot: 'bg-emerald-400' },
  Facebook:  { bg: 'bg-blue-500/15',    text: 'text-blue-300',    border: 'border-blue-500/25',    dot: 'bg-blue-400' },
  TikTok:    { bg: 'bg-pink-500/15',    text: 'text-pink-300',    border: 'border-pink-500/25',    dot: 'bg-pink-400' },
  Instagram: { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-300', border: 'border-fuchsia-500/25', dot: 'bg-fuchsia-400' },
  Direct:    { bg: 'bg-slate-500/15',   text: 'text-slate-300',   border: 'border-slate-500/25',   dot: 'bg-slate-400' },
};

export function getSourceStyle(src) {
  return SOURCE_STYLES[src] || SOURCE_STYLES.Direct;
}

// ─── Dictionnaire de traduction français pour les actions utilisateurs ───────
export const ACTION_TRANSLATIONS = {
  preview_click: 'Écoute extrait',
  buy_click: 'Intention achat',
  pwa_install: 'App installée',
  download_offline: 'Téléchargement',
  download: 'Téléchargement',
  favorite_toggle: 'Ajout favori',
  book_unlock: 'Livre débloqué',
  rewarded_ad_complete: 'Vidéo récompensée',
  share: 'Partage',
  search: 'Recherche',
  auth_login: 'Connexion',
  auth_register: 'Inscription',
  daily_reward: 'Bonus quotidien',
};

export function formatActionLabel(act) {
  const code = act.action || act.event_type || '';
  if (ACTION_TRANSLATIONS[code]) return ACTION_TRANSLATIONS[code];
  return code.replace(/_/g, ' ');
}

// ─── Segmentation helper ─────────────────────────────────────────────────────
export function segmentItem(v) {
  const hasAudios     = v.audios?.length > 0;
  const hasEbooks     = v.ebooks?.length > 0;
  const hasDownloads  = v.downloads?.length > 0;
  const hasPurchases  = v.actions?.some(a => a.action === 'buy_click');
  const hasPoints     = (Number(v.points) || 0) > 0;
  const isIdentified  = Boolean(v.user_name || v.user_email || v.has_whatsapp || v.registered_name || v.user_id);
  const isUser = hasAudios || hasEbooks || hasDownloads || hasPurchases || hasPoints || isIdentified;
  return { hasAudios, hasEbooks, hasDownloads, hasPurchases, hasPoints, isIdentified, isUser };
}

// ─── Single Card ─────────────────────────────────────────────────────────────
export const VisitorCard = ({ vis, isSelected, onToggle, isHighlighted = false }) => {
  const [copiedKey, setCopiedKey] = useState(null);
  const { hasAudios, hasEbooks, hasDownloads, hasPurchases, hasPoints, isIdentified, isUser } = segmentItem(vis);
  const pts = Number(vis.points) || 0;
  const srcStyle = getSourceStyle(vis.source);
  const displayName = vis.registered_name || vis.user_name
    || (isUser ? `Auditeur #${(vis.user_id || vis.visitor_id || 'usr').slice(-6)}` : `Visiteur #${(vis.visitor_id || 'vis').slice(-6)}`);
  const initial = displayName[0]?.toUpperCase() || '?';

  const handleCopy = (text, key, e) => {
    e?.stopPropagation();
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div
      className={`group relative rounded-2xl border transition-all duration-300 overflow-hidden cursor-pointer
        ${isHighlighted
          ? 'ring-2 ring-purple-400 border-purple-400/80 bg-purple-950/45 shadow-xl shadow-purple-950/40'
          : isSelected
          ? 'border-purple-500/50 shadow-lg shadow-purple-950/30 bg-purple-950/35'
          : isUser
          ? 'border-purple-500/15 hover:border-purple-500/35 hover:shadow-md hover:shadow-purple-950/20 bg-gradient-to-br from-purple-950/20 to-indigo-950/10'
          : 'border-white/6 hover:border-white/14 bg-white/3'}`}
      onClick={onToggle}
    >
      {/* Accent top border for users or highlighted */}
      {(isUser || isHighlighted) && (
        <div className={`absolute top-0 left-0 right-0 h-0.5 ${
          isHighlighted
            ? 'bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400'
            : 'bg-gradient-to-r from-transparent via-purple-500/40 to-transparent'
        }`} />
      )}

      <div className="p-4">
        {/* ── Main row ── */}
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white shrink-0 shadow-lg
            ${isUser
              ? 'bg-gradient-to-br from-purple-600 to-pink-600 shadow-purple-900/50'
              : 'bg-white/8 text-slate-400'}`}>
            {vis.avatar_url
              ? <img src={vis.avatar_url} alt={displayName} className="w-full h-full rounded-xl object-cover" />
              : <span>{isUser ? initial : '👁'}</span>
            }
            {/* Online pulse */}
            {(vis.total_duration_seconds > 0) && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-900 animate-pulse" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-white truncate">{displayName}</span>

              {/* Highlight badge */}
              {isHighlighted && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-purple-500/25 text-purple-200 border border-purple-400/50 font-black animate-pulse">
                  🎯 Cible recherchée
                </span>
              )}

              {/* Status badge */}
              {isIdentified ? (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 font-bold">
                  <CheckCircle2 size={9} /> Identifié
                </span>
              ) : isUser ? (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/25 font-bold">
                  <Radio size={9} className="animate-pulse" /> Actif
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/6 text-slate-400 border border-white/8 font-bold">
                  Découverte
                </span>
              )}

              {hasPoints && (
                <span className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25 font-bold">
                  <Sparkles size={9} /> {pts} pts
                </span>
              )}

              {(vis.is_pwa || (vis.device && String(vis.device).toLowerCase().includes('pwa')) || vis.actions?.some(a => a.action === 'pwa_install') || vis.events?.some(e => e.event_type === 'pwa_install' || e.action === 'pwa_install')) && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-bold" title="Application mobile PWA installée">
                  <Smartphone size={9} className="text-violet-400" /> App PWA
                </span>
              )}

              {/* Visiteur Récurrent (Plusieurs visites/sessions) */}
              {Number(vis.total_visits || vis.visits_count || vis.session_count) > 1 && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 font-bold" title="Auditeur fidèle : plusieurs sessions enregistrées sur la plateforme">
                  <RefreshCw size={9} /> {vis.total_visits || vis.visits_count || vis.session_count} visites
                </span>
              )}

              {/* Série d'écoute quotidienne (Streak) */}
              {Number(vis.daily_streak || vis.streak) > 1 && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-linear-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/30 font-bold" title="Série de jours d'écoute consécutifs">
                  <Flame size={9} className="text-orange-400 fill-orange-400" /> {vis.daily_streak || vis.streak}j consécutifs
                </span>
              )}
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 flex-wrap">
              {(vis.country || vis.flag) && (
                <span className="flex items-center gap-1">
                  <span>{vis.flag || '🌐'}</span>
                  <span className="font-medium text-slate-300">{vis.country_name || vis.country || 'Inconnu'}</span>
                </span>
              )}
              {vis.city && <span className="before:content-['•'] before:mr-1 before:text-slate-600">{vis.city}</span>}
              {vis.device && (
                <span className="before:content-['•'] before:mr-1 before:text-slate-600 flex items-center gap-1">
                  <Smartphone size={10} className="text-slate-500" />
                  {vis.device}
                </span>
              )}
              {vis.total_duration_seconds > 0 && (
                <span className="before:content-['•'] before:mr-1 before:text-slate-600 flex items-center gap-1 text-emerald-400 font-bold">
                  <Clock size={10} />
                  {formatDuration(vis.total_duration_seconds)}
                </span>
              )}
            </div>
          </div>

          {/* Right section */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Source */}
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg border ${srcStyle.bg} ${srcStyle.text} ${srcStyle.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${srcStyle.dot}`} />
              {vis.source === 'Direct' ? 'Accès direct' : (vis.source || 'Accès direct')}
            </span>

            {/* Activity pills */}
            <div className="hidden sm:flex items-center gap-1">
              {hasAudios && (
                <span title={`${vis.audios.length} audio(s) écouté(s)`} className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
                  <Headphones size={12} className="text-purple-400" />
                </span>
              )}
              {hasEbooks && (
                <span title="E-book lu" className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center">
                  <BookOpen size={12} className="text-cyan-400" />
                </span>
              )}
              {hasDownloads && (
                <span title="Fichier téléchargé" className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                  <Download size={12} className="text-emerald-400" />
                </span>
              )}
              {hasPurchases && (
                <span title="Intention d'achat" className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
                  <ShoppingBag size={12} className="text-amber-400" />
                </span>
              )}
            </div>

            {/* Time */}
            <span className="text-[10px] text-slate-500 font-mono hidden md:block">
              {timeAgo(vis.last_active_at || vis.started_at)}
            </span>

            {/* Chevron */}
            <span className="text-slate-600 group-hover:text-slate-400 transition-colors">
              {isSelected ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </div>
        </div>

        {/* ── Expanded detail drawer ── */}
        {isSelected && (
          <div className="mt-4 pt-4 border-t border-white/8 space-y-3 animate-fadeIn">
            {/* ID + contact row */}
            <div className="flex flex-wrap gap-2.5 text-[11px]">
              {/* User ID si présent */}
              {(vis.user_id || vis.id) && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/25">
                  <span className="text-purple-400 font-bold">User ID :</span>
                  <span className="font-mono text-purple-200">{vis.user_id || vis.id}</span>
                  <button
                    type="button"
                    onClick={(e) => handleCopy(vis.user_id || vis.id, 'uid', e)}
                    className="hover:text-white transition-colors ml-1"
                    title="Copier l'ID utilisateur"
                  >
                    {copiedKey === 'uid' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-slate-400" />}
                  </button>
                </div>
              )}

              {/* Visitor / Session ID */}
              {vis.visitor_id && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/8">
                  <span className="text-slate-500">Visitor ID :</span>
                  <span className="font-mono text-slate-300">{vis.visitor_id}</span>
                  <button
                    type="button"
                    onClick={(e) => handleCopy(vis.visitor_id, 'vid', e)}
                    className="hover:text-white transition-colors ml-1"
                    title="Copier le Visitor ID"
                  >
                    {copiedKey === 'vid' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-slate-400" />}
                  </button>
                </div>
              )}

              {vis.user_email && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/8">
                  <span className="text-slate-500">Email :</span>
                  <span className="text-slate-300">{vis.user_email}</span>
                </div>
              )}
              {vis.has_whatsapp && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 size={11} className="text-emerald-400" />
                  <span className="text-emerald-300 font-bold">WhatsApp lié</span>
                </div>
              )}
            </div>

            {/* Activity sections */}
            {hasAudios && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Headphones size={10} /> Audios écoutés
                </p>
                <div className="grid grid-cols-1 gap-1">
                  {vis.audios.map((a, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl bg-purple-950/30 border border-purple-500/15 text-[11px]">
                      <span className="text-white font-semibold truncate">{a.audiobook_title || 'Audio'}</span>
                      <span className="text-purple-400 font-mono font-bold shrink-0 ml-2">{a.seconds_listened || 0}s</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasEbooks && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen size={10} /> E-Books consultés
                </p>
                <div className="grid grid-cols-1 gap-1">
                  {vis.ebooks.map((b, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl bg-cyan-950/30 border border-cyan-500/15 text-[11px]">
                      <span className="text-white font-semibold truncate">{b.audiobook_title || 'Livre PDF'}</span>
                      <span className="text-cyan-400 font-bold shrink-0 ml-2">Ouvert</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasDownloads && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Download size={10} /> Téléchargements
                </p>
                <div className="grid grid-cols-1 gap-1">
                  {vis.downloads.map((d, i) => (
                    <div key={i} className="px-3 py-2 rounded-xl bg-emerald-950/30 border border-emerald-500/15 text-[11px] text-white font-semibold">
                      {d.audiobook_title || d.action}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions clés enregistrées (hors signaux techniques heartbeats) */}
            {(() => {
              const displayActions = (vis.actions || []).filter(a => {
                const code = (a.action || a.event_type || '').toLowerCase();
                return code !== 'heartbeat' && code !== 'page_view' && code !== 'session_start';
              });
              if (displayActions.length === 0) return null;
              return (
                <div className="space-y-1 pt-1">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap size={10} /> Actions clés
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {displayActions.map((act, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-bold">
                        <Zap size={9} className="text-indigo-400" />
                        {formatActionLabel(act)}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {!hasAudios && !hasEbooks && !hasDownloads && (!vis.actions || vis.actions.length === 0) && (
              <p className="text-[11px] text-slate-500 italic px-1">
                Visite de passage — aucune interaction enregistrée.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
