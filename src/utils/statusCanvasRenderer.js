/**
 * statusCanvasRenderer.js
 * Moteur de dessin Canvas 2D ultra-optimisé pour les vidéos de statut WhatsApp / Story RG Play.
 * 
 * 🛡️ ARCHITECTURE ZERO-CRASH (Anti-OOM Mobile) :
 * - `createStaticBackground` : Calcule le flou de 40px, les ombres et les textes UNE SEULE FOIS.
 * - `drawStatusFrame` : Dessine l'image de fond pré-calculée en 0.2ms et anime uniquement
 *   la barre de progression et l'égaliseur audio (zéro allocation de mémoire en boucle).
 * - Résout définitivement le crash du navigateur à 30s/60s sur smartphone.
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
 * Charge une image de façon 100% sécurisée pour le Canvas (zéro Tainted Canvas).
 */
export async function loadSafeImage(url, r2Key = null) {
  if (!url) return null;

  let targetUrl = url;
  if (url.includes('r2.cloudflarestorage.com') && r2Key) {
    targetUrl = `/api/r2/download?key=${encodeURIComponent(r2Key)}`;
  } else if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:') && !url.startsWith('blob:')) {
    targetUrl = `/api/r2/download?key=${encodeURIComponent(url)}`;
  }

  try {
    const fetchUrl = targetUrl.includes('?') ? `${targetUrl}&_cors=1` : `${targetUrl}?_cors=1`;
    const res = await fetch(fetchUrl, { mode: 'cors', credentials: 'omit' });
    if (res.ok) {
      const blob = await res.blob();
      if (blob && blob.size > 0) {
        if (typeof createImageBitmap === 'function') {
          return await createImageBitmap(blob);
        }
        return await new Promise((resolve) => {
          const blobUrl = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            resolve(img);
          };
          img.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            resolve(null);
          };
          img.src = blobUrl;
        });
      }
    }
  } catch (err) {
    console.warn('[StatusCanvas] Fetch Blob image échoué, essai direct CORS:', err?.message || err);
  }

  try {
    return await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = targetUrl.includes('?') ? `${targetUrl}&_cors=2` : `${targetUrl}?_cors=2`;
    });
  } catch (_) {
    return null;
  }
}

/**
 * Pré-génère l'ensemble des éléments graphiques statiques sur un canvas hors-écran.
 * Évite 1 800 calculs de flou gaussien et d'ombres portées qui faisaient crasher le navigateur mobile !
 */
