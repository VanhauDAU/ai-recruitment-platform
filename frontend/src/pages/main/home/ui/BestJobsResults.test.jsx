import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import BestJobsResults from './BestJobsResults'

vi.mock('@/entities/account/session', () => ({
  useSession: () => ({ isAuthenticated: false }),
}))

vi.mock('@/features/common/account/auth', () => ({
  useLoginPrompt: () => ({ promptLogin: vi.fn() }),
}))

vi.mock('@/features/main/job/track-job-engagement', () => ({
  JobImpressionBoundary: ({ children, className }) => <div className={className}>{children}</div>,
}))

const JOB = {
  public_id: 'job_1',
  slug: 'ky-su-phan-mem',
  title: 'Kỹ sư phần mềm',
  company_name: 'Công ty Kim Cương',
  company_logo_url: '/company-logo.png',
  brand_slug: 'cong-ty-kim-cuong',
  locations_detail: [{ id: 1, name: 'Hà Nội' }],
  salary_type: 'negotiable',
  presentation: {
    labels: [{ code: 'fast_response', text: 'Phản hồi nhanh', tone: 'success' }],
  },
}

describe('BestJobsResults', () => {
  it('renders every job on the same plain card, system labels above the title', () => {
    const { container } = render(
      <MemoryRouter>
        <BestJobsResults animKey="first" jobs={[JOB]} loading={false} />
      </MemoryRouter>,
    )

    const card = container.querySelector('a[href="/viec-lam/ky-su-phan-mem"]')
    const labels = container.querySelector('[data-best-job-labels]')
    const title = screen.getByRole('heading', { name: 'Kỹ sư phần mềm' })

    expect(card).toHaveClass('!bg-white')
    expect(screen.getByRole('img', { name: 'Công ty Kim Cương' })).toBeInTheDocument()
    expect(screen.queryByText('TOP')).not.toBeInTheDocument()
    expect(screen.getByText('Phản hồi nhanh')).toBeInTheDocument()
    expect(labels.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
