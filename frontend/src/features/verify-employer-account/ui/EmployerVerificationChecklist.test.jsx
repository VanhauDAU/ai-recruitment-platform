import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
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

    const title = screen.getByText('Nộp giấy tờ chứng minh quyền đại diện')
    const stepRow = title.closest('.grid')

    expect(stepRow).not.toBeNull()
    expect(within(stepRow).getByText('Hoàn tất')).toBeInTheDocument()
    expect(screen.getByText('Hoàn thành 20%')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(5)
    expect(screen.queryByText('Xác minh email')).not.toBeInTheDocument()
    expect(screen.queryByText('Admin duyệt tài khoản')).not.toBeInTheDocument()
  })

  it('shows canonical workspace and candidate-data status with a machine-mapped action', () => {
    render(
      <MemoryRouter>
        <EmployerVerificationChecklist
          profile={{ onboarding: {} }}
          readiness={{
            jobWorkspaceReady: true,
            candidateDataAccess: false,
            blockers: [{
              code: 'candidate_dpa_outdated',
              capabilities: ['candidate_data'],
              message: 'DPA cần được cập nhật theo phiên bản hiện hành.',
              action: 'accept_current_dpa',
            }],
          }}
          onContinue={vi.fn()}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('Workspace việc làm đã sẵn sàng; dữ liệu ứng viên vẫn được bảo vệ'))
      .toBeInTheDocument()
    expect(screen.getByText('DPA cần được cập nhật theo phiên bản hiện hành.'))
      .toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cập nhật DPA hiện hành' })).toBeInTheDocument()
  })
})
