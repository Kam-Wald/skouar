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
- BDD : **3 vues en plus** → **11 vues** : 🗺 **carte** (Leaflet, géocodage Nominatim, colonne « lieu »), 🗓 **frise Gantt** (2 colonnes date début/fin), 📊 **tableau de bord** (bouton 📊 sur la page : stats globales + lignes par BDD + pages récentes)
- BDD : **nouveaux champs** : multi-sélection, URL, e-mail, téléphone, **statut** (pastille colorée), **formule** (`{Col}` + calcul), **relation** (liens vers les lignes d'une autre BDD), **rollup** (somme/moyenne/count… via la relation), **lieu** (géocodé sur la carte), id, créé le, modifié le
- **8 nouveaux blocs** : encadré (callout coloré), **embed iframe**, **formule math KaTeX**, **barre de progression**, **QR code** (texte éditable), **compte à rebours**, **galerie d'images**, **page intégrée** (carte cliquable)
- **Bouton automatisation** ⚙ : un clic sur le bouton duplique N fois le bloc choisi de la page (ex : blocs recette de cuisine)
- **Modèles** : bouton 📋 (ou ＋) dans la barre latérale → picker des 20 templates
- **Design** : thème sombre éditorial (inspiration getartcraft) + thème clair, **glassmorphism sur les grands panneaux** (templates, graphe, rappels), launcher en **tuiles uniformes à bordure fine 1px** + 5 applis « Bientôt » non actives avec leur propre logo (Skrid ✍️ texte, Ler 📕 PDF, Skeud 🖼️ images, Taol 🧮 tableur, Tres ✏️ dessin/présentations), labels/badges/dates en **mono**, une seule couleur d'accent (états survolés/sélectionnés dérivés automatiquement)
- **Barre latérale** : en-tête **Calepin** (logo + nom, clic = retour au launcher), encart **🔔 Rappels** avec **point rouge pulsant si un rappel est dans les 48 h** (clic → liste des rappels), puis la liste des pages (sous-pages indentées dessous, plus de scrollbar horizontale), puis les lignes **＋ Nouvelle page** et **📋 Templates**
- **Launcher** : chaque logiciel est numéroté (01, 02…) en mono, descriptions sans le « 100 % local » (déjà en pied de page), logo Calepin distinct du logo Skouar (page à coin corné)
- **Picker d'icônes de page** : 2 sections — émojis + **pictos monochromes recolorables** (formes, symboles, maths) via les pastilles de couleur
- **Fermeture des fenêtres** (méthode actuelle : clic à l'extérieur + Échap) appliquée à **toutes** les popovers (icône, étiquettes, couverture, rappels, templates, URL, date, automatisation, formule, menu `/`, mentions, thème) ; la croix ✕ reste sur les grands panneaux (templates, rappels, graphe)
- **UX polish** : menu contextuel au **clic droit** (pages : ouvrir/dupliquer/sous-page/corbeille ; blocs : dupliquer/monter/descendre/supprimer), section **Récents** (4 dernières pages + horodatage relatif « il y a 2 h », aussi en infobulle sur chaque ligne), **en-tête de page sticky** au scroll, **toast « Annuler »** à la suppression (page ou bloc), **états vides guidés** (page vide → CTA templates ; BDD vide → « + Nouvelle ligne »), **skeleton de chargement**, `color-scheme` dark/light (contrôles natifs + scrollbars suivent le thème)
- **Menu `/` regroupé par catégories** (Texte, Listes, Mise en page, Médias, Avancé) avec labels mono ; pictos retirés du fil d'ariane
- **Sélection de texte** : barre flottante avec **couleur de police** (8 couleurs + auto) et **surlignage** (6 couleurs + aucun), appliquée en HTML inline (Ctrl+B/I/U toujours actifs)
- **Partage de page** 🔗 : export en **HTML autonome** (fichier unique stylisé, lisible partout — la version local-first du « lien public »)
- **Avancement auto** : barre de progression dans l'en-tête de page calculée depuis les tâches ☐/☑ de la page (ex. 3/5)
- **Bloc tableau simple** ⊞ (hors BDD) : cellules éditables inline, ＋ ligne / ＋ colonne quand le bloc est actif
- **Bloc code** : **coloration syntaxique** (mini-highlighter maison, 9 langages), **numéros de ligne**, sélecteur de langage, bouton **Copier**
- **Favoris** 📌 : épingler une page via le clic droit → section « Favoris » en haut de la sidebar ; sous-pages plus décalées vers la droite (indent 20 px/niveau), picto « remonter » déplacé dans le menu contextuel
- **30 templates** (10 nouveaux : CV avec BDD, routine matinale/soir avec tâches à cocher + barre de progression, compte-rendu, wishlist, liens utiles, idées cadeaux, menu de la semaine, travaux…) — les BDD des templates arrivent **pré-remplies de colonnes typées** (statut, priorité, date, montant, URL, e-mail…)
- **Icônes Lucide** dans le picker de page (3ᵉ section, ~52 icônes SVG recolorables — l'aperçu suit la couleur choisie, comme les motifs de couverture) ; dépendance `lucide-react` ajoutée
- **Sidebar** : en-tête (app, recherche, rappels, favoris, récents) et footer **toujours visibles**, filet séparateur, seule la liste des pages scrolle ; « ↓ JSON » → « ↓ Exporter », « Étiquettes » → « Tags »
- **Barre d'outils** : un seul bouton « ＋ Ajouter un bloc » ouvrant le menu catégorisé (au lieu des 30 boutons en ligne)
- **Export PDF fichier** 📄 : génère un vrai **.pdf téléchargé** (générateur PDF minimal maison, A4, titres/listes/code/BDD en texte, accents FR OK) — sans passer par l'impression
- **Frictions corrigées** : marqueurs de carte servis localement (plus de CDN, OK hors ligne), `alert()`/`prompt()` remplacés par des toasts + popover inline, ligne « ✓ enregistré · il y a 2 min » **au-dessus des boutons du footer**, historique Annuler/Rétablir **persisté** dans IndexedDB (survit au rechargement), PWA en `prompt` (toast « Recharger » au lieu d'un reload surprise), compteur de pairs sur le bouton Sync, état vide de page réellement atteignable, curseur conservé après Ctrl+B/I/U et undo, cibles tactiles ≥ 44 px sur mobile
- **Launcher** : sélecteur jour/nuit + accent en haut à droite (comme dans Calepin)
- **Rappels** : plus de fenêtre — la liste des rappels s'affiche **directement sous le titre « 🔔 Rappels »** dans la sidebar (clic = ouvre la page et scrolle jusqu'à la tâche)
- **Picker d'icônes** : section « Pictos » supprimée, libellé « Icônes » (sans « Lucide ») ; bug couleur corrigé (les icônes SVG/texte prennent la couleur du glyphe, les émojis le fond de tuile — plus de « icône invisible sur fond identique »)
- **Popover thème** : largeur adaptative (`min(240px, largeur sidebar - 16px)`) → plus rognée quand la sidebar est étroite

- Calepin : paragraphe, H1/H2/H3, puces, tâches, citation, code, séparateur, image, **vidéo (embed YouTube/mp4)**, **audio**, **PDF** (lecteur), **fichier/archive** (carte téléchargeable), **menu dépliant** (blocs enfants), **bouton** (avec URL), **table des matières** (auto depuis H1–H3) — tout insérable via le **menu « / »** ; **drag’n’drop** des blocs, des pages, des colonnes de BDD et des cartes du board ; listes numérotées (compteur auto) et **blocs colonnes 2–4**
- **Icône emoji + couleur de tuile** (grande galerie) et **couverture** par page : un seul picto 🖼 ouvre un menu couleur / motif (20) / URL / fichier — plus aucun `prompt()` JS pour les URL, **fil d’ariane** des pages parentes
- **Bases de données** (bloc ▦) : colonnes typées via formulaire inline (17 types, voir ci-dessus), filtres, tris, et **11 vues** : tableau, board, galerie, calendrier, liste, chronologie, fil d’actus, graphique, carte, Gantt + tableau de bord de page

## Identité

- Logo Skouar : 4 propositions dans `public/icons/variants/v1–v4.png` (v2 = trois barres, choisi par défaut ; les 4 restent dans le site ; v4 = clin d’œil lapin). Changer = modifier `scripts/gen-icons.mjs` + `public/icon.svg` et lancer `npm run icons`.
- Logo de l’app Calepin : `public/app-icons/calepin.svg`, réutilisable comme base pour les prochaines apps.

## Les applis Skouar (retenues)

- **Calepin** 📓 — actif : pages + BDD (voir fonctionnalités ci-dessus)
- **Skrid** ✍️ — traitement de texte léger « spécial livre » (chapitres, compteurs de mots, plan, export PDF du livre) — bientôt
- **Ler** 📕 — visionneuse/annotatrice PDF (surlignage, notes, fusion, split) — bientôt
- **Skeud** 🖼️ — visionneuse + retouche d'images (recadrage, filtres, cadres, calques simples, **traitement par lot**) — bientôt
- **Taol** 🧮 — tableur local (formules, tris/filtres, graphiques, export CSV) — bientôt
- **Tres** ✏️ — dessin & présentations (formes vectorielles + diapos, export SVG/PNG) — bientôt

## Roadmap

- [ ] Test de l'installation PWA en ligne (bureau + tablette) sur l'URL Pages
- [x] Stockage IndexedDB (Dexie, migration auto depuis localStorage) + export/import JSON (boutons ↓ Exporter / ↑ Importer dans Blocs)
- [x] Synchro P2P optionnelle (Yjs + Trystero/WebRTC, zéro serveur) : bouton ⇄ Sync dans Blocs, code de salon à partager entre appareils (v1 : état synchronisé par document, le plus récent l’emporte)
- [ ] Synchro CRDT fine par bloc + mini-serveur perso (y-sweet, Rust) en alternative
- [x] Pages imbriquées (sous-pages, niveaux, suppression qui rebranche les enfants) + recherche (titre, blocs, cellules de BDD) dans la barre latérale
- [ ] Version desktop autonome partageable (Tauri)
