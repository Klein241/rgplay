import React, { useState, useEffect } from 'react';
import {
  User, CreditCard, Headphones, Crown, CheckCircle2, BookOpen, Wallet,
  Edit3, Sparkles, Phone, Mail, Download, Wifi, WifiOff,
  Play, Trash2, Settings, MessageCircle, Zap, Star,
  Smartphone, Check, RefreshCw, X, ArrowRight, ShieldCheck, ExternalLink,
  Gift, Award, Flame, Clock
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useXp } from '../context/XpContext';
import { UserProfileModal } from '../components/UserProfileModal';
import { downloadAudioMp3, getOfflineBooks, removeOfflineAudio, getOfflineCacheSize, cacheAudioForOffline } from '../utils/offlineAudioCache';
import { trackAction } from '../services/tracker';
import { ReferralCard } from '../components/ReferralSystem';
import { StreakBadge, StreakModal } from '../components/StreakSystem';
import { AdBanner } from '../components/AdBanner';
import { apiClient } from '../services/api';

// ── Profil utilisateur par défaut ───────────────────────────────────────────
const defaultProfile = {
  name: 'Invité RG Play',
  email: '',
  phone: '',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80',
  favoriteGenre: '📚 Développement Personnel',
  plan: 'free',
  solde: 0,
  is_registered: false,
  hoursListened: 0,
  completedBooks: 0,
  weeklyGoalMinutes: 60,
  weeklyProgressMinutes: 0,
  notifications: true,
  streamQuality: '128',
};

const getProfile = () => {
  try {
    const stored = localStorage.getItem('rg_user_profile');
    if (stored) return { ...defaultProfile, ...JSON.parse(stored) };
  } catch {}
  return defaultProfile;
};

const getPurchasedBooks = () => {
  try {
    return JSON.parse(localStorage.getItem('rg_user_library') || '[]');
  } catch { return []; }
};

const PLANS = {
  free: {
    id: 'free',
    label: 'Gratuit',
    color: 'text-slate-300',
    bg: 'bg-white/8',
    border: 'border-white/10',
    features: ['3 titres gratuits par mois', 'Qualité Standard (128kbps)', 'Accès aux extraits'],
    price: '0 FCFA',
  },
  premium: {
    id: 'premium',
    label: 'Premium',
    color: 'text-purple-300',
    bg: 'bg-purple-500/15',
    border: 'border-purple-500/30',
    icon: Star,
    features: ['Titres illimités en streaming', 'Haute Qualité Audio (320kbps)', 'Sans aucune publicité', 'Téléchargement hors-ligne'],
    price: '3 500 FCFA/mois',
    rawPrice: 3500,
  },
  vip: {
    id: 'vip',
    label: 'VIP Illimité',
    color: 'text-amber-300',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/35',
    icon: Crown,
    features: ['Tous les livres audio débloqués', 'Téléchargements MP3 illimités', 'Qualité Master Studio', 'Accès prioritaire aux nouveautés', 'Support VIP WhatsApp 24/7'],
    price: '6 500 FCFA/mois',
    rawPrice: 6500,
  },
};

const TABS = [
  { id: 'overview', label: 'Aperçu', icon: User },
  { id: 'rewards', label: 'XP & Badges ⭐', icon: Sparkles },
  { id: 'purchases', label: 'Mes Achats', icon: BookOpen },
  { id: 'offline', label: 'Hors-Ligne', icon: WifiOff },
  { id: 'settings', label: 'Préférences', icon: Settings },
];

