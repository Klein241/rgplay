import { getUserId } from '../utils/userId';
/**
 * RG Play API Client - Connecteur Base de Données & Cloudflare D1
 * Gère les appels API (/api/...) avec synchronisation temps réel inter-onglets/appareils
 * et persistance dans la base de données partagée.
 */

const API_BASE = '/api';

// Utilisateur actif par défaut
export { getUserId };

// Canal de synchronisation inter-onglets/fenêtres en direct
const syncChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('rg_play_sync')
  : null;

if (syncChannel) {
  syncChannel.onmessage = (event) => {
    const data = event.data;
    if (data?.type === 'book-created') {
      window.dispatchEvent(new CustomEvent('rg:book-created', { detail: data.book }));
    } else if (data?.type === 'book-deleted') {
      window.dispatchEvent(new CustomEvent('rg:book-deleted', { detail: { id: data.id } }));
    }
  };
}

export function recordApiCall(endpoint, info = {}) {
  try {
    const raw = localStorage.getItem('rg_api_usage_log');
    const log = raw ? JSON.parse(raw) : { calls: [], totalCalls: 0 };
    log.totalCalls = (log.totalCalls || 0) + 1;
    log.calls = log.calls || [];
    const today = new Date().toISOString().slice(0, 10);
    const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    log.calls.unshift({
      id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      endpoint,
      date: today,
      time,
      model: 'deepseek-v4-flash',
      ...info,
    });
    if (log.calls.length > 150) log.calls = log.calls.slice(0, 150);
    localStorage.setItem('rg_api_usage_log', JSON.stringify(log));
    window.dispatchEvent(new CustomEvent('rg:api-usage-updated', { detail: log }));
  } catch (_) {}
}

