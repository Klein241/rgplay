import React, { useState } from 'react';
import { Smartphone, ShieldCheck, CheckCircle2, Sparkles } from 'lucide-react';
import { WhatsAppRecoveryModal } from './WhatsAppRecoveryModal';

export const WhatsAppProfileCard = ({ profile, points = 1000, onProfileUpdate }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('link'); // 'link' | 'recover'

  const hasWhatsApp = Boolean(profile?.phone && profile?.phone.trim());

  return (
    <>
      <div className="p-3.5 rounded-2xl bg-linear-to-r from-emerald-950/40 via-teal-950/20 to-purple-950/30 border border-emerald-500/25 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0 shadow-sm">
            <Smartphone size={18} />
          </div>
          <div className="min-w-0">
            {hasWhatsApp ? (
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                  <span>Compte lié à WhatsApp</span>
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                </p>
                <p className="text-[11px] font-mono text-emerald-300 truncate">{profile.phone}</p>
              </div>
            ) : (
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Sécurisez vos {points} Sky Points</span>
                  <Sparkles size={13} className="text-amber-400 shrink-0" />
                </p>
                <p className="text-[11px] text-slate-300 leading-tight">
                  Liez votre WhatsApp pour retrouver vos points en cas de changement de smartphone.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setModalMode('link');
              setIsModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
          >
            {hasWhatsApp ? 'Modifier' : 'Sécuriser'}
          </button>
          <button
            type="button"
            onClick={() => {
              setModalMode('recover');
              setIsModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            title="Récupérer sur un autre appareil"
          >
            Restaurer
          </button>
        </div>
      </div>

      <WhatsAppRecoveryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialMode={modalMode}
        currentPoints={points}
        onAccountRestored={(res) => {
          if (onProfileUpdate && res?.user) onProfileUpdate(res.user);
        }}
      />
    </>
  );
};