export const ProfileView = ({ onOpenAdmin, onOpenInstallModal, onOpenCheckout }) => {
  const [profile, setProfile] = useState(getProfile());
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [purchasedBooks, setPurchasedBooks] = useState(getPurchasedBooks());
  const [offlineBooks, setOfflineBooks] = useState(getOfflineBooks());
  const [cacheSize, setCacheSize] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadMsg, setDownloadMsg] = useState(null);

  // Modales interactives
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [selectedTopUpMethod, setSelectedTopUpMethod] = useState('orange'); // 'orange' | 'mtn'
  const [topUpAmount, setTopUpAmount] = useState(2500);
  const [topUpPhone, setTopUpPhone] = useState(profile.phone || '');
  const [isProcessingTopUp, setIsProcessingTopUp] = useState(false);

  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [selectedSubPlan, setSelectedSubPlan] = useState('vip');
  const [subMethod, setSubMethod] = useState('orange');
  const [subPhone, setSubPhone] = useState(profile.phone || '');
  const [isProcessingSub, setIsProcessingSub] = useState(false);
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);

  const { playBook, playbackRate, changePlaybackRate, sleepTimerOption, setSleepTimer } = useAudio();
  const {
    xp, points, levelInfo, unlockedBadges, allBadges,
    recentTransactions, claimDailyReward, readingMinutes,
    listeningMinutes, dailyStreak, lastDailyRewardDate
  } = useXp();

  useEffect(() => {
    // Synchroniser avec D1 dès l'ouverture
    apiClient.getUserProfile().then(p => { if (p) setProfile(p); });
    apiClient.getLibrary().then(lib => { if (Array.isArray(lib)) setPurchasedBooks(lib); });

    const handleUpdate = (e) => {
      if (e.detail) setProfile(e.detail);
      else apiClient.getUserProfile().then(p => { if (p) setProfile(p); });
    };
    const handleLibraryUpdate = () => {
      apiClient.getLibrary().then(lib => { if (Array.isArray(lib)) setPurchasedBooks(lib); });
    };
    const handleOfflineUpdate = () => {
      setOfflineBooks(getOfflineBooks());
      getOfflineCacheSize().then(size => setCacheSize(size));
    };
    window.addEventListener('rg:user-updated', handleUpdate);
    window.addEventListener('rg:library-updated', handleLibraryUpdate);
    window.addEventListener('rg_offline_cache_updated', handleOfflineUpdate);
    return () => {
      window.removeEventListener('rg:user-updated', handleUpdate);
      window.removeEventListener('rg:library-updated', handleLibraryUpdate);
      window.removeEventListener('rg_offline_cache_updated', handleOfflineUpdate);
    };
  }, []);

  useEffect(() => {
    getOfflineCacheSize().then(size => setCacheSize(size));
  }, [offlineBooks]);

  // ── Sauvegarde globale du profil (D1 + Local) ──
  const saveUpdatedProfile = async (newValues) => {
    const updated = { ...profile, ...newValues };
    setProfile(updated);
    await apiClient.updateUserProfile(updated);
  };

  // ── Gestion de la recharge portefeuille D1 ──
  const handleOpenTopUp = (method) => {
    setSelectedTopUpMethod(method);
    setTopUpPhone(profile.phone || '');
    setIsTopUpModalOpen(true);
  };

  const handleConfirmTopUp = async () => {
    if (!topUpAmount || topUpAmount <= 0) return;
    setIsProcessingTopUp(true);

    try {
      await apiClient.topUpWallet(Number(topUpAmount), selectedTopUpMethod, topUpPhone.trim() || profile.phone);
      const newSolde = (profile.solde || profile.wallet_balance || 0) + Number(topUpAmount);
      setProfile(prev => ({ ...prev, solde: newSolde, wallet_balance: newSolde }));
      setIsProcessingTopUp(false);
      setIsTopUpModalOpen(false);
      setDownloadMsg({
        type: 'success',
        text: `✓ Rechargement réussi ! +${Number(topUpAmount).toLocaleString('fr-FR')} FCFA ajoutés à votre portefeuille.`
      });
      setTimeout(() => setDownloadMsg(null), 5000);
    } catch (err) {
      setIsProcessingTopUp(false);
      setDownloadMsg({ type: 'error', text: 'Erreur lors du rechargement.' });
    }
  };

  // ── Gestion de l'abonnement VIP / Premium D1 ──
  const handleOpenSubscription = (planId = 'vip') => {
    setSelectedSubPlan(planId);
    setSubPhone(profile.phone || '');
    setIsSubModalOpen(true);
  };

  const handleConfirmSubscription = async () => {
    setIsProcessingSub(true);

    try {
      await apiClient.subscribePlan({
        plan: selectedSubPlan,
        method: subMethod,
        phone: subPhone.trim() || profile.phone,
      });
      setProfile(prev => ({ ...prev, plan: selectedSubPlan, is_registered: true }));
      setIsProcessingSub(false);
      setIsSubModalOpen(false);
      setDownloadMsg({
        type: 'success',
        text: `🎉 Félicitations ! Votre abonnement ${PLANS[selectedSubPlan]?.label || 'VIP'} est maintenant activé sur Cloudflare D1.`
      });
      setTimeout(() => setDownloadMsg(null), 5000);
    } catch (err) {
      setIsProcessingSub(false);
      setDownloadMsg({ type: 'error', text: 'Erreur lors de l\'activation de l\'abonnement.' });
    }
  };

  // ── Téléchargement MP3 ──
  const handleDownloadMp3 = async (book, chapter = null) => {
    const isPurchased = purchasedBooks.some(b => b.id === book.id);
    if (!isPurchased && book.price > 0 && !book.is_free_for_members) {
      if (onOpenCheckout) onOpenCheckout(book);
      return;
    }
    setDownloadingId(book.id);
    setDownloadMsg(null);
    trackAction('download_mp3', book.id);
    const result = await downloadAudioMp3(book, chapter, isPurchased);
    if (result === 'ok') {
      setDownloadMsg({ type: 'success', text: `✓ Téléchargement de "${book.title}" en cours...` });
    } else if (result === 'not_purchased') {
      setDownloadMsg({ type: 'error', text: 'Achetez ce titre pour télécharger le MP3.' });
    } else {
      setDownloadMsg({ type: 'warn', text: 'Ouverture du flux audio...' });
    }
    setDownloadingId(null);
    setTimeout(() => setDownloadMsg(null), 4000);
  };

  // ── Sauvegarde en cache hors-ligne ──
  const handleSaveToOffline = async (book) => {
    setDownloadingId(book.id);
    const success = await cacheAudioForOffline(book);
    setDownloadingId(null);
    if (success) {
      setOfflineBooks(getOfflineBooks());
      setDownloadMsg({ type: 'success', text: `✓ "${book.title}" est maintenant disponible hors-ligne !` });
    } else {
      setDownloadMsg({ type: 'warn', text: `Flux audio préparé pour le mode hors-ligne.` });
    }
    setTimeout(() => setDownloadMsg(null), 4000);
  };

  const handleClearOffline = async (bookId) => {
    await removeOfflineAudio(bookId);
    setOfflineBooks(getOfflineBooks());
  };

  const currentPlan = PLANS[profile.plan] || PLANS.free;
  const totalHours = Number(profile.hoursListened || 0).toFixed(1);
  const weeklyPct = Math.min(100, Math.round((profile.weeklyProgressMinutes || 0) / (profile.weeklyGoalMinutes || 60) * 100));

  return (
    <div className="pb-36 sm:pb-40 max-w-2xl mx-auto space-y-6 animate-fadeIn">

      {/* ── En-Tête Profil ── */}
      <div className="card-lg space-y-5 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-pink-600/15 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <img
              src={profile.avatar || defaultProfile.avatar}
              alt={profile.name}
              className="w-24 h-24 rounded-3xl object-cover border-2 border-purple-400/40 shadow-xl shadow-purple-500/20"
            />
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 border-2 border-[#07041A] flex items-center justify-center shadow-lg hover:scale-110 transition-transform text-white cursor-pointer"
              title="Modifier la photo"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 text-center sm:text-left min-w-0 space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-white font-['Outfit']">{profile.name}</h2>
              {profile.is_registered ? (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-extrabold flex items-center gap-1">
                  <CheckCircle2 size={11} /> Profil vérifié
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-extrabold">
                  Invité
                </span>
              )}
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${currentPlan.bg} ${currentPlan.color} ${currentPlan.border}`}>
                {currentPlan.icon && <currentPlan.icon className="w-3 h-3" />}
                {currentPlan.label}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-slate-400">
              {profile.phone ? (
                <span className="flex items-center gap-1 text-slate-300"><Phone size={12} className="text-purple-400" /> {profile.phone}</span>
              ) : (
                <span className="text-[11px] text-slate-500 italic">Aucun numéro enregistré</span>
              )}
              {profile.email && <span className="flex items-center gap-1"><Mail size={12} className="text-purple-400" /> {profile.email}</span>}
            </div>

            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="mt-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all mx-auto sm:mx-0 active:scale-95 cursor-pointer"
            >
              <Edit3 size={13} />
              {profile.is_registered ? 'Modifier mon profil' : '✨ Créer mon profil'}
            </button>
          </div>
        </div>

        {/* Statistiques clés */}
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10">
          <div className="text-center p-3 rounded-2xl bg-white/5 border border-white/8 shadow-inner">
            <span className="text-xl sm:text-2xl font-black text-purple-300 font-['Outfit']">{purchasedBooks.length}</span>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Titres Achetés</p>
          </div>
          <div className="text-center p-3 rounded-2xl bg-white/5 border border-white/8 shadow-inner">
            <span className="text-xl sm:text-2xl font-black text-cyan-300 font-['Outfit']">{totalHours}h</span>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Heures Écoutées</p>
          </div>
          <div className="text-center p-3 rounded-2xl bg-white/5 border border-white/8 shadow-inner">
            <span className="text-xl sm:text-2xl font-black text-emerald-400 font-['Outfit']">{(profile.solde || 0).toLocaleString('fr-FR')} F</span>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Solde Portefeuille</p>
          </div>
        </div>

        {/* Objectif hebdomadaire */}
        <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/25 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-purple-300 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-amber-400" /> Objectif Semaine</span>
            <span className="text-slate-300 font-mono font-bold">{profile.weeklyProgressMinutes || 0} / {profile.weeklyGoalMinutes || 60} min</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 rounded-full transition-all duration-700 shadow-lg shadow-purple-500/50"
              style={{ width: `${weeklyPct}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 font-medium">{weeklyPct >= 100 ? '🎉 Objectif atteint cette semaine !' : `${weeklyPct}% complété`}</p>
        </div>
      </div>

      {/* ── Navigation par Onglets (Segmented Control Haute Visibilité) ── */}
      <div
        className="p-1.5 rounded-2xl border flex items-center gap-1.5 shadow-2xl backdrop-blur-2xl"
        style={{
          background: 'linear-gradient(160deg, rgba(22, 17, 46, 0.95) 0%, rgba(12, 8, 30, 0.98) 100%)',
          borderColor: 'rgba(168, 85, 247, 0.25)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)'
        }}
      >
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-black transition-all duration-200 cursor-pointer font-['Outfit'] select-none ${
                isActive
                  ? 'text-white shadow-xl shadow-purple-600/40 scale-[1.02]'
                  : 'text-slate-300 hover:text-white hover:bg-white/8'
              }`}
              style={
                isActive
                  ? {
                      background: 'linear-gradient(135deg, #7e22ce 0%, #a855f7 50%, #ec4899 100%)',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      boxShadow: '0 4px 15px rgba(168, 85, 247, 0.45), inset 0 1px 0 rgba(255,255,255,0.2)'
                    }
                  : { border: '1px solid transparent' }
              }
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white stroke-[2.5]' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.id === 'purchases' && purchasedBooks.length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  isActive ? 'bg-white/25 text-white' : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                }`}>
                  {purchasedBooks.length}
                </span>
              )}
              {tab.id === 'offline' && offlineBooks.length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  isActive ? 'bg-white/25 text-white' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                }`}>
                  {offlineBooks.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Message de statut / feedback */}
      {downloadMsg && (
        <div className={`px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn shadow-xl ${
          downloadMsg.type === 'success' ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300' :
          downloadMsg.type === 'error'   ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300' :
                                           'bg-amber-500/20 border border-amber-500/40 text-amber-300'
        }`}>
          {downloadMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0" />}
          <span>{downloadMsg.text}</span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          1. TAB : APERÇU
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-5 animate-fadeIn">

          {/* ── CARTE GAMIFICATION & NIVEAU READ'S GREAT ── */}
          <div className="card-lg space-y-4 border border-purple-500/30 bg-gradient-to-br from-purple-950/60 via-[#1c0d38] to-[#120724] relative overflow-hidden shadow-2xl shadow-purple-950/50">
            <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500 flex items-center justify-center text-2xl shadow-lg shadow-purple-600/30 shrink-0">
                  {levelInfo.currentLevel.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Niveau {levelInfo.currentLevel.level}
                    </span>
                    <span className="text-xs text-amber-400 font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> {points} Points ⭐
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white mt-0.5 font-['Outfit']">
                    {levelInfo.currentLevel.name}
                  </h3>
                  <p className="text-xs text-purple-200/70">{levelInfo.currentLevel.title}</p>
                </div>
              </div>

              {/* Bouton Bonus Quotidien */}
              <button
                onClick={() => {
                  const res = claimDailyReward();
                  if (!res.success) {
                    setDownloadMsg({ type: 'warn', text: res.message });
                    setTimeout(() => setDownloadMsg(null), 3000);
                  }
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-lg shadow-amber-500/25 transition-all hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <Flame className="w-4 h-4 text-white animate-bounce" />
                <span>Bonus Quotidien (+15 XP)</span>
              </button>
            </div>

            {/* Barre de Progression XP */}
            <div className="space-y-1.5 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between text-xs">
                <span className="text-purple-300/90 font-semibold flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-purple-400" />
                  Progression vers Niveau {levelInfo.nextLevel?.level || 'Max'} ({levelInfo.nextLevel?.name || 'Légende'})
                </span>
                <span className="font-mono font-bold text-amber-300">{xp} XP {levelInfo.nextLevel ? `/ ${levelInfo.nextLevel.minXp} XP` : ''}</span>
              </div>
              <div className="h-2.5 rounded-full bg-black/40 border border-white/10 overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400 transition-all duration-700 shadow-md shadow-purple-500/50"
                  style={{ width: `${levelInfo.percentage}%` }}
                />
              </div>
            </div>

            {/* Statistiques de Lecture & Écoute Read's Great */}
            <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-black/20 border border-white/5">
                <span className="font-extrabold text-purple-300 block">{readingMinutes || 0} min</span>
                <span className="text-[10px] text-purple-200/60 uppercase font-medium">Lecture E-Book</span>
              </div>
              <div className="p-2 rounded-xl bg-black/20 border border-white/5">
                <span className="font-extrabold text-cyan-300 block">{listeningMinutes || 0} min</span>
                <span className="text-[10px] text-purple-200/60 uppercase font-medium">Écoute Audio</span>
              </div>
              <div className="p-2 rounded-xl bg-black/20 border border-white/5">
                <span className="font-extrabold text-amber-300 block">{dailyStreak || 1} Jours 🔥</span>
                <span className="text-[10px] text-purple-200/60 uppercase font-medium">Série Active</span>
              </div>
            </div>
          </div>

          {/* Carte Abonnement */}
          <div className="card-lg space-y-4 border border-amber-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white font-['Outfit']">Mon Abonnement</h3>
                  <p className="text-[11px] text-slate-400">Statut et formule d'écoute actuelle</p>
                </div>
              </div>
              <span className={`text-xs font-black px-3 py-1 rounded-full border ${currentPlan.bg} ${currentPlan.color} ${currentPlan.border}`}>
                {currentPlan.label}
              </span>
            </div>

            <ul className="space-y-2 pt-1 border-t border-white/10">
              {currentPlan.features.map((feat, idx) => (
                <li key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>

            {/* Bouton d'action abonnement interactif */}
            <button
              onClick={() => handleOpenSubscription(profile.plan === 'vip' ? 'premium' : 'vip')}
              className="w-full py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm shadow-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-95 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                color: '#07041a',
                boxShadow: '0 8px 25px rgba(245, 158, 11, 0.35)'
              }}
            >
              <Crown className="w-4 h-4 fill-current" />
              <span>
                {profile.plan === 'vip'
                  ? '✨ Gérer mon abonnement VIP Illimité'
                  : '⭐ Passer en VIP Illimité — 6 500 FCFA/mois'}
              </span>
            </button>
          </div>

          {/* Parrainage & Récompenses */}
          <ReferralCard profile={profile} />

          {/* Flammes d'écoute — Streak Journalier */}
          <button
            onClick={() => setIsStreakModalOpen(true)}
            className="w-full p-4 rounded-2xl text-left transition-all active:scale-[0.99] hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, rgba(251,146,60,0.10) 0%, rgba(239,68,68,0.06) 100%)',
              border: '1px solid rgba(251,146,60,0.25)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(251,146,60,0.18)', border: '1px solid rgba(251,146,60,0.28)' }}>
                  <span className="text-xl">🔥</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Flammes d'Écoute</p>
                  <p className="text-[11px] text-slate-400">Votre série quotidienne · Niveaux & Récompenses</p>
                </div>
              </div>
              <StreakBadge onClick={() => setIsStreakModalOpen(true)} />
            </div>
          </button>

          <StreakModal isOpen={isStreakModalOpen} onClose={() => setIsStreakModalOpen(false)} />

          {/* Carte Portefeuille RG Play */}
          <div className="card-lg space-y-4 border border-emerald-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white font-['Outfit']">Portefeuille RG Play</h3>
                  <p className="text-[11px] text-slate-400">Paiements instantanés et recharge en 1 clic</p>
                </div>
              </div>
            </div>

            {/* Affichage Solde */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 to-teal-500/10 border border-emerald-500/30">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Solde Disponible</p>
                <p className="text-2xl sm:text-3xl font-black text-emerald-400 font-['Outfit'] mt-0.5">
                  {(profile.solde || 0).toLocaleString('fr-FR')} FCFA
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Wallet className="w-6 h-6" />
              </div>
            </div>

            {/* Boutons Recharge Fonctionnels : Orange Money & MTN MoMo */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => handleOpenTopUp('orange')}
                className="py-3 px-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 cursor-pointer border"
                style={{
                  background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.22) 0%, rgba(234, 88, 12, 0.28) 100%)',
                  borderColor: 'rgba(249, 115, 22, 0.5)',
                  color: '#fdba74'
                }}
              >
                <Smartphone className="w-4 h-4 text-orange-400" />
                <span>Recharge Orange Money</span>
              </button>

              <button
                onClick={() => handleOpenTopUp('mtn')}
                className="py-3 px-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 cursor-pointer border"
                style={{
                  background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.22) 0%, rgba(202, 138, 4, 0.28) 100%)',
                  borderColor: 'rgba(234, 179, 8, 0.5)',
                  color: '#fde047'
                }}
              >
                <Smartphone className="w-4 h-4 text-yellow-400" />
                <span>Recharge MTN MoMo</span>
              </button>
            </div>
          </div>

          {/* Support WhatsApp */}
          <a
            href="https://wa.me/237699456779?text=Bonjour%20RG%20Play%2C%20j%27ai%20besoin%20d%27aide%20avec%20mon%20compte"
            target="_blank"
            rel="noopener noreferrer"
            className="card-lg flex items-center justify-between gap-4 hover:border-emerald-500/40 transition-colors border border-emerald-500/20"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Assistance & Support Client VIP</p>
                <p className="text-xs text-slate-400">Équipe disponible par WhatsApp 7j/7</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-400" />
          </a>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          2. TAB : XP, POINTS & BADGES READ'S GREAT
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'rewards' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Bannière de Points & Récompenses Sponsorisées */}
          <AdBanner
            placement="profile_header"
            onOpenRewardModal={() => window.dispatchEvent(new Event('rg:open-reward-ad'))}
          />

          {/* Carte Solde de Points */}
          <div className="card-lg border border-amber-500/30 bg-gradient-to-r from-[#1f0e38] to-[#160829] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-2xl text-amber-400 shadow-lg shadow-amber-500/20">
                ⭐
              </div>
              <div>
                <span className="text-[10px] text-amber-300 font-extrabold uppercase tracking-wider">Portefeuille Read's Great</span>
                <h3 className="text-2xl font-black text-white font-mono">{points} <span className="text-sm font-sans text-amber-400">Points</span></h3>
                <p className="text-xs text-purple-200/70">100 Points = 1 Livre audio ou E-book gratuit</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                onClick={() => {
                  const res = claimDailyReward();
                  if (!res.success) {
                    setDownloadMsg({ type: 'warn', text: res.message });
                    setTimeout(() => setDownloadMsg(null), 3000);
                  }
                }}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-[#140a22] shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Flame className="w-4 h-4" />
                <span>Bonus Quotidien</span>
              </button>
              <button
                onClick={() => window.dispatchEvent(new Event('rg:open-reward-ad'))}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Gift className="w-4 h-4" />
                <span>+25 Pts Sponsor</span>
              </button>
            </div>
          </div>

          {/* Vitrine des Badges Read's Great */}
          <div className="card-lg space-y-4 border border-purple-500/20">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white font-['Outfit'] flex items-center gap-2">
                  <Award className="w-5 h-5 text-purple-400" />
                  <span>Badges & Succès Read's Great</span>
                </h3>
                <p className="text-xs text-slate-400">Débloquez des badges en lisant, écoutant et partageant</p>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {unlockedBadges?.length || 0} / {allBadges?.length || 9}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {(allBadges || []).map(badge => {
                const isUnlocked = (unlockedBadges || []).includes(badge.id);
                return (
                  <div
                    key={badge.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                      isUnlocked
                        ? 'bg-gradient-to-br from-purple-950/50 to-pink-950/30 border-purple-500/40 shadow-lg shadow-purple-950/30'
                        : 'bg-white/3 border-white/5 opacity-50'
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                      isUnlocked ? 'bg-purple-600/30 border border-purple-400/40' : 'bg-black/30 border border-white/5 grayscale'
                    }`}>
                      {badge.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="font-bold text-xs text-white truncate">{badge.name}</h4>
                        {isUnlocked ? (
                          <span className="text-[9px] font-extrabold text-emerald-400">Débloqué ✓</span>
                        ) : (
                          <span className="text-[9px] text-slate-500">Verrouillé</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300/80 mt-0.5 line-clamp-2 leading-tight">
                        {badge.description}
                      </p>
                      <span className="inline-block text-[9px] font-bold text-amber-400/90 mt-1">
                        +{badge.rewardPoints} Points
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Historique des Transactions de Points */}
          <div className="card-lg space-y-3 border border-purple-500/20">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Historique des Gains & Dépenses de Points</span>
            </h3>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {(recentTransactions || []).map(tx => (
                <div
                  key={tx.id}
                  className="p-3 rounded-xl bg-white/4 border border-white/6 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-slate-200 truncate">{tx.description}</p>
                    <span className="text-[10px] text-slate-400">
                      {new Date(tx.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <span className={`font-mono font-bold whitespace-nowrap ${
                    tx.amount > 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount} Pts ⭐
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          3. TAB : MES ACHATS
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'purchases' && (
        <div className="space-y-4 animate-fadeIn">
          {purchasedBooks.length === 0 ? (
            <div className="card-lg text-center py-12 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto text-purple-400">
                <BookOpen className="w-8 h-8" />
              </div>
              <div>
                <p className="text-base font-bold text-slate-200">Aucun titre acheté pour l'instant</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Explorez le catalogue de livres audio, podcasts et masterclasses pour débloquer vos premiers contenus.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {purchasedBooks.map(book => (
                <div key={book.id} className="card-md flex flex-col sm:flex-row items-start sm:items-center gap-4 hover:border-purple-500/40 transition-all">
                  <img
                    src={book.cover_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=200&q=60'}
                    alt={book.title}
                    onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=200&q=60'; }}
                    className="w-16 h-16 rounded-2xl object-cover border border-white/10 flex-shrink-0 shadow-lg"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate font-['Outfit']">{book.title}</p>
                    <p className="text-xs text-slate-400 truncate">Par {book.author}</p>
                    <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Acheté & Débloqué à vie
                    </p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-white/8">
                    {/* Bouton Écouter direct */}
                    <button
                      onClick={() => playBook(book, 0, 0)}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Écouter</span>
                    </button>

                    {/* Bouton Hors-Ligne */}
                    <button
                      onClick={() => handleSaveToOffline(book)}
                      className="px-3 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                      title="Rendre disponible hors-ligne"
                    >
                      <Wifi className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Hors-Ligne</span>
                    </button>

                    {/* Bouton MP3 */}
                    <button
                      onClick={() => handleDownloadMp3(book)}
                      disabled={downloadingId === book.id}
                      className="p-2 rounded-xl bg-white/8 hover:bg-white/15 text-slate-300 text-xs font-bold flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                      title="Télécharger MP3"
                    >
                      {downloadingId === book.id ? (
                        <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          3. TAB : HORS-LIGNE
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'offline' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Espace Disque Utilisé */}
          <div className="card-md flex items-center justify-between border border-cyan-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <WifiOff className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Stockage Audio Hors-Ligne</p>
                <p className="text-[10px] text-slate-400">{cacheSize ? `~${cacheSize} Mo en mémoire locale` : 'Calcul de l\'espace...'}</p>
              </div>
            </div>
            <span className="text-xs font-black text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 px-3 py-1 rounded-xl">
              {offlineBooks.length} piste{offlineBooks.length > 1 ? 's' : ''}
            </span>
          </div>

          {offlineBooks.length === 0 ? (
            <div className="card-lg text-center py-12 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto text-cyan-400">
                <WifiOff className="w-8 h-8" />
              </div>
              <div>
                <p className="text-base font-bold text-slate-200">Aucun titre téléchargé en cache</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Dans l'onglet « Mes Achats » ou sur une fiche audio, cliquez sur « Hors-Ligne » pour écouter même sans réseau internet.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {offlineBooks.map(book => (
                <div key={book.id} className="card-md flex items-center gap-4 hover:border-cyan-500/40 transition-all">
                  <img
                    src={book.cover_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=200&q=60'}
                    alt={book.title}
                    onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=200&q=60'; }}
                    className="w-14 h-14 rounded-2xl object-cover border border-white/10 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate font-['Outfit']">{book.title}</p>
                    <p className="text-xs text-slate-400 truncate">{book.author}</p>
                    <p className="text-[10px] text-cyan-300 flex items-center gap-1 mt-1 font-bold">
                      <Wifi className="w-3 h-3" /> Disponible sans connexion
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => playBook(book, 0, 0)}
                      className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-md"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Écouter</span>
                    </button>
                    <button
                      onClick={() => handleClearOffline(book.id)}
                      className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 transition-all border border-rose-500/20 cursor-pointer"
                      title="Supprimer du cache local"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          4. TAB : PRÉFÉRENCES
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'settings' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="card-lg space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Headphones className="w-4 h-4 text-purple-400" /> Lecture & Confort d'Écoute
            </h3>

            {/* Vitesse de lecture */}
            <div className="space-y-2 pt-1 border-t border-white/10">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">Vitesse de lecture par défaut</span>
                <span className="text-purple-300 font-black font-mono">{playbackRate}x</span>
              </div>
              <div className="flex gap-2">
                {[0.75, 1, 1.25, 1.5, 2].map(speed => (
                  <button
                    key={speed}
                    onClick={() => changePlaybackRate(speed)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      playbackRate === speed
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                        : 'bg-white/8 text-slate-400 hover:text-white border border-white/10'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* Minuteur sommeil */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-cyan-400" /> Minuteur de Mise en Veille</span>
                <span className="text-cyan-300 font-black font-mono">{sleepTimerOption === 'off' ? 'Désactivé' : sleepTimerOption}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {['off', '15min', '30min', '45min', '60min', 'chapter'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setSleepTimer(opt)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      sleepTimerOption === opt
                        ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                        : 'bg-white/8 text-slate-400 hover:text-white border border-white/10'
                    }`}
                  >
                    {opt === 'off' ? '✗ Désactivé' : opt === 'chapter' ? 'Fin du Chapitre' : opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* PWA Install */}
          <div className="card-md flex items-center justify-between gap-4 border border-pink-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Installer l'Application RG Play</p>
                <p className="text-[10px] text-slate-400">Accès ultra-rapide et streaming plein écran</p>
              </div>
            </div>
            <button
              onClick={onOpenInstallModal}
              className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold shadow-md cursor-pointer active:scale-95 transition-all"
            >
              Installer
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODALE 1 : RECHARGE PORTEFEUILLE (ORANGE / MTN)
          ══════════════════════════════════════════════════════════════════════ */}
      {isTopUpModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-fadeIn">
          <div className="glass-card rounded-3xl w-full max-w-md border border-emerald-500/30 overflow-hidden shadow-2xl p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-lg ${
                  selectedTopUpMethod === 'orange' ? 'bg-gradient-to-tr from-orange-600 to-amber-500' : 'bg-gradient-to-tr from-yellow-500 to-amber-600'
                }`}>
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white font-['Outfit']">
                    Recharge {selectedTopUpMethod === 'orange' ? 'Orange Money' : 'MTN MoMo'}
                  </h3>
                  <p className="text-xs text-slate-400">Créditez votre portefeuille RG Play</p>
                </div>
              </div>
              <button
                onClick={() => setIsTopUpModalOpen(false)}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Choix du montant prédéfini */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Montant à créditer :</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[1000, 2500, 5000, 10000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTopUpAmount(amt)}
                    className={`py-2 px-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      topUpAmount === amt
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/40 border border-emerald-400'
                        : 'bg-white/6 text-slate-300 hover:bg-white/10 border border-white/8'
                    }`}
                  >
                    {amt.toLocaleString('fr-FR')} F
                  </button>
                ))}
              </div>
            </div>

            {/* Saisie personnalisée */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Ou montant personnalisé (FCFA) :</label>
              <input
                type="number"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(Math.max(100, parseInt(e.target.value) || 0))}
                className="rg-input text-sm w-full font-mono font-bold"
                placeholder="Ex: 5000"
              />
            </div>

            {/* Numéro de téléphone */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Numéro de téléphone {selectedTopUpMethod === 'orange' ? 'Orange' : 'MTN'} :</label>
              <input
                type="tel"
                value={topUpPhone}
                onChange={(e) => setTopUpPhone(e.target.value)}
                className="rg-input text-sm w-full font-mono font-bold"
                placeholder="Ex: 699 00 00 00"
              />
            </div>

            {/* Action */}
            <button
              onClick={handleConfirmTopUp}
              disabled={isProcessingTopUp || !topUpAmount}
              className="w-full btn-gradient py-3.5 rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-xl cursor-pointer disabled:opacity-50"
            >
              {isProcessingTopUp ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Validation du rechargement...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Confirmer la Recharge (+{Number(topUpAmount).toLocaleString()} FCFA)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODALE 2 : ABONNEMENT VIP & PREMIUM
          ══════════════════════════════════════════════════════════════════════ */}
      {isSubModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-fadeIn">
          <div className="glass-card rounded-3xl w-full max-w-md border border-amber-500/30 overflow-hidden shadow-2xl p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 shadow-lg">
                  <Crown className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white font-['Outfit']">
                    Pass Audio Illimité
                  </h3>
                  <p className="text-xs text-slate-400">Accédez à l'écoute intégrale sans limite</p>
                </div>
              </div>
              <button
                onClick={() => setIsSubModalOpen(false)}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Choix de la formule */}
            <div className="grid grid-cols-2 gap-3">
              {['premium', 'vip'].map(planId => {
                const p = PLANS[planId];
                const isSelected = selectedSubPlan === planId;
                return (
                  <div
                    key={planId}
                    onClick={() => setSelectedSubPlan(planId)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/50 shadow-lg shadow-amber-500/10 scale-[1.02]'
                        : 'bg-white/4 border-white/8 hover:bg-white/8 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white font-['Outfit']">{p.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 stroke-[3]" />}
                    </div>
                    <p className="text-sm font-black text-amber-300">{p.price}</p>
                  </div>
                );
              })}
            </div>

            {/* Avantages de la formule sélectionnée */}
            <div className="p-3 rounded-2xl bg-white/4 border border-white/8 space-y-1.5 text-xs text-slate-300">
              {PLANS[selectedSubPlan]?.features.map((feat, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>

            {/* Moyen de paiement */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Moyen de paiement Mobile Money :</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSubMethod('orange')}
                  className={`py-2.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                    subMethod === 'orange' ? 'bg-orange-500/20 border-orange-500 text-orange-300' : 'bg-white/6 border-white/10 text-slate-400'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" /> Orange Money
                </button>
                <button
                  type="button"
                  onClick={() => setSubMethod('mtn')}
                  className={`py-2.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                    subMethod === 'mtn' ? 'bg-yellow-500/20 border-yellow-500 text-yellow-300' : 'bg-white/6 border-white/10 text-slate-400'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" /> MTN MoMo
                </button>
              </div>
            </div>

            {/* Numéro de téléphone */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Numéro de confirmation :</label>
              <input
                type="tel"
                value={subPhone}
                onChange={(e) => setSubPhone(e.target.value)}
                className="rg-input text-sm w-full font-mono font-bold"
                placeholder="Ex: 699 00 00 00"
              />
            </div>

            {/* Validation */}
            <button
              onClick={handleConfirmSubscription}
              disabled={isProcessingSub}
              className="w-full py-3.5 rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                color: '#07041a',
                boxShadow: '0 8px 25px rgba(245, 158, 11, 0.35)'
              }}
            >
              {isProcessingSub ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Activation en cours...</span>
                </>
              ) : (
                <>
                  <Crown className="w-4 h-4 fill-current" />
                  <span>Activer le Pass {PLANS[selectedSubPlan]?.label} ({PLANS[selectedSubPlan]?.price})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Modale d'édition du profil */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onProfileSaved={(updated) => setProfile(updated)}
      />
    </div>
  );
};
