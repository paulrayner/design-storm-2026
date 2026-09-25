// Small formatting helpers for the model's on-screen formula and scores.

import { FEATURES, TARGETS } from './features.js'

/**
 * Format a fitted single-feature model as a human-readable equation string, e.g.
 *   "TOC ≈ 7.63e-5 × (Turbidity × Flow) + 2.58"
 * The slope is shown in scientific notation when it is very small or very large,
 * otherwise with a few significant digits.
 *
 * @param {{a:number, b:number}} model
 * @param {string} targetName
 * @param {string} featureName
 */
export function formatFormula(model, targetName, featureName) {
  const target = TARGETS[targetName]?.label ?? targetName
  const feature = FEATURES[featureName]?.label ?? featureName
  const a = formatCoeff(model.a)
  const bAbs = formatCoeff(Math.abs(model.b))
  const sign = model.b < 0 ? '−' : '+'
  return `${target} ≈ ${a} × (${feature}) ${sign} ${bAbs}`
}

function formatCoeff(x) {
  if (x === 0) return '0'
  const mag = Math.abs(x)
  if (mag < 0.001 || mag >= 100000) return x.toExponential(2)
  // 3 significant figures, trimmed.
  return Number(x.toPrecision(3)).toString()
}

/** Format an R² value, or "—" when it is undefined (NaN). */
export function formatR2(r2) {
  return Number.isNaN(r2) ? '—' : r2.toFixed(3)
}

/** Format an error metric (RMSE/MAE) with a unit, or "—" when undefined. */
export function formatError(value, unit) {
  if (Number.isNaN(value)) return '—'
  return `${value.toFixed(2)}${unit ? ' ' + unit : ''}`
}

const WEEKDAY = { weekday: 'short', timeZone: 'UTC' }

/** When a forecast horizon lands, for people: "tomorrow (Sat)", "in 3 days (Mon)". */
export function formatWhen(horizon, isoDate) {
  const day = new Date(isoDate + 'T00:00:00Z').toLocaleDateString('en-US', WEEKDAY)
  return horizon === 1 ? `tomorrow (${day})` : `in ${horizon} days (${day})`
}
