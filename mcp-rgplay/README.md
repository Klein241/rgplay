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

---

## 🔴 RÈGLE OBLIGATOIRE — Compression Audio Avant Tout Upload R2

> ⚠️ **Cette règle est non-négociable.** Tout agent IA (MANUS, Claude, Gemini, GPT…) doit l'appliquer **systématiquement** avant d'appeler `/api/r2/upload` ou `/api/r2/upload-from-url`.

### Pourquoi ?
Le stockage Cloudflare R2 est limité à **10 Go sur le plan gratuit**.
- Un fichier WAV de 3 minutes = **~45 Mo** brut
- Le même fichier en MP3 128kbps = **~3.5 Mo** compressé
- **Économie : -92%** — un audiobook de 30 chapitres passe de ~1.3 Go à ~105 Mo

Le serveur Cloudflare Worker **ne peut pas compresser audio** (pas d'AudioContext côté Edge). La compression doit donc être faite **avant l'envoi**.

---

### ✅ Commandes ffmpeg à utiliser (obligatoires)

> `ffmpeg` est disponible nativement dans l'environnement MANUS (Linux). Vérifier avec `ffmpeg -version`.

#### 🎵 Musique / Singles / Lofi (stéréo 128 kbps)
```bash
ffmpeg -i input.wav -codec:a libmp3lame -b:a 128k -ar 44100 -ac 2 output.mp3
```

#### 🎙️ Voix / Audiobooks / Podcasts / Masterclasses (mono 96 kbps)
```bash
ffmpeg -i input.wav -codec:a libmp3lame -b:a 96k -ar 44100 -ac 1 output.mp3
```

#### 📦 Conversion en masse — 30 chapitres d'un seul coup
```bash
# Convertir tous les WAV d'un dossier en MP3 mono 96kbps (voix)
for f in /chemin/chapitres/*.wav; do
  ffmpeg -i "$f" -codec:a libmp3lame -b:a 96k -ar 44100 -ac 1 "${f%.wav}.mp3"
done
```

#### 🔄 Depuis un FLAC ou M4A
```bash
ffmpeg -i chapitre01.flac -codec:a libmp3lame -b:a 96k -ar 44100 -ac 1 chapitre01.mp3
ffmpeg -i piste.m4a     -codec:a libmp3lame -b:a 128k -ar 44100 -ac 2 piste.mp3
```

---

### ❌ Ce qu'il ne faut JAMAIS faire

| Format interdit | Raison |
|---|---|
| Uploader un `.wav` brut | 40–60 Mo par fichier → R2 saturé en < 200 fichiers |
| Uploader un `.flac` brut | Idem, non compressé |
| Uploader un `.aiff` brut | Idem |
| Envoyer un MP3 > 192 kbps | Taille inutilement grande pour du streaming mobile |

---

### 📋 Workflow complet MANUS pour un Audiobook

```
1. Télécharger les fichiers audio source (WAV/FLAC) depuis la source
2. Convertir chaque chapitre avec ffmpeg (mono 96kbps) → fichiers .mp3
3. Vérifier la taille : chaque chapitre doit peser < 5 Mo (3 min) à < 15 Mo (10 min)
4. Uploader via POST /api/r2/upload (multipart) ou /api/r2/upload-from-url (URL)
5. Récupérer le r2_key retourné et l'utiliser dans rgplay_create_or_update_audiobook
```

---

### 🎯 Tableau des tailles cibles

| Durée du chapitre | WAV brut (avant) | MP3 96k mono (après) | Gain |
|---|---|---|---|
| 3 min | ~45 Mo | ~2.1 Mo | **-95%** |
| 5 min | ~75 Mo | ~3.5 Mo | **-95%** |
| 10 min | ~150 Mo | ~7 Mo | **-95%** |
| 30 min (chapitre long) | ~450 Mo | ~21 Mo | **-95%** |
| **Audiobook 30 chapitres × 5 min** | **~2.25 Go** | **~105 Mo** | **-95%** |

