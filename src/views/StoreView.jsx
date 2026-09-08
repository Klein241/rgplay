import React, { useState, useEffect, useCallback } from 'react';
import {
  Crown, Check, Zap, ArrowRight, Shield, Sparkles, Star,
  Gift, Play, ExternalLink, CheckCircle2, Lock, Music,
  RefreshCw, Clock
} from 'lucide-react';
import { apiClient } from '../services/api';
import { useXp } from '../context/XpContext';
import { RewardedAdModal } from '../components/RewardedAdModal';

export const POINT_PACKS = [
  {
    id: 'pack_500',
    badge: '🥉 IDÉAL POUR TESTER',
    title: 'Pack Découverte',
    subtitle: 'Débloquez vos 3 à 5 premiers livres audio',
    price: '500',
    rawPrice: 500,
    unit: 'FCFA',
    points: 250,
    bonusPoints: 50,
    totalPoints: 300,
    accent: 'from-blue-600 via-indigo-600 to-purple-600',
    badgeStyle: 'bg-blue-500/20 text-blue-200 border-blue-400/40',
    border: 'border-blue-400/50',
    glow: 'shadow-[0_0_30px_rgba(59,130,246,0.30)]',
    features: [
      '300 Points Read\'s Great immédiatement crédités',
      'Déblocage instantané en 1 clic sans abonnement',
      'Écoute hors-ligne sécurisée sans connexion',
      'Valable sur tous les livres audio, masterclasses & ebooks',
    ],
  },
  {
    id: 'pack_1000',
    badge: '🔥 LE PLUS POPULAIRE (-25%)',
    title: 'Pack Populaire',
    subtitle: 'Le plein de lectures pour le mois',
    price: '1 000',
    rawPrice: 1000,
    unit: 'FCFA',
    points: 600,
    bonusPoints: 150,
    totalPoints: 750,
    accent: 'from-purple-600 via-fuchsia-600 to-pink-600',
    badgeStyle: 'bg-purple-500/25 text-purple-200 border-purple-400/50',
    border: 'border-purple-400/60',
    glow: 'shadow-[0_0_35px_rgba(168,85,247,0.35)]',
    features: [
      '750 Points RG (+150 pts bonus offerts)',
      'Équivalent à 8 à 10 œuvres audio complètes',
      'Téléchargement hors-ligne illimité inclus',
      'Accès prioritaire aux nouveautés de la semaine',
    ],
  },
  {
    id: 'pack_2500',
    badge: '⚡ ÉCONOMIE -35%',
    title: 'Pack Avantage',
    subtitle: 'Pour les auditeurs et passionnés réguliers',
    price: '2 500',
    rawPrice: 2500,
    unit: 'FCFA',
    points: 1700,
    bonusPoints: 500,
    totalPoints: 2200,
    accent: 'from-emerald-600 via-teal-600 to-cyan-600',
    badgeStyle: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
    border: 'border-emerald-400/50',
    glow: 'shadow-[0_0_35px_rgba(16,185,129,0.30)]',
    features: [
      '2 200 Points RG (+500 pts bonus offerts)',
      'Équivalent à +25 livres audio et masterclasses',
      'Qualité Studio HD 320 kbps débloquée',
      'Points à vie sans aucune date d\'expiration',
    ],
  },
  {
    id: 'pack_5000',
    badge: '👑 MEILLEURE VALEUR (-50%)',
    title: 'Pack VIP Royal',
    subtitle: 'La bibliothèque complète & Assistant SKY',
    price: '5 000',
    rawPrice: 5000,
    unit: 'FCFA',
    points: 3500,
    bonusPoints: 1500,
    totalPoints: 5000,
    accent: 'from-amber-500 via-orange-500 to-pink-600',
    badgeStyle: 'bg-amber-500/25 text-amber-200 border-amber-400/60',
    border: 'border-amber-400/70',
    glow: 'shadow-[0_0_45px_rgba(251,191,36,0.35)]',
    features: [
      '5 000 Points RG (+1 500 pts bonus offerts)',
      'Débloque plus de 55 livres audio et séries',
      'Accès illimité aux questions du Mentor IA SKY',
      'Support VIP WhatsApp Read\'s Great dédié 24/7',
    ],
  },
  {
    id: 'pack_10000',
    badge: '💎 PACK MASTER (12 000 PTS)',
    title: 'Pack Master Pro',
    subtitle: 'Pour les boulimiques de savoir et formateurs',
    price: '10 000',
    rawPrice: 10000,
    unit: 'FCFA',
    points: 8000,
    bonusPoints: 4000,
    totalPoints: 12000,
    accent: 'from-fuchsia-600 via-pink-600 to-rose-600',
    badgeStyle: 'bg-rose-500/25 text-rose-200 border-rose-400/60',
    border: 'border-rose-400/70',
    glow: 'shadow-[0_0_45px_rgba(244,63,94,0.35)]',
    features: [
      '12 000 Points RG (+4 000 pts bonus géants)',
      'Déblocage permanent de plus de 130 livres',
      'Téléchargement MP3 direct sur tous vos appareils',
      'Statut Membre d\'Honneur Read\'s Great Studio',
    ],
  },
];

