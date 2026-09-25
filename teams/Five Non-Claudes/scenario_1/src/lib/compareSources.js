// Compare two source signals for the same target: the upstream river gage (days of
// warning) against the Strontia reservoir sonde (much closer to the plant intake, so
// far less warning). This is the starred thread in the Scenario 1 brief — does the
// closer sensor buy accuracy, and what does it cost in lead time?

import { pairedDataset, TARGETS } from './features.js'
import { fitAndScore } from './regression.js'

// How each source maps to a feature per target, and the rough warning time it offers.
// The upstream gage lag matches the model defaults (mixing/travel through the
// reservoir); the sonde sits at the influent, effectively same-day.
const SOURCES = {
  toc: {
    upstream: { feature: 'turb_flow', lag: 2, leadTime: '~2 days' },
    sonde: { feature: 'sonde_turbidity', lag: 0, leadTime: 'hours (same day)' },
  },
  alk: {
    upstream: { feature: 'conductance', lag: 4, leadTime: '~4 days' },
    sonde: { feature: 'sonde_conductivity', lag: 0, leadTime: 'hours (same day)' },
  },
}

/**
 * Build the comparison for one target. Fits the single-feature model on each source
 * and returns its honest (test-half) scores plus sample size and lead time. Either
 * side may be null if its feature has no matched days.
 *
 * @param {Record<string, {t:string,v:number}[]>} series
 * @param {'toc'|'alk'} targetName
 */
export function compareSources(series, targetName) {
  const cfg = SOURCES[targetName]
  if (!cfg) return null

  const evaluate = (feature, lag, leadTime) => {
    const pairs = pairedDataset(series, targetName, feature, lag)
    if (pairs.length === 0) return null
    const { model, test } = fitAndScore(pairs)
    return {
      feature,
      lag,
      leadTime,
      n: pairs.length,
      r2: test.r2,
      rmse: test.rmse,
      model,
    }
  }

  return {
    targetName,
    targetLabel: TARGETS[targetName].label,
    upstream: evaluate(cfg.upstream.feature, cfg.upstream.lag, cfg.upstream.leadTime),
    sonde: evaluate(cfg.sonde.feature, cfg.sonde.lag, cfg.sonde.leadTime),
  }
}

export { SOURCES }
