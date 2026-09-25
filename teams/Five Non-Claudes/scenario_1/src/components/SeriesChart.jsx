import React from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

/**
 * A single time-series line chart over aligned rows ({ t, [key]: number|null }).
 * Nulls are rendered as gaps (connectNulls is false), matching the data layer's
 * "missing is a gap, not zero" rule.
 */
export default function SeriesChart({
  rows,
  dataKey,
  color = '#4ea1ff',
  label,
  unit,
  height = 220,
}) {
  return (
    <div className="chart-card">
      {label && (
        <div className="chart-title">
          {label}
          {unit ? <span className="chart-unit"> ({unit})</span> : null}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="#2b3a5a" strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            tick={{ fill: '#9fb0c9', fontSize: 11 }}
            minTickGap={48}
          />
          <YAxis
            tick={{ fill: '#9fb0c9', fontSize: 11 }}
            width={48}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{
              background: '#16213a',
              border: '1px solid #2b3a5a',
              color: '#e8eef7',
            }}
            labelStyle={{ color: '#9fb0c9' }}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            dot={false}
            strokeWidth={2}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
