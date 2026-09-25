import { describe, it, expect } from 'vitest'
import { indexByDate, alignByDate } from './dataLayer.js'

describe('indexByDate', () => {
  it('maps dates to values', () => {
    const m = indexByDate([
      { t: '2022-04-01', v: 1.1 },
      { t: '2022-04-02', v: 2.2 },
    ])
    expect(m.get('2022-04-01')).toBe(1.1)
    expect(m.get('2022-04-02')).toBe(2.2)
    expect(m.has('2022-04-03')).toBe(false)
  })
})

describe('alignByDate', () => {
  it('aligns two series on the union of dates, sorted', () => {
    const seriesByName = {
      a: [
        { t: '2022-04-01', v: 10 },
        { t: '2022-04-03', v: 30 },
      ],
      b: [
        { t: '2022-04-02', v: 200 },
        { t: '2022-04-03', v: 300 },
      ],
    }
    const { dates, rows } = alignByDate(seriesByName, ['a', 'b'])
    expect(dates).toEqual(['2022-04-01', '2022-04-02', '2022-04-03'])
    expect(rows).toEqual([
      { t: '2022-04-01', a: 10, b: null },
      { t: '2022-04-02', a: null, b: 200 },
      { t: '2022-04-03', a: 30, b: 300 },
    ])
  })

  it('keeps missing days as null gaps, never zero', () => {
    const seriesByName = {
      a: [
        { t: '2022-04-01', v: 5 },
        { t: '2022-04-04', v: 8 },
      ],
    }
    const { dates, rows } = alignByDate(seriesByName, ['a'])
    // Only dates that actually appear are on the axis; there is no fabricated
    // 04-02/04-03 row and no zero-fill.
    expect(dates).toEqual(['2022-04-01', '2022-04-04'])
    expect(rows.every((r) => r.a !== 0)).toBe(true)
  })

  it('handles a requested series that is absent from the data', () => {
    const { rows } = alignByDate({ a: [{ t: '2022-04-01', v: 1 }] }, ['a', 'missing'])
    expect(rows[0]).toEqual({ t: '2022-04-01', a: 1, missing: null })
  })
})
