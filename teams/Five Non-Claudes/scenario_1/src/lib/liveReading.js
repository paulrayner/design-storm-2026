// Optional live "latest reading" from the USGS Instantaneous Values service. This
// is a nicety, never a dependency: the core app runs entirely off the bundled
// series.json. Every call here is guarded so a network failure degrades to null
// rather than breaking the page.

const USGS_SITE = '06707525' // South Platte above Strontia Springs Reservoir
const PARAMS = {
  turbidity: { code: '63680', label: 'Turbidity', unit: 'FNU' },
  flow: { code: '00060', label: 'Streamflow', unit: 'cfs' },
}

/**
 * Fetch the most recent USGS instantaneous value for one parameter at the upstream
 * gage. Returns { value, unit, label, dateTime } or null on any failure (offline,
 * CORS, empty, malformed). Never throws.
 *
 * Response shape (matched to the 3D map's working call):
 *   data.value.timeSeries[0].values[0].value = [{ dateTime, value }, ...]
 * USGS uses large negative sentinels (e.g. -999999) for "no data"; those are dropped.
 *
 * @param {'turbidity'|'flow'} paramKey
 * @param {typeof fetch} fetchImpl  injectable for tests
 */
export async function fetchLatestReading(paramKey = 'turbidity', fetchImpl = fetch) {
  const param = PARAMS[paramKey]
  if (!param) return null

  const url =
    `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${USGS_SITE}` +
    `&parameterCd=${param.code}&period=P7D`

  try {
    const res = await fetchImpl(url)
    if (!res || !res.ok) return null
    const data = await res.json()
    const ts = data?.value?.timeSeries?.[0]
    const values = ts?.values?.[0]?.value
    if (!Array.isArray(values) || values.length === 0) return null

    // Walk from the end to the most recent valid reading.
    for (let i = values.length - 1; i >= 0; i--) {
      const v = parseFloat(values[i].value)
      if (Number.isFinite(v) && v > -999) {
        return {
          value: v,
          unit: param.unit,
          label: param.label,
          dateTime: values[i].dateTime,
        }
      }
    }
    return null
  } catch {
    // Offline, blocked, or malformed — the core demo does not depend on this.
    return null
  }
}

export { USGS_SITE, PARAMS }
