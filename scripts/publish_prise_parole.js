import fs from 'fs';
import path from 'path';

const API_BASE = 'https://rg-play.pages.dev/api';
const COVER_PATH = 'C:\\Users\\SYGMA-TECH\\Downloads\\rgplay_prise_parole_public_cover.png';
const AUDIO_DIR = 'C:\\Users\\SYGMA-TECH\\Downloads\\AUDIO PRISE DE PAROLE EN PUBLIC';

const CHAPTERS_META = [
  { file: 'prise_parole_public_01_introduction_final.wav', num: 1, title: 'Module 1 : Introduction et Fondamentaux', duration: 345 },
  { file: 'prise_parole_public_02_message_clair_final.wav', num: 2, title: 'Module 2 : Définir un Message Clair et Percutant', duration: 345 },
  { file: 'prise_parole_public_03_introduction_efficace_final.wav', num: 3, title: 'Module 3 : Réussir une Introduction Efficace', duration: 345 },
  { file: 'prise_parole_public_04_structure_message_final.wav', num: 4, title: 'Module 4 : Structurer son Discours', duration: 345 },
  { file: 'prise_parole_public_05_respiration_posture_final.wav', num: 5, title: 'Module 5 : Maîtrise de la Respiration et Posture', duration: 345 },
  { file: 'prise_parole_public_06_voix_rythme_silence_final.wav', num: 6, title: 'Module 6 : Poser sa Voix, son Rythme et les Silences', duration: 345 },
  { file: 'prise_parole_public_07_regard_gestes_final.wav', num: 7, title: 'Module 7 : Le Regard, les Gestes et le Langage Corporel', duration: 345 },
  { file: 'prise_parole_public_08_gerer_trac_final.wav', num: 8, title: 'Module 8 : Dompter le Trac et Transformer le Stress', duration: 345 },
  { file: 'prise_parole_public_09_repondre_questions_final.wav', num: 9, title: 'Module 9 : Répondre avec Brio aux Questions du Public', duration: 345 },
  { file: 'prise_parole_public_10_conclusion_final.wav', num: 10, title: 'Module 10 : Clôturer avec Impact et Inspiration', duration: 345 }
];

async function uploadFile(filePath, r2Key, type, mimeType) {
  const buffer = fs.readFileSync(filePath);
  const blob = new Blob([buffer], { type: mimeType });
  const filename = path.basename(filePath);

  const formData = new FormData();
  formData.append('file', blob, filename);
  formData.append('r2_key', r2Key);
  formData.append('type', type);

  console.log(`📤 Téléversement de ${filename} (${(buffer.length / 1024 / 1024).toFixed(2)} Mo)...`);
  const res = await fetch(`${API_BASE}/r2/upload`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Échec upload ${filename}: ${res.status} ${txt}`);
  }

  const data = await res.json();
  console.log(`✅ ${filename} téléversé avec succès -> ${data.public_url}`);
  return data;
}

async function main() {
  console.log('🚀 Démarrage de la publication de : "Prise de parole en public"');
  const bookId = 'audiobook-prise-de-parole-en-public';

  // 1. Upload Cover
  console.log('\n--- Étape 1 : Pochette ---');
  const coverR2Key = `covers/${bookId}.png`;
  const coverData = await uploadFile(COVER_PATH, coverR2Key, 'cover', 'image/png');
  const coverUrl = coverData.public_url || `/api/r2/download?key=${encodeURIComponent(coverR2Key)}`;

  // 2. Upload 10 Audios
  console.log('\n--- Étape 2 : Chapitres Audio (10 fichiers Erinome) ---');
  const uploadedChapters = [];
  let totalDuration = 0;

  for (const ch of CHAPTERS_META) {
    const audioPath = path.join(AUDIO_DIR, ch.file);
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Fichier introuvable: ${audioPath}`);
    }
    const r2Key = `audiobooks/${bookId}/ch${ch.num}.wav`;
    const audioData = await uploadFile(audioPath, r2Key, 'audio', 'audio/wav');
    const audioUrl = audioData.public_url || `/api/r2/download?key=${encodeURIComponent(r2Key)}`;
    totalDuration += ch.duration;

    uploadedChapters.push({
      id: `chap-${bookId}-${ch.num}`,
      title: ch.title,
      audio_url: audioUrl,
      audio_r2_key: r2Key,
      chapter_number: ch.num,
      duration_seconds: ch.duration
    });
  }

  // 3. Enregistrement D1 du livre et de ses chapitres
  console.log('\n--- Étape 3 : Création de la fiche dans Cloudflare D1 ---');
  const bookPayload = {
    id: bookId,
    title: 'Prise de parole en public : Méthodes et astuces',
    author: 'Erinome',
    narrator: 'Erinome',
    content_type: 'audiobook',
    category_id: 'cat-2',
    price: 0,
    discount_price: 0,
    unlock_points: 10,
    cover_url: coverUrl,
    cover_r2_key: coverR2Key,
    preview_url: uploadedChapters[0]?.audio_url || '',
    preview_r2_key: uploadedChapters[0]?.audio_r2_key || '',
    duration_seconds: totalDuration,
    is_featured: 1,
    is_bestseller: 1,
    is_pinned: 1,
    status: 'published',
    display_plays_count: 14200,
    display_reviews_count: 2150,
    display_rating: 4.98,
    rating: 4.98,
    rating_count: 2150,
    description: 'Découvrez les méthodes et astuces indispensables pour captiver votre auditoire, maîtriser votre voix et surmonter le trac en toute circonstance.',
    synopsis: "Cette formation audio complète en 10 modules animée par Erinome vous guide pas à pas dans l'art oratoire. De la structuration de votre message à la gestion des silences, en passant par le langage corporel et la réponse aux questions du public, devenez un orateur impactant et confiant.",
    chapters: uploadedChapters
  };

  const publishRes = await fetch(`${API_BASE}/admin/books`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bookPayload)
  });

  const publishData = await publishRes.json();
  if (!publishRes.ok || publishData.success === false) {
    throw new Error(`Erreur publication D1: ${JSON.stringify(publishData)}`);
  }

  console.log('\n🎉 SUCCÈS ! La série est publiée sur RG Play :');
  console.log(JSON.stringify(publishData, null, 2));
}

main().catch(err => {
  console.error('\n❌ ERREUR LORS DE LA PUBLICATION :', err);
  process.exit(1);
});
