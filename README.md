# Skouar

Lanceur d'applications **local-first** : une coque unique (le « launcher ») regroupe des applications modulaires, installable en **PWA** (icône sur le bureau / écran d'accueil) et utilisable 100 % hors ligne.

Première app : **Blocs** ▦ — un éditeur de blocs type Notion (pages, titres, listes à puces, tâches), dont les données restent dans le navigateur.

## Stack

- Vite + React 18 + TypeScript
- React Router : `/` = launcher, `/app/<id>` = une app
- `vite-plugin-pwa` : manifest + service worker (mode `generateSW`)
- Stockage local-first : `localStorage` (v1)

## Commandes

```bash
npm install
npm run dev      # dev server (http://localhost:5173)
npm run build    # typecheck + build de production dans dist/
npm run preview  # sert dist/ en local
npm run icons    # régénère les icônes PWA dans public/icons
```

## Structure

```
src/
  main.tsx, App.tsx          point d'entrée + routes
  styles.css                 thème sombre
  launcher/LauncherHome.tsx  la place : grille de tuiles d'apps
  apps/registry.ts           registre des apps (1 entrée = 1 nouvelle app)
  apps/blocs/                app « Blocs » : types, store local-first, éditeur
public/                      icon.svg + icônes PNG générées
scripts/gen-icons.mjs        génération des PNG sans dépendance externe
```

## Utilisation de Blocs

- Barre latérale : créer / sélectionner / supprimer des pages.
- `Entrée` crée un bloc après le bloc courant, `Backspace` dans un bloc vide le supprime.
- La barre d'outils convertit le bloc actif (paragraphe, H1, H2, puce, tâche).
- Sauvegarde automatique (debounced) dans `localStorage`.

## CI/CD et déploiement (GitHub Actions + Pages)

- `.github/workflows/ci.yml` : à chaque PR et chaque push sur `main` → `npm ci` + `npm run build` (typecheck inclus), statut ✅/❌ sur la PR
- `.github/workflows/pages.yml` : à chaque push sur `main` → build + déploiement de `dist/` sur **GitHub Pages** : la PWA est alors en ligne (HTTPS, installable bureau/tablette) à l'URL `https://<pseudo>.github.io/skouar/`
- Prérequis manuel une seule fois : Settings → Pages → Source = « GitHub Actions »
- En local, `base` reste `/` ; en CI il devient automatiquement `/skouar/` (`vite.config.ts`)

## Fonctionnalités de Blocs

- Blocs : paragraphe, H1, H2, puces, tâches cochables
- **Bases de données** (bloc ▦) : colonnes typées (texte, nombre, sélection, date, case), filtres, tris, et **4 vues** : tableau, board (kanban groupé), galerie, calendrier

## Roadmap

- [ ] Test de l'installation PWA en ligne (bureau + tablette) sur l'URL Pages
- [x] Stockage IndexedDB (Dexie, migration auto depuis localStorage) + export/import JSON (boutons ↓ Exporter / ↑ Importer dans Blocs)
- [x] Synchro P2P optionnelle (Yjs + Trystero/WebRTC, zéro serveur) : bouton ⇄ Sync dans Blocs, code de salon à partager entre appareils (v1 : état synchronisé par document, le plus récent l’emporte)
- [ ] Synchro CRDT fine par bloc + mini-serveur perso (y-sweet, Rust) en alternative
- [ ] Pages imbriquées + recherche
- [ ] Version desktop autonome partageable (Tauri)
