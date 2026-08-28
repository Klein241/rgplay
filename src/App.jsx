import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { MiniPlayer } from './components/MiniPlayer';
import { FullScreenPlayer } from './components/FullScreenPlayer';
import { AudiobookDetailModal } from './components/AudiobookDetailModal';
import { CheckoutModal } from './components/CheckoutModal';
import { InstallAppModal } from './components/InstallAppModal';
import { PushPermissionBanner } from './components/PushPermissionBanner';
import { NotificationCenterModal } from './components/NotificationCenterModal';
import { DiscoverView } from './views/DiscoverView';
import { LibraryView } from './views/LibraryView';
import { AdminStudioView } from './views/AdminStudioView';
import { AdminLoginView } from './views/AdminLoginView';
import { ProfileView } from './views/ProfileView';
import { AudioProvider } from './context/AudioContext';
import { ThemeProvider } from './context/ThemeContext';
import { PushProvider } from './context/PushContext';

export function App() {
  const [activeTab, setActiveTab] = useState('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isNotifCenterOpen, setIsNotifCenterOpen] = useState(false);

  const [selectedBookForDetail, setSelectedBookForDetail] = useState(null);
  const [selectedBookForCheckout, setSelectedBookForCheckout] = useState(null);

  // Livres achetés par l'utilisateur (depuis localStorage)
  const [purchasedIds, setPurchasedIds] = useState(() => {
    try {
      const lib = JSON.parse(localStorage.getItem('rg_user_library') || '[]');
      return new Set(lib.map(b => b.id));
    } catch { return new Set(); }
  });

  const refreshPurchased = () => {
    try {
      const lib = JSON.parse(localStorage.getItem('rg_user_library') || '[]');
      setPurchasedIds(new Set(lib.map(b => b.id)));
    } catch {}
  };

  // ── Gestion des routes & Partage d'audio ──
  useEffect(() => {
    const checkRoute = () => {
      const path = window.location.pathname;
      const hash = window.location.hash.replace('#', '');
      const searchParams = new URLSearchParams(window.location.search);

      // Ouvrir automatiquement un livre audio partagé via URL ?book=book-id
      const sharedBookId = searchParams.get('book');
      if (sharedBookId) {
        import('./services/api').then(({ apiClient }) => {
          apiClient.getAudiobookById(sharedBookId).then(book => {
            if (book) setSelectedBookForDetail(book);
          });
        });
      }

      if (path.startsWith('/login/admin') || hash === 'login/admin' || hash === 'admin') {
        setActiveTab('admin');
      } else if (hash === 'profile' || path === '/profile' || searchParams.get('tab') === 'profile') {
        setActiveTab('profile');
      } else if (hash === 'library' || path === '/library' || searchParams.get('tab') === 'library') {
        setActiveTab('library');
      } else if (hash === 'discover' || path === '/discover') {
        setActiveTab('discover');
      }
    };
    checkRoute();
    window.addEventListener('popstate', checkRoute);
    window.addEventListener('hashchange', checkRoute);

    // Vérifier session admin
    const sessionStr = localStorage.getItem('rg_admin_session');
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        if (session && session.expires > Date.now()) {
          setIsAdminAuthenticated(true);
        } else {
          localStorage.removeItem('rg_admin_session');
        }
      } catch {
        localStorage.removeItem('rg_admin_session');
      }
    }

    // Écouter l'événement d'installation PWA
    const handleAppInstalled = () => {
      localStorage.setItem('rg_pwa_installed', 'true');
      localStorage.setItem('rg_install_prompt_dismissed', 'true');
      setIsInstallModalOpen(false);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    // Invite à installer sur mobile (uniquement si pas déjà installée et pas rejetée)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const isPwaInstalled = localStorage.getItem('rg_pwa_installed') === 'true';
    const isPromptDismissed = localStorage.getItem('rg_install_prompt_dismissed') === 'true';
    const hasSeenPrompt = sessionStorage.getItem('rg_install_prompt_seen');
    const isMobile = /iphone|ipad|ipod|android/i.test(navigator.userAgent);

    if (isMobile && !hasSeenPrompt && !isStandalone && !isPwaInstalled && !isPromptDismissed) {
      const t = setTimeout(() => {
        const dismissedAfter = localStorage.getItem('rg_install_prompt_dismissed') === 'true';
        if (!dismissedAfter) {
          setIsInstallModalOpen(true);
        }
        sessionStorage.setItem('rg_install_prompt_seen', 'true');
      }, 4000);
      return () => {
        clearTimeout(t);
        window.removeEventListener('popstate', checkRoute);
        window.removeEventListener('hashchange', checkRoute);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    }
    return () => {
      window.removeEventListener('popstate', checkRoute);
      window.removeEventListener('hashchange', checkRoute);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleTabChange = (tab) => {
    if (tab === 'admin') {
      window.history.pushState({}, '', '/login/admin');
    } else {
      window.history.pushState({}, '', `/#${tab}`);
    }
    setActiveTab(tab);
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('rg_admin_session');
    setIsAdminAuthenticated(false);
    window.history.pushState({}, '', '/');
    setActiveTab('discover');
  };

  const handleNavigateContent = (url) => {
    if (!url) return;
    if (url.includes('?type=')) {
      handleTabChange('discover');
    } else if (url.includes('?book=')) {
      const match = url.match(/[?&]book=([^&]+)/);
      if (match && match[1]) {
        import('./services/api').then(({ apiClient }) => {
          apiClient.getAudiobookById(match[1]).then(book => {
            if (book) setSelectedBookForDetail(book);
          });
        });
      }
    }
  };

  const isAdminMode = activeTab === 'admin';

  // ════════════════════════════════════════════════
  // Layout ADMIN — complètement isolé, sans sidebar
  // utilisateur, sans BottomNav, sans profil
  // ════════════════════════════════════════════════
  if (isAdminMode) {
    return (
      <ThemeProvider>
        <PushProvider>
          <AudioProvider>
            <div className="min-h-screen flex flex-col selection:bg-emerald-600 selection:text-white"
              style={{ background: '#07070F' }}>

              {/* Header Admin — pas de profil, pas de solde */}
              <Header
                activeTab={activeTab}
                setActiveTab={handleTabChange}
                searchQuery=""
                onSearch={() => {}}
                onOpenInstallModal={() => setIsInstallModalOpen(true)}
                onOpenNotifications={() => setIsNotifCenterOpen(true)}
                isAdmin={isAdminAuthenticated}
                onAdminLogout={handleAdminLogout}
              />

              {/* Contenu admin plein écran */}
              <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {isAdminAuthenticated ? (
                  <AdminStudioView
                    onBookCreated={() => {
                      window.dispatchEvent(new Event('rg:book-created'));
                      handleTabChange('discover');
                    }}
                  />
                ) : (
                  <AdminLoginView onLoginSuccess={() => setIsAdminAuthenticated(true)} />
                )}
              </main>

              <InstallAppModal
                isOpen={isInstallModalOpen}
                onClose={() => setIsInstallModalOpen(false)}
              />
            </div>
          </AudioProvider>
        </PushProvider>
      </ThemeProvider>
    );
  }

  // ════════════════════════════════════════════════
  // Layout UTILISATEUR PUBLIC — sidebar + bottomnav
  // ════════════════════════════════════════════════
  return (
    <ThemeProvider>
      <PushProvider>
        <AudioProvider>
          <div className="min-h-screen flex flex-col selection:bg-purple-600 selection:text-white">

            <Header
              activeTab={activeTab}
              setActiveTab={handleTabChange}
              searchQuery={searchQuery}
              onSearch={setSearchQuery}
              onOpenInstallModal={() => setIsInstallModalOpen(true)}
              onOpenNotifications={() => setIsNotifCenterOpen(true)}
              isAdmin={false}
              onAdminLogout={null}
            />

            <div className="flex-1 flex max-w-screen-2xl w-full mx-auto">
              {/* Sidebar Desktop */}
              <Sidebar
                activeTab={activeTab}
                setActiveTab={handleTabChange}
                onOpenInstallModal={() => setIsInstallModalOpen(true)}
              />

              {/* Zone de Contenu */}
              <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 min-w-0">
                {activeTab === 'discover' && (
                  <DiscoverView
                    searchQuery={searchQuery}
                    onSelectBook={setSelectedBookForDetail}
                    onBuyBook={setSelectedBookForCheckout}
                  />
                )}
                {activeTab === 'library' && (
                  <LibraryView
                    onSelectBook={setSelectedBookForDetail}
                    onGoToDiscover={() => handleTabChange('discover')}
                  />
                )}
                {activeTab === 'profile' && (
                  <ProfileView
                    onOpenAdmin={() => handleTabChange('admin')}
                    onOpenInstallModal={() => setIsInstallModalOpen(true)}
                  />
                )}
              </main>
            </div>

            {/* Lecteurs Audio */}
            <MiniPlayer />
            <FullScreenPlayer />

            {/* Navigation Mobile — pill flottant */}
            <BottomNav
              activeTab={activeTab}
              setActiveTab={handleTabChange}
              onOpenInstallModal={() => setIsInstallModalOpen(true)}
            />

            {/* Bandeau d'activation Push Notification Persistant */}
            <PushPermissionBanner />

            {/* Modales */}
            <NotificationCenterModal
              isOpen={isNotifCenterOpen}
              onClose={() => setIsNotifCenterOpen(false)}
              onNavigateContent={handleNavigateContent}
            />

            <AudiobookDetailModal
              book={selectedBookForDetail}
              isOpen={!!selectedBookForDetail}
              onClose={() => setSelectedBookForDetail(null)}
              onBuy={(book) => { setSelectedBookForDetail(null); setSelectedBookForCheckout(book); }}
              isPurchased={selectedBookForDetail ? purchasedIds.has(selectedBookForDetail.id) : false}
            />

            <CheckoutModal
              book={selectedBookForCheckout}
              isOpen={!!selectedBookForCheckout}
              onClose={() => setSelectedBookForCheckout(null)}
              onSuccess={(book) => {
                refreshPurchased();
                window.dispatchEvent(new Event('rg:library-updated'));
              }}
            />

            <InstallAppModal
              isOpen={isInstallModalOpen}
              onClose={() => setIsInstallModalOpen(false)}
            />
          </div>
        </AudioProvider>
      </PushProvider>
    </ThemeProvider>
  );
}

export default App;
