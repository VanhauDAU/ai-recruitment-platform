import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getRecruiterApplicationSubmissions } from '@/entities/application/application'
import { withQueryClient } from '@/test/render-with-query-client'
import PreviousSubmissions from './PreviousSubmissions'

vi.mock('@/entities/application/application', async (importOriginal) => ({
  ...(await importOriginal()),
  getRecruiterApplicationSubmissions: vi.fn(),
}))

describe('PreviousSubmissions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists the earlier submission a resubmission replaced, numbered', async () => {
    getRecruiterApplicationSubmissions.mockResolvedValue([
      { public_id: 'app_1', applied_at: '2026-11-10T02:00:00Z', status: 'withdrawn', submitted_cv_title: 'CV cũ' },
    ])
    render(withQueryClient(<PreviousSubmissions application={{ public_id: 'app_2', submission_number: 2 }} />))

    expect(await screen.findByText('Lần 1 · CV cũ')).toBeInTheDocument()
  })

  it('stays out of the way for a first submission', () => {
    const { container } = render(withQueryClient(
      <PreviousSubmissions application={{ public_id: 'app_1', submission_number: 1 }} />,
    ))

    expect(container).toBeEmptyDOMElement()
    expect(getRecruiterApplicationSubmissions).not.toHaveBeenCalled()
  })
})
