import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { jobKeys } from '@/entities/job'
import JobServiceManager from './JobServiceManager'

const serviceApi = vi.hoisted(() => ({
  activateEmployerService: vi.fn(),
  createEmployerJobAlert: vi.fn(),
  getEmployerActiveServices: vi.fn(),
  getEmployerServiceHistory: vi.fn(),
  getEmployerServiceInventory: vi.fn(),
  previewEmployerServiceActivation: vi.fn(),
  previewEmployerJobAlert: vi.fn(),
  refreshEmployerJobService: vi.fn(),
}))
const toast = vi.hoisted(() => ({
  message: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@/entities/service-package', () => serviceApi)
vi.mock('@/shared/lib/toast', () => toast)

const unit = {
  public_id: 'seu_priority',
  package_name: 'Ưu tiên',
  status: 'available',
  is_activatable: true,
  activate_by: '2026-11-01T00:00:00Z',
}

function renderManager(props = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <JobServiceManager {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...view, queryClient }
}

describe('JobServiceManager', () => {
  beforeEach(() => {
    Object.values(serviceApi).forEach((mock) => mock.mockReset())
    Object.values(toast.message).forEach((mock) => mock.mockReset())
    serviceApi.getEmployerServiceInventory.mockResolvedValue([])
    serviceApi.getEmployerActiveServices.mockResolvedValue([])
    serviceApi.getEmployerServiceHistory.mockResolvedValue({ count: 0, results: [] })
  })

  it('shows attributed sponsored metrics and consumes one refresh explicitly', async () => {
    serviceApi.getEmployerServiceHistory.mockResolvedValue({ count: 1, results: [{
      public_id: 'jsa_1',
      package_name: 'Nổi bật',
      job_public_id: 'job_1',
      job_title: 'Backend Engineer',
      job_status: 'active',
      status: 'active',
      starts_at: '2026-08-12T00:00:00Z',
      ends_at: '2026-08-26T00:00:00Z',
      metrics: { impressions: 1250, views: 120, saves: 18, applies: 6 },
      items: [
        { capability: 'sponsored_placement', name: 'Vị trí tài trợ', quantity: 1, remaining_quantity: 1 },
        { capability: 'job_refresh', name: 'Làm mới tin', quantity: 4, remaining_quantity: 3 },
      ],
    }] })
    serviceApi.refreshEmployerJobService.mockResolvedValue({ remaining_quantity: 2 })

    const { queryClient } = renderManager({
      jobPublicId: 'job_1',
      jobStatus: 'active',
      activationEnabled: true,
      refreshEnabled: true,
      metricsEnabled: true,
    })
    queryClient.setQueryData(jobKeys.list({ page: 1 }), { results: [{ public_id: 'job_1' }] })
    queryClient.setQueryData(jobKeys.list({ page: 2 }), { results: [{ public_id: 'job_2' }] })
    queryClient.setQueryData(jobKeys.list({ ordering: 'newest' }), { results: [{ public_id: 'job_3' }] })
    queryClient.setQueryData(jobKeys.employerList({ page: 1 }), { results: [{ public_id: 'job_1' }] })
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

    fireEvent.click((await screen.findByText('Chi tiết', { exact: true })).closest('button'))
    expect(await screen.findByText('1.250')).toBeInTheDocument()
    expect(screen.getByText(/không phải mức tăng thuần/i)).toBeInTheDocument()
    const refreshButtonLabel = screen.getAllByText('Làm mới tin', { exact: true })
      .find((element) => element.closest('button'))
    fireEvent.click(refreshButtonLabel.closest('button'))
    const refreshNotice = await screen.findByText(/không thay đổi ngày đăng/i)
    const refreshDialog = refreshNotice.closest('[role="dialog"]')
    fireEvent.click(within(refreshDialog).getByText('Dùng 1 lượt', { exact: true }).closest('button'))

    await waitFor(() => expect(serviceApi.refreshEmployerJobService).toHaveBeenCalledWith(
      'jsa_1',
      expect.any(String),
    ))
    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledTimes(1)
      expect(queryClient.getQueryState(jobKeys.list({ page: 1 }))?.isInvalidated).toBe(true)
      expect(queryClient.getQueryState(jobKeys.list({ page: 2 }))?.isInvalidated).toBe(true)
      expect(queryClient.getQueryState(jobKeys.list({ ordering: 'newest' }))?.isInvalidated)
        .toBe(false)
      expect(queryClient.getQueryState(jobKeys.employerList({ page: 1 }))?.isInvalidated).toBe(false)
    })
    expect(toast.message.success).toHaveBeenCalledWith(expect.stringContaining('sắp xếp Mặc định'))
  }, 15_000)

  it('does not turn a disabled rollout into a false zero-service state', () => {
    renderManager()

    expect(screen.getByText('Dịch vụ đang được mở theo từng nhóm doanh nghiệp')).toBeVisible()
    expect(screen.queryByText('0 dịch vụ')).not.toBeInTheDocument()
    expect(serviceApi.getEmployerActiveServices).not.toHaveBeenCalled()
  })

  it('previews and creates one consent-aware Job Alert dispatch', async () => {
    serviceApi.getEmployerServiceHistory.mockResolvedValue({ count: 1, results: [{
      public_id: 'jsa_alert',
      package_name: 'Nổi bật',
      job_public_id: 'job_1',
      job_title: 'Backend Engineer',
      job_status: 'active',
      status: 'active',
      starts_at: '2026-08-12T00:00:00Z',
      ends_at: '2026-08-26T00:00:00Z',
      items: [{
        capability: 'job_alert',
        name: 'Job Alert',
        quantity: 1,
        remaining_quantity: 1,
      }],
    }] })
    serviceApi.previewEmployerJobAlert.mockResolvedValue({
      can_dispatch: true,
      blockers: [],
      message: 'Chỉ gửi cho ứng viên đã chủ động tạo Job Alert phù hợp.',
    })
    serviceApi.createEmployerJobAlert.mockResolvedValue({ public_id: 'jad_1' })

    renderManager({
      jobPublicId: 'job_1',
      jobStatus: 'active',
      activationEnabled: true,
      alertEnabled: true,
    })

    fireEvent.click((await screen.findByText('Chi tiết', { exact: true })).closest('button'))
    fireEvent.click((await screen.findByText('Gửi Job Alert', { exact: true })).closest('button'))
    const alertNotice = await screen.findByText('Không cam kết số hồ sơ ứng tuyển')
    const dialog = alertNotice.closest('[role="dialog"]')
    fireEvent.click(within(dialog).getByText('Dùng 1 lượt và gửi', { exact: true }).closest('button'))

    await waitFor(() => expect(serviceApi.createEmployerJobAlert).toHaveBeenCalledWith(
      'jsa_alert',
      expect.any(String),
    ))
  }, 15_000)

  it('keeps the current deadline by default and only extends through an explicit action', async () => {
    const user = userEvent.setup()
    serviceApi.getEmployerServiceInventory.mockResolvedValue([unit])
    serviceApi.previewEmployerServiceActivation.mockResolvedValue({
      can_activate: true,
      blockers: [],
      ends_at: '2026-08-26T00:00:00Z',
      current_application_deadline: '2026-08-16',
      required_application_deadline: '2026-08-26',
      deadline_extension_required: true,
      extension_required: true,
      visibility_extension_days: 4,
    })
    renderManager({
      jobPublicId: 'job_1',
      jobStatus: 'active',
      activationEnabled: true,
    })

    await user.click(await screen.findByRole('tab', { name: /Kích hoạt thêm dịch vụ/ }))
    await user.click(await screen.findByRole('button', { name: 'Xem trước và kích hoạt' }))
    const dialog = await screen.findByRole('dialog', { name: 'Gói vượt thời hạn hiện tại của tin' })
    expect(within(dialog).getByText(/Hệ thống sẽ không tự thay đổi tin/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/lượt vẫn nằm trong kho/i)).toBeInTheDocument()
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Giữ nguyên hạn' }))
    await waitFor(() => expect(dialog).toHaveClass('ant-zoom-leave'))
    expect(serviceApi.activateEmployerService).not.toHaveBeenCalled()
  })

  it('extends the deadline only from the clearly labelled activation action', async () => {
    const user = userEvent.setup()
    serviceApi.getEmployerServiceInventory.mockResolvedValue([unit])
    serviceApi.previewEmployerServiceActivation.mockResolvedValue({
      can_activate: true,
      blockers: [],
      ends_at: '2026-08-26T00:00:00Z',
      current_application_deadline: '2026-08-16',
      required_application_deadline: '2026-08-26',
      deadline_extension_required: true,
      extension_required: true,
      visibility_extension_days: 4,
    })
    serviceApi.activateEmployerService.mockResolvedValue({ public_id: 'act_1' })

    renderManager({
      jobPublicId: 'job_1',
      jobStatus: 'active',
      activationEnabled: true,
    })
    await user.click(await screen.findByRole('tab', { name: /Kích hoạt thêm dịch vụ/ }))
    await user.click(screen.getByRole('button', { name: 'Xem trước và kích hoạt' }))
    const dialog = await screen.findByRole('dialog', { name: 'Gói vượt thời hạn hiện tại của tin' })
    await user.click(within(dialog).getByRole('button', { name: /Gia hạn đến .* và kích hoạt/ }))

    await waitFor(() => expect(serviceApi.activateEmployerService).toHaveBeenCalledWith(
      {
        unit_public_id: unit.public_id,
        job_public_id: 'job_1',
        confirm_extension: true,
      },
      expect.any(String),
    ))
  })

  it('activates without extension consent when the service fits the current deadline', async () => {
    const user = userEvent.setup()
    serviceApi.getEmployerServiceInventory.mockResolvedValue([unit])
    serviceApi.previewEmployerServiceActivation.mockResolvedValue({
      can_activate: true,
      blockers: [],
      ends_at: '2026-08-20T00:00:00Z',
      current_application_deadline: '2026-08-26',
      required_application_deadline: '2026-08-20',
      deadline_extension_required: false,
      extension_required: false,
      visibility_extension_days: 0,
    })
    serviceApi.activateEmployerService.mockResolvedValue({ public_id: 'act_2' })

    renderManager({
      jobPublicId: 'job_1',
      jobStatus: 'active',
      activationEnabled: true,
    })

    await user.click(await screen.findByRole('tab', { name: /Kích hoạt thêm dịch vụ/ }))
    await user.click(await screen.findByRole('button', { name: 'Xem trước và kích hoạt' }))
    await user.click(await screen.findByRole('button', { name: 'Kích hoạt ngay' }))

    await waitFor(() => expect(serviceApi.activateEmployerService).toHaveBeenCalledWith(
      {
        unit_public_id: unit.public_id,
        job_public_id: 'job_1',
        confirm_extension: false,
      },
      expect.any(String),
    ))
  })

  it('shows an overlap blocker and keeps the conflicting unit unused', async () => {
    const user = userEvent.setup()
    serviceApi.getEmployerServiceInventory.mockResolvedValue([unit])
    serviceApi.previewEmployerServiceActivation.mockResolvedValue({
      can_activate: false,
      blockers: [
        'Quyền lợi “Vị trí tài trợ” đang chạy trong gói “Tăng tốc” đến 10/09/2026 15:56.',
      ],
      conflicts: [{
        capability: 'sponsored_placement',
        active_package_name: 'Tăng tốc',
      }],
      ends_at: '2026-08-27T00:00:00Z',
      extension_required: false,
    })

    renderManager({
      jobPublicId: 'job_1',
      jobStatus: 'active',
      activationEnabled: true,
    })

    expect(await screen.findByText('Quy tắc kết hợp dịch vụ')).toBeVisible()
    await user.click(await screen.findByRole('tab', { name: /Kích hoạt thêm dịch vụ/ }))
    await user.click(await screen.findByRole('button', { name: 'Xem trước và kích hoạt' }))
    const dialog = await screen.findByRole('dialog', { name: 'Xác nhận kích hoạt dịch vụ' })
    expect(within(dialog).getByText(/đang chạy trong gói “Tăng tốc”/i)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Kích hoạt ngay' })).toBeDisabled()
    expect(serviceApi.activateEmployerService).not.toHaveBeenCalled()
  })
})
