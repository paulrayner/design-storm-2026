import { describe, it, expect } from 'vitest'
import { formatFormula, formatR2, formatError, formatWhen } from './format.js'

describe('formatFormula', () => {
  it('renders target, feature, slope and intercept', () => {
    const s = formatFormula({ a: 7.627e-5, b: 2.58 }, 'toc', 'turb_flow')
    expect(s).toContain('TOC')
    expect(s).toContain('Turbidity × Flow')
    expect(s).toContain('7.63e-5')
    expect(s).toContain('+ 2.58')
  })

  it('shows a negative intercept with a minus sign', () => {
    const s = formatFormula({ a: 0.2, b: -3.1 }, 'alk', 'conductance')
    expect(s).toContain('− 3.1')
  })
})

describe('formatR2 / formatError', () => {
  it('formats numbers and handles NaN', () => {
    expect(formatR2(0.5054)).toBe('0.505')
    expect(formatR2(NaN)).toBe('—')
    expect(formatError(6.26, 'mg/L')).toBe('6.26 mg/L')
    expect(formatError(NaN, 'mg/L')).toBe('—')
  })
})

describe('formatWhen', () => {
  it('says tomorrow for the first horizon and names the weekday', () => {
    expect(formatWhen(1, '2026-09-26')).toBe('tomorrow (Sat)')
    expect(formatWhen(3, '2026-09-28')).toBe('in 3 days (Mon)')
  })
})
