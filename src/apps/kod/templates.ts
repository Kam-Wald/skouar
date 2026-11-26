export interface KodTemplate {
  label: string
  icon: string
  group: string
  path: string
  content: string
}

export const KOD_TEMPLATES: KodTemplate[] = [
  {
    group: 'Langages',
    label: 'JavaScript (module ES6)',
    icon: '🟨',
    path: 'modele.js',
    content: "// {{titre}}\n'use strict'\n\nexport function main() {\n  // ...\n}\n\nmain()\n"
  },
  {
    group: 'Langages',
    label: 'TypeScript',
    icon: '🟦',
    path: 'modele.ts',
    content: "interface Modele {\n  id: number\n  nom: string\n}\n\nexport function traiter(m: Modele): string {\n  return m.nom\n}\n"
  },
  {
    group: 'Langages',
    label: 'HTML5 de base',
    icon: '🌐',
    path: 'modele.html',
    content: '<!doctype html>\n<html lang="fr">\n<head>\n  <meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1" />\n  <title>{{titre}}</title>\n  <link rel="stylesheet" href="modele.css" />\n</head>\n<body>\n  <main>\n    <h1>{{titre}}</h1>\n  </main>\n  <script src="modele.js"></script>\n</body>\n</html>\n'
  },
  {
    group: 'Langages',
    label: 'CSS de base',
    icon: '🎨',
    path: 'modele.css',
    content: '/* {{titre}} */\n:root {\n  --bg: #ffffff;\n  --text: #1a2334;\n}\n\n* {\n  box-sizing: border-box;\n}\n\nbody {\n  margin: 0;\n  font-family: system-ui, sans-serif;\n  background: var(--bg);\n  color: var(--text);\n}\n'
  },
  {
    group: 'Langages',
    label: 'Python',
    icon: '🐍',
    path: 'modele.py',
    content: '#!/usr/bin/env python3\n"""{{titre}}"""\n\n\ndef main() -> None:\n    pass\n\n\nif __name__ == "__main__":\n    main()\n'
  },
  {
    group: 'Langages',
    label: 'JSON',
    icon: '🟧',
    path: 'modele.json',
    content: '{\n  "nom": "{{titre}}",\n  "version": "0.1.0",\n  "actif": true\n}\n'
  },
  {
    group: 'Langages',
    label: 'YAML (config)',
    icon: '📋',
    path: 'modele.yml',
    content: '# {{titre}}\nnom: mon-projet\nversion: 0.1.0\noptions:\n  debug: false\n  port: 3000\n'
  },
  {
    group: 'Langages',
    label: 'Shell',
    icon: '⚙️',
    path: 'modele.sh',
    content: '#!/usr/bin/env bash\nset -euo pipefail\n\n# {{titre}}\n\necho "démarrage…"\n'
  },
  {
    group: 'Langages',
    label: 'SQL',
    icon: '🗄️',
    path: 'modele.sql',
    content: '-- {{titre}}\nCREATE TABLE IF NOT EXISTS exemple (\n  id INTEGER PRIMARY KEY,\n  nom TEXT NOT NULL,\n  cree_le TEXT DEFAULT (datetime("now"))\n);\n\nSELECT * FROM exemple;\n'
  },
  {
    group: 'Projet',
    label: 'README.md',
    icon: '📖',
    path: 'README.md',
    content: '# {{titre}}\n\n## Présentation\n\nDécris ton projet ici.\n\n## Installation\n\n```bash\n# commande d\'installation\n```\n\n## Utilisation\n\n```bash\n# commande d\'exécution\n```\n\n## Licence\n\nMIT\n'
  },
  {
    group: 'Projet',
    label: '.gitignore (Node)',
    icon: '🚫',
    path: '.gitignore',
    content: 'node_modules/\ndist/\n*.log\n.env\n.DS_Store\n'
  },
  {
    group: 'Projet',
    label: 'package.json minimal',
    icon: '📦',
    path: 'package.json',
    content: '{\n  "name": "{{titre}}",\n  "version": "0.1.0",\n  "private": true,\n  "type": "module",\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build"\n  }\n}\n'
  },
  {
    group: 'Projet',
    label: '.editorconfig',
    icon: '🧩',
    path: '.editorconfig',
    content: 'root = true\n\n[*]\nindent_style = space\nindent_size = 2\nend_of_line = lf\ncharset = utf-8\ntrim_trailing_whitespace = true\ninsert_final_newline = true\n'
  },
  {
    group: 'Projet',
    label: 'docker-compose.yml',
    icon: '🐳',
    path: 'docker-compose.yml',
    content: 'services:\n  app:\n    image: {{titre}}\n    build: .\n    ports:\n      - "3000:3000"\n'
  },
  {
    group: 'Projet',
    label: 'CI GitHub Actions',
    icon: '🤖',
    path: '.github/workflows/ci.yml',
    content: 'name: CI\non: [push, pull_request]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n      - run: npm ci\n      - run: npm run build\n'
  },
  {
    group: 'Docs',
    label: 'Compte-rendu de réunion',
    icon: '📝',
    path: 'compte-rendu.md',
    content: '# Compte-rendu — {{titre}}\n\n**Date :** JJ/MM/AAAA  \n**Participants :** ...\n\n## Ordre du jour\n\n1. ...\n\n## Décisions\n\n- ...\n\n## Actions à suivre\n\n- [ ] ... (responsable, échéance)\n'
  },
  {
    group: 'Docs',
    label: 'Lettre de motivation',
    icon: '✉️',
    path: 'lettre-motivation.md',
    content: '{{titre}}\n\nMadame, Monsieur,\n\n\n\nCordialement,\nPrénom Nom\n'
  },
  {
    group: 'Docs',
    label: 'Cahier des charges',
    icon: '📐',
    path: 'cahier-des-charges.md',
    content: '# Cahier des charges — {{titre}}\n\n## 1. Contexte\n\n## 2. Objectifs\n\n## 3. Périmètre fonctionnel\n\n- ...\n\n## 4. Contraintes (techniques, délais, budget)\n\n## 5. Livrables attendus\n'
  },
  {
    group: 'Docs',
    label: 'To-do liste',
    icon: '✅',
    path: 'todo.md',
    content: '# To-do — {{titre}}\n\n- [ ] tâche 1\n- [ ] tâche 2\n- [x] tâche faite\n'
  },
  {
    group: 'Config',
    label: 'tsconfig.json',
    icon: '🧾',
    path: 'tsconfig.json',
    content: '{\n  "compilerOptions": {\n    "target": "ES2022",\n    "module": "ESNext",\n    "moduleResolution": "bundler",\n    "strict": true,\n    "jsx": "react-jsx",\n    "noEmit": true,\n    "skipLibCheck": true\n  },\n  "include": ["src"]\n}\n'
  },
  {
    group: 'Config',
    label: '.env.example',
    icon: '📝',
    path: '.env.example',
    content: "# Variables d'environnement (exemple)\nAPP_NAME=mon-app\nAPI_URL=http://localhost:3000\n# Ne pas commiter les vraies valeurs ici\n"
  },
  {
    group: 'Config',
    label: '.eslintrc.json',
    icon: '🔍',
    path: '.eslintrc.json',
    content: '{\n  "root": true,\n  "env": { "browser": true, "es2022": true },\n  "extends": ["eslint:recommended"],\n  "parserOptions": { "ecmaVersion": "latest", "sourceType": "module" },\n  "rules": {}\n}\n'
  },
  {
    group: 'Config',
    label: 'nginx.conf (SPA)',
    icon: '🌐',
    path: 'nginx.conf',
    content: '# {{titre}}\nserver {\n  listen 80;\n  server_name exemple.fr;\n  root /var/www/app;\n  index index.html;\n\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n'
  },
  {
    group: 'Extraits',
    label: 'Composant React (TSX)',
    icon: '⚛️',
    path: 'modele.tsx',
    content: 'type Props = {\n  titre: string\n}\n\nexport default function MonComposant({ titre }: Props) {\n  return (\n    <section>\n      <h2>{titre}</h2>\n    </section>\n  )\n}\n'
  },
  {
    group: 'Extraits',
    label: 'Hook React useFetch',
    icon: '🪝',
    path: 'use-fetch.ts',
    content: "import { useEffect, useState } from 'react'\n\nexport function useFetch<T>(url: string) {\n  const [data, setData] = useState<T | null>(null)\n  const [error, setError] = useState<Error | null>(null)\n\n  useEffect(() => {\n    let actif = true\n    fetch(url)\n      .then((r) => r.json())\n      .then((d) => actif && setData(d))\n      .catch((e) => actif && setError(e))\n    return () => {\n      actif = false\n    }\n  }, [url])\n\n  return { data, error }\n}\n"
  },
  {
    group: 'Extraits',
    label: 'Route Express',
    icon: '🛣️',
    path: 'route-express.ts',
    content: "import { Router } from 'express'\n\nconst router = Router()\n\nrouter.get('/', (req, res) => {\n  res.json({ ok: true })\n})\n\nrouter.post('/', (req, res) => {\n  const { name } = req.body\n  res.status(201).json({ id: Date.now(), name })\n})\n\nexport default router\n"
  },
  {
    group: 'Extraits',
    label: 'Test unitaire (vitest)',
    icon: '🧪',
    path: 'modele.test.ts',
    content: "import { describe, expect, it } from 'vitest'\n\ndescribe('maFonction', () => {\n  it('retourne la bonne valeur', () => {\n    expect(maFonction(2)).toBe(4)\n  })\n})\n"
  },
  {
    group: 'Extraits',
    label: 'Classe Python',
    icon: '🏛️',
    path: 'modele-classe.py',
    content: 'class Compte:\n    def __init__(self, titulaire: str, solde: float = 0.0):\n        self.titulaire = titulaire\n        self.solde = solde\n\n    def deposer(self, montant: float) -> None:\n        if montant <= 0:\n            raise ValueError("Le montant doit etre positif")\n        self.solde += montant\n\n    def __repr__(self) -> str:\n        return f"Compte({self.titulaire!r}, solde={self.solde})"\n'
  },
  {
    group: 'Extraits',
    label: 'Requêtes SQL utiles',
    icon: '🔎',
    path: 'requetes.sql',
    content: '-- {{titre}} : requetes utiles\n\n-- Jointure avec agregation\nSELECT c.nom, COUNT(p.id) AS nb, SUM(p.prix) AS total\nFROM categories c\nLEFT JOIN produits p ON p.categorie_id = c.id\nGROUP BY c.nom\nORDER BY total DESC\n\n-- Mise a jour prudente (toujours un WHERE)\nUPDATE produits SET prix = prix * 1.10 WHERE categorie_id = 3\n'
  }
]

export const templateGroups = (): string[] => [...new Set(KOD_TEMPLATES.map((t) => t.group))]
