# 🎙️ Serveur MCP RG Play (Model Context Protocol)

Le serveur **MCP RG Play** permet à tout assistant ou agent IA (Claude Desktop, Cursor, Gemini Antigravity, VS Code Cline, OpenAI Agents, LibreChat) d'interagir directement avec l'écosystème complet de la plateforme audio **RG Play**.

---

## 🚀 Démarrage Rapide

### Prérequis
- Node.js version 18 ou supérieure (`node -v`)

### Lancement direct
```bash
node index.js
```

---

## 🛠️ Configuration dans les Assistants IA

### 1. Claude Desktop (`claude_desktop_config.json`)
Emplacement du fichier :
- **Windows** : `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS** : `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "rgplay": {
      "command": "node",
      "args": [
        "c:/Users/SYGMA-TECH/Documents/RG Play/mcp-rgplay/index.js"
      ],
      "env": {
        "RGPLAY_API_BASE": "https://rg-play.pages.dev/api"
      }
    }
  }
}
```

---

### 2. Cursor IDE (`.cursor/mcp.json` ou Paramètres Cursor)
Dans les paramètres MCP de Cursor :
- **Nom** : `rgplay`
- **Type** : `command`
- **Commande** : `node c:/Users/SYGMA-TECH/Documents/RG Play/mcp-rgplay/index.js`

---

### 3. Gemini Antigravity (`mcp_config.json`)
```json
{
  "mcpServers": {
    "rgplay": {
      "command": "node",
      "args": ["c:/Users/SYGMA-TECH/Documents/RG Play/mcp-rgplay/index.js"]
    }
  }
}
```

---

## 📚 Liste des Outils Disponibles

| Outil MCP | Description | Paramètres Clés |
|---|---|---|
| `rgplay_list_audiobooks` | Liste et filtre les contenus audio | `type`, `category`, `search`, `featured` |
| `rgplay_get_audiobook` | Récupère tous les détails et chapitres d'un livre | `book_id` |
| `rgplay_create_or_update_audiobook` | Crée ou met à jour un livre audio dans D1 | `title`, `author`, `price`, `chapters`, etc. |
| `rgplay_delete_audiobook` | Supprime un livre audio de la base D1 | `book_id` |
| `rgplay_toggle_pin_audiobook` | Épingle ou désépingle un livre en tête | `book_id`, `is_pinned` |
| `rgplay_update_social_metrics` | Applique l'Effet de Masse (écoutes, avis, note) | `book_id`, `display_plays_count`, etc. |
| `rgplay_list_categories` | Liste les catégories et thématiques | *(aucun)* |
| `rgplay_create_category` | Crée ou modifie une catégorie | `name`, `slug`, `icon`, `color` |
| `rgplay_delete_category` | Supprime une catégorie du catalogue | `category_id` |
| `rgplay_initiate_payment` | Lance un paiement réel CamerPay (OM, MoMo, Carte) | `audiobook_id`, `payment_method`, `customer_phone`, `amount` |
| `rgplay_get_payment_status` | Vérifie le statut d'une transaction | `transaction_id` |
| `rgplay_sync_pending_payments` | Synchronise et valide les paiements en attente | *(aucun)* |
| `rgplay_get_user_library` | Récupère la bibliothèque d'un utilisateur | `user_id` |
| `rgplay_get_analytics_summary` | Tableau de bord analytique et trafic | *(aucun)* |
| `rgplay_track_event` | Enregistre un événement analytique | `event_type`, `visitor_id`, `audiobook_id` |
| `rgplay_get_system_status` | Diagnostic de l'infrastructure Cloudflare | *(aucun)* |

---

## 💡 Exemples de Prompts pour l'IA

- *"Ajoute un nouveau podcast intitulé 'L'Avenir de l'IA en Afrique' par Samuel Eto'o avec une jaquette Unsplash et un chapitre de 30 minutes."*
- *"Applique un effet de masse sur le livre 'L'Alchimiste' avec 28 500 écoutes, 4 200 avis et une note de 4.96."*
- *"Affiche les statistiques de fréquentation de la boutique RG Play pour aujourd'hui."*
- *"Vérifie l'état de la base de données Cloudflare D1 et du stockage R2."*
- *"Épingle le livre 'Psychologie de l'Argent' en haut du catalogue."*
