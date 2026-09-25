import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { loadSeries } from './lib/dataLayer.js'
import { pairedDataset, TARGETS, FEATURES } from './lib/features.js'
import { fitAndScore } from './lib/regression.js'
import { compareSources } from './lib/compareSources.js'
import Controls from './components/Controls.jsx'
import PredictionChart from './components/PredictionChart.jsx'
import ScorePanel from './components/ScorePanel.jsx'
import PredictorPanel from './components/PredictorPanel.jsx'
import SourceComparison from './components/SourceComparison.jsx'
import LiveBadge from './components/LiveBadge.jsx'
import DataTerms from './components/DataTerms.jsx'
import LiveForecast from './components/LiveForecast.jsx'
import RiverMap from './components/RiverMap.jsx'

const TARGET_COLORS = { toc: '#ffb454', alk: '#4ecab0' }

const TABS = [
  { id: 'forecast', label: 'Live forecast' },
  { id: 'map', label: 'River map' },
  { id: 'explorer', label: 'Explorer' },
]

export default function App() {
  const [doc, setDoc] = useState(null)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('forecast')
  // Set when a link on one tab points at a section on another; scrolled to once
  // that tab has rendered.
  const [scrollTo, setScrollTo] = useState(null)

  useEffect(() => {
    if (!scrollTo) return
    document.getElementById(scrollTo)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setScrollTo(null)
  }, [tab, scrollTo])

  const openSondeProfile = () => {
    setTab('map')
    setScrollTo('sonde-title')
  }

  useEffect(() => {
    loadSeries()
      .then(setDoc)
      .catch((e) => setError(e.message))
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>TOC &amp; Alkalinity Prediction Viewer</h1>
          <p className="subtitle">
            Design Storm 2026 · Denver Water · Team Five Non-Claudes
          </p>
        </div>
        <LiveBadge paramKey="turbidity" />
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {error && <p className="error">Could not load data: {error}</p>}
        {!doc && !error && <p className="placeholder">Loading bundled data…</p>}
        {doc && tab === 'forecast' && <LiveForecast doc={doc} onOpenSondeProfile={openSondeProfile} />}
        {doc && tab === 'map' && <RiverMap doc={doc} />}
        {doc && tab === 'explorer' && <PredictionView doc={doc} />}
      </main>

      <DataTerms provisionalNote={doc?._meta?.provisional_note} />
    </div>
  )
}

export function PredictionView({ doc }) {
  const { series, _meta } = doc

  const [targetName, setTargetName] = useState('toc')
  const [featureName, setFeatureName] = useState(TARGETS.toc.defaultFeature)
  const [lag, setLag] = useState(TARGETS.toc.defaultLag)

  // Switching the target resets the feature and lag to that target's sensible
  // defaults (TOC -> turb_flow @2, alkalinity -> conductance @4).
  const handleTargetChange = useCallback((key) => {
    setTargetName(key)
    setFeatureName(TARGETS[key].defaultFeature)
    setLag(TARGETS[key].defaultLag)
  }, [])

  const result = useMemo(() => {
    const pairs = pairedDataset(series, targetName, featureName, lag)
    return { pairs, ...fitAndScore(pairs) }
  }, [series, targetName, featureName, lag])

  // The starred thread: upstream gage vs Strontia sonde for this target. Depends only
  // on the target, not the current feature/lag, so it re-runs only when the target
  // toggles.
  const comparison = useMemo(
    () => compareSources(series, targetName),
    [series, targetName],
  )

  const unit = _meta.units[targetName]

  // Share the prediction's date range with the predictor charts so all x-axes line
  // up. Derived from the fitted (matched) rows.
  const dateDomain =
    result.fitted.length > 0
      ? [result.fitted[0].t, result.fitted[result.fitted.length - 1].t]
      : null

  return (
    <section>
      <Controls
        targetName={targetName}
        featureName={featureName}
        lag={lag}
        onTargetChange={handleTargetChange}
        onFeatureChange={setFeatureName}
        onLagChange={setLag}
      />
      <div className="layout">
        <div className="layout-main">
          <PredictionChart
            fitted={result.fitted}
            splitDate={result.splitDate}
            targetColor={TARGET_COLORS[targetName]}
            unit={unit}
            targetLabel={TARGETS[targetName].label}
          />
          <ScorePanel
            model={result.model}
            train={result.train}
            test={result.test}
            targetName={targetName}
            featureName={featureName}
            unit={unit}
          />
          <p className="note">
            {TARGETS[targetName].label} predicted from {FEATURES[featureName].label},
            lagged {lag} {lag === 1 ? 'day' : 'days'}. {result.pairs.length} matched
            days. Drag the lead-time slider to trade warning time against accuracy.
          </p>
        </div>
        <PredictorPanel
          series={series}
          meta={_meta}
          activeFeature={featureName}
          dateDomain={dateDomain}
        />
      </div>
      <SourceComparison comparison={comparison} unit={unit} />
    </section>
  )
}
