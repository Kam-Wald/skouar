import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent
} from 'react'
import { Link } from 'react-router-dom'
import type { Block, BlockType, BlocsState, Page } from './types'
import { createBlock, createPage, loadState, saveState } from './store'
import { exportStateToFile, isBlocsState, parseImportFile } from './export'
import { readRemoteState, startSync, type SyncHandle } from './sync'

const BLOCK_TYPES: { type: BlockType; label: string; title: string }[] = [
  { type: 'paragraph', label: '¶', title: 'Paragraphe' },
  { type: 'h1', label: 'H1', title: 'Titre 1' },
  { type: 'h2', label: 'H2', title: 'Titre 2' },
  { type: 'bullet', label: '•', title: 'Liste à puces' },
  { type: 'todo', label: '☑', title: 'Tâche' }
]

const PLACEHOLDERS: Record<BlockType, string> = {
  paragraph: 'Écris quelque chose… (Entrée = nouveau bloc)',
  h1: 'Titre 1',
  h2: 'Titre 2',
  bullet: 'Élément de liste',
  todo: 'Tâche à faire'
}

interface BlockViewProps {
  block: Block
  active: boolean
  onActivate: (id: string) => void
  onChangeText: (id: string, text: string) => void
  onToggleDone: (id: string) => void
  onEnter: (id: string) => void
  onBackspaceEmpty: (id: string) => void
}

function BlockView({
  block,
  active,
  onActivate,
  onChangeText,
  onToggleDone,
  onEnter,
  onBackspaceEmpty
}: BlockViewProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el && el.textContent !== block.text) el.textContent = block.text
  }, [block.text])

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = ref.current
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onEnter(block.id)
    } else if (e.key === 'Backspace' && (el?.textContent ?? '') === '') {
      e.preventDefault()
      onBackspaceEmpty(block.id)
    }
  }

  return (
    <div className={`block-row${active ? ' block-active' : ''}`}>
      {block.type === 'todo' && (
        <input
          type="checkbox"
          className="block-todo-check"
          checked={block.done ?? false}
          onChange={() => onToggleDone(block.id)}
        />
      )}
      {block.type === 'bullet' && <span className="block-bullet">•</span>}
      <div
        id={`bloc-${block.id}`}
        ref={ref}
        className={`block block-${block.type}${block.done ? ' block-done' : ''}`}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={PLACEHOLDERS[block.type]}
        onFocus={() => onActivate(block.id)}
        onInput={(e) => onChangeText(block.id, e.currentTarget.textContent ?? '')}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}

