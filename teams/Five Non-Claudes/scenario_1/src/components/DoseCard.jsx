import React from 'react'

const MOCK_DISCLAIMER =
  'Illustrative only. Anchored to one unverified example (≈3 mg/L TOC → ≈11 dose ' +
  'units) from the Denver Water Q&A; not a calibrated formula and not a real dose.'

/**
 * MOCK aluminum sulfate — Al2(SO4)3 — dose. The chemicals half of "Do today", above
 * the forecast. This is NOT a real dosing calculation: it is
 * a toy relation anchored to a single unverified example from the Denver Water Q&A.
 * The full caveat lives in a tooltip on the MOCK tag to keep the dashboard uncluttered.
 *
 * @param {object} props
 * @param {{rateMgL:number, grams:number, basis:number, lowAlkBump:number}|null} props.dose
 * @param {string} [props.alkLevel]  the alkalinity row's level, so the bump chip wears
 *   the same colour as the forecast row that caused it
 */
export default function DoseCard({ dose, alkLevel = 'approaching' }) {
  return (
    <div className="dose-card" data-testid="dose-card">
      <div className="dose-head">
        <span className="mock-tag" title={MOCK_DISCLAIMER} tabIndex={0} aria-label={MOCK_DISCLAIMER}>
          MOCK
        </span>
        <span className="dose-title">
          Aluminum sulfate Al₂(SO₄)₃ dose
        </span>
      </div>
      {dose ? (
        <>
          <div className="dose-value">
            ≈ {dose.rateMgL.toFixed(1)} <span className="dose-unit">mg/L</span>
            <span className="dose-grams"> (≈ {dose.grams.toFixed(3)} g per L)</span>
          </div>
          <div className="dose-basis">
            toy relation: {'~'}3.7 mg/L Al₂(SO₄)₃ per mg/L forecast TOC (basis{' '}
            {dose.basis.toFixed(2)} mg/L TOC)
          </div>
          {dose.lowAlkBump > 0 && (
            <span className="dose-driver" data-level={alkLevel}>
              ↘ low alkalinity · +{Math.round(dose.lowAlkBump * 100)}%
            </span>
          )}
        </>
      ) : (
        <div className="dose-value">— (no TOC forecast)</div>
      )}
    </div>
  )
}
