// Assemble the *current* model inputs from live public feeds, for the forecast
// dashboard. Every fetch is guarded: any failure yields null for that signal and
// the app falls back to the last bundled value, so the demo survives flaky wifi.
//
// Confirmed working, keyless, CORS-open (2026-09-25):
//   USGS IV  06707525  63680 turbidity, 00095 specific conductance
//   USGS IV  06701900  00060 discharge (the upstream gage publishes no flow)
//   NRCS     531:CO:SNTL WTEQ snow water equivalent (Hoosier Pass)

const GAGE_WQ = '06707525' // South Platte above Strontia (turbidity, conductance)
const GAGE_FLOW = '06701900' // nearest upstream discharge gage (Trumbull)
const SNOTEL_TRIPLET = '531:CO:SNTL' // Hoosier Pass

/**
 * Fetch the most recent valid USGS instantaneous value for one parameter at a site.
 * Returns { value, dateTime } or null. Never throws.
 */
export async function fetchUsgsLatest(site, paramCode, fetchImpl = fetch) {
  const url =
    `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${site}` +
    `&parameterCd=${paramCode}&period=P7D`
  try {
    const res = await fetchImpl(url)
    if (!res || !res.ok) return null
    const data = await res.json()
    const values = data?.value?.timeSeries?.[0]?.values?.[0]?.value
    if (!Array.isArray(values) || values.length === 0) return null
    for (let i = values.length - 1; i >= 0; i--) {
      const v = parseFloat(values[i].value)
      if (Number.isFinite(v) && v > -999) {
        return { value: v, dateTime: values[i].dateTime }
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Fetch the most recent valid SNOTEL daily value (default WTEQ, snow water
 * equivalent). Returns { value, dateTime } or null. Never throws.
 */
export async function fetchSnotelLatest(triplet, element = 'WTEQ', fetchImpl = fetch) {
  // Ask for a generous recent window; take the last non-null.
  const end = new Date()
  const begin = new Date(end.getTime() - 30 * 86400000)
  const iso = (d) => d.toISOString().slice(0, 10)
  const url =
    `https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/data` +
    `?stationTriplets=${triplet}&elements=${element}&duration=DAILY` +
    `&beginDate=${iso(begin)}&endDate=${iso(end)}`
  try {
    const res = await fetchImpl(url)
    if (!res || !res.ok) return null
    const data = await res.json()
    const values = data?.[0]?.data?.[0]?.values
    if (!Array.isArray(values) || values.length === 0) return null
    for (let i = values.length - 1; i >= 0; i--) {
      const v = values[i]?.value
      if (v !== null && v !== undefined && Number.isFinite(Number(v))) {
        return { value: Number(v), dateTime: values[i].date }
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Fetch all four current signals in parallel and assemble the model inputs.
 * Returns an object keyed by signal, each { value, dateTime, live } — live=false
 * means the fetch failed and the caller should substitute the last bundled value.
 * Also derives turb_flow when both turbidity and flow are available.
 *
 * @param {typeof fetch} fetchImpl injectable for tests
 */
export async function fetchLiveInputs(fetchImpl = fetch) {
  const [turbidity, conductance, flow, swe] = await Promise.all([
    fetchUsgsLatest(GAGE_WQ, '63680', fetchImpl),
    fetchUsgsLatest(GAGE_WQ, '00095', fetchImpl),
    fetchUsgsLatest(GAGE_FLOW, '00060', fetchImpl),
    fetchSnotelLatest(SNOTEL_TRIPLET, 'WTEQ', fetchImpl),
  ])

  const wrap = (r) => (r ? { ...r, live: true } : { value: null, dateTime: null, live: false })
  const inputs = {
    turbidity: wrap(turbidity),
    conductance: wrap(conductance),
    flow: wrap(flow),
    swe: wrap(swe),
  }

  // Derived loading term, only when both parts are live.
  inputs.turb_flow =
    turbidity && flow
      ? { value: turbidity.value * flow.value, dateTime: turbidity.dateTime, live: true }
      : { value: null, dateTime: null, live: false }

  return inputs
}

export { GAGE_WQ, GAGE_FLOW, SNOTEL_TRIPLET }
