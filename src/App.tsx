import { Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import LauncherHome from './launcher/LauncherHome'
import { apps } from './apps/registry'

function UpdateToast() {
  const { needRefresh, updateServiceWorker } = useRegisterSW()
  const [refresh] = needRefresh
  if (!refresh) return null
  return (
    <div className="toast" style={{ bottom: 60 }}>
      <span>Nouvelle version de Skouar disponible</span>
      <button onClick={() => void updateServiceWorker(true)}>Recharger</button>
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<div className="app-loading"><div className="skel skel-title" /><div className="skel skel-line" /><div className="skel skel-line short" /></div>}>
      <UpdateToast />
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
