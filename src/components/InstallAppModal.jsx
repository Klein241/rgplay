import React, { useState, useEffect } from 'react';
import { 
  Download, Smartphone, Bell, X, CheckCircle2, Sparkles, 
  Share, ShieldCheck, Zap, Headphones, ArrowRight
} from 'lucide-react';
import { usePush } from '../context/PushContext';

export const InstallAppModal = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
  const { isSupported, isSubscribed, requestPermission } = usePush();
  const [pushSuccess, setPushSuccess] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || localStorage.getItem('rg_pwa_installed') === 'true') {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallSuccess(true);
      localStorage.setItem('rg_pwa_installed', 'true');
      localStorage.setItem('rg_install_prompt_dismissed', 'true');
      setDeferredPrompt(null);
      setTimeout(() => onClose(), 2000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [onClose]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstallSuccess(true);
        setIsInstalled(true);
        localStorage.setItem('rg_pwa_installed', 'true');
        localStorage.setItem('rg_install_prompt_dismissed', 'true');
        setTimeout(() => onClose(), 2000);
      }
      setDeferredPrompt(null);
    } else {
      setInstallSuccess(true);
      setIsInstalled(true);
      localStorage.setItem('rg_pwa_installed', 'true');
      localStorage.setItem('rg_install_prompt_dismissed', 'true');
      setTimeout(() => onClose(), 2000);
    }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-2xl animate-fadeIn">
      {/* Container Modale avec max-height et scroll propre */}
      <div 
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto glass-card rounded-3xl border border-purple-500/35 shadow-2xl p-6 sm:p-8 no-scrollbar"
        style={{
          backgroundImage: 'radial-gradient(ellipse 90% 60% at 50% -10%, rgba(157,78,221,0.28) 0%, transparent 70%)',
        }}
      >
        {/* Bouton Fermer */}
        <button
          onClick={handleCloseModal}
          className="absolute top-5 right-5 p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* En-tête de la Modale */}
        <div className="flex items-center gap-4 mb-6 pr-8">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/40 border border-purple-400/30">
              <Headphones className="w-8 h-8 text-white" />
            </div>
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#16112e] flex items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl sm:text-2xl font-black text-white font-['Outfit']">
                Installer RG Play
              </h3>
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                PWA
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 leading-normal">
              Profitez d'une écoute fluide et sans coupures sur votre smartphone
            </p>
          </div>
        </div>

        {/* Grille des Avantages Aérée */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {[
            { icon: Zap, title: 'Lecture Ultra-Fluide', desc: 'Sans temps de chargement', color: 'text-amber-400' },
            { icon: Smartphone, title: 'Accès 1 Clic', desc: 'Icône sur écran d\'accueil', color: 'text-purple-400' },
            { icon: Bell, title: 'Notifications Push', desc: 'Nouveautés & réductions', color: 'text-pink-400' },
            { icon: ShieldCheck, title: 'Écoute Continue', desc: 'Arrière-plan & hors-ligne', color: 'text-emerald-400' },
          ].map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={index} className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/8">
                <div className="p-2 rounded-xl bg-white/5 flex-shrink-0 mt-0.5">
                  <Icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-100">{item.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Zone d'Action Télécharger / Installer */}
        <div className="mb-5">
          {installSuccess || isInstalled ? (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-1.5">
              <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>Application installée avec succès !</span>
              </div>
              <p className="text-xs text-slate-300">
                Retrouvez RG Play directement sur votre écran d'accueil.
              </p>
            </div>
          ) : isIOS ? (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
              <p className="text-xs font-bold text-purple-300 flex items-center gap-2">
                <Smartphone className="w-4 h-4" /> Installation sur iPhone & iPad :
              </p>
              <ol className="text-xs text-slate-300 space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>Appuyez sur le bouton <strong>Partager</strong> <Share className="w-3.5 h-3.5 inline mx-1 text-purple-400" /> en bas de Safari.</li>
                <li>Sélectionnez <strong>« Sur l'écran d'accueil »</strong>.</li>
                <li>Appuyez sur <strong>Ajouter</strong> en haut à droite.</li>
              </ol>
            </div>
          ) : (
            <button
              onClick={handleInstallClick}
              className="btn-gradient w-full py-4 px-6 rounded-2xl text-sm sm:text-base font-black flex items-center justify-center gap-2.5 shadow-xl shadow-purple-600/40 hover:scale-[1.02] active:scale-95 transition-all"
            >
              <Download className="w-5 h-5" />
              <span>Télécharger & Installer l'Application</span>
            </button>
          )}
        </div>

        {/* Activation Notifications Push Spacieuse */}
        {isSupported && (
          <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300 flex-shrink-0">
                <Bell className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Notifications Push</p>
                <p className="text-[11px] text-slate-300">
                  {isSubscribed ? 'Alertes activées sur cet appareil' : 'Soyez averti des nouveaux livres audio'}
                </p>
              </div>
            </div>

            {isSubscribed || pushSuccess ? (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 flex-shrink-0">
                <CheckCircle2 className="w-4 h-4" /> Activé
              </span>
            ) : (
              <button
                onClick={handleEnablePush}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white border border-purple-400/40 shadow-md transition-colors flex-shrink-0"
              >
                Activer
              </button>
            )}
          </div>
        )}

        {/* Pied de la Modale */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-white/5">
          <span>Version 1.0 • Mobile & Desktop</span>
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
