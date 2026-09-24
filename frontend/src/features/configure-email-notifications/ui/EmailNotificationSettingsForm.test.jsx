import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { message } from '@/shared/lib/toast'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EmailNotificationSettingsForm from './EmailNotificationSettingsForm'

const notificationApi = vi.hoisted(() => ({
  candidateNotificationPreferenceKeys: {
    preferences: () => ['candidate-notification-preferences', 'preferences'],
  },
  candidateNotificationPreferenceMutationKey: ['candidate-notification-preferences', 'update'],
  candidateNotificationPreferenceMutationScope: { id: 'candidate-notification-preferences-update' },
  getCandidateNotificationPreferences: vi.fn(),
  updateCandidateNotificationPreferences: vi.fn(),
}))

vi.mock('@/entities/candidate-notification-preferences', () => notificationApi)

const ALL_ENABLED = {
  important_system_updates: true,
  employer_viewed_cv: true,
  new_features_and_cv_templates: true,
  other_system_notifications: true,
  configured_job_alerts: true,
  suitable_job_recommendations: true,
  top_candidate_alerts: true,
  employer_invitations: true,
  job_and_career_events: true,
  service_introductions: true,
  program_and_event_introductions: true,
  partner_gifts_and_discounts: true,
}

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <EmailNotificationSettingsForm />
    </QueryClientProvider>,
  )
}

describe('EmailNotificationSettingsForm', () => {
  beforeEach(() => {
    notificationApi.getCandidateNotificationPreferences.mockReset()
    notificationApi.updateCandidateNotificationPreferences.mockReset()
    notificationApi.getCandidateNotificationPreferences.mockResolvedValue(ALL_ENABLED)
    vi.spyOn(message, 'error').mockImplementation(() => {})
    vi.spyOn(message, 'success').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the three compact groups with every preference enabled by default', async () => {
    renderForm()

    expect(await screen.findByText('Thông báo từ hệ thống')).toBeInTheDocument()
    expect(screen.getByText('Thông báo cơ hội việc làm')).toBeInTheDocument()
    expect(screen.getByText('Thông báo giới thiệu dịch vụ')).toBeInTheDocument()
    expect(screen.getAllByRole('switch')).toHaveLength(12)
    screen.getAllByRole('switch').forEach((item) => expect(item).toBeChecked())
    expect(screen.queryByText('Email bảo mật luôn được bật')).not.toBeInTheDocument()
  })

  it('saves a disabled preference silently', async () => {
    const user = userEvent.setup()
    notificationApi.getCandidateNotificationPreferences
      .mockResolvedValueOnce(ALL_ENABLED)
      .mockResolvedValue({ ...ALL_ENABLED, suitable_job_recommendations: false })
    notificationApi.updateCandidateNotificationPreferences.mockResolvedValue({
      suitable_job_recommendations: false,
    })
    renderForm()

    const recommendationSwitch = await screen.findByRole(
      'switch',
      { name: 'Thông báo việc làm phù hợp' },
    )
    await user.click(recommendationSwitch)

    await waitFor(() => expect(recommendationSwitch).not.toBeChecked())
    await waitFor(() => {
      expect(notificationApi.updateCandidateNotificationPreferences).toHaveBeenCalledWith({
        suitable_job_recommendations: false,
      })
    })
    expect(screen.queryByText('Đã lưu tự động')).not.toBeInTheDocument()
    expect(message.success).not.toHaveBeenCalled()
  })

  it('shows a toast only after enabling a preference', async () => {
    const user = userEvent.setup()
    notificationApi.getCandidateNotificationPreferences
      .mockResolvedValueOnce({
        ...ALL_ENABLED,
        suitable_job_recommendations: false,
      })
      .mockResolvedValue(ALL_ENABLED)
    notificationApi.updateCandidateNotificationPreferences.mockResolvedValue({
      suitable_job_recommendations: true,
    })
    renderForm()

    await user.click(await screen.findByRole('switch', { name: 'Thông báo việc làm phù hợp' }))

    await waitFor(() => {
      expect(message.success).toHaveBeenCalledWith('Đã bật: Thông báo việc làm phù hợp.')
    })
  })

  it('rolls back the switch when the PATCH request fails', async () => {
    const user = userEvent.setup()
    notificationApi.updateCandidateNotificationPreferences.mockRejectedValue({
      response: { status: 400, data: { detail: 'Không thể cập nhật lúc này.' } },
    })
    renderForm()

    const configuredJobSwitch = await screen.findByRole('switch', { name: 'Việc làm theo thiết lập' })
    await user.click(configuredJobSwitch)

    await waitFor(() => expect(configuredJobSwitch).toBeChecked())
    expect(message.error).toHaveBeenCalledWith('Không thể cập nhật lúc này.')
  })

  it('shows a retry action when the initial request fails', async () => {
    const user = userEvent.setup()
    notificationApi.getCandidateNotificationPreferences
      .mockRejectedValueOnce({ response: { status: 503, data: {} } })
      .mockResolvedValueOnce(ALL_ENABLED)

    renderForm()

    expect(await screen.findByText('Chưa tải được cài đặt nhận email')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))

    expect(await screen.findByText('Thông báo từ hệ thống')).toBeInTheDocument()
    expect(notificationApi.getCandidateNotificationPreferences).toHaveBeenCalledTimes(2)
  })
})
