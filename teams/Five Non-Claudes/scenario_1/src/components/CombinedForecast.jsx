import React from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

/**
 * "Are these related?" from the sketch: TOC and alkalinity forecasts on one chart,
 * dual y-axes (different units and ranges). The two are physically linked — removing
 * TOC works best at slightly acidic pH, and alkalinity is what resists that pH shift,
 * so it sets how much acid the plant must add.
 *
 * @param {object} props
 * @param {{horizon:number}[]} props.tocPoints
 * @param {{horizon:number}[]} props.alkPoints
 */
export default function CombinedForecast({ tocPoints, alkPoints, height = 260 }) {
  // Merge on horizon so both lines share the x-axis.
  const byHorizon = new Map()
  for (const p of tocPoints) byHorizon.set(p.horizon, { label: `+${p.horizon}d`, toc: p.predicted })
  for (const p of alkPoints) {
    const row = byHorizon.get(p.horizon) || { label: `+${p.horizon}d` }
    row.alk = p.predicted
    byHorizon.set(p.horizon, row)
  }
  const data = [...byHorizon.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r)

  return (
    <div className="chart-card">
      <div className="chart-title">Are these related? TOC and alkalinity together</div>
      {data.length === 0 ? (
        <p className="note">No forecast available.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#2b3a5a" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: '#9fb0c9', fontSize: 11 }} />
              <YAxis
                yAxisId="toc"
                tick={{ fill: '#ffb454', fontSize: 11 }}
                width={44}
                domain={['auto', 'auto']}
              />
              <YAxis
                yAxisId="alk"
                orientation="right"
                tick={{ fill: '#4ecab0', fontSize: 11 }}
                width={44}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{ background: '#16213a', border: '1px solid #2b3a5a', color: '#e8eef7' }}
                labelStyle={{ color: '#9fb0c9' }}
                formatter={(value) => (value == null ? '—' : Number(value).toFixed(2))}
              />
              <Legend wrapperStyle={{ color: '#9fb0c9' }} />
              <Line
                yAxisId="toc"
                type="monotone"
                dataKey="toc"
                name="TOC (mg/L)"
                stroke="#ffb454"
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
              <Line
                yAxisId="alk"
                type="monotone"
                dataKey="alk"
                name="Alkalinity (mg/L)"
                stroke="#4ecab0"
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="note">
            TOC and alkalinity are physically linked at the plant: TOC removal works
            best at a slightly acidic pH, and alkalinity is the water's resistance to
            that pH change — so it sets how much chemical it takes to get there. Watch
            whether they move together as the forecast runs out.
          </p>
        </>
      )}
    </div>
  )
}
