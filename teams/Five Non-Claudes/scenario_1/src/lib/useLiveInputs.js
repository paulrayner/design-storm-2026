// Fetch today's upstream readings once and resolve each to a value (live, or the
// last bundled one when offline). Shared by the Live forecast and River map tabs so
// both show the same inputs and therefore the same forecast.

import { useEffect, useMemo, useState } from 'react'
import { fetchLiveInputs } from './liveInputs.js'
import { resolveCurrent, resolveCurrentTurbFlow } from './currentInput.js'

export function useLiveInputs(series, fetchImpl) {
  const [live, setLive] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchLiveInputs(fetchImpl).then((inputs) => {
      if (cancelled) return
      setLive(inputs)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [fetchImpl])

  // turb_flow drives TOC; conductance drives alkalinity, mirroring the model's
  // default features.
  const resolved = useMemo(() => {
    return {
      turbidity: resolveCurrent(live?.turbidity, series.turbidity),
      flow: resolveCurrent(live?.flow, series.flow),
      conductance: resolveCurrent(live?.conductance, series.conductance),
      swe: resolveCurrent(live?.swe, series.swe),
      turb_flow: resolveCurrentTurbFlow(live, series),
    }
  }, [live, series])

  return { loading, resolved }
}
