import React from 'react';
import { 
  Smartphone, Share, PlusSquare, CheckCircle2, 
  AlertTriangle, ExternalLink, MoreVertical, Download, Monitor 
} from 'lucide-react';

/**
 * Guide pour les navigateurs intégrés in-app (WhatsApp, Facebook, etc.)
 */
export const InAppBrowserNotice = ({ copied, onCopy }) => (
  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 text-left animate-fadeIn">
    <div className="flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
      <div>
        <h4 className="text-xs font-bold text-amber-300">Ouverture dans WhatsApp / Réseaux</h4>
        <p className="text-2xs text-slate-300 mt-1 leading-relaxed">
          Pour installer l'application en 1 clic, ouvrez ce site dans votre navigateur <strong>Google Chrome</strong> ou <strong>Safari</strong>.
        </p>
      </div>
    </div>
    <button
      type="button"
      onClick={onCopy}
      className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 flex items-center justify-center gap-2 transition-all cursor-pointer"
    >
      <ExternalLink className="w-3.5 h-3.5" />
      <span>{copied ? '✓ Lien copié ! Ouvrez Google Chrome' : 'Copier le lien pour ouvrir dans Chrome'}</span>
    </button>
  </div>
);

/**
 * Guide spécifique pour iOS Safari (installation via bouton Partager)
 */
export const IosInstallGuide = ({ isIOSSafari, onConfirm }) => (
  <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-3 text-left animate-fadeIn">
    <div className="flex items-center justify-between">
      <p className="text-xs font-extrabold text-purple-300 flex items-center gap-2">
        <Smartphone className="w-4 h-4 text-purple-400" />
        Installation en 3 étapes sur iPhone &amp; iPad :
      </p>
      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
        {isIOSSafari ? 'Safari Détecté' : 'iOS'}
      </span>
    </div>

    <div className="space-y-2 text-xs text-slate-300">
      <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white/5 border border-white/5">
        <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-[11px] shrink-0">1</span>
        <span>Appuyez sur le bouton <Share className="w-3.5 h-3.5 inline mx-1 text-sky-400" /> <strong>Partager</strong> en bas de Safari</span>
      </div>
      <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white/5 border border-white/5">
        <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-[11px] shrink-0">2</span>
        <span>Défilez et appuyez sur <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-purple-400" /> <strong>Sur l'écran d'accueil</strong></span>
      </div>
      <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white/5 border border-white/5">
        <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-[11px] shrink-0">3</span>
        <span>Appuyez sur <strong>Ajouter</strong> en haut à droite</span>
      </div>
    </div>

    <button
      type="button"
      onClick={onConfirm}
      className="btn-gradient w-full mt-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 hover:scale-[1.02] active:scale-98 transition-all cursor-pointer"
    >
      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      <span>J'ai ajouté l'application sur mon écran</span>
    </button>
  </div>
);

/**
 * Guide de repli manuel pour Android / Chrome
 */
export const ManualAndroidGuide = ({ isAndroid, onConfirm }) => (
  <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/30 space-y-3 text-left animate-fadeIn">
    <p className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
      {isAndroid ? <Smartphone className="w-4 h-4 text-emerald-400" /> : <Monitor className="w-4 h-4 text-purple-400" />}
      <span>Installation manuelle ({isAndroid ? 'Chrome Android' : 'Navigateur'}) :</span>
    </p>
    <div className="space-y-2 text-xs text-slate-300">
      <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white/5 border border-white/5">
        <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-[11px] shrink-0">1</span>
        <span>Appuyez sur le menu <MoreVertical className="w-3.5 h-3.5 inline text-amber-400" /> <strong>(3 points)</strong> de Chrome</span>
      </div>
      <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white/5 border border-white/5">
        <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-[11px] shrink-0">2</span>
        <span>Sélectionnez <Download className="w-3.5 h-3.5 inline text-emerald-400" /> <strong>« Installer l'application »</strong></span>
      </div>
    </div>
    <button
      type="button"
      onClick={onConfirm}
      className="btn-gradient w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
    >
      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      <span>J'ai installé l'application</span>
    </button>
  </div>
);
