import React from 'react';
import { Compass, BookMarked, User, PlayCircle, Pause, Smartphone, ShieldCheck } from 'lucide-react';
import { useAudio } from '../context/AudioContext';

export const Sidebar = ({ activeTab, setActiveTab, onOpenInstallModal }) => {
  const { currentBook, isPlaying, togglePlay, setIsFullScreenOpen } = useAudio();

  const menuItems = [
    {
      id: 'discover',
      label: 'Boutique & Découverte',
      icon: Compass,
      badge: 'Nouveau',
    },
    {
      id: 'library',
      label: 'Ma Bibliothèque',
      icon: BookMarked,
    },
    {
      id: 'profile',
      label: 'Profil & Paramètres',
      icon: User,
    },
  ];

  return (
    <aside className="hidden md:flex flex-col w-60 lg:w-64 h-[calc(100vh-65px)] sticky top-[65px] glass-panel border-r border-white/6 shrink-0 justify-between overflow-y-auto no-scrollbar">

      {/* Navigation */}
      <div className="p-4 space-y-6">
        {/* Menu principal */}
        <nav className="space-y-1">
          <p className="rg-section-label px-3 mb-3">Menu</p>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-600/95 to-fuchsia-600/95 text-white shadow-lg shadow-purple-500/20 font-bold'
                    : 'text-[color:var(--color-text-secondary)] hover:bg-white/5 hover:text-[color:var(--color-text-primary)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${
                    isActive ? 'text-white' : 'text-[color:var(--color-text-tertiary)] group-hover:text-purple-300'
                  }`} />
                  <span className="text-left leading-snug">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="rg-badge rg-badge--pink">{item.badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bannière Installer l'App (masquée si déjà installée en PWA) */}
        {typeof window !== 'undefined' && !(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || localStorage.getItem('rg_pwa_installed') === 'true') && (
          <div className="p-4 rounded-2xl space-y-3"
            style={{
              background: 'linear-gradient(135deg, rgba(157,78,221,0.12), rgba(247,37,133,0.08))',
              border: '1px solid rgba(157,78,221,0.20)',
            }}>
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Smartphone className="w-4 h-4 text-purple-300" />
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-tight mb-1">RG Play sur Mobile</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-tertiary)' }}>
                  Écoutez vos livres sans interruption, même hors connexion.
                </p>
              </div>
            </div>
            <button
              onClick={onOpenInstallModal}
              className="w-full py-2 rounded-xl text-xs font-bold transition-all hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(135deg, rgba(157,78,221,0.35), rgba(247,37,133,0.30))',
                border: '1px solid rgba(157,78,221,0.30)',
                color: 'white',
              }}
            >
              Installer l'Application
            </button>
          </div>
        )}
      </div>

      {/* Footer Sidebar */}
      <div className="p-4 pt-0 space-y-3">
        {/* Mini Player Sidebar */}
        {currentBook && (
          <div
            onClick={() => setIsFullScreenOpen(true)}
            className="p-3 rounded-2xl cursor-pointer transition-all group hover:border-purple-500/30"
            style={{
              background: 'rgba(22,17,46,0.70)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <div className="flex items-center gap-3">
              <img
                src={(!currentBook.cover_url || currentBook.cover_url.includes('r2.cloudflarestorage.com')) ? 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80' : currentBook.cover_url}
                alt={currentBook.title}
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80'; }}
                className="w-10 h-10 rounded-xl object-cover shadow-md group-hover:scale-105 transition-transform flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>
                  {currentBook.title}
                </p>
                <p className="text-[11px] truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                  {currentBook.author}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-purple-500/35 flex-shrink-0"
              >
                {isPlaying
                  ? <Pause className="w-3.5 h-3.5 fill-white" />
                  : <PlayCircle className="w-4 h-4 fill-white" />
                }
              </button>
            </div>
          </div>
        )}

        {/* Lien Admin — discret, en bas */}
        <div className="px-3 pb-2">
          <a
            href="/login/admin"
            onClick={(e) => {
              e.preventDefault();
              window.history.pushState({}, '', '/login/admin');
              setActiveTab('admin');
            }}
            className="flex items-center gap-1.5 text-[11px] transition-colors"
            style={{ color: 'var(--color-text-disabled)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#c77dff'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-disabled)'}
          >
            <ShieldCheck className="w-3 h-3" />
            <span>Espace Auteur & Admin</span>
          </a>
        </div>
      </div>
    </aside>
  );
};
