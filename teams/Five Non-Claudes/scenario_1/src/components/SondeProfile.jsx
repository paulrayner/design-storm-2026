import React, { useMemo, useState } from 'react'
import { murkyLayer, GATES, PRIMARY_GATE, gateBand, primaryGateCheck } from '../lib/sondeProfile.js'
import SondeChart from './SondeChart.jsx'

const DAY_FMT = { month: 'short', day: 'numeric', timeZone: 'UTC' }
const dayLabel = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', DAY_FMT)

function Reading({ label, value, unit, sub }) {
  return (
    <div className="sonde-reading">
      <span className="sonde-reading-label">{label}</span>
      <span className="sonde-reading-num">{value ?? '—'} <span className="sonde-unit">{unit}</span></span>
      {sub && <span className="sonde-reading-sub">{sub}</span>}
    </div>
  )
}

/**
 * Inside Strontia Springs Reservoir: the sonde's last week of casts by depth, with
 * the intake gates marked. Pick a gate to see what the water there looked like;
 * the panel checks whether the primary gate sat in a murky layer. Descriptive
 * only: gate choice does not feed the plant forecast.
 */
export default function SondeProfile({ profile }) {
  const { bands } = profile
  const murky = useMemo(() => murkyLayer(bands), [bands])
  const check = useMemo(() => primaryGateCheck(bands), [bands])
  const [gateId, setGateId] = useState(PRIMARY_GATE.id)

  const gate = GATES.find((g) => g.id === gateId)
  const at = gateBand(bands, gate)
  const ratio = at.turbidity[1] / check.clearestTurbidity
  const inMurky = murky && at.top >= murky.top && at.bottom <= murky.bottom

  const ntu = (v) => `${v.toFixed(1)} NTU`

  return (
    <section className="sonde-panel" aria-labelledby="sonde-title">
      <div className="map-card-head">
        <span className="map-chip">Intake gates</span>
        <span className="map-date">archived · last 7 days of sonde casts, {dayLabel(profile.from)}–{dayLabel(profile.to)}</span>
      </div>
      <h3 id="sonde-title">Inside Strontia Springs Reservoir</h3>

      <div className="sonde-body">
        <SondeChart bands={bands} gateId={gateId} onPick={setGateId} />

        <div className="sonde-side">
          <div className={check.murky ? 'sonde-suggest look' : 'sonde-suggest'}>
            <div className="sonde-suggest-label">Primary gate, {dayLabel(profile.from)}–{dayLabel(profile.to)}</div>
            <div className="sonde-suggest-num">
              {check.murky ? 'Worth a second look' : 'Looks normal'}
            </div>
            <p>
              {check.murky
                ? `The ${check.gate.label} gate sat in a murky layer, typically ${ntu(check.turbidity)}. The clearest gate was ${check.clearest.label} at ${ntu(check.clearestTurbidity)}.`
                : `The ${check.gate.label} gate typically read ${ntu(check.turbidity)}, outside any murky layer.`}
            </p>
            {gateId !== PRIMARY_GATE.id && (
              <button type="button" className="sonde-jump" onClick={() => setGateId(PRIMARY_GATE.id)}>
                Back to {PRIMARY_GATE.label}
              </button>
            )}
          </div>

          <div className="sonde-at" aria-live="polite">
            <div className="sonde-at-head">
              {gate.id === 'top' ? 'At the top intake' : `At the ${gate.label} gate`}
              {gate.primary ? ' (primary)' : ''}
            </div>
            <Reading
              label="Turbidity"
              value={at.turbidity[1].toFixed(1)}
              unit="NTU"
              sub={
                gate.id === check.clearest.id ? 'Clearest gate that week'
                  : `${ratio.toFixed(1)}× the clearest gate${inMurky ? ' · in the murky layer' : ''}`
              }
            />
            <Reading label="Temperature" value={at.temp?.toFixed(1)} unit="°C" />
            <Reading label="Conductivity" value={at.cond != null ? Math.round(at.cond) : null} unit="µS/cm" />
            <Reading label="Chlorophyll" value={at.chl?.toFixed(1)} unit="µg/L" />
          </div>
        </div>
      </div>

      <p className="map-note">
        Turbidity is only part of the choice: Denver Water prefers {PRIMARY_GATE.label} for
        reasons this panel doesn't measure. The panel flags weeks when that gate sat in murky
        water; it doesn't pick a gate. Choosing a gate does not change the plant forecasts
        above, because this season's sonde readings don't yet track the plant's lab values.
        Gate depths are from Cassidi's whiteboard sketch, taken here as feet below the actual
        surface; if they are from full pool, each gate sits shallower. The sonde is not a live
        feed here: its data ends {dayLabel(profile.to)}.
      </p>
    </section>
  )
}
