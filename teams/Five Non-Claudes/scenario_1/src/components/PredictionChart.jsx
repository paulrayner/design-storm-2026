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
  ReferenceLine,
} from 'recharts'

/**
 * Overlay of actual lab values and the model's prediction over time, with a
 * vertical reference line marking the train/test boundary. Everything left of the
 * line the model learned from; everything right of it is the honest test.
 *
 * @param {object} props
 * @param {{t:string, actual:number, predicted:number, split:string}[]} props.fitted
 * @param {string|null} props.splitDate
 * @param {string} props.targetColor
 * @param {string} props.unit
 * @param {string} props.targetLabel
 */
export default function PredictionChart({
  fitted,
  splitDate,
  targetColor = '#ffb454',
  unit,
  targetLabel = 'Target',
  height = 320,
}) {
  return (
    <div className="chart-card">
      <div className="chart-title">
        Predicted vs actual{unit ? <span className="chart-unit"> ({unit})</span> : null}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={fitted} margin={{ top: 24, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="#2b3a5a" strokeDasharray="3 3" />
          <XAxis dataKey="t" tick={{ fill: '#9fb0c9', fontSize: 11 }} minTickGap={48} />
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
            formatter={(value) => (value == null ? '—' : Number(value).toFixed(2))}
          />
          <Legend wrapperStyle={{ color: '#9fb0c9' }} />
          {splitDate && (
            <ReferenceLine
              x={splitDate}
              stroke="#9fb0c9"
              strokeDasharray="4 4"
              label={{
                value: '← train | test →',
                fill: '#9fb0c9',
                fontSize: 11,
                position: 'insideTop',
                dy: -14,
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="actual"
            name={`${targetLabel} (actual lab)`}
            stroke={targetColor}
            dot={false}
            strokeWidth={2}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="predicted"
            name="Model prediction"
            stroke="#4ea1ff"
            dot={false}
            strokeWidth={1.5}
            strokeDasharray="5 3"
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
