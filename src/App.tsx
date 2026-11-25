import { Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import LauncherHome from './launcher/LauncherHome'
import { apps } from './apps/registry'

export default function App() {
  return (
    <Suspense fallback={<div className="app-loading">Chargement…</div>}>
      <Routes>
        <Route path="/" element={<LauncherHome />} />
        {apps.map((app) => (
          <Route
            key={app.id}
            path={`/app/${app.id}/*`}
            element={<app.component />}
          />
        ))}
        <Route path="*" element={<LauncherHome />} />
      </Routes>
    </Suspense>
  )
}
