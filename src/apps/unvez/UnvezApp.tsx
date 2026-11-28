import { useEffect, useState } from 'react'
import AppShell from '../../shared/AppShell'
import { IconView } from '../../shared/IconPicker'
import { notify } from '../../shared/notify'
import { uid } from '../../shared/db'
import { apps } from '../registry'
import CalcView from './CalcView'
import ConvView from './ConvView'
import { FolderModal, MemoModal, type MemoDraft } from './MemoModal'
import MemosView from './MemosView'
import { deleteMemo, listFolders, listMemos, moveMemo, removeFolder, saveFolder, saveMemo } from './memos'
import { loadAppSettings, saveAppSettings, SETTINGS_EVENT } from '../../shared/Settings'
import SettingsPanel from './SettingsPanel'
import { db, DEFAULT_SETTINGS, kv, type Folder, type Memo, type TapeEntry, type UnvezSettings } from './store'

const app = apps.find((a) => a.id === 'unvez')!

type View = 'calc' | 'conv' | 'memos'

type MemoPayload = Pick<Memo, 'kind' | 'expr' | 'familyId' | 'fromUnit' | 'toUnit' | 'input' | 'result'>

export default function UnvezApp() {
  const [view, setView] = useState<View>('conv')
  const [folderId, setFolderId] = useState<string | null>(null)
  const [settings, setSettings] = useState<UnvezSettings | null>(null)
  const [memos, setMemos] = useState<Memo[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [toast, setToast] = useState('')
  const [memoModal, setMemoModal] = useState<null | { payload: MemoPayload; editId?: string } | { edit: Memo }>(null)
  const [folderModal, setFolderModal] = useState<null | Partial<Folder>>(null)
  const [dragMemoId, setDragMemoId] = useState<string | null>(null)
  const [calcSeed, setCalcSeed] = useState<{ expr: string; raw: number } | null>(null)
  const [convSeed, setConvSeed] = useState<{ family: string; from: string; to: string; value: string } | null>(null)
  const [reusedMemoId, setReusedMemoId] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const appS = loadAppSettings('unvez') as Partial<UnvezSettings>
    kv.loadKV<TapeEntry[]>('tape')
      .then((tape) => {
        if (!alive) return
        const cleanTape = (Array.isArray(tape) ? tape : []).filter((e) => e && typeof e === 'object')
        setSettings({ ...DEFAULT_SETTINGS, ...appS, tape: cleanTape })
      })
      .catch(() => {
        if (alive) {
          setSettings({ ...DEFAULT_SETTINGS, ...appS, tape: [] })
          notify('Lecture de la tape impossible — tape vide en mémoire, rien n’est écrit')
        }
      })
    Promise.all([listMemos(db), listFolders(db)])
      .then(([m, f]) => {
        if (alive) {
          setMemos(m)
          setFolders(f)
        }
      })
      .catch(() => {
        if (alive) notify('Lecture des mémos impossible — liste vide en mémoire, rien n’est écrit')
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const on = (e: Event) => setToast((e as CustomEvent<string>).detail ?? '')
    window.addEventListener('skouar:toast', on)
    return () => window.removeEventListener('skouar:toast', on)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2500)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const on = () =>
      setSettings((prev) => ({ ...(prev ?? DEFAULT_SETTINGS), ...(loadAppSettings('unvez') as Partial<UnvezSettings>) }))
    window.addEventListener(SETTINGS_EVENT, on)
    return () => window.removeEventListener(SETTINGS_EVENT, on)
  }, [])

  const onSettings = (patch: Partial<UnvezSettings>): void => {
    setSettings((prev) => {
      const next = { ...(prev ?? DEFAULT_SETTINGS), ...patch }
      const { tape, ...rest } = patch
      if (tape !== undefined) void kv.saveKV('tape', tape).catch(() => {})
      if (Object.keys(rest).length > 0) saveAppSettings('unvez', rest, true)
      return next
    })
  }

  const reload = async (): Promise<void> => {
    const [m, f] = await Promise.all([listMemos(db), listFolders(db)])
    setMemos(m)
    setFolders(f)
  }

  const openMemoFromCalc = (p: { expr: string; result: string }): void => {
    setMemoModal({ payload: { kind: 'calc', expr: p.expr, familyId: null, fromUnit: null, toUnit: null, input: p.expr, result: p.result }, editId: reusedMemoId ?? undefined })
  }

  const openMemoFromConv = (p: { familyId: string; fromUnit: string; toUnit: string; input: string; result: string }): void => {
    setMemoModal({ payload: { kind: 'conv', expr: `${p.input} ${p.fromUnit} → ${p.toUnit}`, familyId: p.familyId, fromUnit: p.fromUnit, toUnit: p.toUnit, input: p.input, result: p.result }, editId: reusedMemoId ?? undefined })
  }

  const saveMemoDraft = async (d: MemoDraft): Promise<void> => {
    const now = Date.now()
    const existing = memoModal && 'edit' in memoModal ? memoModal.edit : memoModal?.editId ? memos.find((m) => m.id === memoModal.editId) : undefined
    const payload = memoModal && 'payload' in memoModal ? memoModal.payload : { kind: existing?.kind ?? 'calc', expr: existing?.expr ?? '', familyId: existing?.familyId ?? null, fromUnit: existing?.fromUnit ?? null, toUnit: existing?.toUnit ?? null, input: existing?.input ?? '', result: existing?.result ?? '' } as MemoPayload
    const memo: Memo = {
      id: existing?.id ?? uid(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      kind: payload.kind,
      expr: payload.expr,
      familyId: payload.familyId,
      fromUnit: payload.fromUnit,
      toUnit: payload.toUnit,
      input: payload.input,
      result: payload.result,
      name: d.name,
      note: d.note,
      folderId: d.folderId,
      bg: d.bg
    }
    await saveMemo(db, memo)
    await reload()
    setMemoModal(null)
    setReusedMemoId(memo.id)
    notify(existing ? 'Mémo mis à jour' : 'Mémo enregistré')
  }

  const editMemo = (m: Memo): void => setMemoModal({ edit: m })

  const onDeleteMemo = async (m: Memo): Promise<void> => {
    await deleteMemo(db, m.id)
    await reload()
    notify('Mémo supprimé')
  }

  const handleSaveFolder = async (f: { id?: string; name: string; icon: string; color: string }): Promise<void> => {
    const now = Date.now()
    const folder: Folder = { id: f.id ?? uid(), createdAt: folders.find((x) => x.id === f.id)?.createdAt ?? now, name: f.name, icon: f.icon, color: f.color }
    await saveFolder(db, folder)
    await reload()
    setFolderModal(null)
    notify(f.id ? 'Dossier renommé' : 'Dossier créé')
  }

  const onDeleteFolder = async (f: Folder): Promise<void> => {
    await removeFolder(db, f.id)
    await reload()
    setFolderId(null)
    notify('Dossier supprimé — ses mémos sont dans « Sans dossier »')
  }

  const onMoveMemo = async (memoId: string, target: string | null): Promise<void> => {
    await moveMemo(db, memoId, target)
    await reload()
    notify('Mémo déplacé')
  }

  const reuseMemo = (m: Memo): void => {
    setReusedMemoId(m.id)
    if (m.kind === 'calc') {
      setCalcSeed({ expr: m.expr, raw: Number(m.result) })
      setView('calc')
    } else {
      setConvSeed({ family: m.familyId ?? 'distance', from: m.fromUnit ?? '', to: m.toUnit ?? '', value: m.input })
      setView('conv')
    }
  }

  const sidebar = (
    <>
      <p className="unvez-side-label">Calculer</p>
      <button type="button" className={`unvez-side-btn${view === 'calc' ? ' active' : ''}`} onClick={() => setView('calc')}>
        Calculatrice
      </button>
      <button type="button" className={`unvez-side-btn${view === 'conv' ? ' active' : ''}`} onClick={() => setView('conv')}>
        Conversion
      </button>
      <p className="unvez-side-label">
        Mémos enregistrés
        <button type="button" className="unvez-side-add" title="Nouveau dossier" aria-label="Nouveau dossier" onClick={() => setFolderModal({})}>
          +
        </button>
      </p>
      <button
        type="button"
        className={`unvez-side-btn${view === 'memos' && folderId === null ? ' active' : ''}`}
        onClick={() => {
          setView('memos')
          setFolderId(null)
        }}
        onDragOver={(e) => {
          if (dragMemoId) e.preventDefault()
        }}
        onDrop={(e) => {
          e.preventDefault()
          if (dragMemoId) {
            void onMoveMemo(dragMemoId, null)
            setDragMemoId(null)
          }
        }}
      >
        Sans dossier
      </button>
      {folders.map((f) => (
        <button
          key={f.id}
          type="button"
          className={`unvez-side-btn unvez-folder${view === 'memos' && folderId === f.id ? ' active' : ''}`}
          onClick={() => {
            setView('memos')
            setFolderId(f.id)
          }}
          onDragOver={(e) => {
            if (dragMemoId) e.preventDefault()
          }}
          onDrop={(e) => {
            e.preventDefault()
            if (dragMemoId) {
              void onMoveMemo(dragMemoId, f.id)
              setDragMemoId(null)
            }
          }}
        >
          <span className="unvez-folder-ic" style={{ color: f.color }}>
            <IconView name={f.icon} />
          </span>
          {f.name}
        </button>
      ))}
    </>
  )

  return (
    <AppShell
      appId="unvez"
      appName="Unvez"
      logo={app.logo!}
      sidebar={sidebar}
      settingsPanel={
        settings ? (
          <SettingsPanel settings={settings} onSettings={onSettings} memos={memos} folders={folders} onReload={reload} />
        ) : undefined
      }
    >
      {view === 'calc' &&
        (settings ? (
          <CalcView settings={settings} onSettings={onSettings} seed={calcSeed} onSaveMemo={openMemoFromCalc} />
        ) : (
          <section className="unvez-view">
            <p className="unvez-empty">Chargement…</p>
          </section>
        ))}
      {view === 'conv' &&
        (settings ? (
          <ConvView settings={settings} onSettings={onSettings} seed={convSeed} onSaveMemo={openMemoFromConv} />
        ) : (
          <section className="unvez-view">
            <p className="unvez-empty">Chargement…</p>
          </section>
        ))}
      {view === 'memos' && (
        <MemosView
          memos={memos}
          folders={folders}
          folderId={folderId}
          onReuse={reuseMemo}
          onEdit={editMemo}
          onDelete={(m) => void onDeleteMemo(m)}
          onDragMemoStart={setDragMemoId}
          onRenameFolder={(f) => setFolderModal(f)}
          onDeleteFolder={(f) => void onDeleteFolder(f)}
        />
      )}
      {memoModal && 'payload' in memoModal && (
        <MemoModal
          initial={{ id: memoModal.editId, name: '', note: '', folderId: null, bg: null }}
          folders={folders}
          onSave={(d) => void saveMemoDraft(d)}
          onClose={() => setMemoModal(null)}
        />
      )}
      {memoModal && 'edit' in memoModal && (
        <MemoModal
          initial={{ id: memoModal.edit.id, name: memoModal.edit.name, note: memoModal.edit.note, folderId: memoModal.edit.folderId, bg: memoModal.edit.bg }}
          folders={folders}
          onSave={(d) => void saveMemoDraft(d)}
          onClose={() => setMemoModal(null)}
        />
      )}
      {folderModal && <FolderModal initial={folderModal.id ? folderModal as Folder : undefined} onSave={(f) => void handleSaveFolder(f)} onClose={() => setFolderModal(null)} />}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </AppShell>
  )
}
