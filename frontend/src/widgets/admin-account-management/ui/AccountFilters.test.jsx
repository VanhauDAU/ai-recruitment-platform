import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import dayjs from 'dayjs'
import { describe, expect, it, vi } from 'vitest'
import AccountFilters from './AccountFilters'

const DEPARTMENTS = [{ public_id: 'dep_1', name: 'Vận hành' }]
const ROLES = [{ public_id: 'rol_1', name: 'Chuyên viên', department: { name: 'Vận hành' } }]

const baseFilters = {
  q: '',
  status: '',
  email_verified: '',
  mfa: '',
  has_active_session: '',
  department: '',
  admin_role: '',
  company: '',
  ordering: '-date_joined',
  created_range: [],
  last_login_range: [],
}

function setup(filters = {}, props = {}) {
  const onChange = vi.fn()
  const onClear = vi.fn()
  const { container } = render(
    <App>
      <AccountFilters
        filters={{ ...baseFilters, ...filters }}
        departments={DEPARTMENTS}
        roles={ROLES}
        total={128}
        loading={false}
        onChange={onChange}
        onClear={onClear}
        {...props}
      />
    </App>,
  )
  const chips = [...container.querySelectorAll('.account-filters__chip')]
  return {
    onChange,
    onClear,
    chips,
    chipLabels: chips.map((chip) => chip.textContent.trim()),
    count: container.querySelector('.account-filters__count').textContent,
  }
}

describe('AccountFilters', () => {
  it('shows the result count and no chips when nothing is filtered', () => {
    const { chips, count } = setup()

    expect(count).toContain('128 tài khoản trong phạm vi được xem')
    expect(chips).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Xóa tất cả' })).not.toBeInTheDocument()
  })

  it('summarises every active filter as a readable chip', () => {
    const { chipLabels, count } = setup({
      q: 'lan',
      status: 'active',
      mfa: 'true',
      department: 'dep_1',
      admin_role: 'rol_1',
      created_range: [dayjs('2026-01-01'), dayjs('2026-01-31')],
    })

    expect(chipLabels).toEqual([
      'Từ khóa: lan',
      'Trạng thái: Đang hoạt động',
      'Bật MFA: Có',
      'Phòng ban: Vận hành',
      'Chức danh: Chuyên viên',
      'Ngày tạo: 01/01/2026 → 31/01/2026',
    ])
    expect(count).toContain('khớp bộ lọc')
  })

  it('clears a single condition when its chip is closed', async () => {
    const { chips, onChange } = setup({ status: 'active', mfa: 'true' })

    await userEvent.click(chips[0].querySelector('.ant-tag-close-icon'))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: '', mfa: 'true' }),
    )
  })

  it('counts only advanced conditions on the filter badge', () => {
    // status nằm ở thanh lọc nhanh nên badge chỉ đếm mfa + company.
    setup(
      { status: 'active', mfa: 'true', company: 'cmp_1' },
      { recruiterOnly: true },
    )

    expect(screen.getByTitle('2')).toBeInTheDocument()
  })
})
