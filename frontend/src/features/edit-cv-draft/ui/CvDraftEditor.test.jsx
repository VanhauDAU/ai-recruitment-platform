import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CvDraftEditor from './CvDraftEditor'

const mocks = vi.hoisted(() => ({
  getCv: vi.fn(), getCvDraft: vi.fn(), updateCvDraft: vi.fn(), saveCvVersion: vi.fn(), publishCvVersion: vi.fn(), switchCvTemplate: vi.fn(),
}))
const templateMocks = vi.hoisted(() => ({ getCvTemplates: vi.fn() }))

vi.mock('@/entities/cv', async (importOriginal) => ({
  ...(await importOriginal()),
  getCv: mocks.getCv,
  getCvDraft: mocks.getCvDraft,
  updateCvDraft: mocks.updateCvDraft,
  saveCvVersion: mocks.saveCvVersion,
  publishCvVersion: mocks.publishCvVersion,
  switchCvTemplate: mocks.switchCvTemplate,
}))

vi.mock('@/entities/cv-template', () => ({ getCvTemplates: templateMocks.getCvTemplates }))

function draft() {
  return {
    schema_version: 1,
    lock_version: 0,
    content_json: {
      schema_version: 1, locale: 'vi-VN', custom_fields: {},
      personal_info: { full_name: 'Nguyễn An', headline: '', email: '', phone: '', address: '', avatar_asset_id: null, links: [] },
      sections: [
        { instance_id: 'summary_1', section_key: 'summary', title: 'Mục tiêu nghề nghiệp', enabled: true, items: [{ item_id: 'summary_item_1', value: '' }] },
        { instance_id: 'experience_1', section_key: 'experience', title: 'Kinh nghiệm', enabled: true, items: [{ item_id: 'experience_item_1', role: '', company: '', start_date: null, end_date: null, description: { format: 'rich_text_v1', content: [] } }] },
        { instance_id: 'skills_1', section_key: 'skills', title: 'Kỹ năng', enabled: true, items: [{ item_id: 'skills_item_1', name: '' }] },
      ],
    },
    layout_json: { schema_version: 1, page: { size: 'A4', margin_mm: 12 }, regions: [{ id: 'main', width_percent: 100, section_instance_ids: ['summary_1', 'experience_1', 'skills_1'] }] },
    style_json: { schema_version: 1, theme_color: '#00A66A', font_family: 'Roboto', font_scale: 1, line_height: 1.4, background_asset_id: null, section_overrides: {} },
  }
}

