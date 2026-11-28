# CDC global — Skouar (réécriture totale)

Cahier des charges de la refonte totale de la suite « Skouar », rédigé avant tout code.
L'historique v1 est conservé sur la branche `archive/v1`. `AGENTS.md` fait foi pour les
conventions de session ; ce document fixe le **quoi** et le **pourquoi**.

État : étape 1 (fondations) mergée (#94) — infra `src/shared/`, launcher, registry 14 apps,
polices, styles de base, squelette de tests.

## 2.1 Vision et contraintes absolues

- Skouar = lanceur d'applications **local-first** : une coque unique (le launcher) + des apps
  modulaires, installable en PWA, utilisable **100 % hors ligne**. Aucune ressource réseau au
  runtime, jamais de télémétrie.
- UI en français, noms d'apps en breton, chaque app a un nom + un tag court « · fonctionnalité »
  affiché à côté (les noms seuls ne sont pas parlants).
- Philosophie : « plus léger qu'Excel, accent sur l'ergonomie » — pas de feature-bloat.
- **Aucune nouvelle dépendance sans discussion préalable.** Deps actuelles (seules utilisées) :
  react, react-dom, react-router-dom, dexie, vite + plugin-react, vite-plugin-pwa,
  vitest + jsdom + fake-indexeddb, typescript + types, et côté apps : pdfjs-dist, pdf-lib, katex,
  leaflet, lucide-react, qrcode.react, yjs, trystero, @babel/parser.
- **La perte de données ne doit plus jamais arriver** (incident vécu 2× : médias/pages perdus après
  des mises à jour). La suite sera partagée publiquement → les règles de non-régression données
  (§2.5) sont obligatoires dès le jour 1.
- Desktop-first ; certaines apps peuvent être desktop-only (ex. Salveto, masquée sur mobile via
  `matchMedia('(pointer: coarse)')` + opt-out en localStorage).
- Déploiement : GitHub Pages (project site, `base: '/skouar/'` en CI, `/` en local), déploiement
  auto à chaque push sur `main` via `.github/workflows/pages.yml`, CI
  (`npm ci && npm run build && npm test`) via `.github/workflows/ci.yml`.

## 2.2 Stack et architecture validées

- Vite 5 + React 18 + TypeScript, React Router en **HashRouter** : `/` = launcher,
  `/app/<id>/*` = une app, catch-all = launcher.
- PWA via vite-plugin-pwa (`generateSW`, `registerType: 'prompt'`, manifest icônes 192/512/maskable,
  `theme_color: '#0d9488'`, `maximumFileSizeToCacheInBytes: 3 Mo`). **Le service worker ne touche
  jamais à IndexedDB/localStorage.**
- 38 polices woff2 embarquées (`src/assets/fonts/` + `src/fonts.css`), triées par ordre alphabétique
  dans les sélecteurs, accents FR complets — 100 % offline.
- Arborescence :
  - `src/launcher/LauncherHome.tsx` — le launcher
  - `src/apps/registry.ts` — **source de vérité des apps** : 1 entrée = 1 app, `soon: true` =
    tuile « Bientôt » non cliquable, champ `tag`
  - `src/apps/<app>/` — une app par dossier
  - `src/shared/` — AppShell, AppTile, db, backup, thème, réglages, notify…
  - `src/styles/` — parts numérotées importées dans l'ordre dans `src/main.tsx`
    (`01-base.css`, `02-launcher.css`, `03-shell.css`, puis `04-*.css`… par app) ;
    **l'ordre = la cascade, ne jamais le changer** ; chemins d'assets relatifs (`../assets/…`)
  - `public/app-icons/` — 1 SVG duotone par app
  - `tests/` — un fichier par domaine
- Composants transverses validés : AppShell (sidebar redimensionnable 180–440 px persistée
  `skouar:sidebarW`, header logo+nom, footer ⚙/thème), AppTile, `notify()` via événement
  `skouar:toast` (les listeners vivent dans les apps, pas sur le launcher → statut inline là-bas),
  ColorSwatches, bouton thème avec thème système (`matchMedia`).

## 2.3 Lineup d'apps (validé)

10 actives : **Karneto** 📓 (pages + BDD type Notion), **Skrid** ✍️ (traitement de texte + vue
Écrivain), **Ler** 📕 (PDF annoté), **Skeud** 🖼️ (images), **Kod** 💻 (éditeur de code),
**Cockpit** 🎛️ (productivité), **Unvez** 📐 (calculatrice + unités), **Taol** 🧮 (tableur),
**Fichorama** 👢 (fiches de notation), **Salveto** 🩺 (journal santé, desktop-only).

4 « Bientôt » : **Tres** ✏️ (dessin/vectoriel), **Kemm** 🔀 (convertisseur multiformat +
compression), **Klevet** 🎤 (audio), **Arc'hant** 💰 (budget).

## 2.4 Identité visuelle validée

- Marque Skouar : lapin teal (PNG embarqué), titre du launcher en Alegreya 900 `#faf6ed` avec
  point final en accent `#155B60`, sous-titre « Plein d'applications. Une seule place. »
- Launcher : tuiles uniformes à bordure fine 1 px, numérotées 01, 02… en mono (coin haut droit),
  logo en haut à gauche, tag « · … » après le nom, 4 tuiles max par ligne, fond personnalisable
  (presets + scrim), recherche (focus auto sur `/`, Échap vide), compteur de résultats,
  réordonnancement par drag'n'drop (persistance `skouar:launcher:order`, un seul bouton
  « Réorganiser / Terminé », poignée ⋮⋮ sous le numéro, Alt+←/→ au clavier, « Réinitialiser l'ordre »,
  Échap quitte).
- 13+ logos d'apps en duotone, une couleur propre par app.
- Design visé (benchmark Raycast/Linear/Arc) : canvas sombre, niveaux de surface, bordures
  hairline 1 px, une seule couleur d'accent (dérivés auto pour hover/sélection), grille d'espacement
  8 px, radius 4–16 px, labels/badges en mono, hovers par opacité, dark-first + `color-scheme`.

## 2.5 Règles de données — NON NÉGOCIABLES, posées avant tout code

- Stockage : IndexedDB via Dexie, **une base par app** (`createAppDb(name, versions)` dans
  `src/shared/db.ts`), schéma versionné (ex. v1 `{kv, events}` + v2 `{attachments}`) avec migrations
  non destructrices ; réglages en localStorage clés `skouar:*` ; entités/champs identifiés par
  `id`, jamais par nom.
- Toute nouvelle base déclarée dans `APP_DB_MAP` + `registerDb` + test dans
  `tests/data-safety.test.ts`.
- `kvOf` keyPath-agnostic : lire `table.schema.primKey.keyPath` et écrire `{key, value}` ou
  `{id, value}` en conséquence. (Bug historique : keyPath `key` + écriture `{id, value}` →
  DataError silencieux → persistance cassée sans erreur visible. Ne jamais réintroduire.)
- **Jamais d'écrasement silencieux au chargement** : si la lecture IDB échoue → état neuf en
  mémoire + toast, on n'écrit rien.
- Toute opération destructive (`deleteDatabase`, import) passe par `deleteDatabaseSafe`
  (`closeAllDbs()` d'abord, attente réelle, jamais de résolution sur `onblocked`, timeout + erreur
  explicite).
- Avant tout import : `snapshotBeforeImport()` obligatoire (dump localStorage + toutes les bases
  IDB, en localStorage si < 3,5 Mo sinon téléchargement ZIP `skouar-avant-import-*.zip`).
- **Piège des deux origines** : `localhost:5173` et la PWA déployée ont des stockages séparés —
  ne jamais conclure à une perte de données sans vérifier l'origine.
- Export/import par app (JSON, fusion ou remplacer) + ZIP global (bouton ⚙️ Réglages) ; recommander
  l'export régulier. Export « sans pièces jointes » si le fichier devient trop lourd.
- Poids maîtrisé : images redimensionnées côté client avant stockage (ex. ~400 px vignettes,
  ≤1400 px PJ, JPEG 0,82), limite par pièce jointe (8 Mo), alerte + proposition d'export si quota
  approché.

## 2.6 Méthodologie de travail (imposée)

- CDC par app avant tout code, découpé en sous-parties, **une PR mergée par sous-partie**.
- Règles par sous-partie (validées sur Fichorama/Salveto) :
  - **2.A** règles de données posées avant de coder
  - **2.B** tests + smoke UI simulant des vrais clics à chaque merge
  - **2.C** « hors scope » explicite dans chaque PR
  - **2.D** checklist de test manuel courte dans chaque PR (seuls les tests jsdom tournent en
    sandbox, le rendu réel est vérifié par l'utilisateur)
  - **2.E** audit du code existant touché avant d'écrire dessus
- Process session : proposer chaque étape et attendre le « go », avancer une étape à la fois,
  stop après 2 échecs de commandes consécutifs, merge via PR.
- Git : commits en français, style conventionnel (`feat(scope): …`), branche `vibe/<sujet>-<id>`,
  PR en draft, body = `## Summary` + `## Hors scope` + `## Verification` + `## Checklist de test
  manuel`. Merge : l'API GitHub peut être bloquée en session → **squash manuel**
  (`git checkout main && git pull --ff-only && git merge --squash <branche> && git commit -m "… (#NN)"
  && git push origin main`), puis supprimer la branche distante (la PR se ferme seule) + commentaire
  explicatif. Après chaque merge : ménage des branches `vibe/*`.
  ⚠️ le shell est en **dash** : les pipes masquent les codes de sortie
  (`cmd | tail -1 && …` continue même en échec) → toujours `cmd > log 2>&1; echo exit=$?`.
- Code : pas de commentaires ajoutés, pas de `alert()`/`prompt()` (toasts + popovers inline,
  fermeture au clic extérieur + Échap), cibles tactiles ≥ 44 px sur mobile, `focus-visible` +
  skip-link + aria + `prefers-reduced-motion`, raccourcis clavier documentés.

## 2.7 Tests validés (à reproduire)

- vitest, environnement node global, `// @vitest-environment jsdom` par fichier + préambule
  matchMedia/IS_REACT_ACT_ENVIRONMENT (copier `tests/launcher-smoke.test.ts`), `fake-indexeddb/auto`,
  polyfills Blob depuis `tests/backup-zip.test.ts`.
- Simulation réaliste : input via
  `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set` +
  `dispatchEvent(new Event('input',{bubbles:true}))` ; fichiers via
  `Object.defineProperty(input,'files',…)` + change ; pas de `file.text()` en jsdom → FileReader ;
  guards pour `e.dataTransfer` et `URL.createObjectURL` ; DnD via
  `new Event('dragstart'/'drop', {bubbles:true, cancelable:true})`.
- Suites en place : logique + smoke par app, `data-safety.test.ts` (`APP_DB_MAP` + régression
  `kvOf`), `launcher-smoke` (14 tuiles), `launcher-order` + `launcher-reorder-smoke`.

## 2.8 Pièges connus

- Bug `kvOf`/keyPath (voir 2.5.3) ; deux origines (2.5.7) ; `\uXXXX` saisi dans un outil d'édition
  peut s'écrire **littéralement** dans les fichiers → scanner après édition
  (`grep -rn '\\u[0-9a-fA-F]\{4\}' src tests`) ; service worker PWA : `registerType: 'prompt'`
  (toast « Recharger », pas de reload surprise) et jamais d'accès au stockage ; quota localStorage
  ~5 Mo → data-URL lourdes en IndexedDB, pas en localStorage.

## 3. Ce qui est solide et a été porté tel quel depuis `archive/v1` (étape 1, #94)

- Infra `src/shared/` : `db.ts` (uid, createAppDb, kvOf corrigé, registerDb, closeAllDbs,
  deleteDatabaseSafe, APP_DB_MAP), `backup.ts` (snapshotBeforeImport, export/import ZIP global),
  `zip.ts` (extrait de `apps/kod/zip`), `launcherOrder.ts`, `AppShell.tsx` + `useSidebarWidth.tsx`,
  `AppTile.tsx`, `notify.ts`, `ColorSwatches.tsx`, `ThemeButton.tsx` (thème système), `Settings.tsx`
  (réglages globaux + ZIP), `launcherBg.ts`, `fonts.ts`, `useDismiss.ts`.
- Le launcher complet : recherche, tuiles numérotées + tags, fonds personnalisables,
  réordonnancement DnD, tuiles « Bientôt », desktopOnly.
- PWA + CI/CD : `vite.config.ts` (`base` `/skouar/` en CI), manifest/icônes, `scripts/gen-icons.mjs`,
  `.github/workflows/ci.yml` + `pages.yml` (présents dès le 1er commit).
- `AGENTS.md` en entier (stack, commandes, règles de non-régression données, notes gh).
- Squelette de tests : `data-safety.test.ts`, préambules jsdom, helpers de simulation
  d'input/DnD.
- Référence de qualité à suivre pour les réécritures d'apps : Salveto (modèle événementiel
  versionné, export/import + snapshot, PDF maison), Fichorama (champs indexés par id, valeurs
  jamais perdues), Taol (formules rigoureuses, multi-feuilles, graphiques SVG). Les plus anciennes
  (Karneto/blocs, Skrid, Kod, Skeud, Ler, Cockpit, Unvez) sont ad-hoc → premières candidates à une
  réécriture propre.
