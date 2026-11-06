import React from 'react';
import { Search, Bell, Headphones, Sparkles, Download, ShieldCheck, LogOut, ArrowLeft } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { usePush } from '../context/PushContext';
import { useXp } from '../context/XpContext';
import { StreakBadge } from './StreakSystem';

/**
 * Header RG Play — Navigation Flottante en Capsule de Verre (Style Glassmorphism Pur)
 * ─────────────────────────────────────────────────────────────────────────────
 * Barre en pilule de verre givré décollée de l'écran, avec reflets cristallins,
 * recherche intégrée, badge Sky Points VIP et centre de notifications.
 */

const getUserProfile = () => {
  try {
    const stored = localStorage.getItem('rg_user_profile');
    if (stored) return JSON.parse(stored);
  } catch {}
  return { name: 'Mon Compte', solde: 0, avatar: null };
};

export const Header = ({
  onSearch,
  searchQuery,
  activeTab,
  setActiveTab,
  onOpenInstallModal,
  onOpenNotifications,
  onOpenStreak,
  isAdmin = false,
  onAdminLogout,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { isSubscribed, requestPermission, unreadCount } = usePush();
  const { points } = useXp();
  const user = getUserProfile();

  const isAdminMode = activeTab === 'admin';

  return (
    <div className="sticky top-2 sm:top-4 z-40 w-full px-3 sm:px-6 pointer-events-none transition-all">
      <header className="max-w-7xl mx-auto rounded-full px-4 sm:px-6 py-2 sm:py-2.5 glass-pill pointer-events-auto flex items-center justify-between gap-3 shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.25)]">
        {/* ── Logo & Brand Minimaliste ── */}
        <div
          onClick={() => {
            if (isAdminMode) window.history.pushState({}, '', '/');
            setActiveTab('discover');
          }}
          className="flex items-center gap-2.5 cursor-pointer group shrink-0"
        >
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-105 border border-white/30 ${
            isAdminMode
              ? 'bg-linear-to-tr from-emerald-600 to-teal-500 shadow-emerald-500/30'
              : 'bg-linear-to-tr from-purple-600 via-fuchsia-600 to-pink-500 shadow-purple-500/40'
          }`}>
            {isAdminMode
              ? <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              : <Headphones className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            }
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-base sm:text-lg tracking-tight text-white font-['Outfit']">
                RG PLAY
              </span>
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/10 text-purple-200 border border-white/15">
                {isAdminMode ? 'Studio' : 'Audio'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Barre de Recherche en Capsule de Verre ── */}
        {!isAdminMode && (
          <div className="flex-1 max-w-xs sm:max-w-sm hidden md:block">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-purple-200/60" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Rechercher un livre, un auteur..."
                className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/15 focus:border-purple-300/60 rounded-full pl-9 pr-8 py-1.5 text-xs text-white placeholder-purple-200/50 outline-none transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-2xs text-slate-300 hover:text-white px-1.5 py-0.5 rounded-full bg-white/10 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Actions Droite ── */}
        {isAdminMode ? (
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-2xs font-bold text-emerald-200">Admin Studio</span>
            </div>

            <button
              onClick={() => { window.history.pushState({}, '', '/'); setActiveTab('discover'); }}
              className="px-3 py-1.5 rounded-full text-xs font-bold text-slate-200 hover:text-white bg-white/5 hover:bg-white/15 border border-white/10 flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Boutique</span>
            </button>

            {isAdmin && onAdminLogout && (
              <button
                onClick={onAdminLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-400/30 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Installer l'App */}
            {typeof window !== 'undefined' && !(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || localStorage.getItem('rg_pwa_installed') === 'true') && (
              <button
                onClick={onOpenInstallModal}
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/15 text-purple-200 hover:text-white transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Installer</span>
              </button>
            )}

            {/* Streak Badge */}
            <StreakBadge onClick={onOpenStreak} />

            {/* Solde Sky Points */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('rg:open-reward-ad'))}
              title="Gagner des points gratuits — Regardez une courte pub partenaire"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-400/30 shadow-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <span className="text-xs">🎁</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px]">
                {points} pts
              </span>
            </button>

            {/* Cloche Notifications */}
            {!isSubscribed ? (
              <button
                type="button"
                onClick={async () => {
                  const granted = await requestPermission();
                  if (granted && onOpenNotifications) onOpenNotifications();
                }}
                title="Activer les notifications push"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-linear-to-r from-purple-600 to-pink-600 text-white shadow-md border border-white/30 hover:scale-105 active:scale-95 transition-all cursor-pointer animate-pulse"
              >
                <Bell className="w-3.5 h-3.5 fill-white" />
                <span className="hidden sm:inline font-bold">Alertes</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenNotifications}
                title="Centre de notifications"
                className="relative p-2 rounded-full border border-white/15 bg-white/5 hover:bg-white/15 text-white transition-all active:scale-95 cursor-pointer"
              >
                <Bell className="w-4 h-4 text-purple-200" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-3.5 h-3.5 px-1 rounded-full bg-pink-500 text-white text-[9px] font-black flex items-center justify-center shadow-md animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            )}

            {/* Thème */}
            <button
              onClick={toggleTheme}
              title="Changer le thème"
              className="p-2 rounded-full text-purple-200/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Sparkles className={`w-3.5 h-3.5 ${theme === 'purple' ? 'text-amber-300' : 'text-purple-300'}`} />
            </button>

            {/* Profil Avatar */}
            <button
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-2 p-0.5 sm:pr-2.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/15 transition-all cursor-pointer"
            >
              <div className="relative">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full object-cover border border-purple-400/40" />
                ) : (
                  <div className="w-7 h-7 rounded-full border border-white/30 flex items-center justify-center text-xs font-bold bg-linear-to-tr from-purple-600 to-pink-500 text-white shadow-sm">
                    {(user.name || 'U')[0].toUpperCase()}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#07041A]" />
              </div>
              <span className="text-xs font-bold text-slate-100 hidden sm:block max-w-[80px] truncate">
                {user.name}
              </span>
            </button>
          </div>
        )}
      </header>
    </div>
  );
};
