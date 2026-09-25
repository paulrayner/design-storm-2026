import React, { useMemo } from 'react'
import { useLiveInputs } from '../lib/useLiveInputs.js'
import { riverOutlook } from '../lib/riverOutlook.js'
import { DEFAULT_THRESHOLDS } from '../lib/recommend.js'
import geo from '../riverMap/geometry.json'
import SondeProfile from './SondeProfile.jsx'

const DAY_FMT = { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }
const dayLabel = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', DAY_FMT)

function sourceText(r) {
  if (!r || r.source === 'none') return 'no data'
  if (r.source === 'live') return 'live'
  return `archived ${r.dateTime}`
}

function Badge({ n }) {
  return <span className="map-badge" aria-hidden="true">{n}</span>
}

function Value({ label, f, digits, threshold }) {
  if (!f) return <div className="map-value muted">{label}: no forecast</div>
  const word = threshold.direction === 'above' ? 'Above' : 'At or below'
  return (
    <div className="map-value">
      <span className="map-value-label">{label}</span>
      <span className="map-value-num">{f.predicted.toFixed(digits)} mg/L</span>
      <span className="map-value-range">± {f.rmse.toFixed(digits)}</span>
      {f.flag && (
        <span className={`map-flag ${f.flag.tier}`}>
          <span aria-hidden="true">▲</span> {word} {f.flag.line}
        </span>
      )}
    </div>
  )
}

/**
 * The River map tab: what is coming down the South Platte, told as stops on a map.
 * Cards run left to right from today to furthest ahead; numbered cards match
 * numbered pins; a pin marks where that stop's readings are
 * taken, not how far the water has travelled.
 */
