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
  }
]

export const templateGroups = (): string[] => [...new Set(KOD_TEMPLATES.map((t) => t.group))]
