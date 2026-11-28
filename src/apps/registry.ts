import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

export interface AppMeta {
  id: string
  name: string
  description: string
  tag: string
  icon: string
  logo?: string
  soon?: boolean
  desktopOnly?: boolean
  component?: LazyExoticComponent<ComponentType>
}

export const apps: AppMeta[] = [
  {
    id: 'marge',
    name: 'Marge',
    description:
      'Visionneuse et annotatrice de PDF : lecture, recherche, surlignage, signature, fusion et gestion des pages.',
    tag: 'pdf',
    icon: '📕',
    logo: `${import.meta.env.BASE_URL}app-icons/marge.svg`,
    component: lazy(() => import('./marge/MargeApp'))
  }
]