export default function RiverMap({ doc, fetchImpl }) {
  const { series } = doc
  const { loading, resolved } = useLiveInputs(series, fetchImpl)
  const thresholds = DEFAULT_THRESHOLDS
  const outlook = useMemo(() => riverOutlook(series, resolved, thresholds), [series, resolved, thresholds])
  const [in2, in4] = outlook.ahead
  const { estimate, lastLab } = outlook.today

  return (
    <section className="river-map" data-testid="river-map">
      {loading && <p className="placeholder">Fetching current upstream conditions…</p>}

      <div className="map-cards">
        <article className="map-card map-card-today" aria-labelledby="stop-1">
          <div className="map-card-head"><Badge n="1" /><span className="map-chip map-chip-today">Today</span></div>
          <h3 id="stop-1">Foothills Plant</h3>
          <Value label="TOC" f={estimate.toc} digits={1} threshold={thresholds.toc} />
          <Value label="Alkalinity" f={estimate.alk} digits={0} threshold={thresholds.alk} />
          <p className="map-note">
            Estimated from today's gage readings; no lab result yet.
            {lastLab && ` Last lab sample ${dayLabel(lastLab.t)}: TOC ${lastLab.toc} mg/L, alkalinity ${lastLab.alk} mg/L.`}
          </p>
        </article>

        {[{ n: '2', f: in2 }, { n: '3', f: in4 }].map(({ n, f }) => (
          <article className="map-card" aria-labelledby={`stop-${n}`} key={n}>
            <div className="map-card-head">
              <Badge n={n} />
              <span className="map-chip">In {f.horizon} days</span>
              {f.toc && <span className="map-date">{dayLabel(f.toc.date)}</span>}
            </div>
            <h3 id={`stop-${n}`}>Arriving at the plant</h3>
            <Value label="TOC" f={f.toc} digits={1} threshold={thresholds.toc} />
            <Value label="Alkalinity" f={f.alk} digits={0} threshold={thresholds.alk} />
            <p className="map-note">From today's readings at the gage above Strontia Springs.</p>
          </article>
        ))}


        <article className="map-card" aria-labelledby="stop-4">
          <div className="map-card-head"><Badge n="4" /><span className="map-chip">Early signs</span></div>
          <h3 id="stop-4">Headwaters</h3>
          <div className="map-row">
            <span>Snowpack at Hoosier Pass</span>
            <strong>{outlook.early.swe.value != null ? `${outlook.early.swe.value.toFixed(1)} in` : '—'}</strong>
          </div>
          <div className="map-src">{sourceText(outlook.early.swe)}</div>
          <div className="map-row">
            <span>Flow at Trumbull</span>
            <strong>{outlook.early.flow.value != null ? `${Math.round(outlook.early.flow.value)} cfs` : '—'}</strong>
          </div>
          <div className="map-src">{sourceText(outlook.early.flow)}</div>
          <p className="map-note">No forecast reaches this far. A heads-up only.</p>
        </article>

      </div>

      <MapFigure />

      {doc.sonde_profile && <SondeProfile profile={doc.sonde_profile} />}

      <p className="note">
        Pins mark where each stop's readings are taken, not a travel time: water from the
        gage reaches the plant in hours, and the days of warning come from mixing in the
        reservoir. Forecasts use the same models as the Live forecast tab (± is each
        model's typical test error). A forecast of easier water is not a reason to cut
        treatment; wait for the lab.
      </p>
    </section>
  )
}

function Pin({ x, y, n, dx = 0, dy = 0 }) {
  return (
    <g transform={`translate(${x + dx} ${y + dy})`}>
      <circle r="12" className="pin-disc" />
      <text className="pin-num" textAnchor="middle" dy="4.5">{n}</text>
    </g>
  )
}

function Label({ x, y, children, anchor = 'start', strong = false }) {
  return (
    <text x={x} y={y} textAnchor={anchor} className={strong ? 'map-label strong' : 'map-label'}>
      {children}
    </text>
  )
}

function MapFigure() {
  const { main, inset } = geo
  const m = main.points
  const p = inset.points
  const [ix, iy, iw, ih] = inset.box
  const [bx0, by0, bx1, by1] = main.insetBox
  const pb = inset.plantBox
  return (
    <figure className="map-figure">
      <svg
        viewBox={geo.viewBox.join(' ')}
        role="img"
        aria-label="Map of the South Platte basin above Strontia Springs, with an enlarged view from the reservoir to the Foothills plant. Pin 1 is the Foothills plant; pins 2 and 3 are the gage above Strontia Springs; pin 4 is Hoosier Pass."
      >
        <defs>
          <clipPath id="river-inset-clip"><rect x={ix} y={iy} width={iw} height={ih} rx="14" /></clipPath>
        </defs>

        <Label x={20} y={36} strong>SOUTH PLATTE BASIN ABOVE STRONTIA SPRINGS</Label>
        <path d={main.basin} className="map-basin" />
        <path d={main.upstream} className="map-river" />
        {['cheesman', 'eleven_mile', 'antero'].map((k) => (
          <circle key={k} cx={m[k][0]} cy={m[k][1]} r="4.5" className="map-res-dot" />
        ))}
        <Label x={m.cheesman[0] + 9} y={m.cheesman[1] + 4}>Cheesman</Label>
        <Label x={m.eleven_mile[0] + 9} y={m.eleven_mile[1] + 4}>Eleven Mile</Label>
        <Label x={m.antero[0] + 9} y={m.antero[1] + 4}>Antero</Label>
        <circle cx={m.trumbull[0]} cy={m.trumbull[1]} r="5" className="map-station" />
        <Label x={m.trumbull[0] - 9} y={m.trumbull[1] + 18} anchor="end">Flow gage (Trumbull)</Label>
        <Pin x={m.hoosier[0]} y={m.hoosier[1]} n="4" />
        <Label x={m.hoosier[0] + 18} y={m.hoosier[1] + 4} strong>Hoosier Pass snow station</Label>

        <rect x={bx0} y={by0} width={bx1 - bx0} height={by1 - by0} rx="3" className="map-inset-mark" />
        <line x1={bx1} y1={by0} x2={ix} y2={iy + 14} className="map-zoom" />
        <line x1={bx1} y1={by1} x2={ix} y2={iy + ih - 14} className="map-zoom" />

        <g transform="translate(20 612)">
          <line x1="0" y1="0" x2={20 * main.pxPerKm} y2="0" className="map-scale" />
          <Label x={0} y={-8}>20 km</Label>
        </g>

        <rect x={ix} y={iy} width={iw} height={ih} rx="14" className="map-inset" />
        <g clipPath="url(#river-inset-clip)">
          <path d={inset.upstream} className="map-river wide" />
          <path d={inset.downstream} className="map-river wide downstream" />
          <path d={inset.reservoir} className="map-reservoir" />
          <path d={inset.dam} className="map-dam" />
          <line x1={p.intake[0]} y1={p.intake[1]} x2={p.plant[0]} y2={p.plant[1]} className="map-conduit" />
          <path d={inset.plant} className="map-plant" />
        </g>
        <Label x={ix + 16} y={iy + 28} strong>STRONTIA SPRINGS TO FOOTHILLS (ENLARGED)</Label>
        <g transform={`translate(${ix + iw - 28} ${iy + 34})`}>
          <path d="M0,-14 L6,6 L0,1 L-6,6 Z" className="map-north" />
          <Label x={0} y={22} anchor="middle">N</Label>
        </g>
        <Label x={p.northFork[0] - 10} y={p.northFork[1] + 26} anchor="end">North Fork joins</Label>
        <Label x={p.gage[0] + 18} y={p.gage[1] + 26} strong>Gage above Strontia Springs</Label>
        <Label x={p.gage[0] + 18} y={p.gage[1] + 42}>USGS 06707525 · every 15 min</Label>
        <Label x={p.intake[0] - 14} y={p.intake[1] - 40} anchor="end" strong>Strontia Springs Reservoir</Label>
        <Label x={p.intake[0] - 14} y={p.intake[1] - 24} anchor="end">Profiling sonde: depth view below</Label>
        <Label x={(p.intake[0] + p.plant[0]) / 2 + 12} y={(p.intake[1] + p.plant[1]) / 2 + 22}>Conduit 26 (route simplified)</Label>
        <Label x={(pb[0] + pb[2]) / 2} y={pb[1] - 12} anchor="middle" strong>Foothills Treatment Plant</Label>
        <circle cx={p.gage[0]} cy={p.gage[1]} r="5" className="map-station" />
        <Pin x={p.gage[0]} y={p.gage[1]} n="2" dx={-15} dy={-26} />
        <Pin x={p.gage[0]} y={p.gage[1]} n="3" dx={15} dy={-26} />
        <Pin x={pb[2]} y={(pb[1] + pb[3]) / 2} n="1" dx={20} dy={0} />
        <g transform={`translate(${ix + 20} ${iy + ih - 44})`}>
          <line x1="0" y1="0" x2={2 * inset.pxPerKm} y2="0" className="map-scale" />
          <Label x={0} y={-8}>2 km</Label>
        </g>
        <Label x={ix + iw} y={iy + ih + 16} anchor="end">Basin, rivers: USGS NLDI · Reservoir, plant: © OpenStreetMap contributors</Label>
      </svg>
    </figure>
  )
}
