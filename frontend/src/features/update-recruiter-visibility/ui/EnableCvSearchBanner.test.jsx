import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getRecruiterVisibility } from '@/entities/candidate-preferences'
import { setCvRecruiterSearchable } from '@/entities/cv'
import EnableCvSearchBanner from './EnableCvSearchBanner'

vi.mock('@/entities/candidate-preferences', () => ({
  RECRUITER_VISIBILITY_QUERY_KEY: ['candidate', 'recruiter-visibility'],
  getRecruiterVisibility: vi.fn(),
  updateRecruiterVisibility: vi.fn(),
}))
vi.mock('@/entities/cv', async (importOriginal) => ({
  ...(await importOriginal()),
  setCvRecruiterSearchable: vi.fn(),
}))

function renderBanner() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <EnableCvSearchBanner cv={{ public_id: 'cv_9', title: 'cv-moi.pdf', recruiter_searchable: false }} />
    </QueryClientProvider>,
  )
}

describe('EnableCvSearchBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setCvRecruiterSearchable.mockResolvedValue({ recruiter_searchable: true })
  })

  it('turns recruiter search on for the promoted CV when consent already exists', async () => {
    getRecruiterVisibility.mockResolvedValue({ enabled: true })
    renderBanner()

    expect(screen.getByText('cv-moi.pdf')).toBeInTheDocument()
    const button = screen.getByRole('button', { name: /Bật tìm việc ngay/ })
    await waitFor(() => expect(button).not.toHaveClass('ant-btn-loading'))
    await userEvent.click(button)
    await waitFor(() => expect(setCvRecruiterSearchable).toHaveBeenCalledWith('cv_9', true))
  })

  it('asks for consent first when the profile has not opened to recruiters', async () => {
    getRecruiterVisibility.mockResolvedValue({ enabled: false })
    renderBanner()

    const button = screen.getByRole('button', { name: /Bật tìm việc ngay/ })
    await waitFor(() => expect(button).not.toHaveClass('ant-btn-loading'))
    await userEvent.click(button)
    expect(await screen.findByText('Cho phép nhà tuyển dụng tìm kiếm hồ sơ?')).toBeInTheDocument()
    expect(setCvRecruiterSearchable).not.toHaveBeenCalled()
  })
})
