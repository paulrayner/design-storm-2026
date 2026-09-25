import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Controls from './Controls.jsx'

describe('Controls', () => {
  it('reports lag slider changes and target toggles', () => {
    const onLagChange = vi.fn()
    const onTargetChange = vi.fn()
    render(
      <Controls
        targetName="toc"
        featureName="turb_flow"
        lag={2}
        onTargetChange={onTargetChange}
        onFeatureChange={vi.fn()}
        onLagChange={onLagChange}
      />,
    )
    expect(screen.getByTestId('lag-value').textContent).toBe('2 days')

    fireEvent.change(screen.getByRole('slider'), { target: { value: '5' } })
    expect(onLagChange).toHaveBeenCalledWith(5)

    fireEvent.click(screen.getByRole('button', { name: 'Alkalinity' }))
    expect(onTargetChange).toHaveBeenCalledWith('alk')
  })
})
