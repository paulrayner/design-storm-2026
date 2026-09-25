// Feature engineering and lag alignment for the soft-sensor model.
// Series are { t: 'YYYY-MM-DD', v: number }[] sorted ascending, as in dataLayer.

import { indexByDate } from './dataLayer.js'

const MS_PER_DAY = 86400000

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z')
  return new Date(d.getTime() + n * MS_PER_DAY).toISOString().slice(0, 10)
}

/**
 * Shift a predictor series forward in time by nDays. The value that was observed
 * on date D is relabeled to date D+nDays, so that after shifting, the row for a
 * given day carries the reading from nDays earlier. This is the move that turns a
 * same-day relationship into a forecast: pairing a shifted predictor with the
 * target teaches "reading from N days ago -> value today".
 *
 * @param {{t:string, v:number}[]} series
 * @param {number} nDays  >= 0
 * @returns {{t:string, v:number}[]} sorted ascending
 */
export function shift(series, nDays) {
  if (!nDays) return series.map((p) => ({ ...p }))
  return series.map((p) => ({ t: addDays(p.t, nDays), v: p.v }))
}

/**
 * Elementwise product of two series on their shared dates: turbidity x flow, the
 * "loading" term the guide flags as the single strongest TOC predictor. Missing
 * days on either side drop out.
 */
export function turbFlow(turbidity, flow) {
  const flowIdx = indexByDate(flow)
  const out = []
  for (const { t, v } of turbidity) {
    if (flowIdx.has(t)) out.push({ t, v: v * flowIdx.get(t) })
  }
  return out
}

/**
 * The predictor each target defaults to, and how to build it from the raw series.
 * TOC -> turbidity x flow; alkalinity -> specific conductance. Both are the
 * strongest single predictors the guide identifies for each target.
 */
export const FEATURES = {
  turb_flow: {
    label: 'Turbidity × Flow (loading)',
    unit: 'FNU·cfs',
    build: (series) => turbFlow(series.turbidity, series.flow),
  },
  conductance: {
    label: 'Specific conductance',
    unit: 'µS/cm',
    build: (series) => series.conductance,
  },
  turbidity: {
    label: 'Turbidity',
    unit: 'FNU',
    build: (series) => series.turbidity,
  },
  flow: {
    label: 'Streamflow',
    unit: 'cfs',
    build: (series) => series.flow,
  },
  swe: {
    label: 'Snowpack SWE',
    unit: 'in',
    build: (series) => series.swe,
  },
  // Strontia profiling sonde, near-surface. Sits in the reservoir much closer to
  // the Foothills influent than the upstream gage, so it may sharpen accuracy — but
  // it only covers one partial 2026 season, so far fewer matched days.
  sonde_turbidity: {
    label: 'Turbidity (Strontia sonde)',
    unit: 'NTU',
    build: (series) => series.sonde_turbidity || [],
    sonde: true,
  },
  sonde_conductivity: {
    label: 'Conductivity (Strontia sonde)',
    unit: 'µS/cm',
    build: (series) => series.sonde_conductivity || [],
    sonde: true,
  },
}

export const TARGETS = {
  toc: { label: 'TOC', unit: 'mg/L', defaultFeature: 'turb_flow', defaultLag: 2 },
  alk: { label: 'Alkalinity', unit: 'mg/L', defaultFeature: 'conductance', defaultLag: 4 },
}

/**
 * Build the paired dataset for a (target, feature, lag) choice.
 *
 * Steps: build the feature series from raw series, shift it forward by lagDays,
 * then inner-join it to the target on date. Only days where both the (lagged)
 * feature and the target exist survive — a pair with a missing side is dropped.
 *
 * @param {Record<string, {t:string,v:number}[]>} series  raw series-by-name
 * @param {string} targetName  'toc' | 'alk'
 * @param {string} featureName  key into FEATURES
 * @param {number} lagDays
 * @returns {{ t:string, x:number, y:number }[]} sorted ascending by date
 *   x = lagged feature value, y = target value on that date
 */
export function pairedDataset(series, targetName, featureName, lagDays) {
  const target = series[targetName] || []
  const rawFeature = FEATURES[featureName].build(series)
  const laggedFeature = shift(rawFeature, lagDays)
  const featIdx = indexByDate(laggedFeature)

  const pairs = []
  for (const { t, v } of target) {
    if (featIdx.has(t)) {
      const x = featIdx.get(t)
      if (x != null && v != null) pairs.push({ t, x, y: v })
    }
  }
  pairs.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0))
  return pairs
}
