import React from 'react';
import { Compass, BookMarked, User, Smartphone } from 'lucide-react';

export const BottomNav = ({ activeTab, setActiveTab, onOpenInstallModal }) => {
  const items = [
    { id: 'discover', icon: Compass,    label: 'Boutique'  },
    { id: 'library',  icon: BookMarked, label: 'Bibliothèque' },
    { id: 'profile',  icon: User,       label: 'Compte'    },
    { id: 'install',  icon: Smartphone, label: 'Installer', action: onOpenInstallModal },
  ];

  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 md:hidden">
      <div className="flex items-center gap-1 px-3 py-2.5 rounded-full shadow-2xl"
        style={{
          background: 'rgba(15, 11, 38, 0.95)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(157, 78, 221, 0.25)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(157,78,221,0.15)',
        }}>
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => item.action ? item.action() : setActiveTab(item.id)}
              className="relative flex flex-col items-center gap-1 px-4 py-1.5 rounded-full transition-all"
              style={{
                background: isActive
                  ? 'linear-gradient(135deg, rgba(157,78,221,0.30), rgba(247,37,133,0.25))'
                  : 'transparent',
                border: isActive ? '1px solid rgba(157,78,221,0.40)' : '1px solid transparent',
              }}
            >
              <Icon className={`w-5 h-5 transition-colors ${
                isActive ? 'text-purple-300' : 'text-[color:var(--color-text-tertiary)]'
              }`} />
              <span className={`text-[10px] font-semibold transition-colors ${
                isActive ? 'text-purple-200' : 'text-[color:var(--color-text-disabled)]'
              }`}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-purple-400" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
