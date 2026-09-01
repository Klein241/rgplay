import React from 'react';
import { Search, Bell, Headphones, Sparkles, Download, ShieldCheck, LogOut, ArrowLeft } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { usePush } from '../context/PushContext';

// ── Données utilisateur (localStorage — pas de données techniques) ────────────
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
  isAdmin = false,
  onAdminLogout,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { isSubscribed, requestPermission, unreadCount } = usePush();
  const user = getUserProfile();

  const isAdminMode = activeTab === 'admin';

  return (
    <header
      className="sticky top-0 z-40 w-full transition-all"
      style={{
        background: 'rgba(5, 3, 17, 0.90)',
        backdropFilter: 'blur(32px) saturate(200%)',
        WebkitBackdropFilter: 'blur(32px) saturate(200%)',
        borderBottom: '1px solid rgba(168, 85, 247, 0.14)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.05) inset, 0 4px 24px rgba(0,0,0,0.40)',
      }}
    >
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-3.5 flex items-center gap-4 justify-between">

        {/* ── Logo & Brand ── */}
        <div
          onClick={() => {
            if (isAdminMode) window.history.pushState({}, '', '/');
            setActiveTab('discover');
          }}
          className="flex items-center gap-3 cursor-pointer group flex-shrink-0"
        >
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-105 ${
            isAdminMode
              ? 'bg-gradient-to-br from-emerald-600 to-teal-700 shadow-emerald-500/30'
              : 'bg-gradient-to-br from-purple-600 via-fuchsia-600 to-pink-600 shadow-purple-500/30'
          }`}>
            {isAdminMode
              ? <ShieldCheck className="w-5 h-5 text-white" />
              : <Headphones className="w-5 h-5 text-white" />
            }
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <span className="font-black text-lg tracking-tight bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent font-['Outfit']">
                RG Play
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                isAdminMode
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                  : 'bg-purple-500/15 text-purple-300 border border-purple-500/25'
              }`}>
                {isAdminMode ? 'Studio' : 'Audiobooks'}
              </span>
            </div>
            <p className="text-[11px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
              Bibliothèque & Écoute Illimitée
            </p>
          </div>
        </div>

        {/* ── Barre de Recherche (visible uniquement en mode public) ── */}
        {!isAdminMode && (
          <div className="flex-1 max-w-md mx-4 hidden md:block">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Rechercher un livre, auteur, narrateur..."
                className="rg-input pl-10 pr-4 py-2.5 rounded-full text-sm"
                style={{ paddingLeft: '2.5rem' }}
              />
              {searchQuery && (
                <button
                  onClick={() => onSearch('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs rg-btn-ghost px-2 py-0.5 rounded-full"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Actions Droite ── */}
        {isAdminMode ? (
          /* Mode Admin — pas de profil utilisateur, pas de solde */
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-emerald-300 hidden sm:block">Admin connecté</span>
            </div>

            <button
              onClick={() => { window.history.pushState({}, '', '/'); setActiveTab('discover'); }}
              className="rg-btn-ghost px-3 py-2 rounded-xl text-xs flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Boutique</span>
            </button>

            {isAdmin && onAdminLogout && (
              <button
                onClick={onAdminLogout}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            )}
          </div>
        ) : (
          /* Mode Public — profil utilisateur, solde, push, install */
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">

            {/* Installer l'App (masqué si déjà installée en PWA) */}
            {typeof window !== 'undefined' && !(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || localStorage.getItem('rg_pwa_installed') === 'true') && (
              <button
                onClick={onOpenInstallModal}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold border transition-all hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, rgba(157,78,221,0.20), rgba(247,37,133,0.20))',
                  borderColor: 'rgba(157,78,221,0.35)',
                  color: '#c77dff',
                }}
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Installer l'App</span>
              </button>
            )}

            {/* Notifications Push & Centre de Notifications */}
            <button
              onClick={onOpenNotifications || (() => requestPermission())}
              title="Centre de notifications"
              className="relative p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all active:scale-95"
            >
              <Bell className={`w-4 h-4 ${isSubscribed ? 'fill-purple-400 text-purple-300' : 'text-slate-300'}`} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-pink-500 text-white text-[9px] font-black flex items-center justify-center shadow-md animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Toggle Thème */}
            <button
              onClick={toggleTheme}
              title="Changer le thème"
              className="rg-btn-ghost p-2 rounded-xl"
            >
              <Sparkles className={`w-4 h-4 ${theme === 'purple' ? 'text-amber-400' : 'text-purple-400'}`} />
            </button>

            {/* Solde Portefeuille — affiché uniquement si défini */}
            {user.solde != null && user.solde > 0 && (
              <div className="hidden lg:flex flex-col items-end px-3 py-1.5 rounded-xl"
                style={{ background: 'rgba(30,24,64,0.70)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span className="rg-section-label" style={{ fontSize: '9px' }}>Solde</span>
                <span className="text-xs font-black" style={{ color: 'var(--color-rg-emerald)' }}>
                  {user.solde.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            )}

            {/* Profil Avatar */}
            <button
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-2 p-1 sm:pr-3 rounded-full transition-all hover:border-purple-500/40"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
            >
              <div className="relative">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full object-cover border border-purple-400/40" />
                ) : (
                  <div className="w-7 h-7 rounded-full border border-purple-400/40 flex items-center justify-center text-xs font-bold"
                    style={{ background: 'linear-gradient(135deg, #9d4edd, #f72585)', color: 'white' }}>
                    {(user.name || 'U')[0].toUpperCase()}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#07041A]" />
              </div>
              <span className="text-xs font-bold hidden sm:block" style={{ color: 'var(--color-text-primary)' }}>
                {user.name}
              </span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
