import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

export interface AppMeta {
  id: string
  name: string
  description: string
  icon: string
  logo?: string
  component: LazyExoticComponent<ComponentType>
}

export const apps: AppMeta[] = [
  {
    id: 'blocs',
    name: 'Calepin',
    description: 'Pages et bases de données type Notion, 100 % local dans ton navigateur.',
    icon: '📓',
    logo: `${import.meta.env.BASE_URL}app-icons/calepin.svg`,
    component: lazy(() => import('./blocs/BlocsApp'))
  }
]
