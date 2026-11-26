import { Suspense, useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import LauncherHome from './launcher/LauncherHome'
import { apps } from './apps/registry'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function UpdateToast() {
  const { needRefresh, updateServiceWorker } = useRegisterSW()
  const [refresh] = needRefresh
  if (!refresh) return null
  return (
    <div className="toast" style={{ bottom: 60 }} role="status">
      <span>Nouvelle version de Skouar disponible</span>
      <button onClick={() => void updateServiceWorker(true)}>Recharger</button>
    </div>
  )
}

function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('skouar:installDismissed') === '1')

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBip)
    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [])

  if (!deferred || dismissed) return null
  return (
    <div className="toast" style={{ bottom: 16 }} role="status">
      <span>Installer Skouar sur cet appareil ?</span>
      <button
        onClick={() => {
          void deferred.prompt()
          setDeferred(null)
        }}
      >
        Installer
      </button>
      <button
        onClick={() => {
          localStorage.setItem('skouar:installDismissed', '1')
          setDismissed(true)
        }}
      >
        Plus tard
      </button>
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<div className="app-loading"><div className="skel skel-title" /><div className="skel skel-line" /><div className="skel skel-line short" /></div>}>
      <UpdateToast />
      <InstallPrompt />
      <Routes>
        <Route path="/" element={<LauncherHome />} />
        {apps
          .filter((app) => app.component)
          .map((app) => {
            const C = app.component!
            return <Route key={app.id} path={`/app/${app.id}/*`} element={<C />} />
          })}
        <Route path="*" element={<LauncherHome />} />
      </Routes>
    </Suspense>
  )
}
