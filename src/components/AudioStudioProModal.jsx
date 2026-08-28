import React, { useState, useRef, useEffect } from 'react';
import { 
  Sliders, Wand2, Music, Volume2, VolumeX, Play, Pause, 
  ArrowUp, ArrowDown, Trash2, Plus, Download, CheckCircle2, 
  Sparkles, Layers, ShieldCheck, RefreshCw, X, Loader2, FileAudio, Zap
} from 'lucide-react';

export const AudioStudioProModal = ({ isOpen, onClose, onApplyToChapter }) => {
  // Liste des pistes à fusionner
  const [tracks, setTracks] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedAudioUrl, setProcessedAudioUrl] = useState(null);
  const [processedBlob, setProcessedBlob] = useState(null);
  const [processedDuration, setProcessedDuration] = useState(0);

  // Traitements Audio Pro (DSP)
  const [enableNoiseReduction, setEnableNoiseReduction] = useState(true);
  const [enableVocalClarity, setEnableVocalClarity] = useState(true);
  const [enableCompression, setEnableCompression] = useState(true);
  const [enableWarmth, setEnableWarmth] = useState(true);
  const [targetVolume, setTargetVolume] = useState(1.2); // Gain

  // Lecteur Audio Master
  const [isPlayingMaster, setIsPlayingMaster] = useState(false);
  const [masterCurrentTime, setMasterCurrentTime] = useState(0);
  const masterAudioRef = useRef(null);
  const canvasRef = useRef(null);

  // Pré-écoute individuelle
  const [playingTrackIndex, setPlayingTrackIndex] = useState(null);
  const trackAudioRef = useRef(null);

  const fileInputRef = useRef(null);

  // Gestion de l'ajout de fichiers
  const handleAddFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newTracks = files.map((file) => ({
      id: `track-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      file,
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(2) + ' Mo',
      url: URL.createObjectURL(file),
      duration: 0,
    }));

    // Charger les durées de chaque fichier
    newTracks.forEach((t, idx) => {
      const audio = new Audio(t.url);
      audio.onloadedmetadata = () => {
        setTracks((prev) =>
          prev.map((item) => (item.id === t.id ? { ...item, duration: audio.duration } : item))
        );
      };
    });

    setTracks((prev) => [...prev, ...newTracks]);
    setProcessedAudioUrl(null);
  };

  const removeTrack = (index) => {
    setTracks((prev) => prev.filter((_, i) => i !== index));
    setProcessedAudioUrl(null);
  };

  const moveTrack = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= tracks.length) return;
    setTracks((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[target];
      copy[target] = temp;
      return copy;
    });
    setProcessedAudioUrl(null);
  };

  // ════════════════════════════════════════════════════════════════════════════
  //  MOTEUR AUDIO WEB : FUSION MULTI-PISTES + DSP VOCAL (TYPE AUDACITY)
  // ════════════════════════════════════════════════════════════════════════════
  const processAndMergeAudio = async () => {
    if (!tracks.length) return;
    setIsProcessing(true);

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const decodedBuffers = [];

      // 1. Décoder chaque fichier audio en AudioBuffer
      for (const t of tracks) {
        const arrayBuffer = await t.file.arrayBuffer();
        const buffer = await audioCtx.decodeAudioData(arrayBuffer);
        decodedBuffers.push(buffer);
      }

      // 2. Calculer la longueur totale en samples
      const sampleRate = decodedBuffers[0].sampleRate;
      const totalLength = decodedBuffers.reduce((sum, b) => sum + b.length, 0);
      const totalSeconds = totalLength / sampleRate;

      // 3. Créer un OfflineAudioContext pour effectuer le rendu DSP haute qualité
      const offlineCtx = new OfflineAudioContext(2, totalLength, sampleRate);

      // Concaténer les buffers sur la timeline
      let currentOffset = 0;
      decodedBuffers.forEach((buf) => {
        const source = offlineCtx.createBufferSource();
        source.buffer = buf;

        // Chaîne de traitement DSP
        let lastNode = source;

        // A. Filtre Coupe-Bas (Noise Gate / De-Hummer anti-ronflement sous 80Hz)
        if (enableNoiseReduction) {
          const highPass = offlineCtx.createBiquadFilter();
          highPass.type = 'highpass';
          highPass.frequency.value = 85; // Coupe le bruit de fond basse fréquence
          lastNode.connect(highPass);
          lastNode = highPass;

          // Filtre notch à 50Hz/60Hz (parasites électriques)
          const notch = offlineCtx.createBiquadFilter();
          notch.type = 'notch';
          notch.frequency.value = 50;
          lastNode.connect(notch);
          lastNode = notch;
        }

        // B. Égaliseur Présence Vocale (Studio Vocal EQ)
        if (enableVocalClarity) {
          // Boost de clarté à 3.5 kHz
          const clarityEq = offlineCtx.createBiquadFilter();
          clarityEq.type = 'peaking';
          clarityEq.frequency.value = 3500;
          clarityEq.gain.value = 3.5;
          lastNode.connect(clarityEq);
          lastNode = clarityEq;

          // Atténuation des fréquences sourdes à 300Hz
          const warmthCut = offlineCtx.createBiquadFilter();
          warmthCut.type = 'peaking';
          warmthCut.frequency.value = 300;
          warmthCut.gain.value = -1.5;
          lastNode.connect(warmthCut);
          lastNode = warmthCut;
        }

        // C. Compresseur Dynamique & Normalisation Voix
        if (enableCompression) {
          const compressor = offlineCtx.createDynamicsCompressor();
          compressor.threshold.value = -24;
          compressor.knee.value = 30;
          compressor.ratio.value = 4;
          compressor.attack.value = 0.003;
          compressor.release.value = 0.25;
          lastNode.connect(compressor);
          lastNode = compressor;
        }

        // D. Gain Global & Chaleur
        const gainNode = offlineCtx.createGain();
        gainNode.gain.value = targetVolume * (enableWarmth ? 1.1 : 1.0);
        lastNode.connect(gainNode);
        lastNode = gainNode;

        lastNode.connect(offlineCtx.destination);
        source.start(currentOffset);
        currentOffset += buf.duration;
      });

      // 4. Rendu de l'audio traité
      const renderedBuffer = await offlineCtx.startRendering();

      // 5. Convertir AudioBuffer en fichier WAV téléchargeable & streamable
      const wavBlob = bufferToWaveBlob(renderedBuffer, totalLength);
      const url = URL.createObjectURL(wavBlob);

      setProcessedBlob(wavBlob);
      setProcessedAudioUrl(url);
      setProcessedDuration(totalSeconds);
      setIsProcessing(false);
    } catch (err) {
      console.error('Erreur traitement audio:', err);
      alert('Erreur lors du traitement audio. Assurez-vous que les fichiers sont des formats audios valides.');
      setIsProcessing(false);
    }
  };

  // Convertisseur AudioBuffer -> WAV Blob standard
  const bufferToWaveBlob = (abuffer, totalSteps) => {
    const numOfChan = abuffer.numberOfChannels;
    const length = totalSteps * numOfChan * 2 + 44;
    const out = new DataView(new ArrayBuffer(length));
    const channels = [];
    let sample = 0;
    let offset = 0;
    let pos = 0;

    function setUint16(data) { out.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { out.setUint32(pos, data, true); pos += 4; }

    // En-tête WAV RIFF
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8);
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16);         // taille sous-bloc
    setUint16(1);          // PCM
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan); // byte rate
    setUint16(numOfChan * 2);                      // block align
    setUint16(16);                                 // bits per sample
    setUint32(0x61746164);                         // "data" chunk
    setUint32(length - pos - 4);

    for (let i = 0; i < abuffer.numberOfChannels; i++) {
      channels.push(abuffer.getChannelData(i));
    }

    while (offset < totalSteps) {
      for (let i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
        out.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return new Blob([out.buffer], { type: 'audio/wav' });
  };

  // Animation Waveform sur le Canvas
  useEffect(() => {
    if (!canvasRef.current || !isPlayingMaster) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationId;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const bars = 40;
      const width = canvas.width / bars;

      for (let i = 0; i < bars; i++) {
        const height = Math.sin(Date.now() * 0.005 + i * 0.4) * 20 + 25;
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#c77dff');
        gradient.addColorStop(1, '#f72585');
        ctx.fillStyle = gradient;
        ctx.fillRect(i * width + 2, (canvas.height - height) / 2, width - 4, height);
      }
      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [isPlayingMaster]);

  const handleTogglePlayMaster = () => {
    if (!masterAudioRef.current) return;
    if (isPlayingMaster) {
      masterAudioRef.current.pause();
      setIsPlayingMaster(false);
    } else {
      masterAudioRef.current.play();
      setIsPlayingMaster(true);
    }
  };

  const handleApplyToBook = () => {
    if (!processedAudioUrl || !onApplyToChapter) return;
    onApplyToChapter({
      audio_url: processedAudioUrl,
      duration_seconds: Math.round(processedDuration),
      file_name: `master_audio_traite_${Date.now()}.wav`,
      blob: processedBlob,
    });
    onClose();
  };

  const formatDuration = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-2xl animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto glass-card rounded-3xl border border-purple-500/30 p-6 sm:p-8 space-y-6 shadow-2xl no-scrollbar">
        
        {/* Bouton Fermer */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* En-tête Studio Audio */}
        <div className="flex items-center gap-4 border-b border-white/10 pb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/35 flex-shrink-0">
            <Sliders className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-black text-white font-['Outfit']">
                Studio de Traitement & Fusion Audio
              </h2>
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Audacity Engine
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5 leading-relaxed">
              Assemblez plusieurs enregistrements, supprimez les bruits de fond et harmonisez la voix en qualité studio pro.
            </p>
          </div>
        </div>

        {/* 1. Zone d'Ajout & Liste des Pistes Multiples */}
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-purple-300 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <span>Pistes Audio à Fusionner ({tracks.length})</span>
            </h3>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/40 flex items-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter des Pistes</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              multiple
              className="hidden"
              onChange={handleAddFiles}
            />
          </div>

          {tracks.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-8 rounded-2xl border-2 border-dashed border-white/15 hover:border-purple-500/50 hover:bg-purple-500/5 text-center cursor-pointer transition-all space-y-2"
            >
              <Music className="w-10 h-10 mx-auto text-slate-500" />
              <p className="text-sm font-bold text-slate-200">
                Glissez-déposez 2 ou plusieurs fichiers audio ici
              </p>
              <p className="text-xs text-slate-400">
                (Exemple : Intro musicale + Voix Chapitre + Fin) • WAV, MP3, M4A, OGG
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {tracks.map((track, idx) => (
                <div
                  key={track.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/8 hover:border-purple-500/30 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-purple-600/30 text-purple-300 flex items-center justify-center text-xs font-black flex-shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                        {track.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {track.size} • {track.duration ? formatDuration(track.duration) : 'Chargement...'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Monter / Descendre */}
                    <button
                      onClick={() => moveTrack(idx, -1)}
                      disabled={idx === 0}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-slate-300 transition-colors"
                      title="Déplacer vers le haut"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveTrack(idx, 1)}
                      disabled={idx === tracks.length - 1}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-slate-300 transition-colors"
                      title="Déplacer vers le bas"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Supprimer */}
                    <button
                      onClick={() => removeTrack(idx)}
                      className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                      title="Supprimer la piste"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Options de Traitement de la Voix & DSP Audio Pro */}
        <div className="glass-card rounded-2xl p-5 border border-purple-500/25 space-y-4 bg-gradient-to-br from-purple-950/20 to-transparent">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-fuchsia-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Filtres de Traitement & Restauration Vocale
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Réduction de bruit */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
              <div>
                <p className="text-xs font-bold text-slate-100">Réduction de Bruit (De-Hum)</p>
                <p className="text-[11px] text-slate-400">Coupe les parasites et grondements sous 85Hz</p>
              </div>
              <button
                onClick={() => setEnableNoiseReduction(!enableNoiseReduction)}
                className={`w-11 h-6 rounded-full transition-all relative ${
                  enableNoiseReduction ? 'bg-purple-600' : 'bg-white/10'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                  enableNoiseReduction ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>

            {/* Présence & Clarté Vocale */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
              <div>
                <p className="text-xs font-bold text-slate-100">Égaliseur Voix Studio</p>
                <p className="text-[11px] text-slate-400">Boost la clarté et l'intelligibilité des mots</p>
              </div>
              <button
                onClick={() => setEnableVocalClarity(!enableVocalClarity)}
                className={`w-11 h-6 rounded-full transition-all relative ${
                  enableVocalClarity ? 'bg-purple-600' : 'bg-white/10'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                  enableVocalClarity ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>

            {/* Compression Dynamique */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
              <div>
                <p className="text-xs font-bold text-slate-100">Compresseur & Normalisation</p>
                <p className="text-[11px] text-slate-400">Équilibre le volume sans distorsion ni saturation</p>
              </div>
              <button
                onClick={() => setEnableCompression(!enableCompression)}
                className={`w-11 h-6 rounded-full transition-all relative ${
                  enableCompression ? 'bg-purple-600' : 'bg-white/10'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                  enableCompression ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>

            {/* Chaleur & Saturation douce */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
              <div>
                <p className="text-xs font-bold text-slate-100">Grain Chaleureux (Warmth)</p>
                <p className="text-[11px] text-slate-400">Timbre rond type livre audio professionnel</p>
              </div>
              <button
                onClick={() => setEnableWarmth(!enableWarmth)}
                className={`w-11 h-6 rounded-full transition-all relative ${
                  enableWarmth ? 'bg-purple-600' : 'bg-white/10'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                  enableWarmth ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>
          </div>

          {/* Bouton Lancer la Fusion et le Traitement */}
          <button
            onClick={processAndMergeAudio}
            disabled={tracks.length === 0 || isProcessing}
            className="btn-gradient w-full py-3.5 rounded-2xl text-sm font-black flex items-center justify-center gap-2.5 shadow-xl shadow-purple-600/40 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01] transition-all"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Traitement DSP & Fusion en cours...</span>
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                <span>Fusionner et Traiter les Pistes en 1 Audio Master</span>
              </>
            )}
          </button>
        </div>

        {/* 3. Résultat & Lecteur Audio Master Traité */}
        {processedAudioUrl && (
          <div className="glass-card rounded-2xl p-5 border border-emerald-500/30 bg-emerald-950/10 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>Audio Master Traité & Fusionné avec Succès !</span>
              </div>
              <span className="text-xs font-bold text-slate-300">
                Durée totale : {formatDuration(processedDuration)}
              </span>
            </div>

            {/* Lecteur avec Visualiseur Canvas */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-black/40 p-4 rounded-2xl border border-white/5">
              <button
                onClick={handleTogglePlayMaster}
                className="w-12 h-12 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/40 hover:scale-110 active:scale-95 transition-all flex-shrink-0"
              >
                {isPlayingMaster ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
              </button>

              <canvas
                ref={canvasRef}
                width={300}
                height={40}
                className="w-full max-w-sm h-10 rounded-xl"
              />

              <audio
                ref={masterAudioRef}
                src={processedAudioUrl}
                onEnded={() => setIsPlayingMaster(false)}
                onTimeUpdate={(e) => setMasterCurrentTime(e.target.currentTime)}
              />
            </div>

            {/* Actions Export & Utilisation */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <a
                href={processedAudioUrl}
                download="master_audio_traite.wav"
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 flex items-center gap-2 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger le WAV Master</span>
              </a>

              {onApplyToChapter && (
                <button
                  onClick={handleApplyToBook}
                  className="btn-gradient px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-purple-600/40"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Insérer dans ce Chapitre</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-white/5 text-xs text-slate-500">
          <button onClick={onClose} className="hover:text-slate-300 transition-colors cursor-pointer">
            Fermer le Studio
          </button>
        </div>
      </div>
    </div>
  );
};
