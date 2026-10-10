import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import BestJobsResults from './BestJobsResults'

vi.mock('@/entities/session', () => ({
  useSession: () => ({ isAuthenticated: false }),
}))

vi.mock('@/features/auth', () => ({
  useLoginPrompt: () => ({ promptLogin: vi.fn() }),
}))

vi.mock('@/features/track-job-engagement', () => ({
  JobImpressionBoundary: ({ children, className }) => <div className={className}>{children}</div>,
}))

const TOP_JOB = {
  public_id: 'job_top_1',
  slug: 'ky-su-phan-mem',
  title: 'Kỹ sư phần mềm',
  company_name: 'Công ty Kim Cương',
  company_logo_url: '/company-logo.png',
  brand_slug: 'cong-ty-kim-cuong',
  locations_detail: [{ id: 1, name: 'Hà Nội' }],
  salary_type: 'negotiable',
  presentation: {
    card_tone: 'green_strong',
    labels: [{ code: 'sponsored', text: 'Tài trợ', tone: 'sponsored' }],
  },
}

describe('BestJobsResults', () => {
  it('renders the top-employer treatment with larger logo and labels above title', () => {
    const { container } = render(
      <MemoryRouter>
        <BestJobsResults animKey="first" jobs={[TOP_JOB]} loading={false} />
      </MemoryRouter>,
    )

    const card = container.querySelector('a[href="/viec-lam/ky-su-phan-mem"]')
    const logoFrame = screen.getByRole('img', { name: 'Công ty Kim Cương' }).parentElement
    const labels = container.querySelector('[data-best-job-labels]')
    const title = screen.getByRole('heading', { name: 'Kỹ sư phần mềm' })

    expect(card).toHaveClass('bg-[#f2fbf6]', 'border-l-4', 'border-l-[#00b14f]')
    expect(logoFrame).toHaveClass('h-16', 'w-16')
    expect(screen.getByText('TOP')).toBeInTheDocument()
    expect(screen.getByText('Tài trợ')).toBeInTheDocument()
    expect(labels.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
