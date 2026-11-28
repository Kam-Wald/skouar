// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import 'fake-indexeddb/auto'
import { db, kv, type Memo, type Folder } from '../src/apps/unvez/store'
import { APP_DB_MAP } from '../src/shared/db'

describe('unvez — règles de données (CDC 2.A / 8)', () => {
  it('APP_DB_MAP déclare la base skouar-unvez', () => {
    expect(APP_DB_MAP.unvez).toBe('skouar-unvez')
  })

  it('schéma v1 : tables kv, memos, folders présentes', () => {
    expect(db.tables.map((t) => t.name).sort()).toEqual(['folders', 'kv', 'memos'])
  })

  it('kvOf persiste réellement (keyPath id)', async () => {
    await kv.saveKV('settings', { decimals: 6, sci: true })
    expect(await kv.loadKV('settings')).toEqual({ decimals: 6, sci: true })
  })

  it('memos/folders : CRUD par id, jamais par nom', async () => {
    const f: Folder = { id: 'f1', name: 'Cadeaux', icon: 'gift', color: '#10b981', createdAt: 1 }
    await db.table<Folder, string>('folders').put(f)
    const m: Memo = {
      id: 'm1',
      name: 'Peinture salon',
      note: '',
      folderId: 'f1',
      bg: null,
      kind: 'calc',
      expr: '2+2',
      familyId: null,
      fromUnit: null,
      toUnit: null,
      input: '2+2',
      result: '4',
      createdAt: 1,
      updatedAt: 1
    }
    await db.table<Memo, string>('memos').put(m)
    expect((await db.table<Folder, string>('folders').get('f1'))?.name).toBe('Cadeaux')
    expect((await db.table<Memo, string>('memos').get('m1'))?.folderId).toBe('f1')
    await db.table<Memo, string>('memos').delete('m1')
    expect(await db.table<Memo, string>('memos').get('m1')).toBeUndefined()
  })
})
