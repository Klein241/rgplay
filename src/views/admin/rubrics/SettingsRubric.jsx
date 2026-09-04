import React from 'react';
import { RefreshCw, Download } from 'lucide-react';

export const SettingsRubric = ({ systemStatus, books = [], checkStatus, loadBooks, checkingStatus }) => {
  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(books, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `rg_play_catalogue_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">Paramètres & Infrastructure</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Configuration système, sécurité et connecteurs Cloudflare</p>
      </div>

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
              <p className="text-[11px] text-slate-400">
                {books.length} livres audio synchronisés • Accès partagé multi-utilisateurs
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white/4 border border-white/8 space-y-1.5">
              <p className="text-slate-400 font-medium">Stockage Audio & Pochette</p>
              <p className="text-cyan-400 font-bold text-sm">Cloudflare R2 Bucket (rg-play-audio)</p>
              <p className="text-[11px] text-slate-400">Support streaming HTTP Range partiel</p>
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
