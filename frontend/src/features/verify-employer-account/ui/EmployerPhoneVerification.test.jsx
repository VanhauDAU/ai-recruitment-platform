import { App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerPhoneVerification from './EmployerPhoneVerification'

const api = vi.hoisted(() => ({
  employerProfileKeys: {
    profile: ['employer', 'profile'],
    phoneChallenge: (publicId) => ['employer', 'phone-challenges', publicId],
  },
  getEmployerPhoneChallenge: vi.fn(),
  getEmployerProfile: vi.fn(),
  sendEmployerPhoneOtp: vi.fn(),
  verifyEmployerPhoneOtp: vi.fn(),
}))
const session = vi.hoisted(() => ({
  refreshSession: vi.fn(),
  user: { has_usable_password: true, phone: '' },
}))
const toast = vi.hoisted(() => ({
  message: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@/entities/employer-profile', () => api)
vi.mock('@/entities/session', () => ({
  useSession: () => session,
}))
vi.mock('@/entities/site-settings', () => ({
  settingText: (_value, fallback) => fallback,
  useSiteSettings: () => ({ settings: {} }),
}))
vi.mock('@/shared/lib/toast', () => toast)

function renderPhoneVerification() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <MemoryRouter>
      <App>
        <QueryClientProvider client={client}>
          <EmployerPhoneVerification />
        </QueryClientProvider>
      </App>
    </MemoryRouter>,
  )
}

describe('EmployerPhoneVerification', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => {
      if (typeof mock?.mockReset === 'function') mock.mockReset()
    })
    session.refreshSession.mockReset()
    session.user = { has_usable_password: true, phone: '' }
    toast.message.error.mockReset()
    toast.message.success.mockReset()
  })

  it('offers explicit phone change and voluntary re-verification after success', async () => {
    api.getEmployerProfile.mockResolvedValue({
      verified_phone: '+84912345678',
      onboarding: { phone_verified: true },
    })
    const user = userEvent.setup()
    renderPhoneVerification()

    expect(await screen.findByText('Số điện thoại đã được xác thực')).toBeVisible()
    expect(screen.getByText('+84912345678')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Đổi số điện thoại' }))

    expect(screen.getByRole('heading', { name: 'Đổi số điện thoại đã xác thực' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Quay lại' })).toBeVisible()
    expect(screen.queryByText(/gửi tới email/i)).not.toBeInTheDocument()
  })

  it('creates one SMS challenge, polls it and never calls an availability oracle', async () => {
    api.getEmployerProfile.mockResolvedValue({
      contact_phone: '0912345678',
      onboarding: { phone_verified: false },
    })
    api.sendEmployerPhoneOtp.mockResolvedValue({
      public_id: 'poc_live',
      purpose: 'initial_verification',
      status: 'queued',
      can_verify: false,
    })
    api.getEmployerPhoneChallenge.mockResolvedValue({
      public_id: 'poc_live',
      purpose: 'initial_verification',
      status: 'sent',
      can_verify: true,
    })
    const user = userEvent.setup()
    renderPhoneVerification()

    await screen.findByRole('heading', { name: 'Xác thực số điện thoại' })
    await user.click(screen.getByRole('button', { name: 'Gửi mã SMS' }))
    await user.type(await screen.findByLabelText('Mật khẩu đăng nhập'), 'Password@123')
    await user.click(screen.getByRole('button', { name: 'Xác nhận và gửi SMS' }))

    await waitFor(() => {
      expect(api.sendEmployerPhoneOtp).toHaveBeenCalledWith(
        '0912345678',
        'Password@123',
      )
      expect(api.getEmployerPhoneChallenge).toHaveBeenCalledWith('poc_live')
    })
    expect(await screen.findByText('Mã SMS đã được gửi')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Xác nhận mã SMS' })).toBeEnabled()
    expect(screen.queryByText(/email đăng nhập/i)).not.toBeInTheDocument()
  })
})
