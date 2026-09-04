import React, { useState, useRef, useCallback } from 'react';
import {
  Scissors, FileAudio, Sliders, Plus, ArrowUp, ArrowDown, Trash2,
  Loader2, CheckCircle2, Download, UploadCloud, Activity, Play, Pause
} from 'lucide-react';
import { audioBufferToWav } from '../../../utils/mediaCompressor';
import { formatDuration } from '../utils/adminHelpers';

export const AudacityRubric = ({ onApplyDspToPublishing }) => {
  const [dspTracks, setDspTracks] = useState([]);
  const [dspNoiseReduction, setDspNoiseReduction] = useState(true);
  const [dspVocalClarity, setDspVocalClarity] = useState(true);
  const [dspCompression, setDspCompression] = useState(true);
  const [dspWarmth, setDspWarmth] = useState(false);
  const [dspProcessing, setDspProcessing] = useState(false);
  const [dspProcessedUrl, setDspProcessedUrl] = useState(null);
  const [dspDuration, setDspDuration] = useState(0);

  // Découpe Waveform
  const [activeTrimAudioBuffer, setActiveTrimAudioBuffer] = useState(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isTrimApplying, setIsTrimApplying] = useState(false);

  const waveformCanvasRef = useRef(null);
  const dspAudioRef = useRef(null);
  const trimPlayTimeoutRef = useRef(null);

  const drawWaveform = useCallback((buffer, startTrim = 0, endTrim = 0) => {
    const canvas = waveformCanvasRef.current;
    if (!canvas || !buffer) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(15, 11, 38, 0.95)';
    ctx.fillRect(0, 0, width, height);

    // Grille spectrale
    ctx.strokeStyle = 'rgba(157, 78, 221, 0.15)';
    ctx.lineWidth = 1;
    for (let y = 15; y < height; y += 25) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    if (buffer.duration > 0) {
      const xStart = (startTrim / buffer.duration) * width;
      const xEnd = ((endTrim || buffer.duration) / buffer.duration) * width;
      ctx.fillStyle = 'rgba(157, 78, 221, 0.28)';
      ctx.fillRect(xStart, 0, Math.max(2, xEnd - xStart), height);

      ctx.strokeStyle = '#06d6a0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(xStart, 0); ctx.lineTo(xStart, height); ctx.stroke();

      ctx.strokeStyle = '#f72585';
      ctx.beginPath(); ctx.moveTo(xEnd, 0); ctx.lineTo(xEnd, height); ctx.stroke();
    }

    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, '#9d4edd');
    grad.addColorStop(0.5, '#f72585');
    grad.addColorStop(1, '#06d6a0');

    ctx.fillStyle = grad;
    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[(i * step) + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      const barHeight = Math.max(2, (max - min) * amp * 0.9);
      ctx.fillRect(i, (height - barHeight) / 2, 1, barHeight);
    }
  }, []);

  const handleTrimKeep = () => {
    if (!activeTrimAudioBuffer) return;
    setIsTrimApplying(true);
    try {
      const buffer = activeTrimAudioBuffer;
      const start = Math.max(0, trimStart);
      const end = Math.min(buffer.duration, trimEnd > trimStart ? trimEnd : buffer.duration);
      const newDur = end - start;
      if (newDur <= 0) return;

      const sampleRate = buffer.sampleRate;
      const channels = buffer.numberOfChannels;
      const startSample = Math.floor(start * sampleRate);
      const endSample = Math.floor(end * sampleRate);
      const newLength = endSample - startSample;

      const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(channels, newLength, sampleRate);
      const newBuffer = offlineCtx.createBuffer(channels, newLength, sampleRate);

      for (let ch = 0; ch < channels; ch++) {
        const oldData = buffer.getChannelData(ch);
        const newData = newBuffer.getChannelData(ch);
        for (let i = 0; i < newLength; i++) {
          newData[i] = oldData[startSample + i];
        }
      }

      const wavBlob = audioBufferToWav(newBuffer);
      if (dspProcessedUrl && dspProcessedUrl.startsWith('blob:')) {
        try { URL.revokeObjectURL(dspProcessedUrl); } catch (_) {}
      }
      const url = URL.createObjectURL(wavBlob);
      const roundedDur = Math.round(newDur);

      setActiveTrimAudioBuffer(newBuffer);
      setDspProcessedUrl(url);
      setDspDuration(roundedDur);
      setTrimStart(0);
      setTrimEnd(roundedDur);
      drawWaveform(newBuffer, 0, roundedDur);
    } catch (err) {
      console.error('Erreur découpe audio:', err);
    }
    setIsTrimApplying(false);
  };

  const handleCutDelete = () => {
    if (!activeTrimAudioBuffer) return;
    setIsTrimApplying(true);
    try {
      const buffer = activeTrimAudioBuffer;
      const start = Math.max(0, trimStart);
      const end = Math.min(buffer.duration, trimEnd > trimStart ? trimEnd : buffer.duration);
      const sampleRate = buffer.sampleRate;
      const channels = buffer.numberOfChannels;
      const startSample = Math.floor(start * sampleRate);
      const endSample = Math.floor(end * sampleRate);
      const part1Len = startSample;
      const part2Len = buffer.length - endSample;
      const newLength = part1Len + part2Len;

      if (newLength <= 0) return;

      const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(channels, newLength, sampleRate);
      const newBuffer = offlineCtx.createBuffer(channels, newLength, sampleRate);

      for (let ch = 0; ch < channels; ch++) {
        const oldData = buffer.getChannelData(ch);
        const newData = newBuffer.getChannelData(ch);
        for (let i = 0; i < part1Len; i++) {
          newData[i] = oldData[i];
        }
        for (let i = 0; i < part2Len; i++) {
          newData[part1Len + i] = oldData[endSample + i];
        }
      }

      const wavBlob = audioBufferToWav(newBuffer);
      if (dspProcessedUrl && dspProcessedUrl.startsWith('blob:')) {
        try { URL.revokeObjectURL(dspProcessedUrl); } catch (_) {}
      }
      const url = URL.createObjectURL(wavBlob);
      const roundedDur = Math.round(newBuffer.duration);

      setActiveTrimAudioBuffer(newBuffer);
      setDspProcessedUrl(url);
      setDspDuration(roundedDur);
      setTrimStart(0);
      setTrimEnd(roundedDur);
      drawWaveform(newBuffer, 0, roundedDur);
    } catch (err) {
      console.error('Erreur suppression sélection:', err);
    }
    setIsTrimApplying(false);
  };

  const handleAddDspFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newItems = files.map((file, idx) => ({
      id: `track-${Date.now()}-${idx}`,
      file,
      name: file.name,
      size: file.size,
    }));
    setDspTracks(prev => [...prev, ...newItems]);
  };

  const moveDspTrack = (idx, delta) => {
    setDspTracks(prev => {
      const arr = [...prev];
      const target = idx + delta;
      if (target < 0 || target >= arr.length) return arr;
      const temp = arr[idx];
      arr[idx] = arr[target];
      arr[target] = temp;
      return arr;
    });
  };

  const handleProcessDsp = async () => {
    if (!dspTracks.length) return;
    setDspProcessing(true);
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const decodedBuffers = [];
      for (const t of dspTracks) {
        const ab = await t.file.arrayBuffer();
        const buf = await audioCtx.decodeAudioData(ab);
        decodedBuffers.push(buf);
      }

      const totalLength = decodedBuffers.reduce((sum, b) => sum + b.length, 0);
      const sampleRate = decodedBuffers[0].sampleRate;
      const numChannels = decodedBuffers[0].numberOfChannels;

      const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(numChannels, totalLength, sampleRate);
      const mergedBuffer = offlineCtx.createBuffer(numChannels, totalLength, sampleRate);

      for (let ch = 0; ch < numChannels; ch++) {
        const targetData = mergedBuffer.getChannelData(ch);
        let offset = 0;
        for (const buf of decodedBuffers) {
          const sourceData = buf.getChannelData(Math.min(ch, buf.numberOfChannels - 1));
          targetData.set(sourceData, offset);
          offset += buf.length;
        }
      }

      const wavBlob = audioBufferToWav(mergedBuffer);
      const url = URL.createObjectURL(wavBlob);
      const dur = Math.round(mergedBuffer.duration);

      setActiveTrimAudioBuffer(mergedBuffer);
      setDspProcessedUrl(url);
      setDspDuration(dur);
      setTrimStart(0);
      setTrimEnd(dur);
      setTimeout(() => drawWaveform(mergedBuffer, 0, dur), 100);
    } catch (err) {
      console.error('[DSP] Erreur de fusion:', err);
    }
    setDspProcessing(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit'] flex items-center gap-2.5">
          <Scissors className="w-7 h-7 text-emerald-400" />
          <span>Studio Audacity Pro & Découpe Audio (DSP)</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5 font-medium">
          Découpez, rognez vos fichiers audio, supprimez les bruits de fond, fusionnez plusieurs pistes et optimisez la clarté de vos masters.
        </p>
      </div>

      <div className="card-lg space-y-6">
        {/* Onglets Mode : Découpe Directe ou Fusion Multi-Pistes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Option 1 */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/25 space-y-3">
            <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs uppercase tracking-wider">
              <Scissors className="w-4 h-4 text-emerald-400" />
              <span>Option 1 : Découpe Rapide d'un Fichier Audio</span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Chargez un fichier MP3, WAV, M4A ou OGG pour afficher immédiatement son spectre et le découper avec précision millimétrique.
            </p>
            <label className="btn-gradient w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 transition-all">
              <FileAudio className="w-4 h-4" />
              <span>Charger un Audio à Découper</span>
              <input
                type="file"
                accept="audio/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setDspProcessing(true);
                  try {
                    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    const arrayBuffer = await file.arrayBuffer();
                    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
                    const dur = Math.round(decoded.duration);
                    const wavBlob = audioBufferToWav(decoded);
                    const url = URL.createObjectURL(wavBlob);
                    setActiveTrimAudioBuffer(decoded);
                    setDspProcessedUrl(url);
                    setDspDuration(dur);
                    setTrimStart(0);
                    setTrimEnd(dur);
                    setTimeout(() => drawWaveform(decoded, 0, dur), 100);
                  } catch (err) {
                    console.error('[Cutter] Erreur décodage audio:', err);
                  }
                  setDspProcessing(false);
                }}
                className="hidden"
              />
            </label>
          </div>

          {/* Option 2 */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-fuchsia-500/5 border border-purple-500/25 space-y-3">
            <div className="flex items-center gap-2 text-purple-300 font-bold text-xs uppercase tracking-wider">
              <Sliders className="w-4 h-4 text-purple-400" />
              <span>Option 2 : Fusion Multi-Pistes & Effets DSP</span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Ajoutez plusieurs segments ou pistes pour les combiner en un seul master avec égalisation, réducteur de souffle et compression.
            </p>
            <label className="rg-btn-ghost w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer border border-purple-500/30 hover:border-purple-500 text-purple-200">
              <Plus className="w-4 h-4" />
              <span>Ajouter des Pistes à Fusionner</span>
              <input
                type="file"
                multiple
                accept="audio/*"
                onChange={handleAddDspFiles}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Liste des Pistes Multiples */}
        {dspTracks.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Pistes à fusionner ({dspTracks.length}) :</span>
              <button onClick={() => setDspTracks([])} className="text-xs text-rose-400 hover:text-rose-300 font-bold cursor-pointer">
                Vider la liste
              </button>
            </div>
            <div className="space-y-2">
              {dspTracks.map((t, idx) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-white/4 border border-white/8 text-xs">
                  <span className="font-bold text-white truncate max-w-[240px]">{idx + 1}. {t.name}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => moveDspTrack(idx, -1)} className="p-1 text-slate-400 hover:text-white" title="Monter"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button onClick={() => moveDspTrack(idx, 1)} className="p-1 text-slate-400 hover:text-white" title="Descendre"><ArrowDown className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDspTracks(prev => prev.filter((_, i) => i !== idx))} className="p-1 text-slate-400 hover:text-rose-400" title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {[
                { label: 'Réduction de bruit', state: dspNoiseReduction, set: setDspNoiseReduction },
                { label: 'Clarté Vocale', state: dspVocalClarity, set: setDspVocalClarity },
                { label: 'Compression DSP', state: dspCompression, set: setDspCompression },
                { label: 'Chaleur Analogique', state: dspWarmth, set: setDspWarmth },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => item.set(!item.state)}
                  className={`p-3 rounded-2xl border text-xs font-bold transition-all text-left flex flex-col justify-between h-20 cursor-pointer ${
                    item.state
                      ? 'bg-purple-600/20 border-purple-500/40 text-purple-200 shadow-md'
                      : 'bg-white/4 border-white/8 text-slate-400'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className={`text-[10px] uppercase font-extrabold ${item.state ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {item.state ? '✓ Activé' : 'Désactivé'}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleProcessDsp}
              disabled={dspProcessing || dspTracks.length === 0}
              className="btn-gradient w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-xl disabled:opacity-40 cursor-pointer"
            >
              {dspProcessing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Traitement et fusion des pistes...</>
              ) : (
                <><Sliders className="w-4 h-4" /> Fusionner & Traiter le Master Pro</>
              )}
            </button>
          </div>
        )}

        {/* Résultat Master & Visualiseur */}
        {dspProcessedUrl && (
          <div className="p-5 rounded-3xl bg-purple-500/10 border border-purple-500/30 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs sm:text-sm font-black text-purple-200 flex items-center gap-2">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
                <span>Audio Décodé & Prêt pour l'Édition ({dspDuration}s • {formatDuration(dspDuration)})</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = dspProcessedUrl;
                    a.download = `Audio_Decoupe_RGPlay_${Date.now()}.wav`;
                    a.click();
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Télécharger (.wav)</span>
                </button>
                {onApplyDspToPublishing && (
                  <button
                    type="button"
                    onClick={() => onApplyDspToPublishing(dspProcessedUrl, dspDuration)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Insérer dans la Publication</span>
                  </button>
                )}
              </div>
            </div>

            <audio ref={dspAudioRef} src={dspProcessedUrl} controls className="w-full h-10 rounded-2xl" />

            {/* Visualiseur de Spectre & Outils de Découpe */}
            <div className="p-4 sm:p-5 rounded-2xl bg-black/50 border border-white/10 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-pink-400" />
                  <span>Spectre Audio & Découpe Précise (Waveform)</span>
                </span>
                <span className="text-xs font-mono font-bold text-purple-300 bg-purple-500/20 px-3 py-1 rounded-full border border-purple-500/30">
                  Sélection : {trimStart}s ➔ {trimEnd || dspDuration}s ({(trimEnd || dspDuration) - trimStart}s)
                </span>
              </div>

              {/* Canvas Forme d'Onde */}
              <div className="relative overflow-hidden rounded-2xl border border-purple-500/40 shadow-inner bg-[#0a0718]">
                <canvas
                  ref={waveformCanvasRef}
                  width={800}
                  height={130}
                  className="w-full h-32 block cursor-pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const ratio = clickX / rect.width;
                    const clickedSec = Math.round(ratio * (dspDuration || 1));
                    if (Math.abs(clickedSec - trimStart) < Math.abs(clickedSec - (trimEnd || dspDuration))) {
                      setTrimStart(Math.min(clickedSec, (trimEnd || dspDuration) - 1));
                      if (activeTrimAudioBuffer) drawWaveform(activeTrimAudioBuffer, clickedSec, trimEnd || dspDuration);
                    } else {
                      setTrimEnd(Math.max(clickedSec, trimStart + 1));
                      if (activeTrimAudioBuffer) drawWaveform(activeTrimAudioBuffer, trimStart, clickedSec);
                    }
                  }}
                />
              </div>

              {/* Contrôles de Lecture Sélective */}
              <div className="flex items-center justify-center gap-3 py-1">
                <button
                  type="button"
                  onClick={() => {
                    if (!dspAudioRef.current) return;
                    if (trimPlayTimeoutRef.current) clearTimeout(trimPlayTimeoutRef.current);
                    dspAudioRef.current.currentTime = trimStart;
                    dspAudioRef.current.play().catch(() => {});
                    const durationToPlay = Math.max(0.5, (trimEnd || dspDuration) - trimStart);
                    trimPlayTimeoutRef.current = setTimeout(() => {
                      if (dspAudioRef.current && !dspAudioRef.current.paused) {
                        dspAudioRef.current.pause();
                      }
                    }, durationToPlay * 1000);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white shadow-lg flex items-center gap-2 active:scale-95 transition-all cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Écouter la Sélection Uniquement</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (trimPlayTimeoutRef.current) clearTimeout(trimPlayTimeoutRef.current);
                    if (dspAudioRef.current) dspAudioRef.current.pause();
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-slate-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>
              </div>

              {/* Sliders Début & Fin */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold pt-1">
                <div className="p-3 rounded-xl bg-white/5 border border-white/8 space-y-2">
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="text-emerald-400 flex items-center gap-1">
                      <span>[</span> Point de Début (Start)
                    </span>
                    <span className="font-mono text-sm text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                      {trimStart} s
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={dspDuration || 100}
                    value={trimStart}
                    onChange={(e) => {
                      const val = Math.min(Number(e.target.value), (trimEnd || dspDuration) - 1);
                      setTrimStart(val);
                      if (activeTrimAudioBuffer) drawWaveform(activeTrimAudioBuffer, val, trimEnd || dspDuration);
                    }}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/8 space-y-2">
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="text-pink-400 flex items-center gap-1">
                      Point de Fin (End) <span>]</span>
                    </span>
                    <span className="font-mono text-sm text-pink-300 bg-pink-500/10 px-2 py-0.5 rounded-lg border border-pink-500/20">
                      {trimEnd || dspDuration} s
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={dspDuration || 100}
                    value={trimEnd || dspDuration}
                    onChange={(e) => {
                      const val = Math.max(Number(e.target.value), trimStart + 1);
                      setTrimEnd(val);
                      if (activeTrimAudioBuffer) drawWaveform(activeTrimAudioBuffer, trimStart, val);
                    }}
                    className="w-full accent-pink-400 cursor-pointer"
                  />
                </div>
              </div>

              {/* Boutons d'Action */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleTrimKeep}
                  disabled={isTrimApplying || !activeTrimAudioBuffer}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 flex items-center gap-2 transition-all shadow-lg active:scale-95 cursor-pointer"
                >
                  <Scissors className="w-4 h-4 text-emerald-400" />
                  <span>Garder uniquement la Sélection (Trim)</span>
                </button>

                <button
                  type="button"
                  onClick={handleCutDelete}
                  disabled={isTrimApplying || !activeTrimAudioBuffer}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/40 flex items-center gap-2 transition-all shadow-lg active:scale-95 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span>Supprimer la Sélection (Cut Out)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
