import { describe, it, expect } from 'vitest'
import { bandAt, clearestLayer, murkyLayer, GATES, PRIMARY_GATE, gateBand, primaryGateCheck, profileAgeDays } from './sondeProfile.js'

const band = (top, med) => ({ top, bottom: top + 2, turbidity: [med * 0.8, med, med * 1.5] })
// Shaped like the sonde's last week: clear at the top, a murky plume mid-column,
// then middling water to the bottom.
const plume = [band(0, 1.2), band(2, 1.1), band(4, 1.6), band(6, 2.8), band(8, 4.1), band(10, 4.3), band(12, 2.5), band(14, 1.8), band(16, 1.9)]

describe('sondeProfile', () => {
  it('finds the band a depth falls in, and clamps past the bottom', () => {
    expect(bandAt(plume, 0).top).toBe(0)
    expect(bandAt(plume, 9.5).top).toBe(8)
    expect(bandAt(plume, 99).top).toBe(16)
  })

  it('suggests the clearest stretch, not just its single best band', () => {
    // 0-2 m is within cast-to-cast noise of 2-4 m, so both are offered; 4-6 m is not.
    expect(clearestLayer(plume)).toEqual({ top: 0, bottom: 4, turbidity: 1.1 })
  })

  it('names the murky layer to avoid', () => {
    expect(murkyLayer(plume)).toEqual({ top: 6, bottom: 14, peak: 4.3 })
  })

  it('names no murky layer when the column is fairly even', () => {
    const even = [band(0, 1.5), band(2, 1.4), band(4, 1.9), band(6, 1.6)]
    expect(murkyLayer(even)).toBeNull()
  })
})

describe('intake gates', () => {
  // 2 m bands down to 30 m. The 45 ft gate (13.7 m) draws from the 12-14 m band.
  const column = (murkyAt45) =>
    Array.from({ length: 15 }, (_, i) => band(i * 2, i * 2 >= 10 && i * 2 < 16 ? (murkyAt45 ? 4.5 : 1.6) : 1.2 + i * 0.02))

  it('reads each gate from the band at its depth', () => {
    expect(gateBand(column(true), PRIMARY_GATE).top).toBe(12)
    expect(gateBand(column(true), GATES.find((g) => g.id === '95')).top).toBe(28)
  })

  it('flags the primary gate when it sits in the murky layer, and names the clearest gate', () => {
    const c = primaryGateCheck(column(true))
    expect(c.murky).toBe(true)
    expect(c.turbidity).toBe(4.5)
    expect(c.clearest.id).toBe('top')
  })

  it('does not flag the primary gate on an ordinary week', () => {
    // Slightly murkier than the top, but not a murky layer: 45 ft is their choice
    // for reasons beyond turbidity, so a small difference is not worth raising.
    expect(primaryGateCheck(column(false)).murky).toBe(false)
  })
})

describe('profile age', () => {
  it('counts calendar days from the last cast, so an old week is not shown as today', () => {
    const profile = { from: '2026-08-12', to: '2026-08-19' }
    expect(profileAgeDays(profile, new Date(2026, 8, 25, 11))).toBe(37)
    expect(profileAgeDays(profile, new Date(2026, 7, 19, 23))).toBe(0)
  })
})
