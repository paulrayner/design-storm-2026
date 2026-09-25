import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PredictionView } from '../App.jsx'

// A small synthetic doc: enough dates that a 0-7 day lag still leaves pairs, and a
// clear linear relationship so the fit is well-defined.
function makeDoc() {
  // Build clean consecutive ISO dates starting April 1 2022.
  const iso = []
  let d = new Date(Date.UTC(2022, 3, 1))
  for (let i = 0; i < 45; i++) {
    iso.push(d.toISOString().slice(0, 10))
    d = new Date(d.getTime() + 86400000)
  }
  const mk = (fn) => iso.map((t, i) => ({ t, v: fn(i) }))
  return {
    _meta: { units: { toc: 'mg/L', alk: 'mg/L' }, labels: {} },
    series: {
      toc: mk((i) => 2 + i * 0.01),
      alk: mk((i) => 60 - i * 0.1),
      turbidity: mk((i) => 1 + i * 0.02),
      flow: mk(() => 100),
      conductance: mk((i) => 300 + i),
      swe: mk((i) => 10 - i * 0.05),
    },
  }
}

describe('PredictionView interaction', () => {
  it('changes the model output when the lag slider moves', () => {
    render(<PredictionView doc={makeDoc()} />)
    const formulaBefore = screen.getByTestId('formula').textContent

    fireEvent.change(screen.getByRole('slider'), { target: { value: '6' } })
    const formulaAfter = screen.getByTestId('formula').textContent

    expect(screen.getByTestId('lag-value').textContent).toBe('6 days')
    expect(formulaAfter).not.toBe(formulaBefore)
  })

  it('swaps target, default feature and default lag when toggled', () => {
    render(<PredictionView doc={makeDoc()} />)
    // Starts on TOC @2 days.
    expect(screen.getByTestId('lag-value').textContent).toBe('2 days')
    expect(screen.getByTestId('formula').textContent).toContain('TOC')

    fireEvent.click(screen.getByRole('button', { name: 'Alkalinity' }))
    // Alkalinity default lag is 4.
    expect(screen.getByTestId('lag-value').textContent).toBe('4 days')
    expect(screen.getByTestId('formula').textContent).toContain('Alkalinity')
  })
})
