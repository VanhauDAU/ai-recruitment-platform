import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Form } from 'antd'
import { describe, expect, it } from 'vitest'
import JobDescriptionFields from './JobDescriptionFields'

const benefits = [
  { id: 1, name: 'Phụ cấp ăn trưa', category: 'allowance' },
  { id: 2, name: 'Phụ cấp gửi xe', category: 'allowance' },
  { id: 3, name: 'Laptop', category: 'equipment' },
]

const badge = () => screen.getByRole('button', { name: /Thu gọn|Thêm thông tin/ }).querySelector('.bg-emerald-100')

describe('JobDescriptionFields — quyền lợi bổ sung', () => {
  it('giữ nguyên quyền lợi đã chọn sau khi thu gọn panel', async () => {
    const user = userEvent.setup()
    const formRef = {}
    function Fields() {
      formRef.current = Form.useFormInstance()
      return <JobDescriptionFields form={formRef.current} provinces={[]} benefits={benefits} />
    }
    render(<Form layout="vertical"><Fields /></Form>)

    await user.click(screen.getByRole('button', { name: /Thêm thông tin/ }))
    await user.click(screen.getByRole('button', { name: 'Phụ cấp ăn trưa' }))
    await user.click(screen.getByRole('button', { name: 'Laptop' }))
    expect(badge().textContent).toBe('2')

    await user.click(screen.getByRole('button', { name: /Thu gọn/ }))

    expect(badge().textContent).toBe('2')
    // getFieldsValue() không tham số chỉ trả về field đang đăng ký — đây cũng là payload onFinish
    // dùng khi bấm "Gửi duyệt tin", nên field không được unmount theo panel.
    expect(formRef.current.getFieldsValue().benefit_ids).toEqual([1, 3])
  })
})
