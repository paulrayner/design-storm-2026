import React, { useEffect, useState } from 'react'
import { fetchLatestReading } from '../lib/liveReading.js'

/**
 * A small, optional badge showing the latest live USGS reading at the upstream
 * gage. Non-blocking: it fetches after mount and simply shows an "offline" note if
 * the call fails, so the core demo is unaffected by flaky wifi.
 */
export default function LiveBadge({ paramKey = 'turbidity', fetchImpl }) {
  const [state, setState] = useState({ status: 'loading', reading: null })

  useEffect(() => {
    let cancelled = false
    fetchLatestReading(paramKey, fetchImpl).then((reading) => {
      if (cancelled) return
      setState({ status: reading ? 'ok' : 'unavailable', reading })
    })
    return () => {
      cancelled = true
    }
  }, [paramKey, fetchImpl])

  return (
    <div className="live-badge" data-testid="live-badge">
      <span className="live-dot" data-status={state.status} />
      {state.status === 'loading' && <span>Checking live gage…</span>}
      {state.status === 'unavailable' && (
        <span>Live gage offline — showing bundled data</span>
      )}
      {state.status === 'ok' && (
        <span>
          Live {state.reading.label}: <strong>{state.reading.value}</strong>{' '}
          {state.reading.unit}
          <span className="live-time"> · {formatWhen(state.reading.dateTime)}</span>
        </span>
      )}
    </div>
  )
}

function formatWhen(dateTime) {
  const d = new Date(dateTime)
  if (Number.isNaN(d.getTime())) return dateTime
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
