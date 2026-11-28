import { niceFloor, niceScale, type ChartData, type ChartType } from './logic'

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0ea5e9', '#db2777', '#0d9488']

const fmtTick = (n: number): string => {
  if (Math.abs(n) >= 1000) return n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
  return String(parseFloat(n.toPrecision(10)))
}

export default function ChartView({ data, type, title, w, h }: { data: ChartData; type: ChartType; title: string; w: number; h: number }): JSX.Element {
  const padL = 46
  const padR = 10
  const padT = title ? 24 : 8
  const padB = 34
  const iw = Math.max(10, w - padL - padR)
  const ih = Math.max(10, h - padT - padB)
  const all = data.series.flatMap((s) => s.values)
  const maxV = Math.max(0, ...all)
  const minV = Math.min(0, ...all)
  const { max: yMax, step } = niceScale(maxV === 0 ? 1 : maxV)
  const { min: yMin } = niceFloor(minV)
  const yRange = yMax - yMin || 1
  const x = (i: number): number => (data.labels.length <= 1 ? padL + iw / 2 : padL + (i / (data.labels.length - 1)) * iw)
  const y = (v: number): number => padT + ih - ((v - yMin) / yRange) * ih

  const legend = (
    <div className="taol-chart-legend">
      {data.series.map((s, i) => (
        <span key={i} className="taol-chart-legend-item" title={s.name}>
          <span className="taol-chart-dot" style={{ background: COLORS[i % COLORS.length] }} />
          {s.name}
        </span>
      ))}
    </div>
  )

  let body: JSX.Element
  if (type === 'pie') {
    const values = data.series[0]?.values ?? []
    const total = values.reduce((a, b) => a + Math.abs(b), 0)
    const cx = padL + iw / 2
    const cy = padT + ih / 2
    const r = Math.min(iw, ih) / 2 - 4
    let angle = -Math.PI / 2
    const slices = values.map((v, i) => {
      const frac = total > 0 ? Math.abs(v) / total : 0
      const a0 = angle
      const a1 = angle + frac * Math.PI * 2
      angle = a1
      const large = frac > 0.5 ? 1 : 0
      const p = (a: number): string => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
      const d = frac >= 0.9999 ? `M ${cx} ${cy} L ${p(a0)} A ${r} ${r} 0 1 1 ${p(a1 - 0.0001)} Z` : `M ${cx} ${cy} L ${p(a0)} A ${r} ${r} 0 ${large} 1 ${p(a1)} Z`
      return <path key={i} d={d} fill={COLORS[i % COLORS.length]} stroke="var(--bg)" strokeWidth={1} />
    })
    body = (
      <svg width={w} height={h - padT + padT} viewBox={`0 0 ${w} ${h}`} className="taol-chart-svg">
        {slices}
      </svg>
    )
  } else {
    const n = data.labels.length
    const xStep = n > 8 ? Math.ceil(n / 8) : 1
    const ticks: number[] = []
    for (let v = yMin; v <= yMax + 1e-9; v += step) ticks.push(parseFloat(v.toPrecision(12)))
    const bars = type === 'bar'
    const groupW = n > 0 ? iw / n : iw
    const barW = Math.max(2, (groupW * 0.8) / Math.max(1, data.series.length))
    body = (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="taol-chart-svg">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={padL + iw} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={t === 0 ? 1.5 : 0.5} />
            <text x={padL - 4} y={y(t) + 3} textAnchor="end" className="taol-chart-tick">
              {fmtTick(t)}
            </text>
          </g>
        ))}
        {data.labels.map((lb, i) =>
          i % xStep === 0 ? (
            <text key={i} x={x(i)} y={padT + ih + 12} textAnchor="middle" className="taol-chart-tick">
              {lb.length > 10 ? lb.slice(0, 9) + '…' : lb}
            </text>
          ) : null
        )}
        {bars
          ? data.series.map((s, si) =>
              s.values.map((v, i) => (
                <rect
                  key={`${si}-${i}`}
                  x={x(i) - (data.series.length * barW) / 2 + si * barW}
                  y={y(Math.max(0, v))}
                  width={barW - 1}
                  height={Math.max(0, y(Math.min(0, v)) - y(Math.max(0, v)))}
                  fill={COLORS[si % COLORS.length]}
                />
              ))
            )
          : data.series.map((s, si) => (
              <g key={si}>
                <polyline
                  points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
                  fill="none"
                  stroke={COLORS[si % COLORS.length]}
                  strokeWidth={2}
                />
                {s.values.map((v, i) => (
                  <circle key={i} cx={x(i)} cy={y(v)} r={2.2} fill={COLORS[si % COLORS.length]} />
                ))}
              </g>
            ))}
      </svg>
    )
  }

  return (
    <div className="taol-chart-body" style={{ width: w, height: h }}>
      {title && <p className="taol-chart-title">{title}</p>}
      {type === 'pie' ? (
        <div className="taol-chart-pie-wrap">
          {body}
          {legend}
        </div>
      ) : (
        <>
          {legend}
          {body}
        </>
      )}
    </div>
  )
}
