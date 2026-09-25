import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import LiveForecast from './LiveForecast.jsx'

function isoDates(start, n) {
  const out = []
  let d = new Date(start + 'T00:00:00Z')
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 10))
    d = new Date(d.getTime() + 86400000)
  }
  return out
}

function makeDoc() {
  const dates = isoDates('2026-04-01', 120)
  const mk = (fn) => dates.map((t, i) => ({ t, v: fn(i) }))
  return {
    _meta: { units: { toc: 'mg/L', alk: 'mg/L' } },
    series: {
      toc: mk((i) => 2 + i * 0.005),
      alk: mk((i) => 62 - i * 0.02),
      turbidity: mk((i) => 1 + i * 0.03),
      flow: mk(() => 100),
      conductance: mk((i) => 300 - i * 0.1),
      swe: mk((i) => Math.max(0, 12 - i * 0.1)),
    },
  }
}

const usgs = (v) => ({ ok: true, json: async () => ({ value: { timeSeries: [{ values: [{ value: [{ dateTime: '2026-09-25T09:00', value: String(v) }] }] }] } }) })
const snotel = (v) => ({ ok: true, json: async () => [{ data: [{ values: [{ date: '2026-09-24', value: v }] }] }] })

describe('LiveForecast', () => {
  it('renders recommendation, current inputs and forecasts from a live feed', async () => {
    const fetchImpl = vi.fn((url) => {
      if (url.includes('63680')) return Promise.resolve(usgs(4.2))
      if (url.includes('00095')) return Promise.resolve(usgs(287))
      if (url.includes('00060')) return Promise.resolve(usgs(81.5))
      if (url.includes('awdbRestApi')) return Promise.resolve(snotel(0.1))
      return Promise.resolve({ ok: false })
    })
    render(<LiveForecast doc={makeDoc()} fetchImpl={fetchImpl} />)

    await waitFor(() =>
      expect(screen.getByTestId('current-inputs').textContent).toMatch(/live feed/i),
    )
    expect(screen.getByTestId('reco-card')).toBeInTheDocument()
    // Both target messages appear.
    expect(screen.getByTestId('reco-toc').textContent).toMatch(/TOC/i)
    expect(screen.getByTestId('reco-alk').textContent).toMatch(/alkalinity/i)
  })

  it('falls back to bundled values when the live feed fails', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'))
    render(<LiveForecast doc={makeDoc()} fetchImpl={fetchImpl} />)

    await waitFor(() =>
      expect(screen.getByTestId('current-inputs').textContent).toMatch(/offline/i),
    )
    // Still produces a recommendation from the fallback inputs.
    expect(screen.getByTestId('reco-card')).toBeInTheDocument()
  })
})
