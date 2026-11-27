# AGENTS.md — conventions du projet Skouar

Ce fichier fait foi pour toute session d'édition sur ce repo. Le README reste la doc utilisateur ; l'état réel du code prime sur le README (dont la liste de fonctionnalités est un changelog cumulatif).

## Stack

- Vite + React 18 + TypeScript, React Router en `HashRouter` : `/` = launcher, `/app/<id>/*` = une app, catch-all = launcher.
- PWA via `vite-plugin-pwa` (`generateSW`), déployée sur GitHub Pages à chaque push sur `main` (`base` = `/skouar/` automatiquement en CI, `/` en local).
- 100 % local / offline : aucune ressource réseau au runtime, aucune nouvelle dépendance sans discussion préalable.
- Stockage : IndexedDB via Dexie, **une base par app** (`createAppDb` dans `src/shared/db.ts`) ; réglages en `localStorage` (clés `skouar:*`) ; event `skouar:settings` pour notifier les changements entre composants.
- 38 polices woff2 embarquées (`src/assets/fonts/` + `src/fonts.css` + `@font-face` Alegreya en tête de `src/styles/01-base.css`).

## Commandes

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # vitest (logique + smoke jsdom + fake-indexeddb)
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + build dans dist/
npm run icons      # régénère les icônes PWA dans public/icons
```

CI (`.github/workflows/ci.yml`) : `npm ci` + `npm run build` + `npm test` sur chaque PR et chaque push sur `main`. Pas de PR template ni CODEOWNERS.

## Structure

- `src/launcher/LauncherHome.tsx` — le launcher (recherche, tuiles, fond personnalisable).
- `src/apps/registry.ts` — **source de vérité des apps** : 1 entrée = 1 app (`soon: true` = tuile « Bientôt » non cliquable, champ `tag` = « · fonctionnalité » affiché à côté du nom).
- `src/apps/<app>/` — une app par dossier (`blocs` = Karneto) ; `src/shared/` — AppShell, AppTile, db, launcherBg, backup ZIP, réglages (`Settings.tsx`), thème (`ThemeButton.tsx`).
- `src/styles/` — CSS découpé en parts **numérotées et ordonnées** : l'ordre des `import` dans `src/main.tsx` est l'ordre de cascade, ne jamais le changer. Les `url('./assets/…')` de `src/styles/` doivent rester relatifs au dossier (`../assets/…`).
- `tests/` — un fichier par domaine (`<app>-logic.test.ts`, `<app>-smoke.test.ts`).

## Conventions de code

- Commits en français, style conventionnel : `feat(scope): …`, `fix(scope): …`, `docs: …`, `test: …`.
- Une PR par feature, en **draft** d'abord, branche `vibe/<sujet>-<id>` ; body de PR : sections `## Summary` et `## Verification` (commandes exécutées).
- Tests vitest à jour avec toute modif de logique ; smoke jsdom pour les composants d'UI.
- Pas de commentaires ajoutés dans le code ; pas de `alert()`/`prompt()` (toasts + popovers inline, voir `src/shared/notify.ts`).
- Ne pas toucher à l'ordre des imports CSS (cf. ci-dessus).

## Notes opérationnelles (session Vibe / gh)

- L'API de merge GitHub peut être bloquée (« Mutating GitHub API calls are not allowed ») : merger alors en **squash manuel** — `git checkout main && git pull --ff-only && git merge --squash <branche> && git commit -m "… (#NN)" && git push origin main` — puis supprimer la branche distante (la PR se ferme automatiquement) et poser un commentaire explicatif sur la PR.
- `gh pr list --json` avec trop de champs échoue (limite GraphQL 500 000 nœuds) : ne demander que les champs utiles (`number,title,state,headRefName`).
- Après chaque merge, supprimer la branche `vibe/*` distante ; ménage périodique des branches dont la PR est MERGED (critère fiable = état de la PR, pas `git branch --merged`, à cause des squash merges).
- Le push direct sur `main` fonctionne avec le token de session ; `gh pr merge` non.
