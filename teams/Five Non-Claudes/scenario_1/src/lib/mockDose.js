// MOCK aluminum sulfate — Al2(SO4)3 — dose. ILLUSTRATIVE ONLY, NOT A REAL CALCULATION.
//
// We were given ONE unverified data point from Denver Water's operator Excel sheet
// (Cassidi/Jake Q&A, 2026-09-24): incoming TOC of ~3 mg/L targets "~11" of coagulant,
// with the unit noted as unconfirmed (grams vs mg/L). The notes use the operators'
// shorthand "alum", but that is informally applied to aluminum sulfate; the compound
// is Al2(SO4)3. We treat the dose as a rate in mg/L, per normal practice.
//
// From that single point we build a deliberately simple, transparent toy relation so
// the number MOVES with the forecast on stage — it is not a validated formula and
// must never be presented as one:
//   base rate  = DOSE_PER_TOC * predicted_TOC     (11/3 ≈ 3.67 mg/L per mg/L TOC)
//   low-alk bump: if forecast alkalinity is below the watch line, nudge the dose up,
//                 because low alkalinity means more coagulant is needed to hold pH in
//                 the floc range (per the Q&A notes). Capped, and clearly synthetic.
//
// Grams are derived from the rate and a nominal treated volume purely so a "grams"
// figure exists as requested; the volume is a round placeholder, not a plant value.

export const DOSE_PER_TOC = 11 / 3 // mg/L Al2(SO4)3 per mg/L TOC, from the one example
const LOW_ALK_MAX_BUMP = 0.25 // up to +25% when alkalinity is far below the watch line
const NOMINAL_VOLUME_ML = 1000 // placeholder: grams = rate(mg/L) * (L) / 1000

/**
 * Compute the mock aluminum sulfate dose from a forecast TOC and alkalinity.
 *
 * @param {number|null} tocValue   predicted TOC (mg/L)
 * @param {number|null} alkValue   predicted alkalinity (mg/L), or null
 * @param {number} alkWatch        the alkalinity watch threshold (default 60)
 * @returns {{
 *   rateMgL: number, grams: number, lowAlkBump: number, basis: number
 * } | null}  null when TOC is unavailable
 */
export function mockAluminumSulfateDose(tocValue, alkValue, alkWatch = 60) {
  if (tocValue == null || !Number.isFinite(tocValue)) return null

  const base = DOSE_PER_TOC * tocValue

  // Transparent low-alkalinity bump: 0 at/above the watch line, scaling up to
  // LOW_ALK_MAX_BUMP as alkalinity falls toward zero below it.
  let lowAlkBump = 0
  if (alkValue != null && Number.isFinite(alkValue) && alkValue < alkWatch && alkWatch > 0) {
    const shortfall = Math.min(1, (alkWatch - alkValue) / alkWatch)
    lowAlkBump = LOW_ALK_MAX_BUMP * shortfall
  }

  const rateMgL = base * (1 + lowAlkBump)
  const grams = (rateMgL * (NOMINAL_VOLUME_ML / 1000)) / 1000
  return { rateMgL, grams, lowAlkBump, basis: tocValue }
}

/**
 * Pick the forecast value at a chosen horizon (default: the first available) for a
 * built forecast's points array. Returns null if none.
 */
export function valueAtHorizon(points, horizon) {
  if (!points || points.length === 0) return null
  const hit = points.find((p) => p.horizon === horizon)
  return (hit || points[0]).predicted
}
