import React, { useState, useEffect } from 'react';
import { 
  Download, Smartphone, Bell, X, CheckCircle2, Sparkles, 
  ShieldCheck, Zap, Headphones, Loader2
} from 'lucide-react';
import { usePush } from '../context/PushContext';
import { trackPwaInstall } from '../services/tracker';
import { InAppBrowserNotice, IosInstallGuide, ManualAndroidGuide } from './pwa/PwaGuides';

export const InstallAppModal = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState(() => (typeof window !== 'undefined' ? window.deferredPwaPrompt : null));
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isIOSSafari, setIsIOSSafari] = useState(true);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const [showManualGuide, setShowManualGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const { isSupported, isSubscribed, requestPermission } = usePush();
  const [pushSuccess, setPushSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = (window.navigator.userAgent || '').toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    const isAndroidDevice = /android/.test(ua);
    const inApp = /fbav|fban|instagram|whatsapp|tiktok|line|micromessenger/.test(ua);

    setIsIOS(isIosDevice);
    setIsAndroid(isAndroidDevice);
    setIsInAppBrowser(inApp);

    const isRealSafari = isIosDevice && /safari/.test(ua) && !/crios|fxios|optios|edgios/.test(ua) && !inApp;
    setIsIOSSafari(isRealSafari);

    // Détection si l'application est déjà installée en mode standalone
    const isStandalone = Boolean(
      window.matchMedia('(display-mode: standalone)').matches || 
      window.navigator.standalone ||
      new URLSearchParams(window.location.search).get('source') === 'pwa'
    );
    if (isStandalone) {
      setIsInstalled(true);
    }

    if (window.deferredPwaPrompt && !deferredPrompt) {
      setDeferredPrompt(window.deferredPwaPrompt);
    }

    const handlePromptReady = (e) => {
      const prompt = e.detail?.prompt || window.deferredPwaPrompt;
      if (prompt) setDeferredPrompt(prompt);
    };

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      window.deferredPwaPrompt = e;
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallSuccess(true);
      localStorage.setItem('rg_pwa_installed', 'true');
      localStorage.setItem('rg_install_prompt_dismissed', 'true');
      trackPwaInstall({
        platform: isIosDevice ? 'iOS (Safari)' : isAndroidDevice ? 'Android' : 'Desktop',
        trigger: 'appinstalled_event'
      });
      setTimeout(() => onClose(), 2500);
    };

    window.addEventListener('rg:pwa-prompt-ready', handlePromptReady);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('rg:pwa-prompt-ready', handlePromptReady);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [deferredPrompt, onClose]);

  /**
   * Clic sur le bouton d'installation principal (1-Clic)
   */
  const handleInstallClick = async () => {
    if (isIOS) {
      setShowManualGuide(true);
      return;
    }

    setIsInstalling(true);

    // 1. Vérifier si l'événement natif est déjà mémorisé
    let promptEvent = deferredPrompt || (typeof window !== 'undefined' ? window.deferredPwaPrompt : null);

    // 2. Si pas encore en mémoire, attendre brièvement (jusqu'à 800ms)
    if (!promptEvent) {
      for (let i = 0; i < 4; i++) {
        await new Promise(r => setTimeout(r, 200));
        promptEvent = deferredPrompt || (typeof window !== 'undefined' ? window.deferredPwaPrompt : null);
        if (promptEvent) break;
      }
    }

    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice && choice.outcome === 'accepted') {
          setInstallSuccess(true);
          setIsInstalled(true);
          localStorage.setItem('rg_pwa_installed', 'true');
          localStorage.setItem('rg_install_prompt_dismissed', 'true');
          trackPwaInstall({
            platform: isAndroid ? 'Android' : 'Desktop',
            trigger: 'prompt_accepted',
            outcome: 'accepted'
          });
          window.deferredPwaPrompt = null;
          setDeferredPrompt(null);
          setTimeout(() => onClose(), 2500);
        } else {
          setPromptDismissed(true);
          setTimeout(() => setPromptDismissed(false), 4000);
        }
      } catch (err) {
        console.warn('[PWA] Erreur prompt:', err);
        setShowManualGuide(true);
      } finally {
        setIsInstalling(false);
      }
    } else {
      setIsInstalling(false);
      // Navigateur sans invite native automatique (in-app browser WhatsApp/Facebook ou Firefox)
      setShowManualGuide(true);
    }
  };

  const handleConfirmManualInstall = () => {
    setInstallSuccess(true);
    setIsInstalled(true);
    localStorage.setItem('rg_pwa_installed', 'true');
    localStorage.setItem('rg_install_prompt_dismissed', 'true');
    trackPwaInstall({ 
      platform: isIOS ? 'iOS (Safari)' : isAndroid ? 'Android (Manual)' : 'Desktop (Manual)', 
      trigger: 'user_confirmed_homescreen' 
    });
    setTimeout(() => onClose(), 2500);
  };

  const handleCloseModal = () => {
    localStorage.setItem('rg_install_prompt_dismissed', 'true');
    onClose();
  };

  const handleEnablePush = async () => {
    const granted = await requestPermission();
    if (granted) {
      setPushSuccess(true);
      setTimeout(() => setPushSuccess(false), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-md bg-gradient-to-b from-[#1c1335] to-[#0d0a1a] border border-purple-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-purple-950/60 text-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Lueur décorative */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-60 h-60 bg-purple-600/20 blur-3xl pointer-events-none rounded-full" />

        {/* Bouton de fermeture */}
        <button 
          onClick={handleCloseModal}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* En-tête avec Icône de l'App */}
        <div className="relative mx-auto mb-4 w-20 h-20 rounded-2xl p-1 bg-gradient-to-tr from-purple-600 via-pink-500 to-amber-400 shadow-xl shadow-purple-600/30">
          <img 
            src="/icon-192.png" 
            alt="RG Play" 
            className="w-full h-full object-cover rounded-[14px]"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <div className="w-full h-full bg-[#150d2a] rounded-[14px] items-center justify-center hidden">
            <Headphones className="w-10 h-10 text-purple-400" />
          </div>
          <span className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm flex items-center gap-0.5">
            <Sparkles className="w-3 h-3" /> PWA
          </span>
        </div>

        <h3 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">
          Installer <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300">RG Play</span>
        </h3>
        
        <p className="text-xs sm:text-sm text-slate-300 mb-5 leading-relaxed">
          {isInstalled ? (
            "L'application est déjà configurée sur votre appareil."
          ) : (
            "Installez l'application pour profiter du lecteur plein écran, de l'audio en tâche de fond et de la bibliothèque sans coupure."
          )}
        </p>

        {/* Avantages clés */}
        <div className="grid grid-cols-3 gap-2.5 mb-6 text-left">
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col items-center text-center">
            <Zap className="w-5 h-5 text-amber-400 mb-1" />
            <span className="text-[11px] font-bold text-white leading-tight">1 Clic</span>
            <span className="text-3xs text-slate-400">Sans Play Store</span>
          </div>
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col items-center text-center">
            <Headphones className="w-5 h-5 text-purple-400 mb-1" />
            <span className="text-[11px] font-bold text-white leading-tight">Écran Verrouillé</span>
            <span className="text-3xs text-slate-400">Lecture fluide</span>
          </div>
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col items-center text-center">
            <ShieldCheck className="w-5 h-5 text-emerald-400 mb-1" />
            <span className="text-[11px] font-bold text-white leading-tight">Zéro Mo</span>
            <span className="text-3xs text-slate-400">Hyper légère</span>
          </div>
        </div>

        {/* Zone d'action dynamique */}
        <div className="mb-5">
          {installSuccess || isInstalled ? (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>Application installée avec succès !</span>
              </div>
              <p className="text-xs text-slate-300">
                Retrouvez RG Play directement sur votre écran d'accueil.
              </p>
            </div>
          ) : isInAppBrowser ? (
            /* Cas spécial navigateur in-app (WhatsApp / Facebook) */
            <InAppBrowserNotice 
              copied={copied} 
              onCopy={() => {
                navigator.clipboard?.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              }} 
            />
          ) : isIOS ? (
            /* Cas iOS Safari */
            <IosInstallGuide 
              isIOSSafari={isIOSSafari} 
              onConfirm={handleConfirmManualInstall} 
            />
          ) : (
            /* Cas Android / Chrome / Desktop : BOUTON HÉROÏQUE 1-CLIC TOUJOURS PRIORITAIRE */
            <div className="space-y-2.5">
              {promptDismissed && (
                <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-center">
                  Installation annulée. Vous pouvez réessayer à tout moment.
                </p>
              )}

              <button
                onClick={handleInstallClick}
                disabled={isInstalling}
                className="btn-gradient w-full py-4 px-6 rounded-2xl text-sm sm:text-base font-black flex items-center justify-center gap-2.5 shadow-xl shadow-purple-600/40 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer disabled:opacity-75"
              >
                {isInstalling ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                    <span>Lancement de l'installation...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 text-white" />
                    <span>Installer l'Application en 1 Clic</span>
                  </>
                )}
              </button>

              {/* Guide manuel accessible en repli optionnel */}
              <button
                type="button"
                onClick={() => setShowManualGuide(prev => !prev)}
                className="w-full text-center text-2xs text-purple-300 hover:text-white transition-colors py-1 cursor-pointer"
              >
                {showManualGuide ? "▲ Masquer l'aide manuelle" : "Besoin d'aide ? Voir les étapes manuelles"}
              </button>

              {showManualGuide && (
                <ManualAndroidGuide 
                  isAndroid={isAndroid} 
                  onConfirm={handleConfirmManualInstall} 
                />
              )}
            </div>
          )}
        </div>

        {/* Activation Notifications Push */}
        {isSupported && (
          <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300 shrink-0">
                <Bell className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Notifications Push</p>
                <p className="text-2xs text-slate-300">
                  {isSubscribed ? 'Alertes activées sur cet appareil' : 'Soyez averti des nouveaux contenus'}
                </p>
              </div>
            </div>

            {isSubscribed || pushSuccess ? (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-4 h-4" /> Activé
              </span>
            ) : (
              <button
                onClick={handleEnablePush}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white border border-purple-400/40 shadow-md transition-colors shrink-0 cursor-pointer"
              >
                Activer
              </button>
            )}
          </div>
        )}

        {/* Pied de la Modale */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-white/5">
          <span>PWA Officielle • RG Play</span>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Continuer sur le web
          </button>
        </div>
      </div>
    </div>
  );
};
export default InstallAppModal;
