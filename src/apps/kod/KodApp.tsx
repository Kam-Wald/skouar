import { type CSSProperties } from 'react'
import AppShell, { AppSkeleton } from '../../shared/AppShell'
import { KodCtx } from './ctx'
import { useKodApp } from './useKodApp'
import Sidebar from './parts/Sidebar'
import TabsBar from './parts/TabsBar'
import EditorPane from './parts/EditorPane'
import Overlays from './parts/Overlays'

export default function KodApp() {
  const api = useKodApp()
  const { nodes, ui, focus, charW, importFiles } = api

  if (!nodes || !ui) return <AppSkeleton />

  return (
    <KodCtx.Provider value={api}>
      <AppShell
        appId="kod"
        appName="Kod"
        logo={`${import.meta.env.BASE_URL}app-icons/kod.svg`}
        className={`kod-app hl-${ui.hlTheme}${focus ? ' focus' : ''}`}
        style={{ '--kod-fs': `${ui.fontSize}px`, '--kod-tab': ui.tabSize, '--chw': `${charW}px` } as CSSProperties}
        hideChrome={focus}
        sidebar={<Sidebar />}
        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }}
        onDrop={(e) => { if (e.dataTransfer.files?.length) { e.preventDefault(); void importFiles([...e.dataTransfer.files]) } }}
      >
        <TabsBar />
        {api.active ? (
          <EditorPane />
        ) : (
          <div className="kod-welcome">
            <div className="kod-welcome-logo">⌨️</div>
            <h2>Kod</h2>
            <p>Éditeur de code 100 % local.</p>
            <p>
              Ouvre un fichier dans l'arbre à gauche, ou crée-en un nouveau. <kbd>Ctrl+F</kbd> cherche dans le fichier, <kbd>Ctrl+Shift+F</kbd> dans tout le projet, <kbd>Ctrl+S</kbd> enregistre.
            </p>
          </div>
        )}
      </AppShell>
    </KodCtx.Provider>
  )
}
