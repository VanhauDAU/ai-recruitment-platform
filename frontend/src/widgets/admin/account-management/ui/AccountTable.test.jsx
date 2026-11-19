import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import AccountTable from './AccountTable'

const recruiter = {
  public_id: 'usr_recruiter',
  email: 'recruiter@example.com',
  full_name: 'Nhà tuyển dụng',
  role: 'employer',
  status: 'active',
  date_joined: null,
  last_activity_at: null,
  context: {
    position_title: 'Trưởng phòng nhân sự',
    company_role_label: 'Quản lý công ty',
    company: { public_id: 'com_1', name: 'Công ty Ánh Dương', tax_code: '***5678' },
    verification: { status: 'pending', status_label: 'Chờ duyệt', submitted_at: new Date(Date.now() - 5 * 36e5).toISOString(), missing_step_count: 2 },
    next_action: { code: 'verification_review', company_update_public_id: null },
  },
}

function renderTable(props = {}) {
  const handlers = { onOrderingChange: vi.fn(), onPageSizeChange: vi.fn(), onQuickView: vi.fn() }
  render(
    <MemoryRouter>
      <AccountTable
        data={{ count: 1, results: [recruiter] }}
        loading={false}
        page={1}
        ordering="-date_joined"
        recruiterOnly
        onPageChange={vi.fn()}
        onOpenDetail={vi.fn()}
        onEdit={vi.fn()}
        onSecurity={vi.fn()}
        canEdit={() => false}
        canManageSecurity={() => false}
        resultLabel="nhà tuyển dụng"
        {...handlers}
        {...props}
      />
    </MemoryRouter>,
  )
  return handlers
}

describe('AccountTable (recruiters)', () => {
  it('shows the decision columns first, with the next action as a direct link', () => {
    const { onOrderingChange } = renderTable()
    const headers = ['Nhà tuyển dụng', 'Việc cần làm', 'Xác thực', 'Công ty', 'Tài khoản']
    headers.forEach((name) => expect(screen.getAllByText(name, { selector: '.ant-table-column-title' }).length).toBeGreaterThan(0))
    expect(screen.queryByText('Thiết lập ban đầu')).not.toBeInTheDocument()

    expect(screen.getByText('Trưởng phòng nhân sự · Quản lý công ty · Tham gia Chưa có')).toBeInTheDocument()
    expect(screen.getByText('MST ***5678')).toBeInTheDocument()
    expect(screen.getByText('Chờ 5 giờ')).toBeInTheDocument()
    expect(screen.getByText('Hồ sơ xác thực chờ duyệt')).toBeInTheDocument()
    expect(screen.getByText('Chưa hoạt động')).toBeInTheDocument()
    expect(screen.getByText('Duyệt xác thực').closest('a'))
      .toHaveAttribute('href', '/admin/app/recruiters/usr_recruiter?tab=verification')

    fireEvent.click(screen.getAllByText('Việc cần làm', { selector: '.ant-table-column-title' })[0])
    expect(onOrderingChange).toHaveBeenCalledWith('next_action')
  })

  it('opens the quick view from the name', () => {
    const { onQuickView } = renderTable()
    fireEvent.click(screen.getByLabelText('Xem nhanh Nhà tuyển dụng'))
    expect(onQuickView).toHaveBeenCalledWith(recruiter)
  })
})
