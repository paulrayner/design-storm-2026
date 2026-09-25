import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import SondeProfile from './SondeProfile.jsx'

const band = (top, med) => ({ top, bottom: top + 2, n: 40, turbidity: [med * 0.8, med, med * 1.5], temp: 18 - top / 4, cond: 260, chl: 1 })
// 2 m bands to 30 m. The 45 ft gate (13.7 m) draws from 12-14 m; `murky` puts a
// plume across 10-16 m, as in the sonde's last week.
const profile = (murky) => ({
  from: '2026-08-12',
  to: '2026-08-19',
  bands: Array.from({ length: 15 }, (_, i) => band(i * 2, i * 2 >= 10 && i * 2 < 16 ? (murky ? 4.5 : 1.5) : 1.2 + i * 0.02)),
})

describe('SondeProfile', () => {
  it('opens on the primary gate, the one Denver Water prefers', () => {
    render(<SondeProfile profile={profile(true)} />)
    expect(screen.getByRole('radio', { name: '45 ft ★' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('At the 45 ft gate (primary)')).toBeInTheDocument()
  })

  it('flags a week when the primary gate sat in murky water, without picking a gate for them', () => {
    render(<SondeProfile profile={profile(true)} />)
    expect(screen.getByText('Worth a second look')).toBeInTheDocument()
    expect(screen.getByText(/45 ft gate sat in a murky layer, typically 4.5 NTU. The clearest gate was Top at 1.2 NTU/)).toBeInTheDocument()
    expect(screen.queryByText(/Suggested draw depth/)).toBeNull()
  })

  it('stays quiet on an ordinary week', () => {
    render(<SondeProfile profile={profile(false)} />)
    expect(screen.getByText('Looks normal')).toBeInTheDocument()
  })

  it('shows what the water was like at another gate, and returns to the primary', () => {
    render(<SondeProfile profile={profile(true)} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Top' }))
    const at = screen.getByText('At the top intake').parentElement
    expect(within(at).getByText('Clearest gate that week')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back to 45 ft' }))
    expect(screen.getByText(/3\.8× the clearest gate · in the murky layer/)).toBeInTheDocument()
  })

  it('says plainly that gates do not move the plant forecast, and that the data is archived', () => {
    render(<SondeProfile profile={profile(true)} />)
    expect(screen.getByText(/does not change the plant forecasts/)).toBeInTheDocument()
    expect(screen.getByText(/archived/)).toBeInTheDocument()
  })
})
