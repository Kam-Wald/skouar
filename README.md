# Skouar

Lanceur d'applications **local-first** : une coque unique (le « launcher ») regroupe des applications modulaires, installable en **PWA** (icône sur le bureau / écran d'accueil) et utilisable 100 % hors ligne.

Première app : **Calepin** 🗒 — un éditeur de pages/bases de données type Notion (pages, titres, listes à puces, tâches), dont les données restent dans le navigateur.

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

## Utilisation de Calepin

- Barre latérale : créer / sélectionner / supprimer des pages.
- `Entrée` crée un bloc après le bloc courant, `Backspace` dans un bloc vide le supprime.
- La barre d'outils convertit le bloc actif (paragraphe, H1, H2, puce, tâche).
- Sauvegarde automatique (debounced) dans `localStorage`.

## CI/CD et déploiement (GitHub Actions + Pages)

- `.github/workflows/ci.yml` : à chaque PR et chaque push sur `main` → `npm ci` + `npm run build` (typecheck inclus), statut ✅/❌ sur la PR
- `.github/workflows/pages.yml` : à chaque push sur `main` → build + déploiement de `dist/` sur **GitHub Pages** : la PWA est alors en ligne (HTTPS, installable bureau/tablette) à l'URL `https://<pseudo>.github.io/skouar/`
- Prérequis manuel une seule fois : Settings → Pages → Source = « GitHub Actions »
- En local, `base` reste `/` ; en CI il devient automatiquement `/skouar/` (`vite.config.ts`)

## Fonctionnalités de Calepin (ex-« Blocs »)

- **Annuler/rétablir** (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y), **mise en forme inline** (Ctrl+B/I/U)
- Mentions `[[page]]` + panneau **liens entrants/sortants**, **étiquettes (tags)** colorées + filtre
- **Corbeille** (restauration 30 j), **20 templates** de page + duplication de page
- Import **.md**, export page en **.md** et **PDF** (impression), collage/dépôt d'image → bloc auto
- Recherche avec filtres de type + extraits surlignés, **thème clair/sombre + accent personnalisable**, **vue mobile** (barre latérale en tiroir)
- **Vue graphe** 🕸 (barre latérale) : nœuds = pages, arêtes = [[mentions]] + sous-pages, simulation de forces, zoom, clic = ouvrir la page
- **Journal quotidien** 📅 : bouton « Aujourd'hui » → page AAAA-MM-JJ créée/ouverte automatiquement
- **Rappels de tâches** ⏰ : date/heure sur une tâche (popover inline, pas de prompt) → notification PWA à l'échéance + cloche 🔔 avec compteur de retards
- BDD : **agrégats en pied de tableau** (compter, somme, moyenne, min, max, cochées)

- Calepin : paragraphe, H1/H2/H3, puces, tâches, citation, code, séparateur, image, **vidéo (embed YouTube/mp4)**, **audio**, **PDF** (lecteur), **fichier/archive** (carte téléchargeable), **menu dépliant** (blocs enfants), **bouton** (avec URL), **table des matières** (auto depuis H1–H3) — tout insérable via le **menu « / »** ; **drag’n’drop** des blocs, des pages, des colonnes de BDD et des cartes du board ; listes numérotées (compteur auto) et **blocs colonnes 2–4**
- **Icône emoji + couleur de tuile** (grande galerie) et **couverture** par page : un seul picto 🖼 ouvre un menu couleur / motif (20) / URL / fichier — plus aucun `prompt()` JS pour les URL, **fil d’ariane** des pages parentes
- **Bases de données** (bloc ▦) : colonnes typées (texte, nombre, sélection, date, case) via formulaire inline, filtres, tris, et **8 vues** : tableau, board, galerie, calendrier, liste, chronologie, fil d’actus, graphique (barres compte/somme)

## Identité

- Logo Skouar : 4 propositions dans `public/icons/variants/v1–v4.png` (v2 = trois barres, choisi par défaut ; les 4 restent dans le site ; v4 = clin d’œil lapin). Changer = modifier `scripts/gen-icons.mjs` + `public/icon.svg` et lancer `npm run icons`.
- Logo de l’app Calepin : `public/app-icons/calepin.svg`, réutilisable comme base pour les prochaines apps.

## Roadmap

- [ ] Test de l'installation PWA en ligne (bureau + tablette) sur l'URL Pages
- [x] Stockage IndexedDB (Dexie, migration auto depuis localStorage) + export/import JSON (boutons ↓ Exporter / ↑ Importer dans Blocs)
- [x] Synchro P2P optionnelle (Yjs + Trystero/WebRTC, zéro serveur) : bouton ⇄ Sync dans Blocs, code de salon à partager entre appareils (v1 : état synchronisé par document, le plus récent l’emporte)
- [ ] Synchro CRDT fine par bloc + mini-serveur perso (y-sweet, Rust) en alternative
- [x] Pages imbriquées (sous-pages, niveaux, suppression qui rebranche les enfants) + recherche (titre, blocs, cellules de BDD) dans la barre latérale
- [ ] Version desktop autonome partageable (Tauri)
