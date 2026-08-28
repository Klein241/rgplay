/**
 * RG Play API Client - Connecteur Base de Données & Cloudflare D1
 * Gère les appels API (/api/...) avec synchronisation temps réel inter-onglets/appareils
 * et persistance dans la base de données partagée.
 */

const API_BASE = '/api';

// Utilisateur actif par défaut
const CURRENT_USER_ID = 'user-demo';

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
  async getAudiobooks({ category = 'all', search = '', featured = false, type = 'all' } = {}) {
    let books = null;

    try {
      const params = new URLSearchParams();
      if (category && category !== 'all') params.append('category', category);
      if (search) params.append('search', search);
      if (featured) params.append('featured', 'true');
      if (type && type !== 'all') params.append('type', type);

      const res = await fetch(`${API_BASE}/audiobooks?${params.toString()}`);
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          books = data;
          // Mettre en cache local pour mode hors-ligne
          try {
            if ((!category || category === 'all') && !search && !featured && (!type || type === 'all')) {
              localStorage.setItem('rg_cached_books', JSON.stringify(data));
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
        if (cached) books = JSON.parse(cached);
      } catch (_) {}

      // Fallback 2: livres par défaut
      if (!books || !Array.isArray(books) || books.length === 0) {
        books = getDefaultAudiobooks();
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

    return books;
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
    // 1. Priorité au stockage local (modifications réelles de l'utilisateur)
    const savedLibrary = localStorage.getItem('rg_user_library');
    if (savedLibrary) {
      try {
        const parsed = JSON.parse(savedLibrary);
        if (Array.isArray(parsed) && parsed.length >= 0) {
          return parsed;
        }
      } catch (_) {}
    }

    try {
      const res = await fetch(`${API_BASE}/library`, {
        headers: { 'X-User-Id': CURRENT_USER_ID }
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          localStorage.setItem('rg_user_library', JSON.stringify(data));
          return data;
        }
      }
    } catch (e) {
      console.warn('Fallback pour la bibliothèque');
    }

    const books = getDefaultAudiobooks();
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
      {
        ...books[1],
        purchased_at: new Date().toISOString(),
        position_seconds: 1200,
        completed_percentage: 50,
        is_completed: false,
        is_favorite: true,
        current_chapter_id: books[1].chapters?.[0]?.id,
        current_chapter_title: books[1].chapters?.[0]?.title,
      }
    ];
    localStorage.setItem('rg_user_library', JSON.stringify(defaultLib));
    return defaultLib;
  },

  // Retirer un livre de sa bibliothèque personnelle
  async removeFromLibrary(audiobookId) {
    try {
      const lib = JSON.parse(localStorage.getItem('rg_user_library') || '[]');
      const updated = lib.filter(b => b.id !== audiobookId);
      localStorage.setItem('rg_user_library', JSON.stringify(updated));
    } catch (_) {}

    window.dispatchEvent(new CustomEvent('rg:library-updated', { detail: { removedId: audiobookId } }));
    return { success: true };
  },

  // Basculer un livre en favori dans sa bibliothèque
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

    window.dispatchEvent(new CustomEvent('rg:library-updated'));
    return { success: true, is_favorite: isFav };
  },

  // Sauvegarde de la progression d'écoute
  async saveProgress({ audiobook_id, chapter_id, position_seconds, completed_percentage, is_completed }) {
    try {
      await fetch(`${API_BASE}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': CURRENT_USER_ID,
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

  // ──────────────────────────────────────────────────────────────────────
  // PAIEMENT MOBILE MONEY PRODUCTION — CamerPay
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Étape 1 : Initier le paiement Mobile Money via CamerPay.
   * Le backend crée la transaction en 'pending' et appelle CamerPay,
   * qui envoie un push USSD/SMS sur le téléphone de l'acheteur.
   * @returns {{ success, transaction_id, status:'pending', message }} ou { success:false, error }
   */
  async initiatePayment({ audiobook, payment_method, customer_phone }) {
    const amount = audiobook.discount_price || audiobook.price;
    const res = await fetch(`${API_BASE}/payment/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': CURRENT_USER_ID,
      },
      body: JSON.stringify({
        audiobook_id: audiobook.id,
        payment_method,   // 'orange_money' | 'mtn_momo'
        customer_phone,   // Ex: '699123456'
        amount,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Erreur CamerPay (HTTP ${res.status})`);
    }
    return data; // { success, transaction_id, status:'pending', message }
  },

  /**
   * Étape 2 : Interroger l'état du paiement (polling toutes les 3 secondes).
   * Le backend lit le KV (ultra-rapide) puis D1 en fallback.
   * @returns {{ status: 'pending'|'completed'|'failed', audiobook_id, transaction_id }}
   */
  async getPaymentStatus(transaction_id) {
    const res = await fetch(`${API_BASE}/payment/status/${transaction_id}`, {
      headers: { 'X-User-Id': CURRENT_USER_ID },
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
          'X-User-Id': CURRENT_USER_ID,
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
   * Ajoute le livre à la bibliothèque locale pour un accès immédiat hors-ligne.
   */
  _addToLocalLibrary(audiobook) {
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

  // Supprimer un livre audio
  async deleteAudiobook(bookId) {
    // 1. Supprimer sur le serveur / D1
    let serverResult = null;
    try {
      const res = await fetch(`${API_BASE}/admin/books/${bookId}`, { method: 'DELETE' });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        serverResult = await res.json();
      }
    } catch (e) {
      console.warn('Suppression serveur D1 échouée:', e);
    }

    // 2. Nettoyer le cache local
    try {
      const cached = JSON.parse(localStorage.getItem('rg_cached_books') || '[]');
      const filtered = cached.filter(b => b.id !== bookId);
      localStorage.setItem('rg_cached_books', JSON.stringify(filtered));
    } catch (_) {}

    // 3. Diffuser l'événement local & inter-onglets
    window.dispatchEvent(new CustomEvent('rg:book-deleted', { detail: { id: bookId } }));
    syncChannel?.postMessage({ type: 'book-deleted', id: bookId });

    return { success: true, serverResult };
  },

  // Publier un nouveau livre audio (Admin Studio) -> Enregistre dans la base de données
  async createAudiobook(bookData) {
    const bookId = bookData.id || `book-${Date.now()}`;
    const newBook = {
      ...bookData,
      id: bookId,
      rating: bookData.rating || 5.0,
      rating_count: bookData.rating_count || 1,
      is_featured: bookData.is_featured ?? 1,
      is_bestseller: bookData.is_bestseller ?? 0,
      created_at: new Date().toISOString(),
    };

    // 1. Envoyer à la base de données / serveur (/api/admin/books)
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

    // 2. Mettre à jour le cache local pour réactivité immédiate
    try {
      const cached = JSON.parse(localStorage.getItem('rg_cached_books') || '[]');
      const filtered = cached.filter(b => b.id !== bookId);
      filtered.unshift(newBook);
      localStorage.setItem('rg_cached_books', JSON.stringify(filtered));
    } catch (_) {}

    // 3. Émettre l'événement local et diffuser aux autres onglets
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

    window.dispatchEvent(new CustomEvent('rg:book-created', { detail: { id: bookId, is_pinned: isPinned } }));
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
  }
};

function getDefaultAudiobooks() {
  return [
    {
      id: 'book-1',
      title: 'La Psychologie de l\'Argent',
      author: 'Morgan Housel',
      narrator: 'Alexandre D.',
      description: 'Quelques leçons intemporelles sur la richesse, la cupidité et le bonheur. Comment notre comportement influence nos finances bien plus que notre QI.',
      synopsis: 'Dans La Psychologie de l\'Argent, Morgan Housel partage 19 histoires courtes explorant les manières étranges dont les gens pensent à l\'argent. Vous découvrirez comment maîtriser vos émotions, éviter les pièges financiers et bâtir une véritable liberté.',
      cover_url: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&q=80',
      preview_url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
      category_id: 'cat-1',
      category_name: 'Business & Finance',
      price: 3500,
      price_eur: 5.50,
      discount_price: 2900,
      duration_seconds: 21600,
      rating: 4.9,
      rating_count: 1420,
      is_featured: 1,
      is_bestseller: 1,
      is_free_for_members: 0,
      chapters: [
        { id: 'chap-1-1', chapter_number: 1, title: 'Introduction : Le plus grand spectacle sur Terre', duration_seconds: 1800, audio_url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3' },
        { id: 'chap-1-2', chapter_number: 2, title: 'Personne n\'est fou : Les expériences façonnent la vision', duration_seconds: 2400, audio_url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=ambient-piano-amp-strings-10711.mp3' },
        { id: 'chap-1-3', chapter_number: 3, title: 'Chance & Risque : Deux faces d\'une même pièce', duration_seconds: 2100, audio_url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8bbf7341e.mp3?filename=cinematic-epic-10903.mp3' },
        { id: 'chap-1-4', chapter_number: 4, title: 'Ne jamais en avoir assez : Savoir dire stop', duration_seconds: 1900, audio_url: 'https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f792cb.mp3?filename=electronic-future-beats-117997.mp3' },
        { id: 'chap-1-5', chapter_number: 5, title: 'Les Intérêts Composés : La magie du temps', duration_seconds: 2200, audio_url: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_bb630cc098.mp3?filename=meditation-peace-6644.mp3' },
      ],
    },
    {
      id: 'book-4',
      title: 'Révolution IA : Comprendre et Dompter le Futur',
      author: 'Dr. Sophie Laurent',
      narrator: 'Claire V.',
      description: 'Une plongée captivante dans le fonctionnement des LLMs, agents autonomes et l\'impact sur le travail.',
      synopsis: 'L\'intelligence artificielle transforme déjà tous les secteurs. Comment rester indispensable ? Ce livre audio décortique sans jargon les rouages de l\'IA générative et donne des clés d\'action concrètes.',
      cover_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80',
      preview_url: 'https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f792cb.mp3?filename=electronic-future-beats-117997.mp3',
      category_id: 'cat-3',
      category_name: 'Intelligence Artificielle & Tech',
      price: 5000,
      price_eur: 7.50,
      discount_price: 3900,
      duration_seconds: 25200,
      rating: 4.95,
      rating_count: 2150,
      is_featured: 1,
      is_bestseller: 1,
      is_free_for_members: 0,
      chapters: [
        { id: 'chap-4-1', chapter_number: 1, title: 'Genèse des Modèles Géants : De Turing aux Transformers', duration_seconds: 2400, audio_url: 'https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f792cb.mp3?filename=electronic-future-beats-117997.mp3' },
        { id: 'chap-4-2', chapter_number: 2, title: 'L\'art du Prompting et les Agents Autonomes', duration_seconds: 3000, audio_url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3' },
        { id: 'chap-4-3', chapter_number: 3, title: 'L\'Économie de l\'IA : Qui gagne vraiment ?', duration_seconds: 2700, audio_url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=ambient-piano-amp-strings-10711.mp3' },
      ],
    },
    {
      id: 'book-2',
      title: 'L\'Effet Cumulé : Décuplez votre réussite',
      author: 'Darren Hardy',
      narrator: 'Nathalie Dupont',
      description: 'Le principe fondamental pour transformer de petites actions quotidiennes en succès gigantesques au fil du temps.',
      synopsis: 'Vos choix quotidiens déterminent votre destinée. Apprenez à créer des habitudes vertueuses et à éliminer les freins invisibles qui bloquent votre croissance personnelle et professionnelle.',
      cover_url: 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=800&q=80',
      preview_url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=ambient-piano-amp-strings-10711.mp3',
      category_id: 'cat-2',
      category_name: 'Développement Personnel',
      price: 4000,
      price_eur: 6.00,
      discount_price: null,
      duration_seconds: 18000,
      rating: 4.85,
      rating_count: 980,
      is_featured: 1,
      is_bestseller: 1,
      is_free_for_members: 0,
      chapters: [
        { id: 'chap-2-1', chapter_number: 1, title: 'Chapitre 1 : L\'effet cumulé en action', duration_seconds: 3600, audio_url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=ambient-piano-amp-strings-10711.mp3' },
        { id: 'chap-2-2', chapter_number: 2, title: 'Chapitre 2 : Les choix inconscients', duration_seconds: 3200, audio_url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3' },
      ],
    },
    {
      id: 'book-3',
      title: 'L\'Art de la Guerre & Stratégie',
      author: 'Sun Tzu (Adapté)',
      narrator: 'Jean-Pierre M.',
      description: 'Le traité stratégique le plus influent au monde, appliqué au leadership moderne et à la négociation.',
      synopsis: 'Connaissez votre adversaire et connaissez-vous vous-même. Cette version enrichie offre des analyses concrètes pour le monde professionnel.',
      cover_url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&q=80',
      preview_url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8bbf7341e.mp3?filename=cinematic-epic-10903.mp3',
      category_id: 'cat-5',
      category_name: 'Histoire & Stratégie',
      price: 2500,
      price_eur: 3.90,
      discount_price: 1900,
      duration_seconds: 10800,
      rating: 4.7,
      rating_count: 640,
      is_featured: 0,
      is_bestseller: 0,
      is_free_for_members: 1,
      chapters: [
        { id: 'chap-3-1', chapter_number: 1, title: 'Évaluation et plans initiaux', duration_seconds: 2700, audio_url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8bbf7341e.mp3?filename=cinematic-epic-10903.mp3' },
      ],
    },
    {
      id: 'book-5',
      title: 'Le Pouvoir du Moment Présent',
      author: 'Eckhart Tolle',
      narrator: 'Marc Bellemare',
      description: 'Guide d\'éveil spirituel pour calmer le bavardage mental et vivre avec une clarté et une sérénité totales.',
      synopsis: 'Pour entreprendre ce voyage dans Le Pouvoir du moment présent, il nous faut laisser derrière nous notre esprit analytique et son faux soi, l\'ego.',
      cover_url: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80',
      preview_url: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_bb630cc098.mp3?filename=meditation-peace-6644.mp3',
      category_id: 'cat-4',
      category_name: 'Psychologie & Mental',
      price: 3800,
      price_eur: 5.90,
      discount_price: null,
      duration_seconds: 28800,
      rating: 4.88,
      rating_count: 3120,
      is_featured: 0,
      is_bestseller: 1,
      is_free_for_members: 0,
      chapters: [
        { id: 'chap-5-1', chapter_number: 1, title: 'Vous n\'êtes pas votre mental', duration_seconds: 3600, audio_url: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_bb630cc098.mp3?filename=meditation-peace-6644.mp3' },
      ],
    },
    {
      id: 'book-6',
      title: 'L\'Alchimiste & Secrets du Désert',
      author: 'Paulo Coelho',
      narrator: 'Michel A.',
      description: 'L\'histoire intemporelle de Santiago, un jeune berger andalou qui part à la recherche de sa Légende Personnelle.',
      synopsis: 'Quand on veut une chose, tout l\'Univers conspire à nous permettre de réaliser notre rêve. Une quête initiatique inoubliable sur l\'écoute de son cœur.',
      cover_url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800&q=80',
      preview_url: 'https://cdn.pixabay.com/download/audio/2022/05/16/audio_c1c1f7a0dc.mp3?filename=oriental-strings-111162.mp3',
      category_id: 'cat-6',
      category_name: 'Romans & Fiction',
      price: 3000,
      price_eur: 4.50,
      discount_price: null,
      duration_seconds: 14400,
      rating: 4.92,
      rating_count: 4800,
      is_featured: 0,
      is_bestseller: 1,
      is_free_for_members: 1,
      chapters: [
        { id: 'chap-6-1', chapter_number: 1, title: 'Première Partie : Les rêves de Tarifa', duration_seconds: 3200, audio_url: 'https://cdn.pixabay.com/download/audio/2022/05/16/audio_c1c1f7a0dc.mp3?filename=oriental-strings-111162.mp3' },
      ],
    },
  ];
}
