import { describe, it, expect } from 'vitest'
import { compareSources } from './compareSources.js'

function isoDates(start, n) {
  const out = []
  let d = new Date(start + 'T00:00:00Z')
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 10))
    d = new Date(d.getTime() + 86400000)
  }
  return out
}

describe('compareSources', () => {
  it('scores both sources when each has data', () => {
    const dates = isoDates('2026-04-07', 60)
    const mk = (fn) => dates.map((t, i) => ({ t, v: fn(i) }))
    const series = {
      toc: mk((i) => 2 + i * 0.02),
      turbidity: mk((i) => 1 + i * 0.05),
      flow: mk(() => 100),
      sonde_turbidity: mk((i) => 3 + i * 0.04),
    }
    const cmp = compareSources(series, 'toc')
    expect(cmp.upstream).not.toBeNull()
    expect(cmp.sonde).not.toBeNull()
    expect(cmp.upstream.leadTime).toMatch(/day/)
    expect(cmp.sonde.leadTime).toMatch(/hour/)
    expect(cmp.sonde.n).toBeGreaterThan(0)
  })

  it('returns null for a source with no matched days', () => {
    const dates = isoDates('2026-04-07', 30)
    const mk = (fn) => dates.map((t, i) => ({ t, v: fn(i) }))
    const series = {
      toc: mk((i) => 2 + i * 0.02),
      turbidity: mk((i) => 1 + i * 0.05),
      flow: mk(() => 100),
      // no sonde_turbidity at all
    }
    const cmp = compareSources(series, 'toc')
    expect(cmp.upstream).not.toBeNull()
    expect(cmp.sonde).toBeNull()
  })
})
