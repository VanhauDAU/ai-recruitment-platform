import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  createCvPdfExport: vi.fn(),
  downloadCvPdf: vi.fn(),
  getCv: vi.fn(),
  getCvPdfExport: vi.fn(),
  getCvVersions: vi.fn(),
  retryCvPdfExport: vi.fn(),
}))

vi.mock('@/entities/cv', () => api)

import CvPdfExportControl from './CvPdfExportControl'

describe('CvPdfExportControl', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset())
    api.getCv.mockResolvedValue({ published_version_public_id: 'cvv_published', latest_version_public_id: 'cvv_latest' })
    api.getCvVersions.mockResolvedValue([
      { public_id: 'cvv_latest', version_number: 3, version_kind: 'manual_save' },
      { public_id: 'cvv_published', version_number: 2, version_kind: 'published' },
    ])
  })

  it('defaults to the published immutable version and creates a server-side export job', async () => {
    const user = userEvent.setup()
    api.createCvPdfExport.mockResolvedValue({ public_id: 'cve_1', version_public_id: 'cvv_published', status: 'pending' })

    render(<CvPdfExportControl publicId="cv_1" />)

    await expect(screen.findByRole('button', { name: 'Xuất PDF' })).resolves.toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Xuất PDF' }))

    await waitFor(() => expect(api.createCvPdfExport).toHaveBeenCalledWith('cv_1', 'cvv_published'))
    expect(screen.getByText('Đang chờ xuất')).toBeInTheDocument()
    expect(screen.getByText(/không dùng bản nháp hoặc Preview/i)).toBeInTheDocument()
  })

  it('shows retry only for a failed immutable export job', async () => {
    const user = userEvent.setup()
    api.createCvPdfExport.mockResolvedValue({ public_id: 'cve_1', version_public_id: 'cvv_published', status: 'failed' })
    api.retryCvPdfExport.mockResolvedValue({ public_id: 'cve_1', version_public_id: 'cvv_published', status: 'pending' })

    render(<CvPdfExportControl publicId="cv_1" />)
    await user.click(await screen.findByRole('button', { name: 'Xuất PDF' }))
    await user.click(await screen.findByRole('button', { name: 'Thử lại' }))

    await waitFor(() => expect(api.retryCvPdfExport).toHaveBeenCalledWith('cv_1', 'cve_1'))
    expect(screen.getByText('Đang chờ xuất')).toBeInTheDocument()
  })
})
