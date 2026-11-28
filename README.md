# Skouar

Nouveau départ : l'historique du dépôt a été réinitialisé volontairement (l'ancien historique est conservé sur la branche `archive/v1`). La suite est reconstruite from scratch à partir d'un **cahier des charges global (CDC) rédigé avant tout code**.

Ce commit de départ ne contient que l'infrastructure :

- CI (`.github/workflows/ci.yml`) : `npm ci` + build + tests à chaque PR et chaque push sur `main`
- Déploiement GitHub Pages (`.github/workflows/pages.yml`) : la PWA est servie sur `https://kam-wald.github.io/skouar/`
- `AGENTS.md` : conventions du projet, dont les **règles de non-régression — données** (obligatoires)
- Configuration de build/test (Vite + React 18 + TypeScript + vitest) et un squelette minimal qui compile

Aucune app n'est présente pour l'instant ; elles seront réintroduites une par une, chacune précédée de son propre CDC.
