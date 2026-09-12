---
description: Règle formelle d'architecture et de modularité du code pour RG Play
globs: ["functions/**", "src/**"]
---

# Directives d'Architecture Modulaire et Prévention des Fichiers Monolithiques

Pour préserver la maintenabilité du projet **RG Play**, chaque agent IA doit strictement adhérer aux règles suivantes :

1. **Plafond de taille :** Aucun fichier ne doit excéder 400 lignes de code. Dès qu'un fichier s'en approche, la logique doit être scindée.
2. **Isolation du backend (`functions/api/[[route]].js`) :**
   - Ne jamais rajouter de code ou de nouvelle route directement dans `[[route]].js`.
   - Créer un module dédié sous `functions/api/handlers/<nom_domaine>.js` (ex : `analytics.js`, `users.js`, `audiobooks.js`, `ebooks.js`, `payments.js`, `ai.js`).
   - Exporter une fonction de dispatch `handle<Domaine>Routes(path, method, request, env, ctx)` depuis chaque handler.
3. **Isolation du frontend (`src/`) :**
   - Éviter d'accumuler de la logique dans `AdminStudioView.jsx` ou `api.js`.
   - Utiliser des sous-dossiers thématiques (`src/services/api/`, `src/views/admin/components/`).
4. **Utilisation parcimonieuse du terminal :**
   - Ne jamais lancer de requêtes terminal exploratoires inutiles.
   - Privilégier les outils de lecture et d'édition de code directes.
