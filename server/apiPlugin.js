import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

// Initial seed categories
const INITIAL_CATEGORIES = [
  { id: 'all', name: 'Tous les genres', slug: 'all', icon: 'Sparkles', color: '#9d4edd', display_order: 0 },
  { id: 'cat-1', name: 'Business & Finance', slug: 'business-finance', icon: 'TrendingUp', color: '#9d4edd', display_order: 1 },
  { id: 'cat-2', name: 'Développement Personnel', slug: 'dev-perso', icon: 'Sparkles', color: '#c77dff', display_order: 2 },
  { id: 'cat-3', name: 'Intelligence Artificielle & Tech', slug: 'tech-ia', icon: 'Cpu', color: '#3a86ff', display_order: 3 },
  { id: 'cat-4', name: 'Psychologie & Mental', slug: 'psychologie', icon: 'Brain', color: '#ff006e', display_order: 4 },
  { id: 'cat-5', name: 'Histoire & Stratégie', slug: 'strategie', icon: 'Shield', color: '#fb5607', display_order: 5 },
  { id: 'cat-6', name: 'Romans & Fiction', slug: 'fiction', icon: 'BookOpen', color: '#ffbe0b', display_order: 6 },
];

// Initial seed audiobooks
const INITIAL_AUDIOBOOKS = [
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
    created_at: '2025-01-01T00:00:00Z',
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
    created_at: '2025-01-02T00:00:00Z',
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
    created_at: '2025-01-03T00:00:00Z',
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
    created_at: '2025-01-04T00:00:00Z',
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
    created_at: '2025-01-05T00:00:00Z',
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
    created_at: '2025-01-06T00:00:00Z',
    chapters: [
      { id: 'chap-6-1', chapter_number: 1, title: 'Première Partie : Les rêves de Tarifa', duration_seconds: 3200, audio_url: 'https://cdn.pixabay.com/download/audio/2022/05/16/audio_c1c1f7a0dc.mp3?filename=oriental-strings-111162.mp3' },
    ],
  },
];

function getDbPath() {
  const dir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, 'db.json');
}

function loadDb() {
  const dbFile = getDbPath();
  if (!fs.existsSync(dbFile)) {
    const initialDb = {
      categories: INITIAL_CATEGORIES,
      audiobooks: INITIAL_AUDIOBOOKS,
      purchases: [
        { id: 'pur-1', user_id: 'user-demo', audiobook_id: 'book-1', amount_paid: 2900, purchased_at: '2025-01-10T10:00:00Z' },
        { id: 'pur-2', user_id: 'user-demo', audiobook_id: 'book-4', amount_paid: 3900, purchased_at: '2025-01-12T14:30:00Z' },
      ],
      progress: [
        { id: 'prog-1', user_id: 'user-demo', audiobook_id: 'book-1', current_chapter_id: 'chap-1-2', position_seconds: 450, completed_percentage: 25, is_completed: 0, last_listened_at: new Date().toISOString() },
        { id: 'prog-2', user_id: 'user-demo', audiobook_id: 'book-4', current_chapter_id: 'chap-4-1', position_seconds: 1200, completed_percentage: 50, is_completed: 0, last_listened_at: new Date().toISOString() },
      ],
      deleted_book_ids: [],
      push_subscriptions: [],
    };
    saveDb(initialDb);
    return initialDb;
  }
  try {
    const content = fs.readFileSync(dbFile, 'utf-8');
    const parsed = JSON.parse(content);
    if (!parsed.deleted_book_ids || !Array.isArray(parsed.deleted_book_ids)) parsed.deleted_book_ids = [];
    if (!parsed.audiobooks || !Array.isArray(parsed.audiobooks)) {
      parsed.audiobooks = INITIAL_AUDIOBOOKS.filter(b => !parsed.deleted_book_ids.includes(b.id));
    } else {
      parsed.audiobooks = parsed.audiobooks.filter(b => !parsed.deleted_book_ids.includes(b.id));
    }
    if (!parsed.categories || !Array.isArray(parsed.categories)) parsed.categories = INITIAL_CATEGORIES;
    return parsed;
  } catch (e) {
    console.error('[API Dev Server] Erreur lecture db.json, réinitialisation :', e);
    return { categories: INITIAL_CATEGORIES, audiobooks: INITIAL_AUDIOBOOKS, purchases: [], progress: [], deleted_book_ids: [] };
  }
}

