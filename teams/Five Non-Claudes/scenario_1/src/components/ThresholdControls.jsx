import React from 'react'

/**
 * Adjustable operating thresholds. TOC has a single line; alkalinity has a two-tier
 * band — a "watch" line (default 60) and a firmer "act" line (default 50, below which
 * the water becomes materially harder to treat). Denver Water's own guide questions
 * whether 60 is the number operators act on, so all are editable.
 *
 * onChange(target, key, value): key is 'value' for TOC, 'watch'/'act' for alkalinity.
 */
export default function ThresholdControls({ thresholds, onChange }) {
  return (
    <div className="threshold-controls">
      <span className="control-label">Thresholds</span>
      <label className="threshold-field">
        TOC ≥
        <input
          type="number"
          step="0.1"
          value={thresholds.toc.value}
          onChange={(e) => onChange('toc', 'value', Number(e.target.value))}
          aria-label="TOC threshold"
        />
        mg/L
      </label>
      <label className="threshold-field">
        Alkalinity watch ≤
        <input
          type="number"
          step="1"
          value={thresholds.alk.watch}
          onChange={(e) => onChange('alk', 'watch', Number(e.target.value))}
          aria-label="Alkalinity watch threshold"
        />
        mg/L
      </label>
      <label className="threshold-field">
        Alkalinity act ≤
        <input
          type="number"
          step="1"
          value={thresholds.alk.act}
          onChange={(e) => onChange('alk', 'act', Number(e.target.value))}
          aria-label="Alkalinity act threshold"
        />
        mg/L
      </label>
    </div>
  )
}
