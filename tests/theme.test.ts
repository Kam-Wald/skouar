// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'

function mockMq(matches: boolean): void {
  window.matchMedia = ((q: string) => ({
    matches,
    media: q,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia
}

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('thème système', () => {
  it('défaut = system quand aucun choix stocké', async () => {
    mockMq(false)
    const { getTheme } = await import('../src/ThemeButton')
    expect(getTheme()).toBe('system')
  })

  it('resolveTheme suit prefers-color-scheme, choix manuel prioritaire', async () => {
    const { resolveTheme } = await import('../src/ThemeButton')
    mockMq(true)
    expect(resolveTheme('system')).toBe('light')
    mockMq(false)
    expect(resolveTheme('system')).toBe('dark')
    expect(resolveTheme('dark')).toBe('dark')
    expect(resolveTheme('light')).toBe('light')
  })

  it('applyTheme persiste le choix et pose le thème résolu sur <html>', async () => {
    const { applyTheme, getTheme } = await import('../src/ThemeButton')
    mockMq(true)
    applyTheme('system', '#0d9488')
    expect(localStorage.getItem('skouar:theme')).toBe('system')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(getTheme()).toBe('system')
    applyTheme('dark', '#0d9488')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('skouar:theme')).toBe('dark')
  })
})
