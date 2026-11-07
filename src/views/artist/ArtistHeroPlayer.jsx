import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, Sparkles } from 'lucide-react';

/**
 * ArtistHeroPlayer - Rendu fidèle au design de référence (Écran 1 / Gauche)
 * Comprend :
 * - Typographie monumentale en arrière-plan (Nom de l'artiste)
 * - Arche / Cadre courbé avec la photo de l'artiste
 * - Cadran circulaire (Radial Arc Dial) avec graduations rayonnantes
 * - Curseur circulaire violet lumineux se déplaçant le long de l'arc
 * - Titre de la chanson avec effet miroir / reflet estompé
 * - Capsule flottante en verre dépoli (Glass Pill) avec bouton Play/Pause violet néon
 */
export const ArtistHeroPlayer = ({
  artist,
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  progress,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  isShuffle,
  onToggleShuffle,
  isRepeat,
  onToggleRepeat,
}) => {
  // Calcul de la position angulaire du curseur le long de l'arc (-120° à +120°)
  // L'arc couvre 240 degrés en bas de l'image
  const clampedProgress = Math.min(Math.max(progress || 0, 0), 1);
  const startAngle = 145; // angle en degrés
  const sweepAngle = 250;
  const currentAngle = startAngle + clampedProgress * sweepAngle;
  const radians = (currentAngle * Math.PI) / 180;

  // Coordonnées trigonométriques pour le cercle de rayon R = 155
  const radius = 150;
  const centerX = 160;
  const centerY = 160;
  const thumbX = centerX + radius * Math.cos(radians);
  const thumbY = centerY + radius * Math.sin(radians);

  // Génération des 36 graduations rayonnantes (tick marks)
  const ticksCount = 36;
  const ticks = Array.from({ length: ticksCount }).map((_, i) => {
    const tickProgress = i / (ticksCount - 1);
    const angle = startAngle + tickProgress * sweepAngle;
    const rad = (angle * Math.PI) / 180;
    const rInner = 140;
    const rOuter = i % 3 === 0 ? 152 : 146;
    const x1 = centerX + rInner * Math.cos(rad);
    const y1 = centerY + rInner * Math.sin(rad);
    const x2 = centerX + rOuter * Math.cos(rad);
    const y2 = centerY + rOuter * Math.sin(rad);
    const isPassed = tickProgress <= clampedProgress;
    return { x1, y1, x2, y2, isPassed };
  });

  const formatTime = (sec) => {
    if (!sec || isNaN(sec)) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative flex flex-col items-center justify-center w-full max-w-md mx-auto select-none pt-4 pb-6">
      {/* ── 1. TYPOGRAPHIE MONUMENTALE EN ARRIÈRE-PLAN ── */}
      <div className="absolute top-2 left-0 right-0 overflow-hidden flex justify-center pointer-events-none z-0">
        <h1
          className="text-[4.5rem] sm:text-[6rem] font-black uppercase tracking-tighter text-white/[0.07] whitespace-nowrap font-['Outfit'] transform -translate-y-2 scale-y-110"
          style={{ letterSpacing: '-0.06em' }}
        >
          {artist.name || 'VICTOIRE K'}
        </h1>
      </div>

      {/* ── 2. CADRE DU PORTRAIT & DIAL CIRCULAIRE RAYONNANT ── */}
      <div className="relative z-10 w-[320px] h-[320px] flex items-center justify-center mt-6">
        {/* SVG du cadran avec les graduations et le curseur violet */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-20"
          viewBox="0 0 320 320"
        >
          {/* Ligne de base de l'arc */}
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Ticks rayonnants */}
          {ticks.map((t, i) => (
            <line
              key={i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.isPassed ? '#c084fc' : 'rgba(255, 255, 255, 0.16)'}
              strokeWidth={t.isPassed ? '2.5' : '1.5'}
              strokeLinecap="round"
              style={{
                filter: t.isPassed ? 'drop-shadow(0 0 4px rgba(192, 132, 252, 0.8))' : 'none',
                transition: 'stroke 0.15s ease'
              }}
            />
          ))}

          {/* Curseur boule violet lumineux (Thumb) */}
          <circle
            cx={thumbX}
            cy={thumbY}
            r="8"
            fill="#c084fc"
            stroke="#ffffff"
            strokeWidth="2.5"
            style={{
              filter: 'drop-shadow(0 0 10px rgba(192, 132, 252, 1)) drop-shadow(0 0 20px rgba(168, 85, 247, 0.7))',
              transition: 'cx 0.1s linear, cy 0.1s linear'
            }}
          />
        </svg>

        {/* L'Arche portrait (U-shape / rounded-b-full) */}
        <div
          className="relative w-[230px] h-[260px] overflow-hidden rounded-t-[115px] rounded-b-[115px] border border-white/20 shadow-2xl z-10"
          style={{
            background: 'linear-gradient(180deg, rgba(30, 20, 50, 0.8) 0%, rgba(10, 5, 20, 0.95) 100%)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 40px rgba(168, 85, 247, 0.25) inset'
          }}
        >
          <img
            src={currentTrack?.cover_url || artist.photo_url}
            alt={artist.name}
            className="w-full h-full object-cover object-top scale-105 hover:scale-110 transition-transform duration-700"
          />
          {/* Léger dégradé sombre en bas de la photo pour fondre le texte */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

          {/* Titre superposé au bas de l'arche comme dans le modèle */}
          <div className="absolute bottom-4 inset-x-0 text-center px-3 z-10">
            <h2 className="text-base font-black text-white font-['Outfit'] tracking-tight truncate drop-shadow-md">
              {currentTrack?.title || 'Born To Die'}
            </h2>
            <p className="text-[11px] text-purple-200/90 font-medium tracking-wide truncate mt-0.5">
              {currentTrack?.artist || artist.name}
            </p>
          </div>
        </div>
      </div>

      {/* ── 3. AFFICHAGE DU TEMPS (00:04) & EFFET MIROIR REFLET ── */}
      <div className="text-center mt-3 z-10">
        <span className="text-sm font-black font-mono tracking-wider text-purple-200">
          {formatTime(currentTime)}
        </span>

        {/* Texte miroir / reflet estompé inversé conforme au design */}
        <div className="h-6 overflow-hidden pointer-events-none select-none opacity-20 transform scale-y-[-1] -mt-1 blur-[0.5px]">
          <span
            className="text-xs font-black uppercase tracking-widest text-purple-300 font-['Outfit'] block bg-gradient-to-t from-white to-transparent bg-clip-text text-transparent"
          >
            {currentTrack?.title || 'BORN TO DIE'}
          </span>
        </div>
      </div>

      {/* ── 4. CAPSULE FLOTTANTE EN VERRE (GLASS PILL CONTROLS) ── */}
      <div className="mt-5 z-20">
        <div
          className="flex items-center gap-6 px-7 py-3 rounded-full backdrop-blur-2xl border border-white/15"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(20, 10, 35, 0.65) 100%)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), 0 1px 0 rgba(255, 255, 255, 0.15) inset'
          }}
        >
          {/* Bouton Piste Précédente */}
          <button
            onClick={onPrev}
            className="text-slate-300 hover:text-white transition-all transform active:scale-90 p-1 cursor-pointer"
            title="Piste précédente"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          {/* Bouton Principal PLAY / PAUSE VIOLET NÉON */}
          <button
            onClick={onTogglePlay}
            className="relative p-4 rounded-full text-white cursor-pointer transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #c084fc 0%, #a855f7 50%, #7e22ce 100%)',
              boxShadow: isPlaying
                ? '0 0 25px rgba(192, 132, 252, 0.8), 0 0 50px rgba(168, 85, 247, 0.5), 0 1px 0 rgba(255, 255, 255, 0.3) inset'
                : '0 10px 25px rgba(168, 85, 247, 0.4), 0 1px 0 rgba(255, 255, 255, 0.2) inset'
            }}
            title={isPlaying ? 'Pause' : 'Lecture'}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-current text-white" />
            ) : (
              <Play className="w-6 h-6 fill-current text-white translate-x-0.5" />
            )}
          </button>

          {/* Bouton Piste Suivante */}
          <button
            onClick={onNext}
            className="text-slate-300 hover:text-white transition-all transform active:scale-90 p-1 cursor-pointer"
            title="Piste suivante"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
        </div>
      </div>
    </div>
  );
};
