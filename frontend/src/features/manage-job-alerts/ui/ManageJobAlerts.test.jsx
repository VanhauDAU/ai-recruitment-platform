import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ManageJobAlerts from './ManageJobAlerts'

const mocks = vi.hoisted(() => ({
  createCandidateJobAlert: vi.fn(),
  deleteCandidateJobAlert: vi.fn(),
  getCandidateJobAlerts: vi.fn(),
  getCandidateNotificationPreferences: vi.fn(),
  getJobCategories: vi.fn(),
  getProvinces: vi.fn(),
  getWards: vi.fn(),
  updateCandidateJobAlert: vi.fn(),
  updateCandidateNotificationPreferences: vi.fn(),
}))

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }))
const session = vi.hoisted(() => ({
  user: { email: 'candidate@example.com', email_verified: true },
}))

vi.mock('@/entities/candidate-job-alert', () => ({
  candidateJobAlertKeys: { list: () => ['candidate-job-alerts', 'list'] },
  createCandidateJobAlert: mocks.createCandidateJobAlert,
  deleteCandidateJobAlert: mocks.deleteCandidateJobAlert,
  getCandidateJobAlerts: mocks.getCandidateJobAlerts,
  updateCandidateJobAlert: mocks.updateCandidateJobAlert,
}))
vi.mock('@/entities/candidate-notification-preferences', () => ({
  candidateNotificationPreferenceKeys: { preferences: () => ['candidate-notification-preferences', 'preferences'] },
  candidateNotificationPreferenceMutationKey: ['candidate-notification-preferences', 'update'],
  candidateNotificationPreferenceMutationScope: { id: 'candidate-notification-preferences-update' },
  getCandidateNotificationPreferences: mocks.getCandidateNotificationPreferences,
  updateCandidateNotificationPreferences: mocks.updateCandidateNotificationPreferences,
}))
vi.mock('@/entities/job', async (importOriginal) => ({
  ...(await importOriginal()),
  getJobCategories: mocks.getJobCategories,
}))
vi.mock('@/entities/location', async (importOriginal) => ({
  ...(await importOriginal()),
  getProvinces: mocks.getProvinces,
  getWards: mocks.getWards,
}))
vi.mock('@/entities/session', () => ({
  useSession: () => ({
    user: session.user,
  }),
}))
vi.mock('@/shared/lib/toast', () => ({ message: toast }))

const ALERT = {
  public_id: 'alert_1',
  keyword: 'Frontend Developer',
  keyword_scope: 'title',
  category_ids: [3, 4],
  categories: [
    { id: 3, name: 'Frontend Developer', category_type: 'specialization' },
    { id: 4, name: 'Backend Developer', category_type: 'specialization' },
  ],
  province_id: 1,
  province: { id: 1, name: 'Hà Nội' },
  ward_id: null,
  ward: null,
  salary_bucket: '15-20',
  experience_years: '2',
  work_type: 'hybrid',
  employment_type: 'full_time',
  frequency: 'daily',
  is_active: true,
  next_delivery_at: '2026-08-12T01:00:00Z',
}

function renderFeature(props = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <App>
        <MemoryRouter>
          <ManageJobAlerts {...props} />
        </MemoryRouter>
      </App>
    </QueryClientProvider>,
  )
}

