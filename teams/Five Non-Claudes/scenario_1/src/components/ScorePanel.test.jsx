import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ScorePanel from './ScorePanel.jsx'

describe('ScorePanel', () => {
  it('renders the formula and the test-half R²', () => {
    render(
      <ScorePanel
        model={{ a: 7.627e-5, b: 2.58, n: 461 }}
        train={{ r2: 0.188, rmse: 0.4, mae: 0.3, n: 461 }}
        test={{ r2: 0.505, rmse: 0.45, mae: 0.35, n: 461 }}
        targetName="toc"
        featureName="turb_flow"
        unit="mg/L"
      />,
    )
    expect(screen.getByTestId('formula').textContent).toContain('TOC')
    expect(screen.getByTestId('test-r2').textContent).toBe('0.505')
  })
})
