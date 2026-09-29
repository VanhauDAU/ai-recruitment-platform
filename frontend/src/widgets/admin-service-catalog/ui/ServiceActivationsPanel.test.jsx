import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ServiceActivationsPanel from './ServiceActivationsPanel'

const mocks = vi.hoisted(() => ({
  getAdminCompanies: vi.fn(),
  getAdminServiceActivations: vi.fn(),
  getAdminServiceActivationSummary: vi.fn(),
  terminateAdminServiceActivation: vi.fn(),
  message: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@/entities/admin-company', () => ({
  getAdminCompanies: mocks.getAdminCompanies,
}))
vi.mock('@/entities/service-package', () => ({
  getAdminServiceActivations: mocks.getAdminServiceActivations,
  getAdminServiceActivationSummary: mocks.getAdminServiceActivationSummary,
  terminateAdminServiceActivation: mocks.terminateAdminServiceActivation,
}))
vi.mock('@/shared/lib/toast', () => ({ message: mocks.message }))

const activation = {
  public_id: 'jsa_active',
  company_public_id: 'co_alpha',
  company_name: 'Công ty Alpha',
  job_public_id: 'job_frontend',
  job_title: 'Kỹ sư Frontend',
  job_status: 'active',
  campaign_public_id: 'camp_product',
  campaign_name: 'Tuyển đội ngũ sản phẩm',
  package_name: 'Tin ưu tiên',
  version_number: 2,
  status: 'active',
  starts_at: '2026-08-01T01:00:00Z',
  ends_at: '2026-08-31T01:00:00Z',
  items: [{
    capability: 'sponsored_placement',
    name: 'Vị trí tài trợ',
    quantity: 1,
    remaining_quantity: 1,
    starts_at: '2026-08-01T01:00:00Z',
    ends_at: '2026-08-31T01:00:00Z',
    configuration: { placement: 'search_sponsored' },
  }],
  metrics: { impressions: 1250, views: 120, saves: 18, applies: 6 },
}

function renderPanel(props = {}) {
  return render(
    <MemoryRouter initialEntries={['/admin/app/services?tab=activations']}>
      <ServiceActivationsPanel {...props} />
    </MemoryRouter>,
  )
}

describe('ServiceActivationsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAdminCompanies.mockResolvedValue({ results: [] })
    mocks.getAdminServiceActivations.mockResolvedValue({ count: 1, results: [activation] })
    mocks.getAdminServiceActivationSummary.mockResolvedValue({
      activation_counts: { total: 4, active: 1, expired: 2, terminated: 1 },
      active_total: 1,
      metrics: activation.metrics,
      unit_counts: { available: 3, consumed: 4, expired: 1, revoked: 0 },
    })
    mocks.terminateAdminServiceActivation.mockResolvedValue({
      ...activation,
      status: 'terminated',
    })
  })

  it('shows operational summary and expands capability details without revenue claims', async () => {
    renderPanel({ canManage: true })

    expect(await screen.findByText('Kỹ sư Frontend')).toBeInTheDocument()
    expect(screen.getByText('Đang chạy thực tế')).toBeInTheDocument()
    expect(screen.getByText('3 khả dụng')).toBeInTheDocument()
    expect(screen.getAllByText('1.250').length).toBeGreaterThan(0)
    expect(screen.queryByText('Doanh thu', { exact: true })).not.toBeInTheDocument()

    fireEvent.click(document.querySelector('.ant-table-row-expand-icon'))
    expect(await screen.findByText('Quyền lợi trong gói')).toBeInTheDocument()
    expect(screen.getByText('Vị trí tài trợ')).toBeInTheDocument()
    expect(screen.getByText('placement: search_sponsored')).toBeInTheDocument()
  })

  it('keeps exact search and table ordering on the server query', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText('Kỹ sư Frontend')

    const search = screen.getByRole('searchbox', { name: 'Tìm dịch vụ theo mã' })
    await user.type(search, 'job_backend{Enter}')
    await waitFor(() => expect(mocks.getAdminServiceActivations).toHaveBeenCalledWith(
      expect.objectContaining({ job_public_id: 'job_backend', page: 1 }),
    ))

    await user.click(screen.getByRole('columnheader', { name: /Doanh nghiệp/ }))
    await waitFor(() => expect(mocks.getAdminServiceActivations).toHaveBeenCalledWith(
      expect.objectContaining({ ordering: 'company_name', job_public_id: 'job_backend' }),
    ))
  })

  it('locks the list and summary to the current job in job-detail mode', async () => {
    renderPanel({ jobPublicId: 'job_frontend', jobTitle: 'Kỹ sư Frontend' })

    expect(await screen.findByText('Dịch vụ của tin tuyển dụng')).toBeInTheDocument()
    await waitFor(() => expect(mocks.getAdminServiceActivations).toHaveBeenCalledWith(
      expect.objectContaining({ job_public_id: 'job_frontend', page: 1 }),
    ))
    expect(mocks.getAdminServiceActivationSummary).toHaveBeenCalledWith({
      job_public_id: 'job_frontend',
    })
    expect(mocks.getAdminCompanies).not.toHaveBeenCalled()
    expect(screen.queryByRole('searchbox', { name: 'Tìm dịch vụ theo mã' })).not.toBeInTheDocument()
    expect(screen.getByText(/toàn bộ lịch sử kích hoạt của Kỹ sư Frontend/i)).toBeInTheDocument()
  })

  it('requires a reason and warns that termination does not refund the unit', async () => {
    const user = userEvent.setup()
    renderPanel({ canManage: true })
    await screen.findByText('Kỹ sư Frontend')

    fireEvent.click(screen.getByText('Dừng dịch vụ').closest('button'))
    await screen.findByText('Dừng dịch vụ đang chạy')
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/không được hoàn lại vào kho lượt/i)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Dừng dịch vụ' })).toBeDisabled()

    await user.type(
      within(dialog).getByRole('textbox', { name: 'Lý do dừng dịch vụ' }),
      'Doanh nghiệp xác nhận dừng chiến dịch',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Dừng dịch vụ' }))

    await waitFor(() => expect(mocks.terminateAdminServiceActivation).toHaveBeenCalledWith(
      'jsa_active',
      'Doanh nghiệp xác nhận dừng chiến dịch',
    ))
    expect(mocks.message.success).toHaveBeenCalledWith(
      'Đã dừng dịch vụ và ghi nhận vào lịch sử.',
    )
  })
})
