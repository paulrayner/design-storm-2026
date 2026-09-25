// Pure data-layer helpers. No React, no charts, no I/O here except loadSeries().
// Series are arrays of { t: 'YYYY-MM-DD', v: number }, sorted ascending by date.

/**
 * Build a Map from ISO date -> value for one series, for O(1) lookup by date.
 * @param {{t:string, v:number}[]} series
 * @returns {Map<string, number>}
 */
export function indexByDate(series) {
  const m = new Map()
  for (const { t, v } of series) m.set(t, v)
  return m
}

/**
 * Align several named series onto a shared, sorted date axis.
 *
 * The date axis is the sorted union of every date that appears in any of the
 * requested series. For each date, each column holds that series' value, or null
 * when that series has no reading that day. Missing days are represented as null
 * (a gap), never zero, never carried forward.
 *
 * @param {Record<string, {t:string, v:number}[]>} seriesByName
 * @param {string[]} names  which series to include, in column order
 * @returns {{ dates: string[], rows: Array<Record<string, string|number|null>> }}
 *   rows[i] = { t, [name]: number|null, ... }
 */
export function alignByDate(seriesByName, names) {
  const indexes = {}
  const dateSet = new Set()
  for (const name of names) {
    const s = seriesByName[name] || []
    indexes[name] = indexByDate(s)
    for (const { t } of s) dateSet.add(t)
  }
  const dates = [...dateSet].sort()
  const rows = dates.map((t) => {
    const row = { t }
    for (const name of names) {
      row[name] = indexes[name].has(t) ? indexes[name].get(t) : null
    }
    return row
  })
  return { dates, rows }
}

/**
 * Load the bundled series.json (produced by precompute.py). Returns the parsed
 * document: { _meta, series }. Vite serves /public at the app root, so this works
 * offline off the committed file. base: './' means a relative URL is correct.
 */
export async function loadSeries(fetchImpl = fetch) {
  const res = await fetchImpl('./series.json')
  if (!res.ok) throw new Error(`Failed to load series.json: ${res.status}`)
  return res.json()
}
