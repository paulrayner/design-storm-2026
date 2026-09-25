import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SourceComparison from './SourceComparison.jsx'

describe('SourceComparison', () => {
  const comparison = {
    targetName: 'toc',
    targetLabel: 'TOC',
    upstream: { feature: 'turb_flow', lag: 2, leadTime: '~2 days', n: 922, r2: 0.505, rmse: 0.45 },
    sonde: { feature: 'sonde_turbidity', lag: 0, leadTime: 'hours (same day)', n: 102, r2: -1.41, rmse: 0.22 },
  }

  it('shows both sources, their lead times, and the small-sample caveat', () => {
    render(<SourceComparison comparison={comparison} unit="mg/L" />)
    const card = screen.getByTestId('source-compare')
    expect(card.textContent).toContain('~2 days')
    expect(card.textContent).toContain('hours (same day)')
    expect(card.textContent).toContain('922')
    expect(card.textContent).toContain('102')
    expect(card.textContent).toMatch(/one partial 2026 season/i)
  })

  it('handles a missing sonde source gracefully', () => {
    render(
      <SourceComparison comparison={{ ...comparison, sonde: null }} unit="mg/L" />,
    )
    expect(screen.getByText(/No matched days for this source/i)).toBeInTheDocument()
  })

  it('renders nothing when comparison is null', () => {
    const { container } = render(<SourceComparison comparison={null} unit="mg/L" />)
    expect(container).toBeEmptyDOMElement()
  })
})
