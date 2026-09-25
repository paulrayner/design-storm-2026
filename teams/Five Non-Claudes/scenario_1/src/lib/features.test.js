import { describe, it, expect } from 'vitest'
import { shift, turbFlow, pairedDataset } from './features.js'

describe('shift', () => {
  it('relabels a reading forward by nDays', () => {
    const s = [
      { t: '2022-04-01', v: 10 },
      { t: '2022-04-02', v: 20 },
    ]
    const out = shift(s, 2)
    // The 04-01 reading now lands on 04-03; 04-02 lands on 04-04.
    expect(out).toEqual([
      { t: '2022-04-03', v: 10 },
      { t: '2022-04-04', v: 20 },
    ])
  })

  it('crosses month boundaries correctly', () => {
    expect(shift([{ t: '2022-04-30', v: 1 }], 2)).toEqual([{ t: '2022-05-02', v: 1 }])
  })

  it('nDays=0 is a copy, not the same reference', () => {
    const s = [{ t: '2022-04-01', v: 5 }]
    const out = shift(s, 0)
    expect(out).toEqual(s)
    expect(out[0]).not.toBe(s[0])
  })
})

describe('turbFlow', () => {
  it('multiplies turbidity by flow on shared dates only', () => {
    const turb = [
      { t: '2022-04-01', v: 2 },
      { t: '2022-04-02', v: 3 },
      { t: '2022-04-03', v: 4 },
    ]
    const flow = [
      { t: '2022-04-01', v: 100 },
      { t: '2022-04-03', v: 50 },
    ]
    expect(turbFlow(turb, flow)).toEqual([
      { t: '2022-04-01', v: 200 },
      { t: '2022-04-03', v: 200 },
    ])
  })
})

describe('pairedDataset', () => {
  const series = {
    toc: [
      { t: '2022-04-03', v: 2.5 },
      { t: '2022-04-04', v: 2.6 },
      { t: '2022-04-05', v: 2.7 },
    ],
    turbidity: [
      { t: '2022-04-01', v: 2 },
      { t: '2022-04-02', v: 3 },
      { t: '2022-04-03', v: 4 },
    ],
    flow: [
      { t: '2022-04-01', v: 100 },
      { t: '2022-04-02', v: 100 },
      { t: '2022-04-03', v: 100 },
    ],
  }

  it('pairs the lagged feature with the target on the same date', () => {
    // turb_flow: 04-01=200, 04-02=300, 04-03=400. Shift by 2 -> 04-03=200,
    // 04-04=300, 04-05=400. Join to toc on those dates.
    const pairs = pairedDataset(series, 'toc', 'turb_flow', 2)
    expect(pairs).toEqual([
      { t: '2022-04-03', x: 200, y: 2.5 },
      { t: '2022-04-04', x: 300, y: 2.6 },
      { t: '2022-04-05', x: 400, y: 2.7 },
    ])
  })

  it('drops pairs where one side is missing', () => {
    // At lag 0, turb_flow exists 04-01..04-03 but toc only 04-03..04-05, so only
    // 04-03 overlaps.
    const pairs = pairedDataset(series, 'toc', 'turb_flow', 0)
    expect(pairs).toEqual([{ t: '2022-04-03', x: 400, y: 2.5 }])
  })

  it('different lags produce different pairings', () => {
    const lag1 = pairedDataset(series, 'toc', 'turb_flow', 1)
    const lag2 = pairedDataset(series, 'toc', 'turb_flow', 2)
    expect(lag1).not.toEqual(lag2)
  })

  it('pairs a sonde feature against the target', () => {
    const withSonde = {
      ...series,
      sonde_turbidity: [
        { t: '2022-04-01', v: 5 },
        { t: '2022-04-02', v: 6 },
        { t: '2022-04-03', v: 7 },
      ],
    }
    // lag 0: sonde 04-03=7 overlaps toc 04-03.
    const pairs = pairedDataset(withSonde, 'toc', 'sonde_turbidity', 0)
    expect(pairs).toEqual([{ t: '2022-04-03', x: 7, y: 2.5 }])
  })

  it('a sonde feature with no data yields no pairs', () => {
    const pairs = pairedDataset(series, 'toc', 'sonde_turbidity', 0)
    expect(pairs).toEqual([])
  })
})
