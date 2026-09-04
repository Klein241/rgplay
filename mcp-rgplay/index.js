#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║                      SERVEUR MCP RG PLAY                            ║
 * ║  Model Context Protocol Server pour la Plateforme Audio RG Play     ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 * 
 * Permet à tout assistant IA (Claude, Gemini, Cursor, ChatGPT, Antigravity)
 * d'administrer et d'interagir avec toutes les fonctionnalités de RG Play :
 * - Gestion du catalogue (Livres, Podcasts, Musique, Masterclasses)
 * - Effet de masse & Preuve sociale (Social Proof)
 * - Catégories & Thématiques
 * - Passerelle de paiement CamerPay & Transactions
 * - Statistiques de trafic & Analytics
 * - État du système Cloudflare (D1, R2, KV)
 */

import readline from 'readline';

const SERVER_NAME = 'mcp-rgplay';
const SERVER_VERSION = '1.0.0';
const DEFAULT_API_BASE = process.env.RGPLAY_API_BASE || 'https://rg-play.pages.dev/api';

// ─── Définition des Outils MCP ───────────────────────────────────────────────
const TOOLS = [
  {
    name: 'rgplay_list_audiobooks',
    description: 'Liste les contenus audio disponibles sur RG Play avec filtres par catégorie, mot-clé, type de contenu (audiobook, podcast, music, masterclass), ou filtre tendance/vedette.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['all', 'audiobook', 'podcast', 'music', 'masterclass'],
          description: 'Type de contenu à filtrer',
          default: 'all'
        },
        category: {
          type: 'string',
          description: 'Identifiant ou slug de la catégorie (ex: cat-1, cat-2, business, developpement-personnel) ou "all"',
          default: 'all'
        },
        search: {
          type: 'string',
          description: 'Terme de recherche textuelle dans les titres, auteurs ou narrateurs'
        },
        featured: {
          type: 'boolean',
          description: 'Filtrer uniquement les contenus mis en avant (true/false)'
        }
      }
    }
  },
  {
    name: 'rgplay_get_audiobook',
    description: 'Récupère les détails complets d\'un livre audio ou contenu RG Play à partir de son ID (description, chapitres, URLs de streaming R2, prix, métriques sociales).',
    inputSchema: {
      type: 'object',
      properties: {
        book_id: {
          type: 'string',
          description: 'ID unique du livre audio (ex: book-1, pod-1, mc-1, mus-1)'
        }
      },
      required: ['book_id']
    }
  },
  {
    name: 'rgplay_create_or_update_audiobook',
    description: 'Crée un nouveau contenu audio ou met à jour un contenu existant dans Cloudflare D1 avec ses chapitres et ses métadonnées.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID unique du livre (optionnel, généré automatiquement si non fourni)'
        },
        title: {
          type: 'string',
          description: 'Titre du contenu'
        },
        author: {
          type: 'string',
          description: 'Auteur, hôte du podcast ou artiste'
        },
        narrator: {
          type: 'string',
          description: 'Narrateur ou intervenant'
        },
        content_type: {
          type: 'string',
          enum: ['audiobook', 'podcast', 'music', 'masterclass'],
          description: 'Type de média',
          default: 'audiobook'
        },
        description: {
          type: 'string',
          description: 'Résumé ou présentation du contenu'
        },
        synopsis: {
          type: 'string',
          description: 'Synopsis étendu ou notes'
        },
        price: {
          type: 'number',
          description: 'Prix en FCFA (0 pour gratuit)'
        },
        discount_price: {
          type: 'number',
          description: 'Prix promotionnel en FCFA (optionnel)'
        },
        category_id: {
          type: 'string',
          description: 'ID de la catégorie associée'
        },
        cover_url: {
          type: 'string',
          description: 'URL publique de la jaquette / image de couverture'
        },
        cover_r2_key: {
          type: 'string',
          description: 'Clé Cloudflare R2 de la couverture (optionnel)'
        },
        preview_url: {
          type: 'string',
          description: 'URL de l\'extrait audio gratuit'
        },
        duration_seconds: {
          type: 'number',
          description: 'Durée totale en secondes'
        },
        rating: {
          type: 'number',
          description: 'Note moyenne (ex: 4.9)'
        },
        rating_count: {
          type: 'number',
          description: 'Nombre d\'avis de base'
        },
        display_plays_count: {
          type: 'number',
          description: 'Effet de masse : Nombre d\'écoutes affiché aux utilisateurs'
        },
        display_reviews_count: {
          type: 'number',
          description: 'Effet de masse : Nombre d\'avis affiché aux utilisateurs'
        },
        display_rating: {
          type: 'number',
          description: 'Effet de masse : Note personnalisée affichée (ex: 4.98)'
        },
        is_featured: {
          type: 'boolean',
          description: 'Mettre en vedette'
        },
        is_bestseller: {
          type: 'boolean',
          description: 'Marquer comme Bestseller'
        },
        is_pinned: {
          type: 'boolean',
          description: 'Épingler en haut du catalogue'
        },
        chapters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              audio_url: { type: 'string' },
              audio_r2_key: { type: 'string' },
              duration_seconds: { type: 'number' }
            }
          },
          description: 'Liste des chapitres audio'
        }
      },
      required: ['title', 'author']
    }
  },
  {
    name: 'rgplay_delete_audiobook',
    description: 'Supprime définitivement un livre audio et ses chapitres de la base de données RG Play D1.',
    inputSchema: {
      type: 'object',
      properties: {
        book_id: {
          type: 'string',
          description: 'ID du livre audio à supprimer'
        }
      },
      required: ['book_id']
    }
  },
  {
    name: 'rgplay_toggle_pin_audiobook',
    description: 'Épingle ou désépingle un livre audio en tête de catalogue RG Play.',
    inputSchema: {
      type: 'object',
      properties: {
        book_id: {
          type: 'string',
          description: 'ID du livre à épingler'
        },
        is_pinned: {
          type: 'boolean',
          description: 'true pour épingler, false pour désépingler'
        }
      },
      required: ['book_id', 'is_pinned']
    }
  },
  {
    name: 'rgplay_update_social_metrics',
    description: 'Applique l\'Effet de Masse (Preuve Sociale / Social Proof) sur un livre audio pour booster la conversion : modifie le nombre d\'écoutes affiché, le nombre d\'avis et la note.',
    inputSchema: {
      type: 'object',
      properties: {
        book_id: {
          type: 'string',
          description: 'ID du livre audio'
        },
        display_plays_count: {
          type: 'number',
          description: 'Nombre d\'écoutes à afficher (ex: 15400 pour "15.4k")'
        },
        display_reviews_count: {
          type: 'number',
          description: 'Nombre d\'avis à afficher (ex: 3200 pour "3.2k avis")'
        },
        display_rating: {
          type: 'number',
          description: 'Note à afficher (ex: 4.95)'
        }
      },
      required: ['book_id']
    }
  },
  {
    name: 'rgplay_list_categories',
    description: 'Liste toutes les catégories et thématiques du catalogue RG Play.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'rgplay_create_category',
    description: 'Crée ou modifie une catégorie dans le catalogue RG Play.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID de la catégorie (ex: cat-tech)' },
        name: { type: 'string', description: 'Nom de la catégorie' },
        slug: { type: 'string', description: 'Slug URL (ex: tech-innovation)' },
        icon: { type: 'string', description: 'Nom de l\'icône Lucide (ex: Sparkles, BookOpen, Radio, Music)' },
        color: { type: 'string', description: 'Code couleur Hex ou gradient (ex: #9d4edd)' },
        display_order: { type: 'number', description: 'Ordre d\'affichage' }
      },
      required: ['name']
    }
  },
  {
    name: 'rgplay_delete_category',
    description: 'Supprime une catégorie du catalogue RG Play.',
    inputSchema: {
      type: 'object',
      properties: {
        category_id: { type: 'string', description: 'ID de la catégorie à supprimer' }
      },
      required: ['category_id']
    }
  },
  {
    name: 'rgplay_initiate_payment',
    description: 'Initialise une transaction de paiement réelle avec CamerPay (Orange Money, MTN MoMo, Carte Bancaire) pour débloquer un livre audio.',
    inputSchema: {
      type: 'object',
      properties: {
        audiobook_id: { type: 'string', description: 'ID du livre audio à acheter' },
        payment_method: {
          type: 'string',
          enum: ['orange_money', 'mtn_momo', 'card'],
          description: 'Méthode de paiement'
        },
        customer_phone: {
          type: 'string',
          description: 'Numéro de téléphone (+237 ou 6XXXXXXXX) pour Mobile Money'
        },
        amount: {
          type: 'number',
          description: 'Montant de la transaction en FCFA'
        }
      },
      required: ['audiobook_id', 'payment_method', 'amount']
    }
  },
  {
    name: 'rgplay_get_payment_status',
    description: 'Vérifie le statut en temps réel d\'une transaction de paiement (pending, completed, failed).',
    inputSchema: {
      type: 'object',
      properties: {
        transaction_id: {
          type: 'string',
          description: 'Référence unique de la transaction (ex: RGP-1788053630110-51OPX)'
        }
      },
      required: ['transaction_id']
    }
  },
  {
    name: 'rgplay_sync_pending_payments',
    description: 'Synchronise et valide automatiquement toutes les transactions en attente des dernières 24h auprès de la passerelle CamerPay.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'rgplay_get_user_library',
    description: 'Récupère la bibliothèque de livres achetés et la progression d\'écoute pour un utilisateur donné.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: {
          type: 'string',
          description: 'ID de l\'utilisateur (défaut: "user-demo")',
          default: 'user-demo'
        }
      }
    }
  },
  {
    name: 'rgplay_get_analytics_summary',
    description: 'Récupère le tableau de bord analytique complet : visiteurs uniques, sessions du jour, sources de trafic (WhatsApp, Facebook, Direct), et titres les plus écoutés.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'rgplay_track_event',
    description: 'Enregistre un événement utilisateur ou d\'écoute dans la table analytique RG Play.',
    inputSchema: {
      type: 'object',
      properties: {
        event_type: { type: 'string', description: 'Type d\'événement (ex: play_start, listen_progress, buy_click, share)' },
        visitor_id: { type: 'string', description: 'Identifiant du visiteur' },
        audiobook_id: { type: 'string', description: 'ID du livre associé' },
        audiobook_title: { type: 'string', description: 'Titre du livre' },
        seconds_listened: { type: 'number', description: 'Nombre de secondes écoutées' }
      },
      required: ['event_type', 'visitor_id']
    }
  },
  {
    name: 'rgplay_ingest_file_to_r2',
    description: 'Rapatrie un fichier distant (ex: URL temporaire manuscdn, CDN externe ou fichier audio/PDF) et l\'enregistre définitivement dans le bucket Cloudflare R2 RG Play pour un stockage pérenne.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL source du fichier distant à rapatrier (ex: https://files.manuscdn.com/...)'
        },
        file_name: {
          type: 'string',
          description: 'Nom de fichier cible (ex: rgplay_series1_episode01.wav ou guide_ia.pdf)'
        },
        type: {
          type: 'string',
          enum: ['audio', 'ebook', 'cover', 'preview'],
          description: 'Type de ressource',
          default: 'audio'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'rgplay_publish_ebook',
    description: 'Publie un livre numérique (E-Book au format PDF ou EPUB) dans la bibliothèque Read\'s Great avec pagination, points de déblocage (100 Pts par défaut) et liseuse.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID unique du livre (optionnel)' },
        title: { type: 'string', description: 'Titre du livre numérique' },
        author: { type: 'string', description: 'Auteur(e)' },
        publisher: { type: 'string', description: 'Maison d\'édition ou collection', default: "Éditions Read's Great" },
        category_id: { type: 'string', description: 'ID de la catégorie', default: 'cat-1' },
        format: { type: 'string', enum: ['pdf', 'epub', 'hybrid'], default: 'pdf' },
        pdf_url: { type: 'string', description: 'URL permanente Cloudflare R2 ou URL du document PDF/EPUB' },
        page_count: { type: 'number', description: 'Nombre total de pages du livre', default: 180 },
        unlock_points: { type: 'number', description: 'Points Read\'s Great pour déblocage gratuit', default: 100 },
        price: { type: 'number', description: 'Prix en FCFA (0 pour gratuit)', default: 0 },
        discount_price: { type: 'number', description: 'Prix barré promotionnel' },
        description: { type: 'string', description: 'Présentation / pitch du livre' },
        synopsis: { type: 'string', description: 'Sommaire et chapitres' },
        cover_url: { type: 'string', description: 'URL de la couverture' },
        is_featured: { type: 'boolean', description: 'Mettre en vedette' },
        is_pinned: { type: 'boolean', description: 'Épingler en tête de bibliothèque' }
      },
      required: ['title', 'author', 'pdf_url']
    }
  },
  {
    name: 'rgplay_generate_ai_tts',
    description: 'Génère un flux audio de synthèse vocale IA haute fidélité (voix françaises Henri, Denise, Alain, Brigitte, Guy, Jenny) pour un chapitre ou extrait.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Texte ou script à synthétiser en voix' },
        voice: {
          type: 'string',
          enum: ['fr-FR-HenriNeural', 'fr-FR-DeniseNeural', 'fr-FR-AlainNeural', 'fr-FR-BrigitteNeural', 'en-US-JennyNeural', 'en-US-GuyNeural'],
          default: 'fr-FR-HenriNeural',
          description: 'Profil vocal'
        },
        speed: { type: 'number', default: 1.0, description: 'Vitesse de lecture (0.8 à 1.5)' },
        pitch: { type: 'number', default: 1.0, description: 'Tonalité (0.8 à 1.3)' }
      },
      required: ['text']
    }
  },
  {
    name: 'rgplay_get_system_status',
    description: 'Vérifie l\'état opérationnel complet de la plateforme RG Play (Cloudflare D1 SQL, Stockage R2, KV Cache, Passerelle CamerPay).',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

// ─── Implémentation des Handlers d'Outils ─────────────────────────────────────
async function handleToolCall(name, args) {
  const apiBase = DEFAULT_API_BASE;

  try {
    switch (name) {
      case 'rgplay_list_audiobooks': {
        const params = new URLSearchParams();
        if (args.type && args.type !== 'all') params.append('type', args.type);
        if (args.category && args.category !== 'all') params.append('category', args.category);
        if (args.search) params.append('search', args.search);
        if (args.featured !== undefined) params.append('featured', String(args.featured));

        const res = await fetch(`${apiBase}/audiobooks?${params.toString()}`);
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'rgplay_get_audiobook': {
        const res = await fetch(`${apiBase}/audiobooks/${encodeURIComponent(args.book_id)}`);
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'rgplay_create_or_update_audiobook': {
        const res = await fetch(`${apiBase}/admin/books`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args)
        });
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'rgplay_delete_audiobook': {
        const res = await fetch(`${apiBase}/admin/books/${encodeURIComponent(args.book_id)}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'rgplay_toggle_pin_audiobook': {
        const res = await fetch(`${apiBase}/admin/books/${encodeURIComponent(args.book_id)}/toggle-pin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_pinned: args.is_pinned })
        });
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'rgplay_update_social_metrics': {
        const res = await fetch(`${apiBase}/admin/books/${encodeURIComponent(args.book_id)}/social-metrics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            display_plays_count: args.display_plays_count,
            display_reviews_count: args.display_reviews_count,
            display_rating: args.display_rating
          })
        });
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'rgplay_list_categories': {
        const res = await fetch(`${apiBase}/categories`);
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'rgplay_create_category': {
        const res = await fetch(`${apiBase}/admin/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args)
        });
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'rgplay_delete_category': {
        const res = await fetch(`${apiBase}/admin/categories/${encodeURIComponent(args.category_id)}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'rgplay_initiate_payment': {
        const res = await fetch(`${apiBase}/payment/initiate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args)
        });
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'rgplay_get_payment_status': {
        const res = await fetch(`${apiBase}/payment/status/${encodeURIComponent(args.transaction_id)}`);
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'rgplay_sync_pending_payments': {
        const res = await fetch(`${apiBase}/admin/payment/sync-pending`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'rgplay_get_user_library': {
        const userId = args.user_id || 'user-demo';
        const res = await fetch(`${apiBase}/library`, {
          headers: { 'X-User-Id': userId }
        });
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'rgplay_get_analytics_summary': {
        const res = await fetch(`${apiBase}/admin/analytics`);
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'rgplay_track_event': {
        const res = await fetch(`${apiBase}/analytics/event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args)
        });
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'rgplay_ingest_file_to_r2': {
        const res = await fetch(`${apiBase}/r2/upload-from-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args)
        });
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'rgplay_publish_ebook': {
        const ebookData = {
          ...args,
          content_type: 'ebook',
          format: args.format || 'pdf',
          unlock_points: args.unlock_points !== undefined ? args.unlock_points : 100,
          page_count: args.page_count || 180,
          price: args.price !== undefined ? args.price : 0,
        };
        const res = await fetch(`${apiBase}/admin/books`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ebookData)
        });
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'rgplay_generate_ai_tts': {
        const res = await fetch(`${apiBase}/ai/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args)
        });
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'rgplay_get_system_status': {
        const res = await fetch(`${apiBase}/status`);
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      default:
        throw new Error(`Outil inconnu : ${name}`);
    }
  } catch (err) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Erreur lors de l'exécution de ${name}: ${err.message}` }]
    };
  }
}

// ─── Protocole Standard JSON-RPC 2.0 (MCP over stdio) ─────────────────────────
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

function sendResponse(id, result, error = null) {
  const response = {
    jsonrpc: '2.0',
    id
  };
  if (error) {
    response.error = error;
  } else {
    response.result = result;
  }
  process.stdout.write(JSON.stringify(response) + '\n');
}

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let request;
  try {
    request = JSON.parse(trimmed);
  } catch (e) {
    sendResponse(null, null, { code: -32700, message: 'Parse error' });
    return;
  }

  const { id, method, params } = request;

  switch (method) {
    case 'initialize':
      sendResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: true },
          resources: { listChanged: true }
        },
        serverInfo: {
          name: SERVER_NAME,
          version: SERVER_VERSION
        }
      });
      break;

    case 'notifications/initialized':
      // Notification du client — pas de réponse requise
      break;

    case 'ping':
      sendResponse(id, {});
      break;

    case 'tools/list':
      sendResponse(id, { tools: TOOLS });
      break;

    case 'tools/call':
      if (!params || !params.name) {
        sendResponse(id, null, { code: -32602, message: 'Paramètre "name" manquant' });
        return;
      }
      const toolResult = await handleToolCall(params.name, params.arguments || {});
      sendResponse(id, toolResult);
      break;

    case 'resources/list':
      sendResponse(id, {
        resources: [
          {
            uri: 'rgplay://api/status',
            name: 'État Système RG Play',
            description: 'État en temps réel des bases D1, buckets R2, KV et CamerPay'
          },
          {
            uri: 'rgplay://api/analytics',
            name: 'Statistiques RG Play',
            description: 'Métriques globales de fréquentation et d\'écoute'
          }
        ]
      });
      break;

    default:
      if (id !== undefined && id !== null) {
        sendResponse(id, null, { code: -32601, message: `Méthode non supportée : ${method}` });
      }
      break;
  }
});

// Logs d'initialisation sur stderr (jamais sur stdout pour respecter le protocole stdio)
process.stderr.write(`[MCP-RGPLAY] Serveur démarré avec succès v${SERVER_VERSION} (API: ${DEFAULT_API_BASE})\n`);
