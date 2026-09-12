import React, { useState } from 'react';
import {
  Smartphone, ShieldCheck, Sparkles, Check, X, ArrowRight,
  Loader2, RefreshCw, AlertCircle, Phone
} from 'lucide-react';
import { apiClient } from '../services/api';

const COUNTRY_CODES = [
  { code: '+241', flag: '🇬🇦', name: 'Gabon' },
  { code: '+237', flag: '🇨🇲', name: 'Cameroun' },
  { code: '+242', flag: '🇨🇬', name: 'Congo' },
  { code: '+243', flag: '🇨🇩', name: 'RDC' },
  { code: '+225', flag: '🇨🇮', name: 'Côte d’Ivoire' },
  { code: '+221', flag: '🇸🇳', name: 'Sénégal' },
  { code: '+33', flag: '🇫🇷', name: 'France' },
];

export const WhatsAppRecoveryModal = ({
  isOpen,
  onClose,
  initialMode = 'link', // 'link' | 'recover'
  currentPoints = 1000,
  onAccountRestored,
}) => {
  const [mode, setMode] = useState(initialMode); // 'link' | 'recover'
  const [countryCode, setCountryCode] = useState('+241');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const getFullPhone = () => {
    let clean = phone.replace(/\s+/g, '').replace(/^[0]/, '');
    return `${countryCode}${clean}`;
  };

  const handleLink = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const fullPhone = getFullPhone();
    if (!phone || phone.length < 6) {
      setErrorMsg('Veuillez entrer un numéro de téléphone valide');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient.linkWhatsApp(fullPhone, name);
      if (res && res.success) {
        setSuccessMsg('✓ Compte sécurisé avec succès ! Vos Sky Points sont protégés.');
        // Sauvegarder dans le profil local
        try {
          const profile = JSON.parse(localStorage.getItem('rg_user_profile') || '{}');
          profile.phone = fullPhone;
          if (name.trim()) profile.name = name.trim();
          profile.is_whatsapp_linked = true;
          localStorage.setItem('rg_user_profile', JSON.stringify(profile));
          window.dispatchEvent(new CustomEvent('rg:user-updated', { detail: profile }));
        } catch (_) {}

        setTimeout(() => {
          setIsLoading(false);
          setSuccessMsg('');
          onClose();
        }, 1600);
      } else {
        setErrorMsg(res?.error || 'Erreur lors de la liaison.');
        setIsLoading(false);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Erreur réseau');
      setIsLoading(false);
    }
  };

  const handleRecover = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const fullPhone = getFullPhone();
    if (!phone || phone.length < 6) {
      setErrorMsg('Veuillez entrer un numéro de téléphone valide');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient.recoverWhatsApp(fullPhone);
      if (res && res.success) {
        setSuccessMsg(res.message || '✓ Compte restauré avec succès !');

        // Restaurer l'identifiant et le profil
        if (res.user?.id) {
          localStorage.setItem('rg_user_id', res.user.id);
        }
        if (res.user) {
          localStorage.setItem('rg_user_profile', JSON.stringify({
            ...res.user,
            is_whatsapp_linked: true,
          }));
        }
        // Restaurer les Sky Points & gamification
        if (res.gamification) {
          localStorage.setItem('rg_gamification_state', JSON.stringify(res.gamification));
        }
        // Restaurer les livres débloqués
        if (res.unlockedBookIds && Array.isArray(res.unlockedBookIds)) {
          localStorage.setItem('rg_user_library', JSON.stringify(res.unlockedBookIds));
        }

        window.dispatchEvent(new CustomEvent('rg:user-updated', { detail: res.user }));
        window.dispatchEvent(new CustomEvent('rg:library-updated'));

        if (onAccountRestored) onAccountRestored(res);

        setTimeout(() => {
          setIsLoading(false);
          setSuccessMsg('');
          onClose();
          window.location.reload(); // Rafraîchir pour appliquer le nouveau solde et les signets
        }, 1500);
      } else {
        setErrorMsg(res?.error || 'Aucun compte trouvé avec ce numéro.');
        setIsLoading(false);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Erreur réseau');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-55 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="glass-card rounded-3xl w-full max-w-md border border-purple-500/30 shadow-2xl bg-slate-950/95 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* En-tête avec onglets */}
        <div className="p-5 border-b border-white/10 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
              <Smartphone size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Sécurisation WhatsApp
                <ShieldCheck size={16} className="text-emerald-400" />
              </h3>
              <p className="text-slate-400 text-xs">Sans mot de passe • Récupération en 1 clic</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 mt-4 p-1 bg-white/5 rounded-2xl border border-white/10">
            <button
              type="button"
              onClick={() => { setMode('link'); setErrorMsg(''); setSuccessMsg(''); }}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all ${
                mode === 'link'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sauvegarder mes points
            </button>
            <button
              type="button"
              onClick={() => { setMode('recover'); setErrorMsg(''); setSuccessMsg(''); }}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all ${
                mode === 'recover'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Récupérer mon compte
            </button>
          </div>
        </div>

        {/* Formulaire */}
        <form onSubmit={mode === 'link' ? handleLink : handleRecover} className="p-5 space-y-4 overflow-y-auto">
          
          {mode === 'link' ? (
            <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/20 space-y-1">
              <p className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-400" />
                Protégez vos {currentPoints} Sky Points
              </p>
              <p className="text-2xs text-slate-300 leading-relaxed">
                Si vous changez de smartphone ou réinstallez la PWA, votre numéro WhatsApp vous permettra de récupérer immédiatement tout votre solde et vos livres audio sans mot de passe.
              </p>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-purple-950/30 border border-purple-500/20 space-y-1">
              <p className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                <RefreshCw size={14} className="text-cyan-400" />
                Vous changez de smartphone ?
              </p>
              <p className="text-2xs text-slate-300 leading-relaxed">
                Entrez votre numéro WhatsApp pour restaurer votre profil, vos Sky Points, vos badges et votre bibliothèque sur ce téléphone.
              </p>
            </div>
          )}

          {mode === 'link' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Votre Nom ou Pseudo (optionnel)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Alain B."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Numéro WhatsApp <span className="text-emerald-400">*</span>
            </label>
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-2.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 shrink-0 font-mono"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code} className="bg-slate-900 text-white">
                    {c.flag} {c.code} ({c.name})
                  </option>
                ))}
              </select>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="074 00 00 00"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 font-mono tracking-wider"
              />
            </div>
            <p className="text-2xs text-slate-400 mt-1">Exemple Gabon : 074 12 34 56 ou 74 12 34 56</p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <Check size={14} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg ${
                mode === 'link'
                  ? 'bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/20'
                  : 'bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-500/20'
              } disabled:opacity-50`}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Traitement en cours...</span>
                </>
              ) : mode === 'link' ? (
                <>
                  <ShieldCheck size={16} />
                  <span>Sauvegarder mes points avec WhatsApp</span>
                </>
              ) : (
                <>
                  <RefreshCw size={16} />
                  <span>Restaurer mon compte</span>
                </>
              )}
            </button>
          </div>

          <p className="text-center text-2xs text-slate-400">
            🔒 Vos données sont chiffrées et confidentielles. Zéro spam garanti.
          </p>
        </form>
      </div>
    </div>
  );
};
