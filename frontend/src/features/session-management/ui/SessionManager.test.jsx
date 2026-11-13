import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { ConfigProvider } from 'antd'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SessionManager from './SessionManager'

const mocks = vi.hoisted(() => ({
  listSessions: vi.fn(),
  revokeOtherSessions: vi.fn(),
  revokeSession: vi.fn(),
}))

vi.mock('../api/session-management.api', () => mocks)
vi.mock('@/shared/lib/toast', () => ({ message: { error: vi.fn(), success: vi.fn() } }))

function renderManager() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  return render(
    <ConfigProvider theme={{ token: { motion: false } }}>
      <QueryClientProvider client={queryClient}>
        <SessionManager />
      </QueryClientProvider>
    </ConfigProvider>,
  )
}

describe('SessionManager confirmations', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.listSessions.mockResolvedValue([
      { id: 'current', current: true, device_label: 'Chrome trên macOS', ip_address: '127.0.0.1', last_seen_at: new Date().toISOString(), portal: 'candidate' },
      { id: 'other', current: false, device_label: 'Safari trên iPhone', ip_address: '10.0.0.2', last_seen_at: new Date().toISOString(), portal: 'candidate' },
    ])
    mocks.revokeSession.mockResolvedValue(undefined)
    mocks.revokeOtherSessions.mockResolvedValue(undefined)
  })

  it('only revokes a device after the standard confirmation is accepted', async () => {
    const user = userEvent.setup()
    renderManager()

    const deviceRow = (await screen.findByText('Safari trên iPhone')).closest('li')
    await user.click(within(deviceRow).getByRole('button', { name: 'Đăng xuất' }))

    const dialog = await screen.findByRole('dialog', { name: 'Đăng xuất thiết bị' })
    expect(within(dialog).getByText('Safari trên iPhone')).toBeInTheDocument()
    expect(mocks.revokeSession).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Đăng xuất' }))

    await waitFor(() => expect(mocks.revokeSession.mock.calls[0]?.[0]).toBe('other'))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Đăng xuất thiết bị' })).not.toBeInTheDocument())
  })
})
