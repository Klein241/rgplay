import React from 'react';
import { Compass, BookMarked, User, Smartphone } from 'lucide-react';

export const BottomNav = ({ activeTab, setActiveTab, onOpenInstallModal }) => {
  const items = [
    { id: 'discover', icon: Compass,    label: 'Boutique',      emoji: '🎧' },
    { id: 'library',  icon: BookMarked, label: 'Bibliothèque',  emoji: '📚' },
    { id: 'profile',  icon: User,       label: 'Compte',        emoji: '👤' },
    { id: 'install',  icon: Smartphone, label: 'Installer',     emoji: '📲', action: onOpenInstallModal },
  ];

  return (
    <nav className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 md:hidden">
      <div
        className="flex items-center gap-1 px-2.5 py-2.5 rounded-[2rem]"
        style={{
          background: 'rgba(8, 5, 22, 0.92)',
          backdropFilter: 'blur(32px) saturate(200%)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%)',
          border: '1px solid rgba(168, 85, 247, 0.22)',
          boxShadow: `
            0 24px 64px rgba(0,0,0,0.65),
            0 8px 24px rgba(0,0,0,0.45),
            0 0 0 1px rgba(168, 85, 247, 0.10),
            0 1px 0 rgba(255,255,255,0.06) inset
          `,
        }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => item.action ? item.action() : setActiveTab(item.id)}
              className="relative flex flex-col items-center gap-1.5 transition-all duration-300"
              style={{
                padding: isActive ? '0.6rem 1.3rem' : '0.6rem 1rem',
                borderRadius: '1.5rem',
                background: isActive
                  ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.55), rgba(168, 85, 247, 0.40), rgba(192, 38, 211, 0.35))'
                  : 'transparent',
                border: isActive
                  ? '1px solid rgba(168, 85, 247, 0.45)'
                  : '1px solid transparent',
                boxShadow: isActive
                  ? '0 4px 20px rgba(168, 85, 247, 0.35), 0 0 32px rgba(168, 85, 247, 0.12), 0 1px 0 rgba(255,255,255,0.08) inset'
                  : 'none',
              }}
            >
              <Icon
                className="transition-all duration-300"
                style={{
                  width: isActive ? '22px' : '20px',
                  height: isActive ? '22px' : '20px',
                  color: isActive ? '#d08fff' : 'rgba(139,135,168,0.9)',
                  filter: isActive ? 'drop-shadow(0 0 6px rgba(208,143,255,0.60))' : 'none',
                  strokeWidth: isActive ? 2.2 : 1.8,
                }}
              />
              <span
                className="font-bold transition-all duration-300"
                style={{
                  fontSize: isActive ? '10px' : '9.5px',
                  color: isActive ? '#e9d5ff' : 'rgba(100,96,128,0.9)',
                  letterSpacing: isActive ? '0.01em' : '0em',
                }}
              >
                {item.label}
              </span>

              {/* Dot indicateur actif */}
              {isActive && (
                <span
                  className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{
                    background: 'linear-gradient(135deg, #d08fff, #f43f8b)',
                    boxShadow: '0 0 8px rgba(208, 143, 255, 0.80)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
