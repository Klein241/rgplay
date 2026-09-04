import React from 'react';
import {
  Mic, X, Volume2, VolumeX, Loader2, Wand2, CheckCircle2, Download, Check
} from 'lucide-react';

export const ChapterAiModal = ({
  activeChapterAiModalIndex,
  setActiveChapterAiModalIndex,
  chapters = [],
  chapterTtsText,
  setChapterTtsText,
  chapterTtsVoice,
  setChapterTtsVoice,
  chapterTtsSpeed,
  setChapterTtsSpeed,
  chapterTtsPitch,
  setChapterTtsPitch,
  chapterTtsIsSpeaking,
  setChapterTtsIsSpeaking,
  isChapterTtsGenerating,
  chapterTtsAudioUrl,
  chapterTtsDuration,
  title,
  handleGenerateChapterTTS,
  handleApplyChapterTtsDirectly,
  downloadAudioMp3,
}) => {
  if (activeChapterAiModalIndex === null) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div
        className="w-full max-w-2xl rounded-3xl p-6 sm:p-7 space-y-5 relative max-h-[90vh] overflow-y-auto"
        style={{
          background: 'linear-gradient(135deg, #160d2e 0%, #0c081d 100%)',
          border: '1px solid rgba(168, 85, 247, 0.35)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 40px rgba(168, 85, 247, 0.25)',
        }}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Studio Vocal IA Pro
              </span>
              <span className="text-[10px] font-bold text-amber-400">
                Master Haute Qualité
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white font-['Outfit'] flex items-center gap-2">
              <Mic className="w-5 h-5 text-purple-400" />
              <span>
                Générer la Narration — Chapitre {activeChapterAiModalIndex + 1}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              « {chapters[activeChapterAiModalIndex]?.title || `Chapitre ${activeChapterAiModalIndex + 1}`} »
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (chapterTtsIsSpeaking) {
                window.speechSynthesis?.cancel();
                setChapterTtsIsSpeaking(false);
              }
              setActiveChapterAiModalIndex(null);
            }}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenu / Script du Chapitre */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300">
              Texte / Script à Enregistrer & Synthétiser
            </label>
            <span className="text-[11px] text-slate-400">
              {chapterTtsText.length} caractères • ≈ {Math.max(1, Math.round(chapterTtsText.trim().split(/\s+/).filter(Boolean).length / 2.6))}s
            </span>
          </div>
          <textarea
            rows={6}
            value={chapterTtsText}
            onChange={(e) => setChapterTtsText(e.target.value)}
            placeholder="Collez ici le texte intégral de ce chapitre pour la génération de la voix..."
            className="rg-input w-full p-4 rounded-2xl text-xs sm:text-sm resize-none"
          />
        </div>

        {/* Sélecteur de Voix & Réglages */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">
              Profil de Voix IA
            </label>
            <select
              value={chapterTtsVoice}
              onChange={(e) => setChapterTtsVoice(e.target.value)}
              className="rg-input w-full px-3 py-2 text-xs"
              style={{ background: '#120d2a' }}
            >
              <option value="fr-FR-HenriNeural">🇫🇷 Henri (Grave & Narrateur Pro)</option>
              <option value="fr-FR-DeniseNeural">🇫🇷 Denise (Chaleureuse & Expressive)</option>
              <option value="fr-FR-AlainNeural">🇫🇷 Alain (Dynamique & Clair)</option>
              <option value="fr-FR-BrigitteNeural">🇫🇷 Brigitte (Douce & Apaisante)</option>
              <option value="en-US-JennyNeural">🇺🇸 Jenny (English US Pro)</option>
              <option value="en-US-GuyNeural">🇺🇸 Guy (English Deep Voice)</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
              <span>Vitesse</span>
              <span className="text-purple-300">{chapterTtsSpeed}x</span>
            </div>
            <input
              type="range"
              min="0.6"
              max="1.5"
              step="0.1"
              value={chapterTtsSpeed}
              onChange={(e) => setChapterTtsSpeed(Number(e.target.value))}
              className="w-full accent-purple-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
              <span>Tonalité</span>
              <span className="text-purple-300">{chapterTtsPitch}x</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.3"
              step="0.05"
              value={chapterTtsPitch}
              onChange={(e) => setChapterTtsPitch(Number(e.target.value))}
              className="w-full accent-purple-500"
            />
          </div>
        </div>

        {/* Boutons d'Action de Synthèse */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {/* Tester la voix en direct */}
          <button
            type="button"
            onClick={() => {
              if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
              if (chapterTtsIsSpeaking) {
                window.speechSynthesis.cancel();
                setChapterTtsIsSpeaking(false);
                return;
              }
              if (!chapterTtsText.trim()) return;

              window.speechSynthesis.cancel();
              const u = new SpeechSynthesisUtterance(chapterTtsText);
              u.rate = chapterTtsSpeed;
              u.pitch = chapterTtsPitch;
              const voices = window.speechSynthesis.getVoices() || [];
              const isEn = chapterTtsVoice.startsWith('en-');
              const targetV = voices.find(v => v.lang.toLowerCase().startsWith(isEn ? 'en' : 'fr')) || voices[0];
              if (targetV) u.voice = targetV;
              u.onstart = () => setChapterTtsIsSpeaking(true);
              u.onend = () => setChapterTtsIsSpeaking(false);
              u.onerror = () => setChapterTtsIsSpeaking(false);
              window.speechSynthesis.speak(u);
            }}
            disabled={!chapterTtsText.trim()}
            className={`py-3 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
              chapterTtsIsSpeaking
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
            }`}
          >
            {chapterTtsIsSpeaking ? (
              <><VolumeX className="w-4 h-4 text-rose-400" /><span>Arrêter l'Écoute Live</span></>
            ) : (
              <><Volume2 className="w-4 h-4 text-purple-400" /><span>Tester la Voix (Speech Live)</span></>
            )}
          </button>

          {/* Synthèse du Fichier Audio Master */}
          <button
            type="button"
            onClick={() => handleGenerateChapterTTS(activeChapterAiModalIndex)}
            disabled={isChapterTtsGenerating || !chapterTtsText.trim()}
            className="btn-gradient py-3 px-4 rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-xl cursor-pointer disabled:opacity-50"
          >
            {isChapterTtsGenerating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /><span>Synthèse HD en cours...</span></>
            ) : (
              <><Wand2 className="w-4 h-4" /><span>Générer Fichier Audio Master</span></>
            )}
          </button>
        </div>

        {/* Résultat Généré avec Boutons Télécharger MP3 et Assigner */}
        {chapterTtsAudioUrl && (
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 space-y-3 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Audio Généré avec Succès ({chapterTtsDuration}s)</span>
              </span>

              {/* Télécharger MP3 */}
              <button
                type="button"
                onClick={() => downloadAudioMp3(chapterTtsAudioUrl, `${title || 'Oeuvre'}_Chapitre_${activeChapterAiModalIndex + 1}_IA.mp3`)}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-md active:scale-95 transition-transform cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>📥 Télécharger en MP3</span>
              </button>
            </div>

            <audio src={chapterTtsAudioUrl} controls className="w-full h-9 rounded-xl" />

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => handleApplyChapterTtsDirectly(activeChapterAiModalIndex)}
                className="btn-gradient px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Assigner Directement à ce Chapitre 🚀</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
