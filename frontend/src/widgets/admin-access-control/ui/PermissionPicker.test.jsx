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
})
