import React from 'react'
import { formatR2, formatError } from '../lib/format.js'

/**
 * The starred Scenario 1 thread: upstream river gage vs the Strontia reservoir sonde
 * for the same target. The gage gives days of warning; the sonde sits at the plant
 * intake and gives hours. The card shows each source's honest test scores side by
 * side, but leads with the caveat that the sonde has only one partial season, so the
 * numbers are suggestive, not a verdict.
 */
export default function SourceComparison({ comparison, unit }) {
  if (!comparison) return null
  const { upstream, sonde, targetLabel } = comparison

  return (
    <div className="source-compare" data-testid="source-compare">
      <div className="chart-title">
        Upstream gage vs Strontia sonde
        <span className="chart-unit"> · {targetLabel}</span>
      </div>

      <div className="compare-cols">
        <SourceColumn
          title="Upstream river gage"
          subtitle="above Strontia · more warning"
          source={upstream}
          unit={unit}
        />
        <SourceColumn
          title="Strontia sonde"
          subtitle="near the plant intake · less warning"
          source={sonde}
          unit={unit}
          highlight
        />
      </div>

      <p className="compare-caveat">
        <strong>Read this carefully.</strong> The sonde sits much closer to the
        Foothills influent, so it trades warning time for proximity — that trade is the
        open question. But it covers only one partial 2026 season
        {sonde ? ` (${sonde.n} matched days)` : ''}, against years of gage data
        {upstream ? ` (${upstream.n} days)` : ''}. Across that short, calm window the
        target barely moves, which pushes R² negative even where the absolute error
        (RMSE) looks small. Treat this as a reason to collect more sonde data, not as a
        verdict on which sensor wins.
      </p>
    </div>
  )
}

function SourceColumn({ title, subtitle, source, unit, highlight }) {
  return (
    <div className={`compare-col${highlight ? ' highlight' : ''}`}>
      <div className="compare-col-title">{title}</div>
      <div className="compare-col-sub">{subtitle}</div>
      {source ? (
        <dl className="compare-metrics">
          <Metric label="Lead time" value={source.leadTime} />
          <Metric label="Test R²" value={formatR2(source.r2)} />
          <Metric label="Test RMSE" value={formatError(source.rmse, unit)} />
          <Metric label="Matched days" value={String(source.n)} />
        </dl>
      ) : (
        <p className="compare-nodata">No matched days for this source.</p>
      )}
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div className="compare-metric">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
