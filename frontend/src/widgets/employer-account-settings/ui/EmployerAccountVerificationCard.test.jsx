import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import EmployerAccountVerificationCard from './EmployerAccountVerificationCard'

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }))

const queryState = { data: undefined, isLoading: false }
vi.mock('@tanstack/react-query', () => ({ useQuery: () => queryState }))
vi.mock('@/entities/employer-profile', () => ({ getEmployerProfile: vi.fn() }))
vi.mock('@/entities/session', () => ({ useSession }))

function renderCard() {
  return render(
    <MemoryRouter>
      <EmployerAccountVerificationCard />
    </MemoryRouter>,
  )
}

describe('EmployerAccountVerificationCard', () => {
  it('shows level, the three verification steps and a 0% progress when none are done', () => {
    useSession.mockReturnValue({ user: { email: 'hr@gmail.com', email_verified: true } })
    queryState.data = {
      onboarding: { phone_verified: false, company_linked: false, business_doc_approved: false },
    }

    renderCard()

    expect(screen.getByText('Cấp 1/3')).toBeInTheDocument()
    expect(screen.getByText('Hoàn thành')).toHaveTextContent('Hoàn thành 0%')
    expect(screen.getByRole('link', { name: /Xác thực số điện thoại/ })).toHaveAttribute(
      'href',
      '/tuyendung/app/account/phone-verify',
    )
    expect(screen.getByText('Cập nhật thông tin công ty')).toBeInTheDocument()
    expect(screen.getByText('Xác thực Giấy đăng ký doanh nghiệp')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tìm hiểu thêm' })).toHaveAttribute(
      'href',
      '/tuyendung/app/employer-verify',
    )
  })

  it('reflects completed steps in the progress percentage', () => {
    useSession.mockReturnValue({ user: { email: 'hr@gmail.com', email_verified: true } })
    queryState.data = {
      onboarding: { phone_verified: true, company_linked: false, business_doc_approved: false },
    }

    renderCard()

    expect(screen.getByText('Hoàn thành')).toHaveTextContent('Hoàn thành 33%')
  })
})
