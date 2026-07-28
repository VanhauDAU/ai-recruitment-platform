import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerRegister from './Register'

const {
  checkRegistrationEmail,
  executeRecaptcha,
  getProvinces,
  registerEmployer,
  setCurrentUser,
} = vi.hoisted(() => ({
  checkRegistrationEmail: vi.fn(),
  executeRecaptcha: vi.fn(),
  getProvinces: vi.fn(),
  registerEmployer: vi.fn(),
  setCurrentUser: vi.fn(),
}))

vi.mock('react-google-recaptcha-v3', () => ({
  useGoogleReCaptcha: () => ({ executeRecaptcha }),
}))

vi.mock('@/features/auth', () => ({
  AuthFormStyles: () => null,
  AuthLogo: () => <span>ProCV</span>,
  checkRegistrationEmail,
  employerPasswordValidationRule: () => Promise.resolve(),
  PasswordRequirements: () => null,
  registerEmployer,
  SocialLoginButtons: () => null,
}))

vi.mock('@/entities/location', () => ({ getProvinces }))
vi.mock('@/entities/session', () => ({
  useSession: () => ({ setCurrentUser }),
}))
vi.mock('@/entities/site-settings', () => ({
  settingText: (value) => value || '',
  useSiteSettings: () => ({
    settings: { hotline: '' },
    siteName: 'ProCV',
  }),
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/tuyendung/app/register']}>
        <EmployerRegister />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('EmployerRegister', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.scrollTo = vi.fn()
    checkRegistrationEmail.mockResolvedValue(true)
    executeRecaptcha.mockResolvedValue('captcha-token')
    getProvinces.mockResolvedValue([{ id: 1, name: 'Thành phố Hà Nội' }])
    registerEmployer.mockResolvedValue({ user: { role: 'employer' } })
  })

  it('uses Enter to continue and finish while preserving fields from both steps', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('checkbox', {
      name: 'Tôi đã đọc và đồng ý với Điều khoản dịch vụ và Chính sách quyền riêng tư.',
    }))
    await user.type(screen.getByRole('textbox', { name: 'Email đăng nhập' }), 'hr@example.com')
    await user.type(screen.getByPlaceholderText('Nhập mật khẩu'), 'Password@123')
    await user.type(screen.getByPlaceholderText('Nhập lại mật khẩu'), 'Password@123')
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('heading', {
      name: 'Thông tin nhà tuyển dụng',
    })).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Họ và tên' }), 'Nguyễn Minh Anh')
    await user.click(screen.getByRole('radio', { name: 'Nữ' }))
    await user.type(screen.getByRole('textbox', {
      name: 'Số điện thoại cá nhân',
    }), '0912345678')
    await user.click(screen.getByRole('combobox', {
      name: 'Tỉnh/Thành phố làm việc',
    }))
    await user.click(await screen.findByText('Thành phố Hà Nội'))
    await user.click(screen.getByRole('textbox', { name: 'Họ và tên' }))
    await user.keyboard('{Enter}')

    await waitFor(() => expect(registerEmployer).toHaveBeenCalledWith({
      email: 'hr@example.com',
      password: 'Password@123',
      full_name: 'Nguyễn Minh Anh',
      gender: 'female',
      contact_phone: '0912345678',
      work_location: 1,
      terms_accepted: true,
      marketing_opt_in: false,
      captcha_token: 'captcha-token',
    }))
  })
})
