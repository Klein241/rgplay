import React from 'react';
import { useAudiobookCardLogic } from './audiobook/useAudiobookCardLogic';
import { SquareCard } from './audiobook/SquareCard';
import { PillCard } from './audiobook/PillCard';
import { TrackCard } from './audiobook/TrackCard';

/**
 * AudiobookCard — Composant modulaire dispatchant selon le layout (square, pill, track)
 * Respect strict de AGENTS.md (< 400 lignes) et style Axolotl Glassmorphism
 */
export const AudiobookCard = ({
  book,
  onSelect,
  isPurchased = false,
  layout = 'square', // 'square' | 'pill' | 'track' | 'grid'
  onBuyClick,
  onViewDetails,
}) => {
  const logic = useAudiobookCardLogic({
    book,
    onSelect,
    isPurchased,
    onViewDetails,
  });

  if (!book) return null;

  if (layout === 'pill') {
    return (
      <PillCard
        book={book}
        onSelect={onSelect}
        onViewDetails={onViewDetails}
        logic={logic}
      />
    );
  }

  if (layout === 'track') {
    return (
      <TrackCard
        book={book}
        onSelect={onSelect}
        logic={logic}
      />
    );
  }

  return (
    <SquareCard
      book={book}
      onSelect={onSelect}
      onViewDetails={onViewDetails}
      logic={logic}
    />
  );
};
