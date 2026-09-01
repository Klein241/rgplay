# 📖 Documentation Officielle & Complète du Serveur MCP & API REST RG Play

La plateforme **RG Play** met à disposition une double passerelle d'intégration pour les modèles d'Intelligence Artificielle et les développeurs :
1. **Le Serveur Model Context Protocol (MCP)** : Standard JSON-RPC 2.0 pour Claude Desktop, Cursor, Gemini Antigravity et les environnements d'agents IA.
2. **L'API REST Production HTTPS** : Endpoints REST sécurisés par Bearer Token pour Manus IA, ChatGPT, scripts Python, Node.js et requêtes cURL.

---

## 🌐 1. Point d'Entrée Global & Paramètres d'Authentification

| Paramètre | Valeur de Production |
|---|---|
| **Base URL (Point d'Entrée)** | `https://rg-play.pages.dev/api` |
| **Protocole** | HTTPS / REST / JSON |
| **Header d'Authentification** | `Authorization: Bearer <VOTRE_CLE_API>` |
| **Content-Type** | `application/json` |
| **Générateur de Clés** | Backoffice Admin RG Play → Onglet **« Générateur d'API & IA »** |

---

## 📡 2. Référentiel Exhaustif des Endpoints de l'API REST

### A. 📚 Catalogue & Livres Audio

#### 1. Lister le Catalogue
- **Méthode** : `GET`
- **URL** : `https://rg-play.pages.dev/api/audiobooks`
- **Paramètres Query (Optionnels)** :
  - `type` : `'all' | 'audiobook' | 'podcast' | 'music' | 'masterclass'` (défaut: `'all'`)
  - `category` : ID ou slug de catégorie (ex: `'cat-1'`, `'developpement-personnel'`)
  - `search` : Terme de recherche (titre, auteur, narrateur)
  - `featured` : `'true'` pour filtrer les contenus mis en vedette
- **Exemple de Requête** :
  ```bash
  curl -X GET "https://rg-play.pages.dev/api/audiobooks?type=podcast&search=foi" \
    -H "Authorization: Bearer VOTRE_CLE_API"
  ```
- **Réponse Type (JSON)** :
  ```json
  [
    {
      "id": "book-1",
      "title": "Prie puis agis",
      "author": "RGPlay",
      "content_type": "audiobook",
      "price": 2500,
      "discount_price": 2000,
      "rating": 4.95,
      "display_plays_count": 28000,
      "display_reviews_count": 5600,
      "is_pinned": 1,
      "category_name": "Motivations Chrétiennes",
      "cover_url": "https://..."
    }
  ]
  ```

#### 2. Consulter la Fiche Complète d'un Livre Audio
- **Méthode** : `GET`
- **URL** : `https://rg-play.pages.dev/api/audiobooks/{id}`
- **Paramètre URL** : `id` (ex: `book-1`)
- **Réponse** : Métadonnées complètes du livre avec la liste ordonnée des chapitres et URLs audio.

#### 3. Créer ou Mettre à Jour un Contenu (Admin / IA)
- **Méthode** : `POST`
- **URL** : `https://rg-play.pages.dev/api/admin/books`
- **Body JSON** :
  ```json
  {
    "title": "L'Art de la Persuasion",
    "author": "Dr. Jean Dupont",
    "narrator": "Voix Studio Pro",
    "content_type": "masterclass",
    "price": 3500,
    "discount_price": 2500,
    "category_name": "Business & Négociation",
    "description": "Apprenez les techniques de négociation indispensables.",
    "synopsis": "Guide stratégique pour cadres et entrepreneurs.",
    "cover_url": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c",
    "preview_url": "https://pub-r2.cloudflarestorage.com/extrait.mp3",
    "is_featured": true,
    "is_bestseller": true,
    "chapters": [
      {
        "title": "Module 1 : Les Fondements de l'Influence",
        "audio_url": "https://pub-r2.cloudflarestorage.com/chapitre1.mp3",
        "duration_seconds": 1800
      }
    ]
  }
  ```

#### 4. Épingler / Désépingler un Livre en Vitrine
- **Méthode** : `POST`
- **URL** : `https://rg-play.pages.dev/api/admin/books/{id}/toggle-pin`
- **Body JSON** :
  ```json
  {
    "is_pinned": true
  }
  ```

#### 5. Supprimer un Contenu
- **Méthode** : `DELETE`
- **URL** : `https://rg-play.pages.dev/api/admin/books/{id}`

---

### B. 🔥 Effet de Masse & Preuve Sociale (Social Proof)

#### 6. Personnaliser les Compteurs d'Écoutes et d'Avis
- **Méthode** : `POST`
- **URL** : `https://rg-play.pages.dev/api/admin/books/{id}/social-metrics`
- **Body JSON** :
  ```json
  {
    "display_plays_count": 28500,
    "display_reviews_count": 4200,
    "display_rating": 4.98
  }
  ```

---

### C. 📂 Univers & Catégories

#### 7. Lister les Catégories
- **Méthode** : `GET`
- **URL** : `https://rg-play.pages.dev/api/categories`

#### 8. Créer ou Mettre à Jour une Catégorie
- **Méthode** : `POST`
- **URL** : `https://rg-play.pages.dev/api/admin/categories`
- **Body JSON** :
  ```json
  {
    "name": "Investissement & Finance",
    "slug": "investissement-finance",
    "icon": "TrendingUp",
    "color": "#10b981",
    "display_order": 1
  }
  ```

#### 9. Supprimer une Catégorie
- **Méthode** : `DELETE`
- **URL** : `https://rg-play.pages.dev/api/admin/categories/{id}`

---

### D. 💳 Passerelle de Paiement Mobile Money & Carte (CamerPay)

#### 10. Déclencher un Paiement
- **Méthode** : `POST`
- **URL** : `https://rg-play.pages.dev/api/payment/initiate`
- **Body JSON** :
  ```json
  {
    "audiobook_id": "book-1",
    "payment_method": "orange_money",
    "customer_phone": "699456779",
    "amount": 2500
  }
  ```
- **Réponse Type** :
  ```json
  {
    "success": true,
    "transaction_id": "RGP-1788053630110-51OPX",
    "status": "pending",
    "message": "Demande USSD envoyée. Validez sur votre téléphone."
  }
  ```

#### 11. Vérifier le Statut d'une Transaction
- **Méthode** : `GET`
- **URL** : `https://rg-play.pages.dev/api/payment/status/{transaction_id}`

#### 12. Synchroniser les Paiements en Attente
- **Méthode** : `POST`
- **URL** : `https://rg-play.pages.dev/api/admin/payment/sync-pending`

---

### E. 📊 Statistiques & Diagnostic Infrastructure

#### 13. Consulter les Statistiques de Trafic
- **Méthode** : `GET`
- **URL** : `https://rg-play.pages.dev/api/admin/analytics`

#### 14. Vérifier la Santé de Cloudflare D1, R2, KV
- **Méthode** : `GET`
- **URL** : `https://rg-play.pages.dev/api/status`

---

## 🤖 3. Guides de Connexion aux Assistants IA

### 1. 🤖 Connexion à Manus IA (Instructions Système / Agent Prompt)

Copiez ce prompt dans l'instruction de départ de votre agent **Manus IA** :

```text
Tu es l'agent IA officiel et administrateur de la plateforme audio RG Play (https://rg-play.pages.dev).

Informations d'accès à l'API de Production :
- Base URL : https://rg-play.pages.dev/api
- Clé d'autorisation : Bearer [VOTRE_CLE_API]
- Format d'échange : JSON (Header 'Content-Type: application/json')

Endpoints disponibles et fonctions :
1. GET /audiobooks : Lister et rechercher dans le catalogue (?type=all|audiobook|podcast|music, ?category=id, ?search=motcle)
2. GET /audiobooks/:id : Consulter la fiche complète d'un livre et ses chapitres
3. POST /admin/books : Créer ou mettre à jour un contenu dans Cloudflare D1
4. POST /admin/books/:id/social-metrics : Définir l'effet de masse (display_plays_count, display_reviews_count, display_rating)
5. POST /admin/books/:id/toggle-pin : Épingler/désépingler un livre en tête de vitrine
6. DELETE /admin/books/:id : Supprimer un livre audio
7. GET /categories & POST /admin/categories : Gérer les univers et catégories
8. POST /payment/initiate : Déclencher un paiement Mobile Money (Orange, MTN) ou Carte
9. GET /payment/status/:id : Vérifier l'état d'un paiement en temps réel
10. GET /admin/analytics : Consulter les visites, écoutes et statistiques
11. GET /status : Diagnostic de Cloudflare D1, R2 et KV

Exécute la mission suivante avec rigueur en utilisant les requêtes HTTP appropriées.
```

---

### 2. 🧩 Configuration Claude Desktop (MCP JSON-RPC)

Fichier de configuration : `%APPDATA%\Claude\claude_desktop_config.json` (Windows) ou `~/.config/Claude/claude_desktop_config.json` (macOS/Linux) :

```json
{
  "mcpServers": {
    "rgplay": {
      "command": "node",
      "args": [
        "c:/Users/SYGMA-TECH/Documents/RG Play/mcp-rgplay/index.js"
      ],
      "env": {
        "RGPLAY_API_BASE": "https://rg-play.pages.dev/api",
        "RGPLAY_API_KEY": "VOTRE_CLE_API"
      }
    }
  }
}
```

---

### 3. 💻 Configuration Cursor IDE

Dans **Cursor Settings > Features > MCP Servers > Add New MCP Server** :
- **Name** : `rgplay`
- **Type** : `command`
- **Command** : `node "c:/Users/SYGMA-TECH/Documents/RG Play/mcp-rgplay/index.js"`

---

### 4. 🧠 Configuration Gemini Antigravity

Dans votre fichier de configuration `.gemini/config/mcp_config.json` :

```json
{
  "mcpServers": {
    "rgplay": {
      "command": "node",
      "args": [
        "c:/Users/SYGMA-TECH/Documents/RG Play/mcp-rgplay/index.js"
      ],
      "env": {
        "RGPLAY_API_BASE": "https://rg-play.pages.dev/api",
        "RGPLAY_API_KEY": "VOTRE_CLE_API"
      }
    }
  }
}
```

---

## 🛠️ 4. Liste Complète des Outils MCP (Tools)

| Nom de l'Outil MCP | Description | Paramètres Principaux |
|---|---|---|
| `rgplay_list_audiobooks` | Lister et filtrer les contenus | `type`, `category`, `search`, `featured` |
| `rgplay_get_audiobook` | Fiche complète avec chapitres | `book_id` *(requis)* |
| `rgplay_create_or_update_audiobook` | Publier ou modifier un titre D1 | `title`, `author`, `price`, `chapters`... |
| `rgplay_delete_audiobook` | Supprimer un livre | `book_id` *(requis)* |
| `rgplay_toggle_pin_audiobook` | Épingler en vitrine | `book_id`, `is_pinned` |
| `rgplay_update_social_metrics` | Appliquer l'effet de masse | `book_id`, `display_plays_count`, `display_reviews_count`, `display_rating` |
| `rgplay_list_categories` | Lister les catégories | *(aucun)* |
| `rgplay_create_category` | Ajouter/modifier une catégorie | `name`, `slug`, `icon`, `color` |
| `rgplay_delete_category` | Supprimer une catégorie | `category_id` *(requis)* |
| `rgplay_initiate_payment` | Déclencher paiement CamerPay | `audiobook_id`, `payment_method`, `customer_phone`, `amount` |
| `rgplay_get_payment_status` | Vérifier transaction | `transaction_id` *(requis)* |
| `rgplay_sync_pending_payments` | Synchroniser les paiements | *(aucun)* |
| `rgplay_get_analytics_summary` | Métriques & trafic | *(aucun)* |
| `rgplay_get_system_status` | Diagnostic Cloudflare D1/R2/KV | *(aucun)* |

---

## 💻 5. Snippets de Code Prêts à l'Emploi

### A. JavaScript / Node.js (Fetch)
```javascript
const API_BASE = 'https://rg-play.pages.dev/api';
const API_KEY = 'VOTRE_CLE_API';

async function listAudiobooks() {
  const res = await fetch(`${API_BASE}/audiobooks?type=all`, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  return await res.json();
}
```

### B. Python (Requests)
```python
import requests

API_BASE = "https://rg-play.pages.dev/api"
API_KEY = "VOTRE_CLE_API"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# 1. Consulter le catalogue
response = requests.get(f"{API_BASE}/audiobooks", headers=headers)
audiobooks = response.json()
print(f"{len(audiobooks)} livres trouvés.")

# 2. Appliquer l'effet de masse
requests.post(
    f"{API_BASE}/admin/books/book-1/social-metrics",
    headers=headers,
    json={
        "display_plays_count": 28000,
        "display_reviews_count": 4500,
        "display_rating": 4.96
    }
)
```

---

## 🔒 6. Sécurité & Bonnes Pratiques
- Conservez vos tokens d'accès secrets et ne les commitez jamais dans un dépôt public.
- Définissez des durées d'expiration ou révoquez les clés non utilisées depuis le Backoffice Admin RG Play.
- Tous les flux audio et images sont hébergés et distribués via **Cloudflare R2** et le réseau Edge CDN mondial.
