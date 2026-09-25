import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GateCard from './GateCard.jsx'

const band = (top, med) => ({ top, bottom: top + 2, n: 40, turbidity: [med * 0.8, med, med * 1.5] })
// Same shape as SondeProfile's test: `murky` puts a plume across 10-16 m, around the 45 ft gate.
const profile = (murky) => ({
  from: '2026-08-12',
  to: '2026-08-19',
  bands: Array.from({ length: 15 }, (_, i) => band(i * 2, i * 2 >= 10 && i * 2 < 16 ? (murky ? 4.5 : 1.5) : 1.2 + i * 0.02)),
})
const fresh = new Date(2026, 7, 20, 9)
const old = new Date(2026, 8, 25, 11)

describe('GateCard', () => {
  it('asks for a check on the primary gate in a murky week, without telling them to switch', () => {
    render(<GateCard profile={profile(true)} now={fresh} />)
    expect(screen.getByText('Check the 45 ft ★ gate')).toBeInTheDocument()
    expect(screen.getByText(/murky layer, typically 4.5 NTU. Clearest gate: Top at 1.2 NTU/)).toBeInTheDocument()
    expect(screen.getByTestId('gate-card').textContent).not.toMatch(/switch|pull from/i)
  })

  it('stays quiet on an ordinary week', () => {
    render(<GateCard profile={profile(false)} now={fresh} />)
    expect(screen.getByText('45 ft ★ gate looks normal')).toBeInTheDocument()
  })

  it('never passes an old week off as today', () => {
    render(<GateCard profile={profile(true)} now={old} />)
    expect(screen.getByText('Archived · 37 days old')).toBeInTheDocument()
    expect(screen.getByText('Last known: check the 45 ft ★ gate')).toBeInTheDocument()
  })

  it('shows the depth chart and what the water was like at the gate they pick', () => {
    render(<GateCard profile={profile(true)} now={fresh} />)
    expect(screen.getByRole('img', { name: /Turbidity by depth.*Murky layer/ })).toBeInTheDocument()
    expect(screen.getByText(/At 45 ft ★: typically 4.5 NTU, in the murky layer/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Top' }))
    expect(screen.getByText(/At Top: typically 1.2 NTU, the clearest gate/)).toBeInTheDocument()
    // Picking another gate is a look, not a new verdict.
    expect(screen.getByText('Check the 45 ft ★ gate')).toBeInTheDocument()
  })

  it('links to the full sonde panel', () => {
    const onOpenProfile = vi.fn()
    render(<GateCard profile={profile(true)} now={fresh} onOpenProfile={onOpenProfile} />)
    fireEvent.click(screen.getByRole('button', { name: /on the River map/ }))
    expect(onOpenProfile).toHaveBeenCalled()
  })
})
