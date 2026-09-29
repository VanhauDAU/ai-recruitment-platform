import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import JobResults from './JobResults'

vi.mock('./JobCard', () => ({
  default: ({ job, recommendationLabel }) => (
    <article>
      <span>{job.title}</span>
      {recommendationLabel && <span>{recommendationLabel}</span>}
    </article>
  ),
}))

vi.mock('./WardSuggestionCard', () => ({ default: () => null }))

describe('JobResults candidate recommendation lane', () => {
  it('inserts extra recommendations without replacing canonical results', () => {
    render(
      <JobResults
        count={2}
        footer={null}
        insertAfter={{}}
        isAuthenticated
        loading={false}
        onPageChange={vi.fn()}
        onSearchByChange={vi.fn()}
        onSortChange={vi.fn()}
        ordering=""
        page={1}
        recommendationInsertAfter={0}
        recommendedJobs={[
          { public_id: 'recommended_1', title: 'Recommended one' },
          { public_id: 'recommended_2', title: 'Recommended two' },
        ]}
        results={[
          { public_id: 'job_1', title: 'Canonical one' },
          { public_id: 'job_2', title: 'Canonical two' },
        ]}
        searchBy="title"
        suggestedWards={[]}
      />,
    )

    expect(screen.getByText('Canonical one')).toBeVisible()
    expect(screen.getByText('Canonical two')).toBeVisible()
    expect(screen.getByText('Recommended one')).toBeVisible()
    expect(screen.getByText('Recommended two')).toBeVisible()
    expect(screen.getAllByText('Đề xuất cho bạn')).toHaveLength(2)
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })
})
