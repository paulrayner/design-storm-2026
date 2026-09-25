import { describe, it, expect } from 'vitest'
import { riverOutlook, thresholdFlag, MAP_HORIZONS } from './riverOutlook.js'
import { buildForecast } from './forecast.js'
import { DEFAULT_THRESHOLDS } from './recommend.js'

function isoDates(start, n) {
  const out = []
  let d = new Date(start + 'T00:00:00Z')
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 10))
    d = new Date(d.getTime() + 86400000)
  }
  return out
}

function makeSeries() {
  const dates = isoDates('2026-04-01', 120)
  const mk = (fn) => dates.map((t, i) => ({ t, v: fn(i) }))
  return {
    // TOC follows turbidity from two days earlier, so the 2-day model has a real
    // positive slope to find.
    toc: mk((i) => 1.5 + 0.5 * (1 + (((i - 2) % 9) + 9) % 9 * 0.5)),
    alk: mk((i) => 70 - (i % 7) * 3),
    turbidity: mk((i) => 1 + (i % 9) * 0.5),
    flow: mk(() => 100),
    conductance: mk((i) => 320 - (i % 7) * 6),
    swe: mk(() => 0),
  }
}

const resolvedWith = (turbFlow, conductance) => ({
  turb_flow: { value: turbFlow, source: 'live' },
  conductance: { value: conductance, source: 'live' },
  swe: { value: 3.2, source: 'live' },
  flow: { value: 410, source: 'bundled', dateTime: '2026-07-29' },
})

describe('riverOutlook', () => {
  const series = makeSeries()
  const today = '2026-09-25'

  it('shows the same numbers as the Live forecast tab for the same horizons', () => {
    // Operators will flip between tabs; two different numbers for one day would
    // destroy trust in both.
    const o = riverOutlook(series, resolvedWith(450, 300), DEFAULT_THRESHOLDS, today)
    const liveToc = buildForecast(series, 'toc', 'turb_flow', 450, { today }).points
    const liveAlk = buildForecast(series, 'alk', 'conductance', 300, { today }).points
    for (const stop of o.ahead) {
      expect(stop.toc.predicted).toBeCloseTo(liveToc.find((p) => p.horizon === stop.horizon).predicted, 9)
      expect(stop.alk.predicted).toBeCloseTo(liveAlk.find((p) => p.horizon === stop.horizon).predicted, 9)
    }
  })

  it('stops at 2 and then 4 days out, nearest first, so the map reads left to right in time', () => {
    const o = riverOutlook(series, resolvedWith(450, 300), DEFAULT_THRESHOLDS, today)
    expect(o.ahead.map((s) => s.horizon)).toEqual(MAP_HORIZONS)
    expect(o.ahead.map((s) => s.toc.date)).toEqual(['2026-09-27', '2026-09-29'])
  })

  it('flags a forecast that crosses the operating threshold', () => {
    const high = riverOutlook(series, resolvedWith(10000, 300), DEFAULT_THRESHOLDS, today)
    expect(high.ahead[0].toc.flag).toEqual({ tier: 'act', line: 3 })
    const low = riverOutlook(series, resolvedWith(100, 300), DEFAULT_THRESHOLDS, today)
    expect(low.ahead[0].toc.flag).toBeNull()
  })

  it('names the most serious alkalinity line crossed, as the Live tab does', () => {
    const t = DEFAULT_THRESHOLDS.alk
    expect(thresholdFlag(65, t)).toBeNull()
    expect(thresholdFlag(58, t)).toEqual({ tier: 'watch', line: 60 })
    expect(thresholdFlag(48, t)).toEqual({ tier: 'act', line: 50 })
  })

  it('estimates today from a same-day model and keeps the last lab result separate', () => {
    const o = riverOutlook(series, resolvedWith(450, 300), DEFAULT_THRESHOLDS, today)
    expect(o.today.estimate.toc.date).toBe(today)
    expect(o.today.lastLab).toEqual({ t: '2026-07-29', toc: series.toc.at(-1).v, alk: series.alk.at(-1).v })
  })

  it('says nothing rather than guessing when a reading is missing', () => {
    const o = riverOutlook(series, resolvedWith(null, null), DEFAULT_THRESHOLDS, today)
    expect(o.ahead[0].toc).toBeNull()
    expect(o.today.estimate.alk).toBeNull()
  })
})
