// What the River map tab says at each stop along the river. It uses the same
// per-horizon models as the Live forecast tab (lib/forecast.js), so the numbers on
// the two tabs always agree.

import { buildForecast } from './forecast.js'
import { breaches } from './recommend.js'

// The two forecast stops on the map, nearest first. 2 days is TOC's own lag in Jake's notebooks
// and 4 is alkalinity's; both targets are shown at both, as on the Live tab.
export const MAP_HORIZONS = [2, 4]

/**
 * The most serious threshold line a value crosses, or null. TOC has one line
 * (`value`); alkalinity has a softer `watch` and a firmer `act` (recommend.js).
 * @returns {{ tier: 'watch'|'act', line: number } | null}
 */
export function thresholdFlag(value, threshold) {
  const { direction } = threshold
  const act = threshold.act ?? threshold.value
  if (act != null && breaches(value, act, direction)) return { tier: 'act', line: act }
  if (threshold.watch != null && breaches(value, threshold.watch, direction)) {
    return { tier: 'watch', line: threshold.watch }
  }
  return null
}

function forecastAt(series, targetName, featureName, current, horizon, threshold, today) {
  const f = buildForecast(series, targetName, featureName, current, { horizons: [horizon], today })
  const p = f.points[0]
  if (!p) return null
  return {
    date: p.date,
    predicted: p.predicted,
    rmse: p.rmse,
    flag: thresholdFlag(p.predicted, threshold),
  }
}

/**
 * @param {Record<string, {t:string,v:number}[]>} series  bundled history
 * @param {object} resolved  today's inputs, from useLiveInputs
 * @param {object} thresholds  { toc, alk } as in recommend.js
 * @param {string} [today]  ISO date (default: now)
 */
export function riverOutlook(series, resolved, thresholds, today) {
  const at = (h) => ({
    toc: forecastAt(series, 'toc', 'turb_flow', resolved.turb_flow.value, h, thresholds.toc, today),
    alk: forecastAt(series, 'alk', 'conductance', resolved.conductance.value, h, thresholds.alk, today),
  })

  const tocLab = series.toc?.[series.toc.length - 1]
  const alkLab = series.alk?.[series.alk.length - 1]

  return {
    early: { swe: resolved.swe, flow: resolved.flow },
    ahead: MAP_HORIZONS.map((h) => ({ horizon: h, ...at(h) })),
    // Same-day model: water from the gage reaches the plant in hours, so today's
    // reading is the best estimate of what is arriving now. No lab result yet.
    today: {
      estimate: at(0),
      lastLab: tocLab && alkLab ? { t: tocLab.t, toc: tocLab.v, alk: alkLab.v } : null,
    },
  }
}
