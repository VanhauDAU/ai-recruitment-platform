import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AnnouncementStrip from './AnnouncementStrip'

const {
  getActiveAnnouncements,
  queueAnnouncementEvent,
  reportAnnouncementRuntimeEvent,
  setAnnouncementState,
  useConsent,
  useSession,
} = vi.hoisted(() => ({
  getActiveAnnouncements: vi.fn(),
  queueAnnouncementEvent: vi.fn(),
  reportAnnouncementRuntimeEvent: vi.fn(),
  setAnnouncementState: vi.fn(),
  useConsent: vi.fn(),
  useSession: vi.fn(),
}))

vi.mock('@/entities/session', () => ({ useSession }))
vi.mock('@/entities/consent', () => ({ useConsent }))
vi.mock('../model/announcement-events', () => ({
  flushAnnouncementEvents: vi.fn(),
  queueAnnouncementEvent,
}))
vi.mock('@/entities/announcement', async (importOriginal) => ({
  ...(await importOriginal()),
  getActiveAnnouncements,
  reportAnnouncementRuntimeEvent,
  setAnnouncementState,
}))

function renderStrip(props = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <div data-testid="strip-parent">
          <AnnouncementStrip
            enabled
            surface="candidate"
            path="/viec-lam"
            verificationPath="/tai-khoan/xac-thuc-email"
            {...props}
          />
        </div>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function remoteItem(overrides = {}) {
  return {
    id: 'ann_remote',
    revision: 1,
    source: 'remote',
    kind: 'info',
    priorityTier: 6,
    priority: 50,
    message: 'Khám phá tính năng mới.',
    badge: 'Mới',
    icon: 'info',
    cta: null,
    animation: 'slide',
    displaySeconds: 6,
    dismiss: { mode: 'locked', version: 1, snoozeSeconds: null },
    ...overrides,
  }
}

describe('AnnouncementStrip runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.sessionStorage.clear()
    window.localStorage.clear()
    useSession.mockReturnValue({
      loading: false,
      user: {
        public_id: 'usr_candidate',
        role: 'candidate',
        email_verified: true,
        job_preferences_configured: true,
      },
    })
    getActiveAnnouncements.mockResolvedValue({
      items: [],
      nextTransitionAt: null,
      remoteEnabled: true,
    })
    reportAnnouncementRuntimeEvent.mockResolvedValue(undefined)
    setAnnouncementState.mockResolvedValue({})
    useConsent.mockReturnValue({
      consent: { analytics: false },
      status: 'ready',
    })
  })

  it('keeps the exact legacy branch when a surface rollout is disabled', () => {
    renderStrip({
      enabled: false,
      legacy: <p>Banner tương thích</p>,
    })

    expect(screen.getByText('Banner tương thích')).toBeInTheDocument()
    expect(getActiveAnnouncements).not.toHaveBeenCalled()
  })

  it('keeps the email security label when the remote feed fails', async () => {
    useSession.mockReturnValue({
      loading: false,
      user: {
        public_id: 'usr_unverified',
        role: 'candidate',
        email_verified: false,
        job_preferences_configured: false,
      },
    })
    getActiveAnnouncements.mockRejectedValue(new Error('network down'))
    renderStrip()

    expect(screen.getByText('Tài khoản của bạn chưa được xác thực email.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Xác thực ngay/ })).toHaveAttribute(
      'href',
      '/tai-khoan/xac-thuc-email',
    )
    await waitFor(() => expect(reportAnnouncementRuntimeEvent).toHaveBeenCalledWith({
      surface: 'candidate',
      event: 'feed_error',
      reason: 'network',
    }))
  })

  it('keeps the email security label when the backend kill switch is disabled', async () => {
    useSession.mockReturnValue({
      loading: false,
      user: {
        public_id: 'usr_unverified',
        role: 'candidate',
        email_verified: false,
        job_preferences_configured: false,
      },
    })
    getActiveAnnouncements.mockResolvedValue({
      items: [],
      nextTransitionAt: null,
      remoteEnabled: false,
    })
    renderStrip()

    const strip = await screen.findByRole('region', { name: 'Thông báo hệ thống' })
    expect(strip).toHaveTextContent('Tài khoản của bạn chưa được xác thực email.')
    expect(strip).toHaveAttribute('data-announcement-remote-enabled', 'false')
  })

  it('always shows the incomplete onboarding reminder despite an old local snooze', async () => {
    useSession.mockReturnValue({
      loading: false,
      user: {
        public_id: 'usr_incomplete_candidate',
        role: 'candidate',
        email_verified: true,
        job_preferences_configured: false,
      },
    })
    window.localStorage.setItem(
      'announcement-strip:system-candidate-job-preferences:v1',
      String(Date.now() + 7 * 24 * 60 * 60 * 1000),
    )

    renderStrip()

    expect(screen.getByText(
      'Hãy chia sẻ nhu cầu công việc để nhận gợi ý việc làm tốt nhất.',
    )).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Cập nhật nhu cầu/ })).toHaveAttribute(
      'href',
      '/onboard-user',
    )
    expect(screen.queryByRole('button', { name: 'Tạm ẩn thông báo' })).not.toBeInTheDocument()
  })

  it('renders the remote feed after an anonymous session probe completes', async () => {
    useSession.mockReturnValue({ loading: false, user: null })
    getActiveAnnouncements.mockResolvedValue({
      items: [remoteItem({ message: 'Thông báo cho khách.' })],
      nextTransitionAt: null,
    })
    renderStrip()

    expect(await screen.findByText('Thông báo cho khách.')).toBeInTheDocument()
    const strip = screen.getByRole('region', { name: 'Thông báo hệ thống' })
    expect(strip).toHaveAttribute('data-announcement-count', '1')
    expect(strip).toHaveStyle('--announcement-motion-period: 6s')
    expect(strip).toHaveStyle('--announcement-motion-play-state: running')
    expect(strip.querySelector('.announcement-strip__content')).toHaveClass(
      'announcement-strip__item--single',
      'announcement-strip__item--slide',
    )
    fireEvent.mouseEnter(strip)
    expect(strip).toHaveStyle('--announcement-motion-play-state: paused')
    fireEvent.mouseLeave(strip)
    expect(strip).toHaveStyle('--announcement-motion-play-state: running')
  })

  it('allows a critical remote item to supersede email verification', async () => {
    useSession.mockReturnValue({
      loading: false,
      user: {
        public_id: 'usr_unverified',
        role: 'candidate',
        email_verified: false,
      },
    })
    getActiveAnnouncements.mockResolvedValue({
      items: [remoteItem({
        id: 'ann_critical',
        kind: 'critical',
        priorityTier: 1,
        message: 'Hệ thống đang gặp sự cố nghiêm trọng.',
      })],
      nextTransitionAt: null,
    })
    renderStrip()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Hệ thống đang gặp sự cố nghiêm trọng.',
    )
    expect(screen.queryByText(
      'Tài khoản của bạn chưa được xác thực email.',
    )).not.toBeInTheDocument()
  })

  it('secures external CTA and removes a closable item without breaking layout', async () => {
    getActiveAnnouncements.mockResolvedValue({
      items: [remoteItem({
        cta: {
          label: 'Xem trạng thái',
          url: 'https://status.example.com',
          external: true,
        },
        dismiss: { mode: 'close', version: 2, snoozeSeconds: null },
      })],
      nextTransitionAt: null,
    })
    renderStrip()

    const link = await screen.findByRole('link', { name: /Xem trạng thái/ })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')

    fireEvent.click(screen.getByRole('button', { name: 'Đóng thông báo' }))
    expect(setAnnouncementState).toHaveBeenCalledWith('ann_remote', {
      revision: 1,
      dismissal_version: 2,
      action: 'dismiss',
    })
    await waitFor(() => expect(screen.queryByRole(
      'region',
      { name: 'Thông báo hệ thống' },
    )).not.toBeInTheDocument())
    expect(screen.getByTestId('strip-parent')).toBeInTheDocument()
  })

  it('shows the next equal-tier item immediately before dismissing the strip', async () => {
    getActiveAnnouncements.mockResolvedValue({
      items: [
        remoteItem({
          id: 'ann_equal_a',
          message: 'Thông báo cùng hạng thứ nhất.',
          dismiss: { mode: 'snooze', version: 1, snoozeSeconds: 3600 },
        }),
        remoteItem({
          id: 'ann_equal_b',
          message: 'Thông báo cùng hạng thứ hai.',
          dismiss: { mode: 'snooze', version: 1, snoozeSeconds: 3600 },
        }),
      ],
      nextTransitionAt: null,
    })
    renderStrip()

    expect(await screen.findByText('Thông báo cùng hạng thứ nhất.')).toBeInTheDocument()
    const firstDismiss = screen.getByRole('button', { name: 'Tạm ẩn thông báo' })
    fireEvent.focus(firstDismiss)
    fireEvent.click(firstDismiss)

    const strip = screen.getByRole('region', { name: 'Thông báo hệ thống' })
    expect(strip.querySelector('.announcement-strip__message')).toHaveTextContent(
      'Thông báo cùng hạng thứ hai.',
    )
    expect(strip).toHaveAttribute('data-announcement-count', '1')
    expect(strip).toHaveStyle('--announcement-motion-play-state: paused')

    fireEvent.click(screen.getByRole('button', { name: 'Tạm ẩn thông báo' }))
    await waitFor(() => expect(screen.queryByRole(
      'region',
      { name: 'Thông báo hệ thống' },
    )).not.toBeInTheDocument())
  })

  it('tracks remote impression click and dismiss only with Analytics consent', async () => {
    useConsent.mockReturnValue({
      consent: { analytics: true },
      status: 'ready',
    })
    getActiveAnnouncements.mockResolvedValue({
      items: [remoteItem({
        cta: {
          label: 'Khám phá',
          url: '/viec-lam',
          external: false,
        },
        dismiss: { mode: 'close', version: 1, snoozeSeconds: null },
      })],
      nextTransitionAt: null,
    })
    renderStrip()

    const cta = await screen.findByRole('link', { name: /Khám phá/ })
    await waitFor(() => expect(queueAnnouncementEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ann_remote' }),
      'candidate',
      'impression',
    ))
    fireEvent.click(cta)
    fireEvent.click(screen.getByRole('button', { name: 'Đóng thông báo' }))

    expect(queueAnnouncementEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ann_remote' }),
      'candidate',
      'click',
    )
    expect(queueAnnouncementEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ann_remote' }),
      'candidate',
      'dismiss',
    )
  })
})
