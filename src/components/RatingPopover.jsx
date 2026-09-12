import React from 'react';
import { Star } from 'lucide-react';

export const RatingPopover = ({
  userRating,
  hoverRating,
  setHoverRating,
  onApplyRating,
  feedback,
  positionClass = 'bottom-full mb-2 left-1/2 -translate-x-1/2',
}) => {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`absolute ${positionClass} z-50 p-2.5 rounded-2xl bg-[#180930]/98 border border-purple-400/60 shadow-[0_10px_30px_rgba(0,0,0,0.85)] backdrop-blur-2xl flex flex-col items-center gap-1.5 whitespace-nowrap animate-slideUp`}
    >
      <span className="text-[9.5px] font-black text-purple-200 uppercase tracking-wider">
        {userRating ? `Votre avis : ${userRating}/5` : 'Noter cet audio :'}
      </span>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={(e) => onApplyRating(star, e)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-1 hover:scale-130 active:scale-90 transition-transform cursor-pointer"
            title={`Donner ${star} étoile${star > 1 ? 's' : ''}`}
          >
            <Star
              className={`w-4 h-4 transition-colors ${
                (hoverRating || userRating || 0) >= star
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-slate-500 fill-slate-700/50'
              }`}
            />
          </button>
        ))}
      </div>
      {feedback ? (
        <span className="text-[9px] text-emerald-400 font-bold animate-pulse">
          {feedback}
        </span>
      ) : (
        <span className="text-[8.5px] text-purple-300/70">
          Application immédiate (+10 pts ⭐)
        </span>
      )}
    </div>
  );
};
