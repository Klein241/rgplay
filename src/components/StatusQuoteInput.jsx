import React, { useState } from 'react';
import { MessageSquarePlus, BookOpen, Sparkles, Trash2, RotateCcw } from 'lucide-react';

/**
 * StatusQuoteInput.jsx
 * Composant dédié permettant à l'utilisateur d'écrire son propre message
 * ou de choisir une citation / transcription pour l'incruster dans la vidéo de statut.
 */
export const DEFAULT_PROMO_TEXT = "RG Play, la plateforme qui vous permet de promouvoir: vos livres, vos services, ou vos Marques. Contactez-nous dès aujourd'hui !";

export const StatusQuoteInput = ({
  quoteText,
  onChange,
  showQuoteInput,
  onToggleShowQuote,
  book,
  chapter,
  maxLength = 160,
}) => {
  const [activeTab, setActiveTab] = useState('custom'); // 'custom' | 'quote'

  const quickPresets = [
    { label: '📢 Promo RG Play', text: DEFAULT_PROMO_TEXT },
    { label: '🎧 Coup de cœur', text: 'Mon coup de cœur du moment sur RG Play ! 🎧' },
    { label: '🔥 À écouter', text: 'Ce livre est une pépite, à écouter absolument ! 🔥' },
    { label: '💡 Très inspirant', text: 'Une leçon de vie percutante à méditer. 💡' },
  ];

  const getBookSynopsis = () => {
    return (
      book?.synopsis ||
      book?.description?.split?.('.')?.[0] ||
      chapter?.title ||
      ''
    ).slice(0, maxLength);
  };

  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    if (tab === 'quote') {
      onChange(getBookSynopsis());
    } else if (tab === 'custom' && !quoteText) {
      onChange(DEFAULT_PROMO_TEXT);
    }
  };

  const handlePresetClick = (presetText) => {
    onChange(presetText);
    setActiveTab('custom');
  };

  const handleClear = () => {
    onChange('');
  };

  const handleResetQuote = () => {
    onChange(getBookSynopsis());
    setActiveTab('quote');
  };

  return (
    <div className="p-3.5 rounded-2xl bg-white/5 border border-purple-400/25 space-y-2.5">
      {/* Entête avec interrupteur */}
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
          <MessageSquarePlus size={14} className="text-amber-400" />
          <span>Message ou Citation incrustée</span>
        </label>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={showQuoteInput}
            onChange={(e) => onToggleShowQuote(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-8 h-4.5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-amber-500" />
        </label>
      </div>

      {showQuoteInput && (
        <div className="space-y-2.5 animate-fadeIn">
          {/* Onglets : Mon message vs Citation du livre */}
          <div className="flex gap-1.5 p-1 bg-black/40 rounded-xl border border-white/5">
            <button
              type="button"
              onClick={() => handleSelectTab('custom')}
              className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                activeTab === 'custom'
                  ? 'bg-amber-500/25 border border-amber-400/50 text-amber-200 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquarePlus size={12} />
              <span>Mon message perso</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectTab('quote')}
              className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                activeTab === 'quote'
                  ? 'bg-purple-500/25 border border-purple-400/50 text-purple-200 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen size={12} />
              <span>Extrait du livre</span>
            </button>
          </div>

          {/* Suggestions rapides en mode message personnalisé */}
          {activeTab === 'custom' && (
            <div className="flex flex-wrap gap-1">
              {quickPresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handlePresetClick(preset.text)}
                  className="px-2 py-0.5 rounded-full bg-white/5 hover:bg-amber-500/20 border border-white/10 hover:border-amber-400/40 text-[9.5px] font-semibold text-purple-200 hover:text-amber-200 transition-all cursor-pointer flex items-center gap-1"
                >
                  <Sparkles size={10} className="text-amber-400" />
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Zone de texte éditable par l'utilisateur */}
          <div className="relative">
            <textarea
              rows={2}
              value={quoteText}
              onChange={(e) => onChange(e.target.value)}
              placeholder={
                activeTab === 'custom'
                  ? "Écrivez votre message qui s'affichera en grand sur la vidéo..."
                  : "Citation ou extrait audio..."
              }
              className="w-full bg-[#120624] border border-amber-400/30 rounded-xl p-2.5 text-xs text-white placeholder-purple-300/40 focus:outline-none focus:border-amber-400 resize-none font-medium pr-7 leading-relaxed shadow-inner"
              maxLength={maxLength}
            />
            {quoteText && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                title="Effacer le texte"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>

          {/* Barre inférieure : compteur & raccourcis */}
          <div className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetQuote}
                className="text-purple-300 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                title="Rétablir l'extrait du livre"
              >
                <RotateCcw size={10} />
                <span>Extrait du livre</span>
              </button>
              {quoteText && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-slate-400 hover:text-red-300 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>Effacer</span>
                </button>
              )}
            </div>

            <span
              className={`font-mono font-bold ${
                quoteText.length >= maxLength - 15 ? 'text-amber-400' : 'text-purple-300/60'
              }`}
            >
              {quoteText.length} / {maxLength}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
