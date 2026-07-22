import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import EmployerAccountVerificationCard from './EmployerAccountVerificationCard'

const queryState = { data: undefined, isLoading: false }
vi.mock('@tanstack/react-query', () => ({ useQuery: () => queryState }))
vi.mock('@/entities/employer-profile', () => ({ getEmployerProfile: vi.fn() }))

function renderCard() {
  return render(
    <MemoryRouter>
      <EmployerAccountVerificationCard />
    </MemoryRouter>,
  )
}

describe('EmployerAccountVerificationCard', () => {
  it('shows level, the three verification steps and a 0% progress when none are done', () => {
    queryState.data = {
      onboarding: { phone_verified: false, company_linked: false, business_doc_submitted: false },
    }

    renderCard()

    expect(screen.getByText('Cấp 0/3')).toBeInTheDocument()
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
    queryState.data = {
      onboarding: {
        email_verified: true,
        phone_verified: true,
        company_linked: false,
        business_doc_submitted: false,
      },
    }

    renderCard()

    expect(screen.getByText('Hoàn thành')).toHaveTextContent('Hoàn thành 33%')
  })

  it('does not mark a pending business document as verified or advance account level', () => {
    queryState.data = {
      onboarding: {
        email_verified: true,
        phone_verified: true,
        company_linked: true,
        business_doc_submitted: true,
        business_doc_approved: false,
        no_report_history: true,
      },
    }

    renderCard()

    const businessDocumentStep = screen.getByRole('link', {
      name: /Xác thực Giấy đăng ký doanh nghiệp/,
    })

    expect(screen.getByText('Cấp 1/3')).toBeInTheDocument()
    expect(screen.getByText('Hoàn thành')).toHaveTextContent('Hoàn thành 33%')
    expect(businessDocumentStep.querySelector('.anticon-check-circle')).not.toBeInTheDocument()
  })

  it('advances an approved account without report history to level 3', () => {
    queryState.data = {
      onboarding: {
        email_verified: true,
        phone_verified: true,
        company_linked: true,
        business_doc_submitted: true,
        business_doc_approved: true,
        no_report_history: true,
      },
    }

    renderCard()

    expect(screen.getByText('Cấp 3/3')).toBeInTheDocument()
    expect(screen.getByText('Hoàn thành')).toHaveTextContent('Hoàn thành 100%')
  })
})
