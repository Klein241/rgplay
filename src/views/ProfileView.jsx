import React, { useState, useEffect } from 'react';
import {
  User, CreditCard, Headphones, Bell, Moon, Shield, LogOut,
  ChevronRight, Smartphone, Clock, Star, Zap, Crown, CheckCircle2,
  Volume2, BookOpen, Wallet, Settings, Edit3, Camera
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';

// ── Profil utilisateur depuis localStorage ────────────────────────────────────
const defaultProfile = {
  name: 'Mon Compte',
  email: 'utilisateur@email.com',
  avatar: null,
  plan: 'free',          // 'free' | 'premium' | 'vip'
  solde: 15000,
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
    features: ['3 livres gratuits par mois', 'Qualité Standard (128kbps)', 'Publicités audio'],
  },
  premium: {
    label: 'Premium',
    color: 'text-purple-300',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/25',
    icon: Star,
    features: ['Livres illimités', 'Haute Qualité (320kbps)', 'Sans publicité', 'Mode hors-ligne'],
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
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(profile.name);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editedEmail, setEditedEmail] = useState(profile.email);

  const avatarInputRef = React.useRef(null);
  const { playbackRate, changePlaybackRate, sleepTimerOption, setSleepTimer } = useAudio();

  const currentPlan = PLANS[profile.plan] || PLANS.free;
  const PlanIcon = currentPlan.icon;

  const updateProfile = (updates) => {
    const next = { ...profile, ...updates };
    setProfile(next);
    saveProfile(next);
  };

  const handleSaveName = () => {
    if (editedName.trim()) updateProfile({ name: editedName.trim() });
    setIsEditingName(false);
  };

  const handleSaveEmail = () => {
    if (editedEmail.trim()) updateProfile({ email: editedEmail.trim() });
    setIsEditingEmail(false);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (dataUrl) updateProfile({ avatar: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="pb-28 md:pb-10 max-w-2xl mx-auto space-y-6 animate-fadeIn">

      {/* ── En-Tête Profil ── */}
      <div className="card-lg space-y-5">
        <div className="flex items-center gap-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <input
              type="file"
              ref={avatarInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            {profile.avatar ? (
              <img src={profile.avatar} alt={profile.name}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-purple-400/30 shadow-lg" />
            ) : (
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-lg"
                style={{ background: 'linear-gradient(135deg, #9d4edd, #f72585)' }}>
                {(profile.name || 'U')[0].toUpperCase()}
              </div>
            )}
            <button
              onClick={() => avatarInputRef.current?.click()}
              title="Changer la photo de profil"
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-purple-600 border-2 border-[#07041A] flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
            >
              <Camera className="w-3 h-3 text-white" />
            </button>
          </div>

          {/* Nom & Plan */}
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  className="rg-input text-base font-bold py-1.5 px-3 rounded-xl"
                  style={{ width: '100%' }}
                />
                <button onClick={handleSaveName} className="rg-btn-primary px-3 py-1.5 rounded-xl text-xs">OK</button>
                <button onClick={() => setIsEditingName(false)} className="rg-btn-ghost px-3 py-1.5 rounded-xl text-xs">✕</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black truncate" style={{ color: 'var(--color-text-primary)' }}>
                  {profile.name}
                </h1>
                <button onClick={() => setIsEditingName(true)} title="Modifier mon nom" className="p-1 rounded-lg text-purple-400 hover:bg-purple-500/15 transition-colors">
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {isEditingEmail ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  autoFocus
                  value={editedEmail}
                  onChange={(e) => setEditedEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveEmail()}
                  className="rg-input text-xs py-1 px-2.5 rounded-lg"
                  style={{ width: '100%' }}
                />
                <button onClick={handleSaveEmail} className="rg-btn-primary px-2.5 py-1 rounded-lg text-[10px]">OK</button>
                <button onClick={() => setIsEditingEmail(false)} className="rg-btn-ghost px-2.5 py-1 rounded-lg text-[10px]">✕</button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>{profile.email}</p>
                <button onClick={() => setIsEditingEmail(true)} title="Modifier mon email" className="p-0.5 rounded text-slate-500 hover:text-slate-300">
                  <Edit3 className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Badge Plan */}
            <div className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-xs font-bold ${currentPlan.bg} ${currentPlan.color} border ${currentPlan.border}`}>
              {PlanIcon && <PlanIcon className="w-3 h-3" />}
              <span>Plan {currentPlan.label}</span>
            </div>
          </div>
        </div>

        {/* Stats Écoute */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          {[
            { label: 'Livres achetés',   value: profile.booksOwned,                         icon: BookOpen, color: 'text-purple-400' },
            { label: 'Heures écoutées',  value: `${profile.hoursListened}h`,                icon: Clock,    color: 'text-cyan-400'   },
            { label: 'Solde',            value: `${(profile.solde || 0).toLocaleString('fr-FR')} FCFA`, icon: Wallet,   color: 'text-emerald-400'},
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card-sm text-center space-y-1">
              <Icon className={`w-4 h-4 mx-auto ${color}`} />
              <p className="text-sm font-black" style={{ color: 'var(--color-text-primary)' }}>{value}</p>
              <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Portefeuille & Recharge ── */}
      <div className="card-lg space-y-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Portefeuille</h2>
        </div>
        <div className="flex items-center justify-between p-4 rounded-2xl"
          style={{ background: 'linear-gradient(135deg, rgba(6,214,160,0.10), rgba(76,201,240,0.08))', border: '1px solid rgba(6,214,160,0.20)' }}>
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>Solde disponible</p>
            <p className="text-2xl font-black text-emerald-400">{(profile.solde || 0).toLocaleString('fr-FR')} <span className="text-sm font-bold">FCFA</span></p>
          </div>
          <button
            onClick={() => {
              const amount = 5000;
              updateProfile({ solde: (profile.solde || 0) + amount });
              alert(`Portefeuille rechargé avec succès de ${amount.toLocaleString('fr-FR')} FCFA !`);
            }}
            className="rg-btn-primary px-4 py-2 rounded-xl text-sm"
          >
            + Recharger (+5 000 F)
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: 'Orange Money', logo: '🟠', amount: 5000 },
            { label: 'MTN MoMo',    logo: '🟡', amount: 5000 },
          ].map(({ label, logo, amount }) => (
            <button
              key={label}
              onClick={() => {
                updateProfile({ solde: (profile.solde || 0) + amount });
                alert(`Recharge de ${amount.toLocaleString('fr-FR')} FCFA via ${label} validée avec succès !`);
              }}
              className="rg-btn-ghost flex items-center gap-2 py-2.5 px-3 rounded-2xl text-sm"
            >
              <span className="text-lg">{logo}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Préférences d'Écoute ── */}
      <div className="card-lg space-y-4">
        <div className="flex items-center gap-2">
          <Headphones className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Préférences d'Écoute</h2>
        </div>

        {/* Vitesse de lecture */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Vitesse par défaut</label>
            <span className="text-sm font-bold text-purple-300">{playbackRate || profile.listeningSpeed}x</span>
          </div>
          <input
            type="range" min="0.5" max="2.0" step="0.25"
            value={playbackRate || profile.listeningSpeed}
            onChange={(e) => {
              const val = Number(e.target.value);
              updateProfile({ listeningSpeed: val });
              changePlaybackRate(val);
            }}
            className="w-full accent-purple-500"
          />
          <div className="flex justify-between text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
            <span>0.5x</span><span>1.0x</span><span>1.5x</span><span>2.0x</span>
          </div>
        </div>

        {/* Minuterie Sommeil */}
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Minuterie Sommeil</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Arrêt automatique après un délai</p>
          </div>
          <select
            value={sleepTimerOption || profile.sleepTimer || 'off'}
            onChange={(e) => {
              const val = e.target.value;
              updateProfile({ sleepTimer: val });
              setSleepTimer(val === 'off' ? null : val);
            }}
            className="rg-input py-1.5 px-3 rounded-xl text-xs w-36 cursor-pointer"
            style={{ background: 'var(--color-depth-3)' }}
          >
            <option value="off">Désactivée</option>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes</option>
            <option value="end_chapter">Fin du chapitre</option>
          </select>
        </div>
      </div>

      {/* ── Plan d'Abonnement ── */}
      <div className="card-lg space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Mon Abonnement</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {['premium', 'vip'].map((planId) => {
            const plan = PLANS[planId];
            const PIcon = plan.icon;
            const isCurrent = profile.plan === planId;
            return (
              <div key={planId} className={`p-4 rounded-2xl border space-y-3 transition-all ${
                isCurrent ? `${plan.bg} ${plan.border}` : 'border-white/8 bg-white/3'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <PIcon className={`w-4 h-4 ${plan.color}`} />
                    <span className={`text-sm font-black ${plan.color}`}>{plan.label}</span>
                  </div>
                  {isCurrent && <span className="rg-badge rg-badge--emerald">Actif</span>}
                </div>
                <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>{plan.price}</p>
                <ul className="space-y-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                      <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-0.5 text-emerald-400" />
                      {f}
                    </li>
                  ))}
                </ul>
                {!isCurrent && (
                  <button
                    onClick={() => {
                      updateProfile({ plan: planId });
                      alert(`Félicitations ! Vous êtes maintenant abonné au Plan ${plan.label}.`);
                    }}
                    className="rg-btn-primary w-full py-2 rounded-xl text-xs"
                  >
                    Passer à {plan.label}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Notifications & Confidentialité ── */}
      <div className="card-lg space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
          <h2 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Paramètres</h2>
        </div>

        {[
          {
            icon: Bell,
            label: 'Notifications Push',
            desc: 'Nouvelles parutions et offres',
            key: 'notifications',
            toggle: true,
          },
          {
            icon: Smartphone,
            label: 'Installer l\'Application',
            desc: 'Accès hors-ligne et icône mobile',
            action: onOpenInstallModal,
          },
        ].map(({ icon: Icon, label, desc, key, toggle, action }) => (
          <div key={label} className="flex items-center justify-between py-0.5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center mt-0.5"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                <Icon className="w-3.5 h-3.5" style={{ color: 'var(--color-text-tertiary)' }} />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>{label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{desc}</p>
              </div>
            </div>
            {toggle ? (
              <button
                onClick={() => updateProfile({ [key]: !profile[key] })}
                className={`rg-toggle ${profile[key] ? 'rg-toggle--on' : ''}`}
              >
                <span className="rg-toggle__thumb" />
              </button>
            ) : (
              <button onClick={action} className="p-1.5 rounded-lg" style={{ color: 'var(--color-text-tertiary)' }}>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ── Compte & Déconnexion ── */}
      <div className="card-lg space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
          <h2 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Compte & Confidentialité</h2>
        </div>
        {[
          { label: 'Politique de confidentialité', action: null },
          { label: 'Conditions générales d\'utilisation', action: null },
        ].map(({ label }) => (
          <button key={label} className="w-full flex items-center justify-between py-2.5 text-sm transition-colors text-left"
            style={{ color: 'var(--color-text-secondary)' }}>
            {label}
            <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
          </button>
        ))}

        <div className="pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <button
            className="w-full flex items-center gap-2 py-2.5 text-sm font-bold text-rose-400 hover:text-rose-300 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </div>
    </div>
  );
};
