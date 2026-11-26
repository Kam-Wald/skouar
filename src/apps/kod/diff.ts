export interface DiffRow {
  type: 'same' | 'del' | 'add'
  a: number
  b: number
  text: string
}

export function diffLines(a: string, b: string): DiffRow[] {
  const A = a.split('\n')
  const B = b.split('\n')
  const n = A.length
  const m = B.length
  const out: DiffRow[] = []
  if (!a && !b) return out
  if (n * m > 2_000_000) {
    A.forEach((t, i) => out.push({ type: 'del', a: i + 1, b: 0, text: t }))
    B.forEach((t, i) => out.push({ type: 'add', a: 0, b: i + 1, text: t }))
    return out
  }
  const w = m + 1
  const dp = new Uint32Array((n + 1) * w)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] = A[i] === B[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1])
    }
  }
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      out.push({ type: 'same', a: i + 1, b: j + 1, text: A[i] })
      i++
      j++
    } else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) {
      out.push({ type: 'del', a: i + 1, b: 0, text: A[i] })
      i++
    } else {
      out.push({ type: 'add', a: 0, b: j + 1, text: B[j] })
      j++
    }
  }
  while (i < n) {
    out.push({ type: 'del', a: i + 1, b: 0, text: A[i] })
    i++
  }
  while (j < m) {
    out.push({ type: 'add', a: 0, b: j + 1, text: B[j] })
    j++
  }
  return out
}
