import { type CSSProperties, type HTMLAttributes, type ReactNode, type Ref } from 'react'
import { Link } from 'react-router-dom'
import ThemeButton from './ThemeButton'
import SettingsButton from './Settings'
import { SidebarResizer, useSidebarWidth } from './useSidebarWidth'

export function AppSkeleton(): JSX.Element {
  return (
    <div className="blocs-app">
      <main className="blocs-main">
        <div className="skel skel-title" />
        <div className="skel skel-line" />
        <div className="skel skel-line" />
        <div className="skel skel-line short" />
      </main>
    </div>
  )
}

interface AppShellProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  appId: string
  appName: string
  logo: string
  sidebar?: ReactNode
  footExtra?: ReactNode
  beforeSidebar?: ReactNode
  sidebarClass?: string
  hideChrome?: boolean
  mainClass?: string
  mainRef?: Ref<HTMLElement>
  children: ReactNode
}

export default function AppShell({
  appId,
  appName,
  logo,
  sidebar,
  footExtra,
  beforeSidebar,
  sidebarClass = '',
  hideChrome = false,
  mainClass = 'blocs-main',
  mainRef,
  className,
  style,
  children,
  ...rest
}: AppShellProps) {
  const { sideW, setSideW } = useSidebarWidth()
  return (
    <div
      className={`blocs-app${className ? ` ${className}` : ''}`}
      style={{ '--side-w': `${sideW}px`, ...style } as CSSProperties}
      {...rest}
    >
      {!hideChrome && (
        <>
          {beforeSidebar}
          <aside className={`blocs-sidebar${sidebarClass ? ` ${sidebarClass}` : ''}`}>
            <div className="blocs-app-head">
              <Link to="/" className="blocs-app-brand" title="Retour au launcher Skouar">
                <img className="blocs-app-logo" src={logo} alt={appName} />
                <span className="blocs-app-name">{appName}</span>
              </Link>
              <Link to="/" className="blocs-back" title="Retour au launcher">
                ←
              </Link>
            </div>
            {sidebar}
            <div className="blocs-sidebar-foot">
              <ThemeButton />
              <SettingsButton appId={appId} appName={appName} />
              {footExtra}
            </div>
          </aside>
          <SidebarResizer sideW={sideW} onChange={setSideW} />
        </>
      )}
      <main className={mainClass} ref={mainRef}>
        {children}
      </main>
    </div>
  )
}
