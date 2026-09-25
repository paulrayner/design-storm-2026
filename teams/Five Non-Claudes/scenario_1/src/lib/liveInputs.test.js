import { describe, it, expect, vi } from 'vitest'
import { fetchUsgsLatest, fetchSnotelLatest, fetchLiveInputs } from './liveInputs.js'

const usgsBody = (vals) => ({
  ok: true,
  json: async () => ({ value: { timeSeries: [{ values: [{ value: vals }] }] } }),
})
const snotelBody = (vals) => ({
  ok: true,
  json: async () => [{ data: [{ values: vals }] }],
})

describe('fetchUsgsLatest', () => {
  it('returns the last valid reading, skipping sentinels', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      usgsBody([
        { dateTime: '2026-09-25T08:00:00', value: '4.0' },
        { dateTime: '2026-09-25T09:00:00', value: '-999999' },
      ]),
    )
    expect(await fetchUsgsLatest('06707525', '63680', fetchImpl)).toEqual({
      value: 4.0,
      dateTime: '2026-09-25T08:00:00',
    })
  })

  it('returns null when offline', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'))
    expect(await fetchUsgsLatest('06707525', '63680', fetchImpl)).toBeNull()
  })
})

describe('fetchSnotelLatest', () => {
  it('returns the last non-null daily value', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      snotelBody([
        { date: '2026-09-23', value: 0.2 },
        { date: '2026-09-24', value: null },
      ]),
    )
    expect(await fetchSnotelLatest('531:CO:SNTL', 'WTEQ', fetchImpl)).toEqual({
      value: 0.2,
      dateTime: '2026-09-23',
    })
  })
})

describe('fetchLiveInputs', () => {
  it('assembles all signals and derives turb_flow when live', async () => {
    const fetchImpl = vi.fn((url) => {
      if (url.includes('63680')) return Promise.resolve(usgsBody([{ dateTime: 'T', value: '5' }]))
      if (url.includes('00095')) return Promise.resolve(usgsBody([{ dateTime: 'T', value: '300' }]))
      if (url.includes('00060')) return Promise.resolve(usgsBody([{ dateTime: 'T', value: '100' }]))
      if (url.includes('awdbRestApi')) return Promise.resolve(snotelBody([{ date: 'D', value: 1.2 }]))
      return Promise.resolve({ ok: false })
    })
    const inputs = await fetchLiveInputs(fetchImpl)
    expect(inputs.turbidity).toEqual({ value: 5, dateTime: 'T', live: true })
    expect(inputs.flow.value).toBe(100)
    expect(inputs.conductance.value).toBe(300)
    expect(inputs.swe.value).toBe(1.2)
    expect(inputs.turb_flow).toEqual({ value: 500, dateTime: 'T', live: true })
  })

  it('marks signals not-live and turb_flow null when every fetch fails', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'))
    const inputs = await fetchLiveInputs(fetchImpl)
    expect(inputs.turbidity.live).toBe(false)
    expect(inputs.turb_flow.live).toBe(false)
    expect(inputs.turb_flow.value).toBeNull()
  })
})
