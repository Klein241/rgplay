import React, { useState } from 'react';
import {
  Cpu, Sparkles, ShieldCheck, Terminal, Check, Copy, Key, Sliders,
  ExternalLink, Lock, Zap, BookOpen, Plus, FileText, UploadCloud, Wand2,
  Flame, Trash2, Grid, Smartphone, RefreshCw, BarChart3, Database
} from 'lucide-react';

export const API_AVAILABLE_SCOPES = [
  {
    id: 'catalog_read',
    label: 'Lecture du Catalogue',
    desc: 'Consulter tous les livres, podcasts, musiques et chapitres',
    icon: BookOpen,
    tag: 'GET /api/audiobooks',
    method: 'GET',
    endpoint: '/api/audiobooks',
    fullUrl: 'https://rg-play.pages.dev/api/audiobooks',
    doc: 'Lister et rechercher dans le catalogue (?type=all|audiobook|podcast|music, ?category=id, ?search=titre)',
    sampleQuery: '?type=all'
  },
  {
    id: 'catalog_write',
    label: 'Création & Modification Audio',
    desc: 'Ajouter ou mettre à jour des titres audio et chapitres dans Cloudflare D1',
    icon: Plus,
    tag: 'POST /api/admin/books',
    method: 'POST',
    endpoint: '/api/admin/books',
    fullUrl: 'https://rg-play.pages.dev/api/admin/books',
    doc: 'Créer ou mettre à jour un livre audio et ses chapitres dans la base Cloudflare D1',
    sampleBody: {
      title: "Prie puis agis",
      author: "RGPlay",
      content_type: "audiobook",
      price: 2500,
      category_name: "Motivations Chrétiennes",
      description: "Une motivation chrétienne directe...",
      chapters: [{ title: "Chapitre 1 : Introduction", audio_url: "https://...", duration_seconds: 1800 }]
    }
  },
  {
    id: 'ebooks_publish',
    label: 'Publication E-Books & Livres PDF',
    desc: 'Publier des livres numériques complets (.pdf, .epub) pour la liseuse Read\'s Great avec pagination et 100 points',
    icon: FileText,
    tag: 'POST /api/admin/books (E-Books)',
    method: 'POST',
    endpoint: '/api/admin/books',
    fullUrl: 'https://rg-play.pages.dev/api/admin/books',
    doc: 'Publier un ouvrage numérique Read\'s Great (PDF ou EPUB) avec content_type: "ebook", pdf_url, page_count et unlock_points.',
    sampleBody: {
      title: "Entreprendre avec l'Intelligence Artificielle",
      author: "Dr. Christian Ndongo",
      narrator: "Éditions Read's Great",
      content_type: "ebook",
      format: "pdf",
      pdf_url: "https://rg-play.pages.dev/api/r2/download?key=ebooks/guide_ia.pdf",
      page_count: 180,
      unlock_points: 100,
      price: 0,
      description: "Guide stratégique complet pour déployer l'IA dans vos affaires."
    }
  },
  {
    id: 'r2_storage_upload',
    label: 'Upload & Ingestion R2 Permanente',
    desc: 'Rapatrier des URLs distantes ou uploader des fichiers réels (.wav, .mp3, .pdf) dans Cloudflare R2',
    icon: UploadCloud,
    tag: 'POST /api/r2/upload-from-url',
    method: 'POST',
    endpoint: '/api/r2/upload-from-url',
    fullUrl: 'https://rg-play.pages.dev/api/r2/upload-from-url',
    doc: 'Télécharger et enregistrer définitivement un fichier audio/PDF distant dans le stockage Cloudflare R2 RG Play.',
    sampleBody: {
      url: "https://files.manuscdn.com/user_uploads/rgplay_sample.wav",
      file_name: "rgplay_sample.wav",
      type: "audio"
    }
  },
  {
    id: 'ai_tts_generate',
    label: 'Génération Audio IA (Studio Vocal)',
    desc: 'Synthétiser des voix IA haute fidélité pour chapitres et podcasts',
    icon: Wand2,
    tag: 'POST /api/ai/tts',
    method: 'POST',
    endpoint: '/api/ai/tts',
    fullUrl: 'https://rg-play.pages.dev/api/ai/tts',
    doc: 'Générer un fichier audio de narration à partir d\'un texte avec paramétrage vocal précis.',
    sampleBody: {
      text: "Introduction au premier chapitre du guide...",
      voice: "fr-FR-HenriNeural",
      speed: 1.0,
      pitch: 1.0
    }
  },
  {
    id: 'catalog_pin',
    label: 'Épinglage Catalogue',
    desc: 'Épingler ou désépingler des livres en tête de vitrine',
    icon: Flame,
    tag: 'POST /api/admin/books/:id/toggle-pin',
    method: 'POST',
    endpoint: '/api/admin/books/{id}/toggle-pin',
    fullUrl: 'https://rg-play.pages.dev/api/admin/books/{book_id}/toggle-pin',
    doc: 'Mettre en avant ou retirer un contenu de la tête du catalogue',
    sampleBody: { is_pinned: true }
  },
  {
    id: 'catalog_delete',
    label: 'Suppression Contenus',
    desc: 'Supprimer définitivement un livre audio et ses chapitres',
    icon: Trash2,
    tag: 'DELETE /api/admin/books/:id',
    method: 'DELETE',
    endpoint: '/api/admin/books/{id}',
    fullUrl: 'https://rg-play.pages.dev/api/admin/books/{book_id}',
    doc: 'Supprimer définitivement un livre audio et ses chapitres'
  },
  {
    id: 'social_metrics',
    label: 'Effet de Masse (Social Proof)',
    desc: 'Personnaliser les écoutes, avis et notes affichés aux clients',
    icon: Sparkles,
    tag: 'POST /api/admin/books/:id/social-metrics',
    method: 'POST',
    endpoint: '/api/admin/books/{id}/social-metrics',
    fullUrl: 'https://rg-play.pages.dev/api/admin/books/{book_id}/social-metrics',
    doc: 'Mettre à jour les métriques sociales affichées aux visiteurs',
    sampleBody: { display_plays_count: 28000, display_reviews_count: 5600, display_rating: 4.95 }
  },
  {
    id: 'categories_manage',
    label: 'Gestion des Catégories',
    desc: 'Créer, modifier et supprimer des univers et thématiques',
    icon: Grid,
    tag: 'GET/POST /api/admin/categories',
    method: 'POST',
    endpoint: '/api/admin/categories',
    fullUrl: 'https://rg-play.pages.dev/api/admin/categories',
    doc: 'Créer ou mettre à jour des catégories',
    sampleBody: { name: "Investissement & Finance", slug: "investissement-finance", icon: "TrendingUp" }
  },
  {
    id: 'payments_initiate',
    label: 'Passerelle CamerPay',
    desc: 'Déclencher des paiements réels Orange Money, MTN et Carte',
    icon: Smartphone,
    tag: 'POST /api/payment/initiate',
    method: 'POST',
    endpoint: '/api/payment/initiate',
    fullUrl: 'https://rg-play.pages.dev/api/payment/initiate',
    doc: 'Initier un paiement mobile money ou carte bancaire',
    sampleBody: { audiobook_id: "book-1", payment_method: "orange_money", customer_phone: "699456779", amount: 200 }
  },
  {
    id: 'payments_sync',
    label: 'Vérification & Synchro Paiements',
    desc: 'Consulter et synchroniser les transactions en attente',
    icon: RefreshCw,
    tag: 'GET /api/payment/status/:id',
    method: 'GET',
    endpoint: '/api/payment/status/{transaction_id}',
    fullUrl: 'https://rg-play.pages.dev/api/payment/status/{transaction_id}',
    doc: 'Vérifier l\'état en temps réel d\'une transaction CamerPay'
  },
  {
    id: 'analytics_read',
    label: 'Statistiques & Trafic',
    desc: 'Consulter les métriques de fréquentation, visiteurs et sources',
    icon: BarChart3,
    tag: 'GET /api/admin/analytics',
    method: 'GET',
    endpoint: '/api/admin/analytics',
    fullUrl: 'https://rg-play.pages.dev/api/admin/analytics',
    doc: 'Consulter les statistiques de visites, écoutes et rétention'
  },
  {
    id: 'system_status',
    label: 'Santé Infrastructure Cloudflare',
    desc: 'Consulter l\'état en direct de Cloudflare D1, R2 et KV',
    icon: Database,
    tag: 'GET /api/status',
    method: 'GET',
    endpoint: '/api/status',
    fullUrl: 'https://rg-play.pages.dev/api/status',
    doc: 'Vérifier l\'état opérationnel de la base Cloudflare D1, R2 et KV'
  },
];

