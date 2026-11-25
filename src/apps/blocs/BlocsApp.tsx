import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent
} from 'react'
import { Link } from 'react-router-dom'
import type { Block, BlockType, Page } from './types'
import { createBlock, createPage, loadState, saveState, uid } from './store'

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
        onInput={(e) =>
          onChangeText(block.id, e.currentTarget.textContent ?? '')
        }
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}

export default function BlocsApp() {
  const [state, setState] = useState(loadState)
  const [activeId, setActiveId] = useState<string | null>(null)
  const pendingFocus = useRef<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => saveState(state), 200)
    return () => clearTimeout(t)
  }, [state])

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
    state.pages.find((p) => p.id === state.currentPageId) ?? state.pages[0]

  const updatePage = (pageId: string, patch: Partial<Page>) =>
    setState((s) => ({
      ...s,
      pages: s.pages.map((p) =>
        p.id === pageId ? { ...p, ...patch, updatedAt: Date.now() } : p
      )
    }))

  const updateBlock = (id: string, patch: Partial<Block>) => {
    if (!current) return
    updatePage(current.id, {
      blocks: current.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b))
    })
  }

  const insertBlockAfter = (afterId: string, type: BlockType = 'paragraph') => {
    if (!current) return
    const index = current.blocks.findIndex((b) => b.id === afterId)
    const block = createBlock(type)
    const blocks = [...current.blocks]
    blocks.splice(index + 1, 0, block)
    updatePage(current.id, { blocks })
    pendingFocus.current = block.id
  }

  const deleteBlock = (id: string) => {
    if (!current) return
    const index = current.blocks.findIndex((b) => b.id === id)
    if (index < 0) return
    const blocks = current.blocks.filter((b) => b.id !== id)
    if (blocks.length === 0) blocks.push(createBlock())
    updatePage(current.id, { blocks })
    const target = blocks[Math.max(0, index - 1)]
    pendingFocus.current = target.id
  }

  const handleEnter = (id: string) => {
    if (!current) return
    const block = current.blocks.find((b) => b.id === id)
    insertBlockAfter(id, block?.type === 'todo' ? 'todo' : 'paragraph')
  }

  const addPage = () => {
    const page = createPage('Nouvelle page')
    setState((s) => ({
      pages: [page, ...s.pages],
      currentPageId: page.id
    }))
  }

  const deletePage = (id: string) => {
    setState((s) => {
      const pages = s.pages.filter((p) => p.id !== id)
      const next = pages.length > 0 ? pages : [createPage('Nouvelle page')]
      return {
        pages: next,
        currentPageId:
          s.currentPageId === id ? next[0].id : s.currentPageId
      }
    })
  }

  if (!current) return null

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
                onClick={() =>
                  setState((s) => ({ ...s, currentPageId: p.id }))
                }
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
              className={activeId && current.blocks.find((b) => b.id === activeId)?.type === t.type ? 'tool active' : 'tool'}
              onClick={() => activeId && updateBlock(activeId, { type: t.type, done: t.type === 'todo' ? false : undefined })}
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
                updateBlock(id, { done: !(current.blocks.find((x) => x.id === id)?.done ?? false) })
              }
              onEnter={handleEnter}
              onBackspaceEmpty={deleteBlock}
            />
          ))}
        </div>
        <button
          className="blocs-add"
          onClick={() => insertBlockAfter(current.blocks[current.blocks.length - 1].id)}
        >
          ＋ Ajouter un bloc
        </button>
      </main>
    </div>
  )
}
