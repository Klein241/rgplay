import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Menu, ChevronLeft } from 'lucide-react';

/**
 * ArtistHeroPlayer - Rendu exact de l'écran 1 (Lecteur Immersif Plein Écran)
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
  onOpenList,
  onBack,
}) => {
  const clampedProgress = Math.min(Math.max(progress || 0, 0), 1);
  const startAngle = 145;
  const sweepAngle = 250;
  const currentAngle = startAngle + clampedProgress * sweepAngle;
  const radians = (currentAngle * Math.PI) / 180;

  const radius = 145;
  const centerX = 160;
  const centerY = 160;
  const thumbX = centerX + radius * Math.cos(radians);
  const thumbY = centerY + radius * Math.sin(radians);

  const handleDialClick = (e) => {
    if (!onSeek || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const dist = Math.sqrt(x * x + y * y);
    if (dist < 105 || dist > 175) return;
    let deg = (Math.atan2(y, x) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    let rel = deg - startAngle;
    if (rel < 0) rel += 360;
    if (rel <= sweepAngle) {
      const p = Math.min(Math.max(rel / sweepAngle, 0), 1);
      onSeek(p * duration);
    }
  };

  const ticksCount = 38;
  const ticks = Array.from({ length: ticksCount }).map((_, i) => {
    const tickProgress = i / (ticksCount - 1);
    const angle = startAngle + tickProgress * sweepAngle;
    const rad = (angle * Math.PI) / 180;
    const rInner = 136;
    const rOuter = i % 2 === 0 ? 148 : 142;
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

  const displayName = artist.name || 'VICTOIRE K';
  const trackTitle = currentTrack?.title || 'Emmanuel';

  return (
    <div className="relative flex flex-col justify-between w-full max-w-sm sm:max-w-md mx-auto min-h-[90vh] py-3 px-4 select-none">
      {/* ── BARRE SUPÉRIEURE : RETOUR < ET MENU = ── */}
      <div className="flex items-center justify-between z-30 pt-1">
        <button
          onClick={onBack}
          className="p-2.5 rounded-full text-white/90 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          title="Retour"
        >
          <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
        </button>

        <span className="text-[11px] font-black uppercase tracking-widest text-purple-300/80 font-['Outfit']">
          {displayName}
        </span>

        <button
          onClick={onOpenList}
          className="p-2.5 rounded-full text-white/90 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer flex flex-col gap-1 items-end justify-center"
          title="Ouvrir la liste des albums & chansons"
        >
          <span className="w-5 h-0.5 bg-white rounded-full" />
          <span className="w-3.5 h-0.5 bg-white rounded-full" />
        </button>
      </div>

      {/* ── CORPS CENTRAL : TYPOGRAPHIE GÉANTE + ARCHE PORTRAIT + CADRAN CIRCULAIRE ── */}
      <div className="relative flex flex-col items-center justify-center my-auto">
        {/* Typographie monumentale derrière la tête */}
        <div className="absolute top-0 inset-x-0 overflow-hidden flex justify-center pointer-events-none z-0">
          <h1
            className="text-[4.2rem] sm:text-[5.5rem] font-black uppercase tracking-tighter text-white/20 whitespace-nowrap font-['Outfit'] select-none transform -translate-y-4 scale-y-125"
            style={{ letterSpacing: '-0.05em' }}
          >
            {displayName}
          </h1>
        </div>

        {/* Zone circulaire Dial + Arche Photo */}
        <div className="relative z-10 w-[320px] h-[320px] flex items-center justify-center mt-8">
          <svg
            onClick={handleDialClick}
            className="absolute inset-0 w-full h-full z-20 cursor-pointer"
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

            {/* Graduations rayonnantes */}
            {ticks.map((t, i) => (
              <line
                key={i}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={t.isPassed ? '#c084fc' : 'rgba(255, 255, 255, 0.20)'}
                strokeWidth={t.isPassed ? '2.5' : '1.5'}
                strokeLinecap="round"
                style={{
                  filter: t.isPassed ? 'drop-shadow(0 0 5px rgba(192, 132, 252, 0.9))' : 'none',
                }}
              />
            ))}

            {/* Curseur boule violet lumineux (Thumb) */}
            <circle
              cx={thumbX}
              cy={thumbY}
              r="7.5"
              fill="#c084fc"
              stroke="#ffffff"
              strokeWidth="2.5"
              style={{
                filter: 'drop-shadow(0 0 10px rgba(192, 132, 252, 1)) drop-shadow(0 0 20px rgba(168, 85, 247, 0.8))',
              }}
            />
          </svg>

          {/* Arche du portrait avec les vraies photos de Victoire K */}
          <div
            className="relative w-[220px] h-[255px] overflow-hidden rounded-t-[110px] rounded-b-[110px] border border-white/20 shadow-2xl z-10"
            style={{
              background: 'linear-gradient(180deg, rgba(30, 18, 50, 0.9) 0%, rgba(10, 5, 20, 0.98) 100%)',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.9), 0 0 30px rgba(168, 85, 247, 0.3) inset'
            }}
          >
            <img
              src={currentTrack?.cover_url || artist.photo_url}
              alt={artist.name}
              className="w-full h-full object-cover object-top scale-105"
            />
            {/* Dégradé fondu sombre au bas de l'arche */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

            {/* Titre et Artiste superposés au bas de l'arche comme dans le screenshot */}
            <div className="absolute bottom-4 inset-x-0 text-center px-2 z-10">
              <h2 className="text-base font-black text-white font-['Outfit'] tracking-tight truncate drop-shadow-md">
                {trackTitle}
              </h2>
              <p className="text-[11px] text-purple-200/90 font-medium tracking-wide truncate mt-0.5">
                {currentTrack?.artist || artist.name}
              </p>
            </div>
          </div>
        </div>

        {/* Temps mono et Reflet Inversé */}
        <div className="text-center mt-3 z-10">
          <span className="text-sm font-black font-mono tracking-wider text-purple-200">
            {formatTime(currentTime)}
          </span>

          <div className="h-6 overflow-hidden pointer-events-none select-none opacity-20 transform scale-y-[-1] -mt-1 blur-[0.4px]">
            <span className="text-xs font-black uppercase tracking-widest text-purple-300 font-['Outfit'] block bg-gradient-to-t from-white to-transparent bg-clip-text text-transparent">
              {trackTitle}
            </span>
          </div>
        </div>
      </div>

      {/* ── BARRE DE CONTRÔLE FLOTTANTE : CAPSULE EN VERRE (GLASS PILL) ── */}
      <div className="flex justify-center z-20 pb-4">
        <div
          className="flex items-center gap-7 px-8 py-3 rounded-full backdrop-blur-2xl border border-white/15"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(25, 12, 42, 0.70) 100%)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7), 0 1px 0 rgba(255, 255, 255, 0.15) inset'
          }}
        >
          <button
            onClick={onPrev}
            className="text-slate-300 hover:text-white transition-all transform active:scale-90 p-1 cursor-pointer"
            title="Piste précédente"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

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
