import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_FILTERS } from '../model/account-query'
import AccountList from './AccountList'

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

function renderList(props = {}) {
  const handlers = { onChange: vi.fn(), onQuickView: vi.fn(), onEdit: vi.fn() }
  render(
    <MemoryRouter>
      <AccountList
        recruiterOnly
        tiles={{ ariaLabel: 'Tổng quan nhà tuyển dụng', value: 'all', onChange: vi.fn(), items: [] }}
        toolbar={{ filters: DEFAULT_FILTERS, quickItems: [], quickValue: '', onQuick: vi.fn(), onChange: handlers.onChange, onClear: vi.fn() }}
        query={{ data: { count: 1, results: [recruiter] }, isLoading: false, isError: false }}
        page={1}
        pageSize={20}
        onPageChange={vi.fn()}
        actions={{
          onQuickView: handlers.onQuickView,
          onOpenDetail: vi.fn(),
          onEdit: handlers.onEdit,
          onSecurity: vi.fn(),
          canEdit: () => true,
          canManageSecurity: () => false,
        }}
        {...props}
      />
    </MemoryRouter>,
  )
  return handlers
}

describe('AccountList (recruiters)', () => {
  it('shows the decision columns first, with the next action as a direct link', () => {
    const { onChange } = renderList()
    const headers = ['Nhà tuyển dụng', 'Việc cần làm', 'Xác thực', 'Công ty', 'Tài khoản']
    headers.forEach((name) => expect(screen.getByText(name, { selector: '.ws-sort' })).toBeInTheDocument())

    expect(screen.getByText('Trưởng phòng nhân sự · Quản lý công ty · Tham gia Chưa có')).toBeInTheDocument()
    expect(screen.getByText('MST ***5678')).toBeInTheDocument()
    expect(screen.getByText('Chờ 5 giờ')).toBeInTheDocument()
    expect(screen.getByText('Hồ sơ xác thực chờ duyệt')).toBeInTheDocument()
    expect(screen.getByText('Chưa hoạt động')).toBeInTheDocument()
    expect(screen.getByText('Duyệt xác thực').closest('a'))
      .toHaveAttribute('href', '/quan-tri/nha-tuyen-dung/usr_recruiter?tab=verification')

    fireEvent.click(screen.getByText('Việc cần làm', { selector: '.ws-sort' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ordering: 'next_action' }))
  })

  it('opens the quick view from the name and from the row action', () => {
    const { onQuickView } = renderList()
    fireEvent.click(screen.getByLabelText('Xem nhanh Nhà tuyển dụng'))
    fireEvent.click(screen.getByText('Xem nhanh', { selector: '.wt-btn span' }))
    expect(onQuickView).toHaveBeenCalledTimes(2)
    expect(onQuickView).toHaveBeenCalledWith(recruiter)
  })

  it('lists the advanced conditions in use as removable chips', () => {
    const onChange = vi.fn()
    const filters = { ...DEFAULT_FILTERS, status: 'active', email_verified: 'true' }
    renderList({
      toolbar: { filters, quickItems: [], quickValue: '', onQuick: vi.fn(), onChange, onClear: vi.fn() },
    })

    const chip = document.querySelector('.aml-applied__chip')
    expect(chip).toHaveTextContent('Xác minh email: Có')
    expect(document.querySelectorAll('.aml-applied__chip')).toHaveLength(1)
    fireEvent.click(chip.querySelector('.ant-tag-close-icon'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ email_verified: '', status: 'active' }))
  })
})
