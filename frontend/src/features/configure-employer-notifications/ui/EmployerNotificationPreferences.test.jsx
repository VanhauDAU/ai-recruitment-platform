import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerNotificationPreferences from './EmployerNotificationPreferences'

const api = vi.hoisted(() => ({
  getEmployerNotificationPreferences: vi.fn(),
  updateEmployerNotificationPreferences: vi.fn(),
  employerNotificationKeys: {
    all: ['employer-notifications'],
    preferences: () => ['employer-notifications', 'preferences'],
  },
}))
const message = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/entities/employer-notification', () => api)
vi.mock('@/shared/lib/toast', () => ({ message }))

describe('EmployerNotificationPreferences', () => {
  beforeEach(() => {
    api.getEmployerNotificationPreferences.mockReset().mockResolvedValue({
      important_decision_email: true,
      intermediate_verification_email: true,
    })
    api.updateEmployerNotificationPreferences.mockReset().mockResolvedValue({
      important_decision_email: true,
      intermediate_verification_email: false,
    })
  })

  it('keeps important email immutable and lets employer disable intermediate email', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={client}>
        <EmployerNotificationPreferences />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Quyết định xác thực quan trọng')).toBeInTheDocument()
    const switches = screen.getAllByRole('switch')
    expect(switches[0]).toBeDisabled()
    await user.click(switches[1])
    await waitFor(() => expect(api.updateEmployerNotificationPreferences.mock.calls[0]?.[0]).toEqual({
      intermediate_verification_email: false,
    }))
  })
})
