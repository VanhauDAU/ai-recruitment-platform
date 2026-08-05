import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AnnouncementStripBoundary from './AnnouncementStripBoundary'

const { reportAnnouncementRuntimeEvent } = vi.hoisted(() => ({
  reportAnnouncementRuntimeEvent: vi.fn(),
}))

vi.mock('@/entities/announcement', () => ({
  reportAnnouncementRuntimeEvent,
}))

function BrokenStrip() {
  throw new Error('injected render failure')
}

describe('AnnouncementStripBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the legacy label and reports only a PII-free runtime event', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    reportAnnouncementRuntimeEvent.mockResolvedValue(undefined)

    render(
      <AnnouncementStripBoundary
        fallback={<p>Banner bảo mật tương thích</p>}
        surface="candidate"
      >
        <BrokenStrip />
      </AnnouncementStripBoundary>,
    )

    expect(screen.getByText('Banner bảo mật tương thích')).toBeInTheDocument()
    expect(reportAnnouncementRuntimeEvent).toHaveBeenCalledWith({
      surface: 'candidate',
      event: 'render_error',
      reason: 'render',
    })
  })
})
