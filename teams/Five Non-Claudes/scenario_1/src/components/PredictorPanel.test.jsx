import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PredictorPanel from './PredictorPanel.jsx'

const meta = {
  labels: {
    swe: 'Snowpack SWE',
    flow: 'Streamflow',
    turbidity: 'Turbidity',
    conductance: 'Specific conductance',
    precip: 'Precipitation',
  },
  units: { swe: 'in', flow: 'cfs', turbidity: 'FNU', conductance: 'µS/cm', precip: 'in' },
}

const series = {
  swe: [{ t: '2022-04-01', v: 10 }],
  flow: [{ t: '2022-04-01', v: 200 }],
  turbidity: [{ t: '2022-04-01', v: 2 }],
  conductance: [{ t: '2022-04-01', v: 300 }],
  precip: [{ t: '2022-04-01', v: 0 }],
}

describe('PredictorPanel', () => {
  it('renders a chart for each upstream signal', () => {
    render(<PredictorPanel series={series} meta={meta} activeFeature="flow" />)
    expect(screen.getByText('Snowpack SWE')).toBeInTheDocument()
    expect(screen.getByText('Streamflow')).toBeInTheDocument()
    expect(screen.getByText('Turbidity')).toBeInTheDocument()
    expect(screen.getByText('Specific conductance')).toBeInTheDocument()
    expect(screen.getByText('Precipitation')).toBeInTheDocument()
  })

  it('highlights the active feature chart', () => {
    const { container } = render(
      <PredictorPanel series={series} meta={meta} activeFeature="conductance" />,
    )
    const active = container.querySelectorAll('.predictor-chart.active')
    expect(active).toHaveLength(1)
  })
})
