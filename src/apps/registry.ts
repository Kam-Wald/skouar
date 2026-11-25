import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

export interface AppMeta {
  id: string
  name: string
  description: string
  icon: string
  component: LazyExoticComponent<ComponentType>
}

export const apps: AppMeta[] = [
  {
    id: 'blocs',
    name: 'Blocs',
    description: 'Éditeur de blocs type Notion, 100 % local dans ton navigateur.',
    icon: '▦',
    component: lazy(() => import('./blocs/BlocsApp'))
  }
]
