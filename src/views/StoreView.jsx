import React, { useState, useEffect, useCallback } from 'react';
import {
  Crown, Check, Zap, ArrowRight, Shield, Sparkles, Star,
  Gift, Play, ExternalLink, CheckCircle2, Lock, Music,
  RefreshCw, Clock
} from 'lucide-react';
import { apiClient } from '../services/api';
import { useXp } from '../context/XpContext';
import { RewardedAdModal } from '../components/RewardedAdModal';

const PLANS = [
  {
    id: 'pass_month',
    badge: 'LE PLUS POPULAIRE',
    title: 'Pass Mensuel Illimité',
    subtitle: 'Écoute illimitée & Mentor IA SKY',
    price: '3 500',
    unit: 'FCFA / mois',
    rawPrice: 3500,
    accent: 'from-purple-600 to-indigo-600',
    badgeStyle: 'bg-purple-500/20 text-purple-200 border-purple-400/40',
    border: 'border-purple-400/50',
    glow: 'shadow-[0_0_35px_rgba(168,85,247,0.30)]',
    features: [
      'Accès illimité à +500 livres audio et résumés',
      'Qualité Studio Haute Définition (320 kbps)',
      'Écoute hors-ligne sécurisée sans connexion',
      'Accès interactif illimité à l\'Agent SKY',
      'Sans engagement, résiliation en 1 clic',
    ],
  },
  {
    id: 'pass_vip',
    badge: 'MEILLEURE OFFRE (-50%)',
    title: 'Pass VIP Annuel',
    subtitle: 'Téléchargements permanents & Masterclasses',
    price: '19 900',
    unit: 'FCFA / an',
    rawPrice: 19900,
    accent: 'from-amber-500 via-orange-500 to-pink-600',
    badgeStyle: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
    border: 'border-amber-400/60',
    glow: 'shadow-[0_0_40px_rgba(251,191,36,0.30)]',
    features: [
      'Tous les avantages du Pass Mensuel pendant 12 mois',
      'Téléchargement MP3 permanent sur tous vos appareils',
      'Accès en avant-première aux nouveautés',
      'Support VIP WhatsApp 24/7 dédié',
      'Masterclasses exclusives et plans d\'action PDF',
    ],
  },
];

const TABS = [
  { id: 'plans', label: 'Pass Premium', icon: Crown },
  { id: 'earn', label: 'Gagner des Points', icon: Sparkles },
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
    '9:16': 'max-w-[160px]',
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
    return JSON.parse(localStorage.getItem(SEEN_ADS_KEY) || '{}');
  } catch { return {}; }
}

function markAdSeen(adId) {
  const seen = getSeenAds();
  seen[adId] = Date.now();
  localStorage.setItem(SEEN_ADS_KEY, JSON.stringify(seen));
}

