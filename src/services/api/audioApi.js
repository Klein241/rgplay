/**
 * src/services/api/audioApi.js
 * 
 * Module spécialisé pour les appels API audiobooks (Architecture modulaire AGENTS.md)
 */

const API_BASE = '/api';

/**
 * Incrémente le compteur de téléchargements pour un livre audio ou ebook
 * Met à jour Cloudflare D1 et invalide les caches KV.
 */
export async function incrementBookDownloads(bookId) {
  if (!bookId) return null;
  try {
    const res = await fetch(`${API_BASE}/audiobooks/${encodeURIComponent(bookId)}/increment-downloads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[incrementBookDownloads] Network error:', err);
  }
  return null;
}
