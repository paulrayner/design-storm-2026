import React, { useMemo, useState } from 'react'
import { useLiveInputs } from '../lib/useLiveInputs.js'
import { buildForecast } from '../lib/forecast.js'
import { assess, assessBanded, DEFAULT_THRESHOLDS } from '../lib/recommend.js'
import { mockAluminumSulfateDose, valueAtHorizon } from '../lib/mockDose.js'
import { TARGETS } from '../lib/features.js'
import RecommendationCard from './RecommendationCard.jsx'
import DoseCard from './DoseCard.jsx'
import GateCard from './GateCard.jsx'
import CurrentInputs from './CurrentInputs.jsx'
import ThresholdControls from './ThresholdControls.jsx'
import ForecastChart from './ForecastChart.jsx'
import CombinedForecast from './CombinedForecast.jsx'

const TARGET_COLORS = { toc: '#ffb454', alk: '#4ecab0' }

/**
 * The live forecast dashboard. Fetches current upstream conditions, resolves each to
 * a value (live or last-bundled fallback), builds a 1-7 day forecast for TOC and
 * alkalinity, and assesses each against an adjustable threshold. fetchImpl is
 * injectable for tests. onOpenSondeProfile jumps to the full depth profile on the
 * River map.
 */
export default function LiveForecast({ doc, fetchImpl, onOpenSondeProfile }) {
  const { series } = doc
  const { loading, resolved } = useLiveInputs(series, fetchImpl)
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS)

  const forecasts = useMemo(() => {
    const toc = buildForecast(series, 'toc', 'turb_flow', resolved.turb_flow.value)
    const alk = buildForecast(series, 'alk', 'conductance', resolved.conductance.value)
    return { toc, alk }
  }, [series, resolved])

  const tocAssess = assess(forecasts.toc.points, thresholds.toc)
  const alkAssess = assessBanded(forecasts.alk.points, thresholds.alk)

  // MOCK aluminum sulfate dose from the near-term (first-horizon) forecast values.
  // Illustrative only; the mockDose module documents why this is not a real calc.
  const dose = useMemo(() => {
    const tocNow = valueAtHorizon(forecasts.toc.points, 1)
    const alkNow = valueAtHorizon(forecasts.alk.points, 1)
    return mockAluminumSulfateDose(tocNow, alkNow, thresholds.alk.watch)
  }, [forecasts, thresholds.alk.watch])

  const summaryRows = [
    {
      id: 'toc', label: TARGETS.toc.label, unit: 'mg/L', color: TARGET_COLORS.toc,
      direction: thresholds.toc.direction, points: forecasts.toc.points,
      lines: [{ value: thresholds.toc.value, label: 'threshold' }], assessment: tocAssess,
    },
    {
      id: 'alk', label: TARGETS.alk.label, unit: 'mg/L', color: TARGET_COLORS.alk,
      direction: thresholds.alk.direction, points: forecasts.alk.points,
      lines: [{ value: thresholds.alk.watch, label: 'watch' }, { value: thresholds.alk.act, label: 'act' }],
      assessment: alkAssess,
    },
  ]

  // TOC has one threshold field ('value'); alkalinity has two ('watch', 'act').
  const handleThreshold = (target, key, value) =>
    setThresholds((t) => ({ ...t, [target]: { ...t[target], [key]: value } }))

  return (
    <section className="live-forecast">
      <div className="forecast-heading">
        <h2>Foothills Water Treatment Plant — incoming water forecast</h2>
        <p className="forecast-subhead">
          TOC and alkalinity arriving at the Foothills influent, from current upstream
          conditions on the South Platte above Strontia Springs.
        </p>
      </div>

      {loading && <p className="placeholder">Fetching current upstream conditions…</p>}

      <section className="do-today" aria-labelledby="do-today-title">
        <h3 id="do-today-title" className="section-title">Do today</h3>
        <div className="do-today-grid">
          <div className="do-col">
            <div className="do-col-label">Chemicals</div>
            <DoseCard dose={dose} alkLevel={alkAssess.level} />
            <RecommendationCard rows={summaryRows} />
          </div>
          {doc.sonde_profile && (
            <div className="do-col">
              <div className="do-col-label">Intake gate</div>
              <GateCard profile={doc.sonde_profile} onOpenProfile={onOpenSondeProfile} />
            </div>
          )}
        </div>
      </section>


      <CurrentInputs resolved={resolved} />

      <ThresholdControls thresholds={thresholds} onChange={handleThreshold} />

      <div className="forecast-grid">
        <ForecastChart
          points={forecasts.toc.points}
          thresholds={[{ value: thresholds.toc.value, label: 'threshold', color: '#ff8a8a' }]}
          color={TARGET_COLORS.toc}
          unit="mg/L"
          label={TARGETS.toc.label}
        />
        <ForecastChart
          points={forecasts.alk.points}
          thresholds={[
            { value: thresholds.alk.watch, label: 'watch', color: '#ffd27a' },
            { value: thresholds.alk.act, label: 'act', color: '#ff8a8a' },
          ]}
          color={TARGET_COLORS.alk}
          unit="mg/L"
          label={TARGETS.alk.label}
        />
      </div>

      <CombinedForecast tocPoints={forecasts.toc.points} alkPoints={forecasts.alk.points} />

      <p className="note">
        Each horizon uses its own model (feature lagged that many days), applied to
        today's reading. The shaded band is that horizon's historical test error
        (±RMSE). Longer horizons mean more warning but usually wider bands.
      </p>
    </section>
  )
}
