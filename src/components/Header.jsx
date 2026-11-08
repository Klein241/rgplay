import React from 'react';
import { Search, Bell, Headphones, Sparkles, Download, ShieldCheck, LogOut, ArrowLeft, User, ShoppingBag } from 'lucide-react';
import { usePush } from '../context/PushContext';
import { useXp } from '../context/XpContext';
import { StreakBadge } from './StreakSystem';

/**
 * Header RG Play — Navigation Flottante en Capsule de Verre Style Axolotl Pur
 * ─────────────────────────────────────────────────────────────────────────────
 * Copie fidèle du header de l'image de référence :
 * - Logo minimaliste à gauche
 * - Liens de navigation centrés (Découvrir, Audio, E-Books, Boutique, Compte)
 * - Recherche, Alertes et Profil à droite
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
  const { isSubscribed, requestPermission, unreadCount } = usePush();
  const { points } = useXp();
  const user = getUserProfile();

  const isAdminMode = activeTab === 'admin';

  const navLinks = [
    { id: 'discover', label: 'Découvrir' },
    { id: 'library', label: 'E-Books & PDF' },
    { id: 'store', label: 'Boutique' },
    { id: 'profile', label: 'Mon Compte' },
  ];

  return (
    <div className="sticky top-2 sm:top-4 z-50 w-full px-3 sm:px-6 pointer-events-none transition-all">
      <header
        className="max-w-7xl mx-auto rounded-full px-4 sm:px-6 py-2.5 sm:py-3 pointer-events-auto flex items-center justify-between gap-4 border border-white/20 shadow-[0_16px_40px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.25)]"
        style={{
          backgroundColor: 'rgba(6, 22, 18, 0.96)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        }}
      >
        {/* ── Logo & Brand Minimaliste Axolotl ── */}
        <div
          onClick={() => {
            if (isAdminMode) window.history.pushState({}, '', '/');
            setActiveTab('discover');
          }}
          className="flex items-center gap-2.5 cursor-pointer group shrink-0"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full btn-emerald-pill flex items-center justify-center shadow-lg transition-transform group-hover:scale-105 border border-white/40">
            {isAdminMode
              ? <ShieldCheck className="w-5 h-5 text-slate-950" />
              : <Headphones className="w-5 h-5 text-slate-950" />
            }
          </div>
          <div className="text-left">
            <span className="font-black text-base sm:text-lg tracking-tight text-white font-['Outfit'] block leading-none">
              RG PLAY
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">
              AUDIO &amp; LIVRES
            </span>
          </div>
        </div>

        {/* ── Liens Centrés Style Axolotl (Home | Ingredients | Science | Shop | About) ── */}
        {!isAdminMode && (
          <nav className="hidden lg:flex items-center gap-1 sm:gap-2">
            {navLinks.map((link) => {
              const isActive = activeTab === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => setActiveTab(link.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 shadow-sm'
                      : 'text-slate-200 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </nav>
        )}

        {/* ── Recherche & Actions Droite ── */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {!isAdminMode && (
            <div className="relative hidden md:block w-36 lg:w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-300/70" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Rechercher..."
                className="w-full bg-white/8 hover:bg-white/12 focus:bg-white/12 border border-white/20 focus:border-emerald-400/60 rounded-full pl-8 pr-6 py-1.5 text-xs text-white placeholder-slate-300/60 outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-slate-300 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Solde Sky Points */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('rg:open-reward-ad'))}
            title="Gagner des points gratuits"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black glass-pill text-amber-300 border border-amber-400/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <span>🎁</span>
            <span className="font-extrabold text-[11px] text-white">
              {points} pts
            </span>
          </button>

          {/* Cloche Notifications */}
          <button
            type="button"
            onClick={async () => {
              if (!isSubscribed) {
                const granted = await requestPermission();
                if (granted && onOpenNotifications) onOpenNotifications();
              } else if (onOpenNotifications) {
                onOpenNotifications();
              }
            }}
            title="Notifications"
            className="relative p-2 rounded-full glass-pill border border-white/20 text-white hover:text-emerald-300 transition-all active:scale-95 cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-3.5 h-3.5 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Profil Avatar */}
          <button
            onClick={() => setActiveTab('profile')}
            className="flex items-center gap-2 p-1 sm:pr-2.5 rounded-full glass-pill border border-white/20 transition-all cursor-pointer hover:border-emerald-400/40"
          >
            <div className="w-6 h-6 rounded-full btn-emerald-pill flex items-center justify-center text-[10px] font-black text-slate-950">
              {(user.name || 'U')[0].toUpperCase()}
            </div>
            <span className="text-xs font-bold text-slate-100 hidden sm:block max-w-[80px] truncate">
              {user.name}
            </span>
          </button>
        </div>
      </header>
    </div>
  );
};
