/**
 * src/services/api/audioApi.js
 * 
 * Module spécialisé pour les appels API audiobooks (Architecture modulaire AGENTS.md) :
 * - Synchronisation bidirectionnelle Cloudflare D1 & Cache local
 * - Gestion des avis réels, notes utilisateurs et compteurs de téléchargements
 */

const API_BASE = '/api';

/**
 * Récupère ou génère un identifiant stable pour l'utilisateur actuel
 */
function getCurrentUserId() {
  try {
    let uid = localStorage.getItem('rg_user_id');
    if (!uid) {
      const profile = JSON.parse(localStorage.getItem('rg_user_profile') || '{}');
      uid = profile.id || `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      localStorage.setItem('rg_user_id', uid);
    }
    return uid;
  } catch {
    return 'user-guest';
  }
}

/**
 * Récupère le nom affiché de l'utilisateur actuel
 */
function getCurrentUserName() {
  try {
    const profile = JSON.parse(localStorage.getItem('rg_user_profile') || '{}');
    return profile.name || profile.username || 'Auditeur RG Play';
  } catch {
    return 'Auditeur RG Play';
  }
}

/**
 * Met à jour un livre spécifique dans le cache localStorage 'rg_cached_books'
 */
function updateBookInLocalCache(bookId, patchData) {
  try {
    const raw = localStorage.getItem('rg_cached_books');
    if (!raw) return;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return;
    let modified = false;
    const updated = list.map(b => {
      if (b.id === bookId) {
        modified = true;
        return { ...b, ...patchData };
      }
      return b;
    });
    if (modified) {
      localStorage.setItem('rg_cached_books', JSON.stringify(updated));
    }
  } catch (_) {}
}

/**
 * Incrémente le compteur de téléchargements pour un livre audio ou ebook
 * Met à jour Cloudflare D1, le cache local et déclenche l'événement global
 */
export async function incrementBookDownloads(bookId) {
  if (!bookId) return null;
  try {
    const res = await fetch(`${API_BASE}/audiobooks/${encodeURIComponent(bookId)}/increment-downloads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const count = data.downloads_count || data.display_plays_count;
      if (count) {
        updateBookInLocalCache(bookId, {
          downloads_count: count,
          display_plays_count: count,
        });
      }
      return data;
    }
  } catch (err) {
    console.warn('[incrementBookDownloads] Network error:', err);
  }
  return null;
}

/**
 * Récupère les avis réels depuis Cloudflare D1 avec détection de la note utilisateur
 */
export async function fetchBookReviews(bookId) {
  if (!bookId) return null;
  const userId = getCurrentUserId();
  try {
    const res = await fetch(`${API_BASE}/audiobooks/${encodeURIComponent(bookId)}/reviews`, {
      headers: {
        'Accept': 'application/json',
        'X-User-Id': userId,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        const revList = Array.isArray(data.reviews) ? data.reviews : [];
        const userRating = data.user_rating || null;
        const avgRating = data.average_rating || null;
        const totalReviews = typeof data.total_reviews === 'number' ? data.total_reviews : revList.length;

        // Synchroniser le localStorage si D1 connaît la note personnelle de l'utilisateur
        if (userRating) {
          try {
            localStorage.setItem(`rg_rated_${bookId}`, String(userRating));
            const userRatings = JSON.parse(localStorage.getItem('rg_user_ratings') || '{}');
            userRatings[bookId] = userRating;
            localStorage.setItem('rg_user_ratings', JSON.stringify(userRatings));
          } catch (_) {}
        }

        // Mettre à jour le cache local du catalogue
        if (avgRating) {
          updateBookInLocalCache(bookId, {
            rating: avgRating,
            display_rating: avgRating,
            rating_count: totalReviews,
            display_reviews_count: totalReviews,
          });
        }

        return {
          success: true,
          reviews: revList,
          count: revList.length,
          totalReviews,
          averageRating: avgRating,
          userRating,
        };
      }
    }
  } catch (err) {
    console.warn('[fetchBookReviews] Erreur réseau:', err);
  }

  // Fallback silencieux sur le cache local
  try {
    const savedRating = Number(localStorage.getItem(`rg_rated_${bookId}`)) || null;
    const localRevs = JSON.parse(localStorage.getItem(`rg_reviews_${bookId}`) || '[]');
    return {
      success: true,
      reviews: Array.isArray(localRevs) ? localRevs : [],
      count: Array.isArray(localRevs) ? localRevs.length : 0,
      totalReviews: Array.isArray(localRevs) ? localRevs.length : 0,
      averageRating: null,
      userRating: savedRating,
    };
  } catch (_) {
    return null;
  }
}

/**
 * Enregistre une note ou un avis complet dans Cloudflare D1
 */
export async function rateAudiobook(bookId, rating, comment = '') {
  if (!bookId || !rating) return null;
  const userId = getCurrentUserId();
  const userName = getCurrentUserName();

  try {
    const res = await fetch(`${API_BASE}/audiobooks/${encodeURIComponent(bookId)}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
      },
      body: JSON.stringify({
        rating: Number(rating),
        comment: (comment || `Note ${rating}/5 attribuée par l'auditeur`).trim(),
        user_id: userId,
        user_name: userName,
        author: userName,
      }),
    });

    if (res.ok) {
      const data = await res.json();

      // Sauvegarde de confirmation dans le cache local
      try {
        localStorage.setItem(`rg_rated_${bookId}`, String(rating));
        const userRatings = JSON.parse(localStorage.getItem('rg_user_ratings') || '{}');
        userRatings[bookId] = Number(rating);
        localStorage.setItem('rg_user_ratings', JSON.stringify(userRatings));
      } catch (_) {}

      // Mettre à jour immédiatement le cache du catalogue
      const newAvg = data.rating || data.average_rating;
      const newTotal = data.total_reviews;
      if (newAvg) {
        updateBookInLocalCache(bookId, {
          rating: newAvg,
          display_rating: newAvg,
          rating_count: newTotal,
          display_reviews_count: newTotal,
        });
      }

      // Propager l'événement dans toute l'application
      window.dispatchEvent(new CustomEvent('rg:book-rated', {
        detail: {
          bookId,
          rating: Number(rating),
          newAvg,
          newCount: newTotal,
        }
      }));

      return data;
    }
  } catch (err) {
    console.warn('[rateAudiobook] Erreur réseau:', err);
  }

  // Si le réseau a échoué, persistance temporaire en local
  try {
    localStorage.setItem(`rg_rated_${bookId}`, String(rating));
  } catch (_) {}

  return null;
}
