import { describe, it, expect, vi } from 'vitest'
import { fetchLatestReading } from './liveReading.js'

function okResponse(json) {
  return { ok: true, json: async () => json }
}

const usgsBody = {
  value: {
    timeSeries: [
      {
        values: [
          {
            value: [
              { dateTime: '2026-09-24T10:00:00', value: '3.1' },
              { dateTime: '2026-09-24T10:15:00', value: '-999999' },
            ],
          },
        ],
      },
    ],
  },
}

describe('fetchLatestReading', () => {
  it('returns the most recent valid reading, skipping sentinels', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(usgsBody))
    const r = await fetchLatestReading('turbidity', fetchImpl)
    expect(r).toEqual({
      value: 3.1,
      unit: 'FNU',
      label: 'Turbidity',
      dateTime: '2026-09-24T10:00:00',
    })
  })

  it('returns null when the fetch rejects (offline)', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'))
    expect(await fetchLatestReading('turbidity', fetchImpl)).toBeNull()
  })

  it('returns null on a non-ok response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false })
    expect(await fetchLatestReading('flow', fetchImpl)).toBeNull()
  })

  it('returns null when the body has no usable values', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ value: { timeSeries: [] } }))
    expect(await fetchLatestReading('turbidity', fetchImpl)).toBeNull()
  })

  it('returns null for an unknown parameter', async () => {
    expect(await fetchLatestReading('nonsense', vi.fn())).toBeNull()
  })
})
