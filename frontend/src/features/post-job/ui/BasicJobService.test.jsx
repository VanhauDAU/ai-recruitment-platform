import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BasicJobService from './BasicJobService'

const serviceApi = vi.hoisted(() => ({
  activateEmployerService: vi.fn(),
  getEmployerActiveServices: vi.fn(),
  getEmployerServiceInventory: vi.fn(),
  previewEmployerServiceActivation: vi.fn(),
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
  activate_by: '2026-11-01T00:00:00Z',
}

function renderService(props = {}) {
  return render(<MemoryRouter><BasicJobService {...props} /></MemoryRouter>)
}

describe('BasicJobService', () => {
  beforeEach(() => {
    Object.values(serviceApi).forEach((mock) => mock.mockReset())
    Object.values(toast.message).forEach((mock) => mock.mockReset())
    serviceApi.getEmployerServiceInventory.mockResolvedValue([])
    serviceApi.getEmployerActiveServices.mockResolvedValue([])
  })

  it('shows an active service and confirms one refresh without changing job dates', async () => {
    const user = userEvent.setup()
    serviceApi.getEmployerActiveServices.mockResolvedValue([{
      public_id: 'jsa_1',
      package_name: 'Nổi bật',
      job_title: 'Backend Engineer',
      ends_at: '2026-08-26T00:00:00Z',
      items: [{
        capability: 'job_refresh',
        name: 'Làm mới tin',
        quantity: 4,
        remaining_quantity: 3,
      }],
    }])
    serviceApi.refreshEmployerJobService.mockResolvedValue({ remaining_quantity: 2 })

    renderService({
      jobPublicId: 'job_1',
      jobStatus: 'active',
      activationEnabled: true,
      refreshEnabled: true,
    })

    expect(await screen.findByText('Dịch vụ đang chạy')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Làm mới tin/ }))
    expect(await screen.findByText(/không thay đổi ngày đăng hoặc hạn nhận hồ sơ/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Dùng 1 lượt' }))

    await waitFor(() => expect(serviceApi.refreshEmployerJobService).toHaveBeenCalledWith(
      'jsa_1',
      expect.any(String),
    ))
    expect(toast.message.success).toHaveBeenCalledWith('Tin đã được làm mới trong nhóm tài trợ.')
  })

  it('keeps the basic service concise when the company has no available unit', async () => {
    renderService()

    expect(await screen.findByText('Tin đăng cơ bản')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Xem các gói gia tăng hiệu quả' })).toBeInTheDocument()
    expect(serviceApi.getEmployerServiceInventory).not.toHaveBeenCalled()
    expect(screen.queryByText(/Thời gian hiển thị/)).not.toBeInTheDocument()
  })

  it('previews, confirms the required extension, and activates atomically', async () => {
    const user = userEvent.setup()
    serviceApi.getEmployerServiceInventory
      .mockResolvedValueOnce([unit])
      .mockResolvedValueOnce([])
    serviceApi.previewEmployerServiceActivation.mockResolvedValue({
      can_activate: true,
      blockers: [],
      starts_at: '2026-08-12T00:00:00Z',
      ends_at: '2026-08-26T00:00:00Z',
      required_application_deadline: '2026-08-26',
      deadline_extension_required: true,
      visibility_extension_days: 4,
      items: [{ name: 'Vị trí tài trợ', quantity: 1 }],
    })
    serviceApi.activateEmployerService.mockResolvedValue({ public_id: 'act_1' })

    renderService({ jobPublicId: 'job_1', jobStatus: 'active', activationEnabled: true })

    await user.click(await screen.findByRole('button', { name: 'Xem trước và kích hoạt' }))
    expect(await screen.findByText('Cần gia hạn tin để dịch vụ chạy đủ thời lượng')).toBeInTheDocument()
    expect(screen.queryByText(/Thời gian hiển thị/)).not.toBeInTheDocument()
    const activateButton = screen.getByRole('button', { name: 'Kích hoạt ngay' })
    expect(activateButton).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: /Tôi xác nhận gia hạn tin/ }))
    await user.click(activateButton)

    await waitFor(() => expect(serviceApi.activateEmployerService).toHaveBeenCalledWith(
      {
        unit_public_id: unit.public_id,
        job_public_id: 'job_1',
        confirm_extension: true,
      },
      expect.any(String),
    ))
    expect(toast.message.success).toHaveBeenCalledWith('Dịch vụ đã được kích hoạt cho tin này.')
  })
})
