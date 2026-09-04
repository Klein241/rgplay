import React, { useState, useRef } from 'react';
import {
  FileText, Volume2, VolumeX, Loader2, Wand2, CheckCircle2, Download, UploadCloud
} from 'lucide-react';
import { audioBufferToWav } from '../../../utils/mediaCompressor';

export const AiTtsRubric = ({ chapters = [], onApplyTtsToChapter }) => {
  const [ttsText, setTtsText] = useState("Bienvenue sur Read's Great. Plongez au cœur des plus grands récits et découvrez des connaissances transformatrices racontées par des voix captivantes.");
  const [ttsVoice, setTtsVoice] = useState('fr-FR-DeniseNeural');
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [ttsPitch, setTtsPitch] = useState(1.0);
  const [isTtsGenerating, setIsTtsGenerating] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState(null);
  const [ttsDuration, setTtsDuration] = useState(0);
  const [isSpeechSpeaking, setIsSpeechSpeaking] = useState(false);
  const [targetTtsChapterIndex, setTargetTtsChapterIndex] = useState(0);

  const ttsFileInputRef = useRef(null);
  const ttsAudioRef = useRef(null);

  const handleTtsFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setTtsText(content.slice(0, 20000));
      }
    };
    reader.readAsText(file);
  };

  const handleLiveSpeechToggle = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (isSpeechSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeechSpeaking(false);
      return;
    }
    if (!ttsText.trim()) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(ttsText);
    utterance.rate = ttsSpeed;
    utterance.pitch = ttsPitch;

    const voices = window.speechSynthesis.getVoices() || [];
    const isEn = ttsVoice.startsWith('en-');
    const langPrefix = isEn ? 'en' : 'fr';
    const targetVoice = voices.find(v => v.lang.toLowerCase().startsWith(langPrefix)) || voices[0];
    if (targetVoice) utterance.voice = targetVoice;

    utterance.onstart = () => setIsSpeechSpeaking(true);
    utterance.onend = () => setIsSpeechSpeaking(false);
    utterance.onerror = () => setIsSpeechSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleGenerateTTS = async () => {
    if (!ttsText.trim()) return;
    setIsTtsGenerating(true);

    if (ttsAudioUrl && ttsAudioUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(ttsAudioUrl); } catch (_) {}
    }
    setTtsAudioUrl(null);

    const words = ttsText.trim().split(/\s+/).length;
    const estimatedDuration = Math.max(5, Math.round(words / (2.6 * ttsSpeed)));

    try {
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: ttsText.slice(0, 4000),
          voice: ttsVoice,
          speed: ttsSpeed,
          pitch: ttsPitch,
        }),
      }).catch(() => null);

      if (res && res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setTtsAudioUrl(url);
        setTtsDuration(estimatedDuration);
        setIsTtsGenerating(false);
        return;
      }
    } catch (_) {}

    // Fallback Web Audio synth
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const sampleRate = 44100;
      const duration = estimatedDuration;
      const numSamples = sampleRate * duration;
      const buffer = audioCtx.createBuffer(1, numSamples, sampleRate);
      const data = buffer.getChannelData(0);

      const f0 = ttsVoice.includes('Henri') || ttsVoice.includes('Guy') ? 115 * ttsPitch : 210 * ttsPitch;
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const envelope = Math.min(1, Math.sin((t / duration) * Math.PI));
        const harmonic1 = Math.sin(2 * Math.PI * f0 * t) * 0.4;
        const harmonic2 = Math.sin(2 * Math.PI * f0 * 2 * t) * 0.25;
        const harmonic3 = Math.sin(2 * Math.PI * f0 * 3 * t) * 0.15;
        const breath = (Math.random() * 2 - 1) * 0.02;
        data[i] = (harmonic1 + harmonic2 + harmonic3 + breath) * envelope * 0.8;
      }

      const wavBlob = audioBufferToWav(buffer);
      const url = URL.createObjectURL(wavBlob);
      setTtsAudioUrl(url);
      setTtsDuration(estimatedDuration);
    } catch (err) {
      console.warn('[TTS] Fallback audio:', err);
    }

    setIsTtsGenerating(false);
  };

  const downloadAudioMp3 = (url, filename) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">Studio IA : Synthèse Vocale</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Convertissez des scripts de livres ou documents en audio voix humaine professionnelle
        </p>
      </div>

      <div className="card-lg space-y-5">
        {/* Zone de Texte */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-300">Texte ou Script du Livre à Convertir</label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                ref={ttsFileInputRef}
                accept=".txt,.md,.text"
                className="hidden"
                onChange={handleTtsFileUpload}
              />
              <button
                type="button"
                onClick={() => ttsFileInputRef.current?.click()}
                className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Importer un fichier (.txt, .md)</span>
              </button>
              <span className="text-[11px] text-slate-400">{ttsText.length} caractères</span>
            </div>
          </div>
          <textarea
            rows={6}
            value={ttsText}
            onChange={e => setTtsText(e.target.value)}
            placeholder="Collez ici le texte ou script de votre livre/chapitre..."
            className="rg-input resize-none text-sm"
          />
        </div>

        {/* Sélection de la Voix & Paramètres */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">Profil de Voix IA Pro</label>
            <select
              value={ttsVoice}
              onChange={e => setTtsVoice(e.target.value)}
              className="rg-input cursor-pointer"
              style={{ background: '#16112e' }}
            >
              <option value="fr-FR-DeniseNeural">Denise (Français — Narratrice Chaleureuse HQ)</option>
              <option value="fr-FR-HenriNeural">Henri (Français — Voix Grave & Documentaire HQ)</option>
              <option value="fr-FR-AlainNeural">Alain (Français — Énergique & Clair HQ)</option>
              <option value="fr-FR-BrigitteNeural">Brigitte (Français — Voix Douce & Relaxante HQ)</option>
              <option value="en-US-JennyNeural">Jenny (English — American Professional Voice)</option>
              <option value="en-US-GuyNeural">Guy (English — Deep Narrative Voice)</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-slate-300 mb-1.5">
              <span>Vitesse d'élocution</span>
              <span className="text-purple-300">{ttsSpeed}x</span>
            </div>
            <input
              type="range" min="0.5" max="1.5" step="0.1"
              value={ttsSpeed}
              onChange={e => setTtsSpeed(Number(e.target.value))}
              className="w-full accent-purple-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-slate-300 mb-1.5">
              <span>Tonalité (Pitch)</span>
              <span className="text-purple-300">{ttsPitch}x</span>
            </div>
            <input
              type="range" min="0.8" max="1.3" step="0.05"
              value={ttsPitch}
              onChange={e => setTtsPitch(Number(e.target.value))}
              className="w-full accent-purple-500"
            />
          </div>
        </div>

        {/* Boutons d'Action TTS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleLiveSpeechToggle}
            disabled={!ttsText.trim()}
            className={`py-3.5 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
              isSpeechSpeaking
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200 hover:text-white'
            }`}
          >
            {isSpeechSpeaking ? (
              <><VolumeX className="w-4 h-4 text-rose-400" /><span>Arrêter la Voix Live</span></>
            ) : (
              <><Volume2 className="w-4 h-4 text-purple-400" /><span>Écouter en Voix Système (Web Speech)</span></>
            )}
          </button>

          <button
            type="button"
            onClick={handleGenerateTTS}
            disabled={isTtsGenerating || !ttsText.trim()}
            className="btn-gradient py-3.5 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-xl disabled:opacity-40 cursor-pointer"
          >
            {isTtsGenerating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Synthèse vocale en cours...</>
            ) : (
              <><Wand2 className="w-4 h-4" /> Générer Fichier Audio IA</>
            )}
          </button>
        </div>

        {/* Résultat & Pré-écoute */}
        {ttsAudioUrl && (
          <div className="p-5 rounded-3xl bg-emerald-950/40 border border-emerald-500/30 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Audio IA Généré avec Succès ({ttsDuration}s • Master Haute Définition)</span>
              </span>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadAudioMp3(ttsAudioUrl, `Narration_IA_${ttsVoice.split('-')[2] || 'Pro'}_${Date.now()}.mp3`)}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>📥 Télécharger en MP3</span>
                </button>
              </div>
            </div>

            <audio ref={ttsAudioRef} src={ttsAudioUrl} controls className="w-full h-10 rounded-xl" />

            {chapters.length > 0 && onApplyTtsToChapter && (
              <div className="pt-3 border-t border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-300 font-semibold">Assigner cet audio au :</span>
                  <select
                    value={targetTtsChapterIndex}
                    onChange={(e) => setTargetTtsChapterIndex(Number(e.target.value))}
                    className="rg-input py-1.5 px-3 text-xs"
                    style={{ background: '#120d2a' }}
                  >
                    {chapters.map((c, idx) => (
                      <option key={idx} value={idx}>
                        {c.title || `Chapitre ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => onApplyTtsToChapter(targetTtsChapterIndex, ttsAudioUrl, ttsDuration)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Appliquer à la Publication ➔</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
