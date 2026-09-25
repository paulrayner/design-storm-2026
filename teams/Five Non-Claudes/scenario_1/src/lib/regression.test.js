import { describe, it, expect } from 'vitest'
import { fit, predict, score, timeSplit, fitAndScore } from './regression.js'

describe('fit', () => {
  it('recovers slope and intercept from exactly linear data', () => {
    // y = 3x + 5
    const pairs = [0, 1, 2, 3, 4].map((x) => ({ x, y: 3 * x + 5 }))
    const m = fit(pairs)
    expect(m.a).toBeCloseTo(3, 10)
    expect(m.b).toBeCloseTo(5, 10)
  })

  it('returns a flat mean line when x has no variance', () => {
    const pairs = [
      { x: 7, y: 2 },
      { x: 7, y: 4 },
    ]
    const m = fit(pairs)
    expect(m.a).toBe(0)
    expect(m.b).toBeCloseTo(3, 10)
  })
})

describe('score', () => {
  it('gives R^2 ~ 1 for a perfect fit', () => {
    const pairs = [0, 1, 2, 3].map((x) => ({ x, y: 2 * x + 1 }))
    const m = fit(pairs)
    const s = score(pairs, m)
    expect(s.r2).toBeCloseTo(1, 10)
    expect(s.rmse).toBeCloseTo(0, 10)
    expect(s.mae).toBeCloseTo(0, 10)
  })

  it('gives R^2 ~ 0 when the model just predicts the mean', () => {
    // Constant y: any model that predicts the mean has SSres = SStot = 0 => NaN,
    // so vary y slightly but keep x constant, forcing a mean-only prediction.
    const pairs = [
      { x: 5, y: 10 },
      { x: 5, y: 20 },
      { x: 5, y: 30 },
    ]
    const m = fit(pairs) // slope 0, intercept = mean(y) = 20
    const s = score(pairs, m)
    expect(s.r2).toBeCloseTo(0, 10)
  })

  it('reports R^2 as NaN when y has zero variance', () => {
    const pairs = [
      { x: 1, y: 5 },
      { x: 2, y: 5 },
    ]
    const m = fit(pairs)
    expect(Number.isNaN(score(pairs, m).r2)).toBe(true)
  })
})

describe('timeSplit', () => {
  it('splits by position without shuffling; train is strictly earlier', () => {
    const pairs = ['a', 'b', 'c', 'd'].map((t, i) => ({ t, x: i, y: i }))
    const { train, test } = timeSplit(pairs, 0.5)
    expect(train.map((p) => p.t)).toEqual(['a', 'b'])
    expect(test.map((p) => p.t)).toEqual(['c', 'd'])
    // Every train date precedes every test date.
    const lastTrain = train[train.length - 1].t
    expect(test.every((p) => p.t > lastTrain)).toBe(true)
  })
})

describe('fitAndScore', () => {
  it('fits on the train half and produces fitted values with split labels', () => {
    const pairs = Array.from({ length: 10 }, (_, i) => ({
      t: `2022-04-${String(i + 1).padStart(2, '0')}`,
      x: i,
      y: 2 * i + 1,
    }))
    const res = fitAndScore(pairs, 0.5)
    expect(res.model.a).toBeCloseTo(2, 6)
    expect(res.test.r2).toBeCloseTo(1, 6)
    expect(res.fitted).toHaveLength(10)
    expect(res.fitted.filter((f) => f.split === 'train')).toHaveLength(5)
    expect(res.fitted.filter((f) => f.split === 'test')).toHaveLength(5)
    expect(res.splitDate).toBe('2022-04-06')
  })
})
