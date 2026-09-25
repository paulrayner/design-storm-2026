import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import RecommendationCard from './RecommendationCard.jsx'

const pts = (...vs) => vs.map((v, i) => ({ horizon: i + 1, date: `2026-09-${26 + i}`, predicted: v }))

const tocRow = {
  id: 'toc', label: 'TOC', unit: 'mg/L', color: '#ffb454', direction: 'above',
  points: pts(2.64, 2.7, 2.8, 2.9), lines: [{ value: 3, label: 'threshold' }],
  assessment: { level: 'clear', firstBreachHorizon: null },
}
const alkRow = {
  id: 'alk', label: 'Alkalinity', unit: 'mg/L', color: '#4ecab0', direction: 'below',
  points: pts(58.71, 58.4, 58.2, 58.0), lines: [{ value: 60, label: 'watch' }, { value: 50, label: 'act' }],
  assessment: { level: 'approaching', firstBreachHorizon: 1 },
}

describe('RecommendationCard', () => {
  it('gives each target a direction arrow and a separate status, since up is bad for TOC but down is bad for alkalinity', () => {
    render(<RecommendationCard rows={[tocRow, alkRow]} />)
    const toc = screen.getByTestId('reco-toc')
    const alk = screen.getByTestId('reco-alk')
    expect(toc.textContent).toMatch(/↗ rising 2\.64 → 2\.90 mg\/L/)
    expect(within(toc).getByText('OK')).toBeInTheDocument()
    expect(alk.textContent).toMatch(/↘ falling 58\.71 → 58\.00 mg\/L/)
    expect(within(alk).getByText('WATCH')).toBeInTheDocument()
  })

  it('says when a crossing lands, in words people use, keeping the forecast precision', () => {
    render(<RecommendationCard rows={[tocRow, alkRow]} />)
    expect(screen.getByTestId('reco-alk').textContent).toMatch(/crosses below the 60 watch line tomorrow \(Sat\) · predicted 58\.71/)
    expect(screen.getByTestId('reco-toc').textContent).toMatch(/stays below the 3 threshold all week/)
  })

  it('names the act line when that is the one crossed', () => {
    const acting = { ...alkRow, points: pts(55, 52, 49), assessment: { level: 'breach', firstBreachHorizon: 3 } }
    render(<RecommendationCard rows={[tocRow, acting]} />)
    expect(screen.getByTestId('reco-alk').textContent).toMatch(/crosses below the 50 act line in 3 days \(Mon\) · predicted 49\.00/)
    expect(screen.getByText('Act soon')).toBeInTheDocument()
  })

  it('keeps the descriptive-only caveat in a tooltip, and never mentions the dose chemical', () => {
    render(<RecommendationCard rows={[tocRow, alkRow]} />)
    const card = screen.getByTestId('reco-card')
    expect(screen.getByText('ⓘ').getAttribute('title')).toMatch(/decisions stay with the operator/i)
    expect(card.textContent).not.toMatch(/decisions stay with the operator/i)
    expect(card.textContent).not.toMatch(/sulfate/i)
  })
})
