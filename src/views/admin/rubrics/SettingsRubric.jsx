import React, { useState, useEffect } from 'react';
import { RefreshCw, Download, MessageCircle, Save, Check, ExternalLink, Phone, Sparkles } from 'lucide-react';
import { getAppSettings, saveAppSettings, buildWhatsAppSupportUrl, DEFAULT_PLATFORM_SETTINGS } from '../../../services/api/settingsApi';

export const SettingsRubric = ({ systemStatus, books = [], checkStatus, loadBooks, checkingStatus }) => {
  const [supportWhatsapp, setSupportWhatsapp] = useState(DEFAULT_PLATFORM_SETTINGS.support_whatsapp);
  const [supportWhatsappMessage, setSupportWhatsappMessage] = useState(DEFAULT_PLATFORM_SETTINGS.support_whatsapp_message);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(null);

  useEffect(() => {
    getAppSettings().then(settings => {
      if (settings) {
        if (settings.support_whatsapp) setSupportWhatsapp(settings.support_whatsapp);
        if (settings.support_whatsapp_message) setSupportWhatsappMessage(settings.support_whatsapp_message);
      }
    });
  }, []);

  const handleSaveWhatsAppSettings = async (e) => {
    if (e) e.preventDefault();
    setIsSavingSettings(true);
    setSaveFeedback(null);

    const res = await saveAppSettings({
      support_whatsapp: supportWhatsapp.trim() || DEFAULT_PLATFORM_SETTINGS.support_whatsapp,
      support_whatsapp_message: supportWhatsappMessage.trim() || DEFAULT_PLATFORM_SETTINGS.support_whatsapp_message,
    });

    setIsSavingSettings(false);
    if (res && res.success) {
      setSaveFeedback('Paramètres WhatsApp sauvegardés dans Cloudflare D1 ✓');
      setTimeout(() => setSaveFeedback(null), 4000);
    } else {
      setSaveFeedback('Erreur lors de la sauvegarde');
      setTimeout(() => setSaveFeedback(null), 4000);
    }
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(books, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `rg_play_catalogue_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const previewWhatsAppUrl = buildWhatsAppSupportUrl(supportWhatsapp, supportWhatsappMessage);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">Paramètres & Infrastructure</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Configuration système, canaux d'assistance et connecteurs Cloudflare</p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          1. CONFIGURATION SUPPORT & ASSISTANCE CLIENT VIP WHATSAPP
          ══════════════════════════════════════════════════════════════════ */}
      <div className="card-lg space-y-5 border border-emerald-500/30 bg-linear-to-br from-[#120722] via-[#0d041a] to-[#071318]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-md shadow-emerald-950/40">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Assistance & Support Client VIP (WhatsApp)</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  🇬🇦 Gabon par défaut
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Configure le bouton d'assistance présent sur la page Profil des auditeurs
              </p>
            </div>
          </div>

          <a
            href={previewWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rg-btn-ghost text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-emerald-300 hover:text-emerald-200 border-emerald-500/30 hover:border-emerald-500/50"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Tester le lien client</span>
          </a>
        </div>

        <form onSubmit={handleSaveWhatsAppSettings} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Numéro WhatsApp */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Numéro de Téléphone WhatsApp</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={supportWhatsapp}
                  onChange={(e) => setSupportWhatsapp(e.target.value)}
                  placeholder="+24177624383"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-mono focus:border-emerald-400 focus:outline-hidden transition-all"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Format international avec indicatif (ex : <span className="text-emerald-300 font-mono">+24177624383</span> pour le Gabon).
              </p>
            </div>

            {/* Aperçu du lien généré */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Lien direct wa.me généré</span>
              </label>
              <div className="p-2.5 rounded-xl bg-white/4 border border-white/8 text-2xs font-mono text-slate-300 break-all select-all">
                {previewWhatsAppUrl}
              </div>
              <p className="text-[11px] text-slate-400">
                Ce lien s'ouvre automatiquement dans l'application WhatsApp de l'utilisateur.
              </p>
            </div>
          </div>

          {/* Message prédéfini prêt à l'envoi */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-purple-400" />
              <span>Message prédéfini prêt à l'envoi (prérempli dans WhatsApp)</span>
            </label>
            <textarea
              rows={3}
              value={supportWhatsappMessage}
              onChange={(e) => setSupportWhatsappMessage(e.target.value)}
              placeholder="Bonjour RG Play, j'ai besoin d'une assistance..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:border-emerald-400 focus:outline-hidden transition-all resize-none"
            />
            <p className="text-[11px] text-slate-400">
              Ce message sera pré-rempli dans la zone de texte WhatsApp de l'auditeur au clic sur le bouton d'assistance.
            </p>
          </div>

          {/* Bouton de sauvegarde */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              type="submit"
              disabled={isSavingSettings}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
            >
              {isSavingSettings ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Sauvegarde dans D1...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Enregistrer la configuration WhatsApp</span>
                </>
              )}
            </button>

            {saveFeedback && (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 animate-fadeIn">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>{saveFeedback}</span>
              </span>
            )}
          </div>
        </form>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          2. STOCKAGE & BASE DE DONNÉES CLOUDFLARE
          ══════════════════════════════════════════════════════════════════ */}
      <div className="card-lg space-y-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Stockage & Base de données</h2>
            <button
              type="button"
              onClick={async () => {
                if (checkStatus) await checkStatus();
                if (loadBooks) await loadBooks();
              }}
              className="rg-btn-ghost py-1.5 px-3 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Tester la connexion</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-4 rounded-2xl bg-white/4 border border-white/8 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-slate-400 font-medium">Moteur de Base de Données</p>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </div>
              <p className="text-emerald-400 font-bold text-sm">
                {systemStatus?.mode === 'vite_shared_dev_server'
                  ? 'Serveur Persistant Local (data/db.json)'
                  : (systemStatus?.bindings?.d1?.connected ? 'Cloudflare D1 SQL Distribué' : 'Connecté')}
              </p>
              <p className="text-2xs text-slate-400">
                {books.length} livres audio synchronisés • Accès partagé multi-utilisateurs
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white/4 border border-white/8 space-y-1.5">
              <p className="text-slate-400 font-medium">Stockage Audio & Pochette</p>
              <p className="text-cyan-400 font-bold text-sm">Cloudflare R2 Bucket (rg-play-audio)</p>
              <p className="text-2xs text-slate-400">Support streaming HTTP Range partiel</p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-white/10 space-y-3">
          <h2 className="text-sm font-bold text-white">Sauvegarde du Catalogue</h2>
          <button
            type="button"
            onClick={handleExportJson}
            className="rg-btn-ghost py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Exporter le catalogue complet (JSON)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
