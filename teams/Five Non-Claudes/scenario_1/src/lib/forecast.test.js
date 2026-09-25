import { describe, it, expect } from 'vitest'
import { buildForecast } from './forecast.js'

function isoDates(start, n) {
  const out = []
  let d = new Date(start + 'T00:00:00Z')
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 10))
    d = new Date(d.getTime() + 86400000)
  }
  return out
}

describe('buildForecast', () => {
  const dates = isoDates('2022-04-01', 120)
  // A clean linear relationship so predictions are checkable: toc = 2 + 0.01*turb_flow,
  // with turbidity ramping and flow constant.
  const series = {
    toc: dates.map((t, i) => ({ t, v: 2 + 0.01 * (100 + i) * 10 })),
    turbidity: dates.map((t, i) => ({ t, v: 100 + i })),
    flow: dates.map((t) => ({ t, v: 10 })),
  }

  it('produces one point per horizon with a future date', () => {
    const fc = buildForecast(series, 'toc', 'turb_flow', 1500, {
      today: '2022-08-01',
      horizons: [1, 2, 3],
    })
    expect(fc.points.map((p) => p.horizon)).toEqual([1, 2, 3])
    expect(fc.points[0].date).toBe('2022-08-02')
    expect(fc.points[2].date).toBe('2022-08-04')
    // Each point carries a prediction and a score.
    for (const p of fc.points) {
      expect(Number.isFinite(p.predicted)).toBe(true)
      expect(Number.isFinite(p.rmse)).toBe(true)
    }
  })

  it('applies the fitted line to the current value', () => {
    // Feature perfectly linear with target; predicting at a known x should recover
    // 2 + 0.01*x (the generating relationship), within fit tolerance.
    const fc = buildForecast(series, 'toc', 'turb_flow', 1500, {
      today: '2022-08-01',
      horizons: [1],
    })
    // Within ~0.5 of the generating relationship; the lag-1 shift drops one
    // boundary pair, which nudges the fitted intercept slightly.
    expect(fc.points[0].predicted).toBeCloseTo(2 + 0.01 * 1500, 0)
  })

  it('returns no points when the current value is missing', () => {
    const fc = buildForecast(series, 'toc', 'turb_flow', null, { horizons: [1, 2] })
    expect(fc.points).toEqual([])
  })

  it('skips horizons with too little data', () => {
    const tiny = {
      toc: [{ t: '2022-04-05', v: 2.5 }],
      turbidity: [{ t: '2022-04-01', v: 2 }],
      flow: [{ t: '2022-04-01', v: 100 }],
    }
    const fc = buildForecast(tiny, 'toc', 'turb_flow', 200, { horizons: [1, 2, 3] })
    expect(fc.points).toEqual([])
  })
})
