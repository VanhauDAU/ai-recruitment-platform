import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { message } from '@/shared/lib/toast'
import EmailNotificationSettingsForm from './EmailNotificationSettingsForm'

const api = vi.hoisted(() => ({
  getCandidateNotificationPreferences: vi.fn(),
  updateCandidateNotificationPreferences: vi.fn(),
}))

vi.mock('@/entities/notification/candidate-notification-preferences', async (importOriginal) => ({
  ...(await importOriginal()),
  ...api,
}))

const DEFAULTS = {
  application_received_email: true,
  application_received_web: true,
  similar_jobs_in_application_email: true,
  cv_activity_email: true,
  cv_activity_web: true,
  employer_invitation_email: true,
  employer_invitation_web: true,
  configured_job_alerts: true,
  suitable_job_recommendations: false,
  followed_company_jobs: true,
  email_delivery_enabled: true,
}

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><EmailNotificationSettingsForm /></MemoryRouter>
    </QueryClientProvider>,
  )
}

function apiError(code) {
  return Object.assign(new Error(code), { response: { status: 400, data: { code } } })
}

describe('EmailNotificationSettingsForm', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset())
    api.getCandidateNotificationPreferences.mockResolvedValue(DEFAULTS)
    vi.spyOn(message, 'error').mockImplementation(() => {})
    vi.spyOn(message, 'success').mockImplementation(() => {})
  })

  afterEach(() => vi.restoreAllMocks())

  it('shows application events per channel and the mandatory result row', async () => {
    renderForm()

    const applications = await screen.findByRole('region', { name: 'Hồ sơ ứng tuyển' })
    expect(within(applications).getByRole('switch', { name: 'Email: Nộp hồ sơ thành công' })).toBeChecked()
    expect(within(applications).getByRole('switch', { name: 'Trên web: Nhà tuyển dụng xem hoặc tải CV' })).toBeChecked()
    expect(within(applications).getByText('Luôn bật')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Việc làm phù hợp với hồ sơ của bạn' })).not.toBeChecked()
    expect(screen.queryByText(/sự kiện nghề nghiệp|ưu đãi/i)).not.toBeInTheDocument()
  })

  it('saves one channel without locking the other switches', async () => {
    const user = userEvent.setup()
    let release
    api.updateCandidateNotificationPreferences.mockImplementation(
      (payload) => new Promise((resolve) => { release = () => resolve({ ...DEFAULTS, ...payload }) }),
    )
    renderForm()

    await user.click(await screen.findByRole('switch', { name: 'Trên web: Nộp hồ sơ thành công' }))

    expect(api.updateCandidateNotificationPreferences).toHaveBeenCalledWith({ application_received_web: false })
    expect(screen.getByRole('switch', { name: 'Email: Nộp hồ sơ thành công' })).toBeEnabled()
    release()
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Trên web: Nộp hồ sơ thành công' })).not.toBeChecked())
  })

  it('disables the similar-jobs option while the confirmation email is off', async () => {
    api.getCandidateNotificationPreferences.mockResolvedValue({ ...DEFAULTS, application_received_email: false })
    renderForm()

    expect(await screen.findByRole('switch', { name: 'Kèm gợi ý việc làm tương tự trong email xác nhận' })).toBeDisabled()
  })

  it('explains a refused opt-in next to the switch and keeps the server state', async () => {
    const user = userEvent.setup()
    api.updateCandidateNotificationPreferences.mockRejectedValue(apiError('consent_required'))
    renderForm()

    const toggle = await screen.findByRole('switch', { name: 'Việc làm phù hợp với hồ sơ của bạn' })
    await user.click(toggle)

    expect(await screen.findByText('Cần sự đồng ý dùng dữ liệu hồ sơ')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Đi tới cài đặt' })).toHaveAttribute('href', '/tai-khoan/cai-dat-goi-y-viec-lam')
    await waitFor(() => expect(toggle).not.toBeChecked())
    expect(message.error).not.toHaveBeenCalled()
  })

  it('warns when email is paused for the whole site', async () => {
    api.getCandidateNotificationPreferences.mockResolvedValue({ ...DEFAULTS, email_delivery_enabled: false })
    renderForm()

    expect(await screen.findByText('Email đang tạm dừng trên toàn hệ thống')).toBeInTheDocument()
  })

  it('shows a retry action when the initial request fails', async () => {
    api.getCandidateNotificationPreferences.mockRejectedValueOnce(new Error('boom'))
    renderForm()

    expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
  })
})
