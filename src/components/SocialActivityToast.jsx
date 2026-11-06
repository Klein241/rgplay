import React, { useState, useEffect, useRef } from 'react';
import { Headphones, Download, Star, Sparkles, X, ChevronRight } from 'lucide-react';
import { apiClient } from '../services/api';
import { usePush } from '../context/PushContext';

/**
 * SocialActivityToast — Capsules de Preuve Sociale en Temps Réel RG Play
 * ─────────────────────────────────────────────────────────────────────────────
 * Affiche en direct les actions des autres utilisateurs (écoutes, téléchargements,
 * avis, déblocages) pour créer un effet de communauté dynamique et crédible.
 */

// Événements d'amorçage crédibles au Gabon & Afrique centrale
const SEED_ACTIVITIES = [
  { action_type: 'listen', user_name: 'Christian', city: 'Libreville', book_title: 'Bonjour Saint-Esprit', message: 'Christian à Libreville écoute "Bonjour Saint-Esprit"' },
  { action_type: 'download', user_name: 'Un membre', city: 'Port-Gentil', book_title: 'La Puissance de la Prière', message: '"La Puissance de la Prière" téléchargé pour une écoute hors-ligne à Port-Gentil' },
  { action_type: 'review', user_name: 'Esther M.', city: 'Franceville', book_title: 'L\'Art de la Guerre', message: 'Esther M. a attribué 5 étoiles à "L\'Art de la Guerre"' },
  { action_type: 'listen', user_name: 'Patrick', city: 'Oyem', book_title: 'Père Riche Père Pauvre', message: 'Patrick à Oyem a démarré l\'écoute de "Père Riche Père Pauvre"' },
  { action_type: 'unlock', user_name: 'Un auditeur', city: 'Libreville', book_title: 'Les Secrets de la Réussite', message: 'Un auditeur à Libreville a débloqué "Les Secrets de la Réussite"' },
];

export const SocialActivityToast = () => {
  const { sendLocalNotification } = usePush();
  const [currentActivity, setCurrentActivity] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const activitiesQueueRef = useRef([]);
  const lastActivityIndexRef = useRef(0);

  // 1. Récupération des activités réelles du serveur + fallback
  useEffect(() => {
    let isMounted = true;

    const loadFeed = async () => {
      try {
        const feed = await apiClient.getSocialFeed();
        if (isMounted) {
          if (Array.isArray(feed) && feed.length > 0) {
            activitiesQueueRef.current = feed;
          } else {
            activitiesQueueRef.current = SEED_ACTIVITIES;
          }
        }
      } catch (_) {
        if (isMounted) activitiesQueueRef.current = SEED_ACTIVITIES;
      }
    };

    loadFeed();
    const refreshTimer = setInterval(loadFeed, 60000); // Rafraîchit toutes les 60s

    return () => {
      isMounted = false;
      clearInterval(refreshTimer);
    };
  }, []);

  // 2. Écoute locale immédiate (si l'utilisateur courant fait une action)
  useEffect(() => {
    const onLocalActivity = (e) => {
      const act = e.detail;
      if (act) {
        const fullAct = {
          action_type: act.action_type || 'listen',
          user_name: act.user_name || 'Vous',
          city: 'En direct',
          book_title: act.book_title || 'Livre Audio',
          book_id: act.book_id || null,
          message: act.action_type === 'listen' 
            ? `Écoute lancée : "${act.book_title}"`
            : act.action_type === 'download'
              ? `Téléchargé avec succès : "${act.book_title}"`
              : `Avis publié sur "${act.book_title}"`,
        };
        activitiesQueueRef.current.unshift(fullAct);
        triggerToast(fullAct);
      }
    };

    window.addEventListener('rg_local_social_activity', onLocalActivity);
    return () => window.removeEventListener('rg_local_social_activity', onLocalActivity);
  }, []);

  // 3. Déclencheur régulier d'animation de toast (toutes les 18 à 28 secondes)
  useEffect(() => {
    const cycleToast = () => {
      const queue = activitiesQueueRef.current;
      if (queue.length === 0) return;

      const act = queue[lastActivityIndexRef.current % queue.length];
      lastActivityIndexRef.current = (lastActivityIndexRef.current + 1) % queue.length;
      triggerToast(act);
    };

    // Premier toast après 6 secondes
    const firstTimer = setTimeout(cycleToast, 6000);
    // Puis intervalle régulier
    const loopTimer = setInterval(cycleToast, 22000);

    return () => {
      clearTimeout(firstTimer);
      clearInterval(loopTimer);
    };
  }, []);

  const triggerToast = (act) => {
    if (!act) return;
    setCurrentActivity(act);
    setIsVisible(true);

    // Auto-masquage après 6.5 secondes
    setTimeout(() => {
      setIsVisible(false);
    }, 6500);
  };

  if (!isVisible || !currentActivity) return null;

  const isListen = currentActivity.action_type === 'listen';
  const isDownload = currentActivity.action_type === 'download';
  const isReview = currentActivity.action_type === 'review';

  return (
    <aside 
      aria-label="Notification d'activité sociale en direct"
      className="fixed bottom-24 sm:bottom-28 left-4 right-4 sm:right-auto sm:max-w-sm z-40 animate-slideUp pointer-events-auto"
    >
      <div className="rounded-2xl p-3.5 sm:p-4 bg-linear-to-r from-[#17092c]/95 via-[#130626]/95 to-[#0b0317]/95 border border-purple-500/40 shadow-[0_10px_35px_rgba(0,0,0,0.8),0_0_25px_rgba(168,85,247,0.3)] backdrop-blur-xl flex items-center gap-3 relative overflow-hidden">
        {/* Lueur d'ambiance */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/15 rounded-full blur-xl pointer-events-none" />

        {/* Icône animée */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white shadow-md ${
          isDownload
            ? 'bg-linear-to-tr from-emerald-600 to-teal-500 shadow-emerald-500/30'
            : isReview
              ? 'bg-linear-to-tr from-amber-500 to-orange-500 shadow-amber-500/30'
              : 'bg-linear-to-tr from-purple-600 to-pink-500 shadow-purple-500/30'
        }`}>
          {isDownload ? (
            <Download size={18} className="animate-pulse" />
          ) : isReview ? (
            <Star size={18} className="fill-white" />
          ) : (
            <Headphones size={18} className="animate-pulse" />
          )}
        </div>

        {/* Contenu textuel */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-black tracking-wider uppercase text-purple-300">
              {isDownload ? 'Téléchargement' : isReview ? 'Nouvel Avis' : 'Écoute en cours'}
            </span>
            <span className="text-[10px] text-slate-400">• À l'instant</span>
          </div>

          <p className="text-xs font-semibold text-white truncate mt-0.5">
            {currentActivity.book_title}
          </p>
          <p className="text-[11px] text-slate-300 truncate">
            {currentActivity.message || `${currentActivity.user_name} à ${currentActivity.city}`}
          </p>
        </div>

        {/* Bouton fermeture */}
        <button
          onClick={() => setIsVisible(false)}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 shrink-0 cursor-pointer"
          title="Fermer"
        >
          <X size={14} />
        </button>
      </div>
    </aside>
  );
};
