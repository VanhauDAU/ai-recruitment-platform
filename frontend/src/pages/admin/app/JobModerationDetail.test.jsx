import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import JobModerationDetail from './JobModerationDetail'

const { useSession } = vi.hoisted(() => ({
  useSession: vi.fn(),
}))

vi.mock('@/entities/session', () => ({ useSession }))
vi.mock('@/widgets/admin-job-management', () => ({
  AdminJobDetail: ({ publicId, serviceContent }) => (
    <div>
      <span>Chi tiết {publicId}</span>
      {serviceContent}
    </div>
  ),
}))
vi.mock('@/widgets/admin-service-catalog', () => ({
  ServiceActivationsPanel: ({ canManage, jobPublicId }) => (
    <div
      data-can-manage={String(canManage)}
      data-job-public-id={jobPublicId}
      data-testid="service-activation-panel"
    />
  ),
}))

function renderPage(permissions) {
  useSession.mockReturnValue({
    user: { admin_access: { permissions } },
  })
  return render(
    <MemoryRouter initialEntries={['/admin/app/job-moderation/jb_1']}>
      <Routes>
        <Route
          element={<JobModerationDetail />}
          path="/admin/app/job-moderation/:publicId"
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('JobModerationDetail', () => {
  it('does not mount service data without view permission', () => {
    renderPage(['job_moderation.view'])

    expect(screen.getByText('Chi tiết jb_1')).toBeInTheDocument()
    expect(screen.queryByTestId('service-activation-panel')).not.toBeInTheDocument()
  })

  it('scopes the service panel to the route job and separates manage permission', () => {
    renderPage(['job_moderation.view', 'service_entitlement.view'])

    const panel = screen.getByTestId('service-activation-panel')
    expect(panel).toHaveAttribute('data-job-public-id', 'jb_1')
    expect(panel).toHaveAttribute('data-can-manage', 'false')
  })

  it('enables service management only with manage permission', () => {
    renderPage([
      'job_moderation.view',
      'service_entitlement.view',
      'service_entitlement.manage',
    ])

    expect(screen.getByTestId('service-activation-panel')).toHaveAttribute(
      'data-can-manage',
      'true',
    )
  })
})