const TABS = [
  { id: 'packs', label: 'Acheter des Points ⭐', icon: Sparkles },
  { id: 'earn', label: 'Gagner des Points Gratuits 🎁', icon: Gift },
];

// Convertit le ratio string en style CSS inline (padding-bottom trick)
function getAspectStyle(ratio) {
  const map = {
    '16:9': { paddingBottom: '56.25%' },
    '9:16': { paddingBottom: '177.78%' },
    '1:1':  { paddingBottom: '100%' },
    '3:4':  { paddingBottom: '133.33%' },
    '4:3':  { paddingBottom: '75%' },
  };
  return map[ratio] || map['16:9'];
}

function getMaxWidthStyle(ratio) {
  const map = {
    '16:9': 'max-w-xs sm:max-w-sm',
    '9:16': 'max-w-40',
    '1:1':  'max-w-[220px]',
    '3:4':  'max-w-[180px]',
    '4:3':  'max-w-xs',
  };
  return map[ratio] || 'max-w-xs';
}

// Clé localStorage pour les pubs déjà vues
const SEEN_ADS_KEY = 'rg_seen_reward_ads';

function getSeenAds() {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_ADS_KEY) || '{}');
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const valid = {};
    for (const [id, ts] of Object.entries(raw)) {
      if (typeof ts === 'number' && now - ts < DAY_MS) {
        valid[id] = ts;
      }
    }
    return valid;
  } catch { return {}; }
}

function markAdSeen(adId) {
  const seen = getSeenAds();
  seen[adId] = Date.now();
  localStorage.setItem(SEEN_ADS_KEY, JSON.stringify(seen));
}

