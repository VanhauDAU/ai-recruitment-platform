import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import UploadCv from './UploadCv'

vi.mock('@/entities/cv/cv', async (importOriginal) => ({ ...(await importOriginal()), getMyCvs: vi.fn().mockResolvedValue([]) }))
vi.mock('@/entities/cv/cv-template', () => ({ CvTemplateCard: () => null, getCvTemplates: vi.fn().mockResolvedValue({ results: [] }) }))
vi.mock('@/features/main/cv/upload-cv', () => ({
  UploadCvForm: ({ onUploaded }) => <button type="button" onClick={() => onUploaded({ public_id: 'cv_new' })}>Tải lên</button>,
}))

describe('UploadCv', () => {
  it('opens the CV that was just uploaded in a new tab from the success screen', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter><UploadCv /></MemoryRouter>
      </QueryClientProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Tải lên' }))

    const link = screen.getByRole('link', { name: 'Xem CV tải lên của tôi' })
    expect(link).toHaveAttribute('href', '/cv/cv_new/xem')
    expect(link).toHaveAttribute('target', '_blank')
  })
})
