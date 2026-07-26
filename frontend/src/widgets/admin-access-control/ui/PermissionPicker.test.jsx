import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import PermissionPicker from './PermissionPicker'

const permissions = [
  {
    code: 'cv_template.view',
    module: 'cv_template',
    label: 'Xem catalogue CV',
    description: 'Xem dữ liệu CV.',
    is_active: true,
    is_granted_to_role: true,
  },
  {
    code: 'cv_template.legacy',
    module: 'cv_template',
    label: 'Quyền CV cũ',
    description: 'Chỉ giữ để rollback.',
    is_active: false,
    is_granted_to_role: true,
  },
  {
    code: 'cv_template.retired',
    module: 'cv_template',
    label: 'Quyền không còn dùng',
    is_active: false,
    is_granted_to_role: false,
  },
  {
    code: 'company_update.view',
    module: 'company_update',
    label: 'Xem yêu cầu sửa công ty',
    description: 'Xem hàng chờ sửa công ty.',
    is_active: true,
    is_granted_to_role: false,
  },
  {
    code: 'company_update.review',
    module: 'company_update',
    label: 'Duyệt sửa thông tin công ty',
    description: 'Duyệt và áp dụng thay đổi.',
    is_active: true,
    is_granted_to_role: false,
  },
]

describe('PermissionPicker', () => {
  it('shows a granted deprecated permission as checked and disabled', () => {
    render(
      <PermissionPicker
        permissions={permissions}
        value={['cv_template.view', 'cv_template.legacy']}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('checkbox', { name: 'Quyền CV cũ' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Quyền CV cũ' })).toBeDisabled()
    expect(screen.getByText('Đã ngừng sử dụng')).toBeInTheDocument()
    expect(screen.queryByText('Quyền không còn dùng')).not.toBeInTheDocument()
  })

  it('returns a sorted active selection', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <PermissionPicker permissions={permissions} value={[]} onChange={onChange} />,
    )

    await user.click(screen.getByRole('checkbox', { name: 'Xem catalogue CV' }))
    expect(onChange).toHaveBeenCalledWith(['cv_template.view'])
  })

  it('searches by permission label and hides unrelated modules', async () => {
    const user = userEvent.setup()
    render(<PermissionPicker permissions={permissions} value={[]} onChange={vi.fn()} />)

    await user.type(screen.getByRole('textbox', { name: 'Tìm quyền' }), 'company_update')

    expect(screen.getByText('Duyệt sửa thông tin công ty')).toBeInTheDocument()
    expect(screen.queryByText('Xem catalogue CV')).not.toBeInTheDocument()
    expect(screen.getByText(/2 quyền phù hợp/)).toBeInTheDocument()
  })

  it('automatically adds view permission when review is selected', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<PermissionPicker permissions={permissions} value={[]} onChange={onChange} />)

    await user.click(screen.getByRole('checkbox', { name: 'Duyệt sửa thông tin công ty' }))

    expect(onChange).toHaveBeenLastCalledWith([
      'company_update.review',
      'company_update.view',
    ])
  })

  it('selects a whole permission module in one action', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<PermissionPicker permissions={permissions} value={[]} onChange={onChange} />)

    await user.click(screen.getByRole('checkbox', {
      name: 'Chọn toàn bộ Cập nhật thông tin công ty',
    }))

    expect(onChange).toHaveBeenLastCalledWith([
      'company_update.review',
      'company_update.view',
    ])
  })
})
