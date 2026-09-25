import { describe, it, expect } from 'vitest'
import { resolveCurrent, resolveCurrentTurbFlow } from './currentInput.js'

describe('resolveCurrent', () => {
  it('prefers a live reading', () => {
    const r = resolveCurrent(
      { value: 4.2, dateTime: '2026-09-25T09:00', live: true },
      [{ t: '2026-08-19', v: 2.1 }],
    )
    expect(r).toEqual({ value: 4.2, dateTime: '2026-09-25T09:00', source: 'live' })
  })

  it('falls back to the last bundled value when not live', () => {
    const r = resolveCurrent(
      { value: null, dateTime: null, live: false },
      [{ t: '2026-08-18', v: 2.0 }, { t: '2026-08-19', v: 2.1 }],
    )
    expect(r).toEqual({ value: 2.1, dateTime: '2026-08-19', source: 'bundled' })
  })

  it('reports none when neither is available', () => {
    expect(resolveCurrent(undefined, []).source).toBe('none')
  })
})

describe('resolveCurrentTurbFlow', () => {
  it('uses live turb_flow when present', () => {
    const r = resolveCurrentTurbFlow(
      { turb_flow: { value: 500, dateTime: 'T', live: true } },
      {},
    )
    expect(r).toEqual({ value: 500, dateTime: 'T', source: 'live' })
  })

  it('falls back to last bundled turbidity*flow', () => {
    const r = resolveCurrentTurbFlow(
      { turb_flow: { value: null, live: false } },
      {
        turbidity: [{ t: '2026-08-19', v: 2 }],
        flow: [{ t: '2026-08-19', v: 100 }],
      },
    )
    expect(r).toEqual({ value: 200, dateTime: '2026-08-19', source: 'bundled' })
  })
})
