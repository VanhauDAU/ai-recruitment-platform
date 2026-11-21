import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bannerPayload, emptyBannerValues, previewBanner } from '../model/banner-form'
import BannerManager from './BannerManager'

const api = vi.hoisted(() => ({
  getAdminBanners: vi.fn(),
  reorderAdminBanners: vi.fn(),
  updateAdminBanner: vi.fn(),
  deleteAdminBanner: vi.fn(),
}))

vi.mock('@/entities/content/banner', async (importOriginal) => ({ ...(await importOriginal()), ...api }))

const banners = [
  { id: 1, placement: 'home_hero', kind: 'image', title: 'Banner Eximland', image_url: '/a.png', is_active: true, schedule_state: 'running' },
  { id: 2, placement: 'home_hero', kind: 'ai', title: 'Gợi ý AI', theme: 'green', is_active: true, schedule_state: 'scheduled', starts_at: '2026-12-01T01:00:00Z' },
]

const byLabel = (label) => {
  const node = document.querySelector(`[aria-label="${label}"]`)
  if (!node) throw new Error(`Không thấy ${label}`)
  return node
}

function renderManager(renderPreview = vi.fn(() => <span>preview</span>)) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BannerManager renderPreview={renderPreview} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return renderPreview
}

describe('BannerManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getAdminBanners.mockResolvedValue(banners)
    api.reorderAdminBanners.mockResolvedValue()
    api.updateAdminBanner.mockResolvedValue({})
  })

  it('lists homepage banners with their schedule state', async () => {
    renderManager()
    expect(await screen.findByText('Banner Eximland')).toBeInTheDocument()
    expect(api.getAdminBanners).toHaveBeenCalledWith('home_hero', expect.anything())
    expect(screen.getByText('Chờ tới lịch')).toBeInTheDocument()
  })

  it('reorders with the arrow buttons and toggles a banner', async () => {
    renderManager()
    await screen.findByText('Banner Eximland')
    fireEvent.click(byLabel('Đưa Banner Eximland xuống'))
    await waitFor(() => expect(api.reorderAdminBanners).toHaveBeenCalledWith('home_hero', [2, 1]))

    fireEvent.click(byLabel('Bật hoặc tắt Gợi ý AI'))
    await waitFor(() => expect(api.updateAdminBanner).toHaveBeenCalledWith(2, { is_active: false }))
  })

  it('opens the editor with a live preview of the slide', async () => {
    const renderPreview = renderManager()
    await screen.findByText('Banner Eximland')
    fireEvent.click(byLabel('Sửa Banner Eximland'))
    await waitFor(() => expect(renderPreview).toHaveBeenCalledWith(expect.objectContaining({ kind: 'image', title: 'Banner Eximland' })))
  })
})

describe('banner form model', () => {
  it('maps form values to the API payload and preview', () => {
    const values = { ...emptyBannerValues('home_hero'), title: ' Banner ', image_path: 'site/banners/a.png', image_preview: '/m/a.png', company: 'cmp_1' }
    expect(bannerPayload(values)).toMatchObject({ kind: 'image', title: 'Banner', image_url: 'site/banners/a.png', company: 'cmp_1', starts_at: null })
    expect(previewBanner(values, { public_id: 'cmp_1' })).toMatchObject({ image_url: '/m/a.png', company: { public_id: 'cmp_1' } })
  })
})
