import React from 'react'
import { TARGETS, FEATURES } from '../lib/features.js'

export const MAX_LAG = 7

/**
 * The interactive controls: which target to predict, which upstream feature to
 * predict it from, and how many days of lead time (lag) to give the model. Every
 * change flows up to the parent, which recomputes the fit synchronously.
 */
export default function Controls({
  targetName,
  featureName,
  lag,
  onTargetChange,
  onFeatureChange,
  onLagChange,
}) {
  return (
    <div className="controls">
      <div className="control-group" role="group" aria-label="Target">
        <span className="control-label">Predict</span>
        <div className="toggle">
          {Object.entries(TARGETS).map(([key, t]) => (
            <button
              key={key}
              type="button"
              className={`toggle-btn${key === targetName ? ' active' : ''}`}
              aria-pressed={key === targetName}
              onClick={() => onTargetChange(key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="control-group">
        <label className="control-label" htmlFor="feature-select">
          from
        </label>
        <select
          id="feature-select"
          value={featureName}
          onChange={(e) => onFeatureChange(e.target.value)}
        >
          {Object.entries(FEATURES).map(([key, f]) => (
            <option key={key} value={key}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className="control-group lag-group">
        <label className="control-label" htmlFor="lag-slider">
          lead time
        </label>
        <input
          id="lag-slider"
          type="range"
          min={0}
          max={MAX_LAG}
          step={1}
          value={lag}
          onChange={(e) => onLagChange(Number(e.target.value))}
        />
        <span className="lag-value" data-testid="lag-value">
          {lag} {lag === 1 ? 'day' : 'days'}
        </span>
      </div>
    </div>
  )
}
