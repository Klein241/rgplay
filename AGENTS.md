# Directives Générales pour les Agents IA — RG Play (AGENTS.md)

Ce fichier est la référence architecturale suprême lue automatiquement par tout agent ou IA ouvrant ce projet.
Toute IA intervenant sur le dépôt **RG Play** doit OBLIGATOIREMENT respecter les règles ci-dessous avant d'écrire la moindre ligne de code.

---

## 🚨 RÈGLE N°1 : INTERDICTION STRICTE DES FICHIERS MONOLITHIQUES (> 400 LIGNES)

- **NE JAMAIS ajouter de nouveau code directement dans un fichier dépassant déjà 400 lignes.**
- En particulier, le fichier `functions/api/[[route]].js` (historiquement surchargé) **ne doit plus jamais recevoir de logique métier**.
- Chaque nouvelle fonctionnalité, route d'API ou composant UI doit avoir **son propre fichier indépendant**.

---

## 🏛️ ARCHITECTURE MODULAIRE IMPOSÉE DU BACKEND (`functions/api/`)

Le backend Cloudflare Pages Functions doit être strictement découpé en gestionnaires (handlers) thématiques dans `functions/api/handlers/` :

```text
functions/api/
├── [[route]].js                 <-- Routeur dispatcher ultra-léger (< 80 lignes)
└── handlers/
    ├── analytics.js             <-- Tracking visiteurs, géo-IP, logs, dashboard stats
    ├── users.js                 <-- Inscription, profil, gestion des utilisateurs, Sky Points
    ├── audiobooks.js            <-- Streaming, chapitres, catalogue audio, stockage R2
    ├── ebooks.js                <-- Lecture PDF, synchronisation e-books, import en masse
    ├── payments.js              <-- CamerPay, Orange Money, MTN MoMo, webhooks
    ├── ai.js                    <-- Intégration DeepSeek (Flash v4), tuteur IA, métadonnées
    ├── admin.js                 <-- Clés API, sauvegardes, statistiques avancées
    └── db.js                    <-- Schémas SQLite D1, tables et helpers SQL partagés
```

### Règle d'implémentation pour le backend :
1. Si vous créez ou modifiez un endpoint `/api/xyz`, vous devez créer ou modifier `functions/api/handlers/xyz.js`.
2. `functions/api/[[route]].js` ne sert **uniquement** qu'à importer les sous-handlers et dispatcher la requête `onRequest(context)`.

---

## 🎨 ARCHITECTURE MODULAIRE IMPOSÉE DU FRONTEND (`src/`)

- **Vues découpées :** Les vues d'administration comme `AdminStudioView.jsx` ou les rubriques d'édition volumineuses doivent systématiquement déléguer leur contenu à des sous-composants rangés dans un sous-dossier (ex : `src/views/admin/components/`).
- **Services API :** Ne pas concentrer tous les appels réseau dans un `api.js` unique de 1 500 lignes. Créer des modules sous `src/services/api/` (`audioApi.js`, `ebookApi.js`, `userApi.js`, etc.).
- **Taille limite :** Tout composant ou fichier dépassant 400 lignes doit être découpé en plusieurs sous-fichiers spécialisés.

---

## 🛠️ RÈGLE D'UTILISATION DU TERMINAL

- **Ne pas abuser du terminal.** N'exécuter de commandes via le terminal que lorsque c'est strictement indispensable (ex : `npm run build`, `npm run cf:deploy`, ou migration SQL D1).
- Pour lire, analyser ou modifier du code, utiliser directement les outils de visualisation et d'édition de fichiers (`view_file`, `replace_file_content`, `write_to_file`).

---

## 🇬🇦 GÉOLOCALISATION ET PUBLIC CIBLE

- Le public principal et le pays de base de la plateforme est le **Gabon (`GA` 🇬🇦)** et l'Afrique centrale (Cameroun `CM`, RDC `CD`, etc.).
- Dans toute logique de détection de localisation, conserver impérativement le fallback prioritaire sur le Gabon (`GA`) et la devise `XAF / FCFA`.
