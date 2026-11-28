# Skouar

**Lanceur d'applications local-first** : une coque unique + des apps modulaires, installable en
PWA, utilisable **100 % hors ligne**. Aucune ressource réseau au runtime, aucune télémétrie.
Tes données restent sur ton appareil (IndexedDB + localStorage).

- PWA en ligne : https://kam-wald.github.io/skouar/ (déploiement auto à chaque push sur `main`)
- Historique v1 conservé sur la branche `archive/v1` ; la suite est reconstruite selon
  [`docs/cdc-global.md`](docs/cdc-global.md) et `AGENTS.md`.

## Les applications

| App | Tag | Statut |
| --- | --- | --- |
| Karneto 📓 | · notes & bdd | en reconstruction |
| Skrid ✍️ | · écriture | en reconstruction |
| Ler 📕 | · pdf | en reconstruction |
| Skeud 🖼️ | · photos | en reconstruction |
| Kod 💻 | · éditeur de code | en reconstruction |
| Cockpit 🎛️ | · productivité & focus | en reconstruction |
| Unvez 📐 | · unités & calcul | en reconstruction |
| Taol 🧮 | · tableur | en reconstruction |
| Fichorama 👢 | · fiches & notation | en reconstruction |
| Salveto 🩺 | · santé & humeur (desktop-only) | en reconstruction |
| Tres ✏️ | · dessin & vectoriel | bientôt |
| Kemm 🔀 | · fichiers & zip | bientôt |
| Klevet 🎤 | · audio | bientôt |
| Arc'hant 💰 | · budget | bientôt |

Chaque app est reconstruite une par une, précédée de son propre CDC (voir
[`docs/cdc-global.md`](docs/cdc-global.md)).

## Tes données

- Stockage 100 % local : IndexedDB (une base par app, via Dexie) + localStorage (clés `skouar:*`).
- **Exporte régulièrement** tes données en ZIP depuis ⚙️ Réglages (avant tout import, un snapshot
  de sécurité est fait automatiquement).
- ⚠️ **Deux origines, deux stockages** : `http://localhost:5173` (développement) et la PWA déployée
  ont des stockages **séparés**. Ne conclus jamais à une perte de données sans vérifier l'origine
  ouverte.
- Le service worker ne touche jamais à tes données.

## Développement

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # vitest (logique + smoke jsdom + fake-indexeddb)
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + build dans dist/
npm run icons      # régénère les icônes PWA dans public/icons
```

- CI (`.github/workflows/ci.yml`) : `npm ci` + `npm run build` + `npm test` à chaque PR et chaque
  push sur `main`. Déploiement GitHub Pages via `.github/workflows/pages.yml`.
- Conventions, règles de non-régression données (obligatoires) et notes opérationnelles :
  [`AGENTS.md`](AGENTS.md). Cahier des charges global : [`docs/cdc-global.md`](docs/cdc-global.md).
