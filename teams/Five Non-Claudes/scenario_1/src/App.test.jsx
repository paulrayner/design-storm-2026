import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import App from './App.jsx'
import bundled from '../public/series.json'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('App offline resilience', () => {
  it('still renders the shell and data terms when every fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    render(<App />)

    // Header and the always-present provisional-data caveat render regardless.
    expect(screen.getByText('TOC & Alkalinity Prediction Viewer')).toBeInTheDocument()
    expect(screen.getByText(/Provisional data/i)).toBeInTheDocument()

    // The live badge resolves to its offline state without throwing.
    await waitFor(() =>
      expect(screen.getByTestId('live-badge').textContent).toMatch(/offline/i),
    )
  })

  it('shows the tabs in order with Live forecast selected by default', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    render(<App />)
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent)
    expect(tabs).toEqual(['Live forecast', 'River map', 'Explorer'])
    const forecastTab = screen.getByRole('tab', { name: 'Live forecast' })
    const explorerTab = screen.getByRole('tab', { name: 'Explorer' })
    expect(forecastTab).toHaveAttribute('aria-selected', 'true')
    expect(explorerTab).toHaveAttribute('aria-selected', 'false')
  })

  it('takes the Do today gate link to the full depth profile on the River map', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) =>
      String(url).includes('series.json')
        ? Promise.resolve({ ok: true, json: async () => bundled })
        : Promise.reject(new Error('offline')),
    )
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /on the River map/ }))
    expect(screen.getByRole('tab', { name: 'River map' })).toHaveAttribute('aria-selected', 'true')
    await waitFor(() => expect(scroll).toHaveBeenCalled())
    expect(scroll.mock.contexts[0].id).toBe('sonde-title')
  })
})
