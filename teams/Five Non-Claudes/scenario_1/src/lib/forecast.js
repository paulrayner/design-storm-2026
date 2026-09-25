// Turn today's live reading into a 1-7 day forecast of TOC / alkalinity.
//
// The model is already a forecast: each fitted line learned "feature N days ago ->
// target today". So to predict the target N days into the FUTURE, we take the model
// fitted at lag N and apply it to TODAY's reading. One model per horizon (1..7),
// each with its own honest test RMSE, gives a forecast curve with an uncertainty
// band that (usually) widens as the horizon lengthens.

import { pairedDataset } from './features.js'
import { fitAndScore, predict } from './regression.js'

const MS_PER_DAY = 86400000

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z')
  return new Date(d.getTime() + n * MS_PER_DAY).toISOString().slice(0, 10)
}

/**
 * Build the forecast for one target from a single current feature value.
 *
 * @param {Record<string, {t:string,v:number}[]>} series  bundled history
 * @param {string} targetName  'toc' | 'alk'
 * @param {string} featureName  key into FEATURES (the current live signal)
 * @param {number} currentValue  today's live feature value
 * @param {object} [opts]
 * @param {string} [opts.today]  ISO date to anchor the forecast (default: now)
 * @param {number[]} [opts.horizons]  days ahead to predict (default 1..7)
 * @returns {{
 *   points: {horizon:number, date:string, predicted:number, rmse:number, r2:number, n:number}[],
 *   featureName: string,
 * }}
 *   points is empty for horizons whose model has no data.
 */
export function buildForecast(series, targetName, featureName, currentValue, opts = {}) {
  const today = opts.today || new Date().toISOString().slice(0, 10)
  const horizons = opts.horizons || [1, 2, 3, 4, 5, 6, 7]

  const points = []
  if (currentValue == null || !Number.isFinite(currentValue)) {
    return { points, featureName }
  }

  for (const h of horizons) {
    const pairs = pairedDataset(series, targetName, featureName, h)
    if (pairs.length < 4) continue // too few to fit/score meaningfully
    const { model, test } = fitAndScore(pairs)
    points.push({
      horizon: h,
      date: addDays(today, h),
      predicted: predict(model, currentValue),
      rmse: test.rmse,
      r2: test.r2,
      n: pairs.length,
    })
  }
  return { points, featureName }
}
