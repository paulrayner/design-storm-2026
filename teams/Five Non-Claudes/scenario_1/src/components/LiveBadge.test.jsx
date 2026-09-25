import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import LiveBadge from './LiveBadge.jsx'

describe('LiveBadge', () => {
  it('shows the live reading when the fetch succeeds', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        value: {
          timeSeries: [
            { values: [{ value: [{ dateTime: '2026-09-24T10:00:00', value: '3.1' }] }] },
          ],
        },
      }),
    })
    render(<LiveBadge paramKey="turbidity" fetchImpl={fetchImpl} />)
    await waitFor(() =>
      expect(screen.getByTestId('live-badge').textContent).toContain('3.1'),
    )
    expect(screen.getByTestId('live-badge').textContent).toContain('FNU')
  })

  it('degrades to an offline message when the fetch fails', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'))
    render(<LiveBadge paramKey="turbidity" fetchImpl={fetchImpl} />)
    await waitFor(() =>
      expect(screen.getByTestId('live-badge').textContent).toContain('offline'),
    )
  })
})
