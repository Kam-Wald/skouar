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
    description: 'Pages et bases de données type Notion, 100 % local dans ton navigateur.',
    icon: '📓',
    logo: `${import.meta.env.BASE_URL}app-icons/calepin.svg`,
    component: lazy(() => import('./blocs/BlocsApp'))
  },
  {
    id: 'taol',
    name: 'Taol',
    description: 'Tableur 100 % local — bientôt disponible.',
    icon: '🧮',
    soon: true
  },
  {
    id: 'skeud',
    name: 'Skeud',
    description: 'Galerie et retouche d’images, 100 % local — bientôt disponible.',
    icon: '🖼️',
    soon: true
  },
  {
    id: 'son',
    name: 'Son',
    description: 'Bibliothèque audio locale — bientôt disponible.',
    icon: '🎧',
    soon: true
  }
]
