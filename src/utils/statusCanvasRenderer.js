/**
 * statusCanvasRenderer.js
 * Moteur de dessin Canvas 2D pour les vidéos de statut WhatsApp / Story RG Play (720x1280, 9:16).
 * Gère le fond flouté, la pochette, les textes, l'égaliseur animé, et
 * la zone de message personnalisé / transcription saisie par l'utilisateur.
 */

export const CANVAS_WIDTH = 720;
export const CANVAS_HEIGHT = 1280;

/**
 * Découpe un texte en lignes adaptées à une largeur maximale
 */
export function wrapText(ctx, text, maxWidth) {
  const words = (text || '').split(' ');
  const lines = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Charge une image de manière sécurisée avec fallback CORS
 */
export async function loadSafeImage(url) {
  if (!url) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      const imgFallback = new Image();
      imgFallback.onload = () => resolve(imgFallback);
      imgFallback.onerror = () => resolve(null);
      imgFallback.src = url;
    };
    img.src = url;
  });
}

/**
 * Rendu graphique d'une frame du statut WhatsApp
 */
export function drawStatusFrame(ctx, {
  elapsedMs,
  targetDurationMs,
  duration,
  coverImg,
  book,
  chapter,
  quoteText,
  hasQuote,
}) {
  const progressRatio = Math.min(elapsedMs / targetDurationMs, 1);

  // 1. Fond d'ambiance
  ctx.fillStyle = '#0e061c';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (coverImg) {
    ctx.save();
    ctx.filter = 'blur(45px) brightness(0.4) saturate(1.4)';
    ctx.drawImage(coverImg, -80, -80, CANVAS_WIDTH + 160, CANVAS_HEIGHT + 160);
    ctx.restore();
  }

  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  grad.addColorStop(0, 'rgba(10, 4, 20, 0.82)');
  grad.addColorStop(0.5, 'rgba(18, 7, 34, 0.55)');
  grad.addColorStop(1, 'rgba(8, 2, 16, 0.95)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 2. Barre de progression supérieure
  const barPadding = 32;
  const barWidth = CANVAS_WIDTH - (barPadding * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.beginPath();
  ctx.roundRect(barPadding, 30, barWidth, 6, 3);
  ctx.fill();

  ctx.fillStyle = '#22d3ee';
  ctx.beginPath();
  ctx.roundRect(barPadding, 30, barWidth * progressRatio, 6, 3);
  ctx.fill();

  // 3. Badge supérieur
  const badgeY = 56;
  ctx.fillStyle = 'rgba(168, 85, 247, 0.25)';
  ctx.beginPath();
  ctx.roundRect((CANVAS_WIDTH - 250) / 2, badgeY, 250, 34, 17);
  ctx.fill();
  ctx.strokeStyle = 'rgba(216, 180, 254, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#f3e8ff';
  ctx.font = 'bold 12.5px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🎧 RG PLAY • EN ÉCOUTE', CANVAS_WIDTH / 2, badgeY + 22);

  // 4. Pochette centrale
  const coverSize = hasQuote ? 320 : 420;
  const coverX = (CANVAS_WIDTH - coverSize) / 2;
  const coverY = hasQuote ? 115 : 135;

  ctx.save();
  ctx.shadowColor = 'rgba(168, 85, 247, 0.45)';
  ctx.shadowBlur = 35;
  ctx.fillStyle = '#1c0d36';
  ctx.beginPath();
  ctx.roundRect(coverX, coverY, coverSize, coverSize, 28);
  ctx.fill();
  ctx.restore();

  if (coverImg) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(coverX, coverY, coverSize, coverSize, 28);
    ctx.clip();
    ctx.drawImage(coverImg, coverX, coverY, coverSize, coverSize);
    ctx.restore();
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(coverX, coverY, coverSize, coverSize, 28);
  ctx.stroke();

  // 5. Titre & Auteur
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = hasQuote ? '900 28px "Outfit", sans-serif' : '900 34px "Outfit", sans-serif';
  const titleLines = wrapText(ctx, book?.title || 'Livre Audio', 620);
  let textY = hasQuote ? 475 : 610;
  titleLines.slice(0, 2).forEach((line) => {
    ctx.fillText(line, CANVAS_WIDTH / 2, textY);
    textY += hasQuote ? 36 : 44;
  });

  ctx.fillStyle = '#d8b4fe';
  ctx.font = hasQuote ? '600 18px sans-serif' : '600 22px sans-serif';
  ctx.fillText(book?.author || "Read's Great", CANVAS_WIDTH / 2, textY + 6);
  textY += hasQuote ? 28 : 38;

  // 6. ZONE DE MESSAGE UTILISATEUR / TRANSCRIPTION / CITATION
  if (hasQuote && quoteText) {
    const cleanText = quoteText.trim().replace(/^["“«]+|["”»]+$/g, '').trim();
    if (cleanText) {
      const quoteCardW = 630;
      const quoteCardX = (CANVAS_WIDTH - quoteCardW) / 2;
      const quoteCardY = textY + 10;
      const quotePadding = 20;

      // Adapter la taille de police si le message de l'utilisateur est long
      const isLong = cleanText.length > 70;
      const fontSize = isLong ? 21 : 25;
      const lineHeight = isLong ? 29 : 34;

      ctx.font = `italic 700 ${fontSize}px "Outfit", sans-serif`;
      const quoteLines = wrapText(ctx, `“ ${cleanText} ”`, quoteCardW - (quotePadding * 2));
      const displayedLines = quoteLines.slice(0, 4);
      const quoteCardH = Math.max((displayedLines.length * lineHeight) + (quotePadding * 2), 85);

      ctx.save();
      // Cadre glassmorphism sombre
      ctx.fillStyle = 'rgba(22, 9, 44, 0.90)';
      ctx.beginPath();
      ctx.roundRect(quoteCardX, quoteCardY, quoteCardW, quoteCardH, 20);
      ctx.fill();

      // Bordure dorée lumineuse
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.50)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Texte du message utilisateur
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'center';
      let qY = quoteCardY + quotePadding + (fontSize * 0.88);
      displayedLines.forEach((line) => {
        ctx.fillText(line, CANVAS_WIDTH / 2, qY);
        qY += lineHeight;
      });
      ctx.restore();
    }
  }

  // 7. Égaliseur audio animé
  const eqBaseY = hasQuote ? 960 : 890;
  const barCount = 28;
  const eqSpacing = 16;
  const eqStartX = (CANVAS_WIDTH - (barCount * eqSpacing)) / 2;
  const timeSec = elapsedMs / 1000;

  for (let i = 0; i < barCount; i++) {
    const wave1 = Math.sin(timeSec * 7 + i * 0.45);
    const wave2 = Math.cos(timeSec * 11 + i * 0.25);
    const wave3 = Math.sin(timeSec * 4 + i * 0.8);
    const heightFactor = Math.abs((wave1 * 0.5) + (wave2 * 0.3) + (wave3 * 0.2));
    const barHeight = 12 + (heightFactor * 75);

    const barX = eqStartX + (i * eqSpacing);
    const barY = eqBaseY - (barHeight / 2);

    const barGrad = ctx.createLinearGradient(0, barY, 0, barY + barHeight);
    barGrad.addColorStop(0, '#22d3ee');
    barGrad.addColorStop(0.5, '#c084fc');
    barGrad.addColorStop(1, '#ec4899');

    ctx.fillStyle = barGrad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, 8, barHeight, 4);
    ctx.fill();
  }

  // 8. Branding officiel RG Play
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px "Outfit", sans-serif';
  ctx.fillText("Disponible sur RG Play • Bibliothèque READ'S GREAT", CANVAS_WIDTH / 2, CANVAS_HEIGHT - 82);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '600 14px sans-serif';
  ctx.fillText("🎧 Écoutez l'œuvre complète sur RG Play", CANVAS_WIDTH / 2, CANVAS_HEIGHT - 54);
}
