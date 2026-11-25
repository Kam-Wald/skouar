import type { Block, Database, Page } from './types'
import { flattenBlocks, stripHtml } from './tree'

interface Props {
  page: Page
  allPages: Page[]
  onOpenPage: (id: string) => void
}

export default function DashboardView({ page, allPages, onOpenPage }: Props) {
  const dbs: { block: Block; db: Database }[] = flattenBlocks(page.blocks)
    .filter((b) => b.type === 'database' && b.db)
    .map((b) => ({ block: b, db: b.db! }))

  const totalBlocks = allPages.reduce(
    (n, p) => n + flattenBlocks(p.blocks).length,
    0
  )
  const totalRows = allPages.reduce(
    (n, p) =>
      n +
      flattenBlocks(p.blocks).reduce(
        (m, b) => m + (b.db?.rows.length ?? 0),
        0
      ),
    0
  )

  return (
    <div className="dashboard">
      <div className="dash-grid">
        <div className="dash-card">
          <div className="dash-num">{allPages.length}</div>
          <div className="db-type">pages</div>
        </div>
        <div className="dash-card">
          <div className="dash-num">{totalBlocks}</div>
          <div className="db-type">blocs</div>
        </div>
        <div className="dash-card">
          <div className="dash-num">{totalRows}</div>
          <div className="db-type">lignes de BDD</div>
        </div>
        {dbs.map(({ db }) => {
          const numCol = db.columns.find((c) => c.type === 'number')
          const nums = db.rows
            .map((r) => r.cells[numCol?.id ?? ''])
            .filter((v): v is number => typeof v === 'number')
          const sum = nums.reduce((a, b) => a + b, 0)
          return (
            <div className="dash-card" key={db.id}>
              <div className="dash-title">▦ {stripHtml(db.title) || 'Base'}</div>
              <div className="dash-num">{db.rows.length}</div>
              <div className="db-type">lignes</div>
              {numCol && nums.length > 0 && (
                <div className="dash-sub">
                  Σ {numCol.name} = {Math.round(sum * 100) / 100}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {dbs.length === 0 && (
        <p className="db-empty">
          Ajoute des bases de données (▦) dans cette page pour les voir en mini-stats ici.
        </p>
      )}
      <div className="dash-pages">
        <strong>Pages récentes</strong>
        {[...allPages]
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, 8)
          .map((p) => (
            <button key={p.id} className="link-item" onClick={() => onOpenPage(p.id)}>
              {p.icon} {stripHtml(p.title).trim() || 'Sans titre'}
            </button>
          ))}
      </div>
    </div>
  )
}
