// Resolve the "current" value of a signal for the forecast: prefer the live reading,
// fall back to the last value in the bundled history when live is unavailable
// (offline, blocked, or empty). Keeps the forecast working on flaky wifi.

/**
 * @param {{value:number|null, dateTime:string|null, live:boolean}|undefined} liveEntry
 * @param {{t:string, v:number}[]|undefined} bundledSeries
 * @returns {{ value:number|null, dateTime:string|null, source:'live'|'bundled'|'none' }}
 */
export function resolveCurrent(liveEntry, bundledSeries) {
  if (liveEntry && liveEntry.live && liveEntry.value != null) {
    return { value: liveEntry.value, dateTime: liveEntry.dateTime, source: 'live' }
  }
  if (Array.isArray(bundledSeries) && bundledSeries.length > 0) {
    const last = bundledSeries[bundledSeries.length - 1]
    return { value: last.v, dateTime: last.t, source: 'bundled' }
  }
  return { value: null, dateTime: null, source: 'none' }
}

/**
 * Resolve the current turb_flow from live inputs, falling back to the product of the
 * last bundled turbidity and flow when live is missing.
 */
export function resolveCurrentTurbFlow(liveInputs, series) {
  if (liveInputs?.turb_flow?.live && liveInputs.turb_flow.value != null) {
    return {
      value: liveInputs.turb_flow.value,
      dateTime: liveInputs.turb_flow.dateTime,
      source: 'live',
    }
  }
  const turb = series?.turbidity
  const flow = series?.flow
  if (turb?.length && flow?.length) {
    const t = turb[turb.length - 1]
    const f = flow[flow.length - 1]
    return { value: t.v * f.v, dateTime: t.t, source: 'bundled' }
  }
  return { value: null, dateTime: null, source: 'none' }
}
