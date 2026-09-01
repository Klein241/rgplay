import React, { useState, useEffect, useRef } from 'react';
import {
  User, Mail, Phone, Sparkles, Check, X, Camera,
  Heart, ShieldCheck, Crown, Smartphone, Headphones
} from 'lucide-react';

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80',
];

const FAVORITE_GENRES = [
  '📚 Développement Personnel',
  '💼 Business & Stratégie',
  '🎙️ Podcasts & Tech',
  '🎵 Musique Focus & Lofi',
  '🎓 Masterclasses & IA',
  '🧠 Psychologie & Mental',
];

export const UserProfileModal = ({ isOpen, onClose, onProfileSaved }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState(AVATAR_PRESETS[0]);
  const [favoriteGenre, setFavoriteGenre] = useState(FAVORITE_GENRES[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  const fileInputRef = useRef(null);

  // Charger profil existant à l'ouverture
  useEffect(() => {
    if (isOpen) {
      try {
        const stored = localStorage.getItem('rg_user_profile');
        if (stored) {
          const p = JSON.parse(stored);
          setName(p.name && p.name !== 'Mon Compte' ? p.name : '');
          setEmail(p.email && p.email !== 'utilisateur@email.com' ? p.email : '');
          setPhone(p.phone || '');
          setAvatar(p.avatar || AVATAR_PRESETS[0]);
          setFavoriteGenre(p.favoriteGenre || FAVORITE_GENRES[0]);
        }
      } catch (_) {}
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCustomAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setAvatar(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    const updatedProfile = {
      name: name.trim(),
      email: email.trim() || `${name.toLowerCase().replace(/\s+/g, '')}@rgplay.com`,
      phone: phone.trim(),
      avatar,
      favoriteGenre,
      is_registered: true,
      registeredAt: Date.now(),
      plan: 'free',
    };

    try {
      localStorage.setItem('rg_user_profile', JSON.stringify(updatedProfile));
      localStorage.setItem('rg_user_registered', 'true');
      window.dispatchEvent(new CustomEvent('rg:user-updated', { detail: updatedProfile }));
    } catch (_) {}

    setSuccessMsg(true);
    setTimeout(() => {
      setIsSaving(false);
      setSuccessMsg(false);
      if (onProfileSaved) onProfileSaved(updatedProfile);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-55 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="glass-card rounded-3xl w-full max-w-lg border border-purple-500/30 shadow-2xl bg-slate-950/95 flex flex-col max-h-[90vh] overflow-hidden">

        {/* En-tête */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
              <User size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Créer ou Modifier mon Profil
                <Sparkles size={16} className="text-amber-400" />
              </h3>
              <p className="text-slate-400 text-xs">Accédez à vos playlists et recommandations personnalisées</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulaire défilant */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-5">
          {successMsg && (
            <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <Check size={16} />
              <span>✓ Profil enregistré avec succès !</span>
            </div>
          )}

          {/* Choix Avatar */}
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-2">Photo de profil / Avatar</label>
            <div className="flex items-center gap-4 mb-3">
              <div className="relative">
                <img
                  src={avatar}
                  alt="Avatar sélectionné"
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-purple-500 shadow-lg shadow-purple-500/30"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                  title="Importer ma propre photo"
                >
                  <Camera size={12} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCustomAvatar}
                  className="hidden"
                />
              </div>

              <div>
                <p className="text-xs font-bold text-white">Choisissez parmi nos avatars</p>
                <p className="text-[11px] text-slate-400 mt-0.5">ou cliquez sur l'appareil photo pour importer</p>
              </div>
            </div>

            {/* Grille presets */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {AVATAR_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setAvatar(p)}
                  className={`w-11 h-11 rounded-xl overflow-hidden border-2 transition-all ${
                    avatar === p ? 'border-purple-400 scale-105 shadow-md shadow-purple-500/40' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={p} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Champs d'informations */}
          <div className="space-y-3.5">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                Nom complet ou Pseudo *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex : Samuel Eto'o, Clara D."
                  className="rg-input pl-10 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                Numéro Mobile Money (MTN / Orange)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex : 699123456"
                  className="rg-input pl-10 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                Adresse Email (optionnel)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre.email@exemple.com"
                  className="rg-input pl-10 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                Genre ou Contenu Favori
              </label>
              <select
                value={favoriteGenre}
                onChange={(e) => setFavoriteGenre(e.target.value)}
                className="rg-input text-sm cursor-pointer"
                style={{ background: '#16112e' }}
              >
                {FAVORITE_GENRES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-bold shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-50"
            >
              {isSaving ? 'Enregistrement...' : '✨ Enregistrer & Débloquer mon profil'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
