// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import 'fake-indexeddb/auto'
import { db, type Folder, type Memo } from '../src/apps/unvez/store'
import { deleteMemo, listFolders, listMemos, moveMemo, removeFolder, saveFolder, saveMemo, searchMemos } from '../src/apps/unvez/memos'
import { uid } from '../src/shared/db'

const mkMemo = (over: Partial<Memo> = {}): Memo => ({
  id: uid(),
  name: 'Peinture salon',
  note: 'les cadeaux',
  folderId: null,
  bg: null,
  kind: 'calc',
  expr: '2+2',
  familyId: null,
  fromUnit: null,
  toUnit: null,
  input: '2+2',
  result: '4',
  createdAt: 1,
  updatedAt: 1,
  ...over
})

describe('unvez — mémos/dossiers : règles de données (CDC 6, 8)', () => {
  it('saveMemo au même id = mise à jour sans doublon (6.G)', async () => {
    const m = mkMemo()
    await saveMemo(db, m)
    await saveMemo(db, { ...m, result: '8', updatedAt: 2 })
    const all = await listMemos(db)
    const same = all.filter((x) => x.id === m.id)
    expect(same.length).toBe(1)
    expect(same[0].result).toBe('8')
    await deleteMemo(db, m.id)
  })

  it('removeFolder : les mémos retombent dans « sans dossier », jamais détruits (6.C)', async () => {
    const f: Folder = { id: uid(), name: 'Cadeaux', icon: 'gift', color: '#10b981', createdAt: 1 }
    await saveFolder(db, f)
    const m1 = mkMemo({ folderId: f.id })
    const m2 = mkMemo({ folderId: f.id, name: 'Autre' })
    await saveMemo(db, m1)
    await saveMemo(db, m2)
    await removeFolder(db, f.id)
    expect((await listFolders(db)).find((x) => x.id === f.id)).toBeUndefined()
    const after = await listMemos(db)
    expect(after.find((x) => x.id === m1.id)?.folderId).toBeNull()
    expect(after.find((x) => x.id === m2.id)?.folderId).toBeNull()
    await deleteMemo(db, m1.id)
    await deleteMemo(db, m2.id)
  })

  it('moveMemo change le dossier (drag & drop 6.D)', async () => {
    const f: Folder = { id: uid(), name: 'Dossier A', icon: 'star', color: '#4f46e5', createdAt: 1 }
    await saveFolder(db, f)
    const m = mkMemo()
    await saveMemo(db, m)
    await moveMemo(db, m.id, f.id)
    expect((await listMemos(db)).find((x) => x.id === m.id)?.folderId).toBe(f.id)
    await moveMemo(db, m.id, null)
    expect((await listMemos(db)).find((x) => x.id === m.id)?.folderId).toBeNull()
    await deleteMemo(db, m.id)
    await removeFolder(db, f.id)
  })

  it('searchMemos : plein texte sur nom, note, valeurs (6.H)', () => {
    const memos = [mkMemo(), mkMemo({ name: 'Courses', note: '', input: '100 km', result: '62,137 mi', kind: 'conv' })]
    expect(searchMemos(memos, 'peinture').length).toBe(1)
    expect(searchMemos(memos, 'cadeaux').length).toBe(1)
    expect(searchMemos(memos, '62,137').length).toBe(1)
    expect(searchMemos(memos, 'km').length).toBe(1)
    expect(searchMemos(memos, 'zzz').length).toBe(0)
    expect(searchMemos(memos, '').length).toBe(2)
  })
})