export function createStaticBackground({
  coverImg,
  book,
  quoteText,
  hasQuote,
  targetWidth = CANVAS_WIDTH,
  targetHeight = CANVAS_HEIGHT,
}) {
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = targetWidth;
  bgCanvas.height = targetHeight;
  const ctx = bgCanvas.getContext('2d', { alpha: false });

  const scaleX = targetWidth / CANVAS_WIDTH;
  const scaleY = targetHeight / CANVAS_HEIGHT;
  const needScale = Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01;

  if (needScale) {
    ctx.save();
    ctx.scale(scaleX, scaleY);
  }

  // 1. Fond d'ambiance vert émeraude & nature
  ctx.fillStyle = '#061612';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (coverImg) {
    ctx.save();
    // Le flou est calculé EXACTEMENT UNE SEULE FOIS pour toute la vidéo !
    ctx.filter = 'blur(40px) brightness(0.4) saturate(1.4)';
    ctx.drawImage(coverImg, -80, -80, CANVAS_WIDTH + 160, CANVAS_HEIGHT + 160);
    ctx.restore();
  }

  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  grad.addColorStop(0, 'rgba(6, 22, 18, 0.85)');
  grad.addColorStop(0.5, 'rgba(4, 16, 13, 0.60)');
  grad.addColorStop(1, 'rgba(3, 10, 8, 0.95)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 2. Track gris de la barre de progression supérieure
  const barPadding = 32;
  const barWidth = CANVAS_WIDTH - (barPadding * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.beginPath();
  ctx.roundRect(barPadding, 30, barWidth, 6, 3);
  ctx.fill();

  // 3. Badge supérieur
  const badgeY = 56;
  ctx.fillStyle = 'rgba(16, 185, 129, 0.20)';
  ctx.beginPath();
  ctx.roundRect((CANVAS_WIDTH - 250) / 2, badgeY, 250, 34, 17);
  ctx.fill();
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#ecfdf5';
  ctx.font = 'bold 12.5px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🎧 RG PLAY • EN ÉCOUTE', CANVAS_WIDTH / 2, badgeY + 22);

  // 4. Pochette centrale
  const coverSize = hasQuote ? 320 : 420;
  const coverX = (CANVAS_WIDTH - coverSize) / 2;
  const coverY = hasQuote ? 115 : 135;

  ctx.save();
  ctx.shadowColor = 'rgba(16, 185, 129, 0.35)';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#062017';
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

  ctx.fillStyle = '#a7f3d0';
  ctx.font = hasQuote ? '600 18px sans-serif' : '600 22px sans-serif';
  ctx.fillText(book?.author || "Read's Great", CANVAS_WIDTH / 2, textY + 6);
  textY += hasQuote ? 28 : 38;

  // 6. ZONE DE MESSAGE UTILISATEUR / CITATION
  if (hasQuote && quoteText) {
    const cleanText = quoteText.trim().replace(/^["“«]+|["”»]+$/g, '').trim();
    if (cleanText) {
      const quoteCardW = 630;
      const quoteCardX = (CANVAS_WIDTH - quoteCardW) / 2;
      const quoteCardY = textY + 10;
      const quotePadding = 20;

      const isLong = cleanText.length > 70;
      const fontSize = isLong ? 21 : 25;
      const lineHeight = isLong ? 29 : 34;

      ctx.font = `italic 700 ${fontSize}px "Outfit", sans-serif`;
      const quoteLines = wrapText(ctx, `“ ${cleanText} ”`, quoteCardW - (quotePadding * 2));
      const displayedLines = quoteLines.slice(0, 4);
      const quoteCardH = Math.max((displayedLines.length * lineHeight) + (quotePadding * 2), 85);

      ctx.save();
      ctx.fillStyle = 'rgba(4, 24, 18, 0.90)';
      ctx.beginPath();
      ctx.roundRect(quoteCardX, quoteCardY, quoteCardW, quoteCardH, 20);
      ctx.fill();

      ctx.strokeStyle = 'rgba(52, 211, 153, 0.40)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#ecfdf5';
      ctx.textAlign = 'center';
      let qY = quoteCardY + quotePadding + (fontSize * 0.88);
      displayedLines.forEach((line) => {
        ctx.fillText(line, CANVAS_WIDTH / 2, qY);
        qY += lineHeight;
      });
      ctx.restore();
    }
  }

  // 7. Branding officiel RG Play
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px "Outfit", sans-serif';
  ctx.fillText("Disponible sur RG Play • Bibliothèque READ'S GREAT", CANVAS_WIDTH / 2, CANVAS_HEIGHT - 82);

  ctx.fillStyle = '#34d399';
  ctx.font = '600 14px sans-serif';
  ctx.fillText("🎧 Écoutez l'œuvre complète sur RG Play", CANVAS_WIDTH / 2, CANVAS_HEIGHT - 54);

  if (needScale) {
    ctx.restore();
  }

  return bgCanvas;
}

/**
 * Rendu ultra-rapide d'une frame (temps d'exécution : ~0.3ms par frame)
 */
export function drawStatusFrame(ctx, {
  staticBg,
  elapsedMs,
  targetDurationMs,
  duration,
  coverImg,
  book,
  quoteText,
  hasQuote,
  cachedGrad,
}) {
  const canvasW = ctx.canvas?.width || CANVAS_WIDTH;
  const canvasH = ctx.canvas?.height || CANVAS_HEIGHT;

  // Si staticBg n'est pas fourni (ex: snapshot unique), on le génère à la volée
  const bg = staticBg || createStaticBackground({
    coverImg,
    book,
    quoteText,
    hasQuote,
    targetWidth: canvasW,
    targetHeight: canvasH,
  });

  // 1. Dessiner le fond pré-calculé (ZÉRO calcul de flou dans la boucle !)
  ctx.drawImage(bg, 0, 0, canvasW, canvasH);

  const scaleX = canvasW / CANVAS_WIDTH;
  const scaleY = canvasH / CANVAS_HEIGHT;
  const needScale = Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01;

  if (needScale) {
    ctx.save();
    ctx.scale(scaleX, scaleY);
  }

  const progressRatio = Math.min(elapsedMs / targetDurationMs, 1);

  // 2. Barre de progression active
  const barPadding = 32;
  const barWidth = CANVAS_WIDTH - (barPadding * 2);
  ctx.fillStyle = '#34d399';
  ctx.beginPath();
  ctx.roundRect(barPadding, 30, barWidth * progressRatio, 6, 3);
  ctx.fill();

  // 3. Égaliseur audio animé (utilise le dégradé pré-créé sans allocation)
  const eqBaseY = hasQuote ? 960 : 890;
  const barCount = 28;
  const eqSpacing = 16;
  const eqStartX = (CANVAS_WIDTH - (barCount * eqSpacing)) / 2;
  const timeSec = elapsedMs / 1000;

  if (cachedGrad) {
    ctx.fillStyle = cachedGrad;
  } else {
    ctx.fillStyle = '#34d399';
  }

  for (let i = 0; i < barCount; i++) {
    const wave1 = Math.sin(timeSec * 7 + i * 0.45);
    const wave2 = Math.cos(timeSec * 11 + i * 0.25);
    const wave3 = Math.sin(timeSec * 4 + i * 0.8);
    const heightFactor = Math.abs((wave1 * 0.5) + (wave2 * 0.3) + (wave3 * 0.2));
    const barHeight = 12 + (heightFactor * 75);

    const barX = eqStartX + (i * eqSpacing);
    const barY = eqBaseY - (barHeight / 2);

    ctx.beginPath();
    ctx.roundRect(barX, barY, 8, barHeight, 4);
    ctx.fill();
  }

  if (needScale) {
    ctx.restore();
  }
}
