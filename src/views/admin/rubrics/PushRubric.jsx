import React, { useState } from 'react';
import { Bell, Headphones, Send } from 'lucide-react';
import { usePush } from '../../../context/PushContext';

export const PushRubric = () => {
  const { isSupported: pushSupported, permission: pushPermission, isSubscribed, requestPermission, sendTestNotification } = usePush();
  const [pushTitle, setPushTitle] = useState("✨ Nouveauté sur Read's Great !");
  const [pushMessage, setPushMessage] = useState("Un nouveau livre audio vient d'être publié. Écoutez le premier chapitre dès maintenant !");
  const [pushSentSuccess, setPushSentSuccess] = useState(false);

  const handleSendBroadcast = async () => {
    try {
      await fetch('/api/admin/push/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: pushTitle, body: pushMessage, url: '/' }),
      }).catch(() => {});
    } catch (_) {}

    if (isSubscribed) {
      await sendTestNotification({ title: pushTitle, body: pushMessage, url: '/' });
    }
    setPushSentSuccess(true);
    setTimeout(() => setPushSentSuccess(false), 4000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">Campagnes Push Notifications</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Envoyez des alertes instantanées sur smartphone à vos auditeurs</p>
      </div>

      {/* Statut Abonnement Push */}
      <div className="card-md flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            isSubscribed ? 'bg-emerald-500/20 border border-emerald-500/40' : 'bg-white/6 border border-white/10'
          }`}>
            <Bell className={`w-4 h-4 ${isSubscribed ? 'text-emerald-400' : 'text-slate-400'}`} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">
              {isSubscribed ? 'Notifications activées sur cet appareil' : 'Notifications désactivées'}
            </p>
            <p className="text-xs text-slate-400">
              {pushPermission === 'denied'
                ? 'Bloquées par le navigateur — autorisez dans les paramètres'
                : isSubscribed
                  ? 'Vous recevrez les alertes push en temps réel'
                  : 'Activez pour recevoir les tests de push'}
            </p>
          </div>
        </div>
        {!isSubscribed && pushPermission !== 'denied' && pushSupported && (
          <button
            type="button"
            onClick={requestPermission}
            className="rg-btn-primary px-4 py-2 rounded-xl text-xs flex-shrink-0 cursor-pointer"
          >
            Activer
          </button>
        )}
      </div>

      <div className="card-lg space-y-5">
        <div>
          <label className="text-xs font-bold text-slate-300 block mb-1.5">Titre de la Notification</label>
          <input
            type="text"
            value={pushTitle}
            onChange={e => setPushTitle(e.target.value)}
            className="rg-input"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-300 block mb-1.5">Message / Contenu</label>
          <textarea
            rows={3}
            value={pushMessage}
            onChange={e => setPushMessage(e.target.value)}
            className="rg-input resize-none"
          />
        </div>

        {/* Prévisualisation Smartphone */}
        <div className="p-4 rounded-2xl bg-white/4 border border-white/10 space-y-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Aperçu sur Smartphone
          </span>
          <div className="p-3 rounded-xl bg-slate-900 border border-white/10 flex items-start gap-3 shadow-lg max-w-sm">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white flex-shrink-0">
              <Headphones className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{pushTitle}</p>
              <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5">{pushMessage}</p>
            </div>
          </div>
        </div>

        {/* Bouton Test Push */}
        {isSubscribed && (
          <button
            type="button"
            onClick={async () => {
              await sendTestNotification({ title: pushTitle, body: pushMessage, url: '/' });
              setPushSentSuccess(true);
              setTimeout(() => setPushSentSuccess(false), 4000);
            }}
            className="rg-btn-ghost w-full py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
          >
            <Bell className="w-4 h-4 text-purple-400" />
            <span>Tester la notification sur cet appareil</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleSendBroadcast}
          className="btn-gradient w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-xl cursor-pointer"
        >
          <Send className="w-4 h-4" />
          <span>Diffuser à Tous les Abonnés</span>
        </button>

        {pushSentSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold text-center animate-fadeIn">
            ✓ Notification Push diffusée avec succès !
          </div>
        )}
      </div>
    </div>
  );
};
