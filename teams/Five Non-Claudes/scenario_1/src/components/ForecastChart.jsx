import React from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'

/**
 * The 1-7 day forecast for one target: predicted value per horizon, a shaded
 * ±RMSE uncertainty band, and a horizontal line at the operating threshold. The
 * band is built as a low/high pair so Recharts can fill between them.
 *
 * @param {object} props
 * @param {{horizon:number, date:string, predicted:number, rmse:number}[]} props.points
 * @param {{value:number, label:string, color?:string}[]} props.thresholds  one or more guideline lines
 * @param {string} props.color
 * @param {string} props.unit
 * @param {string} props.label
 */
export default function ForecastChart({
  points,
  thresholds = [],
  color = '#ffb454',
  unit,
  label,
  height = 240,
}) {
  const data = points.map((p) => ({
    label: `+${p.horizon}d`,
    date: p.date,
    predicted: p.predicted,
    lo: p.predicted - p.rmse,
    hi: p.predicted + p.rmse,
    band: [p.predicted - p.rmse, p.predicted + p.rmse],
  }))

  return (
    <div className="chart-card">
      <div className="chart-title">
        {label} forecast{unit ? <span className="chart-unit"> ({unit})</span> : null}
      </div>
      {data.length === 0 ? (
        <p className="note">No forecast available (missing current input).</p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="#2b3a5a" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fill: '#9fb0c9', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9fb0c9', fontSize: 11 }} width={48} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ background: '#16213a', border: '1px solid #2b3a5a', color: '#e8eef7' }}
              labelStyle={{ color: '#9fb0c9' }}
              formatter={(value, name) => {
                if (name === 'band' || Array.isArray(value)) return [null, null]
                return [Number(value).toFixed(2), name]
              }}
            />
            {thresholds.map((th, i) => (
              <ReferenceLine
                key={th.label ?? i}
                y={th.value}
                stroke={th.color || '#ff8a8a'}
                strokeDasharray="5 4"
                label={{
                  value: `${th.label ? th.label + ' ' : ''}${th.value}`,
                  fill: th.color || '#ff8a8a',
                  fontSize: 11,
                  position: 'insideTopRight',
                }}
              />
            ))}
            <Area
              dataKey="band"
              stroke="none"
              fill={color}
              fillOpacity={0.15}
              isAnimationActive={false}
              name="band"
              legendType="none"
            />
            <Line
              type="monotone"
              dataKey="predicted"
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3 }}
              isAnimationActive={false}
              name="predicted"
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
