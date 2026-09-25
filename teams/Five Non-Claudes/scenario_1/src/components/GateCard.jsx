import React, { useMemo, useState } from 'react'
import { GATES, PRIMARY_GATE, gateBand, murkyLayer, primaryGateCheck, profileAgeDays, STALE_DAYS } from '../lib/sondeProfile.js'
import SondeChart, { GatePicker } from './SondeChart.jsx'

const DAY_FMT = { month: 'short', day: 'numeric', timeZone: 'UTC' }
const dayLabel = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', DAY_FMT)

/**
 * The "Do today" intake-gate card: one verdict on the primary gate, the depth chart
 * with a reading for the picked gate, and a link to the full sonde panel on the
 * River map. Like SondeProfile it flags
 * the primary gate and never picks another, since Denver Water prefers it for
 * reasons the sonde doesn't measure. The sonde is archived, so its age is always on
 * show, and past STALE_DAYS the verdict reads as last known, not today.
 */
export default function GateCard({ profile, now, onOpenProfile }) {
  const { bands } = profile
  const check = useMemo(() => primaryGateCheck(bands), [bands])
  const murky = useMemo(() => murkyLayer(bands), [bands])
  const [gateId, setGateId] = useState(PRIMARY_GATE.id)
  const picked = GATES.find((g) => g.id === gateId)
  const at = gateBand(bands, picked)
  const pickedMurky = !!murky && at.top >= murky.top && at.bottom <= murky.bottom

  const age = profileAgeDays(profile, now)
  const stale = age > STALE_DAYS
  const week = `${dayLabel(profile.from)}–${dayLabel(profile.to)}`
  const gate = `${check.gate.label} ★`
  const verdict = check.murky ? `check the ${gate} gate` : `${gate} gate looks normal`
  const ntu = (v) => `${v.toFixed(1)} NTU`

  return (
    <div className={`gate-card${check.murky ? ' look' : ''}${stale ? ' stale' : ''}`} data-testid="gate-card">
      <div className="gate-head">
        <span className={stale ? 'gate-age stale' : 'gate-age'}>
          {stale ? `Archived · ${age} days old` : 'Sonde'}
        </span>
        <span className="gate-week">casts {week}</span>
      </div>
      <div className="gate-body">
        <SondeChart bands={bands} gateId={gateId} onPick={setGateId} picker={false} />
        <div className="gate-side">
          <div className="gate-verdict">
            {stale ? `Last known: ${verdict}` : verdict[0].toUpperCase() + verdict.slice(1)}
          </div>
          <p className="gate-why">
            {check.murky
              ? `In the reservoir it sat in a murky layer, typically ${ntu(check.turbidity)}. Clearest gate: ${check.clearest.label} at ${ntu(check.clearestTurbidity)}.`
              : `In the reservoir it typically read ${ntu(check.turbidity)}, outside any murky layer.`}
          </p>
          <GatePicker gateId={gateId} onPick={setGateId} />
          <p className="gate-at" aria-live="polite">
            At {picked.label}{picked.primary ? ' ★' : ''}: typically {ntu(at.turbidity[1])}
            {picked.id === check.clearest.id ? ', the clearest gate' : pickedMurky ? ', in the murky layer' : ''}
          </p>
          <div className="gate-foot">
            {onOpenProfile && (
              <button type="button" className="gate-link" onClick={onOpenProfile}>
                Temperature, conductivity and chlorophyll by gate on the River map →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
