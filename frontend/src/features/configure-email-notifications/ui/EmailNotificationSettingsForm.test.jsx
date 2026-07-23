import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { message } from '@/shared/lib/toast'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EmailNotificationSettingsForm from './EmailNotificationSettingsForm'

const notificationApi = vi.hoisted(() => ({
  getCandidateNotificationPreferences: vi.fn(),
  updateCandidateNotificationPreferences: vi.fn(),
}))

vi.mock('@/entities/candidate-notification-preferences', () => notificationApi)

const ALL_DISABLED = {
  important_system_updates: false,
  employer_viewed_cv: false,
  new_features_and_cv_templates: false,
  other_system_notifications: false,
  configured_job_alerts: false,
  suitable_job_recommendations: false,
  top_candidate_alerts: false,
  employer_invitations: false,
  job_and_career_events: false,
  service_introductions: false,
  program_and_event_introductions: false,
  partner_gifts_and_discounts: false,
}

describe('EmailNotificationSettingsForm', () => {
  beforeEach(() => {
    notificationApi.getCandidateNotificationPreferences.mockReset()
    notificationApi.updateCandidateNotificationPreferences.mockReset()
    notificationApi.getCandidateNotificationPreferences.mockResolvedValue(ALL_DISABLED)
    vi.spyOn(message, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders all three groups and keeps security emails enabled', async () => {
    render(<EmailNotificationSettingsForm />)

    expect(await screen.findByText('Tài khoản và hoạt động quan trọng')).toBeInTheDocument()
    expect(screen.getByText('Cơ hội việc làm dành cho bạn')).toBeInTheDocument()
    expect(screen.getByText('Nội dung, sự kiện và ưu đãi')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Email bảo mật luôn bật' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Email bảo mật luôn bật' })).toBeDisabled()
    expect(screen.getAllByRole('switch')).toHaveLength(13)
  })

  it('optimistically enables one preference and patches only that field', async () => {
    const user = userEvent.setup()
    notificationApi.updateCandidateNotificationPreferences.mockResolvedValue({
      suitable_job_recommendations: true,
    })
    render(<EmailNotificationSettingsForm />)

    const recommendationSwitch = await screen.findByRole(
      'switch',
      { name: 'Gợi ý việc làm phù hợp' },
    )
    await user.click(recommendationSwitch)

    expect(recommendationSwitch).toBeChecked()
    await waitFor(() => {
      expect(notificationApi.updateCandidateNotificationPreferences).toHaveBeenCalledWith({
        suitable_job_recommendations: true,
      })
    })
    expect(await screen.findByText('Đã lưu tự động')).toBeInTheDocument()
  })

  it('rolls back the switch when the PATCH request fails', async () => {
    const user = userEvent.setup()
    notificationApi.updateCandidateNotificationPreferences.mockRejectedValue({
      response: { status: 400, data: { detail: 'Không thể cập nhật lúc này.' } },
    })
    render(<EmailNotificationSettingsForm />)

    const configuredJobSwitch = await screen.findByRole('switch', { name: 'Việc làm theo thiết lập' })
    await user.click(configuredJobSwitch)

    await waitFor(() => expect(configuredJobSwitch).not.toBeChecked())
    expect(screen.getByRole('alert')).toHaveTextContent('Không thể cập nhật lúc này.')
    expect(message.error).toHaveBeenCalledWith('Không thể cập nhật lúc này.')
  })

  it('shows a retry action when the initial request fails', async () => {
    const user = userEvent.setup()
    notificationApi.getCandidateNotificationPreferences
      .mockRejectedValueOnce({ response: { status: 503, data: {} } })
      .mockResolvedValueOnce(ALL_DISABLED)

    render(<EmailNotificationSettingsForm />)

    expect(await screen.findByText('Chưa tải được cài đặt nhận email')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))

    expect(await screen.findByText('Tài khoản và hoạt động quan trọng')).toBeInTheDocument()
    expect(notificationApi.getCandidateNotificationPreferences).toHaveBeenCalledTimes(2)
  })
})
