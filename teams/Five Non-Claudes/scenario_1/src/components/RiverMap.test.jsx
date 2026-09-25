import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import RiverMap from './RiverMap.jsx'

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
      toc: mk((i) => 2 + (i % 9) * 0.3),
      alk: mk((i) => 70 - (i % 7) * 3),
      turbidity: mk((i) => 1 + (i % 9) * 0.5),
      flow: mk(() => 100),
      conductance: mk((i) => 320 - (i % 7) * 6),
      swe: mk(() => 0),
    },
  }
}

describe('RiverMap', () => {
  it('shows four numbered stops and the map, even with every feed offline', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error('offline')))
    render(<RiverMap doc={makeDoc()} fetchImpl={fetchImpl} />)
    await waitFor(() => expect(screen.queryByText(/Fetching current upstream/)).toBeNull())

    // Today first, the earliest warning (headwaters snow) last.
    const headings = screen.getAllByRole('article').map((a) => within(a).getByRole('heading').textContent)
    expect(headings).toEqual(['Foothills Plant', 'Arriving at the plant', 'Arriving at the plant', 'Headwaters'])
    expect(screen.getByRole('heading', { name: 'Headwaters' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Foothills Plant' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Map of the South Platte basin/ })).toBeInTheDocument()
    // Offline readings are labelled as archived, never passed off as live.
    const early = screen.getByRole('article', { name: 'Headwaters' })
    expect(within(early).getAllByText(/archived/).length).toBeGreaterThan(0)
  })

  it('labels the forecast stops by days ahead, nearest first, so time runs left to right', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error('offline')))
    render(<RiverMap doc={makeDoc()} fetchImpl={fetchImpl} />)
    await waitFor(() => expect(screen.queryByText(/Fetching current upstream/)).toBeNull())
    const chips = screen.getAllByText(/^In \d days$/).map((el) => el.textContent)
    expect(chips).toEqual(['In 2 days', 'In 4 days'])
  })
})