function saveDb(data) {
  const dbFile = getDbPath();
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), 'utf-8');
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { resolve({}); }
    });
  });
}

export function viteApiPlugin() {
  return {
    name: 'vite-plugin-rg-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = url.pathname;

        if (!pathname.startsWith('/api')) {
          return next();
        }

        const method = req.method;
        const apiPath = pathname.replace(/^\/api/, '');

        // Set standard CORS, anti-cache & JSON headers
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range, X-User-Id');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        if (method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        try {
          const db = loadDb();

          // ── GET /api/deleted-books ───────────────────────────────────
          if ((apiPath === '/deleted-books' || apiPath === '/deleted-books/') && method === 'GET') {
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              deleted_ids: db.deleted_book_ids || [],
            }));
            return;
          }

          // ── GET /api/status ──────────────────────────────────────────
          if (apiPath === '/status' && method === 'GET') {
            res.statusCode = 200;
            res.end(JSON.stringify({
              status: 'online',
              mode: 'vite_shared_dev_server',
              database_file: 'data/db.json',
              deleted_book_ids_count: (db.deleted_book_ids || []).length,
              bindings: {
                d1: {
                  connected: true,
                  bound: true,
                  books_count: db.audiobooks.length,
                  storage: 'local_sqlite_or_json',
                },
                r2: { bound: true, bucket: 'rg-play-audio' },
                kv: { bound: true },
              },
              environment: 'development',
              timestamp: new Date().toISOString(),
            }));
            return;
          }

          // ── GET /api/categories ──────────────────────────────────────
          if (apiPath === '/categories' && method === 'GET') {
            res.statusCode = 200;
            res.end(JSON.stringify(db.categories || INITIAL_CATEGORIES));
            return;
          }

          // ── GET /api/audiobooks ──────────────────────────────────────
          if ((apiPath === '/audiobooks' || apiPath === '/audiobooks/') && method === 'GET') {
            const category = url.searchParams.get('category');
            const search = url.searchParams.get('search');
            const featured = url.searchParams.get('featured');
            const type = url.searchParams.get('type');
            const deletedSet = new Set(db.deleted_book_ids || []);

            let books = (db.audiobooks || []).filter(b => !deletedSet.has(b.id));

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
            if (featured === 'true') {
              books = books.filter(b => Boolean(b.is_featured));
            }

            res.statusCode = 200;
            res.end(JSON.stringify(books));
            return;
          }

          // ── GET /api/audiobooks/:id ──────────────────────────────────
          const bookDetailMatch = apiPath.match(/^\/audiobooks\/([^\/\?]+)\/?$/i);
          if (bookDetailMatch && method === 'GET') {
            const bookId = decodeURIComponent(bookDetailMatch[1]);
            const deletedSet = new Set(db.deleted_book_ids || []);
            if (deletedSet.has(bookId)) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Livre supprimé', deleted: true }));
              return;
            }
            const book = (db.audiobooks || []).find(b => b.id === bookId);
            if (book) {
              res.statusCode = 200;
              res.end(JSON.stringify(book));
            } else {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Livre non trouvé' }));
            }
            return;
          }

          // ── POST /api/admin/books (Ajouter / Modifier un livre) ──────
          if (apiPath === '/admin/books' && method === 'POST') {
            const body = await parseJsonBody(req);
            const bookId = body.id || `book-${Date.now()}`;

            const newBook = {
              ...body,
              id: bookId,
              rating: body.rating || 5.0,
              rating_count: body.rating_count || 1,
              is_featured: body.is_featured ?? 1,
              is_bestseller: body.is_bestseller ?? 0,
              created_at: body.created_at || new Date().toISOString(),
              chapters: Array.isArray(body.chapters) ? body.chapters.map((ch, idx) => ({
                id: ch.id || `chap-${bookId}-${idx + 1}`,
                chapter_number: idx + 1,
                title: ch.title || `Chapitre ${idx + 1}`,
                duration_seconds: Number(ch.duration_seconds || 1800),
                audio_url: ch.audio_url || '',
                audio_r2_key: ch.audio_r2_key || `audiobooks/${bookId}/ch${idx + 1}.mp3`,
                audio_stream_url: ch.audio_stream_url || `/api/chapters/chap-${bookId}-${idx + 1}/stream`,
              })) : [],
            };

            // If it was marked deleted previously, unmark it
            if (db.deleted_book_ids) {
              db.deleted_book_ids = db.deleted_book_ids.filter(id => id !== bookId);
            }

            // Remove existing version if update
            db.audiobooks = (db.audiobooks || []).filter(b => b.id !== bookId);
            // Prepend new book so it's top of list
            db.audiobooks.unshift(newBook);
            saveDb(db);

            console.log(`[API Dev Server] ✓ Livre "${newBook.title}" (${newBook.id}) publié et enregistré dans data/db.json`);

            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              book_id: bookId,
              book: newBook,
              stored_in: ['local_server_db', 'data/db.json'],
              message: `Livre audio "${newBook.title}" enregistré avec succès sur le serveur !`,
            }));
            return;
          }

          // ── DELETE /api/admin/books/:id ──────────────────────────────
          const deleteMatch = apiPath.match(/^\/admin\/books\/([^\/\?]+)\/?$/i);
          if (deleteMatch && method === 'DELETE') {
            const bookId = decodeURIComponent(deleteMatch[1]);
            const prevCount = (db.audiobooks || []).length;
            db.audiobooks = (db.audiobooks || []).filter(b => b.id !== bookId);
            
            if (!db.deleted_book_ids) db.deleted_book_ids = [];
            if (!db.deleted_book_ids.includes(bookId)) {
              db.deleted_book_ids.push(bookId);
            }

            // Supprimer en cascade des achats et progression de tous les utilisateurs
            if (db.purchases) {
              db.purchases = db.purchases.filter(p => p.audiobook_id !== bookId);
            }
            if (db.progress) {
              db.progress = db.progress.filter(p => p.audiobook_id !== bookId);
            }

            saveDb(db);

            console.log(`[API Dev Server] 🗑 Livre ${bookId} définitivement supprimé de data/db.json et enregistré dans deleted_book_ids`);

            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              deleted: true,
              book_id: bookId,
              deleted_ids: db.deleted_book_ids,
              message: `Livre ${bookId} supprimé de la base de données et de tous les profils`,
            }));
            return;
          }

          // ── GET /api/library ─────────────────────────────────────────
          if (apiPath === '/library' && method === 'GET') {
            const userId = req.headers['x-user-id'] || 'user-demo';
            const deletedSet = new Set(db.deleted_book_ids || []);
            const userPurchases = (db.purchases || []).filter(p => p.user_id === userId && !deletedSet.has(p.audiobook_id));
            
            const libraryBooks = userPurchases.map(p => {
              const book = (db.audiobooks || []).find(b => b.id === p.audiobook_id && !deletedSet.has(b.id));
              if (!book) return null;
              const prog = (db.progress || []).find(pr => pr.user_id === userId && pr.audiobook_id === book.id) || {};
              return {
                ...book,
                purchased_at: p.purchased_at,
                position_seconds: prog.position_seconds || 0,
                completed_percentage: prog.completed_percentage || 0,
                is_completed: Boolean(prog.is_completed),
                current_chapter_id: prog.current_chapter_id || book.chapters?.[0]?.id,
                current_chapter_title: book.chapters?.find(c => c.id === prog.current_chapter_id)?.title || book.chapters?.[0]?.title || 'Chapitre 1',
              };
            }).filter(Boolean);

            res.statusCode = 200;
            res.end(JSON.stringify(libraryBooks));
            return;
          }

          // ── POST /api/payment/initiate (CamerPay Dev & Multi-Apps) ───────────
          if (apiPath === '/payment/initiate' && method === 'POST') {
            const body = await parseJsonBody(req);
            const userId = req.headers['x-user-id'] || 'user-demo';
            const { audiobook_id, payment_method, customer_phone, amount, app_prefix } = body;

            if (!audiobook_id || !payment_method || !amount) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'Champs requis manquants' }));
              return;
            }

            const prefix = (app_prefix || 'RGP').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
            const txId = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
            const purchaseId = `pur-${Date.now()}`;
            const CAMERPAY_TOKEN = process.env.CAMERPAY_TOKEN || process.env.PAYMENT_API_TOKEN || '800|QNy2YL5p5kkEAVFK3FNi7RY8XaL8LrKYW71RA5XQ3262b7e9';
            const cleanPhone = (customer_phone || '').replace(/\D/g, '');
            const isCardPayment = ['card', 'visa', 'mastercard'].includes(payment_method);

            if (!db.purchases) db.purchases = [];
            db.purchases = db.purchases.filter(p => !(p.user_id === userId && p.audiobook_id === audiobook_id && ['pending', 'failed'].includes(p.status)));
            db.purchases.push({
              id: purchaseId,
              user_id: userId,
              audiobook_id,
              amount_paid: Number(amount),
              currency: 'XAF',
              payment_method,
              customer_phone: cleanPhone || null,
              transaction_id: txId,
              status: 'pending',
              purchased_at: new Date().toISOString(),
            });
            saveDb(db);

            // Appel CamerPay avec retry
            let camerpayData = null;
            let camerpayError = null;
            let lastStatus = 0;
            const camerpayMethod = isCardPayment ? 'card' : payment_method;

            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                const cpBody = {
                  payment_method: camerpayMethod,
                  amount: Number(amount),
                  currency: 'XAF',
                  merchant_invoice_id: txId,
                  merchant_callback_url: 'https://rg-play.pages.dev/api/payment/notify',
                  merchant_return_url: `https://rg-play.pages.dev?tx=${txId}`,
                  description: `Achat livre audio ${audiobook_id}`,
                  source: 'api',
                };
                if (!isCardPayment && cleanPhone) {
                  cpBody.customer_phone = cleanPhone;
                  cpBody.phone = cleanPhone;
                }

                const cpRes = await fetch('https://camerpay.biz/api/payment/initiate', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CAMERPAY_TOKEN}`,
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 CamerPay-Client/2.0',
                  },
                  body: JSON.stringify(cpBody),
                });

                lastStatus = cpRes.status;
                const text = await cpRes.text();
                try { camerpayData = JSON.parse(text); } catch { camerpayData = { raw: text }; }

                if (cpRes.ok) {
                  camerpayError = null;
                  break;
                }

                if (cpRes.status >= 500 && attempt < 3) {
                  await new Promise(r => setTimeout(r, 600 * attempt));
                  continue;
                }

                camerpayError = camerpayData?.message || camerpayData?.error || `CamerPay HTTP ${cpRes.status}`;
                break;
              } catch (e) {
                if (attempt < 3) {
                  await new Promise(r => setTimeout(r, 600 * attempt));
                  continue;
                }
                camerpayError = 'Service de paiement momentanément inaccessible.';
              }
            }

            if (camerpayError) {
              const pur = db.purchases.find(p => p.transaction_id === txId);
              if (pur) pur.status = 'failed';
              saveDb(db);

              res.statusCode = 402;
              res.end(JSON.stringify({
                success: false,
                transaction_id: txId,
                status: 'failed',
                error: lastStatus >= 500
                  ? 'Le réseau de l\'opérateur mobile (Orange / MTN) est temporairement saturé. Veuillez réessayer.'
                  : camerpayError,
                camerpay_raw: camerpayData,
                http_status: lastStatus,
              }));
              return;
            }

            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              transaction_id: txId,
              audiobook_id,
              status: 'pending',
              pay_url: camerpayData?.pay_url || camerpayData?.redirect_url || null,
              message: 'Demande envoyée ! Vérifiez votre téléphone et entrez votre code PIN pour confirmer le paiement.',
              camerpay_response: camerpayData,
            }));
            return;
          }

          // ── GET /api/payment/status/:id ──────────────────────────────
          const statusMatch = apiPath.match(/^\/payment\/status\/([a-zA-Z0-9_-]+)$/);
          if (statusMatch && method === 'GET') {
            const txId = statusMatch[1];
            const pur = (db.purchases || []).find(p => p.transaction_id === txId);
            const book = pur ? db.audiobooks.find(b => b.id === pur.audiobook_id) : null;

            res.statusCode = 200;
            res.end(JSON.stringify({
              transaction_id: txId,
              status: pur?.status || 'completed',
              audiobook_id: pur?.audiobook_id,
              audiobook: book,
              amount: pur?.amount_paid,
              payment_method: pur?.payment_method,
            }));
            return;
          }

          // ── POST /api/payment/confirm-manual ─────────────────────────
          if (apiPath === '/payment/confirm-manual' && method === 'POST') {
            const body = await parseJsonBody(req);
            const { transaction_id, audiobook_id } = body;
            const pur = (db.purchases || []).find(p => p.transaction_id === transaction_id);
            if (pur) pur.status = 'completed';
            saveDb(db);

            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              status: 'completed',
              transaction_id,
              audiobook_id: audiobook_id || pur?.audiobook_id,
              message: 'Paiement confirmé avec succès !',
            }));
            return;
          }

          // ── POST /api/checkout ───────────────────────────────────────
          if (apiPath === '/checkout' && method === 'POST') {
            const body = await parseJsonBody(req);
            const userId = req.headers['x-user-id'] || 'user-demo';
            const txId = `CP_${Date.now()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

            if (!db.purchases) db.purchases = [];
            db.purchases.push({
              id: `pur-${Date.now()}`,
              user_id: userId,
              audiobook_id: body.audiobook_id,
              amount_paid: body.amount,
              payment_method: body.payment_method || 'orange_money',
              phone_number: body.phone_number,
              transaction_id: txId,
              purchased_at: new Date().toISOString(),
              status: 'completed',
            });
            saveDb(db);

            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              transaction_id: txId,
              audiobook_id: body.audiobook_id,
              status: 'completed',
              message: 'Paiement CamerPay validé ! Votre livre a été débloqué et ajouté à votre bibliothèque.',
            }));
            return;
          }

          // ── POST /api/progress ───────────────────────────────────────
          if (apiPath === '/progress' && method === 'POST') {
            const body = await parseJsonBody(req);
            const userId = req.headers['x-user-id'] || 'user-demo';

            if (!db.progress) db.progress = [];
            const idx = db.progress.findIndex(p => p.user_id === userId && p.audiobook_id === body.audiobook_id);
            const entry = {
              id: `prog-${userId}-${body.audiobook_id}`,
              user_id: userId,
              audiobook_id: body.audiobook_id,
              current_chapter_id: body.chapter_id,
              position_seconds: body.position_seconds,
              completed_percentage: body.completed_percentage,
              is_completed: body.is_completed ? 1 : 0,
              last_listened_at: new Date().toISOString(),
            };

            if (idx >= 0) db.progress[idx] = entry;
            else db.progress.push(entry);

            saveDb(db);

            res.statusCode = 200;
            res.end(JSON.stringify({ success: true }));
            return;
          }

          // ── POST /api/r2/upload (sauvegarde réelle dans public/uploads/) ────
          if (apiPath === '/r2/upload' && method === 'POST') {
            try {
              // Parse multipart form-data manually
              const contentType = req.headers['content-type'] || '';
              const boundaryMatch = contentType.match(/boundary=([^;]+)/);
              if (!boundaryMatch) throw new Error('Pas de boundary multipart');
              const boundary = '--' + boundaryMatch[1].trim();

              // Read raw body
              const rawChunks = [];
              await new Promise((resolve, reject) => {
                req.on('data', chunk => rawChunks.push(chunk));
                req.on('end', resolve);
                req.on('error', reject);
              });
              const rawBody = Buffer.concat(rawChunks);

              // Parse parts
              const parts = [];
              const boundaryBuf = Buffer.from('\r\n' + boundary);
              let start = rawBody.indexOf(boundary) + boundary.length + 2; // skip first boundary + CRLF
              while (start < rawBody.length) {
                const end = rawBody.indexOf(boundaryBuf, start);
                if (end === -1) break;
                parts.push(rawBody.slice(start, end));
                start = end + boundaryBuf.length;
                if (rawBody.slice(start, start + 2).toString() === '--') break;
                start += 2; // skip CRLF after boundary
              }

              let fileBuffer = null;
              let originalName = 'upload';
              let mimeType = 'application/octet-stream';

              for (const part of parts) {
                const headerEnd = part.indexOf('\r\n\r\n');
                if (headerEnd === -1) continue;
                const headerStr = part.slice(0, headerEnd).toString();
                const fileData = part.slice(headerEnd + 4);

                if (headerStr.includes('name="file"')) {
                  fileBuffer = fileData;
                  const fnMatch = headerStr.match(/filename="([^"]+)"/);
                  if (fnMatch) originalName = fnMatch[1];
                  const ctMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/);
                  if (ctMatch) mimeType = ctMatch[1].trim();
                }
              }

              if (!fileBuffer || fileBuffer.length === 0) throw new Error('Aucun fichier reçu');

              // Save to public/uploads/
              const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
              if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

              const ext = path.extname(originalName) || (mimeType.includes('audio') ? '.mp3' : mimeType.includes('image') ? '.jpg' : '.bin');
              const uniqueName = `${Date.now()}_${randomBytes(4).toString('hex')}${ext}`;
              const destPath = path.join(uploadsDir, uniqueName);
              fs.writeFileSync(destPath, fileBuffer);

              const publicUrl = `/uploads/${uniqueName}`;
              const r2Key = `uploads/${uniqueName}`;
              const sizeMb = (fileBuffer.length / (1024 * 1024)).toFixed(2);

              console.log(`[API Dev Server] ✓ Fichier sauvegardé : public/uploads/${uniqueName} (${sizeMb} Mo)`);

              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                public_url: publicUrl,
                r2_key: r2Key,
                size_mb: sizeMb,
                file_name: uniqueName,
                mime_type: mimeType,
                stored_in: 'local_public_uploads',
              }));
            } catch (uploadErr) {
              console.error('[API Dev Server] Erreur upload :', uploadErr.message);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: uploadErr.message }));
            }
            return;
          }

          // ── GET /api/r2/download (Local Dev Fallback) ────────────────
          if ((apiPath === '/r2/download' || apiPath.startsWith('/r2/download')) && method === 'GET') {
            const key = url.searchParams.get('key') || apiPath.replace('/r2/download/', '');
            const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
            const cleanKey = path.basename(key);
            const filePath = path.join(uploadsDir, cleanKey);

            if (fs.existsSync(filePath)) {
              const fileBuffer = fs.readFileSync(filePath);
              const ext = path.extname(cleanKey).toLowerCase();
              const mime = ext === '.mp3' ? 'audio/mpeg' : ext === '.wav' ? 'audio/wav' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'application/octet-stream';
              res.setHeader('Content-Type', mime);
              res.setHeader('Cache-Control', 'public, max-age=86400');
              res.statusCode = 200;
              res.end(fileBuffer);
              return;
            }

            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Fichier non trouvé dans public/uploads/' }));
            return;
          }

          // ── Fallback 404 ─────────────────────────────────────────────
          res.statusCode = 404;
          res.end(JSON.stringify({ error: `Endpoint API non trouvé : ${apiPath}` }));

        } catch (err) {
          console.error('[API Dev Server] Erreur :', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message || 'Erreur interne' }));
        }
      });
    },
  };
}
