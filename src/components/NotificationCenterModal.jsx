import React from 'react';
import {
  Bell, X, Check, Trash2, Headphones,
  Sparkles, Radio, Music, GraduationCap, Clock, ExternalLink
} from 'lucide-react';
import { usePush } from '../context/PushContext';

export const NotificationCenterModal = ({ isOpen, onClose, onNavigateContent }) => {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAllNotifications,
    permission,
    requestPermission
  } = usePush();

  if (!isOpen) return null;

  const getTypeIcon = (type) => {
    switch (type) {
      case 'podcast':
        return <Radio size={16} className="text-amber-400" />;
      case 'music':
        return <Music size={16} className="text-emerald-400" />;
      case 'masterclass':
        return <GraduationCap size={16} className="text-cyan-400" />;
      case 'audiobook':
        return <Headphones size={16} className="text-purple-400" />;
      default:
        return <Sparkles size={16} className="text-pink-400" />;
    }
  };

  const handleItemClick = (notif) => {
    markAsRead(notif.id);
    if (notif.url && onNavigateContent) {
      onNavigateContent(notif.url);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-55 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="glass-card rounded-3xl w-full max-w-lg border border-purple-500/30 shadow-2xl bg-slate-950/95 flex flex-col max-h-[85vh] overflow-hidden">

        {/* En-tête */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Bell size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Centre de Notifications
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-purple-600 text-white">
                    {unreadCount}
                  </span>
                )}
              </h3>
              <p className="text-slate-400 text-xs">Vos alertes nouveautés et reprises d'écoute</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors text-xs font-medium flex items-center gap-1"
                title="Tout marquer comme lu"
              >
                <Check size={14} />
                <span className="hidden sm:inline">Tout lire</span>
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={clearAllNotifications}
                className="p-2 text-slate-500 hover:text-red-400 rounded-xl hover:bg-white/5 transition-colors"
                title="Tout effacer"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Statut permission push si non accordée */}
        {permission !== 'granted' && (
          <div className="p-3 mx-4 mt-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Bell size={16} className="text-purple-400 flex-shrink-0" />
              <p className="text-xs text-slate-300">
                Activez les notifications pour recevoir les alertes sur votre écran.
              </p>
            </div>
            <button
              onClick={requestPermission}
              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold whitespace-nowrap transition-colors"
            >
              Activer
            </button>
          </div>
        )}

        {/* Liste des notifications */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-white/5">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Bell size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium text-slate-400">Aucune notification pour le moment</p>
              <p className="text-xs text-slate-600 mt-1">Vous recevrez ici les alertes nouveaux podcasts et livres audio</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleItemClick(notif)}
                className={`pt-2.5 first:pt-0 flex items-start gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-200
                  ${notif.read ? 'hover:bg-white/5 opacity-75' : 'bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/15'}`}
              >
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {getTypeIcon(notif.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs font-bold leading-tight ${notif.read ? 'text-slate-200' : 'text-white'}`}>
                      {notif.title}
                    </p>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap flex items-center gap-1">
                      <Clock size={10} />
                      {notif.time}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs mt-1 line-clamp-2 leading-snug">
                    {notif.body}
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearNotification(notif.id);
                  }}
                  className="text-slate-600 hover:text-slate-400 p-1 rounded-lg transition-colors flex-shrink-0"
                  title="Supprimer"
                >
                  <X size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Pied de page */}
        <div className="p-3 border-t border-white/10 bg-white/5 text-center">
          <p className="text-[11px] text-slate-500">
            RG Play • Notifications et recommandations intelligentes
          </p>
        </div>

      </div>
    </div>
  );
};
