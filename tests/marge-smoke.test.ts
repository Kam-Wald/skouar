// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import 'fake-indexeddb/auto'

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false
    })) as unknown as typeof window.matchMedia
  }
  ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

describe('Marge — mise en place (smoke jsdom)', () => {
  it('rend la coquille AppShell avec le nom Marge et la tuile est câblée', async () => {
    const React = await import('react')
    const { createRoot } = await import('react-dom/client')
    const { MemoryRouter } = await import('react-router-dom')
    const MargeApp = (await import('../src/apps/marge/MargeApp')).default
    const { apps } = await import('../src/apps/registry')
    const meta = apps.find((a) => a.id === 'marge')
    expect(meta).toBeTruthy()
    expect(meta!.name).toBe('Marge')
    expect(meta!.tag).toBe('pdf')
    expect(meta!.component).toBeTruthy()
    const div = document.createElement('div')
    document.body.appendChild(div)
    const root = createRoot(div)
    await React.act(async () => {
      root.render(React.createElement(MemoryRouter, null, React.createElement(MargeApp)))
    })
    expect(div.textContent).toContain('Marge')
    expect(div.querySelector('.blocs-app')).toBeTruthy()
    root.unmount()
    div.remove()
  })

  it('la base skouar-marge est déclarée dans APP_DB_MAP et s’ouvre (table docs lisible)', async () => {
    const { APP_DB_MAP } = await import('../src/shared/db')
    expect(APP_DB_MAP.marge).toBe('skouar-marge')
    const { db } = await import('../src/apps/marge/store')
    const n = await db.table('docs').count()
    expect(n).toBe(0)
    const names = ['kv', 'docs', 'annots', 'pageNotes', 'folders', 'signatures']
    for (const t of names) expect(db.table(t).name).toBe(t)
  })
})
