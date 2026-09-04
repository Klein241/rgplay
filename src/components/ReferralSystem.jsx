import React, { useState, useEffect, useCallback } from 'react';
import {
  Gift, Copy, Check, Share2, Users, Wallet, ChevronRight,
  X, Zap, Star, Phone, TrendingUp
} from 'lucide-react';
import { getUserReferralCode } from '../utils/userId';
import { apiClient } from '../services/api';

const STORAGE_KEY = 'rg_referral';

const getReferralData = (profile = {}) => {
  const code = getUserReferralCode();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.code && parsed.code === code) return parsed;
    }
  } catch {}
  const data = { code, referrals: [], creditsEarned: 0, pendingCredits: 0 };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
};

// ── Composant Partage rapide (pour mettre dans le profil) ──
export const ReferralCard = ({ profile }) => {
  const [data, setData] = useState(() => getReferralData(profile));
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (data.code) {
      apiClient.getReferralStats(data.code).then(res => {
        if (res?.stats) {
          setData(prev => {
            const updated = {
              ...prev,
              referrals: res.stats.referrals || prev.referrals,
              creditsEarned: res.stats.creditsEarned ?? prev.creditsEarned,
              pendingCredits: res.stats.pendingCredits ?? prev.pendingCredits,
            };
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch (_) {}
            return updated;
          });
        }
      }).catch(() => {});
    }
  }, [data.code]);

  const referralLink = `https://rg-play.pages.dev?ref=${data.code}`;

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }, [referralLink]);

  const shareWhatsApp = () => {
    const text = encodeURIComponent(
      `🎧 Rejoins-moi sur *RG Play* — la bibliothèque audio premium d'Afrique !\n\n` +
      `📚 Livres audio, Masterclasses & Podcasts en français\n` +
      `🎁 Utilise mon code *${data.code}* pour obtenir -10% sur ton premier achat.\n\n` +
      `👉 ${referralLink}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <>
      {/* Carte compacte dans le profil */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-full p-4 rounded-2xl text-left transition-all active:scale-[0.99] hover:opacity-90"
        style={{
          background: 'linear-gradient(135deg, rgba(251,146,60,0.12) 0%, rgba(245,158,11,0.08) 100%)',
          border: '1px solid rgba(251,146,60,0.30)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(251,146,60,0.20)', border: '1px solid rgba(251,146,60,0.30)' }}
            >
              <Gift className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Parrainage & Récompenses</p>
              <p className="text-[11px] text-slate-400">
                {data.referrals.length > 0
                  ? `${data.referrals.length} ami(s) parrainé(s) · ${data.creditsEarned} FCFA gagnés`
                  : 'Gagnez 20% sur chaque achat de vos filleuls'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>
      </button>

      {/* Modal complet */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
          onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #0f0a1e 0%, #1a1033 100%)',
              border: '1px solid rgba(251,146,60,0.25)',
              boxShadow: '0 40px 80px rgba(0,0,0,0.70)',
            }}
          >
            {/* Header doré */}
            <div
              className="p-6 relative"
              style={{ background: 'linear-gradient(135deg, rgba(251,146,60,0.20) 0%, rgba(245,158,11,0.12) 100%)' }}
            >
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', boxShadow: '0 8px 24px rgba(245,158,11,0.40)' }}
                >
                  <Gift className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">Programme Parrainage</h2>
                  <p className="text-xs text-amber-300">Gagnez de l'argent en invitant vos amis</p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Filleuls', value: data.referrals.length, icon: Users, color: 'text-blue-400' },
                  { label: 'Gagnés (FCFA)', value: data.creditsEarned, icon: Wallet, color: 'text-emerald-400' },
                  { label: 'En attente', value: data.pendingCredits, icon: TrendingUp, color: 'text-amber-400' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="p-3 rounded-2xl text-center"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}
                  >
                    <stat.icon className={`w-4 h-4 mx-auto mb-1 ${stat.color}`} />
                    <p className="text-lg font-black text-white tabular-nums">{stat.value}</p>
                    <p className="text-[9px] text-slate-400 font-bold">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Comment ça marche */}
              <div className="space-y-2">
                {[
                  { step: '1', text: 'Partagez votre lien personnel à vos amis et contacts', icon: Share2 },
                  { step: '2', text: 'Votre ami s\'inscrit et bénéficie de -10% sur son premier achat', icon: Zap },
                  { step: '3', text: 'Vous gagnez 20% du montant dépensé en crédits RG Play', icon: Wallet },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3">
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}
                    >
                      {item.step}
                    </div>
                    <p className="text-xs text-slate-300 pt-0.5 leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>

              {/* Ton code */}
              <div
                className="p-4 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Ton code personnel</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-2xl font-black tracking-widest text-amber-300 font-mono">{data.code}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">{referralLink}</p>
                  </div>
                  <button
                    onClick={copyLink}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-all"
                    style={{ background: copied ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.10)', border: copied ? '1px solid rgba(34,197,94,0.40)' : '1px solid rgba(255,255,255,0.15)' }}
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copié !' : 'Copier'}
                  </button>
                </div>
              </div>

              {/* Boutons de partage */}
              <button
                onClick={shareWhatsApp}
                className="w-full py-3.5 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #25d366, #128c7e)',
                  boxShadow: '0 8px 24px rgba(37,211,102,0.35)',
                }}
              >
                <span className="text-lg">📲</span>
                Partager sur WhatsApp
              </button>

              <button
                onClick={copyLink}
                className="w-full py-3 rounded-2xl font-bold text-sm text-slate-300 border border-white/10 flex items-center justify-center gap-2 hover:bg-white/5 transition-all"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Lien copié !' : 'Copier le lien'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
