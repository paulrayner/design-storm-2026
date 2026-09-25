import React from 'react'
import { trend } from '../lib/recommend.js'
import { formatWhen } from '../lib/format.js'

const DISCLAIMER =
  'Descriptive forecast only, from a simple single-feature model on provisional data. ' +
  'Not treatment guidance, and the dose above is a mock — decisions stay with the operator.'

const CHIP = { clear: 'OK', approaching: 'WATCH', breach: 'ACT' }
// The arrow says which way the forecast heads; the chip says whether that matters.
// Kept apart because "up" is bad for TOC and "down" is bad for alkalinity.
const ARROW = { up: ['↗', 'rising'], down: ['↘', 'falling'], flat: ['→', 'steady'] }

/**
 * The "Forecast summary" card, one scannable row per target: which way it heads, a
 * 7-day sparkline against its lines, and an OK / WATCH / ACT chip. Only a row that
 * needs attention says when. DESCRIPTIVE only: it states what the forecast implies
 * against each threshold and prescribes nothing (the caveat is in the ⓘ tooltip).
 *
 * @param {object} props
 * @param {{
 *   id:string, label:string, unit:string, color:string, direction:'above'|'below',
 *   points:{horizon:number, date:string, predicted:number}[],
 *   lines:{value:number, label:string}[],
 *   assessment:{level:string, firstBreachHorizon:number|null},
 * }[]} props.rows  lines run softest to firmest (e.g. watch, then act)
 */
export default function RecommendationCard({ rows }) {
  const overall = worstLevel(rows.map((r) => r.assessment.level))
  return (
    <div className={`reco-card reco-${overall}`} data-testid="reco-card">
      <div className="reco-head">
        <span className="reco-badge" data-level={overall}>
          {overall === 'breach' ? 'Act soon' : overall === 'approaching' ? 'Watch' : 'Clear'}
        </span>
        <span className="reco-title">Forecast — next 7 days</span>
        <span className="info-tag" title={DISCLAIMER} aria-label={DISCLAIMER} tabIndex={0}>ⓘ</span>
      </div>
      <ul className="signals">
        {rows.map((r) => <Signal key={r.id} row={r} />)}
      </ul>
    </div>
  )
}

function Signal({ row }) {
  const { id, label, unit, color, direction, points, lines, assessment } = row
  const { level, firstBreachHorizon } = assessment
  const t = trend(points)
  const [arrow, word] = ARROW[t?.dir ?? 'flat']
  return (
    <li className="signal" data-testid={`reco-${id}`} data-level={level}>
      <span className="signal-name">{label}</span>
      <span className="signal-trend">
        {t ? (
          <>
            <span className="signal-arrow" aria-hidden="true">{arrow}</span> {word}{' '}
            <span className="signal-values">{t.from.toFixed(2)} → {t.to.toFixed(2)} {unit}</span>
          </>
        ) : 'no forecast'}
      </span>
      <Sparkline points={points} lines={lines} color={color} />
      <span className="signal-chip" data-level={level}>{CHIP[level]}</span>
      <span className="signal-note">{note(level, firstBreachHorizon, points, lines, direction)}</span>
    </li>
  )
}

// Crossing rows say which line and when; a clear row just confirms the week.
function note(level, horizon, points, lines, direction) {
  const name = (l) => (lines.length > 1 ? `${l.value} ${l.label} line` : `${l.value} threshold`)
  if (level === 'clear') return `stays ${direction === 'above' ? 'below' : 'above'} the ${name(lines[0])} all week`
  const line = level === 'breach' ? lines[lines.length - 1] : lines[0]
  const p = points.find((q) => q.horizon === horizon)
  return `crosses ${direction} the ${name(line)} ${formatWhen(p.horizon, p.date)} · predicted ${p.predicted.toFixed(2)}`
}

const SW = 110
const SH = 30

function Sparkline({ points, lines, color }) {
  if (!points.length) return <span className="signal-spark" />
  const vals = [...points.map((p) => p.predicted), ...lines.map((l) => l.value)]
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const pad = (hi - lo) * 0.15 || 1
  const x = (i) => 3 + (i / Math.max(points.length - 1, 1)) * (SW - 6)
  const y = (v) => SH - 3 - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (SH - 6)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.predicted)}`).join(' ')
  return (
    <svg className="signal-spark" viewBox={`0 0 ${SW} ${SH}`} aria-hidden="true">
      {lines.map((l, i) => (
        // The firmest line is red; softer ones are amber.
        <line key={l.label} x1="0" x2={SW} y1={y(l.value)} y2={y(l.value)}
          className={i === lines.length - 1 ? 'spark-line act' : 'spark-line watch'} />
      ))}
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].predicted)} r="2.5" fill={color} />
    </svg>
  )
}

function worstLevel(levels) {
  if (levels.includes('breach')) return 'breach'
  if (levels.includes('approaching')) return 'approaching'
  return 'clear'
}
