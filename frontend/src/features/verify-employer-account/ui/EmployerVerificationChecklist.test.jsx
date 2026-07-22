import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import EmployerVerificationChecklist from './EmployerVerificationChecklist'

vi.mock('@/entities/session', () => ({
  useSession: () => ({ user: { has_usable_password: true } }),
}))
vi.mock('@/entities/site-settings', () => ({
  settingText: (_value, fallback) => fallback,
  useSiteSettings: () => ({ settings: {}, siteName: 'ProCV' }),
}))

describe('EmployerVerificationChecklist', () => {
  it('marks the business-document update step complete as soon as a valid set is submitted', () => {
    render(
      <MemoryRouter>
        <EmployerVerificationChecklist
          profile={{ onboarding: { business_doc_submitted: true, business_doc_approved: false } }}
          onContinue={vi.fn()}
        />
      </MemoryRouter>,
    )

    const title = screen.getByText('Cập nhật Giấy đăng ký doanh nghiệp')
    const stepRow = title.closest('.grid')

    expect(stepRow).not.toBeNull()
    expect(within(stepRow).getByText('Hoàn tất')).toBeInTheDocument()
    expect(screen.getByText('Hoàn thành 20%')).toBeInTheDocument()
  })
})
