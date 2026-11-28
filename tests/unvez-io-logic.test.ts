// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import 'fake-indexeddb/auto'
import { db, type Folder, type Memo, DEFAULT_SETTINGS } from '../src/apps/unvez/store'
import { exportData, parseBackup, importData, backupFileName, IO_VERSION } from '../src/apps/unvez/io'
import { listMemos, listFolders, saveMemo } from '../src/apps/unvez/memos'
import { uid } from '../src/shared/db'

const mkMemo = (over: Partial<Memo> = {}): Memo => ({
  id: uid(),
  name: 'M',
  note: '',
  folderId: null,
  bg: null,
  kind: 'calc',
  expr: '1+1',
  familyId: null,
  fromUnit: null,
  toUnit: null,
  input: '1+1',
  result: '2',
  createdAt: 1,
  updatedAt: 1,
  ...over
})

describe('unvez — export/import JSON (CDC 9)', () => {
  it('roundtrip exportData → parseBackup fidèle', () => {
    const memos = [mkMemo({ name: 'A', result: '5' })]
    const folders: Folder[] = [{ id: 'f1', name: 'Cadeaux', icon: 'gift', color: '#10b981', createdAt: 1 }]
    const json = exportData(memos, folders, { ...DEFAULT_SETTINGS, decimals: 8, tape: [] })
    const b = parseBackup(json)
    expect(b.app).toBe('unvez')
    expect(b.version).toBe(IO_VERSION)
    expect(b.memos.length).toBe(1)
    expect(b.memos[0].name).toBe('A')
    expect(b.folders[0].icon).toBe('gift')
    expect(b.settings.decimals).toBe(8)
    expect('tape' in b.settings).toBe(false)
  })

  it('parseBackup rejette : JSON illisible, mauvais app, mémo/dossier mal formé', () => {
    expect(() => parseBackup('pas du json')).toThrow('JSON illisible')
    expect(() => parseBackup('{"app":"autre","memos":[],"folders":[]}')).toThrow('pas une sauvegarde Unvez')
    expect(() => parseBackup('{"app":"unvez","memos":[{"id":1}],"folders":[]}')).toThrow('mémo mal formé')
    expect(() => parseBackup('{"app":"unvez","memos":[],"folders":[{}]}')).toThrow('dossier mal formé')
  })

  it('importData remplace mémos/dossiers (snapshot à faire avant, cf. UI) et préserve les ids', async () => {
    const old = mkMemo({ name: 'Vieux' })
    await saveMemo(db, old)
    const json = exportData([mkMemo({ id: 'm9', name: 'Neuf' }), mkMemo({ id: 'm10', name: 'Neuf2' })], [{ id: 'f9', name: 'D', icon: 'star', color: '#fff', createdAt: 2 }], {})
    const r = await importData(db, json)
    expect(r).toEqual({ memos: 2, folders: 1 })
    const memos = await listMemos(db)
    expect(memos.map((m) => m.id).sort()).toEqual(['m10', 'm9'])
    expect(memos.find((m) => m.id === old.id)).toBeUndefined()
    expect((await listFolders(db)).map((f) => f.id)).toEqual(['f9'])
    await importData(db, exportData([], [], {}))
  })

  it('backupFileName : unvez-sauvegarde-<date>.json', () => {
    expect(backupFileName(new Date('2026-11-28T10:00:00Z'))).toBe('unvez-sauvegarde-2026-11-28.json')
  })
})
