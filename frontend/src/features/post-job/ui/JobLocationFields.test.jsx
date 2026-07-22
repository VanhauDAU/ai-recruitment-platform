import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Form } from 'antd'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getWards } from '@/entities/location'
import JobLocationFields from './JobLocationFields'

vi.mock('@/entities/location', () => ({ getWards: vi.fn() }))

const provinces = [{ id: 1, name: 'Đà Nẵng' }]
const wards = [
  { id: 11, name: 'Phường Hải Châu' },
  { id: 12, name: 'Phường Thanh Khê' },
  { id: 13, name: 'Phường Sơn Trà' },
]

function Harness() {
  const [form] = Form.useForm()
  const [result, setResult] = useState(null)
  return (
    <Form form={form} initialValues={{ work_areas: [{ province_id: 1, workplaces: [] }] }}>
      <JobLocationFields form={form} provinces={provinces} />
      <button type="button" onClick={() => setResult(form.getFieldsValue(true))}>Đọc form</button>
      <button type="button" onClick={() => form.validateFields().catch(() => undefined)}>Kiểm tra</button>
      {result && <output>{JSON.stringify(result)}</output>}
    </Form>
  )
}

describe('JobLocationFields', () => {
  beforeEach(() => {
    getWards.mockResolvedValue(wards)
  })

  it('validates that ward is required', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><Harness /></QueryClientProvider>)

    await waitFor(() => {
      expect(screen.getAllByRole('combobox').some((element) => element.id.includes('workplaces'))).toBe(true)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra' }))

    expect(await screen.findByText('Chọn phường/xã.')).toBeInTheDocument()
  })

  it('allows the same ward on multiple rows with different addresses', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><Harness /></QueryClientProvider>)

    fireEvent.click(screen.getByText('Thêm phường/xã').closest('button'))
    fireEvent.click(await screen.findByText('Phường Hải Châu'))
    fireEvent.click(screen.getByText('Phường Thanh Khê'))
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng (2)' }))

    const wardSelects = await waitFor(() => {
      const selects = screen.getAllByRole('combobox')
        .filter((element) => element.id.includes('workplaces'))
      expect(selects).toHaveLength(2)
      return selects
    })

    const addressInputs = screen.getAllByPlaceholderText('Nhập địa điểm chi tiết...')
    fireEvent.change(addressInputs[0], { target: { value: '12 Nguyễn Huệ' } })
    fireEvent.change(addressInputs[1], { target: { value: '20 Lê Lợi' } })

    fireEvent.mouseDown(wardSelects[0].closest('.ant-select'))
    const thanhKheOptions = await screen.findAllByText('Phường Thanh Khê')
    const duplicateOption = thanhKheOptions
      .find((element) => element.classList.contains('ant-select-item-option-content'))
      .closest('.ant-select-item-option')
    expect(duplicateOption).not.toHaveClass('ant-select-item-option-disabled')
    fireEvent.click(duplicateOption)

    await waitFor(() => {
      expect(wardSelects[0].closest('.ant-select').querySelector('.ant-select-content'))
        .toHaveAttribute('title', 'Phường Thanh Khê')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Đọc form' }))
    await waitFor(() => {
      const result = screen.getByText(/"address_detail":"12 Nguyễn Huệ"/).textContent
      expect(result.match(/"location":12/g)).toHaveLength(2)
      expect(result).toContain('"address_detail":"20 Lê Lợi"')
    })
  })

  it('uses Tất cả as one province-wide workplace', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><Harness /></QueryClientProvider>)

    fireEvent.click(screen.getByText('Thêm phường/xã').closest('button'))
    fireEvent.click(await screen.findByText('Phường Hải Châu'))
    fireEvent.click(screen.getByText('Tất cả'))
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng (1)' }))

    await waitFor(() => {
      expect(screen.getByTitle('Tất cả')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Đọc form' }))
    expect(screen.getByText(/"location":1/)).toBeInTheDocument()
    expect(screen.queryByText(/"location":11/)).not.toBeInTheDocument()
  })
})
