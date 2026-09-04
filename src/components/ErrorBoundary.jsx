import React from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReload = () => {
    // Purger les caches de session si nécessaire
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#07070F] text-white">
          <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-[#140c26] border border-purple-500/30 shadow-2xl text-center space-y-5">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white font-['Outfit']">Une erreur est survenue</h2>
              <p className="text-xs text-slate-400 mt-1">
                Le module n'a pas pu se charger correctement en raison du cache de votre navigateur.
              </p>
              {this.state.error && (
                <p className="text-[11px] font-mono text-rose-300 bg-rose-950/40 p-2.5 rounded-xl mt-3 border border-rose-500/20 text-left overflow-x-auto">
                  {this.state.error.message || String(this.state.error)}
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Recharger la page</span>
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all border border-white/10"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Accueil</span>
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
