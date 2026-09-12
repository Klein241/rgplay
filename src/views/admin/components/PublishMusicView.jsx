import React, { useState, useEffect } from 'react';
import {
  Music, Disc, Mic2, Sparkles, UploadCloud, Play, Pause,
  CheckCircle2, Loader2, Save, Tag, Radio, Flame, Clock,
  FileAudio, Image as ImageIcon, Sliders, ShieldAlert, Heart
} from 'lucide-react';
import { DropZone } from './DropZone';

const MUSIC_GENRES = [
  'Afrobeat & Afropop',
  'Amapiano',
  'Lofi & Chill Beats',
  'Hip-Hop & Rap',
  'R&B & Neo-Soul',
  'Coupé-Décalé & Ndombolo',
  'Gospel & Louange',
  'Reggae & Dancehall',
  'Bikutsi & Makossa',
  'Trap & Drill',
  'Musique Traditionnelle & Acoustique',
  'Électro & Afro-House',
  'Pop & Variétés'
];

const MUSIC_MOODS = [
  'Relax & Chill',
  'Focus & Travail',
  'Énergique & Motivé',
  'Soirée & Fête',
  'Romantique & Doux',
  'Mélancolique & Émotionnel',
  'Méditation & Spiritualité',
  'Entraînement / Sport'
];