export const ApiGeneratorRubric = () => {
  const [apiName, setApiName] = useState('Manus IA Production');
  const [apiExpiration, setApiExpiration] = useState('never');
  const [apiRateLimit, setApiRateLimit] = useState('120');
  const [selectedScopes, setSelectedScopes] = useState([
    'catalog_read', 'catalog_write', 'ebooks_publish', 'r2_storage_upload', 'ai_tts_generate', 'catalog_pin', 'social_metrics', 'categories_manage', 'analytics_read', 'system_status'
  ]);
  const [generatedKey, setGeneratedKey] = useState(null);
  const [activeCodeTab, setActiveCodeTab] = useState('manus');
  const [copiedField, setCopiedField] = useState(null);

  const toggleScope = (id) => {
    setSelectedScopes(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const selectPreset = (type) => {
    if (type === 'all') {
      setSelectedScopes(API_AVAILABLE_SCOPES.map(s => s.id));
    } else if (type === 'ai_agent') {
      setSelectedScopes(['catalog_read', 'catalog_write', 'ebooks_publish', 'r2_storage_upload', 'ai_tts_generate', 'catalog_pin', 'social_metrics', 'categories_manage', 'analytics_read', 'system_status']);
    } else if (type === 'readonly') {
      setSelectedScopes(['catalog_read', 'analytics_read', 'system_status']);
    } else if (type === 'payments') {
      setSelectedScopes(['payments_initiate', 'payments_sync']);
    }
  };

  const handleCopyText = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleGenerateKey = () => {
    const rawKey = `rgp_live_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}${Date.now().toString(36)}`;
    const newKeyObj = {
      id: `key_${Date.now()}`,
      name: apiName || 'Clé API RG Play',
      fullKey: rawKey,
      keyMasked: `${rawKey.substring(0, 12)}...${rawKey.substring(rawKey.length - 4)}`,
      scopes: [...selectedScopes],
      expiration: apiExpiration,
      rateLimit: apiRateLimit,
      created_at: new Date().toISOString(),
    };
    setGeneratedKey(newKeyObj);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header de la rubrique */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-extrabold mb-2">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>Passerelle Développeur & Agents IA</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-white font-['Outfit'] tracking-tight">
            Générateur d'API & MCP IA
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium max-w-2xl">
            Générez des clés d'accès sécurisées et des configurations prêtes à l'emploi (Manus IA, Claude Desktop, Cursor, Scripts cURL/Python) adaptées aux fonctionnalités sélectionnées.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => selectPreset('ai_agent')}
            className="px-4 py-2.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Preset Manus IA</span>
          </button>
          <button
            type="button"
            onClick={() => selectPreset('all')}
            className="px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Tout Cocher</span>
          </button>
        </div>
      </div>

      {/* ── BANDEAU POINT D'ENTRÉE API & BASE URL ── */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-950/60 via-slate-900/80 to-purple-950/60 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 flex-shrink-0 shadow-lg shadow-emerald-500/10">
            <Terminal className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Point d'Entrée API (Base Endpoint)</span>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">REST • HTTPS</span>
            </div>
            <code className="text-sm sm:text-base font-mono font-black text-emerald-300 block truncate mt-0.5">
              https://rg-play.pages.dev/api
            </code>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-center">
          <button
            type="button"
            onClick={() => handleCopyText('https://rg-play.pages.dev/api', 'base_url')}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
          >
            {copiedField === 'base_url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedField === 'base_url' ? 'Copié !' : 'Copier le Base URL'}</span>
          </button>
        </div>
      </div>

      {/* Formulaire de Configuration de la Clé */}
      <div className="card-lg space-y-6">
        <div className="border-b border-white/10 pb-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-emerald-400" /> 1. Paramètres de l'Accès API
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Identifiez l'assistant IA ou l'application qui utilisera cette clé</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5 sm:col-span-1">
            <label className="text-xs font-bold text-slate-300">Nom de l'Assistant / Client *</label>
            <input
              type="text"
              value={apiName}
              onChange={(e) => setApiName(e.target.value)}
              placeholder="Ex: Manus IA Prod, Agent Cursor..."
              className="rg-input text-xs w-full font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Durée de Validité</label>
            <select
              value={apiExpiration}
              onChange={(e) => setApiExpiration(e.target.value)}
              className="rg-input text-xs w-full cursor-pointer"
              style={{ background: '#16112e' }}
            >
              <option value="never">Illimitée (Recommandé pour agents)</option>
              <option value="30d">30 Jours</option>
              <option value="90d">90 Jours</option>
              <option value="365d">1 An</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Limite de Débit (Rate Limit)</label>
            <select
              value={apiRateLimit}
              onChange={(e) => setApiRateLimit(e.target.value)}
              className="rg-input text-xs w-full cursor-pointer"
              style={{ background: '#16112e' }}
            >
              <option value="120">120 requêtes / minute (Standard)</option>
              <option value="300">300 requêtes / minute (Haute cadence)</option>
              <option value="unlimited">Illimité (Mode Admin Total)</option>
            </select>
          </div>
        </div>

        {/* Sélection des Permissions */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-400" /> 2. Fonctionnalités & Permissions Autorisées ({selectedScopes.length}/{API_AVAILABLE_SCOPES.length})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Cochez uniquement les modules que l'IA ou l'application a le droit d'exécuter</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => selectPreset('readonly')}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors cursor-pointer"
              >
                Lecture Seule
              </button>
              <button
                type="button"
                onClick={() => selectPreset('payments')}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors cursor-pointer"
              >
                Paiements Seuls
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {API_AVAILABLE_SCOPES.map((scope) => {
              const isChecked = selectedScopes.includes(scope.id);
              const ScopeIcon = scope.icon;
              return (
                <div
                  key={scope.id}
                  onClick={() => toggleScope(scope.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 select-none ${
                    isChecked
                      ? 'bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/5 scale-[1.01]'
                      : 'bg-white/4 border-white/8 hover:bg-white/8 text-slate-400 opacity-75 hover:opacity-100'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 border transition-all ${
                    isChecked
                      ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 border-emerald-400 text-white shadow-md'
                      : 'bg-white/5 border-white/20 text-transparent'
                  }`}>
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                        <ScopeIcon className={`w-3.5 h-3.5 ${isChecked ? 'text-emerald-400' : 'text-slate-400'}`} />
                        {scope.label}
                      </span>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-white/8 text-slate-300 flex-shrink-0 border border-white/6 font-bold">
                        {scope.tag}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                      {scope.desc}
                    </p>
                    <code className="text-[10px] text-cyan-300/80 font-mono block mt-1 truncate">
                      {scope.fullUrl}
                    </code>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bouton de Génération */}
        <div className="pt-3 border-t border-white/10 flex justify-end">
          <button
            type="button"
            onClick={handleGenerateKey}
            disabled={selectedScopes.length === 0}
            className="btn-gradient px-7 py-3.5 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 shadow-2xl active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-white" />
            <span>Générer la Clé d'API & Config IA ({selectedScopes.length} permissions)</span>
          </button>
        </div>
      </div>

      {/* RÉSULTAT DE LA CLÉ */}
      {generatedKey && (
        <div className="card-lg space-y-5 border border-emerald-500/40 bg-emerald-950/20 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/20 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-slate-950 shadow-lg flex-shrink-0">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white font-['Outfit']">
                  Clé d'API Prête : {generatedKey.name}
                </h3>
                <p className="text-xs text-emerald-300">
                  {generatedKey.scopes.length} fonctionnalités débloquées • Expiration : {generatedKey.expiration === 'never' ? 'Illimitée' : generatedKey.expiration}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Prêt à l'Emploi
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-black/50 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold flex items-center gap-1.5 text-slate-300">
                  <ExternalLink className="w-3.5 h-3.5 text-cyan-400" /> Endpoint Racine (Base URL)
                </span>
                <span className="text-[10px] text-cyan-300">URL Globale</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value="https://rg-play.pages.dev/api"
                  className="rg-input text-xs font-mono font-bold text-cyan-300 bg-slate-950/80 border-cyan-500/40 w-full select-all"
                />
                <button
                  type="button"
                  onClick={() => handleCopyText('https://rg-play.pages.dev/api', 'res_base_url')}
                  className="px-3.5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1 transition-all flex-shrink-0 active:scale-95 cursor-pointer shadow-md"
                >
                  {copiedField === 'res_base_url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === 'res_base_url' ? 'Copié !' : 'Copier'}</span>
                </button>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-black/50 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold flex items-center gap-1.5 text-slate-300">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" /> Clé Bearer (Token)
                </span>
                <span className="text-[10px] text-amber-300">Header: Authorization</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedKey.fullKey}
                  className="rg-input text-xs font-mono font-bold text-emerald-300 bg-slate-950/80 border-emerald-500/40 w-full select-all"
                />
                <button
                  type="button"
                  onClick={() => handleCopyText(generatedKey.fullKey, 'key')}
                  className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition-all flex-shrink-0 active:scale-95 cursor-pointer shadow-md"
                >
                  {copiedField === 'key' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === 'key' ? 'Copié !' : 'Copier'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" /> Mode d'intégration :
              </span>
              <div className="flex gap-1 overflow-x-auto no-scrollbar">
                {[
                  { id: 'endpoints', label: `📡 Endpoints (${generatedKey.scopes.length})` },
                  { id: 'manus', label: '🤖 Prompt Manus IA' },
                  { id: 'mcp', label: '🧩 Config MCP' },
                  { id: 'curl', label: 'cURL' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveCodeTab(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      activeCodeTab === tab.id
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                        : 'bg-white/6 text-slate-400 hover:text-white border border-white/8'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {activeCodeTab === 'endpoints' && (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {API_AVAILABLE_SCOPES.filter(s => generatedKey.scopes.includes(s.id)).map(sc => (
                  <div key={sc.id} className="p-3.5 rounded-2xl bg-slate-950/90 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase font-mono ${
                          sc.method === 'GET' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-cyan-500/20 text-cyan-300'
                        }`}>
                          {sc.method}
                        </span>
                        <code className="text-xs font-mono font-bold text-white truncate">{sc.fullUrl}</code>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyText(sc.fullUrl, `ep_${sc.id}`)}
                        className="px-2.5 py-1 rounded-lg bg-white/8 text-slate-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedField === `ep_${sc.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>Copier</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400">{sc.doc}</p>
                  </div>
                ))}
              </div>
            )}

            {activeCodeTab === 'manus' && (
              <div className="p-4 rounded-2xl bg-slate-950/90 border border-purple-500/30 space-y-3 font-mono text-xs text-slate-200">
                <pre className="whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto text-slate-300 text-[11px]">
{`Tu es l'agent IA officiel de production de la plateforme RG Play (Read's Great).
Tu dois préparer et publier le contenu généré (Livre E-Book PDF/EPUB, pochette 3D, et les chapitres audio).

═══════════════════════════════════════════════════════════════
INFORMATIONS D'ACCÈS & AUTHENTIFICATION HTTP
═══════════════════════════════════════════════════════════════
Base URL API : https://rg-play.pages.dev/api
En-têtes obligatoires pour chaque requête :
  Authorization: Bearer ${generatedKey.fullKey}
  Content-Type: application/json

═══════════════════════════════════════════════════════════════
1. ÉTAPE 1 (OPTIONNELLE) : RAPATRIER DES FICHIERS VERS CLOUDFLARE R2
Si tes fichiers (PDF, cover 3D, audios) sont hébergés temporairement (manuscdn, etc.) :
POST https://rg-play.pages.dev/api/r2/upload-from-url
Body JSON :
{
  "url": "https://files.manuscdn.com/.../fichier.pdf",
  "file_name": "nom_fichier.pdf",
  "type": "ebook" // "ebook" | "cover" | "audio"
}
Réponse : { "success": true, "public_url": "https://rg-play.pages.dev/api/r2/download?key=...", "r2_key": "..." }

═══════════════════════════════════════════════════════════════
2. ÉTAPE 2 : PUBLIER L'E-BOOK DANS READ'S GREAT
POST https://rg-play.pages.dev/api/admin/books
Body JSON :
{
  "title": "Titre du Livre Numérique",
  "author": "Nom de l'Auteur",
  "narrator": "Éditions Read's Great",
  "content_type": "ebook",
  "format": "pdf",
  "pdf_url": "https://...url_du_pdf.pdf",
  "cover_url": "https://...url_pochette_3d.jpg",
  "page_count": 180,
  "unlock_points": 100,
  "price": 0,
  "description": "Résumé et pitch complet du livre",
  "synopsis": "Sommaire et plan des chapitres",
  "is_featured": true
}

═══════════════════════════════════════════════════════════════
3. ÉTAPE 3 : PUBLIER LE LIVRE AUDIO AVEC LES 10 PISTES AUDIO
POST https://rg-play.pages.dev/api/admin/books
Body JSON :
{
  "title": "Titre du Livre Audio",
  "author": "Nom de l'Auteur",
  "narrator": "Voix Narrateur / Studio IA",
  "content_type": "audiobook",
  "cover_url": "https://...url_pochette_3d.jpg",
  "price": 3500,
  "discount_price": 2000,
  "description": "Description du livre audio",
  "chapters": [
    { "id": "chap-1", "title": "Chapitre 1 — Introduction", "audio_url": "https://...audio1.mp3", "duration_seconds": 600 },
    { "id": "chap-2", "title": "Chapitre 2 — Fondations", "audio_url": "https://...audio2.mp3", "duration_seconds": 750 },
    { "id": "chap-3", "title": "Chapitre 3 — Principes Clés", "audio_url": "https://...audio3.mp3", "duration_seconds": 800 },
    { "id": "chap-4", "title": "Chapitre 4 — Passage à l'Action", "audio_url": "https://...audio4.mp3", "duration_seconds": 700 },
    { "id": "chap-5", "title": "Chapitre 5 — Stratégies Avancées", "audio_url": "https://...audio5.mp3", "duration_seconds": 850 },
    { "id": "chap-6", "title": "Chapitre 6 — Résolution de Problèmes", "audio_url": "https://...audio6.mp3", "duration_seconds": 900 },
    { "id": "chap-7", "title": "Chapitre 7 — Maîtrise & Discipline", "audio_url": "https://...audio7.mp3", "duration_seconds": 680 },
    { "id": "chap-8", "title": "Chapitre 8 — Effet de Levier", "audio_url": "https://...audio8.mp3", "duration_seconds": 740 },
    { "id": "chap-9", "title": "Chapitre 9 — Consolidation", "audio_url": "https://...audio9.mp3", "duration_seconds": 820 },
    { "id": "chap-10", "title": "Chapitre 10 — Conclusion & Vision", "audio_url": "https://...audio10.mp3", "duration_seconds": 600 }
  ]
}

═══════════════════════════════════════════════════════════════
MISSION :
Prépare le paquet complet avec l'e-book, la couverture 3D et les 10 audios,
puis envoie les requêtes HTTP POST ci-dessus pour finaliser la publication sur RG Play.`}
                </pre>
              </div>
            )}

            {activeCodeTab === 'mcp' && (
              <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-500/30 font-mono text-xs text-slate-200">
                <pre className="whitespace-pre-wrap leading-relaxed text-emerald-300 text-[11px]">
{JSON.stringify({
  mcpServers: {
    rgplay: {
      command: "node",
      args: ["./mcp-rgplay/index.js"],
      env: {
        RGPLAY_API_BASE: "https://rg-play.pages.dev/api",
        RGPLAY_API_KEY: generatedKey.fullKey
      }
    }
  }
}, null, 2)}
                </pre>
              </div>
            )}

            {activeCodeTab === 'curl' && (
              <div className="p-4 rounded-2xl bg-slate-950/90 border border-white/10 font-mono text-xs text-cyan-300">
                <pre className="whitespace-pre-wrap leading-relaxed text-[11px]">
{`curl -X GET "https://rg-play.pages.dev/api/audiobooks" \\
  -H "Authorization: Bearer ${generatedKey.fullKey}" \\
  -H "Content-Type: application/json"`}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
