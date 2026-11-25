import { useEffect, useMemo, useRef, useState } from 'react'
import type { Page } from './types'
import { flattenBlocks, mentionsIn, stripHtml } from './tree'

interface Node {
  id: string
  label: string
  x: number
  y: number
  vx: number
  vy: number
  r: number
}

interface Edge {
  from: string
  to: string
}

export default function GraphView({
  pages,
  currentId,
  onOpen,
  onClose
}: {
  pages: Page[]
  currentId: string | null
  onOpen: (id: string) => void
  onClose: () => void
}) {
  const titleOf = (p: Page) => stripHtml(p.title).trim() || 'Sans titre'

  const { nodes, edges } = useMemo(() => {
    const byTitle = new Map(pages.map((p) => [titleOf(p), p.id]))
    const edges: Edge[] = []
    const degree = new Map<string, number>()
    const bump = (id: string) => degree.set(id, (degree.get(id) ?? 0) + 1)
    for (const p of pages) {
      bump(p.id)
      if (p.parentId) {
        edges.push({ from: p.id, to: p.parentId })
      }
      for (const b of flattenBlocks(p.blocks)) {
        for (const m of mentionsIn(stripHtml(b.text))) {
          const target = byTitle.get(m)
          if (target && target !== p.id) {
            edges.push({ from: p.id, to: target })
            bump(target)
          }
        }
      }
    }
    const n = pages.length
    const nodes: Node[] = pages.map((p, i) => {
      const a = (2 * Math.PI * i) / Math.max(1, n)
      const R = 160
      return {
        id: p.id,
        label: titleOf(p),
        x: 400 + R * Math.cos(a),
        y: 300 + R * Math.sin(a),
        vx: 0,
        vy: 0,
        r: 10 + Math.min(14, (degree.get(p.id) ?? 1) * 3)
      }
    })
    return { nodes, edges }
  }, [pages])

  const [pos, setPos] = useState<Node[]>(nodes)
  const [zoom, setZoom] = useState(1)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPos(nodes)
  }, [nodes])

  useEffect(() => {
    let raf = 0
    const step = () => {
      setPos((cur) => {
        const next = cur.map((n) => ({ ...n }))
        const W = 800, H = 600, cx = W / 2, cy = H / 2
        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const a = next[i], b = next[j]
            let dx = a.x - b.x, dy = a.y - b.y
            let d2 = dx * dx + dy * dy
            if (d2 < 1) { d2 = 1; dx = Math.random() - 0.5; dy = Math.random() - 0.5 }
            const f = 4200 / d2
            const d = Math.sqrt(d2)
            const fx = (dx / d) * f, fy = (dy / d) * f
            a.vx += fx; a.vy += fy
            b.vx -= fx; b.vy -= fy
          }
        }
        for (const e of edges) {
          const a = next.find((n) => n.id === e.from)
          const b = next.find((n) => n.id === e.to)
          if (!a || !b) continue
          const dx = b.x - a.x, dy = b.y - a.y
          const d = Math.max(1, Math.sqrt(dx * dx + dy * dy))
          const f = (d - 90) * 0.02
          a.vx += (dx / d) * f; a.vy += (dy / d) * f
          b.vx -= (dx / d) * f; b.vy -= (dy / d) * f
        }
        for (const n of next) {
          n.vx += (cx - n.x) * 0.008
          n.vy += (cy - n.y) * 0.008
          n.vx *= 0.86
          n.vy *= 0.86
          n.x += n.vx
          n.y += n.vy
        }
        return next
      })
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [edges])

  const nodeById = useMemo(() => new Map(pos.map((n) => [n.id, n])), [pos])

  return (
    <div className="graph-overlay" ref={wrapRef}>
      <div className="graph-topbar">
        <strong>🕸 Graphe des pages</strong>
        <span className="db-type">{pos.length} nœuds · {edges.length} liens</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="db-btn" onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}>−</button>
          <button className="db-btn" onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}>＋</button>
          <button className="db-btn" onClick={onClose}>✕ Fermer</button>
        </div>
      </div>
      <svg className="graph-svg" viewBox="0 0 800 600">
        <g transform={`translate(400 300) scale(${zoom}) translate(-400 -300)`}>
          {edges.map((e, i) => {
            const a = nodeById.get(e.from)
            const b = nodeById.get(e.to)
            if (!a || !b) return null
            return <line key={i} className="graph-edge" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
          })}
          {pos.map((n) => (
            <g
              key={n.id}
              className={`graph-node${n.id === currentId ? ' current' : ''}`}
              onClick={() => onOpen(n.id)}
            >
              <circle cx={n.x} cy={n.y} r={n.r} />
              <text x={n.x} y={n.y + n.r + 13} textAnchor="middle">
                {n.label.length > 22 ? n.label.slice(0, 21) + '…' : n.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
      <p className="graph-hint">Clique sur un nœud pour ouvrir la page · les liens viennent des [[mentions]] et des sous-pages</p>
    </div>
  )
}
