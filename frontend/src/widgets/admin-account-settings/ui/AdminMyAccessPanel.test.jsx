import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminMyAccessPanel from './AdminMyAccessPanel'

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }))
vi.mock('@/entities/session', () => ({ useSession }))

describe('AdminMyAccessPanel', () => {
  beforeEach(() => useSession.mockReset())

  it('shows the department, role and grouped permission labels', () => {
    useSession.mockReturnValue({
      user: {
        admin_access: {
          is_superuser: false,
          permissions: ['job_moderation.view', 'job_moderation.approve'],
          primary_department: {
            code: 'job-moderation',
            name: 'Kiểm duyệt tin tuyển dụng',
          },
          memberships: [{
            department: {
              code: 'job-moderation',
              name: 'Kiểm duyệt tin tuyển dụng',
            },
            role: { code: 'staff', name: 'Nhân viên', rank: 10 },
          }],
        },
      },
    })
    render(<AdminMyAccessPanel />)

    expect(screen.getAllByText('Kiểm duyệt tin tuyển dụng').length).toBeGreaterThan(0)
    expect(screen.getByText('Duyệt tin tuyển dụng')).toBeInTheDocument()
    expect(screen.getByText(/Nhân viên · rank 10/)).toBeInTheDocument()
  })

  it('explains who to contact when no membership exists', () => {
    useSession.mockReturnValue({
      user: {
        admin_access: {
          is_superuser: false,
          permissions: [],
          primary_department: null,
          memberships: [],
        },
      },
    })
    render(<AdminMyAccessPanel />)
    expect(screen.getByText(/Liên hệ quản trị hệ thống/)).toBeInTheDocument()
  })
})
