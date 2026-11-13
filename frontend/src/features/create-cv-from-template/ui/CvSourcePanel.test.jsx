import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CvSourcePanel from './CvSourcePanel'

const mocks = vi.hoisted(() => ({
  getBlankCvPreview: vi.fn(),
  getCvPositionOptions: vi.fn(),
  getCvPositionPreview: vi.fn(),
  getMyCvs: vi.fn(),
  onRequireLogin: vi.fn(),
  session: { isAuthenticated: false, user: null },
}))

vi.mock('@/entities/cv', () => ({
  getMyCvs: mocks.getMyCvs,
  getCvTemplatePreview: vi.fn(),
  importCvFile: vi.fn(),
  retryCvImport: vi.fn(),
  waitForCvImport: vi.fn(),
}))

vi.mock('@/entities/cv-template', () => ({
  CV_LANGUAGES: [
    { code: 'vi-VN', param: 'vi', label: 'Tiếng Việt' },
    { code: 'en-US', param: 'en', label: 'Tiếng Anh' },
  ],
  getBlankCvPreview: mocks.getBlankCvPreview,
  getCvPositionOptions: mocks.getCvPositionOptions,
  getCvPositionPreview: mocks.getCvPositionPreview,
}))

vi.mock('@/entities/session', () => ({
  useSession: () => ({ ...mocks.session, user: mocks.session.user && { ...mocks.session.user } }),
}))

vi.mock('@/entities/site-settings', () => ({
  useSiteSettings: () => ({ siteName: 'ProCV' }),
}))

const TEMPLATE = { public_id: 'template_1', display_name: 'Thanh Lịch' }
const POSITIONS = [
  { public_id: 'pos_1', slug: 'ke-toan', display_name: 'Kế toán' },
  { public_id: 'pos_2', slug: 'ky-su-ai', display_name: 'Kỹ sư AI' },
]
const PREVIEW = { document: { content_json: {}, style_json: {} }, renderer: { key: 'single_column_v1' } }

function renderPanel(props = {}) {
  return render(
    <MemoryRouter>
      <CvSourcePanel template={TEMPLATE} locale="vi-VN" onRequireLogin={mocks.onRequireLogin} {...props} />
    </MemoryRouter>,
  )
}

describe('CvSourcePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.session = { isAuthenticated: false, user: null }
    mocks.getCvPositionOptions.mockResolvedValue(POSITIONS)
    mocks.getCvPositionPreview.mockResolvedValue(PREVIEW)
    mocks.getBlankCvPreview.mockResolvedValue({ document: {} })
    mocks.getMyCvs.mockResolvedValue([])
  })

  it('loads the sample preview on first render without switching sources', async () => {
    const onPreviewChange = vi.fn()
    const { rerender } = renderPanel({ onPreviewChange })
    // Re-render with new callback/session identities while positions load —
    // the condition that used to leave the preview waiting before CVT-0.
    rerender(
      <MemoryRouter>
        <CvSourcePanel template={TEMPLATE} locale="vi-VN" onPreviewChange={(value) => onPreviewChange(value)} />
      </MemoryRouter>,
    )

    await waitFor(() => expect(onPreviewChange).toHaveBeenLastCalledWith(PREVIEW))
    expect(mocks.getCvPositionOptions).toHaveBeenCalledTimes(1)
    expect(mocks.getCvPositionPreview).toHaveBeenCalledWith('pos_1', 'vi-VN', 'template_1', expect.any(Object))
  })

  it('restores the position from the URL slug and reports the selection', async () => {
    const onSelectionChange = vi.fn()
    renderPanel({ initialSelection: { source: 'sample', positionSlug: 'ky-su-ai' }, onSelectionChange })

    await waitFor(() => expect(onSelectionChange).toHaveBeenLastCalledWith({
      source: 'sample',
      sampleLocale: 'vi-VN',
      position: { slug: 'ky-su-ai', label: 'Kỹ sư AI' },
    }))
    expect(onSelectionChange).not.toHaveBeenCalledWith(expect.objectContaining({ position: null }))
    await waitFor(() => expect(mocks.getCvPositionPreview).toHaveBeenCalledWith('pos_2', 'vi-VN', 'template_1', expect.any(Object)))
  })

  it('falls back to sample content when a guest opens a previous-CV link', async () => {
    const onSelectionChange = vi.fn()
    renderPanel({ initialSelection: { source: 'previous' }, onSelectionChange })

    await waitFor(() => expect(onSelectionChange).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'sample' })))
    expect(screen.queryByText('Nội dung CV đã tạo trước đó')).not.toBeInTheDocument()
  })

  it('no longer offers restoring an unsaved draft', () => {
    renderPanel()

    expect(screen.queryByText('Khôi phục bản chưa lưu')).not.toBeInTheDocument()
  })

  it('opens the candidate login prompt instead of only showing a warning when creating a CV as a guest', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: /Tạo CV từ đầu/ }))
    const createButton = screen.getByRole('button', { name: 'Tạo CV' })
    await waitFor(() => expect(createButton).toBeEnabled())
    await user.click(createButton)

    expect(mocks.onRequireLogin).toHaveBeenCalledTimes(1)
  })
})
