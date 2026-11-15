import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSharedCvFile, getUploadedCvFile } from '../api/cv.api'
import UploadedCvPreview from './UploadedCvPreview'

vi.mock('../api/cv.api', () => ({ getUploadedCvFile: vi.fn(), getSharedCvFile: vi.fn() }))

function renderPreview(props) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <UploadedCvPreview title="CV của tôi" {...props} />
    </QueryClientProvider>,
  )
}

describe('UploadedCvPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    URL.createObjectURL = vi.fn(() => 'blob:cv-source')
    URL.revokeObjectURL = vi.fn()
  })

  it('embeds the owner source PDF without the viewer chrome', async () => {
    getUploadedCvFile.mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }))
    renderPreview({ publicId: 'cv_1' })

    const frame = await screen.findByTitle('CV của tôi')
    expect(getUploadedCvFile).toHaveBeenCalledWith('cv_1')
    expect(frame).toHaveAttribute('src', 'blob:cv-source#toolbar=0&navpanes=0&scrollbar=0&view=FitH')
  })

  it('reads the file through the share token for shared links', async () => {
    getSharedCvFile.mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }))
    renderPreview({ shareToken: 'tok_1' })

    await screen.findByTitle('CV của tôi')
    expect(getSharedCvFile).toHaveBeenCalledWith('tok_1')
    expect(getUploadedCvFile).not.toHaveBeenCalled()
  })

  it('explains when the source file cannot be shown', async () => {
    getUploadedCvFile.mockRejectedValue(new Error('Not found'))
    renderPreview({ publicId: 'cv_1' })

    expect(await screen.findByText('Không thể hiển thị tệp CV')).toBeInTheDocument()
  })
})
