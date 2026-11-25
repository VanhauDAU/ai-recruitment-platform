import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SITE_SETTINGS, SiteSettingsContext } from '@/entities/system/site-settings'
import ApplicationCvPreview from './ApplicationCvPreview'

const api = vi.hoisted(() => ({ getApplicationCvFile: vi.fn(), requestApplicationCvExport: vi.fn() }))
const connect = vi.hoisted(() => ({ startConversation: vi.fn() }))
vi.mock('@/entities/application/application', async (importOriginal) => ({ ...(await importOriginal()), ...api }))
vi.mock('@/entities/messaging/conversation/api/conversation.api', async (importOriginal) => ({ ...(await importOriginal()), ...connect }))
vi.mock('@/shared/lib/download-blob', () => ({ triggerBlobDownload: vi.fn() }))

function renderPreview(snapshot, { application = { job_title: 'Kỹ sư' }, connectEnabled = false } = {}) {
  const settings = { ...DEFAULT_SITE_SETTINGS, connect_enabled: connectEnabled }
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SiteSettingsContext.Provider value={{ settings, loading: false, error: null, retry: () => {} }}>
        <MemoryRouter>
          <ApplicationCvPreview
            candidateName="Lê Văn Hậu"
            selectedApplication={application}
            selectedPublicId="app_1"
            snapshot={snapshot}
          />
        </MemoryRouter>
      </SiteSettingsContext.Provider>
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
    expect(screen.getByText('CV tải lên · Tệp CV ứng viên đã nộp')).toBeInTheDocument()
    // Không ẩn danh được tệp nên không mời người ngoài đánh giá.
    expect(screen.getByRole('button', { name: /Mời đánh giá/ })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /Tải PDF/ }))

    await waitFor(() => expect(api.getApplicationCvFile).toHaveBeenCalledWith('app_1', { download: true }))
    expect(api.requestApplicationCvExport).not.toHaveBeenCalled()
  })

  it('opens the ProCV Connect conversation from the CV toolbar', async () => {
    const user = userEvent.setup()
    connect.startConversation.mockResolvedValue({ public_id: 'cnv_1' })
    renderPreview(
      { submitted_cv_title: 'cv.pdf', cv: { has_source_file: true } },
      { application: { public_id: 'app_1', job_title: 'Kỹ sư', status: 'viewed' }, connectEnabled: true },
    )

    await user.click(screen.getByRole('button', { name: /Nhắn tin/ }))

    await waitFor(() => expect(connect.startConversation).toHaveBeenCalledWith('employer', { application: 'app_1' }))
  })

  it('hides the message button when the feature is off or the candidate withdrew or is blocked', () => {
    const snapshot = { submitted_cv_title: 'cv.pdf', cv: { has_source_file: true } }
    const { unmount } = renderPreview(snapshot, { application: { public_id: 'app_1', status: 'viewed' } })
    expect(screen.queryByRole('button', { name: /Nhắn tin/ })).not.toBeInTheDocument()
    unmount()

    const { unmount: unmountWithdrawn } = renderPreview(snapshot, { application: { public_id: 'app_1', status: 'withdrawn' }, connectEnabled: true })
    expect(screen.queryByRole('button', { name: /Nhắn tin/ })).not.toBeInTheDocument()
    unmountWithdrawn()

    renderPreview(snapshot, { application: { public_id: 'app_1', status: 'rejected' }, connectEnabled: true })
    expect(screen.queryByRole('button', { name: /Nhắn tin/ })).not.toBeInTheDocument()
  })
})
