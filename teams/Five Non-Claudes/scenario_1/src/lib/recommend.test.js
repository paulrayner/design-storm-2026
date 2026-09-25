import { describe, it, expect } from 'vitest'
import { breaches, assess, assessBanded, trend, DEFAULT_THRESHOLDS } from './recommend.js'

describe('breaches', () => {
  it('handles above and below directions', () => {
    expect(breaches(3.2, 3, 'above')).toBe(true)
    expect(breaches(2.8, 3, 'above')).toBe(false)
    expect(breaches(58, 60, 'below')).toBe(true)
    expect(breaches(62, 60, 'below')).toBe(false)
  })
})

const toc = DEFAULT_THRESHOLDS.toc
const alk = DEFAULT_THRESHOLDS.alk

describe('assess (TOC, above)', () => {
  it('reports a breach and its lead time', () => {
    const points = [
      { horizon: 1, date: '2026-09-26', predicted: 2.7 },
      { horizon: 2, date: '2026-09-27', predicted: 2.9 },
      { horizon: 3, date: '2026-09-28', predicted: 3.2 },
    ]
    const r = assess(points, toc)
    expect(r.level).toBe('approaching')
    expect(r.firstBreachHorizon).toBe(3)
    expect(r.message).toMatch(/crosses above the 3 threshold/)
    expect(r.message).toContain('2026-09-28')
  })

  it('flags a near-term breach as breach level', () => {
    const points = [
      { horizon: 1, date: '2026-09-26', predicted: 3.5 },
      { horizon: 2, date: '2026-09-27', predicted: 3.6 },
    ]
    expect(assess(points, toc).level).toBe('breach')
  })

  it('reports clear when nothing breaches', () => {
    const points = [
      { horizon: 1, date: '2026-09-26', predicted: 2.4 },
      { horizon: 2, date: '2026-09-27', predicted: 2.5 },
    ]
    const r = assess(points, toc)
    expect(r.level).toBe('clear')
    expect(r.firstBreachHorizon).toBeNull()
    expect(r.message).toMatch(/stays below the 3 threshold/)
  })
})

describe('assessBanded (alkalinity, two-tier below)', () => {
  it('has watch=60 and act=50 defaults', () => {
    expect(alk.watch).toBe(60)
    expect(alk.act).toBe(50)
    expect(alk.direction).toBe('below')
  })

  it('watch level when it dips below 60 but stays above 50', () => {
    const points = [
      { horizon: 1, date: '2026-09-26', predicted: 64 },
      { horizon: 2, date: '2026-09-27', predicted: 58 },
      { horizon: 3, date: '2026-09-28', predicted: 55 },
    ]
    const r = assessBanded(points, alk)
    expect(r.level).toBe('approaching')
    expect(r.firstBreachHorizon).toBe(2)
    expect(r.message).toMatch(/crosses below the 60 watch line/)
    expect(r.message).toMatch(/above the 50 act line/)
  })

  it('breach level (act) when it drops below 50, regardless of how soon', () => {
    const points = [
      { horizon: 1, date: '2026-09-26', predicted: 58 },
      { horizon: 2, date: '2026-09-27', predicted: 54 },
      { horizon: 3, date: '2026-09-28', predicted: 48 },
    ]
    const r = assessBanded(points, alk)
    expect(r.level).toBe('breach')
    // firstBreachHorizon points to the act-line crossing.
    expect(r.firstBreachHorizon).toBe(3)
    expect(r.message).toMatch(/crosses below the 50 act line/)
    expect(r.message).toMatch(/Treatability drops sharply below 50/)
  })

  it('clear when it stays above the watch line', () => {
    const points = [
      { horizon: 1, date: '2026-09-26', predicted: 66 },
      { horizon: 2, date: '2026-09-27', predicted: 63 },
    ]
    const r = assessBanded(points, alk)
    expect(r.level).toBe('clear')
    expect(r.firstBreachHorizon).toBeNull()
    expect(r.message).toMatch(/stays above the 60 watch line/)
  })

  it('handles an empty forecast', () => {
    expect(assessBanded([], alk).message).toMatch(/No forecast/)
  })
})

it('handles an empty forecast (single threshold)', () => {
  expect(assess([], toc).message).toMatch(/No forecast/)
})

describe('trend', () => {
  const pts = (...vs) => vs.map((v, i) => ({ horizon: i + 1, date: `2026-09-${26 + i}`, predicted: v }))

  it('reports direction from the first horizon to the last', () => {
    expect(trend(pts(61, 60, 58.7))).toEqual({ dir: 'down', from: 61, to: 58.7 })
    expect(trend(pts(2.6, 2.7, 2.9)).dir).toBe('up')
  })

  it('calls a sub-1% wobble flat, so noise does not draw an arrow', () => {
    expect(trend(pts(60, 60.4, 60.3)).dir).toBe('flat')
  })

  it('has nothing to say without at least two points', () => {
    expect(trend(pts(3))).toBeNull()
  })
})
