import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteSettingsContext } from '@/entities/system/site-settings'
import AnalyzeJobFit from './AnalyzeJobFit'
import { RESULT } from '../tests/job-fit-fixtures'

const api = vi.hoisted(() => ({ getJobFit: vi.fn(), listJobFits: vi.fn(), requestJobFit: vi.fn() }))
const cv = vi.hoisted(() => ({ getMySavedCvs: vi.fn() }))
vi.mock('../api/job-fit.api', () => api)
vi.mock('@/entities/cv/cv', async (importOriginal) => ({ ...(await importOriginal()), getMySavedCvs: cv.getMySavedCvs }))
vi.mock('@/shared/ui/mascot', () => ({ ProcvMascot: () => <span data-testid="mascot" /> }))

const JOB = { slug: 'frontend-jb_1', title: 'Frontend Developer' }
const CVS = [{ public_id: 'cv_1', title: 'CV Frontend', cv_type: 'builder', is_default: true, updated_at: '2026-11-18T08:00:00Z' }]

function renderButton({ enabled = true, beforeOpen } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SiteSettingsContext.Provider value={{ settings: { ai_job_match_enabled: enabled } }}>
        <MemoryRouter>
          <AnalyzeJobFit job={JOB} beforeOpen={beforeOpen} />
        </MemoryRouter>
      </SiteSettingsContext.Provider>
    </QueryClientProvider>,
  )
}

describe('AnalyzeJobFit', () => {
  // Hộp thoại tải trễ; nạp trước để lần mở đầu không vượt thời gian chờ của test.
  beforeAll(() => import('./JobFitDialog'))

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset())
    cv.getMySavedCvs.mockReset().mockResolvedValue(CVS)
    api.listJobFits.mockResolvedValue([])
  })

  it('is hidden when the admin turns the feature off', () => {
    renderButton({ enabled: false })
    expect(screen.queryByRole('button', { name: /Xem độ phù hợp/ })).not.toBeInTheDocument()
  })

  it('does not open when the page refuses (guest or employer)', () => {
    renderButton({ beforeOpen: () => false })
    fireEvent.click(screen.getByRole('button', { name: /Xem độ phù hợp/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('analyses the chosen CV, polls and shows the result', async () => {
    api.requestJobFit.mockResolvedValue({ public_id: 'ma_1', status: 'queued', cv: { title: 'CV Frontend' } })
    api.getJobFit.mockResolvedValue({ public_id: 'ma_1', status: 'succeeded', cv: { title: 'CV Frontend' }, result: RESULT })
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: /Xem độ phù hợp/ }))
    const analyze = await screen.findByRole('button', { name: 'Xem độ phù hợp' })
    await waitFor(() => expect(analyze).toBeEnabled())
    fireEvent.click(analyze)
    expect(await screen.findByText('Xây dựng trang thanh toán bằng ReactJS.', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(api.requestJobFit).toHaveBeenCalledWith({ jobSlug: 'frontend-jb_1', cvPublicId: 'cv_1' })
  })

  it('opens on the latest earlier result for this job', async () => {
    api.listJobFits.mockResolvedValue([
      { public_id: 'ma_0', status: 'succeeded', cv: { title: 'CV Frontend' }, result: RESULT, completed_at: '2026-11-18T08:00:00Z' },
    ])
    api.getJobFit.mockResolvedValue({ public_id: 'ma_0', status: 'succeeded', cv: { title: 'CV Frontend' }, result: RESULT, completed_at: '2026-11-18T08:00:00Z' })
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: /Xem độ phù hợp/ }))
    expect(await screen.findByText(/kết quả lần trước/)).toBeInTheDocument()
    expect(api.requestJobFit).not.toHaveBeenCalled()
  })

  it('explains a failed analysis', async () => {
    api.requestJobFit.mockResolvedValue({ public_id: 'ma_2', status: 'failed', error_code: 'cv_text_unavailable', cv: { title: 'CV PDF' } })
    api.getJobFit.mockResolvedValue({ public_id: 'ma_2', status: 'failed', error_code: 'cv_text_unavailable', cv: { title: 'CV PDF' } })
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: /Xem độ phù hợp/ }))
    const analyze = await screen.findByRole('button', { name: 'Xem độ phù hợp' })
    await waitFor(() => expect(analyze).toBeEnabled())
    fireEvent.click(analyze)
    expect(await screen.findByText(/bản scan/)).toBeInTheDocument()
  })
})
