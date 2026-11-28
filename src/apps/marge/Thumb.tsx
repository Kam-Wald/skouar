import { useEffect, useRef } from 'react'
import { loadDoc } from './pdf'
import type { MargeDoc } from './store'

export default function DocThumb({ doc, width = 120 }: { doc: MargeDoc; width?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let alive = true
    void doc.data
      .arrayBuffer()
      .then(async (buf) => {
        try {
          const d = await loadDoc(buf)
          const p = await d.getPage(1)
          const base = p.getViewport({ scale: 1 }).width
          const vp = p.getViewport({ scale: width / base })
          const c = ref.current
          if (!c || !alive) return
          c.width = vp.width
          c.height = vp.height
          await p.render({ canvasContext: c.getContext('2d') as CanvasRenderingContext2D, viewport: vp }).promise
          await d.destroy()
        } catch {
          if (!alive) return
        }
      })
    return () => {
      alive = false
    }
  }, [doc.id, width])
  return <canvas ref={ref} className="marge-thumb-cv" />
}