describe('CV draft editor', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    Object.values(mocks).forEach((mock) => mock.mockReset())
    templateMocks.getCvTemplates.mockReset()
    mocks.getCv.mockResolvedValue({
      title: 'CV thử nghiệm', template_public_id: 'tpl_single', template_renderer_key: 'classic_single_column_v1',
      template_capabilities: { layout: { section_drag: true, cross_region_drag: true, item_drag: true, column_resize: { enabled: true, min_percent: 25, max_percent: 75 } } },
    })
    mocks.getCvDraft.mockResolvedValue(draft())
    mocks.updateCvDraft.mockResolvedValue({ lock_version: 1 })
    mocks.saveCvVersion.mockResolvedValue({ public_id: 'version_2', version_number: 2 })
    mocks.publishCvVersion.mockResolvedValue({ public_id: 'version_3', version_number: 3, version_kind: 'published' })
    templateMocks.getCvTemplates.mockResolvedValue({ results: [{ public_id: 'tpl_single', display_name: 'Một cột' }, { public_id: 'tpl_two', display_name: 'Hai cột' }] })
    mocks.switchCvTemplate.mockResolvedValue({
      cv: { title: 'CV thử nghiệm', template_public_id: 'tpl_two', template_renderer_key: 'classic_two_column_v1', template_capabilities: { layout: { item_drag: true, column_resize: { enabled: true, min_percent: 25, max_percent: 75 } } } },
      draft: { ...draft(), lock_version: 1, layout_json: { ...draft().layout_json, regions: [{ id: 'main', width_percent: 68, section_instance_ids: ['summary_1', 'experience_1'] }, { id: 'sidebar', width_percent: 32, section_instance_ids: ['skills_1'] }] }, style_json: { ...draft().style_json, theme_color: '#2255AA' } },
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('edits canonical form data, autosaves with the lock and only creates a version from the save button', async () => {
    render(<CvDraftEditor publicId="cv_1" />)
    const fullName = await screen.findByLabelText('Họ và tên')
    fireEvent.change(fullName, { target: { value: 'Nguyễn Bình' } })
    expect(screen.getByText('Chưa lưu')).toBeInTheDocument()

    await waitFor(() => expect(mocks.updateCvDraft).toHaveBeenCalledWith('cv_1', expect.objectContaining({ content_json: expect.objectContaining({ personal_info: expect.objectContaining({ full_name: 'Nguyễn Bình' }) }) }), 0, expect.any(String)), { timeout: 1500 })
    expect(mocks.saveCvVersion).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Lưu phiên bản' }))
    await waitFor(() => expect(mocks.saveCvVersion).toHaveBeenCalledWith('cv_1', 1))
    expect(screen.getByText('Đã tạo phiên bản 2')).toBeInTheDocument()
  })

  it('stops autosave and asks the user to reload on a 409 conflict', async () => {
    mocks.updateCvDraft.mockRejectedValue({ response: { status: 409, data: { current_lock_version: 4 } } })
    render(<CvDraftEditor publicId="cv_1" />)
    fireEvent.change(await screen.findByLabelText('Họ và tên'), { target: { value: 'Tab khác' } })

    await screen.findByText('Bản nháp vừa được sửa ở tab khác', {}, { timeout: 1500 })
    expect(screen.getByRole('button', { name: 'Tải lại bản nháp' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lưu phiên bản' })).toBeDisabled()
  })

  it('keeps stable section and item identities while editing section management controls', async () => {
    render(<CvDraftEditor publicId="cv_1" />)
    await screen.findByLabelText('Họ và tên')

    fireEvent.change(screen.getByLabelText('Tiêu đề experience_1'), { target: { value: 'Kinh nghiệm nổi bật' } })
    fireEvent.click(screen.getByRole('button', { name: 'Thêm item experience_1' }))
    expect(screen.getByLabelText('Chức danh experience_item_2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Di chuyển item experience_item_2 lên' }))

    await waitFor(() => expect(mocks.updateCvDraft).toHaveBeenCalledWith('cv_1', expect.objectContaining({
      content_json: expect.objectContaining({ sections: expect.arrayContaining([
        expect.objectContaining({ instance_id: 'experience_1', title: 'Kinh nghiệm nổi bật', items: [expect.objectContaining({ item_id: 'experience_item_1' }), expect.objectContaining({ item_id: 'experience_item_2' })] }),
      ]) }),
      layout_json: expect.objectContaining({ item_orders: expect.objectContaining({ experience_1: ['experience_item_2', 'experience_item_1'] }) }),
    }), 0, expect.any(String)), { timeout: 1500 })
  })

  it('undoes and redoes edits locally without using autosave as a history command', async () => {
    render(<CvDraftEditor publicId="cv_1" />)
    const fullName = await screen.findByLabelText('Họ và tên')
    fireEvent.change(fullName, { target: { value: 'Nguyễn Hoàn tác' } })
    expect(screen.getByLabelText('Họ và tên')).toHaveValue('Nguyễn Hoàn tác')

    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }))
    expect(screen.getByLabelText('Họ và tên')).toHaveValue('Nguyễn An')
    fireEvent.click(screen.getByRole('button', { name: 'Làm lại' }))
    expect(screen.getByLabelText('Họ và tên')).toHaveValue('Nguyễn Hoàn tác')
  })

  it('switches the published template through V2 while preserving canonical content in the returned draft', async () => {
    render(<CvDraftEditor publicId="cv_1" />)
    await screen.findByLabelText('Họ và tên')
    fireEvent.mouseDown(screen.getByLabelText('Mẫu CV'))
    fireEvent.click(await screen.findByText('Hai cột'))
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng mẫu CV' }))

    await waitFor(() => expect(mocks.switchCvTemplate).toHaveBeenCalledWith('cv_1', 'tpl_two', 0, expect.any(String)))
    expect(screen.getByText(/classic_two_column_v1/)).toBeInTheDocument()
  })

  it('flushes before internal navigation, retries failed autosave, and can restore the server draft', async () => {
    mocks.updateCvDraft.mockRejectedValueOnce({ response: { data: { detail: 'Mất kết nối' } } }).mockResolvedValue({ lock_version: 1 })
    render(<CvDraftEditor publicId="cv_1" />)
    fireEvent.change(await screen.findByLabelText('Họ và tên'), { target: { value: 'Chưa lưu' } })

    const beforeUnload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(beforeUnload)
    expect(beforeUnload.defaultPrevented).toBe(true)

    const destination = document.createElement('a')
    destination.href = '/viec-lam'
    document.body.append(destination)
    const navigation = new MouseEvent('click', { bubbles: true, cancelable: true })
    destination.dispatchEvent(navigation)
    expect(navigation.defaultPrevented).toBe(true)
    await waitFor(() => expect(mocks.updateCvDraft).toHaveBeenCalledTimes(1))
    destination.remove()

    await screen.findByText('Không thể autosave bản nháp', {}, { timeout: 1500 })
    fireEvent.click(screen.getByRole('button', { name: 'Thử lưu lại' }))
    await waitFor(() => expect(mocks.updateCvDraft).toHaveBeenCalledTimes(2))

    mocks.updateCvDraft.mockRejectedValueOnce({ response: { data: { detail: 'Mất kết nối lần nữa' } } })
    fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: 'Cần khôi phục' } })
    await screen.findByText('Không thể autosave bản nháp', {}, { timeout: 1500 })
    fireEvent.click(screen.getByRole('button', { name: 'Khôi phục bản nháp đã lưu' }))
    await waitFor(() => expect(mocks.getCvDraft).toHaveBeenCalledTimes(2))
  })

  it('runs local validation before publishing and publishes an immutable version only when valid', async () => {
    const invalid = draft()
    invalid.content_json.sections[2].items[0].item_id = 'experience_item_1'
    mocks.getCvDraft.mockResolvedValueOnce(invalid)
    render(<CvDraftEditor publicId="cv_1" />)
    await screen.findByLabelText('Họ và tên')
    fireEvent.click(screen.getByRole('button', { name: 'Xuất bản CV' }))
    expect(await screen.findByText('Kiểm tra CV trước khi lưu')).toBeInTheDocument()
    expect(mocks.publishCvVersion).not.toHaveBeenCalled()
  })

  it('publishes through the V2 publish endpoint after the valid draft is current', async () => {
    render(<CvDraftEditor publicId="cv_1" />)
    await screen.findByLabelText('Họ và tên')
    fireEvent.click(screen.getByRole('button', { name: 'Xuất bản CV' }))
    await waitFor(() => expect(mocks.publishCvVersion).toHaveBeenCalledWith('cv_1', 0))
    expect(screen.getByText('Đã xuất bản phiên bản 3')).toBeInTheDocument()
  })
})