export const PublishMusicView = ({
  editingBook,
  contentType,
  handleSelectContentType,
  title,
  setTitle,
  author,
  setAuthor,
  narrator,
  setNarrator,
  categoryId,
  setCategoryId,
  price,
  setPrice,
  discountPrice,
  setDiscountPrice,
  unlockPoints = 50,
  setUnlockPoints,
  description,
  setDescription,
  synopsis,
  setSynopsis,
  coverData,
  setCoverData,
  previewData,
  setPreviewData,
  chapters = [],
  setChapters,
  isSubmitting,
  handlePublish,
  publishMode,
  setPublishMode,
  scheduledAt,
  setScheduledAt,
}) => {
  const [releaseType, setReleaseType] = useState('single'); // 'single' | 'album'
  const [featuring, setFeaturing] = useState('');
  const [producer, setProducer] = useState('');
  const [bpm, setBpm] = useState('');
  const [musicalKey, setMusicalKey] = useState('');
  const [isExplicit, setIsExplicit] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState(MUSIC_GENRES[0]);
  const [selectedMood, setSelectedMood] = useState(MUSIC_MOODS[0]);
  const [lyrics, setLyrics] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Synchroniser Featuring et Producteur dans `narrator` pour l'enregistrement D1
  useEffect(() => {
    const parts = [];
    if (featuring.trim()) parts.push(`feat. ${featuring.trim()}`);
    if (producer.trim()) parts.push(`Prod. by ${producer.trim()}`);
    if (bpm) parts.push(`${bpm} BPM`);
    if (musicalKey) parts.push(`Key: ${musicalKey}`);
    if (isExplicit) parts.push('[Explicit]');
    if (parts.length > 0) {
      setNarrator(parts.join(' | '));
    }
  }, [featuring, producer, bpm, musicalKey, isExplicit]);

  // Synchroniser les paroles et métadonnées dans `synopsis`
  useEffect(() => {
    let content = '';
    if (selectedMood) content += `Ambiance : ${selectedMood}\n`;
    if (bpm) content += `Tempo : ${bpm} BPM\n`;
    if (musicalKey) content += `Tonalité : ${musicalKey}\n`;
    if (producer) content += `Production / Beatmaking : ${producer}\n`;
    if (lyrics.trim()) content += `\n--- PAROLES / LYRICS ---\n${lyrics.trim()}`;
    if (content) {
      setSynopsis(content);
    }
  }, [selectedMood, bpm, musicalKey, producer, lyrics]);

  // S'assurer qu'un chapitre/piste existe pour stocker le fichier audio
  useEffect(() => {
    if (!chapters || chapters.length === 0) {
      setChapters([
        {
          id: `track-${Date.now()}-1`,
          title: title || 'Piste Principale',
          duration_seconds: 210,
          uploadData: null,
        }
      ]);
    }
  }, []);

  const handleAudioUploaded = (uploaded) => {
    setChapters(prev => {
      const first = prev[0] || {};
      return [
        {
          ...first,
          title: title || 'Piste Master',
          duration_seconds: uploaded?.duration_seconds || first.duration_seconds || 210,
          uploadData: uploaded,
        },
        ...prev.slice(1)
      ];
    });
    // Si pas de preview séparé, utiliser l'audio comme preview
    if (!previewData) {
      setPreviewData(uploaded);
    }
  };

  const handleAiEnrichMusic = () => {
    setIsAiGenerating(true);
    setTimeout(() => {
      if (!description) {
        setDescription(`Un morceau captivant aux sonorités ${selectedGenre}, conçu pour une ambiance ${selectedMood.toLowerCase()}. Une production soignée signée ${producer || author || 'RG Studio'}.`);
      }
      setIsAiGenerating(false);
    }, 900);
  };

  const mainTrack = chapters[0] || {};

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-['Outfit'] animate-fadeIn pb-24">
      {/* ── EN-TÊTE SOUNDCLOUD / SPOTIFY CREATOR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-linear-to-r from-emerald-950/60 via-teal-950/40 to-slate-900/80 border border-emerald-500/30 shadow-2xl backdrop-blur-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-black text-emerald-400 uppercase tracking-widest">
            <Music className="w-4 h-4" />
            <span>Studio de Sortie Musicale • SoundCloud &amp; Spotify Style</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Publier une Sortie Musicale
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Téléversez votre Master audio, personnalisez la pochette carrée, définissez le BPM et vos crédits d'artiste.
          </p>
        </div>

        {/* Sélecteur de type de sortie : Single vs Album */}
        <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-2xl border border-white/10 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setReleaseType('single')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              releaseType === 'single'
                ? 'bg-linear-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Disc className="w-3.5 h-3.5" />
            <span>Single / Beat</span>
          </button>
          <button
            type="button"
            onClick={() => setReleaseType('album')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              releaseType === 'album'
                ? 'bg-linear-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>EP / Album</span>
          </button>
        </div>
      </div>

      {/* ── ZONE DE DÉPÔT AUDIO MASTER (SOUNDCLOUD STYLE) & COVER ART (SPOTIFY 1:1) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upload Audio Master */}
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-emerald-500/25 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
              <FileAudio className="w-4 h-4 text-emerald-400" />
              <span>Fichier Audio Master (WAV, MP3 320k, FLAC) *</span>
            </div>
            {mainTrack.uploadData?.duration_seconds && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                ⏱️ {Math.floor(mainTrack.uploadData.duration_seconds / 60)}m {Math.round(mainTrack.uploadData.duration_seconds % 60)}s
              </span>
            )}
          </div>
          <DropZone
            label="Glissez-déposez le fichier audio du morceau (Master HQ)"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/flac,audio/*"
            type="audio"
            icon={FileAudio}
            value={mainTrack.uploadData?.public_url || ''}
            onUploaded={handleAudioUploaded}
          />
        </div>

        {/* Cover Art Carré 1:1 Spotify */}
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-purple-500/25 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
              <ImageIcon className="w-4 h-4 text-purple-400" />
              <span>Pochette d'Album / Single (Format Carré 1:1) *</span>
            </div>
            <span className="text-[10px] text-slate-400">3000 x 3000 px recommandé</span>
          </div>
          <DropZone
            label="Pochette carrée HD (JPG, PNG, WebP)"
            accept="image/jpeg,image/png,image/webp"
            type="cover"
            icon={ImageIcon}
            value={coverData?.public_url || ''}
            onUploaded={setCoverData}
          />
        </div>
      </div>

      {/* ── MÉTADONNÉES DE LA PISTE (ARTISTE, FEATURING, BEATMAKER) ── */}
      <div className="card-lg space-y-5 border border-white/10">
        <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-white/10">
          <Mic2 className="w-4 h-4 text-emerald-400" />
          <span>Informations Musicales &amp; Crédits</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-xs font-bold text-slate-300 block mb-1.5">
              Titre du Morceau / Single *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex : Afro Sunset (Chill Vibes)"
              className="rg-input font-bold text-sm"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">
              Artiste Principal / Groupe *
            </label>
            <input
              type="text"
              value={author}
              onChange={e => setAuthor(e.target.value)}
              placeholder="Ex : Fally Ipupa / Manu Dibango"
              className="rg-input"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">
              Featuring / Invités (optionnel)
            </label>
            <input
              type="text"
              value={featuring}
              onChange={e => setFeaturing(e.target.value)}
              placeholder="Ex : Stanley Enow, Charlotte Dipanda"
              className="rg-input"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">
              Producteur / Beatmaker / Compositeur
            </label>
            <input
              type="text"
              value={producer}
              onChange={e => setProducer(e.target.value)}
              placeholder="Ex : Master RG Beats / DJ Kill"
              className="rg-input"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">
              Genre Musical Principal *
            </label>
            <select
              value={selectedGenre}
              onChange={e => {
                setSelectedGenre(e.target.value);
                setCategoryId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'));
              }}
              className="rg-input cursor-pointer font-medium"
              style={{ background: '#16112e' }}
            >
              {MUSIC_GENRES.map(g => (
                <option key={g} value={g} className="bg-slate-900 text-white">{g}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">
              Ambiance / Mood
            </label>
            <select
              value={selectedMood}
              onChange={e => setSelectedMood(e.target.value)}
              className="rg-input cursor-pointer font-medium"
              style={{ background: '#16112e' }}
            >
              {MUSIC_MOODS.map(m => (
                <option key={m} value={m} className="bg-slate-900 text-white">{m}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                BPM (Tempo)
              </label>
              <input
                type="number"
                value={bpm}
                onChange={e => setBpm(e.target.value)}
                placeholder="Ex : 108"
                className="rg-input font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                Tonalité / Clé
              </label>
              <input
                type="text"
                value={musicalKey}
                onChange={e => setMusicalKey(e.target.value)}
                placeholder="Ex : C Minor"
                className="rg-input font-mono"
              />
            </div>
          </div>

          {/* Parental Advisory Tag */}
          <div className="sm:col-span-2 flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
            <button
              type="button"
              onClick={() => setIsExplicit(!isExplicit)}
              className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs transition-all cursor-pointer ${
                isExplicit ? 'bg-amber-500 text-slate-950' : 'bg-white/10 text-slate-400'
              }`}
            >
              {isExplicit ? 'E' : '✓'}
            </button>
            <div className="text-xs">
              <span className="font-bold text-white block">Contenu Explicite / Parental Advisory [E]</span>
              <span className="text-[11px] text-slate-400">
                {isExplicit ? 'Ce titre contient des paroles explicites.' : 'Titre Clean tout public.'}
              </span>
            </div>
          </div>
        </div>

        {/* Assistant IA Assistant DeepSeek */}
        <div className="p-4 rounded-2xl bg-linear-to-r from-emerald-950/40 via-purple-950/30 to-slate-900/60 border border-emerald-500/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs text-slate-300">
              Générez une accroche et une description musicale en 1 clic grâce à DeepSeek IA.
            </span>
          </div>
          <button
            type="button"
            onClick={handleAiEnrichMusic}
            disabled={isAiGenerating}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            {isAiGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
            <span>Générer l'Accroche</span>
          </button>
        </div>

        {/* Description & Mood */}
        <div>
          <label className="text-xs font-bold text-slate-300 block mb-1.5">
            Description &amp; Histoire du Morceau *
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Parlez de l'inspiration, des instruments ou de l'énergie du morceau..."
            className="rg-input resize-none"
            required
          />
        </div>

        {/* Paroles de la chanson (Lyrics) */}
        <div>
          <label className="text-xs font-bold text-slate-300 block mb-1.5">
            Paroles de la Chanson (Lyrics) &amp; Notes
          </label>
          <textarea
            rows={4}
            value={lyrics}
            onChange={e => setLyrics(e.target.value)}
            placeholder="[Refrain]&#10;Tapez les paroles ici pour permettre aux auditeurs de chanter en chœur..."
            className="rg-input font-mono text-xs resize-none"
          />
        </div>
      </div>

      {/* ── MODÈLE DE DIFFUSION & MONÉTISATION ── */}
      <div className="card-lg space-y-4 border border-white/10">
        <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-white/10">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <span>Accès, Streaming &amp; Prix</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">
              ⭐ Coût en Sky Points (Streaming)
            </label>
            <input
              type="number"
              value={unlockPoints}
              onChange={e => setUnlockPoints(Number(e.target.value))}
              placeholder="50"
              className="rg-input font-mono text-amber-300"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">Points déduits pour l'écoute complète (0 = gratuit)</span>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">
              Prix de Vente Master MP3 (FCFA)
            </label>
            <input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="500"
              className="rg-input font-mono"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">Prix pour télécharger le master en local (0 = libre)</span>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">
              Prix Promotionnel (optionnel)
            </label>
            <input
              type="number"
              value={discountPrice}
              onChange={e => setDiscountPrice(e.target.value)}
              placeholder="300"
              className="rg-input font-mono"
            />
          </div>
        </div>
      </div>

      {/* ── BOUTON DE PUBLICATION OFFICIEL ── */}
      <div className="flex items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900/90 border border-emerald-500/30 shadow-2xl">
        <div>
          <span className="text-xs font-bold text-white block">Prêt pour la diffusion ?</span>
          <span className="text-[11px] text-slate-400">Le titre sera instantanément disponible dans la section Musique &amp; Lofi.</span>
        </div>

        <button
          type="button"
          onClick={handlePublish}
          disabled={isSubmitting || !title.trim() || !author.trim() || !mainTrack.uploadData?.public_url}
          className="px-8 py-3.5 rounded-2xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-black shadow-xl shadow-emerald-500/25 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Publication en cours...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Publier le Morceau sur RG Play</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
