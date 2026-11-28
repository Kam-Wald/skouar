import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import AppTile from '../shared/AppTile'
import { launcherBgCss, loadLauncherBg, type LauncherBg } from '../shared/launcherBg'
import { applyOrder, loadLauncherOrder, moveId, resetLauncherOrder, saveLauncherOrder } from '../shared/launcherOrder'
import { apps, type AppMeta } from '../apps/registry'
import ThemeButton from '../shared/ThemeButton'
import SettingsButton from '../shared/Settings'

function isCoarsePointer(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
}

function isHiddenOnMobile(a: AppMeta): boolean {
  return !!a.desktopOnly && isCoarsePointer() && localStorage.getItem(`skouar:${a.id}:desktopOnly`) !== '0'
}

export default function LauncherHome() {
  const [q, setQ] = useState('')
  const [bg, setBg] = useState<LauncherBg | null>(() => loadLauncherBg())
  const [edit, setEdit] = useState(false)
  const [order, setOrder] = useState<string[]>(() => loadLauncherOrder())
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropId, setDropId] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const statusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const searchRef = useRef<HTMLInputElement>(null)
  const say = (msg: string): void => {
    setStatus(msg)
    if (statusTimer.current) clearTimeout(statusTimer.current)
    statusTimer.current = setTimeout(() => setStatus(''), 2500)
  }
  useEffect(() => {
    const on = () => setBg(loadLauncherBg())
    window.addEventListener('skouar:settings', on)
    return () => window.removeEventListener('skouar:settings', on)
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing = t instanceof HTMLElement && !!t.closest('input, textarea, select, [contenteditable="true"]')
      if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'Escape' && edit) {
        setEdit(false)
        setDragId(null)
        setDropId(null)
      } else if (e.key === 'Escape' && t === searchRef.current) {
        if (q) setQ('')
        else searchRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [q, edit])
  const query = q.trim().toLowerCase()
  const base = applyOrder(apps.filter((a) => !isHiddenOnMobile(a)), order)
  const visible = query
    ? base.filter((a) => `${a.name} ${a.description} ${a.tag}`.toLowerCase().includes(query))
    : base

  const commitOrder = (ids: string[], msg: string): void => {
    setOrder(ids)
    saveLauncherOrder(ids)
    say(msg)
  }
  const onTileDrop = (beforeId: string): void => {
    if (!dragId) return
    commitOrder(moveId(base.map((a) => a.id), dragId, beforeId), 'Ordre des tuiles enregistré')
    setDragId(null)
    setDropId(null)
  }
  const onTileKeyDown = (id: string, e: ReactKeyboardEvent): void => {
    if (!edit || !e.altKey) return
    const ids = base.map((a) => a.id)
    const i = ids.indexOf(id)
    if (i < 0) return
    if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault()
      commitOrder(moveId(ids, id, ids[i - 1]), 'Ordre des tuiles enregistré')
    } else if (e.key === 'ArrowRight' && i < ids.length - 1) {
      e.preventDefault()
      commitOrder(moveId(ids, id, i + 2 < ids.length ? ids[i + 2] : null), 'Ordre des tuiles enregistré')
    }
  }

  return (
    <div className="launcher" style={bg ? { background: launcherBgCss(bg) } : undefined}>
      <a className="skip-link" href="#launcher-main">
        Aller au contenu
      </a>
      <div className="launcher-theme">
        <button
          type="button"
          className={`launcher-edit-btn${edit ? ' active' : ''}`}
          aria-pressed={edit}
          onClick={() => {
            setEdit(!edit)
            setDragId(null)
            setDropId(null)
          }}
        >
          {edit ? '✓ Terminé' : '⋮⋮ Réorganiser'}
        </button>
        <ThemeButton />
        <SettingsButton />
      </div>
      <header className="launcher-header">
        <img
          className="launcher-logo-img launcher-mark"
          src={`${import.meta.env.BASE_URL}icons/icon-512.png`}
          alt="Skouar"
        />
        <div>
          <h1 className="launcher-title" data-text="Skouar">
            Skouar<span className="launcher-title-dot">.</span>
          </h1>
          <p className="launcher-subtitle">
            Plein d’applications. Une seule place.
          </p>
        </div>
      </header>
      <input
        ref={searchRef}
        className="launcher-search"
        type="search"
        aria-label="Rechercher une application"
        placeholder="Rechercher une app… ( / )"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {query && (
        <p className="launcher-count" role="status" aria-live="polite">
          {visible.length === 0 ? 'Aucune app' : `${visible.length} app${visible.length > 1 ? 's' : ''}`}
        </p>
      )}
      {edit && (
        <div className="launcher-editbar">
          <span>Glisse les poignées ⋮⋮ pour réordonner (Alt+←/→ au clavier, Échap pour quitter).</span>
          <button
            type="button"
            className="launcher-reset"
            onClick={() => {
              resetLauncherOrder()
              setOrder([])
              say('Ordre réinitialisé')
            }}
          >
            Réinitialiser l’ordre
          </button>
        </div>
      )}
      {status && (
        <p className="launcher-status" role="status">
          {status}
        </p>
      )}
      <main
        className={`launcher-grid${edit ? ' editing' : ''}${edit && dragId && !dropId ? ' drop-end' : ''}`}
        id="launcher-main"
        onDragOver={(e) => {
          if (edit && dragId && e.target === e.currentTarget) {
            e.preventDefault()
            setDropId(null)
          }
        }}
        onDrop={(e) => {
          if (edit && dragId) {
            e.preventDefault()
            commitOrder(moveId(base.map((a) => a.id), dragId, null), 'Ordre des tuiles enregistré')
            setDragId(null)
            setDropId(null)
          }
        }}
      >
        {visible.map((app) => (
          <AppTile
            key={app.id}
            app={app}
            idx={String(base.indexOf(app) + 1).padStart(2, '0')}
            edit={edit}
            dragging={dragId === app.id}
            dropBefore={dropId === app.id}
            onGripDragStart={(id) => setDragId(id)}
            onTileDragOver={(id) => setDropId(id)}
            onTileDrop={onTileDrop}
            onDragEnd={() => {
              setDragId(null)
              setDropId(null)
            }}
            onTileKeyDown={onTileKeyDown}
          />
        ))}
        {visible.length === 0 && <p className="launcher-subtitle">Aucune app ne correspond à « {q} ».</p>}
      </main>
      <footer className="launcher-footer">
        Local-first : tes données restent sur cet appareil.
      </footer>
    </div>
  )
}
