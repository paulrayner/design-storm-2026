// Turn a forecast curve plus an operating threshold into a plain-language,
// DESCRIPTIVE status. It states what the forecast implies relative to the threshold;
// it deliberately gives no chemical-dosing or treatment advice — those are
// professional decisions for the operator, not this demo.

// Default operating thresholds.
//
// TOC: a single demo cutoff (the guide uses >3 mg/L only as an "unusual day"
// weighting, not a regulatory limit).
//
// Alkalinity: a two-tier band, both editable. 60 mg/L is Jake's low-alkalinity
// "watch" line (Denver Water itself questions whether 60 is the acting number); 50
// mg/L is a firmer "act" line — below it the water becomes materially harder to
// treat. Crossing 60 is a watch; crossing 50 is a concern.
export const DEFAULT_THRESHOLDS = {
  toc: { value: 3, direction: 'above', label: 'Elevated TOC' },
  alk: { watch: 60, act: 50, direction: 'below', label: 'Low alkalinity' },
}

/**
 * Does a forecast value breach the threshold, given the direction of concern?
 * direction 'above' => breach when value >= threshold; 'below' => value <= threshold.
 */
export function breaches(value, threshold, direction) {
  return direction === 'above' ? value >= threshold : value <= threshold
}

/**
 * Evaluate a forecast against a threshold and produce a descriptive status.
 *
 * @param {{horizon:number, date:string, predicted:number}[]} points  forecast curve
 * @param {{value:number, direction:'above'|'below', label:string}} threshold
 * @returns {{
 *   level: 'clear'|'approaching'|'breach',
 *   firstBreachHorizon: number|null,
 *   message: string,
 * }}
 */
export function assess(points, threshold) {
  if (!points || points.length === 0) {
    return { level: 'clear', firstBreachHorizon: null, message: 'No forecast available.' }
  }
  const { value, direction, label } = threshold
  const word = direction === 'above' ? 'above' : 'below'

  const firstBreach = points.find((p) => breaches(p.predicted, value, direction))
  if (firstBreach) {
    const h = firstBreach.horizon
    const day = h === 1 ? '1 day' : `${h} days`
    // If the very first horizon already breaches, it is arriving now, not "in N days".
    const lead =
      h === points[0].horizon
        ? `within the next ${day}`
        : `in about ${day}`
    return {
      level: h <= 2 ? 'breach' : 'approaching',
      firstBreachHorizon: h,
      message:
        `${label}: forecast crosses ${word} the ${value} threshold ${lead} ` +
        `(predicted ${firstBreach.predicted.toFixed(2)} on ${firstBreach.date}).`,
    }
  }

  // No breach in the window — report the closest approach.
  const closest = points.reduce((a, b) =>
    Math.abs(b.predicted - value) < Math.abs(a.predicted - value) ? b : a,
  )
  return {
    level: 'clear',
    firstBreachHorizon: null,
    message:
      `${label}: forecast stays ${direction === 'above' ? 'below' : 'above'} the ` +
      `${value} threshold across the next ${points[points.length - 1].horizon} days ` +
      `(closest ${closest.predicted.toFixed(2)} on ${closest.date}).`,
  }
}

/**
 * Assess a forecast against a TWO-TIER band (a softer "watch" line and a firmer "act"
 * line, same direction of concern). Severity comes from which tier is crossed, not
 * from how soon: crossing the act line anywhere in the window is 'breach'; crossing
 * only the watch line is 'approaching'; neither is 'clear'. The message leads with the
 * more severe tier and its lead time.
 *
 * @param {{horizon:number, date:string, predicted:number}[]} points
 * @param {{watch:number, act:number, direction:'above'|'below', label:string}} band
 */
export function assessBanded(points, band) {
  if (!points || points.length === 0) {
    return { level: 'clear', firstBreachHorizon: null, message: 'No forecast available.' }
  }
  const { watch, act, direction, label } = band
  const word = direction === 'above' ? 'above' : 'below'
  const leadPhrase = (h) => {
    const day = h === 1 ? '1 day' : `${h} days`
    return h === points[0].horizon ? `within the next ${day}` : `in about ${day}`
  }

  const firstAct = points.find((p) => breaches(p.predicted, act, direction))
  if (firstAct) {
    return {
      level: 'breach',
      firstBreachHorizon: firstAct.horizon,
      message:
        `${label}: forecast crosses ${word} the ${act} act line ${leadPhrase(firstAct.horizon)} ` +
        `(predicted ${firstAct.predicted.toFixed(2)} on ${firstAct.date}). Treatability drops sharply below ${act}.`,
    }
  }

  const firstWatch = points.find((p) => breaches(p.predicted, watch, direction))
  if (firstWatch) {
    return {
      level: 'approaching',
      firstBreachHorizon: firstWatch.horizon,
      message:
        `${label}: forecast crosses ${word} the ${watch} watch line ${leadPhrase(firstWatch.horizon)} ` +
        `(predicted ${firstWatch.predicted.toFixed(2)} on ${firstWatch.date}), but stays above the ${act} act line.`,
    }
  }

  const target = direction === 'below' ? Math.min(watch, act) : Math.max(watch, act)
  const closest = points.reduce((a, b) =>
    Math.abs(b.predicted - target) < Math.abs(a.predicted - target) ? b : a,
  )
  return {
    level: 'clear',
    firstBreachHorizon: null,
    message:
      `${label}: forecast stays ${direction === 'above' ? 'below' : 'above'} the ${watch} ` +
      `watch line across the next ${points[points.length - 1].horizon} days ` +
      `(closest ${closest.predicted.toFixed(2)} on ${closest.date}).`,
  }
}

// A week's forecast that moves less than this fraction of its start is called flat,
// so noise between horizon models doesn't draw an arrow.
const FLAT_FRACTION = 0.01

/**
 * Which way the forecast heads across the window, first horizon to last. Direction
 * only: whether that direction is good or bad is the threshold's call, not this one.
 * @returns {{ dir:'up'|'down'|'flat', from:number, to:number } | null}
 */
export function trend(points) {
  if (!points || points.length < 2) return null
  const from = points[0].predicted
  const to = points[points.length - 1].predicted
  const dir = Math.abs(to - from) < Math.abs(from) * FLAT_FRACTION ? 'flat' : to > from ? 'up' : 'down'
  return { dir, from, to }
}
