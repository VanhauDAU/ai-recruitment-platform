import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useCallback, useState } from 'react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { withQueryClient } from '@/test/render-with-query-client'
import { useCvSource } from '../model/use-cv-source'
import CvSourcePanel from './CvSourcePanel'

const mocks = vi.hoisted(() => ({
  getBlankCvPreview: vi.fn(),
  getCvPositionOptions: vi.fn(),
  getCvPositionPreview: vi.fn(),
  getMyCvs: vi.fn(),
  onRequireLogin: vi.fn(),
  onCreated: vi.fn(),
  createCvFromTemplate: vi.fn(),
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
  CV_EXPERIENCE_BANDS: [
    { value: 'junior', label: '1–2 năm', who: 'Đã đi làm' },
    { value: 'senior', label: 'Từ 5 năm', who: 'Chuyên gia' },
  ],
  DEFAULT_CV_EXPERIENCE_BAND: 'junior',
  getBlankCvPreview: mocks.getBlankCvPreview,
  getCvPositionOptions: mocks.getCvPositionOptions,
  getCvPositionPreview: mocks.getCvPositionPreview,
}))

vi.mock('@/entities/session', () => ({
  useSession: () => ({ ...mocks.session, user: mocks.session.user && { ...mocks.session.user } }),
}))

vi.mock('../api/create-cv.api', () => ({ createCvFromTemplate: mocks.createCvFromTemplate }))

vi.mock('@/shared/lib/toast', () => ({ message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

vi.mock('@/entities/site-settings', () => ({
  useSiteSettings: () => ({ siteName: 'ProCV' }),
}))

const TEMPLATE = { public_id: 'template_1', display_name: 'Thanh Lịch' }
const POSITIONS = [
  { public_id: 'pos_1', slug: 'ke-toan', display_name: 'Kế toán' },
  { public_id: 'pos_2', slug: 'ky-su-ai', display_name: 'Kỹ sư AI' },
]
const PREVIEW = { document: { content_json: {}, style_json: {} }, renderer: { key: 'single_column_v1' } }

// Cha giữ lựa chọn (trang chi tiết: URL; ở đây: state) — đúng cách dùng thật.
function Harness({ initial = {}, onChange = () => {} }) {
  const [selection, setSelection] = useState({ source: 'sample', sampleLocale: 'vi-VN', experienceBand: 'junior', positionSlug: null, ...initial })
  const select = useCallback((patch) => {
    onChange(patch)
    setSelection((current) => ({ ...current, ...patch }))
  }, [onChange])
  const cv = useCvSource({ template: TEMPLATE, locale: 'vi-VN', selection, onSelectionChange: select, onCreated: mocks.onCreated, onRequireLogin: mocks.onRequireLogin })
  return <><CvSourcePanel cv={cv} /><output data-testid="preview">{cv.preview.document ? 'ready' : 'none'}</output></>
}

const renderPanel = (props = {}) => render(withQueryClient(<MemoryRouter><Harness {...props} /></MemoryRouter>))

describe('CvSourcePanel with useCvSource', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.session = { isAuthenticated: false, user: null }
    mocks.getCvPositionOptions.mockResolvedValue(POSITIONS)
    mocks.getCvPositionPreview.mockResolvedValue(PREVIEW)
    mocks.getBlankCvPreview.mockResolvedValue({ document: {} })
    mocks.getMyCvs.mockResolvedValue([])
    mocks.createCvFromTemplate.mockResolvedValue({ public_id: 'cv_new' })
  })

  it('shows the sample preview on first render, without switching sources', async () => {
    renderPanel()

    await waitFor(() => expect(screen.getByTestId('preview')).toHaveTextContent('ready'))
    expect(mocks.getCvPositionOptions).toHaveBeenCalledTimes(1)
    expect(mocks.getCvPositionPreview).toHaveBeenCalledWith('pos_1', 'vi-VN', 'template_1', expect.any(Object))
  })

  it('previews the position named in the URL and drops an unknown one', async () => {
    const onChange = vi.fn()
    renderPanel({ initial: { positionSlug: 'ky-su-ai' }, onChange })
    await waitFor(() => expect(mocks.getCvPositionPreview).toHaveBeenCalledWith('pos_2', 'vi-VN', 'template_1', expect.any(Object)))
    expect(onChange).not.toHaveBeenCalled()

    renderPanel({ initial: { positionSlug: 'khong-ton-tai' }, onChange })
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ positionSlug: null }))
  })

  it('lets the candidate pick years of experience and previews that content', async () => {
    const onChange = vi.fn()
    renderPanel({ onChange })
    await waitFor(() => expect(screen.getByTestId('preview')).toHaveTextContent('ready'))

    fireEvent.click(screen.getByRole('radio', { name: 'Từ 5 năm' }))

    expect(onChange).toHaveBeenCalledWith({ experienceBand: 'senior' })
    expect(screen.getByRole('radio', { name: 'Từ 5 năm' })).toHaveAttribute('aria-checked', 'true')
    await waitFor(() => expect(mocks.getCvPositionPreview).toHaveBeenLastCalledWith('pos_1', 'vi-VN', 'template_1', expect.objectContaining({ experienceBand: 'senior' })))
  })

  it('falls back to sample content when a guest opens a previous-CV link', async () => {
    renderPanel({ initial: { source: 'previous' } })

    await waitFor(() => expect(screen.getByTestId('preview')).toHaveTextContent('ready'))
    expect(screen.queryByText('Nội dung CV đã tạo trước đó')).not.toBeInTheDocument()
    expect(screen.queryByText('Khôi phục bản chưa lưu')).not.toBeInTheDocument()
  })

  it('asks a guest to log in, then creates the CV once with an idempotency key', async () => {
    const user = userEvent.setup()
    const view = renderPanel()
    const createButton = screen.getByRole('button', { name: 'Tạo CV' })
    await waitFor(() => expect(createButton).toBeEnabled())

    await user.click(createButton)
    expect(mocks.onRequireLogin).toHaveBeenCalledTimes(1)
    expect(mocks.createCvFromTemplate).not.toHaveBeenCalled()

    // Đăng nhập thành công ngay tại trang: phiên đổi, callback của hộp đăng nhập chạy.
    mocks.session = { isAuthenticated: true, user: { public_id: 'usr_1', role: 'candidate', email_verified: true } }
    act(() => mocks.onRequireLogin.mock.calls[0][0]())
    view.rerender(withQueryClient(<MemoryRouter><Harness /></MemoryRouter>))

    await waitFor(() => expect(mocks.onCreated).toHaveBeenCalledWith({ public_id: 'cv_new' }))
    expect(mocks.createCvFromTemplate).toHaveBeenCalledTimes(1)
    expect(mocks.createCvFromTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ template_public_id: 'template_1', position_public_id: 'pos_1', experience_band: 'junior' }),
      { idempotencyKey: expect.any(String) },
    )
  })
})
