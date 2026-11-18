import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { importCvFile } from '@/entities/cv/cv'
import UploadCvForm from './UploadCvForm'

vi.mock('@/entities/cv/cv', async (importOriginal) => ({
  ...(await importOriginal()),
  importCvFile: vi.fn(),
}))

const pdf = (name = 'cv.pdf', size = 1024) => {
  const file = new File(['%PDF'], name, { type: 'application/pdf' })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

function pick(file) {
  const input = document.querySelector('input[type="file"]')
  return userEvent.upload(input, file, { applyAccept: false })
}

describe('UploadCvForm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects files outside the upload standards before calling the API', async () => {
    render(<UploadCvForm onUploaded={vi.fn()} />)

    await pick(pdf('cv.png'))
    expect(await screen.findByText('Chỉ hỗ trợ tệp PDF hoặc DOCX.')).toBeInTheDocument()
    await pick(pdf('large.pdf', 6 * 1024 * 1024))
    expect(await screen.findByText('Tệp CV không được vượt quá 5MB.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tải CV lên' })).toBeDisabled()
    expect(importCvFile).not.toHaveBeenCalled()
  })

  it('uploads a valid file and shows the server reason when it is not a CV', async () => {
    const onUploaded = vi.fn()
    importCvFile
      .mockRejectedValueOnce({ response: { data: { code: 'CV_REJECTED', message: 'Tệp không giống một CV.' } } })
      .mockResolvedValueOnce({ public_id: 'cv_1' })
    render(<UploadCvForm onUploaded={onUploaded} />)

    await pick(pdf())
    expect(await screen.findByText('cv.pdf')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tải CV lên' }))
    expect(await screen.findByText('Tệp không giống một CV.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Tải CV lên$/ }))
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith({ public_id: 'cv_1' }))
  })
})