export default function BlocsApp() {
  const [state, setState] = useState<BlocsState | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const pendingFocus = useRef<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [sync, setSync] = useState<SyncHandle | null>(null)
  const lastJson = useRef('')

  useEffect(() => {
    let alive = true
    loadState().then((s) => {
      if (alive) setState(s)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!state) return
    const t = setTimeout(() => {
      void saveState(state)
    }, 200)
    return () => clearTimeout(t)
  }, [state])

  useEffect(() => {
    if (!state || !sync) return
    const t = setTimeout(() => {
      const json = JSON.stringify(state)
      lastJson.current = json
      sync.doc.transact(() => {
        sync.doc.getMap('blocs').set('state', json)
      })
    }, 400)
    return () => clearTimeout(t)
  }, [state, sync])

  useEffect(() => {
    if (!sync) return
    const map = sync.doc.getMap('blocs')
    const handler = () => {
      const json = map.get('state')
      if (typeof json === 'string' && json !== lastJson.current) {
        lastJson.current = json
        try {
          const parsed: unknown = JSON.parse(json)
          if (isBlocsState(parsed)) setState(parsed)
        } catch {
          // ignore
        }
      }
    }
    map.observe(handler)
    return () => {
      map.unobserve(handler)
    }
  }, [sync])

  useEffect(() => {
    if (pendingFocus.current) {
      const el = document.getElementById(`bloc-${pendingFocus.current}`)
      if (el) {
        el.focus()
        const range = document.createRange()
        range.selectNodeContents(el)
        range.collapse(false)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
      pendingFocus.current = null
    }
  })

  const current: Page | undefined =
    state?.pages.find((p) => p.id === state.currentPageId) ?? state?.pages[0]

  const updatePage = (pageId: string, patch: Partial<Page>) =>
    setState((s) =>
      s
        ? {
            ...s,
            pages: s.pages.map((p) =>
              p.id === pageId ? { ...p, ...patch, updatedAt: Date.now() } : p
            )
          }
        : s
    )

  const updateBlock = (id: string, patch: Partial<Block>) => {
    if (!state || !current) return
    updatePage(current.id, {
      blocks: current.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b))
    })
  }

  const insertBlockAfter = (afterId: string, type: BlockType = 'paragraph') => {
    if (!state || !current) return
    const index = current.blocks.findIndex((b) => b.id === afterId)
    const block = createBlock(type)
    const blocks = [...current.blocks]
    blocks.splice(index + 1, 0, block)
    updatePage(current.id, { blocks })
    pendingFocus.current = block.id
  }

  const deleteBlock = (id: string) => {
    if (!state || !current) return
    const index = current.blocks.findIndex((b) => b.id === id)
    if (index < 0) return
    const blocks = current.blocks.filter((b) => b.id !== id)
    if (blocks.length === 0) blocks.push(createBlock())
    updatePage(current.id, { blocks })
    const target = blocks[Math.max(0, index - 1)]
    pendingFocus.current = target.id
  }

  const handleEnter = (id: string) => {
    if (!state || !current) return
    const block = current.blocks.find((b) => b.id === id)
    insertBlockAfter(id, block?.type === 'todo' ? 'todo' : 'paragraph')
  }

  const addPage = () => {
    const page = createPage('Nouvelle page')
    setState((s) =>
      s ? { pages: [page, ...s.pages], currentPageId: page.id } : s
    )
  }

  const deletePage = (id: string) => {
    setState((s) => {
      if (!s) return s
      const pages = s.pages.filter((p) => p.id !== id)
      const next = pages.length > 0 ? pages : [createPage('Nouvelle page')]
      return {
        pages: next,
        currentPageId: s.currentPageId === id ? next[0].id : s.currentPageId
      }
    })
  }

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !state) return
    try {
      const imported = await parseImportFile(file)
      const ok = window.confirm(
        `Remplacer les ${state.pages.length} page(s) actuelles par celles du fichier « ${file.name} » ?`
      )
      if (ok) setState(imported)
    } catch {
      window.alert('Fichier invalide : un export JSON de Skouar/Blocs est attendu.')
    }
  }

  const toggleSync = () => {
    if (sync) {
      sync.leave()
      setSync(null)
      return
    }
    const input = window.prompt(
      'Code de salon de synchro (jusqu’à 12 caractères). Laisse vide pour en générer un :',
      ''
    )
    if (input === null) return
    const code = (input.trim() || Math.random().toString(36).slice(2, 8)).slice(0, 12)
    const handle = startSync(code)
    setSync(handle)
    setTimeout(() => {
      const remote = readRemoteState(handle.doc)
      if (remote && remote !== lastJson.current) {
        lastJson.current = remote
        try {
          const parsed: unknown = JSON.parse(remote)
          if (isBlocsState(parsed)) setState(parsed)
        } catch {
          // ignore
        }
      }
    }, 1500)
    window.alert(
      `Salon « ${code} » ouvert. Sur l’autre appareil (desktop/tablette), ouvre Blocs → ⇄ Sync et entre ce même code.`
    )
  }

  if (!state || !current) {
    return (
      <div className="blocs-app">
        <main className="blocs-main">
          <p className="blocs-loading">Chargement…</p>
        </main>
      </div>
    )
  }

  return (
    <div className="blocs-app">
      <aside className="blocs-sidebar">
        <Link to="/" className="blocs-back">
          ← Skouar
        </Link>
        <div className="blocs-sidebar-head">
          <span>Pages</span>
          <button className="blocs-new-page" onClick={addPage} title="Nouvelle page">
            ＋
          </button>
        </div>
        <ul className="blocs-page-list">
          {state.pages.map((p) => (
            <li key={p.id}>
              <button
                className={`blocs-page-item${p.id === current.id ? ' selected' : ''}`}
                onClick={() => setState((s) => (s ? { ...s, currentPageId: p.id } : s))}
              >
                {p.title.trim() || 'Sans titre'}
              </button>
              <button
                className="blocs-page-del"
                title="Supprimer la page"
                onClick={() => deletePage(p.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="blocs-sidebar-foot">
          <button
            className={`blocs-io${sync ? ' active' : ''}`}
            onClick={toggleSync}
            title="Synchroniser avec un autre appareil (P2P, aucun serveur)"
          >
            {sync ? `⇄ ${sync.code}` : '⇄ Sync'}
          </button>
          <button className="blocs-io" onClick={() => exportStateToFile(state)}>
            ↓ Exporter
          </button>
          <button className="blocs-io" onClick={() => fileInput.current?.click()}>
            ↑ Importer
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={handleImport}
          />
        </div>
      </aside>
      <main className="blocs-main">
        <input
          className="blocs-title"
          value={current.title}
          placeholder="Sans titre"
          onChange={(e) => updatePage(current.id, { title: e.target.value })}
        />
        <div className="blocs-toolbar">
          {BLOCK_TYPES.map((t) => (
            <button
              key={t.type}
              title={t.title}
              className={
                activeId &&
                current.blocks.find((b) => b.id === activeId)?.type === t.type
                  ? 'tool active'
                  : 'tool'
              }
              onClick={() =>
                activeId &&
                updateBlock(activeId, {
                  type: t.type,
                  done: t.type === 'todo' ? false : undefined
                })
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="blocs-editor">
          {current.blocks.map((b) => (
            <BlockView
              key={b.id}
              block={b}
              active={activeId === b.id}
              onActivate={setActiveId}
              onChangeText={(id, text) => updateBlock(id, { text })}
              onToggleDone={(id) =>
                updateBlock(id, {
                  done: !(current.blocks.find((x) => x.id === id)?.done ?? false)
                })
              }
              onEnter={handleEnter}
              onBackspaceEmpty={deleteBlock}
            />
          ))}
        </div>
        <button
          className="blocs-add"
          onClick={() =>
            insertBlockAfter(current.blocks[current.blocks.length - 1].id)
          }
        >
          ＋ Ajouter un bloc
        </button>
      </main>
    </div>
  )
}
