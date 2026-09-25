import React, { useState } from 'react'

/**
 * The provisional-data caveat (always visible) and Denver Water's full data terms
 * (collapsible). These travel with anything built on the data.
 */
export default function DataTerms({ provisionalNote }) {
  const [open, setOpen] = useState(false)
  return (
    <footer className="data-terms">
      <p className="provisional">
        <strong>Provisional data.</strong>{' '}
        {provisionalNote ||
          'Water quality data is provisional and subject to change. USGS publishes ' +
            'immediately and revises later, so a fresh pull can differ from what is shown.'}
      </p>
      <button
        type="button"
        className="terms-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? 'Hide' : 'Show'} Denver Water data terms
      </button>
      {open && (
        <div className="terms-body">
          <p>
            The water quality data is provided "as is." Water quality data provided to
            the user is provisional and subject to change, and the user should not
            assume that the data has undergone any quality assurance or quality control
            review. Denver Water makes no warranty of any kind, express or implied,
            concerning the data, including accuracy, reliability, completeness,
            timeliness, or usefulness. Copyright 2026, Denver Water.
          </p>
          <p>
            Data from USGS, Colorado DWR, USDA NRCS, and NOAA is public domain. Full
            notices are in the repository at <code>data/TERMS.md</code>.
          </p>
        </div>
      )}
    </footer>
  )
}
