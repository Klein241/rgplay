import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';

const ADMIN_PASSWORD = 'rgplay2026!'; // ← À changer + mettre en variable d'env Cloudflare

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

    // Simulation délai réseau (en prod → vérifier contre KV/D1)
    await new Promise(r => setTimeout(r, 800));

    if (password === ADMIN_PASSWORD) {
      // Stocker session admin dans localStorage (TTL 24h)
      const session = { role: 'admin', expires: Date.now() + 86400000 };
      localStorage.setItem('rg_admin_session', JSON.stringify(session));
      setLoading(false);
      onLoginSuccess();
    } else {
      setLoading(false);
      setError('Mot de passe incorrect');
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#08051a] flex items-center justify-center p-4 z-50"
      style={{backgroundImage: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(157,78,221,0.18) 0%, transparent 60%)'}}>
      
      {/* Card login */}
      <div className={`w-full max-w-sm ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}
        style={shake ? {animation: 'shake 0.5s ease-in-out'} : {}}>
        
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/40 mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white">RG Play Admin</h1>
          <p className="text-xs text-slate-400 mt-1">Espace Back-Office Sécurisé</p>
          <span className="inline-block mt-2 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300">
            rgplay.com/login/admin
          </span>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleLogin} className="glass-card rounded-3xl p-6 border border-white/10 space-y-4">
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Mot de passe administrateur
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoFocus
                className={`w-full bg-white/5 border rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors ${
                  error ? 'border-rose-500/60 focus:border-rose-500' : 'border-white/10 focus:border-purple-500'
                }`}
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <p className="flex items-center gap-1.5 text-[11px] text-rose-400 mt-2 font-semibold">
                <AlertCircle className="w-3.5 h-3.5" /> {error}
              </p>
            )}
          </div>

          <button type="submit" disabled={loading || !password}
            className="btn-gradient w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Vérification...</>
              : <><ShieldCheck className="w-4 h-4" /> Accéder au Back-Office</>}
          </button>
        </form>

        <p className="text-center text-[10px] text-slate-600 mt-4">
          Accès réservé aux administrateurs RG Play
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-6px); }
          30%       { transform: translateX(6px); }
          45%       { transform: translateX(-4px); }
          60%       { transform: translateX(4px); }
          75%       { transform: translateX(-2px); }
          90%       { transform: translateX(2px); }
        }
      `}</style>
    </div>
  );
};