describe('ManageJobAlerts', () => {
  beforeEach(() => {
    session.user = { email: 'candidate@example.com', email_verified: true }
    Object.values(mocks).forEach((mock) => mock.mockReset())
    Object.values(toast).forEach((mock) => mock.mockReset())
    mocks.getCandidateJobAlerts.mockResolvedValue({ results: [ALERT], limit: 5, remaining: 4 })
    mocks.getCandidateNotificationPreferences.mockResolvedValue({
      configured_job_alerts: true,
      suitable_job_recommendations: true,
    })
    mocks.getJobCategories.mockResolvedValue([])
    mocks.getProvinces.mockResolvedValue([])
    mocks.getWards.mockResolvedValue([])
    mocks.updateCandidateNotificationPreferences.mockImplementation(async (payload) => ({
      configured_job_alerts: payload.configured_job_alerts ?? true,
      suitable_job_recommendations: payload.suitable_job_recommendations ?? true,
    }))
    mocks.updateCandidateJobAlert.mockImplementation(async (_publicId, payload) => ({ ...ALERT, ...payload }))
  })

  it('renders resolved alert criteria and keeps global and per-alert switches independent', async () => {
    const user = userEvent.setup()
    renderFeature()

    expect(await screen.findByRole('heading', { name: 'Quản lý thông báo việc làm' })).toBeInTheDocument()
    expect(await screen.findByText('Đã dùng 1/5 thông báo')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Frontend Developer' })).toBeInTheDocument()
    expect(screen.getByText('Backend Developer')).toBeInTheDocument()
    expect(screen.getByText('Hà Nội')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Xem danh sách việc làm Frontend Developer' })).toHaveAttribute(
      'href',
      expect.stringContaining('/viec-lam?'),
    )

    await user.click(screen.getByRole('switch', { name: 'Nhận thông báo việc làm theo thiết lập' }))
    await waitFor(() => expect(mocks.updateCandidateNotificationPreferences).toHaveBeenCalledWith({
      configured_job_alerts: false,
    }))
    expect(screen.getByRole('switch', { name: 'Nhận thông báo Frontend Developer' })).toBeChecked()
  })

  it('creates an alert with the exact write DTO and readonly candidate email', async () => {
    const user = userEvent.setup()
    mocks.getCandidateJobAlerts.mockResolvedValue({ results: [], limit: 5, remaining: 5 })
    mocks.createCandidateJobAlert.mockResolvedValue(ALERT)
    renderFeature()

    await user.click((await screen.findAllByRole('button', { name: 'Tạo thông báo việc làm mới' }))[0])
    expect(await screen.findByRole('dialog', { name: 'Tạo thông báo việc làm mới' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email nhận thông báo')).toHaveValue('candidate@example.com')
    expect(screen.getByLabelText('Email nhận thông báo')).toHaveAttribute('readonly')

    await user.type(
      screen.getByRole('textbox', { name: 'Từ khóa tìm kiếm', exact: true }),
      'Frontend Developer',
    )
    await user.click(screen.getByRole('button', { name: 'Tạo thông báo', exact: true }))

    await waitFor(() => expect(mocks.createCandidateJobAlert).toHaveBeenCalled())
    expect(mocks.createCandidateJobAlert.mock.calls[0][0]).toEqual({
      keyword: 'Frontend Developer',
      keyword_scope: 'title',
      category_ids: [],
      province_id: null,
      ward_id: null,
      salary_bucket: null,
      experience_years: null,
      work_type: null,
      employment_type: null,
      frequency: 'daily',
    })
    expect(await screen.findByRole('heading', { name: 'Frontend Developer' })).toBeInTheDocument()
  })

  it('rolls back an alert switch when the partial update fails', async () => {
    const user = userEvent.setup()
    mocks.updateCandidateJobAlert.mockRejectedValue({ response: { status: 503, data: {} } })
    renderFeature()

    const toggle = await screen.findByRole('switch', { name: 'Nhận thông báo Frontend Developer' })
    await user.click(toggle)

    await waitFor(() => expect(toggle).toBeChecked())
    expect(toast.error).toHaveBeenCalled()
  })

  it('serializes list mutations so an optimistic rollback cannot overwrite another alert', async () => {
    const user = userEvent.setup()
    const secondAlert = { ...ALERT, public_id: 'alert_2', keyword: 'Backend Developer' }
    let resolveUpdate
    mocks.getCandidateJobAlerts.mockResolvedValue({
      results: [ALERT, secondAlert],
      limit: 5,
      remaining: 3,
    })
    mocks.updateCandidateJobAlert.mockReturnValue(new Promise((resolve) => {
      resolveUpdate = resolve
    }))
    renderFeature()

    const firstToggle = await screen.findByRole('switch', {
      name: 'Nhận thông báo Frontend Developer',
    })
    const secondToggle = screen.getByRole('switch', {
      name: 'Nhận thông báo Backend Developer',
    })
    await user.click(firstToggle)

    await waitFor(() => expect(secondToggle).toBeDisabled())
    expect(screen.getByRole('button', { name: 'Xóa Backend Developer' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Tạo thông báo việc làm mới' })).toBeDisabled()

    resolveUpdate({ ...ALERT, is_active: false })
    await waitFor(() => expect(secondToggle).toBeEnabled())
  })

  it('explains why unsupported multi-value filters were not prefilled', async () => {
    mocks.getCandidateJobAlerts.mockResolvedValue({ results: [], limit: 5, remaining: 5 })
    renderFeature({
      openCreateOnMount: true,
      initialCreateValues: {
        prefillNotice: 'Địa điểm và kinh nghiệm đang chọn nhiều giá trị.',
      },
    })

    expect(await screen.findByRole('dialog', { name: 'Tạo thông báo việc làm mới' })).toBeInTheDocument()
    expect(screen.getByText('Kiểm tra lại bộ lọc chọn nhiều giá trị')).toBeInTheDocument()
    expect(screen.getByText('Địa điểm và kinh nghiệm đang chọn nhiều giá trị.')).toBeInTheDocument()
  })

  it('does not enable an email flow before the candidate verifies their address', async () => {
    const user = userEvent.setup()
    session.user = { email: 'candidate@example.com', email_verified: false }
    mocks.getCandidateNotificationPreferences.mockResolvedValue({
      configured_job_alerts: false,
      suitable_job_recommendations: false,
    })
    renderFeature()

    await user.click(await screen.findByRole('switch', { name: 'Nhận thông báo việc làm phù hợp' }))

    expect(mocks.updateCandidateNotificationPreferences).not.toHaveBeenCalled()
    expect(toast.warning).toHaveBeenCalled()
  })
})
