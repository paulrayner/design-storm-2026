import React, { useMemo } from 'react'
import { alignByDate } from '../lib/dataLayer.js'
import SeriesChart from './SeriesChart.jsx'

// The upstream signals shown beside the prediction: the things that arrive before
// the water does. Order roughly follows the water's path — snow, then flow, then
// what the river sensor reads.
const PREDICTORS = [
  { key: 'swe', color: '#8fb3ff' },
  { key: 'flow', color: '#4ea1ff' },
  { key: 'turbidity', color: '#7fd4ff' },
  { key: 'conductance', color: '#b48fff' },
  { key: 'precip', color: '#6fe3c4' },
]

/**
 * A stack of small predictor charts. The chart whose series is the model's current
 * feature is highlighted, so the audience can see which upstream signal is driving
 * the prediction. All charts share the same x domain as the prediction chart.
 *
 * @param {object} props
 * @param {Record<string, {t:string,v:number}[]>} props.series
 * @param {object} props.meta  the _meta block (labels, units)
 * @param {string} props.activeFeature  which feature the model is using now
 * @param {[string, string]=} props.dateDomain  [minDate, maxDate] to align x-axes
 */
export default function PredictorPanel({ series, meta, activeFeature, dateDomain }) {
  return (
    <aside className="predictor-panel">
      <div className="predictor-panel-title">Upstream signals</div>
      {PREDICTORS.map(({ key, color }) => (
        <PredictorChart
          key={key}
          seriesData={series[key]}
          dataKey={key}
          color={color}
          label={meta.labels?.[key] ?? key}
          unit={meta.units?.[key]}
          active={key === activeFeature}
          dateDomain={dateDomain}
        />
      ))}
      <p className="note">
        The chart outlined in blue is the signal currently feeding the model.
        Switch the feature to drive the prediction from a different one.
      </p>
    </aside>
  )
}

function PredictorChart({ seriesData, dataKey, color, label, unit, active, dateDomain }) {
  const rows = useMemo(() => {
    const { rows } = alignByDate({ [dataKey]: seriesData || [] }, [dataKey])
    if (!dateDomain) return rows
    const [lo, hi] = dateDomain
    return rows.filter((r) => r.t >= lo && r.t <= hi)
  }, [seriesData, dataKey, dateDomain])

  return (
    <div className={`predictor-chart${active ? ' active' : ''}`}>
      <SeriesChart
        rows={rows}
        dataKey={dataKey}
        color={color}
        label={label}
        unit={unit}
        height={140}
      />
    </div>
  )
}
