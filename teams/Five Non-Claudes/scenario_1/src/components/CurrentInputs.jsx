import React from 'react'

// The signals feeding the forecast, with their source (live vs last bundled) so the
// audience knows whether they're seeing today's river or the last archived day.
const ROWS = [
  { key: 'turbidity', label: 'Turbidity', unit: 'FNU' },
  { key: 'flow', label: 'Streamflow', unit: 'cfs' },
  { key: 'conductance', label: 'Conductance', unit: 'µS/cm' },
  { key: 'swe', label: 'Snowpack SWE', unit: 'in' },
]

/**
 * @param {object} props
 * @param {Record<string, {value:number|null, dateTime:string|null, source:string}>} props.resolved
 */
export default function CurrentInputs({ resolved }) {
  const anyLive = Object.values(resolved).some((r) => r && r.source === 'live')
  return (
    <div className="current-inputs" data-testid="current-inputs">
      <div className="chart-title">
        Current upstream conditions
        <span className={`feed-dot ${anyLive ? 'live' : 'offline'}`} />
        <span className="feed-label">{anyLive ? 'live feed' : 'offline — last archived'}</span>
      </div>
      <div className="input-grid">
        {ROWS.map(({ key, label, unit }) => {
          const r = resolved[key]
          return (
            <div className="input-cell" key={key}>
              <div className="input-label">{label}</div>
              <div className="input-value">
                {r && r.value != null ? r.value.toFixed(1) : '—'}
                <span className="input-unit"> {unit}</span>
              </div>
              <div className={`input-source ${r?.source || 'none'}`}>
                {r?.source === 'live'
                  ? formatWhen(r.dateTime)
                  : r?.source === 'bundled'
                    ? `archived ${r.dateTime}`
                    : 'no data'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatWhen(dt) {
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return dt
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
