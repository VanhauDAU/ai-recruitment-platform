import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import EmployerBusinessLicenseForm from './EmployerBusinessLicenseForm'

const { getEmployerProfile } = vi.hoisted(() => ({ getEmployerProfile: vi.fn() }))

vi.mock('@/entities/employer-profile', () => ({ getEmployerProfile }))

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><EmployerBusinessLicenseForm /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('EmployerBusinessLicenseForm', () => {
  it('keeps the upload form visible but disables saving until company information is updated', async () => {
    getEmployerProfile.mockResolvedValue({ onboarding: { company_linked: false } })

    renderForm()

    expect(await screen.findByText('Giấy đăng ký doanh nghiệp hoặc Giấy tờ tương đương khác')).toBeVisible()
    expect(screen.getByText('Giấy tờ', { exact: true })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'cập nhật thông tin công ty' })).toHaveAttribute('href', '/tuyendung/app/account/settings/company?update=true')
  })

  it('switches to the authorization and identity-document flow', async () => {
    getEmployerProfile.mockResolvedValue({ onboarding: { company_linked: false } })
    const user = userEvent.setup()

    renderForm()
    await screen.findByText('Giấy đăng ký doanh nghiệp hoặc Giấy tờ tương đương khác')
    await user.click(screen.getByText('Giấy ủy quyền và Giấy tờ định danh'))

    const radioGroup = screen.getByRole('radiogroup')
    const authorizationRadio = screen.getByRole('radio', { name: 'Giấy ủy quyền và Giấy tờ định danh' })
    const authorizationHeading = screen.getByRole('heading', { name: 'Giấy ủy quyền *' })

    expect(radioGroup).toHaveClass('!grid')
    expect(authorizationRadio.compareDocumentPosition(authorizationHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('Giấy ủy quyền', { exact: true })).toBeVisible()
    expect(screen.getByText('Giấy tờ định danh (CCCD/ Hộ chiếu)', { exact: true })).toBeVisible()
    expect(screen.getByRole('img', { name: 'Minh họa giấy ủy quyền' })).toHaveAttribute('src', '/images/employer/authorization-sample.jpg')
    expect(screen.getByRole('link', { name: /Tải mẫu giấy ủy quyền/ })).toHaveAttribute('href', expect.stringContaining('1_cQDRuVuibU7XP1YPcsjpSYB8jokcqyR'))
  })
})
