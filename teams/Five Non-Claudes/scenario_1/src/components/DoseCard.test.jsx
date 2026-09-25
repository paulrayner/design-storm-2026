import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import DoseCard from './DoseCard.jsx'

describe('DoseCard', () => {
  it('shows the mock aluminum sulfate dose with the disclaimer in a tooltip on the MOCK tag', () => {
    const dose = { rateMgL: 11, grams: 0.011, basis: 3, lowAlkBump: 0 }
    render(<DoseCard dose={dose} />)
    const card = screen.getByTestId('dose-card')
    expect(card.textContent).toContain('11.0')
    expect(card.textContent).toMatch(/mg\/L/)

    // The long caveat is a tooltip (title/aria-label) on the MOCK tag, not body text.
    const tag = screen.getByText('MOCK')
    expect(tag.getAttribute('title')).toMatch(/not a calibrated formula and not a real dose/i)
    // It should not be rendered as visible body copy anymore.
    expect(card.textContent).not.toMatch(/not a calibrated formula/i)
  })

  it('ties a low-alkalinity bump to the alkalinity forecast with a matching chip', () => {
    const dose = { rateMgL: 9.7, grams: 0.01, basis: 2.64, lowAlkBump: 0.01 }
    render(<DoseCard dose={dose} alkLevel="approaching" />)
    const chip = screen.getByText(/low alkalinity · \+1%/)
    expect(chip).toHaveAttribute('data-level', 'approaching')
  })

  it('shows no alkalinity chip when there is no bump', () => {
    render(<DoseCard dose={{ rateMgL: 11, grams: 0.011, basis: 3, lowAlkBump: 0 }} />)
    expect(screen.queryByText(/low alkalinity/)).toBeNull()
  })

  it('handles a missing dose gracefully', () => {
    render(<DoseCard dose={null} />)
    expect(screen.getByTestId('dose-card').textContent).toMatch(/no TOC forecast/i)
  })
})