// Mini-carte dans la bande publicitaire horizontale
function AdBandCard({ ad, onWatch }) {
  const rewardPts = ad.rewardPoints || 3;
  const isImage = ad.mediaType === 'image' && ad.mediaUrl;
  const isVideo = ad.mediaType === 'video' && ad.mediaUrl;

  return (
    <div
      className="shrink-0 w-41.25 rounded-2xl border border-purple-500/30 bg-[#150a27]/90 overflow-hidden flex flex-col shadow-lg hover:border-amber-500/50 hover:shadow-amber-900/30 transition-all duration-300 group"
    >
      {/* Visuel */}
      <div className="relative w-full h-27.5 bg-black/40 overflow-hidden flex items-center justify-center">
        {isVideo ? (
          <video src={ad.mediaUrl} muted playsInline loop autoPlay className="absolute inset-0 w-full h-full object-cover" />
        ) : isImage ? (
          <img src={ad.mediaUrl} alt={ad.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className={`absolute inset-0 bg-linear-to-br ${ad.gradient || 'from-purple-600 to-pink-700'} flex flex-col items-center justify-center`}>
            <span className="text-3xl">{ad.icon || '📢'}</span>
          </div>
        )}
        {/* Badge points */}
        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-amber-500/90 text-slate-950 text-[9px] font-black flex items-center gap-0.5 shadow">
          <span>+{rewardPts}</span><span>⭐</span>
        </div>
      </div>

      {/* Infos */}
      <div className="p-2.5 flex flex-col gap-2 flex-1">
        <div>
          <p className="text-white text-2xs font-bold leading-snug line-clamp-2">{ad.title}</p>
          {ad.tagline && <p className="text-slate-400 text-[10px] mt-0.5 line-clamp-1">{ad.tagline}</p>}
        </div>
        <button
          type="button"
          onClick={() => onWatch(ad)}
          className="mt-auto w-full py-1.5 rounded-xl text-2xs font-extrabold flex items-center justify-center gap-1 bg-linear-to-r from-amber-500 via-orange-400 to-pink-500 text-white shadow hover:scale-[1.03] active:scale-95 transition-all cursor-pointer"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>Voir +{rewardPts} pts</span>
        </button>
      </div>
    </div>
  );
}

export const StoreView = ({ onSelectPlan }) => {
  const [activeTab, setActiveTab] = useState('packs');
  const [selected, setSelected] = useState('pack_1000');
  const [earnAds, setEarnAds] = useState([]);
  const [isLoadingAds, setIsLoadingAds] = useState(false);
  // visibleAdIds : IDs des pubs visibles dans la bande (les vues disparaissent)
  const [visibleAdIds, setVisibleAdIds] = useState(null); // null = non initialisé
  const [activeAdForModal, setActiveAdForModal] = useState(null);
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const { points } = useXp();

  const loadEarnAds = useCallback(async () => {
    setIsLoadingAds(true);
    try {
      const all = await apiClient.getAds();
      const seen = getSeenAds();
      if (Array.isArray(all) && all.length > 0) {
        const active = all.filter(a => a.active !== false);
        setEarnAds(active);
        const unvisitedIds = active.filter(a => !seen[a.id]).map(a => a.id);
        setVisibleAdIds(new Set(unvisitedIds));
      } else {
        const fallback = [
          {
            id: 'fb-earn-1', title: 'CamerPay — Paiement Mobile Money',
            tagline: 'Payez vos livres et abonnements en 1 clic.',
            mediaType: 'image', mediaUrl: null, aspectRatio: '16:9',
            gradient: 'from-amber-600 to-orange-700', icon: '💳',
            duration: 8, rewardPoints: 3, ctaUrl: 'https://camerpay.biz', ctaText: 'Découvrir CamerPay', active: true,
          },
          {
            id: 'fb-earn-2', title: "Read's Great VIP Club",
            tagline: "Rejoignez la communauté de lecteurs d'Afrique.",
            mediaType: 'image', mediaUrl: null, aspectRatio: '1:1',
            gradient: 'from-purple-600 to-indigo-700', icon: '📚',
            duration: 8, rewardPoints: 3, ctaUrl: 'https://wa.me/237699456779', ctaText: 'Rejoindre', active: true,
          },
        ];
        setEarnAds(fallback);
        const unvisitedIds = fallback.filter(a => !seen[a.id]).map(a => a.id);
        setVisibleAdIds(new Set(unvisitedIds));
      }
    } catch {
      setEarnAds([]);
    } finally {
      setIsLoadingAds(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'earn') {
      loadEarnAds();
    }
    const handleUpdate = () => { if (activeTab === 'earn') loadEarnAds(); };
    // Quand une pub est vue (récompense obtenue), la retirer de la bande
    const handleAdSeen = (e) => {
      const adId = e.detail?.adId;
      if (adId) {
        markAdSeen(adId);
        setVisibleAdIds(prev => {
          if (!prev) return prev;
          const next = new Set(prev);
          next.delete(adId);
          return next;
        });
      }
    };
    window.addEventListener('rg:ads-updated', handleUpdate);
    window.addEventListener('rg:ad-seen', handleAdSeen);
    return () => {
      window.removeEventListener('rg:ads-updated', handleUpdate);
      window.removeEventListener('rg:ad-seen', handleAdSeen);
    };
  }, [activeTab, loadEarnAds]);

  const handleWatchAd = (ad) => {
    setActiveAdForModal(ad);
    setIsRewardModalOpen(true);
  };

  // Pubs visibles dans la bande (non encore vues)
  const bandAds = visibleAdIds !== null
    ? earnAds.filter(a => visibleAdIds.has(a.id))
    : earnAds;
  const totalPtsAvailable = bandAds.reduce((acc, a) => acc + (a.rewardPoints || 3), 0);

  return (
    <div className="pb-56 sm:pb-64 animate-fadeIn select-none">

      {/* ── ONGLETS NAVIGATION ── */}
      <div className="flex items-center gap-2 max-w-2xl mx-auto px-4 pt-4 mb-6">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-sm transition-all duration-300 cursor-pointer border ${
                isActive
                  ? tab.id === 'earn'
                    ? 'bg-linear-to-r from-amber-500/30 via-orange-500/20 to-pink-500/20 border-amber-400/50 text-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.15)]'
                    : 'bg-linear-to-r from-purple-600/30 to-indigo-600/20 border-purple-400/50 text-purple-200'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.id === 'earn' && earnAds.length > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-amber-500/30 text-amber-200' : 'bg-white/10 text-slate-400'
                }`}>
                  {earnAds.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── TAB PACKS DE POINTS (À PARTIR DE 500 FCFA) ── */}
      {activeTab === 'packs' && (
        <>
          <div className="text-center py-2 sm:py-4 max-w-xl mx-auto space-y-3 px-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-black tracking-wide shadow-md">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Boutique Officielle · Packs de Points RG Play</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              Achetez des Points pour débloquer{' '}
              <span className="bg-linear-to-r from-amber-400 via-orange-400 to-pink-500 bg-clip-text text-transparent">
                en 1 Clic
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              À partir de <strong>500 FCFA</strong> seulement. Zéro abonnement récurrent : vos points sont valables à vie et crédités immédiatement par Mobile Money.
            </p>

            {/* Solde actuel de l'utilisateur */}
            <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-amber-950/40 border border-amber-400/40 shadow-xl backdrop-blur-md">
              <span className="text-xs text-amber-300/80 font-bold uppercase tracking-wider">Votre solde :</span>
              <span className="text-lg sm:text-xl font-black text-amber-300 flex items-center gap-1">
                <span>⭐</span> {points} <span className="text-xs font-semibold text-amber-400/80">points</span>
              </span>
            </div>
          </div>

          {/* Grille des Packs de Points */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto px-4">
            {POINT_PACKS.map((pack) => {
              const isActive = selected === pack.id;
              return (
                <div
                  key={pack.id}
                  onClick={() => setSelected(pack.id)}
                  className={`relative rounded-3xl p-6 flex flex-col justify-between cursor-pointer border transition-all duration-300 ${
                    isActive
                      ? `bg-[#1e0e37] ${pack.border} ${pack.glow} scale-[1.02]`
                      : 'bg-[#150a27]/80 border-purple-500/20 hover:border-amber-500/40 hover:bg-[#1b0d33]'
                  }`}
                >
                  <div>
                    {/* Badge Haut */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className={`text-[10.5px] font-black px-3 py-1 rounded-full border backdrop-blur-md ${pack.badgeStyle}`}>
                        {pack.badge}
                      </span>
                      <span className="text-amber-400 text-lg">⭐</span>
                    </div>

                    {/* Titre & Sous-titre */}
                    <h2 className="text-xl font-black text-white tracking-tight">{pack.title}</h2>
                    <p className="text-xs text-purple-200/70 mt-1 mb-4">{pack.subtitle}</p>

                    {/* Bloc Points Géant Lumineux */}
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-400/30 mb-4 flex items-center justify-between">
                      <div>
                        <div className="text-2xl sm:text-3xl font-black text-amber-300 tracking-tight flex items-center gap-1">
                          <span>{pack.totalPoints}</span>
                          <span className="text-xs font-extrabold uppercase text-amber-400/90">Points</span>
                        </div>
                        <div className="text-[10px] text-emerald-400 font-bold mt-0.5">
                          {pack.points} pts + {pack.bonusPoints} pts offerts 🎉
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl sm:text-2xl font-black text-white tracking-tight">
                          {pack.price}
                        </div>
                        <div className="text-[10px] text-purple-300 font-bold">{pack.unit}</div>
                      </div>
                    </div>

                    {/* Liste des Avantages */}
                    <ul className="space-y-2.5 mb-6">
                      {pack.features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs text-slate-200 leading-snug">
                          <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-2.5 h-2.5 text-emerald-400 stroke-3" />
                          </div>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Bouton Acheter Direct Mobile Money */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPlan?.({
                        id: pack.id,
                        title: `${pack.title} (${pack.totalPoints} Pts)`,
                        price: pack.rawPrice,
                        is_point_pack: true,
                        points_reward: pack.totalPoints,
                        xp_reward: Math.round(pack.rawPrice / 10),
                        cover_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
                        author: 'Recharge Points RG Play',
                        description: `${pack.totalPoints} points crédités immédiatement pour débloquer des livres audio en 1 clic.`,
                      });
                    }}
                    className={`w-full py-3.5 rounded-2xl font-black text-xs sm:text-sm text-white bg-linear-to-r ${pack.accent} hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-xl cursor-pointer`}
                  >
                    <Zap className="w-4 h-4 fill-white" />
                    <span>Acheter ce Pack ({pack.price} FCFA)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="max-w-md mx-auto px-4 mt-8 space-y-3 text-center">
            <div className="flex items-center justify-center gap-2 text-xs text-purple-200/70">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Paiement 100% sécurisé · Sans abonnement récurrent · Points à vie</span>
            </div>
            <div className="flex items-center justify-center gap-2.5 flex-wrap pt-1">
              <span className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-amber-300">🟧 Orange Money</span>
              <span className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-yellow-300">🟨 MTN MoMo</span>
              <span className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-cyan-300">💳 Carte / Wave</span>
            </div>
          </div>
        </>
      )}

      {/* ── TAB GAGNER DES POINTS ── */}
      {activeTab === 'earn' && (
        <div className="max-w-4xl mx-auto px-4 space-y-6">

          {/* En-tête */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold tracking-wide">
              <Sparkles className="w-4 h-4" />
              <span>Bande Publicitaire Récompensée</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Gagnez des{' '}
              <span className="bg-linear-to-r from-amber-400 via-orange-400 to-pink-400 bg-clip-text text-transparent">
                Points Gratuits
              </span>
            </h1>
            <p className="text-xs text-slate-300 max-w-md mx-auto">
              Cliquez sur une pub, visitez le lien partenaire et vos points sont crédités instantanément.
              Les pubs vues disparaissent automatiquement de la bande.
            </p>
          </div>

          {/* Solde */}
          <div className="flex items-center justify-center gap-4">
            <div className="rounded-2xl border border-amber-500/25 bg-amber-950/20 px-5 py-3 text-center">
              <div className="text-2xl font-extrabold text-amber-300">{points}</div>
              <div className="text-[10px] text-amber-400/70 font-semibold mt-0.5">Solde actuel</div>
            </div>
            {bandAds.length > 0 && (
              <div className="rounded-2xl border border-purple-500/25 bg-purple-950/20 px-5 py-3 text-center">
                <div className="text-2xl font-extrabold text-purple-300">{bandAds.length}</div>
                <div className="text-[10px] text-purple-400/70 font-semibold mt-0.5">Pubs restantes</div>
              </div>
            )}
            {bandAds.length > 0 && (
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/20 px-5 py-3 text-center">
                <div className="text-2xl font-extrabold text-emerald-300">+{totalPtsAvailable}</div>
                <div className="text-[10px] text-emerald-400/70 font-semibold mt-0.5">Pts à gagner</div>
              </div>
            )}
          </div>

          {/* ── BANDE PUBLICITAIRE HORIZONTALE ── */}
          {isLoadingAds ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-purple-300/60">
              <RefreshCw className="w-7 h-7 animate-spin" />
              <span className="text-sm font-medium">Chargement des offres...</span>
            </div>
          ) : bandAds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-emerald-950/40 border border-emerald-500/20 flex items-center justify-center text-3xl">✅</div>
              <div className="text-center">
                <p className="font-bold text-white">Toutes les pubs ont été vues !</p>
                <p className="text-sm mt-1 text-slate-400">Revenez demain pour de nouvelles offres partenaires.</p>
              </div>
              <button
                onClick={() => { setVisibleAdIds(null); loadEarnAds(); }}
                className="px-4 py-2 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-300 text-sm font-semibold flex items-center gap-2 hover:bg-purple-600/30 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Actualiser
              </button>
            </div>
          ) : (
            <div>
              {/* Bande horizontale scroll */}
              <div
                className="flex gap-3 overflow-x-auto pb-3"
                style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
              >
                {bandAds.map(ad => (
                  <div key={ad.id} style={{ scrollSnapAlign: 'start' }}>
                    <AdBandCard ad={ad} onWatch={handleWatchAd} />
                  </div>
                ))}
              </div>
              <p className="text-center text-[10px] text-slate-500 mt-1">
                ← Faites glisser pour voir plus de pubs →
              </p>
            </div>
          )}

          {/* Règles */}
          <div className="rounded-2xl border border-blue-500/20 bg-blue-950/15 p-4 text-xs text-blue-200/80 space-y-1.5">
            <p className="font-bold text-blue-300 flex items-center gap-1.5">
              <Shield className="w-4 h-4" /> Comment gagner des points ?
            </p>
            <p>1. Cliquez <strong className="text-white">Voir</strong> sur une pub dans la bande</p>
            <p>2. Cliquez sur le <strong className="text-white">Lien Partenaire</strong> qui apparaît</p>
            <p>3. Vos <strong className="text-amber-300">points sont crédités instantanément</strong> et la pub disparaît !</p>
            <p>4. Utilisez vos points pour <strong className="text-white">débloquer des livres</strong> gratuitement.</p>
          </div>
        </div>
      )}

      {/* Modal pub récompensée ouverte depuis la grille */}
      {isRewardModalOpen && activeAdForModal && (
        <RewardedAdModal
          isOpen={isRewardModalOpen}
          initialAd={activeAdForModal}
          initialAdId={activeAdForModal.id}
          onClose={() => setIsRewardModalOpen(false)}
        />
      )}

      {/* Spacer de sécurité pour garantir un défilement complet au-dessus de la barre de navigation et du mini-lecteur */}
      <div className="h-32 sm:h-40 w-full pointer-events-none" aria-hidden="true" />
    </div>
  );
};

export default StoreView;
