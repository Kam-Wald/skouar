import Dexie, { type Table } from 'dexie'

export interface KodNode {
  id: string
  parentId: string | null
  projectId?: string
  name: string
  kind: 'file' | 'dir'
  content?: string
  updatedAt: number
}

export interface KodProject {
  id: string
  name: string
  createdAt: number
}

export interface KodCommit {
  id: string
  projectId: string
  scope: 'file' | 'project'
  fileId?: string
  fileName?: string
  at: number
  message: string
  branch?: string
  files: Record<string, string>
  names: Record<string, string>
}

export interface KodBranch {
  name: string
  commitId: string
  at: number
}

export interface KodSnippet {
  lang: string
  label: string
  body: string
}

export interface KodUI {
  id: 'ui'
  tabs: string[]
  active: string | null
  expanded: string[]
  pinned: string[]
  closed: string[]
  fontSize: number
  tabSize: number
  wrap: boolean
  hlTheme: string
}

export interface KodKV {
  id: string
  value: unknown
}

export interface KodVersion {
  id: string
  fileId: string
  at: number
  content: string
}

class KodDB extends Dexie {
  nodes!: Table<KodNode, string>
  ui!: Table<KodUI, string>
  kv!: Table<KodKV, string>
  versions!: Table<KodVersion, string>
  projects!: Table<KodProject, string>
  commits!: Table<KodCommit, string>
  branches!: Table<KodBranch, string>
}

export const db = new KodDB('skouar-kod')
db.version(1).stores({
  nodes: 'id, parentId, name, kind, updatedAt',
  ui: 'id',
  kv: 'id'
})
db.version(2).stores({
  versions: 'id, fileId, at'
})
db.version(3).stores({
  nodes: 'id, parentId, projectId, name, kind, updatedAt',
  projects: 'id, name, createdAt',
  commits: 'id, projectId, at',
  branches: 'name'
})

export async function pushVersion(fileId: string, content: string): Promise<void> {
  const last = await db.versions.where('fileId').equals(fileId).last()
  if (last && last.content === content) return
  await db.versions.add({ id: uid(), fileId, at: Date.now(), content })
  const all = await db.versions.where('fileId').equals(fileId).sortBy('at')
  if (all.length > 50) {
    await db.versions.bulkDelete(all.slice(0, all.length - 50).map((v) => v.id))
  }
}

export async function listVersions(fileId: string): Promise<KodVersion[]> {
  const all = await db.versions.where('fileId').equals(fileId).sortBy('at')
  return all.reverse()
}

export async function deleteVersionsFor(fileId: string): Promise<void> {
  await db.versions.where('fileId').equals(fileId).delete()
}

export const uid = (): string => Math.random().toString(36).slice(2) + Date.now().toString(36)

export const defaultUI = (): KodUI => ({
  id: 'ui',
  tabs: [],
  active: null,
  expanded: [],
  pinned: [],
  closed: [],
  fontSize: 13,
  tabSize: 2,
  wrap: false,
  hlTheme: 'default'
})

export async function loadUI(): Promise<KodUI> {
  const row = await db.ui.get('ui')
  return row ? { ...defaultUI(), ...row } : defaultUI()
}

export async function saveUI(ui: KodUI): Promise<void> {
  await db.ui.put(ui)
}

export async function loadNodes(projectId?: string): Promise<KodNode[]> {
  const all = await db.nodes.toArray()
  const legacy = all.filter((n) => !n.projectId)
  if (legacy.length) await db.nodes.bulkPut(legacy.map((n) => ({ ...n, projectId: 'default' })))
  if (!projectId) return all
  return all.filter((n) => (n.projectId ?? 'default') === projectId)
}

export async function loadProjects(): Promise<KodProject[]> {
  return db.projects.toArray()
}

export async function putProject(p: KodProject): Promise<void> {
  await db.projects.put(p)
}

export async function deleteProject(id: string): Promise<void> {
  const ns = await loadNodes(id)
  await db.nodes.bulkDelete(ns.map((n) => n.id))
  await db.commits.where('projectId').equals(id).delete()
  await db.projects.delete(id)
}

export async function pushCommit(c: KodCommit): Promise<void> {
  await db.commits.put(c)
}

export async function listCommits(projectId: string): Promise<KodCommit[]> {
  const all = await db.commits.where('projectId').equals(projectId).toArray()
  return all.sort((a, b) => b.at - a.at)
}

export async function deleteCommit(id: string): Promise<void> {
  await db.commits.delete(id)
}

export async function putBranch(b: KodBranch): Promise<void> {
  await db.branches.put(b)
}

export async function loadBranches(): Promise<KodBranch[]> {
  return db.branches.toArray()
}

export async function delBranch(name: string): Promise<void> {
  await db.branches.delete(name)
}

export async function loadSnippets(): Promise<KodSnippet[]> {
  return (await loadKV<KodSnippet[]>('snippets')) ?? []
}

export async function saveSnippets(s: KodSnippet[]): Promise<void> {
  await saveKV('snippets', s)
}

export async function putNode(n: KodNode): Promise<void> {
  await db.nodes.put(n)
}

export async function deleteNodeTree(id: string): Promise<KodNode[]> {
  const all = await db.nodes.toArray()
  const doomed = new Set<string>([id])
  let grew = true
  while (grew) {
    grew = false
    for (const n of all) {
      if (n.parentId && doomed.has(n.parentId) && !doomed.has(n.id)) {
        doomed.add(n.id)
        grew = true
      }
    }
  }
  const removed = all.filter((n) => doomed.has(n.id))
  await db.nodes.bulkDelete([...doomed])
  return removed
}

export async function saveKV(id: string, value: unknown): Promise<void> {
  await db.kv.put({ id, value })
}

export async function loadKV<T>(id: string): Promise<T | undefined> {
  const row = await db.kv.get(id)
  return row?.value as T | undefined
}
