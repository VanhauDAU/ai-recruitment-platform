import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ApplicationCvPreview from './ApplicationCvPreview'

const api = vi.hoisted(() => ({ getApplicationCvFile: vi.fn(), requestApplicationCvExport: vi.fn() }))
vi.mock('@/entities/application/application', async (importOriginal) => ({ ...(await importOriginal()), ...api }))
vi.mock('@/shared/lib/download-blob', () => ({ triggerBlobDownload: vi.fn() }))

function renderPreview(snapshot) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ApplicationCvPreview
        candidateName="Lê Văn Hậu"
        selectedApplication={{ job_title: 'Kỹ sư' }}
        selectedPublicId="app_1"
        snapshot={snapshot}
      />
    </QueryClientProvider>,
  )
}

describe('ApplicationCvPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    URL.createObjectURL = vi.fn(() => 'blob:cv-file')
    URL.revokeObjectURL = vi.fn()
    api.getApplicationCvFile.mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }))
  })

  it('shows and downloads the file itself when the candidate applied with an uploaded CV', async () => {
    const user = userEvent.setup()
    renderPreview({ submitted_cv_title: 'cv.pdf', submitted_cv_source: 'imported', cv: { has_source_file: true } })

    expect(await screen.findByTitle('cv.pdf')).toHaveAttribute('src', expect.stringContaining('blob:cv-file'))
    expect(screen.getByText('Tệp CV ứng viên đã nộp')).toBeInTheDocument()
    expect(screen.getByText('CV tải lên')).toBeInTheDocument()
    // Không ẩn danh được tệp nên không mời người ngoài đánh giá.
    expect(screen.getByRole('button', { name: /Mời đánh giá/ })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /Tải PDF/ }))

    await waitFor(() => expect(api.getApplicationCvFile).toHaveBeenCalledWith('app_1', { download: true }))
    expect(api.requestApplicationCvExport).not.toHaveBeenCalled()
  })
})
