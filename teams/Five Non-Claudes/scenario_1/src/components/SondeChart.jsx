import React, { useMemo, useRef } from 'react'
import { murkyLayer, GATES, gateBand } from '../lib/sondeProfile.js'

const FT_PER_M = 1 / 0.3048

// Chart geometry (SVG user units).
const W = 380
const H = 380
const PAD = { top: 26, right: 34, bottom: 34, left: 92 }
const PW = W - PAD.left - PAD.right
const PH = H - PAD.top - PAD.bottom

/**
 * Turbidity by depth in Strontia Springs Reservoir, with the intake gates marked and
 * the murky layer shaded. Tap a gate button, or click or drag on the chart, to pick a
 * gate. Shared by the River map's sonde panel and the Live forecast's gate card;
 * pass picker={false} to place the GatePicker buttons elsewhere.
 */
export default function SondeChart({ bands, gateId, onPick, picker = true }) {
  const murky = useMemo(() => murkyLayer(bands), [bands])
  const svgRef = useRef(null)

  // Everything on screen is in feet, the unit the gates are named in.
  const maxFt = bands[bands.length - 1].bottom * FT_PER_M
  const xMax = Math.ceil(Math.max(...bands.map((b) => b.turbidity[2])))
  const x = (v) => PAD.left + (v / xMax) * PW
  const y = (ft) => PAD.top + (ft / maxFt) * PH
  const yM = (m) => y(m * FT_PER_M)
  const mid = (b) => (b.top + b.bottom) / 2

  const medianPath = bands.map((b, i) => `${i ? 'L' : 'M'}${x(b.turbidity[1])},${yM(mid(b))}`).join(' ')
  const rangePath =
    bands.map((b, i) => `${i ? 'L' : 'M'}${x(b.turbidity[2])},${yM(mid(b))}`).join(' ') +
    [...bands].reverse().map((b) => `L${x(b.turbidity[0])},${yM(mid(b))}`).join(' ') + 'Z'

  // A click or drag on the chart picks the nearest gate.
  function pickFromPointer(e) {
    const r = svgRef.current.getBoundingClientRect()
    const ft = ((e.clientY - r.top) / r.height * H - PAD.top) / PH * maxFt
    const nearest = GATES.reduce((a, g) => (Math.abs(g.ft - ft) < Math.abs(a.ft - ft) ? g : a))
    onPick(nearest.id)
  }

  const xTicks = Array.from({ length: Math.floor(xMax / 2) + 1 }, (_, i) => i * 2)
  const yTicks = Array.from({ length: Math.floor(maxFt / 50) + 1 }, (_, i) => i * 50)

  return (
    <figure className="sonde-chart">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Turbidity by depth in Strontia Springs Reservoir with the intake gates marked.${murky ? ` Murky layer ${Math.round(murky.top * FT_PER_M)} to ${Math.round(murky.bottom * FT_PER_M)} ft.` : ''}`}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); pickFromPointer(e) }}
        onPointerMove={(e) => { if (e.buttons) pickFromPointer(e) }}
      >
        {murky && <rect x={PAD.left} y={yM(murky.top)} width={PW} height={yM(murky.bottom) - yM(murky.top)} className="sonde-murky-band" />}

        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line x1={x(t)} x2={x(t)} y1={PAD.top} y2={PAD.top + PH} className="sonde-grid" />
            <text x={x(t)} y={H - PAD.bottom + 16} textAnchor="middle" className="sonde-axis">{t}</text>
          </g>
        ))}
        {yTicks.map((t) => (
          <text key={`y${t}`} x={W - PAD.right + 2} y={y(t) + 4} textAnchor="start" className="sonde-axis sonde-axis-ft">{t}</text>
        ))}
        <text x={PAD.left + PW / 2} y={H - 4} textAnchor="middle" className="sonde-axis">Turbidity, NTU</text>
        <text x={PAD.left} y={14} className="sonde-axis">Surface · depth in ft</text>

        <path d={rangePath} className="sonde-range" />
        <path d={medianPath} className="sonde-median" />

        {GATES.map((g) => {
          const on = g.id === gateId
          const gy = y(g.ft)
          return (
            <g key={g.id} className={on ? 'sonde-gate on' : 'sonde-gate'}>
              <line x1={PAD.left - 6} x2={PAD.left + PW} y1={gy} y2={gy} className="sonde-gate-line" />
              <text x={PAD.left - 10} y={gy + 4} textAnchor="end" className="sonde-gate-label">
                {g.label}{g.primary ? ' ★' : ''}
              </text>
              {on && <circle cx={x(gateBand(bands, g).turbidity[1])} cy={gy} r="6" className="sonde-pick-dot" />}
            </g>
          )
        })}

        {/* Band label last, so gate lines never draw over it. */}
        {murky && <text x={PAD.left + PW - 6} y={yM(murky.top) + 14} textAnchor="end" className="sonde-band-label">Murky layer</text>}
      </svg>
      {picker && <GatePicker gateId={gateId} onPick={onPick} />}
      <figcaption className="sonde-caption">
        ★ primary gate. Line: typical turbidity at each depth; shading: the middle half
        of readings. Tap a gate or the chart.
      </figcaption>
    </figure>
  )
}

/** One button per intake gate; the chart's companion picker. */
export function GatePicker({ gateId, onPick }) {
  return (
    <div className="sonde-gates" role="radiogroup" aria-label="Intake gate">
      {GATES.map((g) => (
        <button
          key={g.id}
          type="button"
          role="radio"
          aria-checked={g.id === gateId}
          className={g.id === gateId ? 'sonde-gate-btn on' : 'sonde-gate-btn'}
          onClick={() => onPick(g.id)}
        >
          {g.label}{g.primary ? ' ★' : ''}
        </button>
      ))}
    </div>
  )
}