export const apiClient = {
  // Récupération des catégories
  async getCategories() {
    try {
      const res = await fetch(`${API_BASE}/categories`);
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Utilisation du fallback pour les catégories');
    }
    return [
      { id: 'all', name: 'Tous les genres', slug: 'all', icon: 'Sparkles', color: '#9d4edd' },
      { id: 'cat-1', name: 'Business & Finance', slug: 'business-finance', icon: 'TrendingUp', color: '#9d4edd' },
      { id: 'cat-2', name: 'Développement Personnel', slug: 'dev-perso', icon: 'Sparkles', color: '#c77dff' },
      { id: 'cat-3', name: 'Intelligence Artificielle & Tech', slug: 'tech-ia', icon: 'Cpu', color: '#3a86ff' },
      { id: 'cat-4', name: 'Psychologie & Mental', slug: 'psychologie', icon: 'Brain', color: '#ff006e' },
      { id: 'cat-5', name: 'Histoire & Stratégie', slug: 'strategie', icon: 'Shield', color: '#fb5607' },
      { id: 'cat-6', name: 'Romans & Fiction', slug: 'fiction', icon: 'BookOpen', color: '#ffbe0b' },
    ];
  },

  // Liste des livres audio (Source de vérité = Serveur / Base de données)
  async getAudiobooks({ category = 'all', search = '', featured = false, type = 'all', admin = false } = {}) {
    // Synchroniser le registre des suppressions en tâche de fond (non bloquant)
    this.syncDeletedBooks().catch(() => {});

    let books = null;
    const getDeletedSet = () => {
      try {
        return new Set(JSON.parse(localStorage.getItem('rg_deleted_book_ids') || '[]'));
      } catch { return new Set(); }
    };
    const deletedSet = getDeletedSet();

    try {
      const params = new URLSearchParams();
      if (category && category !== 'all') params.append('category', category);
      if (search) params.append('search', search);
      if (featured) params.append('featured', 'true');
      if (type && type !== 'all') params.append('type', type);
      if (admin) params.append('admin', 'true');

      const headers = { 'Cache-Control': 'no-cache' };
      if (admin) headers['X-Admin'] = 'true';

      const res = await fetch(`${API_BASE}/audiobooks?${params.toString()}`, {
        headers,
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data)) {
          // Filtrer immédiatement les livres supprimés
          books = data.filter(b => !deletedSet.has(b.id));
          // Mettre en cache local pour mode hors-ligne (visiteurs publics uniquement)
          try {
            if (!admin && (!category || category === 'all') && !search && !featured && (!type || type === 'all')) {
              localStorage.setItem('rg_cached_books', JSON.stringify(books));
            }
          } catch (_) {}
        }
      }
    } catch (e) {
      console.warn('API indisponible, bascule sur cache/fallback :', e);
    }

    if (!books) {
      // Fallback 1: cache local
      try {
        const cached = localStorage.getItem('rg_cached_books');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) books = parsed.filter(b => !deletedSet.has(b.id));
        }
      } catch (_) {}

      // Fallback 2: livres par défaut (uniquement si non supprimés)
      if (!books || !Array.isArray(books) || books.length === 0) {
        books = getDefaultAudiobooks().filter(b => !deletedSet.has(b.id));
      }

      // Filtrer les résultats fallback
      if (type && type !== 'all') {
        books = books.filter(b => (b.content_type || 'audiobook') === type);
      }
      if (category && category !== 'all') {
        books = books.filter(b => 
          b.category_id === category || 
          b.category_name?.toLowerCase().includes(category.toLowerCase())
        );
      }
      if (search) {
        const q = search.toLowerCase().trim();
        books = books.filter(b => 
          b.title?.toLowerCase().includes(q) || 
          b.author?.toLowerCase().includes(q) || 
          b.narrator?.toLowerCase().includes(q)
        );
      }
      if (featured) {
        books = books.filter(b => Boolean(b.is_featured));
      }
    }

    // Toujours s'assurer que les livres supprimés ne sont jamais renvoyés
    return books.filter(b => !deletedSet.has(b.id));
  },

  // Détail d'un livre audio
  async getAudiobookById(id) {
    try {
      const res = await fetch(`${API_BASE}/audiobooks/${id}`);
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        return await res.json();
      }
    } catch (e) {
      console.warn(`Fallback pour livre ${id}`);
    }
    const all = await this.getAudiobooks();
    return all.find(b => b.id === id) || all[0];
  },

  // Bibliothèque de l'utilisateur
  async getLibrary() {
    // Synchroniser les suppressions en tâche de fond (non bloquant)
    this.syncDeletedBooks().catch(() => {});

    const getDeletedSet = () => {
      try { return new Set(JSON.parse(localStorage.getItem('rg_deleted_book_ids') || '[]')); }
      catch { return new Set(); }
    };
    const deletedSet = getDeletedSet();

    // 1. Toujours tenter le serveur pour avoir la vérité absolue
    try {
      const res = await fetch(`${API_BASE}/library`, {
        headers: { 'X-User-Id': getUserId(), 'Cache-Control': 'no-cache' },
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const filtered = data.filter(b => !deletedSet.has(b.id));
          localStorage.setItem('rg_user_library', JSON.stringify(filtered));
          return filtered;
        }
      }
    } catch (e) {
      console.warn('Fallback bibliothèque: serveur indisponible, lecture locale');
    }

    // 2. Fallback: cache local filtré
    try {
      const saved = localStorage.getItem('rg_user_library');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(b => !deletedSet.has(b.id));
          localStorage.setItem('rg_user_library', JSON.stringify(filtered));
          return filtered;
        }
      }
    } catch (_) {}

    // 3. Fallback final: livres par défaut (filtrés)
    const books = getDefaultAudiobooks().filter(b => !deletedSet.has(b.id));
    if (books.length === 0) return [];
    const defaultLib = [
      {
        ...books[0],
        purchased_at: new Date().toISOString(),
        position_seconds: 450,
        completed_percentage: 25,
        is_completed: false,
        is_favorite: true,
        current_chapter_id: books[0].chapters?.[1]?.id || books[0].chapters?.[0]?.id,
        current_chapter_title: books[0].chapters?.[1]?.title || 'Chapitre 2',
      },
    ].filter(Boolean);
    localStorage.setItem('rg_user_library', JSON.stringify(defaultLib));
    return defaultLib;
  },

  // ── Profil Utilisateur D1 ──────────────────────────────────────────
  async getUserProfile() {
    try {
      const res = await fetch(`${API_BASE}/user/profile`, {
        headers: { 'X-User-Id': getUserId(), 'Cache-Control': 'no-cache' },
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (data?.profile) {
          localStorage.setItem('rg_user_profile', JSON.stringify(data.profile));
          return data.profile;
        }
      }
    } catch (e) {
      console.warn('Fallback profil utilisateur depuis localStorage');
    }
    try {
      const stored = localStorage.getItem('rg_user_profile');
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    return {
      id: getUserId(),
      name: 'Auditeur RG Play',
      email: `${getUserId()}@rgplay.local`,
      phone: '+237 600 00 00 00',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=80',
      plan: 'free',
      wallet_balance: 0,
      theme_preference: 'purple',
      audio_quality: '128',
      download_wifi_only: true,
      auto_play_next: true,
    };
  },

  async updateUserProfile(profileData) {
    // 1. Mise à jour optimiste locale immédiate
    try {
      const current = JSON.parse(localStorage.getItem('rg_user_profile') || '{}');
      const merged = { ...current, ...profileData };
      localStorage.setItem('rg_user_profile', JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent('rg:user-updated', { detail: merged }));
    } catch (_) {}

    // 2. Synchronisation persistante D1
    try {
      const res = await fetch(`${API_BASE}/user/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': getUserId(),
        },
        body: JSON.stringify(profileData),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.profile) {
          localStorage.setItem('rg_user_profile', JSON.stringify(data.profile));
          return data.profile;
        }
      }
    } catch (e) {
      console.warn('Erreur synchro profil D1 (non bloquant):', e);
    }
    return profileData;
  },

  // Recharge Portefeuille D1
  async topUpWallet(amount, method, phone) {
    try {
      const res = await fetch(`${API_BASE}/user/topup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': getUserId(),
        },
        body: JSON.stringify({ amount, method, phone }),
      });
      if (res.ok) {
        const data = await res.json();
        // Mettre à jour profil local
        const p = await this.getUserProfile();
        const updated = { ...p, wallet_balance: data.wallet_balance };
        localStorage.setItem('rg_user_profile', JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('rg:user-updated', { detail: updated }));
        return data;
      }
    } catch (e) {
      console.warn('Erreur topup D1:', e);
    }
    return { success: true };
  },

  // Souscription Plan D1
  async subscribePlan({ plan, method, phone, pay_with_wallet = false }) {
    try {
      const res = await fetch(`${API_BASE}/user/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': getUserId(),
        },
        body: JSON.stringify({ plan, method, phone, pay_with_wallet }),
      });
      if (res.ok) {
        const data = await res.json();
        const p = await this.getUserProfile();
        const updated = {
          ...p,
          plan: data.plan,
          plan_expires_at: data.plan_expires_at,
          wallet_balance: data.wallet_balance !== undefined ? data.wallet_balance : p.wallet_balance
        };
        localStorage.setItem('rg_user_profile', JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('rg:user-updated', { detail: updated }));
        return data;
      }
    } catch (e) {
      console.warn('Erreur abonnement D1:', e);
    }
    return { success: true, plan };
  },

  // ── Bibliothèque de l'utilisateur (D1 + Offline cache) ──────────────
  async getLibrary() {
    this.syncDeletedBooks().catch(() => {});

    const getDeletedSet = () => {
      try { return new Set(JSON.parse(localStorage.getItem('rg_deleted_book_ids') || '[]')); }
      catch { return new Set(); }
    };
    const deletedSet = getDeletedSet();

    // 1. Toujours tenter le serveur D1 pour avoir la vérité absolue
    try {
      const res = await fetch(`${API_BASE}/library`, {
        headers: { 'X-User-Id': getUserId(), 'Cache-Control': 'no-cache' },
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const filtered = data.filter(b => !deletedSet.has(b.id));
          localStorage.setItem('rg_user_library', JSON.stringify(filtered));
          return filtered;
        }
      }
    } catch (e) {
      console.warn('Fallback bibliothèque: serveur indisponible, lecture locale');
    }

    // 2. Fallback: cache local filtré
    try {
      const saved = localStorage.getItem('rg_user_library');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(b => !deletedSet.has(b.id));
          localStorage.setItem('rg_user_library', JSON.stringify(filtered));
          return filtered;
        }
      }
    } catch (_) {}

    return [];
  },

  // Ajouter un livre à sa bibliothèque personnelle (D1 + Local)
  async addToLibrary(audiobook, amount = 0, payment_method = 'direct_unlock') {
    if (!audiobook?.id) return { success: false };

    // 1. Mise à jour optimiste locale
    this._addToLocalLibrary(audiobook);

    // 2. Persistance D1
    try {
      await fetch(`${API_BASE}/library/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': getUserId(),
        },
        body: JSON.stringify({
          audiobook_id: audiobook.id,
          amount,
          payment_method,
        }),
      });
    } catch (e) {
      console.warn('Erreur ajout D1 library (non bloquant):', e);
    }

    return { success: true };
  },

  // Helper : Ajout synchrone au cache local de la bibliothèque
  _addToLocalLibrary(audiobook) {
    if (!audiobook?.id) return;
    try {
      const lib = JSON.parse(localStorage.getItem('rg_user_library') || '[]');
      if (!lib.some(b => b.id === audiobook.id)) {
        lib.unshift({
          ...audiobook,
          purchased_at: new Date().toISOString(),
          is_favorite: false,
        });
        localStorage.setItem('rg_user_library', JSON.stringify(lib));
        window.dispatchEvent(new CustomEvent('rg:library-updated', { detail: { book: audiobook } }));
      }
    } catch (_) {}
  },

  // ─── Avis réels (Reviews D1) ───────────────────────────────────────
  async getBookReviews(bookId) {
    if (!bookId) return [];
    try {
      const res = await fetch(`${API_BASE}/audiobooks/${encodeURIComponent(bookId)}/reviews`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.reviews)) {
          return data.reviews;
        }
      }
    } catch (_) {}
    try {
      const local = localStorage.getItem(`rg_reviews_${bookId}`);
      if (local) return JSON.parse(local);
    } catch (_) {}
    return [];
  },

  async addBookReview(bookId, { rating = 5, comment = '', author = '' }) {
    if (!bookId || !comment.trim()) return { success: false };
    try {
      const res = await fetch(`${API_BASE}/audiobooks/${encodeURIComponent(bookId)}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': getUserId(),
        },
        body: JSON.stringify({ rating, comment, author }),
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (_) {}
    return { success: true };
  },

  async deleteReview(reviewId) {
    if (!reviewId) return { success: false };
    try {
      const res = await fetch(`${API_BASE}/admin/reviews/${encodeURIComponent(reviewId)}`, {
        method: 'DELETE',
        headers: { 'X-User-Id': getUserId() },
      });
      return await res.json();
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // Retirer un livre de sa bibliothèque personnelle (D1 + Local)
  async removeFromLibrary(audiobookId) {
    try {
      const lib = JSON.parse(localStorage.getItem('rg_user_library') || '[]');
      const updated = lib.filter(b => b.id !== audiobookId);
      localStorage.setItem('rg_user_library', JSON.stringify(updated));
    } catch (_) {}

    try {
      await fetch(`${API_BASE}/library/${encodeURIComponent(audiobookId)}`, {
        method: 'DELETE',
        headers: { 'X-User-Id': getUserId() },
      });
    } catch (_) {}

    window.dispatchEvent(new CustomEvent('rg:library-updated', { detail: { removedId: audiobookId } }));
    return { success: true };
  },

  // Basculer un livre en favori dans sa bibliothèque (D1 + Local)
  async toggleFavorite(audiobookId) {
    let isFav = false;
    try {
      const lib = JSON.parse(localStorage.getItem('rg_user_library') || '[]');
      const updated = lib.map(b => {
        if (b.id === audiobookId) {
          isFav = !b.is_favorite;
          return { ...b, is_favorite: isFav };
        }
        return b;
      });
      localStorage.setItem('rg_user_library', JSON.stringify(updated));
    } catch (_) {}

    try {
      const res = await fetch(`${API_BASE}/library/toggle-favorite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': getUserId(),
        },
        body: JSON.stringify({ audiobook_id: audiobookId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.is_favorite !== undefined) isFav = data.is_favorite;
      }
    } catch (_) {}

    window.dispatchEvent(new CustomEvent('rg:library-updated'));
    return { success: true, is_favorite: isFav };
  },

  // Sauvegarde de la progression d'écoute (D1 + Local)
  async saveProgress({ audiobook_id, chapter_id, position_seconds, completed_percentage, is_completed }) {
    try {
      await fetch(`${API_BASE}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': getUserId(),
        },
        body: JSON.stringify({
          audiobook_id,
          chapter_id,
          position_seconds,
          completed_percentage,
          is_completed,
        }),
      });
    } catch (e) {}

    try {
      const lib = JSON.parse(localStorage.getItem('rg_user_library') || '[]');
      const index = lib.findIndex(item => item.id === audiobook_id);
      if (index !== -1) {
        lib[index].position_seconds = position_seconds;
        lib[index].completed_percentage = completed_percentage;
        lib[index].is_completed = is_completed;
        lib[index].current_chapter_id = chapter_id;
        lib[index].last_listened_at = new Date().toISOString();
        localStorage.setItem('rg_user_library', JSON.stringify(lib));
      }
    } catch (e) {}
  },

  // ── Avis et Notations D1 ──────────────────────────────────────────
  async getBookReviews(bookId) {
    try {
      const res = await fetch(`${API_BASE}/books/${encodeURIComponent(bookId)}/reviews`);
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const reviews = await res.json();
        if (Array.isArray(reviews)) {
          localStorage.setItem(`rg_reviews_${bookId}`, JSON.stringify(reviews));
          return reviews;
        }
      }
    } catch (e) {
      console.warn('Fallback reviews localStorage:', e);
    }
    try {
      const stored = localStorage.getItem(`rg_reviews_${bookId}`);
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    return [];
  },

  async addBookReview(bookId, reviewData) {
    // 1. Optimistic local update
    try {
      const stored = JSON.parse(localStorage.getItem(`rg_reviews_${bookId}`) || '[]');
      const newRev = {
        id: `rev-${Date.now()}`,
        audiobook_id: bookId,
        user_name: reviewData.author || reviewData.user_name || 'Auditeur RG Play',
        rating: reviewData.rating || 5,
        comment: reviewData.comment || reviewData.text || '',
        created_at: new Date().toISOString(),
      };
      stored.unshift(newRev);
      localStorage.setItem(`rg_reviews_${bookId}`, JSON.stringify(stored));
    } catch (_) {}

    // 2. D1 persist
    try {
      const res = await fetch(`${API_BASE}/books/${encodeURIComponent(bookId)}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': getUserId(),
        },
        body: JSON.stringify(reviewData),
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.warn('Erreur sauvegarde avis D1:', e);
    }
    return { success: true };
  },

  // ── Signets et Marque-pages Audio D1 ──────────────────────────────
  async getBookmarks(bookId = null) {
    try {
      const url = bookId ? `${API_BASE}/bookmarks?audiobook_id=${encodeURIComponent(bookId)}` : `${API_BASE}/bookmarks`;
      const res = await fetch(url, {
        headers: { 'X-User-Id': getUserId() },
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data)) {
          localStorage.setItem('rg_bookmarks', JSON.stringify(data));
          return data;
        }
      }
    } catch (e) {
      console.warn('Fallback bookmarks localStorage');
    }
    try {
      const stored = JSON.parse(localStorage.getItem('rg_bookmarks') || '[]');
      return bookId ? stored.filter(b => b.audiobook_id === bookId) : stored;
    } catch (_) { return []; }
  },

  async addBookmark(bookmarkData) {
    try {
      const stored = JSON.parse(localStorage.getItem('rg_bookmarks') || '[]');
      const newBm = { id: `bm-${Date.now()}`, ...bookmarkData, created_at: new Date().toISOString() };
      stored.unshift(newBm);
      localStorage.setItem('rg_bookmarks', JSON.stringify(stored));
    } catch (_) {}

    try {
      const res = await fetch(`${API_BASE}/bookmarks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': getUserId(),
        },
        body: JSON.stringify(bookmarkData),
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Erreur sauvegarde signet D1:', e);
    }
    return { success: true };
  },

  async removeBookmark(bookmarkId) {
    try {
      const stored = JSON.parse(localStorage.getItem('rg_bookmarks') || '[]');
      localStorage.setItem('rg_bookmarks', JSON.stringify(stored.filter(b => b.id !== bookmarkId)));
    } catch (_) {}

    try {
      await fetch(`${API_BASE}/bookmarks/${encodeURIComponent(bookmarkId)}`, {
        method: 'DELETE',
        headers: { 'X-User-Id': getUserId() },
      });
    } catch (_) {}
    return { success: true };
  },

  // ── Clés API Admin D1 ──────────────────────────────────────────────
  async getAdminApiKeys() {
    try {
      const res = await fetch(`${API_BASE}/admin/api-keys`);
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data)) {
          localStorage.setItem('rgplay_api_keys', JSON.stringify(data));
          return data;
        }
      }
    } catch (e) {
      console.warn('Fallback api-keys localStorage');
    }
    try {
      return JSON.parse(localStorage.getItem('rgplay_api_keys') || '[]');
    } catch (_) { return []; }
  },

  async createAdminApiKey(keyData) {
    try {
      const res = await fetch(`${API_BASE}/admin/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keyData),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.apiKey) {
          const stored = JSON.parse(localStorage.getItem('rgplay_api_keys') || '[]');
          stored.unshift(data.apiKey);
          localStorage.setItem('rgplay_api_keys', JSON.stringify(stored));
          return data.apiKey;
        }
      }
    } catch (e) {
      console.warn('Erreur création clé API D1:', e);
    }
    return null;
  },

  async deleteAdminApiKey(keyId) {
    try {
      const stored = JSON.parse(localStorage.getItem('rgplay_api_keys') || '[]');
      localStorage.setItem('rgplay_api_keys', JSON.stringify(stored.filter(k => k.id !== keyId)));
    } catch (_) {}

    try {
      await fetch(`${API_BASE}/admin/api-keys/${encodeURIComponent(keyId)}`, {
        method: 'DELETE',
      });
    } catch (_) {}
    return { success: true };
  },

  // ── Notifications Push D1 ──────────────────────────────────────────
  async getNotificationsHistory() {
    try {
      const res = await fetch(`${API_BASE}/notifications`);
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        return await res.json();
      }
    } catch (_) {}
    return [];
  },

  // ──────────────────────────────────────────────────────────────────────
  // PAIEMENT MOBILE MONEY PRODUCTION — CamerPay
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Etape 1 : Initier le paiement Mobile Money via CamerPay.
   * SECURITE : L'appel a CamerPay est EXCLUSIVEMENT cote backend (Cloudflare Function)
   * pour proteger le token secret et eviter les erreurs CORS.
   * @returns {{ success, transaction_id, status:'pending', message }} ou { success:false, error }
   */
  async initiatePayment({ audiobook, payment_method, customer_phone }) {
    const amount = audiobook.discount_price || audiobook.price;

    // Tous les appels passent par le backend Edge - jamais directement vers CamerPay
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(`${API_BASE}/payment/initiate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': getUserId(),
          },
          body: JSON.stringify({
            audiobook_id: audiobook.id,
            payment_method,
            customer_phone,
            amount,
          }),
        });

        const data = await res.json().catch(() => null);

        if (res.ok && data?.success) {
          return data;
        }

        // Recuperer le message d'erreur le plus precis possible
        lastError = data?.error || data?.message || `Erreur serveur (HTTP ${res.status})`;

        // Ne pas reessayer pour les erreurs client (4xx) - uniquement pour les 5xx
        if (res.status < 500) break;

        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1500));
        }
      } catch (e) {
        lastError = 'Connexion au serveur de paiement impossible. Verifiez votre connexion internet.';
        if (attempt < 2) await new Promise(r => setTimeout(r, 1500));
      }
    }

    throw new Error(lastError || 'Impossible d\'initier le paiement. Veuillez reessayer.');
  },

  /**
   * Étape 2 : Interroger l'état du paiement (polling toutes les 3 secondes).
   * Le backend lit le KV (ultra-rapide) puis D1 en fallback.
   * @returns {{ status: 'pending'|'completed'|'failed', audiobook_id, transaction_id }}
   */
  async getPaymentStatus(transaction_id) {
    const res = await fetch(`${API_BASE}/payment/status/${transaction_id}`, {
      headers: { 'X-User-Id': getUserId() },
    });
    if (!res.ok) throw new Error(`Erreur statut paiement (HTTP ${res.status})`);
    return res.json();
  },

  /**
   * Étape 3 : Confirmation manuelle instantanée après saisie du code PIN
   * Débloque le livre audio immédiatement dans D1 et KV.
   */
  async confirmManualPayment({ transaction_id, audiobook }) {
    try {
      const res = await fetch(`${API_BASE}/payment/confirm-manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': getUserId(),
        },
        body: JSON.stringify({
          transaction_id,
          audiobook_id: audiobook?.id,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        this._addToLocalLibrary(audiobook);
        return data;
      }
    } catch (e) {
      console.warn('[MANUAL CONFIRM] Erreur réseau:', e);
    }
    this._addToLocalLibrary(audiobook);
    return { success: true, status: 'completed' };
  },

  /**
   * Appelé une fois le statut 'completed' reçu.
   * Ajoute le livre à la bibliothèque locale et synchronise avec Cloudflare D1.
   */
  _addToLocalLibrary(audiobook) {
    if (!audiobook?.id) return;
    try {
      const lib = JSON.parse(localStorage.getItem('rg_user_library') || '[]');
      if (!lib.some(b => b.id === audiobook.id)) {
        lib.unshift({
          ...audiobook,
          purchased_at: new Date().toISOString(),
          position_seconds: 0,
          completed_percentage: 0,
          is_completed: false,
          is_favorite: false,
          current_chapter_id: audiobook.chapters?.[0]?.id,
          current_chapter_title: audiobook.chapters?.[0]?.title || 'Introduction',
        });
        localStorage.setItem('rg_user_library', JSON.stringify(lib));
        window.dispatchEvent(new CustomEvent('rg:library-updated'));
      }
    } catch (_) {}

    // Synchronisation D1 en arrière-plan
    try {
      fetch(`${API_BASE}/library/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': getUserId(),
        },
        body: JSON.stringify({
          audiobook_id: audiobook.id,
          amount: audiobook.discount_price || audiobook.price || 0,
          payment_method: 'camerpay',
        }),
      }).catch(() => {});
    } catch (_) {}
  },

  // Statut système & liaisons BD / Cloudflare
  async getSystemStatus() {
    try {
      const res = await fetch(`${API_BASE}/status`);
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Impossible de joindre /api/status');
    }
    return {
      status: 'offline_or_local',
      mode: 'local_fallback',
      bindings: {
        d1: { connected: false, bound: false, books_count: 0 },
        r2: { bound: false },
        kv: { bound: false },
      },
    };
  },

  // Supprimer un livre audio (Admin)
  async deleteAudiobook(bookId) {
    // 1. Marquer IMMÉDIATEMENT comme supprimé dans le registre local
    try {
      const deletedIds = JSON.parse(localStorage.getItem('rg_deleted_book_ids') || '[]');
      if (!deletedIds.includes(bookId)) {
        deletedIds.push(bookId);
        localStorage.setItem('rg_deleted_book_ids', JSON.stringify(deletedIds));
      }
    } catch (_) {}

    // 2. Nettoyer TOUTES les couches de cache local immédiatement
    try {
      const cached = JSON.parse(localStorage.getItem('rg_cached_books') || '[]');
      localStorage.setItem('rg_cached_books', JSON.stringify(cached.filter(b => b.id !== bookId)));
    } catch (_) {}
    try {
      const lib = JSON.parse(localStorage.getItem('rg_user_library') || '[]');
      localStorage.setItem('rg_user_library', JSON.stringify(lib.filter(b => b.id !== bookId)));
    } catch (_) {}
    try {
      const bookmarks = JSON.parse(localStorage.getItem('rg_bookmarks') || '[]');
      localStorage.setItem('rg_bookmarks', JSON.stringify(bookmarks.filter(b => b.audiobook_id !== bookId)));
    } catch (_) {}
    // Supprimer aussi du cache hors-ligne (Cache API)
    try {
      const { removeOfflineAudio } = await import('../utils/offlineAudioCache.js');
      await removeOfflineAudio(bookId);
    } catch (_) {}

    // 3. Supprimer sur le serveur / D1
    let serverResult = null;
    try {
      const res = await fetch(`${API_BASE}/admin/books/${encodeURIComponent(bookId)}`, {
        method: 'DELETE',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        serverResult = await res.json();
      }
    } catch (e) {
      console.warn('Suppression serveur D1 échouée (non bloquant):', e);
    }

    // 4. Diffuser l'événement local & inter-onglets
    window.dispatchEvent(new CustomEvent('rg:book-deleted', { detail: { id: bookId } }));
    syncChannel?.postMessage({ type: 'book-deleted', id: bookId });

    return { success: true, serverResult };
  },

  /**
   * Synchronise le registre des suppressions depuis le serveur.
   * Met à jour localStorage et nettoie toutes les couches de cache.
   * Appelé automatiquement par getAudiobooks() et getLibrary().
   */
  async syncDeletedBooks() {
    try {
      const res = await fetch(`${API_BASE}/deleted-books`, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return;
      const data = await res.json();
      const serverIds = Array.isArray(data?.deleted_ids) ? data.deleted_ids : [];
      if (serverIds.length === 0) return;

      // Fusionner avec la liste locale
      let localIds = [];
      try { localIds = JSON.parse(localStorage.getItem('rg_deleted_book_ids') || '[]'); } catch (_) {}
      const mergedIds = [...new Set([...localIds, ...serverIds])];
      localStorage.setItem('rg_deleted_book_ids', JSON.stringify(mergedIds));

      // Purger les livres supprimés de toutes les couches de cache
      let cleanedAny = false;
      try {
        const cached = JSON.parse(localStorage.getItem('rg_cached_books') || '[]');
        const filtered = cached.filter(b => !mergedIds.includes(b.id));
        if (filtered.length !== cached.length) {
          localStorage.setItem('rg_cached_books', JSON.stringify(filtered));
          cleanedAny = true;
        }
      } catch (_) {}

      try {
        const lib = JSON.parse(localStorage.getItem('rg_user_library') || '[]');
        const filteredLib = lib.filter(b => !mergedIds.includes(b.id));
        if (filteredLib.length !== lib.length) {
          localStorage.setItem('rg_user_library', JSON.stringify(filteredLib));
          cleanedAny = true;
        }
      } catch (_) {}

      try {
        const bookmarks = JSON.parse(localStorage.getItem('rg_bookmarks') || '[]');
        const filteredBm = bookmarks.filter(b => !mergedIds.includes(b.audiobook_id));
        if (filteredBm.length !== bookmarks.length) {
          localStorage.setItem('rg_bookmarks', JSON.stringify(filteredBm));
        }
      } catch (_) {}

      // Si un livre de la bibliothèque a été retiré, notifier les vues
      if (cleanedAny) {
        window.dispatchEvent(new CustomEvent('rg:library-updated'));
      }
    } catch (e) {
      // Silencieux: serveur peut être indisponible (mode hors-ligne)
    }
  },

  // Publier ou Modifier un livre audio (Admin Studio) -> Enregistre dans la base de données
  async createAudiobook(bookData) {
    const bookId = bookData.id || `book-${Date.now()}`;
    const newBook = {
      ...bookData,
      id: bookId,
      rating: bookData.rating || 5.0,
      rating_count: bookData.rating_count || 1,
      is_featured: bookData.is_featured !== undefined ? (bookData.is_featured ? 1 : 0) : 1,
      is_bestseller: bookData.is_bestseller !== undefined ? (bookData.is_bestseller ? 1 : 0) : 0,
      is_pinned: bookData.is_pinned !== undefined ? (bookData.is_pinned ? 1 : 0) : 0,
      created_at: bookData.created_at || new Date().toISOString(),
    };

    // 1. Si le livre était marqué comme supprimé auparavant, le réactiver
    try {
      const deletedIds = JSON.parse(localStorage.getItem('rg_deleted_book_ids') || '[]');
      const filteredDeleted = deletedIds.filter(id => id !== bookId);
      localStorage.setItem('rg_deleted_book_ids', JSON.stringify(filteredDeleted));
    } catch (_) {}

    // 2. Envoyer à la base de données / serveur (/api/admin/books)
    let serverResult = null;
    let serverSuccess = false;
    try {
      const res = await fetch(`${API_BASE}/admin/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBook),
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        serverResult = await res.json();
        serverSuccess = true;
      }
    } catch (e) {
      console.warn('Sauvegarde serveur échouée :', e);
    }

    // 3. Mettre à jour le cache local pour réactivité immédiate
    try {
      const cached = JSON.parse(localStorage.getItem('rg_cached_books') || '[]');
      const filtered = cached.filter(b => b.id !== bookId);
      filtered.unshift(newBook);
      localStorage.setItem('rg_cached_books', JSON.stringify(filtered));
    } catch (_) {}

    // 4. Émettre l'événement local et diffuser aux autres onglets
    window.dispatchEvent(new CustomEvent('rg:book-created', { detail: newBook }));
    syncChannel?.postMessage({ type: 'book-created', book: newBook });

    return {
      success: true,
      book: newBook,
      serverSuccess,
      serverResult,
    };
  },

  // Épingler / Désépingler un livre audio (Admin)
  async togglePinAudiobook(bookId, isPinned) {
    let serverResult = null;
    try {
      const res = await fetch(`${API_BASE}/admin/books/${bookId}/toggle-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: isPinned }),
      });
      if (res.ok) serverResult = await res.json();
    } catch (e) {
      console.warn('Échec toggle pin serveur:', e);
    }

    try {
      const cached = JSON.parse(localStorage.getItem('rg_cached_books') || '[]');
      const updated = cached.map(b => b.id === bookId ? { ...b, is_pinned: isPinned ? 1 : 0 } : b);
      localStorage.setItem('rg_cached_books', JSON.stringify(updated));
    } catch (_) {}

    syncChannel?.postMessage({ type: 'book-updated', bookId, is_pinned: isPinned });

    return { success: true, is_pinned: isPinned, serverResult };
  },

  // Créer ou Modifier une Catégorie / Catalogue
  async createCategory(catData) {
    const catId = catData.id || `cat-${Date.now()}`;
    const slug = catData.slug || (catData.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const newCat = {
      id: catId,
      name: catData.name,
      slug,
      icon: catData.icon || 'Sparkles',
      color: catData.color || '#9d4edd',
      display_order: catData.display_order || 99,
    };

    let serverResult = null;
    try {
      const res = await fetch(`${API_BASE}/admin/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCat),
      });
      if (res.ok) serverResult = await res.json();
    } catch (_) {}

    window.dispatchEvent(new CustomEvent('rg:category-updated', { detail: newCat }));
    return { success: true, category: newCat, serverResult };
  },

  // Supprimer une Catégorie
  async deleteCategory(catId) {
    let serverResult = null;
    try {
      const res = await fetch(`${API_BASE}/admin/categories/${catId}`, {
        method: 'DELETE',
      });
      if (res.ok) serverResult = await res.json();
    } catch (_) {}

    window.dispatchEvent(new CustomEvent('rg:category-deleted', { detail: { id: catId } }));
    return { success: true, serverResult };
  },

  // Mise à jour des métriques de Social Proof (Effet de masse)
  async updateSocialMetrics(bookId, metrics) {
    let serverResult = null;
    try {
      const res = await fetch(`${API_BASE}/admin/books/${bookId}/social-metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metrics),
      });
      if (res.ok) {
        serverResult = await res.json();
      }
    } catch (e) {
      console.warn('Erreur mise à jour social metrics serveur:', e);
    }

    // Mettre à jour le cache local
    try {
      const cached = JSON.parse(localStorage.getItem('rg_cached_books') || '[]');
      const updated = cached.map(b => b.id === bookId ? { ...b, ...metrics } : b);
      localStorage.setItem('rg_cached_books', JSON.stringify(updated));
    } catch (_) {}

    // Notifier DiscoverView et autres vues
    window.dispatchEvent(new CustomEvent('rg:book-created', { detail: { id: bookId, ...metrics } }));
    window.dispatchEvent(new CustomEvent('rg:book-updated', { detail: { id: bookId, ...metrics } }));
    syncChannel?.postMessage({ type: 'book-updated', bookId, ...metrics });

    return { success: true, id: bookId, ...metrics, serverResult };
  },

  // Récupération des données analytiques admin
  async getAdminAnalytics() {
    try {
      const res = await fetch(`${API_BASE}/admin/analytics`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Erreur récupération admin analytics:', e);
    }
    return null;
  },

  // 🤖 DeepSeek AI : Génération de synthèse, key takeaways & tags (Cas #2 & #9)
  async enrichWithAI(bookInfo) {
    recordApiCall('/ai/enrich', { title: bookInfo?.title, type: 'enrich' });
    try {
      const res = await fetch(`${API_BASE}/ai/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookInfo),
      });
      if (res.ok) {
        return await res.json();
      }
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error || 'Erreur lors de la génération IA' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // 🤖 DeepSeek AI : Discuter avec le Livre / Tuteur Interactif (Cas #1)
  async chatWithBook(chatData) {
    recordApiCall('/ai/chat', { title: chatData?.book_title, type: 'chat' });
    try {
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatData),
      });
      if (res.ok) {
        return await res.json();
      }
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error || 'Erreur réponse tuteur IA' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // 🤖 DeepSeek AI : Recherche sémantique par intention (Cas #8)
  async semanticSearch(query) {
    recordApiCall('/ai/search', { query, type: 'search' });
    try {
      const res = await fetch(`${API_BASE}/ai/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (res.ok) {
        return await res.json();
      }
      return { success: false, matched_ids: [], reason: '' };
    } catch (e) {
      return { success: false, matched_ids: [], reason: '' };
    }
  },

  // 🌟 Read's Great : Récupération de l'état de Gamification & XP
  async getGamificationState(userId = getUserId()) {
    try {
      const res = await fetch(`${API_BASE}/gamification?userId=${encodeURIComponent(userId)}`);
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Fallback local pour la gamification');
    }
    return null;
  },

  // 🌟 Read's Great : Synchronisation de l'état de Gamification
  async syncGamificationState(state, userId = getUserId()) {
    try {
      const res = await fetch(`${API_BASE}/gamification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...state }),
      });
      if (res.ok) return await res.json();
    } catch (e) {}
    return { success: true };
  },

  // 📖 Read's Great : Progression de lecture E-Book
  async syncEbookProgress(bookId, progressData, userId = getUserId()) {
    try {
      const res = await fetch(`${API_BASE}/ebook/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, bookId, ...progressData }),
      });
      if (res.ok) return await res.json();
    } catch (e) {}
    return { success: true };
  },

  // 🧠 DeepSeek IA : Association Intelligente E-Book <-> Livre Audio & Recommandations
  async matchCompanion({ title, author, description, target_type = 'audio' }) {
    try {
      const res = await fetch(`${API_BASE}/ai/match-companion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, author, description, target_type }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Erreur matchCompanion:', e);
    }
    return { success: false, error: 'Service d\'association indisponible' };
  },

  // ── Publicités & Offres Sponsorisées (D1/KV + Cache) ─────────────
  async getAds({ placement = null } = {}) {
    try {
      const url = placement ? `${API_BASE}/ads?placement=${encodeURIComponent(placement)}` : `${API_BASE}/ads`;
      const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data.ads)) {
          localStorage.setItem('rg_cached_ads', JSON.stringify(data.ads));
          return data.ads;
        }
      }
    } catch (_) {}
    try {
      const local = JSON.parse(localStorage.getItem('rg_admin_ads') || localStorage.getItem('rg_cached_ads') || '[]');
      if (placement) return local.filter(a => a.active && Array.isArray(a.placements) && a.placements.includes(placement));
      return local.filter(a => a.active);
    } catch (_) { return []; }
  },

  async getAdminAds() {
    try {
      const res = await fetch(`${API_BASE}/admin/ads`, { headers: { 'Cache-Control': 'no-cache' } });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data.ads)) {
          localStorage.setItem('rg_admin_ads', JSON.stringify(data.ads));
          return data.ads;
        }
      }
    } catch (_) {}
    try {
      return JSON.parse(localStorage.getItem('rg_admin_ads') || '[]');
    } catch (_) { return []; }
  },

  async saveAdminAds(ads) {
    try {
      localStorage.setItem('rg_admin_ads', JSON.stringify(ads));
      window.dispatchEvent(new CustomEvent('rg:ads-updated', { detail: ads }));
      const res = await fetch(`${API_BASE}/admin/ads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ads }),
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Erreur sauvegarde pubs serveur (non bloquant):', e);
    }
    return { success: true };
  },

  // ── Parrainage & Affiliation ──────────────────────────────────────
  async registerReferral(referrerCode) {
    if (!referrerCode) return { success: false };
    try {
      const res = await fetch(`${API_BASE}/referral/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': getUserId(),
        },
        body: JSON.stringify({ referrerCode, userId: getUserId() }),
      });
      if (res.ok) return await res.json();
    } catch (_) {}
    return { success: true };
  },

  async getReferralStats(code) {
    try {
      const url = code ? `${API_BASE}/referral/stats?code=${encodeURIComponent(code)}` : `${API_BASE}/referral/stats`;
      const res = await fetch(url, {
        headers: { 'X-User-Id': getUserId() },
      });
      if (res.ok) return await res.json();
    } catch (_) {}
    return null;
  },
};

function getDefaultAudiobooks() {
  return [];
}
