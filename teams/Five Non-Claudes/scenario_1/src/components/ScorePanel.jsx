import React from 'react'
import { formatFormula, formatR2, formatError } from '../lib/format.js'

/**
 * Shows the fitted formula and the honest (test-half) scores, with the train-half
 * scores alongside for context. R² is the headline; RMSE/MAE are in the target's
 * own units.
 */
export default function ScorePanel({ model, train, test, targetName, featureName, unit }) {
  const formula = formatFormula(model, targetName, featureName)
  return (
    <div className="score-panel">
      <div className="formula" data-testid="formula">
        {formula}
      </div>
      <div className="scores">
        <ScoreBlock title="Test half (honest)" score={test} unit={unit} highlight />
        <ScoreBlock title="Train half" score={train} unit={unit} />
      </div>
      <p className="score-note">
        Trained on the earlier half of the timeline, scored on the later half it
        never saw. R² of 0 means no better than guessing the average.
      </p>
    </div>
  )
}

function ScoreBlock({ title, score, unit, highlight }) {
  return (
    <div className={`score-block${highlight ? ' highlight' : ''}`}>
      <div className="score-block-title">{title}</div>
      <div className="score-row">
        <span className="score-label">R²</span>
        <span className="score-value" data-testid={highlight ? 'test-r2' : undefined}>
          {formatR2(score.r2)}
        </span>
      </div>
      <div className="score-row">
        <span className="score-label">RMSE</span>
        <span className="score-value">{formatError(score.rmse, unit)}</span>
      </div>
      <div className="score-row">
        <span className="score-label">MAE</span>
        <span className="score-value">{formatError(score.mae, unit)}</span>
      </div>
      <div className="score-row">
        <span className="score-label">n</span>
        <span className="score-value">{score.n}</span>
      </div>
    </div>
  )
}
