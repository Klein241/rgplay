import React, { useState, useEffect } from 'react';
import {
  User, CreditCard, Headphones, Bell, Moon, Shield, LogOut,
  ChevronRight, Smartphone, Clock, Star, Zap, Crown, CheckCircle2,
  Volume2, BookOpen, Wallet, Settings, Edit3, Camera, Sparkles, Phone, Mail, Heart
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { UserProfileModal } from '../components/UserProfileModal';

// ── Profil utilisateur depuis localStorage ────────────────────────────────────
const defaultProfile = {
  name: 'Invité RG Play',
  email: 'invité@rgplay.com',
  phone: '',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80',
  favoriteGenre: '📚 Développement Personnel',
  plan: 'free',
  solde: 15000,
  is_registered: false,
  booksOwned: 2,
  hoursListened: 12.5,
  listeningSpeed: 1.0,
  sleepTimer: 'off',
  notifications: true,
};

const getProfile = () => {
  try {
    const stored = localStorage.getItem('rg_user_profile');
    if (stored) return { ...defaultProfile, ...JSON.parse(stored) };
  } catch {}
  return defaultProfile;
};

const saveProfile = (data) => {
  try { localStorage.setItem('rg_user_profile', JSON.stringify(data)); } catch {}
};

const PLANS = {
  free: {
    label: 'Gratuit',
    color: 'text-slate-300',
    bg: 'bg-white/8',
    border: 'border-white/10',
    features: ['3 titres gratuits par mois', 'Qualité Standard (128kbps)', 'Accès aux extraits'],
  },
  premium: {
    label: 'Premium',
    color: 'text-purple-300',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/25',
    icon: Star,
    features: ['Titres illimités', 'Haute Qualité (320kbps)', 'Sans publicité', 'Mode hors-ligne'],
    price: '3 500 FCFA/mois',
  },
  vip: {
    label: 'VIP Audio',
    color: 'text-amber-300',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
    icon: Crown,
    features: ['Tout Premium +', 'Accès anticipé', 'Téléchargement illimité', 'Support prioritaire'],
    price: '6 500 FCFA/mois',
  },
};

export const ProfileView = ({ onOpenAdmin, onOpenInstallModal }) => {
  const [profile, setProfile] = useState(getProfile());
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const { playbackRate, changePlaybackRate, sleepTimerOption, setSleepTimer } = useAudio();

  useEffect(() => {
    const handleUpdate = (e) => {
      if (e.detail) setProfile(e.detail);
      else setProfile(getProfile());
    };
    window.addEventListener('rg:user-updated', handleUpdate);
    return () => window.removeEventListener('rg:user-updated', handleUpdate);
  }, []);

  const currentPlan = PLANS[profile.plan] || PLANS.free;

  return (
    <div className="pb-28 md:pb-10 max-w-2xl mx-auto space-y-6 animate-fadeIn">

      {/* ── En-Tête Profil & Bouton Créer / Modifier ── */}
      <div className="card-lg space-y-5 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

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
              title="Modifier mon profil"
              className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 border-2 border-[#07041A] flex items-center justify-center shadow-lg hover:scale-110 transition-transform text-white"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Nom, Contact & Statut */}
          <div className="flex-1 text-center sm:text-left min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl font-black text-white font-['Outfit']">
                {profile.name}
              </h2>
              {profile.is_registered ? (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-extrabold flex items-center gap-1">
                  <CheckCircle2 size={11} /> Profil vérifié
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-extrabold flex items-center gap-1">
                  Invité
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-slate-400">
              {profile.phone && (
                <span className="flex items-center gap-1 text-slate-300">
                  <Phone size={12} className="text-purple-400" /> {profile.phone}
                </span>
              )}
              {profile.email && (
                <span className="flex items-center gap-1 text-slate-400">
                  <Mail size={12} className="text-purple-400" /> {profile.email}
                </span>
              )}
            </div>

            {profile.favoriteGenre && (
              <p className="text-xs text-purple-300 font-medium pt-1">
                ⭐ Préférence : <span className="text-white font-bold">{profile.favoriteGenre}</span>
              </p>
            )}

            <div className="pt-2">
              <button
                onClick={() => setIsProfileModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold shadow-md shadow-purple-600/20 flex items-center gap-1.5 transition-all mx-auto sm:mx-0 active:scale-95"
              >
                <Edit3 size={13} />
                {profile.is_registered ? 'Modifier mon profil' : '✨ Créer mon profil complet'}
              </button>
            </div>
          </div>
        </div>

        {/* Statistiques Rapides */}
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10 text-center">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
            <span className="text-[11px] text-slate-400 block">Titres Débloqués</span>
            <span className="text-base font-black text-white">{profile.booksOwned || 2}</span>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
            <span className="text-[11px] text-slate-400 block">Temps d'Écoute</span>
            <span className="text-base font-black text-purple-300">{profile.hoursListened || 12.5}h</span>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
            <span className="text-[11px] text-slate-400 block">Solde MoMo</span>
            <span className="text-base font-black text-emerald-400">{(profile.solde || 15000).toLocaleString('fr-FR')} F</span>
          </div>
        </div>
      </div>

      {/* ── Abonnement & Plans ── */}
      <div className="card-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-400" />
            Mon Abonnement
          </h3>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${currentPlan.bg} ${currentPlan.color} border ${currentPlan.border}`}>
            {currentPlan.label}
          </span>
        </div>

        <ul className="space-y-2">
          {currentPlan.features.map((feat, idx) => (
            <li key={idx} className="flex items-center gap-2 text-xs text-slate-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>{feat}</span>
            </li>
          ))}
        </ul>

        <div className="pt-2">
          <button
            onClick={() => alert('Option d\'abonnement VIP illimité activée !')}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 hover:scale-[1.01] active:scale-98 transition-all"
          >
            ⭐ Passer en VIP Illimité (6 500 FCFA/mois)
          </button>
        </div>
      </div>

      {/* ── Préférences & Raccourcis ── */}
      <div className="card-lg space-y-3">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">
          Préférences du Lecteur
        </h3>

        <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5">
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold text-white">Vitesse d'écoute par défaut</span>
          </div>
          <span className="text-xs font-bold text-purple-300 px-2.5 py-1 rounded-lg bg-purple-500/10">
            {playbackRate}x
          </span>
        </div>

        <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5">
          <div className="flex items-center gap-3">
            <Smartphone className="w-4 h-4 text-pink-400" />
            <span className="text-xs font-semibold text-white">Installer l'Application PWA</span>
          </div>
          <button
            onClick={onOpenInstallModal}
            className="text-xs font-bold text-pink-300 hover:text-pink-200 underline"
          >
            Installer
          </button>
        </div>
      </div>

      {/* ── Accès Back-Office Admin ── */}
      <div className="card-lg border border-emerald-500/20 bg-emerald-950/20 flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-emerald-400" />
          <div>
            <p className="text-xs font-bold text-white">Administration RG Play</p>
            <p className="text-[11px] text-slate-400">Gérer le catalogue, publications & statistiques</p>
          </div>
        </div>
        <button
          onClick={onOpenAdmin}
          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/30 flex items-center gap-1"
        >
          <span>Studio Admin</span>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Modale de création / édition de profil */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onProfileSaved={(updated) => setProfile(updated)}
      />

    </div>
  );
};
