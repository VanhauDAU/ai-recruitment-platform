import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { changeAppLanguage } from '@/shared/config/i18n'
import ConsultationForm from './ConsultationForm'

const mocks = vi.hoisted(() => ({
  createConsultationLead: vi.fn(),
  getProvinces: vi.fn(),
}))

vi.mock('@/entities/consultation-lead', () => ({ createConsultationLead: mocks.createConsultationLead }))
vi.mock('@/entities/location', () => ({ getProvinces: mocks.getProvinces }))

function renderForm(props = {}) {
  return render(
    <MemoryRouter initialEntries={['/tuyendung/lien-he']}>
      <App>
        <ConsultationForm {...props} />
      </App>
    </MemoryRouter>,
  )
}

describe('ConsultationForm', () => {
  beforeEach(() => {
    changeAppLanguage('vi')
    mocks.createConsultationLead.mockReset()
    mocks.getProvinces.mockReset()
    mocks.getProvinces.mockResolvedValue([{ id: 1, name: 'Hà Nội' }])
  })

  it('báo lỗi các trường bắt buộc khi gửi form trống', async () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /Gửi yêu cầu tư vấn/ }))

    expect(await screen.findByText('Vui lòng nhập họ tên')).toBeTruthy()
    expect(await screen.findByText('Vui lòng nhập email')).toBeTruthy()
    expect(await screen.findByText('Vui lòng nhập số điện thoại')).toBeTruthy()
    expect(mocks.createConsultationLead).not.toHaveBeenCalled()
  })

  it('gửi đúng payload kèm source_page và gọi onSuccess', async () => {
    mocks.createConsultationLead.mockResolvedValue({ id: 1 })
    const onSuccess = vi.fn()
    renderForm({ onSuccess })

    fireEvent.change(screen.getByPlaceholderText('Nguyễn Văn A'), { target: { value: 'Trần Thị B' } })
    fireEvent.change(screen.getByPlaceholderText('email@congty.vn'), { target: { value: 'b@congty.vn' } })
    fireEvent.change(screen.getByPlaceholderText('0912 345 678'), { target: { value: '0987654321' } })
    fireEvent.click(screen.getByRole('button', { name: /Gửi yêu cầu tư vấn/ }))

    await waitFor(() => expect(mocks.createConsultationLead).toHaveBeenCalledTimes(1))
    expect(mocks.createConsultationLead).toHaveBeenCalledWith(expect.objectContaining({
      full_name: 'Trần Thị B',
      email: 'b@congty.vn',
      phone: '0987654321',
      need: 'post_job',
      source_page: '/tuyendung/lien-he',
    }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  })

  it('báo lỗi số điện thoại không hợp lệ', async () => {
    renderForm()
    fireEvent.change(screen.getByPlaceholderText('0912 345 678'), { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: /Gửi yêu cầu tư vấn/ }))

    expect(await screen.findByText('Số điện thoại không hợp lệ')).toBeTruthy()
    expect(mocks.createConsultationLead).not.toHaveBeenCalled()
  })
})
