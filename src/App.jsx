import React, { useState, useEffect, useCallback } from 'react';
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
import { StoreView } from './views/StoreView';
import { AdminStudioView } from './views/AdminStudioView';
import { AdminLoginView } from './views/AdminLoginView';
import { ProfileView } from './views/ProfileView';
import { BookChatModal } from './components/BookChatModal';
import { AudioProvider } from './context/AudioContext';
import { ThemeProvider } from './context/ThemeContext';
import { PushProvider } from './context/PushContext';
import { XpProvider } from './context/XpContext';
import { initTracker, trackPageView } from './services/tracker';
import { apiClient } from './services/api';
import { WelcomeOfferBanner } from './components/WelcomeOfferBanner';
import { StreakModal } from './components/StreakSystem';
import { RewardedAdModal } from './components/RewardedAdModal';
import { PdfReaderModal } from './components/PdfReaderModal';
import { ErrorBoundary } from './components/ErrorBoundary';

export function App() {
  const [activeTab, setActiveTab] = useState('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isNotifCenterOpen, setIsNotifCenterOpen] = useState(false);
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [isSkyChatOpen, setIsSkyChatOpen] = useState(false);
  const [featuredBookForOffer, setFeaturedBookForOffer] = useState(null);

  // Écouteur global pour ouvrir la modale de récompense sponsorisée
  useEffect(() => {
    const handleOpenReward = () => setIsRewardModalOpen(true);
    const handleNavTab = (e) => { if (e.detail) setActiveTab(e.detail); };
    window.addEventListener('rg:open-reward-ad', handleOpenReward);
    window.addEventListener('rg:navigate-tab', handleNavTab);
    return () => {
      window.removeEventListener('rg:open-reward-ad', handleOpenReward);
      window.removeEventListener('rg:navigate-tab', handleNavTab);
    };
  }, []);

  // Initialiser le tracker au premier montage
  useEffect(() => { initTracker(); }, []);

  // Tracker les changements de page
  useEffect(() => { trackPageView(activeTab); }, [activeTab]);

  // Synchroniser les suppressions au démarrage et au retour d'onglet
  useEffect(() => {
    apiClient.syncDeletedBooks();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        apiClient.syncDeletedBooks();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const [selectedBookForDetail, setSelectedBookForDetail] = useState(null);
  const [selectedBookForCheckout, setSelectedBookForCheckout] = useState(null);
  const [activePdfBook, setActivePdfBook] = useState(null);

  // Détection du code de parrainage dans l'URL (?ref=... ou ?referral=...)
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const refCode = searchParams.get('ref') || searchParams.get('referral');
      if (refCode) {
        import('./utils/userId').then(({ recordReferredBy }) => {
          recordReferredBy(refCode);
        });
        apiClient.registerReferral(refCode);
      }
    } catch (_) {}
  }, []);

  // Écouteur global pour ouvrir directement la liseuse PDF instantanément
  useEffect(() => {
    const handleOpenPdf = (e) => {
      if (e.detail?.book) setActivePdfBook(e.detail.book);
    };
    window.addEventListener('rg:open-pdf-reader', handleOpenPdf);
    return () => window.removeEventListener('rg:open-pdf-reader', handleOpenPdf);
  }, []);

  // Sélection de livre : si format PDF ou E-Book PUR (sans audio), ouverture INSTANTANÉE de la liseuse
  // Si livre audio (même avec un livret PDF d'accompagnement) ou forceAudio, ouverture du lecteur audio
  const handleSelectBook = useCallback((book, options = {}) => {
    if (!book) return;

    // Contexte forcé en audio (ex: depuis la page Découvrir qui est 100% audio)
    if (options?.forceAudio) {
      setSelectedBookForDetail(book);
      return;
    }

    // Un livre est un livre audio s'il a des pistes audio, une URL audio, une preview, ou un format audio explicite
    const isAudiobook = Boolean(
      book.format === 'audiobook' ||
      book.content_type === 'audiobook' ||
      book.content_type === 'podcast' ||
      book.content_type === 'music' ||
      book.content_type === 'masterclass' ||
      (Array.isArray(book.chapters) && book.chapters.length > 0) ||
      book.audio_url ||
      book.preview_url
    );

    // Un livre n'est un ebook que s'il est explicitement un format écrit SANS audio
    const isPureEbook = !isAudiobook && Boolean(
      book.content_type === 'ebook' ||
      book.content_type === 'epub' ||
      book.content_type === 'pdf' ||
      book.format === 'epub' ||
      book.format === 'pdf' ||
      book.is_ebook ||
      book.is_pdf
    );

    if (isPureEbook) {
      setActivePdfBook(book);
      return;
    }

    // Par défaut : lecteur / fiche livre audio
    setSelectedBookForDetail(book);
  }, []);

  // Fermer les modals si le livre affiché est supprimé (Admin ou sync)
  useEffect(() => {
    const onBookDeleted = (e) => {
      const deletedId = e.detail?.id;
      if (!deletedId) return;
      setSelectedBookForDetail(prev => (prev?.id === deletedId ? null : prev));
      setSelectedBookForCheckout(prev => (prev?.id === deletedId ? null : prev));
      setActivePdfBook(prev => (prev?.id === deletedId ? null : prev));
    };
    window.addEventListener('rg:book-deleted', onBookDeleted);
    return () => window.removeEventListener('rg:book-deleted', onBookDeleted);
  }, []);

  // Livres achetés par l'utilisateur (depuis localStorage)
  const [purchasedIds, setPurchasedIds] = useState(() => {
    try {
      const lib = JSON.parse(localStorage.getItem('rg_user_library') || '[]');
      return new Set(lib.map(b => b.id));
    } catch { return new Set(); }
  });

  const refreshPurchased = useCallback(() => {
    try {
      const lib = JSON.parse(localStorage.getItem('rg_user_library') || '[]');
      setPurchasedIds(new Set(lib.map(b => b.id)));
    } catch {}
  }, []);

  useEffect(() => {
    window.addEventListener('rg:library-updated', refreshPurchased);
    window.addEventListener('rg:book-deleted', refreshPurchased);
    return () => {
      window.removeEventListener('rg:library-updated', refreshPurchased);
      window.removeEventListener('rg:book-deleted', refreshPurchased);
    };
  }, [refreshPurchased]);

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

  // ── Écouter les ouvertures de livres, PDF et Audio depuis le Chat Agent SKY ──
  useEffect(() => {
    const handleOpenBookDetail = async (e) => {
      const { bookId, bookTitle } = e.detail || {};
      setIsSkyChatOpen(false);
      try {
        let found = null;
        if (bookId && bookId !== 'undefined' && bookId !== 'null') {
          found = await apiClient.getAudiobook(bookId);
        }
        if (!found && bookTitle) {
          const catalog = await apiClient.getAudiobooks({ category: 'all' });
          const cleanTitle = bookTitle.toLowerCase().trim();
          found = catalog.find(b => b.title?.toLowerCase().includes(cleanTitle) || cleanTitle.includes(b.title?.toLowerCase()));
        }
        if (found) {
          setSelectedBookForDetail(found);
        }
      } catch (err) {
        console.error('Erreur ouverture fiche livre depuis SKY:', err);
      }
    };

    const handleOpenPdfBook = async (e) => {
      const { bookId, bookTitle, book } = e.detail || {};
      setIsSkyChatOpen(false);
      try {
        let found = book || null;
        if (!found && bookId && bookId !== 'undefined' && bookId !== 'null') {
          found = await apiClient.getAudiobook(bookId);
        }
        if (!found && bookTitle) {
          const catalog = await apiClient.getAudiobooks({ category: 'all' });
          const cleanTitle = bookTitle.toLowerCase().trim();
          found = catalog.find(b => b.title?.toLowerCase().includes(cleanTitle) || cleanTitle.includes(b.title?.toLowerCase()));
        }
        if (found) {
          setActivePdfBook(found);
        }
      } catch (err) {
        console.error('Erreur ouverture PDF depuis SKY:', err);
      }
    };

    const handlePlayAudio = async (e) => {
      const { bookId, bookTitle, book } = e.detail || {};
      setIsSkyChatOpen(false);
      try {
        let found = book || null;
        if (!found && bookId && bookId !== 'undefined' && bookId !== 'null') {
          found = await apiClient.getAudiobook(bookId);
        }
        if (!found && bookTitle) {
          const catalog = await apiClient.getAudiobooks({ category: 'all' });
          const cleanTitle = bookTitle.toLowerCase().trim();
          found = catalog.find(b => b.title?.toLowerCase().includes(cleanTitle) || cleanTitle.includes(b.title?.toLowerCase()));
        }
        if (found) {
          window.dispatchEvent(new CustomEvent('rg:trigger-play-book', { detail: { book: found } }));
        }
      } catch (err) {
        console.error('Erreur lecture audio depuis SKY:', err);
      }
    };

    window.addEventListener('rg:open-book-detail', handleOpenBookDetail);
    window.addEventListener('rg:open-pdf-book', handleOpenPdfBook);
    window.addEventListener('rg:play-audio', handlePlayAudio);
    return () => {
      window.removeEventListener('rg:open-book-detail', handleOpenBookDetail);
      window.removeEventListener('rg:open-pdf-book', handleOpenPdfBook);
      window.removeEventListener('rg:play-audio', handlePlayAudio);
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
      <ErrorBoundary>
        <ThemeProvider>
          <PushProvider>
            <AudioProvider>
              <XpProvider>
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
                    onOpenStreak={() => setIsStreakModalOpen(true)}
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
              </XpProvider>
            </AudioProvider>
          </PushProvider>
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  // ════════════════════════════════════════════════
  // Layout UTILISATEUR PUBLIC — sidebar + bottomnav
  // ════════════════════════════════════════════════
  return (
    <ThemeProvider>
      <PushProvider>
        <AudioProvider>
          <XpProvider>
            <div className="min-h-screen flex flex-col selection:bg-purple-600 selection:text-white">

              <Header
                activeTab={activeTab}
                setActiveTab={handleTabChange}
                searchQuery={searchQuery}
                onSearch={setSearchQuery}
                onOpenInstallModal={() => setIsInstallModalOpen(true)}
                onOpenNotifications={() => setIsNotifCenterOpen(true)}
                onOpenStreak={() => setIsStreakModalOpen(true)}
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
                      onSelectBook={handleSelectBook}
                      onBuyBook={setSelectedBookForCheckout}
                    />
                  )}
                  {activeTab === 'library' && (
                    <LibraryView
                      onSelectBook={handleSelectBook}
                      onGoToDiscover={() => handleTabChange('discover')}
                    />
                  )}
                  {activeTab === 'store' && (
                    <StoreView
                      onSelectPlan={(plan) => setSelectedBookForCheckout(plan)}
                    />
                  )}
                  {activeTab === 'profile' && (
                    <ProfileView
                      onOpenAdmin={() => handleTabChange('admin')}
                      onOpenInstallModal={() => setIsInstallModalOpen(true)}
                      onOpenCheckout={(book) => setSelectedBookForCheckout(book)}
                    />
                  )}
                </main>
              </div>

              {/* Lecteurs Audio */}
              <MiniPlayer />
              <FullScreenPlayer />

              {/* Navigation Mobile — dock incurvé @iSalmanArt */}
              <BottomNav
                activeTab={activeTab}
                setActiveTab={handleTabChange}
                onOpenStore={() => handleTabChange('store')}
                onOpenAgentSky={() => setIsSkyChatOpen(true)}
              />

              {/* Agent SKY Global Chat Modal */}
              <BookChatModal
                book={selectedBookForDetail || {
                  id: 'rg-global-sky',
                  title: 'Assistant & Tuteur Interactif RG Play',
                  author: 'Agent SKY',
                  description: 'Explorez nos livres audio, demandez des synthèses, des plans d\'action et posez toutes vos questions.'
                }}
                isOpen={isSkyChatOpen}
                onClose={() => setIsSkyChatOpen(false)}
              />

              {/* Bandeau d'activation Push Notification Persistant */}
              <PushPermissionBanner />

              {/* Offre de bienvenue -40% (15 min countdown) */}
              <WelcomeOfferBanner
                featuredBook={featuredBookForOffer}
                onOpenCheckout={(book) => setSelectedBookForCheckout(book)}
              />

              {/* Streak Modal */}
              <StreakModal
                isOpen={isStreakModalOpen}
                onClose={() => setIsStreakModalOpen(false)}
              />

              {/* Modale de Récompense Sponsorisée & Pubs Gratuites Read's Great */}
              <RewardedAdModal
                isOpen={isRewardModalOpen}
                onClose={() => setIsRewardModalOpen(false)}
              />

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

              {/* Liseuse PDF Instantanée pour Livres Numériques */}
              <PdfReaderModal
                book={activePdfBook}
                isOpen={Boolean(activePdfBook)}
                onClose={() => setActivePdfBook(null)}
              />
            </div>
          </XpProvider>
        </AudioProvider>
      </PushProvider>
    </ThemeProvider>
  );
}

export default App;
