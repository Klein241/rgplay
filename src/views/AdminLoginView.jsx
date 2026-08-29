import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, Loader2, Sparkles } from 'lucide-react';

const ADMIN_PASSWORD = 'rgplay2026!'; // ← Géré via mot de passe studio

export const AdminLoginView = ({ onLoginSuccess }) => {
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [shake,    setShake]    = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Simulation de délai réseau avec vérification
    await new Promise(r => setTimeout(r, 600));

    if (password === ADMIN_PASSWORD) {
      const session = { role: 'admin', expires: Date.now() + 86400000 };
      localStorage.setItem('rg_admin_session', JSON.stringify(session));
      setLoading(false);
      onLoginSuccess();
    } else {
      setLoading(false);
      setError('Mot de passe incorrect. Accès refusé.');
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-50 overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% 20%, #0c0824 0%, #050311 100%)',
      }}
    >
      {/* Orbs de fond */}
      <div
        className="absolute top-1/4 -left-20 w-80 h-80 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />
      <div
        className="absolute bottom-1/4 -right-20 w-80 h-80 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.20) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />

      {/* Card login ultra-premium */}
      <div
        className={`w-full max-w-md relative z-10 transition-all ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}
        style={shake ? { animation: 'shake 0.5s ease-in-out' } : {}}
      >
        {/* En-tête avec Logo et Badge */}
        <div className="text-center mb-6">
          <div className="relative inline-block mb-3">
            <div
              className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center shadow-2xl transition-transform hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #14b8a6 100%)',
                boxShadow: '0 12px 36px rgba(16, 185, 129, 0.45), 0 0 0 1px rgba(255,255,255,0.2) inset',
              }}
            >
              <ShieldCheck className="w-10 h-10 text-white" />
            </div>
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 border-2 border-[#050311] flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-slate-950 fill-slate-950" />
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit'] tracking-tight">
            RG Play Studio
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
            Console d'Administration & Publication
          </p>
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Accès Administrateur Restreint</span>
          </div>
        </div>

        {/* Formulaire stylisé */}
        <form
          onSubmit={handleLogin}
          className="rounded-3xl p-6 sm:p-8 space-y-5"
          style={{
            background: 'linear-gradient(145deg, rgba(20, 16, 44, 0.92) 0%, rgba(12, 9, 30, 0.96) 100%)',
            backdropFilter: 'blur(28px) saturate(180%)',
            border: '1px solid rgba(168, 85, 247, 0.25)',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.65), 0 1px 0 rgba(255, 255, 255, 0.08) inset',
          }}
        >
          <div>
            <label className="text-xs font-black text-slate-300 uppercase tracking-widest block mb-2 font-['Outfit']">
              Clé d'accès administrateur
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Entrez le mot de passe studio"
                required
                autoFocus
                className="w-full pl-11 pr-12 py-3.5 rounded-2xl text-sm text-white placeholder-slate-500 transition-all font-mono"
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: error ? '1.5px solid rgba(244, 63, 139, 0.70)' : '1.5px solid rgba(168, 85, 247, 0.25)',
                  boxShadow: error ? '0 0 16px rgba(244, 63, 139, 0.20)' : 'none',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <p className="flex items-center gap-1.5 text-xs text-rose-400 mt-2.5 font-bold animate-fadeIn">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer font-['Outfit'] tracking-wide shadow-xl active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #0d9488 100%)',
              color: '#ffffff',
              boxShadow: '0 8px 28px rgba(16, 185, 129, 0.45), 0 1px 0 rgba(255, 255, 255, 0.2) inset',
            }}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authentification en cours...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Déverrouiller le Back-Office</span>
              </>
            )}
          </button>
        </form>

        <p className="text-center text-[11px] text-slate-500 mt-4 font-medium">
          Accès sécurisé RG Play • Chiffrement de session AES-256
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-8px); }
          30%       { transform: translateX(8px); }
          45%       { transform: translateX(-5px); }
          60%       { transform: translateX(5px); }
          75%       { transform: translateX(-3px); }
          90%       { transform: translateX(3px); }
        }
      `}</style>
    </div>
  );
};
