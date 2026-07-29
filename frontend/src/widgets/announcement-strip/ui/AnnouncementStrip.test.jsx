import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AnnouncementStrip from './AnnouncementStrip'

const { getActiveAnnouncements, useSession } = vi.hoisted(() => ({
  getActiveAnnouncements: vi.fn(),
  useSession: vi.fn(),
}))

vi.mock('@/entities/session', () => ({ useSession }))
vi.mock('@/entities/announcement', async (importOriginal) => ({
  ...(await importOriginal()),
  getActiveAnnouncements,
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
    await waitFor(() => expect(getActiveAnnouncements).toHaveBeenCalledTimes(1))
  })

  it('renders the remote feed after an anonymous session probe completes', async () => {
    useSession.mockReturnValue({ loading: false, user: null })
    getActiveAnnouncements.mockResolvedValue({
      items: [remoteItem({ message: 'Thông báo cho khách.' })],
      nextTransitionAt: null,
    })
    renderStrip()

    expect(await screen.findByText('Thông báo cho khách.')).toBeInTheDocument()
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
    await waitFor(() => expect(screen.queryByRole(
      'region',
      { name: 'Thông báo hệ thống' },
    )).not.toBeInTheDocument())
    expect(screen.getByTestId('strip-parent')).toBeInTheDocument()
  })
})
