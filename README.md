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

## Roadmap

- [ ] Test de l'installation PWA (bureau + tablette) et hébergement statique (GitHub Pages, etc.)
- [ ] Stockage IndexedDB (Dexie) + export/import de fichier
- [ ] Synchro optionnelle entre appareils : CRDT (Yjs), P2P WebRTC ou mini-serveur perso
- [ ] Version desktop autonome partageable (Tauri)
