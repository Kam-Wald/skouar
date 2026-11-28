# Skouar

Lanceur d'applications **local-first** : une coque unique (le « launcher ») regroupe des applications modulaires, installable en **PWA** et utilisable 100 % hors ligne.

Nouveau départ (réinitialisation volontaire de l'historique, conservé sur la branche `archive/v1`) : la suite est reconstruite app par app, chacune précédée de son cahier des charges (CDC).

## Apps

- **Marge** 📕 · `pdf` — visionneuse et annotatrice de PDF (lecture, recherche, surlignage, signature, fusion et gestion des pages). En construction, voir le CDC Marge.

## Stack

- Vite + React 18 + TypeScript, React Router en `HashRouter` : `/` = launcher, `/app/<id>/*` = une app
- PWA via `vite-plugin-pwa` (`generateSW`), déployée sur GitHub Pages à chaque push sur `main` (`base` = `/skouar/` en CI, `/` en local) → https://kam-wald.github.io/skouar/
- 100 % local / hors ligne : IndexedDB via Dexie (une base par app, déclarée dans `APP_DB_MAP` — `src/shared/db.ts`) + `localStorage` (clés `skouar:*`) ; polices woff2 embarquées
- Tests : vitest + jsdom + fake-indexeddb (`npm test`), typecheck + build en CI à chaque PR et chaque push

## Commandes

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + build dans dist/
npm run icons      # régénère les icônes PWA dans public/icons
```

## Règles de données (non-négociables)

Voir [AGENTS.md](AGENTS.md) : snapshot avant tout import (`snapshotBeforeImport`), suppressions IDB via `deleteDatabaseSafe`, jamais d'écrasement silencieux au chargement, toute nouvelle base déclarée dans `APP_DB_MAP` + test `data-safety`. Piège des deux origines : `localhost:5173` et la PWA déployée ont des stockages **séparés**.

## Structure

```
src/
  main.tsx, App.tsx        point d'entrée + routes
  launcher/LauncherHome.tsx  le launcher (recherche, tuiles, fond personnalisable, réorganisation)
  apps/registry.ts         registre des apps (1 entrée = 1 app) — source de vérité
  apps/<app>/              une app par dossier, découpée en logic.ts + composants + modules
  shared/                  AppShell, AppTile, db (Dexie), backup ZIP, zip, thème, réglages…
  styles/                  CSS en parts numérotées, importées dans l'ordre dans main.tsx
  assets/fonts/            polices woff2 embarquées
public/                    icônes PWA + icônes d'apps (app-icons/) + assets pdfjs
tests/                     tests vitest (logique + smoke jsdom + fake-indexeddb)
```
