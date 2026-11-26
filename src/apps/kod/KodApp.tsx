import { type CSSProperties } from 'react'
import { KodCtx } from './ctx'
import { useKodApp } from './useKodApp'
import Sidebar from './parts/Sidebar'
import TabsBar from './parts/TabsBar'
import EditorPane from './parts/EditorPane'
import Overlays from './parts/Overlays'

export default function KodApp() {
  const api = useKodApp()
  const { nodes, ui, focus, sideW, setSideW, charW, importFiles } = api

  if (!nodes || !ui) {
    return (
      <div className="blocs-app">
        <main className="blocs-main">
          <div className="skel skel-title" />
          <div className="skel skel-line" />
          <div className="skel skel-line short" />
        </main>
      </div>
    )
  }

  return (
    <KodCtx.Provider value={api}>
      <div
        className={`blocs-app kod-app hl-${ui.hlTheme}${focus ? ' focus' : ''}`}
        style={{ '--side-w': `${sideW}px`, '--kod-fs': `${ui.fontSize}px`, '--kod-tab': ui.tabSize, '--chw': `${charW}px` } as CSSProperties}
        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }}
        onDrop={(e) => { if (e.dataTransfer.files?.length) { e.preventDefault(); void importFiles([...e.dataTransfer.files]) } }}
      >
        <Sidebar />
      <div
        className="sidebar-resizer"
        title="Redimensionner le menu"
        onMouseDown={(e) => {
          e.preventDefault()
          const startX = e.clientX
          const startW = sideW
          const onMove = (ev: MouseEvent) => {
            const w = Math.min(440, Math.max(180, startW + ev.clientX - startX))
            setSideW(w)
            localStorage.setItem('skouar:sidebarW', String(w))
          }
          const onUp = () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
          }
          window.addEventListener('mousemove', onMove)
          window.addEventListener('mouseup', onUp)
        }}
      >
        <span className="resizer-arrow">⇆</span>
      </div>
        <main className="blocs-main kod-main">
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
        </main>
        <Overlays />
      </div>
    </KodCtx.Provider>
  )
}
