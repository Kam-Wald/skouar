import { useEffect, useRef, useState, type DragEvent as ReactDragEvent } from 'react'
import { PDFDocument } from 'pdf-lib'
import AppShell from '../../shared/AppShell'
import LibraryView from './LibraryView'
import { loadDoc } from './pdf'
import { ab } from './logic'
import {
  addDoc,
  deleteDoc,
  listAnnots,
  listDocs,
  listPageNotes,
  restoreDoc,
  uid,
  updateDoc,
  type MargeDoc
} from './store'

const BASE = import.meta.env.BASE_URL

type Toast = { key: number; msg: string; action?: () => void }

export default function MargeApp() {
  const [docs, setDocs] = useState<MargeDoc[]>([])
  const [mergeSel, setMergeSel] = useState<string[]>([])
  const [toast, setToast] = useState<Toast | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void listDocs().then(setDocs)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5200)
    return () => clearTimeout(t)
  }, [toast])

  const refresh = (): Promise<void> =>
    listDocs().then((l) => {
      setDocs(l)
      return undefined
    })

  const importFiles = async (list: File[]): Promise<void> => {
    let n = 0
    for (const f of list) {
      if (!f.name.toLowerCase().endsWith('.pdf') && !f.type.includes('pdf')) continue
      const buf = await f.arrayBuffer()
      const d = await loadDoc(buf)
      const pages = d.numPages
      await d.destroy()
      await addDoc({
        id: uid(),
        title: f.name.replace(/\.pdf$/i, ''),
        data: new Blob([buf], { type: 'application/pdf' }),
        pages,
        updatedAt: Date.now()
      })
      n++
    }
    if (n) {
      await refresh()
      setToast({ key: Date.now(), msg: `${n} PDF importé${n > 1 ? 's' : ''} 📥` })
    }
  }

  const mergeSelected = async (): Promise<void> => {
    const sel = mergeSel.map((id) => docs.find((d) => d.id === id)).filter((d): d is MargeDoc => !!d)
    if (sel.length < 2) return
    const out = await PDFDocument.create()
    let total = 0
    for (const d of sel) {
      const src = await PDFDocument.load(new Uint8Array(await d.data.arrayBuffer()))
      const copied = await out.copyPages(src, src.getPageIndices())
      copied.forEach((p) => out.addPage(p))
      total += copied.length
    }
    const bytes = await out.save()
    await addDoc({
      id: uid(),
      title: `fusion-${sel.length}-pdf`,
      data: new Blob([ab(bytes)], { type: 'application/pdf' }),
      pages: total,
      updatedAt: Date.now()
    })
    await refresh()
    setMergeSel([])
    setToast({ key: Date.now(), msg: `Fusion de ${sel.length} PDF (${total} pages) 📚` })
  }

  const removeDoc = async (d: MargeDoc): Promise<void> => {
    const snap = { doc: d, annots: await listAnnots(d.id), notes: await listPageNotes(d.id) }
    await deleteDoc(d.id)
    await refresh()
    setMergeSel((s) => s.filter((id) => id !== d.id))
    setToast({
      key: Date.now(),
      msg: 'Document supprimé',
      action: () => {
        void restoreDoc(snap.doc, snap.annots, snap.notes).then(() => refresh())
      }
    })
  }

  const onDrop = (e: ReactDragEvent): void => {
    e.preventDefault()
    setDragOver(false)
    void importFiles(Array.from(e.dataTransfer.files))
  }

  return (
    <AppShell
      appId="marge"
      appName="Marge"
      logo={`${BASE}app-icons/marge.svg`}
      className={`marge-app${dragOver ? ' drag-over' : ''}`}
      mainClass="marge-main"
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      sidebar={
        <div className="marge-side">
          <div className="marge-side-label">Bibliothèque</div>
          <p className="marge-empty">
            {docs.length} document{docs.length > 1 ? 's' : ''} PDF · {mergeSel.length} sélectionné{mergeSel.length > 1 ? 's' : ''}
          </p>
          <button className="db-btn marge-side-btn" onClick={() => fileRef.current?.click()}>
            ↑ Importer un PDF
          </button>
          <button className="db-btn marge-side-btn" disabled={mergeSel.length < 2} onClick={() => void mergeSelected()}>
            📚 Fusionner la sélection ({mergeSel.length})
          </button>
        </div>
      }
    >
      <LibraryView
        docs={docs}
        mergeSel={mergeSel}
        onToggleMerge={(id) => setMergeSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
        onImportClick={() => fileRef.current?.click()}
        onMerge={() => void mergeSelected()}
        onRename={(id, title) => {
          void updateDoc(id, { title, updatedAt: Date.now() }).then(() => refresh())
        }}
        onDelete={(d) => void removeDoc(d)}
      />
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(e) => {
          void importFiles(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />
      {toast && (
        <div className="toast" key={toast.key}>
          <span>{toast.msg}</span>
          {toast.action && (
            <button
              onClick={() => {
                setToast(null)
                toast.action?.()
              }}
            >
              Annuler
            </button>
          )}
        </div>
      )}
    </AppShell>
  )
}
