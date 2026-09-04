import React from 'react';
import { Search, BookOpen, ShoppingBag, User, Sparkles, Disc } from 'lucide-react';
import { useAudio } from '../context/AudioContext';

export const BottomNav = ({ activeTab, setActiveTab, onOpenStore, onOpenAgentSky }) => {
  const { currentBook, isPlaying, setIsFullScreenOpen } = useAudio();

  const handleCenterClick = () => {
    if (currentBook) {
      setIsFullScreenOpen(true);
    } else if (onOpenAgentSky) {
      onOpenAgentSky();
    } else {
      setActiveTab('discover');
    }
  };

  return (
    <nav className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-md">
      <div
        className="flex items-center justify-between px-3 py-2 rounded-full"
        style={{
          background: 'linear-gradient(180deg, rgba(32, 16, 58, 0.94) 0%, rgba(14, 6, 26, 0.97) 100%)',
          backdropFilter: 'blur(36px) saturate(220%)',
          WebkitBackdropFilter: 'blur(36px) saturate(220%)',
          border: '1px solid rgba(168, 85, 247, 0.30)',
          boxShadow: `
            0 20px 50px rgba(0,0,0,0.80),
            0 0 30px rgba(168, 85, 247, 0.20),
            0 1px 0 rgba(255,255,255,0.10) inset
          `,
        }}
      >
        {/* 1. DÉCOUVRIR */}
        <button
          onClick={() => setActiveTab('discover')}
          className={`flex-1 flex flex-col items-center gap-1 py-1 px-1 transition-all duration-200 cursor-pointer ${
            activeTab === 'discover' ? 'text-[#e9d5ff] scale-105' : 'text-[#8b75b2] hover:text-[#c4b0e8]'
          }`}
        >
          <Search className={`w-5 h-5 transition-transform ${activeTab === 'discover' ? 'stroke-[2.5] drop-shadow-[0_0_8px_rgba(216,180,254,0.7)]' : 'stroke-[1.8]'}`} />
          <span className={`text-[9.5px] tracking-wider uppercase font-heading ${activeTab === 'discover' ? 'font-black text-white' : 'font-bold'}`}>
            DÉCOUVRIR
          </span>
          {activeTab === 'discover' && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#d8b4fe] shadow-[0_0_8px_#d8b4fe] -mt-0.5" />
          )}
        </button>

        {/* 2. E-BOOKS & PDF */}
        <button
          onClick={() => setActiveTab('library')}
          className={`flex-1 flex flex-col items-center gap-1 py-1 px-1 transition-all duration-200 cursor-pointer ${
            activeTab === 'library' ? 'text-[#e9d5ff] scale-105' : 'text-[#8b75b2] hover:text-[#c4b0e8]'
          }`}
          title="Liseuse & Bibliothèque E-Books et PDF Read's Great"
        >
          <BookOpen className={`w-5 h-5 transition-transform ${activeTab === 'library' ? 'stroke-[2.5] drop-shadow-[0_0_8px_rgba(216,180,254,0.7)]' : 'stroke-[1.8]'}`} />
          <span className={`text-[9.5px] tracking-wider uppercase font-heading ${activeTab === 'library' ? 'font-black text-white' : 'font-bold'}`}>
            E-BOOKS & PDF
          </span>
          {activeTab === 'library' && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#d8b4fe] shadow-[0_0_8px_#d8b4fe] -mt-0.5" />
          )}
        </button>

        {/* 3. HERO CENTRAL BUTTON (Agent SKY / Disque en lecture @iSalmanArt) */}
        <div className="relative -mt-6 px-1 flex-shrink-0">
          <button
            onClick={handleCenterClick}
            className="group relative w-13 h-13 rounded-full p-0.5 flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #c084fc, #9333ea, #3b82f6)',
              boxShadow: '0 0 25px rgba(168, 85, 247, 0.65), 0 8px 20px rgba(0,0,0,0.6)',
            }}
            title={currentBook ? "Ouvrir le Lecteur Audio" : "Agent SKY"}
          >
            <div className="w-full h-full rounded-full bg-[#180b30] flex items-center justify-center overflow-hidden border border-white/25">
              {currentBook?.cover_url ? (
                <img
                  src={currentBook.cover_url}
                  alt="Playing"
                  className={`w-full h-full object-cover ${isPlaying ? 'animate-[spin_8s_linear_infinite]' : ''}`}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-cyan-300">
                  <Sparkles className="w-5 h-5 text-[#d8b4fe] animate-pulse" />
                </div>
              )}
            </div>

            {/* Glowing active audio pulse ring */}
            {isPlaying && (
              <span className="absolute -inset-1 rounded-full border-2 border-purple-400/60 animate-ping pointer-events-none" />
            )}
          </button>
        </div>

        {/* 4. BOUTIQUE / PAIEMENT */}
        <button
          onClick={() => onOpenStore ? onOpenStore() : setActiveTab('store')}
          className={`flex-1 flex flex-col items-center gap-1 py-1 px-1 transition-all duration-200 cursor-pointer ${
            activeTab === 'store' ? 'text-[#e9d5ff] scale-105' : 'text-[#8b75b2] hover:text-[#c4b0e8]'
          }`}
        >
          <ShoppingBag className={`w-5 h-5 transition-transform ${activeTab === 'store' ? 'stroke-[2.5] drop-shadow-[0_0_8px_rgba(216,180,254,0.7)]' : 'stroke-[1.8]'}`} />
          <span className={`text-[9.5px] tracking-wider uppercase font-heading ${activeTab === 'store' ? 'font-black text-white' : 'font-bold'}`}>
            BOUTIQUE
          </span>
          {activeTab === 'store' && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#d8b4fe] shadow-[0_0_8px_#d8b4fe] -mt-0.5" />
          )}
        </button>

        {/* 5. COMPTE */}
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 flex flex-col items-center gap-1 py-1 px-1 transition-all duration-200 cursor-pointer ${
            activeTab === 'profile' ? 'text-[#e9d5ff] scale-105' : 'text-[#8b75b2] hover:text-[#c4b0e8]'
          }`}
        >
          <User className={`w-5 h-5 transition-transform ${activeTab === 'profile' ? 'stroke-[2.5] drop-shadow-[0_0_8px_rgba(216,180,254,0.7)]' : 'stroke-[1.8]'}`} />
          <span className={`text-[9.5px] tracking-wider uppercase font-heading ${activeTab === 'profile' ? 'font-black text-white' : 'font-bold'}`}>
            COMPTE
          </span>
          {activeTab === 'profile' && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#d8b4fe] shadow-[0_0_8px_#d8b4fe] -mt-0.5" />
          )}
        </button>
      </div>
    </nav>
  );
};
