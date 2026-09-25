import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ThresholdControls from './ThresholdControls.jsx'
import { DEFAULT_THRESHOLDS } from '../lib/recommend.js'

describe('ThresholdControls', () => {
  it('shows TOC and both alkalinity (watch/act) inputs and reports edits', () => {
    const onChange = vi.fn()
    render(<ThresholdControls thresholds={DEFAULT_THRESHOLDS} onChange={onChange} />)

    const toc = screen.getByLabelText('TOC threshold')
    const watch = screen.getByLabelText('Alkalinity watch threshold')
    const act = screen.getByLabelText('Alkalinity act threshold')

    expect(toc.value).toBe('3')
    expect(watch.value).toBe('60')
    expect(act.value).toBe('50')

    fireEvent.change(act, { target: { value: '48' } })
    expect(onChange).toHaveBeenCalledWith('alk', 'act', 48)

    fireEvent.change(watch, { target: { value: '58' } })
    expect(onChange).toHaveBeenCalledWith('alk', 'watch', 58)
  })
})
