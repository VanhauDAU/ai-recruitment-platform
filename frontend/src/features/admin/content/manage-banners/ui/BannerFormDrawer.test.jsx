import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BannerFormDrawer from './BannerFormDrawer'

const mocks = vi.hoisted(() => ({
  uploadAdminBannerImage: vi.fn(),
  cropToFile: vi.fn(),
}))

vi.mock('@/entities/content/banner', async (importOriginal) => ({
  ...(await importOriginal()),
  uploadAdminBannerImage: mocks.uploadAdminBannerImage,
}))
vi.mock('../model/crop-image', async (importOriginal) => ({ ...(await importOriginal()), cropToFile: mocks.cropToFile }))
// jsdom không tải ảnh: giả lập Cropper báo vùng chọn ngay khi hiện.
vi.mock('react-easy-crop', async () => {
  const { useEffect } = await import('react')
  return {
    default: function FakeCropper({ aspect, onCropComplete }) {
      // oxlint-disable-next-line react-hooks/exhaustive-deps -- chỉ báo vùng chọn một lần như khi ảnh tải xong.
      useEffect(() => onCropComplete({}, { x: 0, y: 0, width: 1000, height: 1000 / aspect }), [])
      return <div data-testid="cropper" data-aspect={aspect} />
    },
  }
})

function renderDrawer(banner) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BannerFormDrawer banner={banner} onClose={vi.fn()} onSaved={vi.fn()} renderPreview={() => null} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function chooseImage() {
  const input = document.querySelector('input[type="file"]')
  const file = new File(['png'], 'bcons.png', { type: 'image/png' })
  fireEvent.change(input, { target: { files: [file] } })
  return file
}

describe('BannerFormDrawer image upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:source')
    globalThis.URL.revokeObjectURL = vi.fn()
    mocks.cropToFile.mockResolvedValue(new File(['webp'], 'bcons.webp', { type: 'image/webp' }))
    mocks.uploadAdminBannerImage.mockResolvedValue({ path: 'site/banners/a.webp', url: '/media/a.webp' })
  })

  it('crops a new homepage image slide to 8:3 and uploads it with its real kind', async () => {
    renderDrawer({ placement: 'home_hero' })
    chooseImage()

    expect(await screen.findByTestId('cropper')).toHaveAttribute('data-aspect', String(8 / 3))
    fireEvent.click(screen.getByRole('button', { name: 'Cắt và tải lên' }))

    await waitFor(() => expect(mocks.uploadAdminBannerImage).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'bcons.webp' }),
      { placement: 'home_hero', kind: 'image' },
    ))
    expect(mocks.cropToFile).toHaveBeenCalledWith('blob:source', expect.objectContaining({ width: 1000 }), expect.objectContaining({ maxWidth: 1600 }))
  })

  it('uploads images of other placements without cropping', async () => {
    renderDrawer({ placement: 'blog_sidebar' })
    const file = chooseImage()
    await waitFor(() => expect(mocks.uploadAdminBannerImage).toHaveBeenCalledWith(file, { placement: 'blog_sidebar', kind: 'promo' }))
    expect(screen.queryByTestId('cropper')).not.toBeInTheDocument()
  })
})