// Carte de pub individuelle dans la grille "Gagner des Points"
function EarnAdCard({ ad, onWatch, isSeen }) {
  const rewardPts = ad.rewardPoints || 3;
  const isImage = ad.mediaType === 'image' && ad.mediaUrl;
  const isVideo = ad.mediaType === 'video' && ad.mediaUrl;
  const isAudio = ad.mediaType === 'audio' && ad.mediaUrl;
  const ratio = ad.aspectRatio || '16:9';
  const maxW = getMaxWidthStyle(ratio);

  return (
    <div className={`relative rounded-3xl border overflow-hidden flex flex-col transition-all duration-300 ${
      isSeen
        ? 'border-emerald-500/25 bg-emerald-950/20 opacity-80'
        : 'border-purple-500/30 bg-[#150a27]/80 hover:border-purple-400/50 hover:bg-[#1b0d33]'
    }`}>
      {/* Badge vu */}
      {isSeen && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
          <CheckCircle2 className="w-3 h-3" />
          <span>Vu ✅</span>
        </div>
      )}

      {/* Visuel pub */}
      <div className={`mx-auto mt-4 w-full px-4 ${isImage ? 'max-w-xs' : maxW}`}>
        <div
          className="relative w-full rounded-xl overflow-hidden bg-black/40 flex items-center justify-center"
          style={isImage ? { minHeight: '180px', maxHeight: '260px' } : getAspectStyle(ratio)}
        >
          {isVideo ? (
            <video
              src={ad.mediaUrl}
              muted
              playsInline
              loop
              autoPlay
              className="absolute inset-0 w-full h-full object-contain"
            />
          ) : isAudio ? (
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 to-purple-950 flex flex-col items-center justify-center gap-2 text-emerald-300">
              <Music className="w-8 h-8 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-400">Spot Audio</span>
            </div>
          ) : isImage ? (
            <img
              src={ad.mediaUrl}
              alt={ad.title}
              className="w-auto h-auto max-w-full max-h-[260px] object-contain mx-auto"
            />
          ) : (
            <div className={`absolute inset-0 bg-gradient-to-br ${ad.gradient || 'from-purple-600 to-pink-700'} flex flex-col items-center justify-center gap-2`}>
              <span className="text-4xl">{ad.icon || '📢'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Infos */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
              Partenaire
            </span>
            <span className="text-[11px] text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              +{rewardPts} pts ⭐
            </span>
          </div>
          <h3 className="font-extrabold text-sm text-white leading-snug">{ad.title}</h3>
          {ad.tagline && <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{ad.tagline}</p>}
        </div>

        {/* Durée */}
        <div className="flex items-center gap-1.5 text-[10px] text-purple-400">
          <Clock className="w-3 h-3" />
          <span>{ad.duration || 8}s · Cliquez le lien pour valider</span>
        </div>

        {/* Bouton regarder */}
        <button
          type="button"
          onClick={() => onWatch(ad)}
          className={`w-full py-2.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            isSeen
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
              : 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 text-white shadow-lg hover:scale-[1.02] active:scale-95'
          }`}
        >
          {isSeen ? (
            <><RefreshCw className="w-3.5 h-3.5" /><span>Revoir (+{rewardPts} pts)</span></>
          ) : (
            <><Play className="w-3.5 h-3.5 fill-current" /><span>Regarder → +{rewardPts} pts</span></>
          )}
        </button>
      </div>
    </div>
  );
}

export const StoreView = ({ onSelectPlan }) => {
  const [activeTab, setActiveTab] = useState('plans');
  const [selected, setSelected] = useState('pass_month');
  const [earnAds, setEarnAds] = useState([]);
  const [isLoadingAds, setIsLoadingAds] = useState(false);
  const [seenAds, setSeenAds] = useState(getSeenAds());
  const [activeAdForModal, setActiveAdForModal] = useState(null);
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const { points } = useXp();

  const loadEarnAds = useCallback(async () => {
    setIsLoadingAds(true);
    try {
      // Charger toutes les pubs actives (tous les emplacements)
      const all = await apiClient.getAds();
      if (Array.isArray(all) && all.length > 0) {
        setEarnAds(all.filter(a => a.active !== false));
      } else {
        // Fallback : pubs par défaut
        setEarnAds([
          {
            id: 'fb-earn-1',
            title: 'CamerPay — Paiement Mobile Money',
            tagline: 'Payez vos livres et abonnements en 1 clic.',
            mediaType: 'image', mediaUrl: null, aspectRatio: '16:9',
            gradient: 'from-amber-600 to-orange-700', icon: '💳',
            duration: 8, rewardPoints: 3,
            ctaUrl: 'https://camerpay.biz', ctaText: 'Découvrir CamerPay',
            active: true,
          },
          {
            id: 'fb-earn-2',
            title: "Read's Great VIP Club",
            tagline: "Rejoignez la communauté de lecteurs d'Afrique.",
            mediaType: 'image', mediaUrl: null, aspectRatio: '1:1',
            gradient: 'from-purple-600 to-indigo-700', icon: '📚',
            duration: 8, rewardPoints: 3,
            ctaUrl: 'https://wa.me/237699456779', ctaText: 'Rejoindre',
            active: true,
          },
        ]);
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
      setSeenAds(getSeenAds());
    }
    const handleUpdate = () => { if (activeTab === 'earn') loadEarnAds(); };
    window.addEventListener('rg:ads-updated', handleUpdate);
    window.addEventListener('rg:ad-reward-completed', () => setSeenAds(getSeenAds()));
    return () => {
      window.removeEventListener('rg:ads-updated', handleUpdate);
      window.removeEventListener('rg:ad-reward-completed', () => setSeenAds(getSeenAds()));
    };
  }, [activeTab, loadEarnAds]);

  const handleWatchAd = (ad) => {
    markAdSeen(ad.id);
    setSeenAds(getSeenAds());
    setActiveAdForModal(ad);
    setIsRewardModalOpen(true);
  };

  const totalPoints = earnAds.reduce((acc, a) => acc + (a.rewardPoints || 3), 0);
  const seenCount = earnAds.filter(a => seenAds[a.id]).length;
  const earnedPoints = earnAds
    .filter(a => seenAds[a.id])
    .reduce((acc, a) => acc + (a.rewardPoints || 3), 0);

  return (
    <div className="pb-36 sm:pb-40 animate-fadeIn select-none">

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
                    ? 'bg-gradient-to-r from-amber-500/30 via-orange-500/20 to-pink-500/20 border-amber-400/50 text-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.15)]'
                    : 'bg-gradient-to-r from-purple-600/30 to-indigo-600/20 border-purple-400/50 text-purple-200'
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

      {/* ── TAB PASS PREMIUM ── */}
      {activeTab === 'plans' && (
        <>
          <div className="text-center py-2 sm:py-4 max-w-xl mx-auto space-y-3 px-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-semibold tracking-wide">
              <Crown className="w-4 h-4 text-amber-400" />
              <span>Boutique &amp; Pass Premium</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Accédez à tout le catalogue{' '}
              <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                en illimité
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              Débloquez l'intégralité des œuvres audio, podcasts et analyses avec paiement instantané Orange Money, MTN MoMo et Carte.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto px-4">
            {PLANS.map((plan) => {
              const isActive = selected === plan.id;
              return (
                <div
                  key={plan.id}
                  onClick={() => setSelected(plan.id)}
                  className={`relative rounded-3xl p-6 sm:p-7 flex flex-col justify-between cursor-pointer border transition-all duration-300 ${
                    isActive
                      ? `bg-[#1e0e37] ${plan.border} ${plan.glow} scale-[1.02]`
                      : 'bg-[#150a27]/80 border-purple-500/20 hover:border-purple-500/40 hover:bg-[#1b0d33]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className={`text-[11px] font-bold px-3 py-1 rounded-full border backdrop-blur-md ${plan.badgeStyle}`}>
                      {plan.badge}
                    </span>
                    <Crown className={`w-5 h-5 ${plan.id === 'pass_vip' ? 'text-amber-400' : 'text-purple-400'}`} />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{plan.title}</h2>
                    <p className="text-xs text-purple-200/70 mt-1 mb-5">{plan.subtitle}</p>
                    <div className="flex items-baseline gap-2 pb-5 border-b border-purple-500/20 mb-5">
                      <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">{plan.price}</span>
                      <span className="text-xs sm:text-sm text-purple-300 font-medium">{plan.unit}</span>
                    </div>
                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200 leading-snug">
                          <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-2.5 h-2.5 text-emerald-400 stroke-[3]" />
                          </div>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPlan?.({
                        id: plan.id,
                        title: plan.title,
                        price: plan.rawPrice,
                        cover_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
                        author: 'RG Play VIP',
                        description: plan.features.join(' · '),
                      });
                    }}
                    className={`w-full py-3.5 rounded-2xl font-bold text-sm text-white bg-gradient-to-r ${plan.accent} hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer`}
                  >
                    <Zap className="w-4 h-4 fill-white" />
                    <span>Souscrire maintenant</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="max-w-md mx-auto px-4 mt-8 space-y-3 text-center">
            <div className="flex items-center justify-center gap-2 text-xs text-purple-200/70">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Paiement 100% sécurisé · Sans engagement · Accès instantané</span>
            </div>
            <div className="flex items-center justify-center gap-2.5 flex-wrap pt-1">
              <span className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-amber-300">🟧 Orange Money</span>
              <span className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-yellow-300">🟨 MTN MoMo</span>
              <span className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-cyan-300">💳 Carte Bancaire</span>
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
              <span>Publicités Récompensées</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Gagnez des{' '}
              <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-pink-400 bg-clip-text text-transparent">
                Points Gratuits
              </span>
            </h1>
            <p className="text-xs text-slate-300 max-w-md mx-auto">
              Regardez une publicité partenaire et cliquez le lien pour valider vos points instantanément.
            </p>
          </div>

          {/* Tableau de bord points */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-amber-500/25 bg-amber-950/20 p-3 text-center">
              <div className="text-xl font-extrabold text-amber-300">{points}</div>
              <div className="text-[10px] text-amber-400/70 font-semibold mt-0.5">Solde actuel</div>
            </div>
            <div className="rounded-2xl border border-purple-500/25 bg-purple-950/20 p-3 text-center">
              <div className="text-xl font-extrabold text-purple-300">{earnAds.length}</div>
              <div className="text-[10px] text-purple-400/70 font-semibold mt-0.5">Pubs dispo.</div>
            </div>
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/20 p-3 text-center">
              <div className="text-xl font-extrabold text-emerald-300">{totalPoints}</div>
              <div className="text-[10px] text-emerald-400/70 font-semibold mt-0.5">Pts à gagner</div>
            </div>
          </div>

          {/* Barre de progression globale */}
          {earnAds.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">{seenCount}/{earnAds.length} pubs vues</span>
                <span className="text-amber-300 font-bold">{earnedPoints} pts gagnés</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-400 to-pink-500 transition-all duration-500"
                  style={{ width: earnAds.length > 0 ? `${(seenCount / earnAds.length) * 100}%` : '0%' }}
                />
              </div>
            </div>
          )}

          {/* Grille de pubs */}
          {isLoadingAds ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-purple-300/60">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <span className="text-sm font-medium">Chargement des offres...</span>
            </div>
          ) : earnAds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-purple-900/30 border border-purple-500/20 flex items-center justify-center text-3xl">📭</div>
              <div className="text-center">
                <p className="font-bold text-white">Aucune publicité disponible</p>
                <p className="text-sm mt-1">Les offres partenaires apparaîtront ici dès qu'elles seront publiées.</p>
              </div>
              <button
                onClick={loadEarnAds}
                className="px-4 py-2 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-300 text-sm font-semibold flex items-center gap-2 hover:bg-purple-600/30 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Actualiser
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {earnAds.map(ad => (
                <EarnAdCard
                  key={ad.id}
                  ad={ad}
                  isSeen={!!seenAds[ad.id]}
                  onWatch={handleWatchAd}
                />
              ))}
            </div>
          )}

          {/* Rappel des règles */}
          <div className="rounded-2xl border border-blue-500/20 bg-blue-950/15 p-4 text-xs text-blue-200/80 space-y-1.5">
            <p className="font-bold text-blue-300 flex items-center gap-1.5">
              <Shield className="w-4 h-4" /> Comment gagner des points ?
            </p>
            <p>1. Cliquez <strong className="text-white">Regarder</strong> sur une publicité</p>
            <p>2. Cliquez sur le <strong className="text-white">Lien Partenaire</strong> (CTA) qui apparaît</p>
            <p>3. Vos <strong className="text-amber-300">points sont crédités instantanément</strong> !</p>
            <p>4. Utilisez vos points pour <strong className="text-white">débloquer des livres audio</strong> gratuitement.</p>
          </div>
        </div>
      )}

      {/* Modal pub récompensée ouverte depuis la grille */}
      {isRewardModalOpen && activeAdForModal && (
        <RewardedAdModal
          isOpen={isRewardModalOpen}
          onClose={() => {
            setIsRewardModalOpen(false);
            setSeenAds(getSeenAds());
          }}
        />
      )}
    </div>
  );
};

export default StoreView;
