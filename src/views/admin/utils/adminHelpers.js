/**
 * Utilitaires partagés pour l'Admin Studio
 */

// ── Formate la taille du fichier ─────────────────────────────────────────────
export const formatSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

// ── Formate la durée en minutes/secondes ──────────────────────────────────────
export const formatDuration = (seconds) => {
  const s = Math.round(Number(seconds) || 0);
  if (s <= 0) return '0 s';
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  if (mins === 0) return `${secs} s`;
  if (secs === 0) return `${mins} min`;
  return `${mins} min ${secs} s`;
};

// ── Upload XHR avec progression réelle vers Cloudflare R2 ─────────────────────
export const uploadToR2 = (file, r2Key, type, onProgress) =>
  new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('r2_key', r2Key);
    formData.append('type', type);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/r2/upload');

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error('Réponse serveur invalide')); }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || `Erreur ${xhr.status}`));
        } catch {
          reject(new Error(`Erreur HTTP ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Erreur réseau')));
    xhr.addEventListener('abort', () => reject(new Error('Upload annulé')));
    xhr.send(formData);
  });

// ── Configuration Dynamique par Type de Contenu ─────────────────────────────
export const CONTENT_TYPE_CONFIG = {
  audiobook: {
    id: 'audiobook',
    label: 'Livre Audio',
    icon: '📚',
    color: 'border-purple-500 bg-purple-500/10 text-purple-300',
    titleLabel: 'Titre du Livre Audio *',
    titlePlaceholder: 'Ex : L\'Art de la Stratégie Gagnante',
    creatorLabel: 'Auteur *',
    creatorPlaceholder: 'Ex : Dr. Paul Kemajou',
    performerLabel: 'Narrateur / Voix',
    performerPlaceholder: 'Ex : Voix Française (Studio RG) / Sarah N.',
    pricePlaceholder: '3500',
    discountPricePlaceholder: '2900',
    descriptionLabel: 'Résumé Court *',
    descriptionPlaceholder: 'Un résumé accrocheur pour la boutique et la découverte...',
    synopsisLabel: 'Synopsis Complet / Quatrième de couverture',
    synopsisPlaceholder: 'Détails complets de l\'œuvre, thématiques, table des matières...',
    coverLabel: '🖼️ Pochette du Livre (JPG, PNG, WebP — Carré max 10 Mo)',
    previewLabel: '🎙️ Extrait Gratuit du Livre (MP3 / WAV — 2 à 5 min)',
    itemSingular: 'Chapitre',
    itemPlural: 'Chapitres',
    defaultItemTitle: (idx) => `Chapitre ${idx} : Introduction`,
    defaultItemDuration: 1800,
    trackDropLabel: (idx) => `🎧 Fichier Audio — Chapitre ${idx}`,
    publishSuccessTitle: 'Livre Audio Publié avec Succès !',
    publishSuccessSubtitle: (title) => `"${title}" est maintenant actif et disponible dans le catalogue des livres audio.`,
    anotherButtonText: '+ Publier un Autre Livre',
  },
  ebook: {
    id: 'ebook',
    label: 'E-Book / PDF Numérique',
    icon: '📖',
    color: 'border-cyan-500 bg-cyan-500/10 text-cyan-300',
    titleLabel: 'Titre de l\'E-Book / Livre PDF *',
    titlePlaceholder: 'Ex : L\'Effet Cumulé (The Compound Effect)',
    creatorLabel: 'Auteur du Livre *',
    creatorPlaceholder: 'Ex : Darren Hardy',
    performerLabel: 'Éditeur / Traducteur',
    performerPlaceholder: 'Ex : Éditions Read\'s Great',
    pricePlaceholder: '2500',
    discountPricePlaceholder: '1900',
    descriptionLabel: 'Résumé du Livre E-Book *',
    descriptionPlaceholder: 'Présentation de l\'œuvre numérique, thématiques abordées...',
    synopsisLabel: 'Table des Matières & Sommaire',
    synopsisPlaceholder: 'Chapitre 1, Chapitre 2, Chapitre 3...',
    coverLabel: '📖 Couverture E-Book HD (JPG, PNG, WebP — Ratio A4 ou Carré)',
    previewLabel: '📑 Extrait PDF / Teaser (PDF / PNG)',
    itemSingular: 'Page / Chapitre',
    itemPlural: 'Pages / Chapitres',
    defaultItemTitle: (idx) => `Partie ${idx}`,
    defaultItemDuration: 300,
    trackDropLabel: (idx) => `📖 Document PDF du Livre`,
    publishSuccessTitle: 'E-Book Publié avec Succès !',
    publishSuccessSubtitle: (title) => `"${title}" est disponible dans la liseuse numérique Read\'s Great.`,
    anotherButtonText: '+ Publier un Autre E-Book',
  },
  hybrid: {
    id: 'hybrid',
    label: 'Pack Hybride (Audio + E-Book)',
    icon: '🔥',
    color: 'border-pink-500 bg-pink-500/10 text-pink-300',
    titleLabel: 'Titre de l\'Édition Hybride *',
    titlePlaceholder: 'Ex : Réfléchissez et Devenez Riche (Audio + PDF)',
    creatorLabel: 'Auteur *',
    creatorPlaceholder: 'Ex : Napoleon Hill',
    performerLabel: 'Narrateur & Traducteur',
    performerPlaceholder: 'Ex : Sarah N. & Éditions Read\'s Great',
    pricePlaceholder: '4500',
    discountPricePlaceholder: '3500',
    descriptionLabel: 'Description du Pack Hybride *',
    descriptionPlaceholder: 'Accès complet au livre audio narré en HD + livre numérique PDF complet...',
    synopsisLabel: 'Détails du Contenu & Table des Matières',
    synopsisPlaceholder: 'Audio HD + Liseuse numérique intégrée...',
    coverLabel: '🔥 Pochette du Pack Hybride (JPG, PNG, WebP — Carré HD)',
    previewLabel: '🎙️ Extrait Audio / Teaser (2 à 5 min)',
    itemSingular: 'Chapitre Audio',
    itemPlural: 'Chapitres Audio',
    defaultItemTitle: (idx) => `Chapitre ${idx} : Audio & Texte`,
    defaultItemDuration: 1800,
    trackDropLabel: (idx) => `🎧 Piste Audio ${idx}`,
    publishSuccessTitle: 'Pack Hybride Publié avec Succès !',
    publishSuccessSubtitle: (title) => `"${title}" est maintenant disponible en lecture PDF et écoute audio.`,
    anotherButtonText: '+ Publier un Autre Pack Hybride',
  },
  podcast: {
    id: 'podcast',
    label: 'Podcast',
    icon: '🎙️',
    color: 'border-amber-500 bg-amber-500/10 text-amber-300',
    titleLabel: 'Titre de l\'Émission / Épisode *',
    titlePlaceholder: 'Ex : Tech Pulse Afrique #14 — L\'essor de l\'IA',
    creatorLabel: 'Hôte / Présentateur *',
    creatorPlaceholder: 'Ex : Alain Foka & Équipe RG',
    performerLabel: 'Invités / Co-animateurs',
    performerPlaceholder: 'Ex : Dr. Aminata Traoré, Yannick Noah',
    pricePlaceholder: '1500',
    discountPricePlaceholder: '900',
    descriptionLabel: 'Description de l\'Épisode *',
    descriptionPlaceholder: 'Dans cet épisode, nous décryptons les enjeux de la tech...',
    synopsisLabel: 'Notes de l\'Émission (Show Notes & Liens)',
    synopsisPlaceholder: 'Horodatage (00:00 Intro, 05:30 Débat...), liens des invités...',
    coverLabel: '🎙️ Vignette du Podcast (JPG, PNG, WebP — Carré HD)',
    previewLabel: '⚡ Teaser / Bande-annonce de l\'Épisode (30s à 2 min)',
    itemSingular: 'Épisode',
    itemPlural: 'Épisodes',
    defaultItemTitle: (idx) => `Épisode ${idx} : Discussion Principale`,
    defaultItemDuration: 1200,
    trackDropLabel: (idx) => `🎙️ Audio de l'Épisode ${idx}`,
    publishSuccessTitle: 'Podcast Publié avec Succès !',
    publishSuccessSubtitle: (title) => `"${title}" est maintenant en ligne sur les ondes RG Play.`,
    anotherButtonText: '+ Publier un Autre Podcast',
  },
  music: {
    id: 'music',
    label: 'Musique & Lofi',
    icon: '🎵',
    color: 'border-emerald-500 bg-emerald-500/10 text-emerald-300',
    titleLabel: 'Titre de la Piste / Album *',
    titlePlaceholder: 'Ex : Midnight Lofi Afrobeat Vol. 1',
    creatorLabel: 'Artiste / Compositeur *',
    creatorPlaceholder: 'Ex : Manu Dibango & RG Studio Beats',
    performerLabel: 'Featuring / Musiciens / Producteur',
    performerPlaceholder: 'Ex : feat. Stanley Enow / Prod. Master RG',
    pricePlaceholder: '2000',
    discountPricePlaceholder: '1500',
    descriptionLabel: 'Description / Ambiance Musicale *',
    descriptionPlaceholder: 'Une sélection de rythmes relaxants pour travailler et se détendre...',
    synopsisLabel: 'Crédits, Paroles & Tracklist',
    synopsisPlaceholder: 'Composition, arrangements, mastering, paroles...',
    coverLabel: '🎵 Pochette d\'Album / Single (JPG, PNG, WebP — Carré HD)',
    previewLabel: '🎶 Extrait Musical / Teaser (30s à 1 min)',
    itemSingular: 'Piste',
    itemPlural: 'Pistes',
    defaultItemTitle: (idx) => `Piste ${idx} : Intro & Rythmes`,
    defaultItemDuration: 240,
    trackDropLabel: (idx) => `🎵 Piste Audio ${idx}`,
    publishSuccessTitle: 'Titre Musical Publié avec Succès !',
    publishSuccessSubtitle: (title) => `"${title}" est maintenant prêt pour l'écoute en streaming.`,
    anotherButtonText: '+ Publier une Autre Piste',
  },
  masterclass: {
    id: 'masterclass',
    label: 'Masterclass',
    icon: '🎓',
    color: 'border-cyan-500 bg-cyan-500/10 text-cyan-300',
    titleLabel: 'Titre de la Masterclass / Formation *',
    titlePlaceholder: 'Ex : Masterclass : Vendre avec Succès en Afrique',
    creatorLabel: 'Formateur / Expert *',
    creatorPlaceholder: 'Ex : Stanislas Zézé (Président Bloomfield)',
    performerLabel: 'Intervenants / Mentors Invités',
    performerPlaceholder: 'Ex : Experts du panel exécutif',
    pricePlaceholder: '5000',
    discountPricePlaceholder: '3900',
    descriptionLabel: 'Objectifs Pédagogiques *',
    descriptionPlaceholder: 'Ce que vous allez apprendre concrètement dans cette formation audio...',
    synopsisLabel: 'Programme Détaillé de la Masterclass',
    synopsisPlaceholder: 'Plan d\'action, exercices pratiques, plan des modules...',
    coverLabel: '🎓 Visuel de la Masterclass (JPG, PNG, WebP — Carré Pro)',
    previewLabel: '🎬 Extrait / Introduction Gratuite (3 à 5 min)',
    itemSingular: 'Module',
    itemPlural: 'Modules',
    defaultItemTitle: (idx) => `Module ${idx} : Fondations & Méthodologie`,
    defaultItemDuration: 900,
    trackDropLabel: (idx) => `🎓 Audio du Module ${idx}`,
    publishSuccessTitle: 'Masterclass Publiée avec Succès !',
    publishSuccessSubtitle: (title) => `"${title}" est maintenant disponible pour les apprenants.`,
    anotherButtonText: '+ Publier une Autre Masterclass',
  },
};
