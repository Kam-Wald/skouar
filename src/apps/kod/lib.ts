import { langOf } from './highlight'

declare global {
  interface Window {
    showDirectoryPicker?: (opts?: { id?: string; mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
    showOpenFilePicker?: (opts?: { multiple?: boolean; types?: unknown[] }) => Promise<FileSystemFileHandle[]>
    showSaveFilePicker?: (opts?: { suggestedName?: string; types?: unknown[] }) => Promise<FileSystemFileHandle>
  }
}

export interface RealEntry {
  key: string
  name: string
  kind: 'file' | 'dir'
  path: string
  handle?: FileSystemFileHandle
  mtime?: number
  children?: RealEntry[]
}

export interface Buffer {
  content: string
  dirty: boolean
  real?: FileSystemFileHandle
}

export interface GResult {
  key: string
  name: string
  path: string
  line: number
  text: string
}

export const TEXT_EXTS = new Set(['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'json', 'html', 'htm', 'css', 'scss', 'less', 'md', 'txt', 'py', 'rb', 'sh', 'yml', 'yaml', 'toml', 'ini', 'xml', 'svg', 'sql', 'java', 'c', 'h', 'cpp', 'cs', 'go', 'rs', 'php', 'lua', 'vue', 'svelte', 'env', 'gitignore', 'log', 'csv'])

export const fileGlyph = (name: string): string => {
  const lang = langOf(name)
  const map: Record<string, string> = {
    javascript: '🟨', typescript: '🟦', json: '🟧', html: '🌐', css: '🎨',
    markdown: '📝', python: '🐍', bash: '⚙️', yaml: '📋', sql: '🗄️', text: '📄'
  }
  return map[lang] ?? '📄'
}

export const IMG_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico'])
export const isImageName = (name: string): boolean => IMG_EXTS.has((name.split('.').pop() ?? '').toLowerCase())
export const fileToDataURL = (f: Blob): Promise<string> =>
  new Promise((res, rej) => {
    const rd = new FileReader()
    rd.onload = () => res(String(rd.result))
    rd.onerror = () => rej(rd.error)
    rd.readAsDataURL(f)
  })

export const isCodeName = (name: string): boolean => {
  if (TEXT_EXTS.has((name.split('.').pop() ?? '').toLowerCase())) return true
  if (isImageName(name)) return true
  return ['Dockerfile', 'Makefile', '.gitignore', '.env', 'LICENSE', 'README'].includes(name)
}

export async function scanDir(dir: FileSystemDirectoryHandle, path: string): Promise<RealEntry[]> {
  const out: RealEntry[] = []
  const entries = (dir as unknown as { entries?: () => AsyncIterable<[string, FileSystemHandle]> }).entries
  if (!entries) return out
  for await (const [name, h] of entries.call(dir)) {
    const p = path ? `${path}/${name}` : name
    if (h.kind === 'directory') {
      if (name === 'node_modules' || name === '.git') continue
      out.push({ key: `real:${p}`, name, kind: 'dir', path: p, children: await scanDir(h as FileSystemDirectoryHandle, p) })
    } else if (isCodeName(name)) {
      let mtime = 0
      try {
        mtime = (await (h as FileSystemFileHandle).getFile()).lastModified
      } catch { /* mtime inconnu */ }
      out.push({ key: `real:${p}`, name, kind: 'file', path: p, handle: h as FileSystemFileHandle, mtime })
    }
  }
  out.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1))
  return out
}

export const flattenReal = (entries: RealEntry[], acc: RealEntry[] = []): RealEntry[] => {
  for (const e of entries) {
    if (e.kind === 'file') acc.push(e)
    else if (e.children) flattenReal(e.children, acc)
  }
  return acc
}


export const PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' }
