import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

export interface AppMeta {
  id: string
  name: string
  description: string
  icon: string
  logo?: string
  soon?: boolean
  component?: LazyExoticComponent<ComponentType>
}

export const apps: AppMeta[] = [
  {
    id: 'blocs',
    name: 'Calepin',
    description: 'Pages et bases de données type Notion.',
    icon: '📓',
    logo: `${import.meta.env.BASE_URL}app-icons/calepin.svg`,
    component: lazy(() => import('./blocs/BlocsApp'))
  },
  {
    id: 'skrid',
    name: 'Skrid',
    description: 'Traitement de texte léger, pensé pour écrire un livre (chapitres, compteurs, export PDF).',
    icon: '✍️',
    logo: `${import.meta.env.BASE_URL}app-icons/skrid.svg`,
    component: lazy(() => import('./skrid/SkridApp'))
  },
  {
    id: 'ler',
    name: 'Ler',
    description: 'Visionneuse et annotatrice de PDF (surlignage, notes, fusion de fichiers).',
    icon: '📕',
    logo: `${import.meta.env.BASE_URL}app-icons/ler.svg`,
    soon: true
  },
  {
    id: 'skeud',
    name: 'Skeud',
    description: 'Visionneuse + retouche d’images (recadrage, filtres, cadres, traitement par lot).',
    icon: '🖼️',
    logo: `${import.meta.env.BASE_URL}app-icons/skeud.svg`,
    soon: true
  },
  {
    id: 'taol',
    name: 'Taol',
    description: 'Tableur local : formules, tris, filtres, graphiques, export CSV.',
    icon: '🧮',
    logo: `${import.meta.env.BASE_URL}app-icons/taol.svg`,
    soon: true
  },
  {
    id: 'tres',
    name: 'Tres',
    description: 'Dessin & présentations : formes, flèches, diapos, export SVG/PNG.',
    icon: '✏️',
    logo: `${import.meta.env.BASE_URL}app-icons/tres.svg`,
    soon: true
  },
  {
    id: 'kod',
    name: 'Kod',
    description: 'Éditeur de code léger et agréable : coloration, onglets, arbre de fichiers, recherche.',
    icon: '💻',
    logo: `${import.meta.env.BASE_URL}app-icons/kod.svg`,
    soon: true
  },
  {
    id: 'kemm',
    name: 'Kemm',
    description: 'Convertisseur de fichiers 100 % local (images, audio, CSV/JSON…).',
    icon: '🔄',
    logo: `${import.meta.env.BASE_URL}app-icons/kemm.svg`,
    soon: true
  },
  {
    id: 'eur',
    name: 'Eur',
    description: 'Cockpit productivité : minuteurs (Pomodoro…), suivi du temps, kanban, astuces bien-être.',
    icon: '⏱️',
    logo: `${import.meta.env.BASE_URL}app-icons/eur.svg`,
    soon: true
  }
]
