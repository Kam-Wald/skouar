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
- **Design** : thème sombre éditorial (inspiration getartcraft) + thème clair, **glassmorphism sur les grands panneaux** (templates, graphe, rappels), launcher en **tuiles uniformes à bordure fine 1px** + **identité visuelle retravaillée** : marque Skouar originale (lapin teal embarqué tel quel en PNG depuis le visuel choisi, en référence à Jekyll/Rudy/Walden), titre du launcher en typo display avec ombre outline accent, **10 logos d'applis en duotone** avec une couleur propre à chaque appli (calepin sky, skrid amber, ler red, skeud emerald, taol violet, tres pink, kod slate, kemm teal, eur orange, klevet indigo) ; 6 applis « Bientôt » (Skeud 🖼️, Taol 🧮, Tres ✏️, Kemm 🔄, Eur ⏱️, Klevet 🎤), labels/badges/dates en **mono**, une seule couleur d'accent (états survolés/sélectionnés dérivés automatiquement)
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

- Logo Skouar : le visuel retenu est embarqué tel quel en PNG : source = `public/logo-source.png` (880×880, couleurs #ffffff / #03827a / #77e4c6) ; `npm run icons` génère `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png` et les variantes v1–v4. Favicon = `icons/icon-512.png` (index.html), tuile launcher = même PNG. Accent du launcher = teal (override `--accent` dans `.launcher`), `theme-color` PWA = `#0d9488`.
- Logo de l’app Calepin : `public/app-icons/calepin.svg`, réutilisable comme base pour les prochaines apps.

## Les applis Skouar (retenues)

- **Calepin** 📓 — actif : pages + BDD (voir fonctionnalités ci-dessus)
- **Skrid** ✍️ — actif : traitement de texte léger. **3 vues** en haut de la sidebar : ✍️ **Document** (défaut, édition pure), 🖋️ **Écrivain** (plan du livre, objectifs 🎯, réordonnancement ↑↓, export PDF 📄), 📊 **Stats** (mots par chapitre, objectifs atteints). **31 templates** de texte 📋 (motivation, résiliation, compte-rendu, discours, CV, recette…), mode focus 🎯, police serif, autosave + undo persisté, **barre de mise en forme exhaustive** (polices, H1–H4, citation, bloc code, interligne, gras/italique/souligné/barré, couleur de police et de fond, listes à puces/numérotées/à cocher, liens, tableaux, images, ligne horizontale, retraits, alignements, effacer le format, undo/redo ↶↷), sidebar **redimensionnable** (poignée ⇆, mêmes bornes 180–440px que Calepin, largeur partagée), **Ctrl+F** recherche/remplacement, **commentaires en marge** 💬, **mode lecture** 📖 (plein écran, taille de police A−/A+), **stats de session** (mots/jour, graphe 14 jours, streak 🔥), **drag & drop** des chapitres dans la sidebar, **export chapitre** en PDF/HTML/Markdown/.doc + livre PDF avec **numéros de page en haut et en bas** (options), panneau **raccourcis ?**, **spellcheck FR** natif, fond légèrement différent en vue Écrivain, **vue Document façon traitement de texte** (feuille A4 à l'écran + règles en cm haut/gauche), chapitres dans la sidebar **uniquement en vue Écrivain** + navigation ‹ › entre chapitres en vue Document, **16 polices système** dans la barre (noms affichés dans leur propre police), barre d'outils qui **revient à la ligne sans scrollbar**, rubrique **Fiches & mémos** dans la sidebar (11 types de fiches 🧍📍🎒🐾🏛️📅💡💬🎬📖📌 avec champs dédiés, 🗒️ mémos **épinglables** 📌 et **colorables**, **références `@fiche`** cliquables depuis le texte (popover @ au curseur) ; les fiches sont des **formulaires dans le contenu** (champs label+valeur, sans éditeur libre, export en tableau), exclus du plan/stats/export PDF du livre), **options PDF en opt-in uniquement** (popover ⬇ : « Page X sur Y », titre en pied de page, sommaire auto, saut de page/chapitre, page de garde, format A4/A5/livret 2×A5 sur A4 paysage, marges étroites/normales/larges, police PDF sans/serif/mono)
- **Ler** 📕 — **actif** : visionneuse/annotatrice de PDF 100 % local (pdf.js embarqué, hors-ligne). Bibliothèque de PDF (import bouton ou glisser-déposer, miniatures, renommage, **fusion de plusieurs PDF** via cases à cocher), rendu page par page avec zoom %/ajuster-largeur, navigation page + vignettes, **mode 2 pages**, **rotation**, **mode nuit**, impression, **recherche Ctrl+F** avec résultats surlignés et navigation, **9 outils d'annotation** : 👆 surlignage précis du texte sélectionné (couche texte pdf.js), 🖍️ rectangle, ✏️ dessin, ➡️ flèche, ⭕ cercle, 🔤 **texte ajouté** (taille/couleur), ✅ tampons (Lu/À faire…), 📝 notes, ✍️ **signature dessinée à la souris** (pad réutilisable), 5 couleurs, liste des annotations cliquable, **export/import JSON des annotations**, **extraction de pages** (« 1-3, 5 »), **export du PDF annoté aplati** (pdf-lib : rectangles, traits, flèches, ellipses, texte, tampons, notes, signature en image PNG), sidebar redimensionnable comme les autres applis
- **Skeud** 🖼️ — visionneuse + retouche d'images (recadrage, filtres, cadres, calques simples, **traitement par lot**) — bientôt
- **Taol** 🧮 — tableur local (formules, tris/filtres, graphiques, export CSV) — bientôt
- **Tres** ✏️ — dessin & présentations (formes vectorielles + diapos, export SVG/PNG) — bientôt
- **Kod** 💻 — éditeur de code léger et 100 % local : coloration maison (~20 langages), onglets, arbre de fichiers (projet local Dexie + dossier/fichier réel via File System Access), recherche dans le fichier (Ctrl+F) et dans tout le projet (Ctrl+Shift+F), numéros de ligne, indentation auto, Ctrl+S, enregistrer-sous, barre de statut Ln/Col ; v3 : paires auto-fermantes, commenter (Ctrl+/), déplacer/dupliquer ligne (Alt+↑↓, Ctrl+Maj+D), pliage de blocs (gouttière), guides d'indentation + surlignage de la paire d'accolades, panneau Problèmes (TODO/lignes longues/espaces), glisser-déposer dans l'arbre + import de fichiers (bouton ou drop fenêtre), Ctrl+P aller au fichier, 5 thèmes de coloration, mode focus (sidebar/minimap masquées, pleine largeur), bouton « + » nouvel onglet avec choix d'extension, 18 modèles de fichiers (langages/projet/docs) dans la sidebar, guides d'indentation quasi invisibles, réglages globaux (⚙️ dans chaque sidebar : thème, accent, largeur sidebar, réglages Kod, effacement des données d'une appli) ; v2 : rechercher-remplacer (Ctrl+H, fichier + tout le projet), multi-curseur (Ctrl+D / Ctrl+Maj+L), aperçu rendu md/html en split-view, minimap cliquable + plan des symboles, extraits (snippets) + palette Ctrl+K, historique local des versions (50/fichier) ; launcher : recherche d'apps + récents ; a11y (focus-visible, skip-link, aria, reduced-motion) ; PWA : splash boot, prompt d'installation custom, icône maskable avec marge
- **Kemm** 🔄 — convertisseur de fichiers local (images ↔ PNG/JPEG/WebP, audio, CSV/JSON) — bientôt
- **Eur** ⏱️ — cockpit productivité : minuteurs à techniques (Pomodoro, 52/17, timeboxing), suivi du temps par projet, kanban perso, astuces bien-être — bientôt
- **Klevet** 🎤 — édition audio 100 % local façon Audacity-lite : micro (MediaRecorder), forme d'onde, couper/copier, gain, fondus, lecture, export WAV — bientôt

## Roadmap

- [ ] Test de l'installation PWA en ligne (bureau + tablette) sur l'URL Pages
- [x] Stockage IndexedDB (Dexie, migration auto depuis localStorage) + export/import JSON (boutons ↓ Exporter / ↑ Importer dans Blocs)
- [x] Synchro P2P optionnelle (Yjs + Trystero/WebRTC, zéro serveur) : bouton ⇄ Sync dans Blocs, code de salon à partager entre appareils (v1 : état synchronisé par document, le plus récent l’emporte)
- [ ] Synchro CRDT fine par bloc + mini-serveur perso (y-sweet, Rust) en alternative
- [x] Pages imbriquées (sous-pages, niveaux, suppression qui rebranche les enfants) + recherche (titre, blocs, cellules de BDD) dans la barre latérale
- [ ] Version desktop autonome partageable (Tauri)
