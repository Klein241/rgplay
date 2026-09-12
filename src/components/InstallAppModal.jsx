import React, { useState, useEffect } from 'react';
import { 
  Download, Smartphone, Bell, X, CheckCircle2, Sparkles, 
  Share, ShieldCheck, Zap, Headphones, ArrowRight, PlusSquare, AlertTriangle, ExternalLink,
  MoreVertical, Monitor, RefreshCw
} from 'lucide-react';
import { usePush } from '../context/PushContext';
import { trackPwaInstall } from '../services/tracker';

export const InstallAppModal = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState(() => (typeof window !== 'undefined' ? window.deferredPwaPrompt : null));
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isIOSSafari, setIsIOSSafari] = useState(true);
  const [isAndroid, setIsAndroid] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const [showManualGuide, setShowManualGuide] = useState(false);
  const { isSupported, isSubscribed, requestPermission } = usePush();
  const [pushSuccess, setPushSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isAndroidDevice = /android/.test(userAgent);
    setIsIOS(isIosDevice);
    setIsAndroid(isAndroidDevice);

    // Détecter si l'utilisateur est sur iOS mais pas dans le vrai Safari
    const isRealSafari = isIosDevice && /safari/.test(userAgent) && !/crios|fxios|optios|edgios|instagram|fban|fbav|whatsapp/.test(userAgent);
    setIsIOSSafari(isRealSafari);

    // Vérifier si l'application tourne déjà en mode standalone
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
      setIsInstalled(true);
    }

    // Récupérer le prompt global s'il a été capturé avant l'ouverture de la modale
    if (window.deferredPwaPrompt && !deferredPrompt) {
      setDeferredPrompt(window.deferredPwaPrompt);
    }

    const handlePromptReady = (e) => {
      setDeferredPrompt(e.detail?.prompt || window.deferredPwaPrompt);
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
      trackPwaInstall({ trigger: 'appinstalled_event' });
      window.deferredPwaPrompt = null;
      setDeferredPrompt(null);
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
  }, [onClose]);

  const handleInstallClick = async () => {
    const promptEvent = deferredPrompt || window.deferredPwaPrompt;
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
          setInstallSuccess(true);
          setIsInstalled(true);
          localStorage.setItem('rg_pwa_installed', 'true');
          localStorage.setItem('rg_install_prompt_dismissed', 'true');
          trackPwaInstall({ trigger: 'prompt_accepted', outcome });
          window.deferredPwaPrompt = null;
          setDeferredPrompt(null);
          setTimeout(() => onClose(), 2500);
        } else {
          // L'utilisateur a cliqué "Annuler" sur le dialogue natif
          setPromptDismissed(true);
          setTimeout(() => setPromptDismissed(false), 4000);
        }
      } catch (err) {
        console.warn('[PWA] Erreur déclenchement prompt:', err);
        setShowManualGuide(true);
      }
    } else {
      // Pas de prompt automatique disponible dans ce navigateur :
      // On bascule vers le guide visuel étape par étape sans mentir sur l'installation
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
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-amber-500 p-0.5 shadow-xl shadow-purple-600/30">
              <div className="w-full h-full bg-[#120a21] rounded-[14px] flex items-center justify-center overflow-hidden">
                <Headphones className="w-8 h-8 text-purple-300 animate-pulse" />
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 p-1 bg-purple-600 rounded-full border border-purple-900 shadow">
              <Sparkles className="w-3 h-3 text-amber-300" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Application Officielle
              </span>
            </div>
            <h3 className="text-xl font-black text-white font-['Outfit'] mt-1">
              Installer RG Play
            </h3>
            <p className="text-xs text-slate-300">
              Profitez d'une expérience fluide sans passer par les stores
            </p>
          </div>
        </div>

        {/* Avantages Clés */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6">
          {[
            { icon: Zap, title: 'Accès Instantané', desc: '1 clic depuis l\'écran d\'accueil', color: 'text-amber-400' },
            { icon: Smartphone, title: 'Zéro Espace Perdu', desc: 'Moins de 2 Mo de stockage', color: 'text-purple-400' },
            { icon: Bell, title: 'Notifications Push', desc: 'Nouveautés & réductions', color: 'text-pink-400' },
            { icon: ShieldCheck, title: 'Écoute Continue', desc: 'Arrière-plan & hors-ligne', color: 'text-emerald-400' },
          ].map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={index} className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/8">
                <div className="p-2 rounded-xl bg-white/5 shrink-0 mt-0.5">
                  <Icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-100">{item.title}</h4>
                  <p className="text-2xs text-slate-400 mt-0.5 leading-snug">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Zone d'Action Télécharger / Installer */}
        <div className="mb-5">
          {installSuccess || isInstalled ? (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-1.5 animate-fadeIn">
              <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>Application installée avec succès !</span>
              </div>
              <p className="text-xs text-slate-300">
                Retrouvez RG Play directement sur votre écran d'accueil.
              </p>
            </div>
          ) : isIOS ? (
            <div className="space-y-3">
              {!isIOSSafari ? (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 text-left">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-300">Ouvrez dans Safari pour installer</h4>
                      <p className="text-2xs text-slate-300 mt-1 leading-relaxed">
                        Apple n'autorise l'ajout d'applications sur l'écran d'accueil que depuis le navigateur <strong>Safari</strong> natif.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(window.location.href);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2500);
                    }}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{copied ? '✓ Lien copié ! Collez-le dans Safari' : 'Copier le lien pour ouvrir dans Safari'}</span>
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-3 text-left">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-extrabold text-purple-300 flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-purple-400" />
                      Installation en 3 étapes sur iPhone / iPad :
                    </p>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      Safari Détecté
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white/5 border border-white/5">
                      <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-[11px] shrink-0">1</span>
                      <span>Appuyez sur le bouton <Share className="w-3.5 h-3.5 inline mx-1 text-sky-400" /> <strong>Partager</strong> en bas de Safari</span>
                    </div>
                    <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white/5 border border-white/5">
                      <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-[11px] shrink-0">2</span>
                      <span>Défilez vers le bas et appuyez sur <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-purple-400" /> <strong>Sur l'écran d'accueil</strong></span>
                    </div>
                    <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white/5 border border-white/5">
                      <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-[11px] shrink-0">3</span>
                      <span>Appuyez sur <strong>Ajouter</strong> en haut à droite</span>
                    </div>
                  </div>

                  <button
                    onClick={handleConfirmManualInstall}
                    className="btn-gradient w-full mt-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 hover:scale-[1.02] active:scale-98 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>J'ai ajouté l'application sur mon écran</span>
                  </button>
                </div>
              )}
            </div>
          ) : showManualGuide || !deferredPrompt ? (
            /* Guide Étape par Étape si le prompt automatique n'est pas encore dispo dans le navigateur */
            <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/30 space-y-3.5 text-left animate-fadeIn">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold text-purple-200 flex items-center gap-1.5">
                  {isAndroid ? <Smartphone className="w-4 h-4 text-emerald-400" /> : <Monitor className="w-4 h-4 text-purple-400" />}
                  <span>{isAndroid ? 'Installation sur Android :' : 'Installation sur Navigateur :'}</span>
                </p>
                <span className="text-[10px] font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30">
                  Rapide & Sécurisé
                </span>
              </div>

              {isAndroid ? (
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-[11px] shrink-0">1</span>
                    <span>Appuyez sur le menu <MoreVertical className="w-3.5 h-3.5 inline mx-0.5 text-amber-400" /> <strong>(3 points)</strong> en haut à droite de Chrome</span>
                  </div>
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-[11px] shrink-0">2</span>
                    <span>Appuyez sur <Download className="w-3.5 h-3.5 inline mx-0.5 text-emerald-400" /> <strong>« Installer l'application »</strong> (ou « Ajouter à l'écran d'accueil »)</span>
                  </div>
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-[11px] shrink-0">3</span>
                    <span>Validez en cliquant sur <strong>« Installer »</strong></span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-[11px] shrink-0">1</span>
                    <span>Cliquez sur l'icône <Download className="w-3.5 h-3.5 inline mx-0.5 text-purple-300" /> <strong>Installer</strong> située à droite dans la barre d'adresse</span>
                  </div>
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-[11px] shrink-0">2</span>
                    <span>Ou ouvrez le menu <MoreVertical className="w-3.5 h-3.5 inline mx-0.5 text-amber-400" /> <strong>(3 points)</strong> &gt; <strong>« Installer RG Play »</strong></span>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <button
                  onClick={handleConfirmManualInstall}
                  className="btn-gradient w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 hover:scale-[1.02] active:scale-98 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>J'ai installé l'application sur mon écran</span>
                </button>
                {deferredPrompt && (
                  <button
                    onClick={handleInstallClick}
                    className="w-full sm:w-auto px-4 py-3 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white border border-white/15 transition-all shrink-0 cursor-pointer"
                  >
                    Réessayer le bouton direct
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {promptDismissed && (
                <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-center">
                  Installation annulée. Vous pouvez réessayer ou voir le guide d'installation.
                </p>
              )}
              <button
                onClick={handleInstallClick}
                className="btn-gradient w-full py-4 px-6 rounded-2xl text-sm sm:text-base font-black flex items-center justify-center gap-2.5 shadow-xl shadow-purple-600/40 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
              >
                <Download className="w-5 h-5" />
                <span>Télécharger & Installer l'Application</span>
              </button>
            </div>
          )}
        </div>

        {/* Activation Notifications Push Spacieuse */}
        {isSupported && (
          <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300 shrink-0">
                <Bell className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Notifications Push</p>
                <p className="text-2xs text-slate-300">
                  {isSubscribed ? 'Alertes activées sur cet appareil' : 'Soyez averti des nouveaux livres audio'}
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
                className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white border border-purple-400/40 shadow-md transition-colors shrink-0"
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
