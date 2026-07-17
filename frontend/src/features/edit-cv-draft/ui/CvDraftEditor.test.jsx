import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { App } from 'antd'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SITE_SETTINGS, SiteSettingsContext } from '@/entities/site-settings'
import CvDraftEditor from './CvDraftEditor'

const mocks = vi.hoisted(() => ({
  getCv: vi.fn(), getCvDraft: vi.fn(), updateCvDraft: vi.fn(), saveCvVersion: vi.fn(), publishCvVersion: vi.fn(), switchCvTemplate: vi.fn(), renameCv: vi.fn(),
}))
const templateMocks = vi.hoisted(() => ({ getCvTemplates: vi.fn(), getCvBackgrounds: vi.fn(), getCvSampleContents: vi.fn() }))

vi.mock('@/entities/cv', async (importOriginal) => ({
  ...(await importOriginal()),
  getCv: mocks.getCv,
  getCvDraft: mocks.getCvDraft,
  updateCvDraft: mocks.updateCvDraft,
  saveCvVersion: mocks.saveCvVersion,
  publishCvVersion: mocks.publishCvVersion,
  switchCvTemplate: mocks.switchCvTemplate,
  renameCv: mocks.renameCv,
}))

vi.mock('@/entities/cv-template', () => ({
  getCvTemplates: templateMocks.getCvTemplates,
  getCvBackgrounds: templateMocks.getCvBackgrounds,
  getCvSampleContents: templateMocks.getCvSampleContents,
}))

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
        { instance_id: 'skills_1', section_key: 'skills', title: 'Kỹ năng', enabled: true, items: [{ item_id: 'skills_item_1', name: '', level: '' }] },
      ],
    },
    layout_json: { schema_version: 1, page: { size: 'A4', margin_mm: 12 }, regions: [{ id: 'main', width_percent: 100, section_instance_ids: ['summary_1', 'experience_1', 'skills_1'] }] },
    style_json: { schema_version: 1, theme_color: '#00A66A', font_family: 'Roboto', font_scale: 1, line_height: 1.4, background_asset_id: null, section_overrides: {} },
  }
}

function renderLegacyEditor() {
  return render(<SiteSettingsContext.Provider value={{ settings: { ...DEFAULT_SITE_SETTINGS, cv_builder_wysiwyg_enabled: false } }}><CvDraftEditor publicId="cv_1" /></SiteSettingsContext.Provider>)
}

function renderWysiwygEditor(props = {}) {
  return render(<App><SiteSettingsContext.Provider value={{ settings: { ...DEFAULT_SITE_SETTINGS, cv_builder_wysiwyg_enabled: true } }}><CvDraftEditor publicId="cv_1" {...props} /></SiteSettingsContext.Provider></App>)
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
    mocks.renameCv.mockImplementation(async (_publicId, title) => ({ title, template_public_id: 'tpl_single', template_renderer_key: 'classic_single_column_v1' }))
    templateMocks.getCvTemplates.mockResolvedValue({ results: [{ public_id: 'tpl_single', display_name: 'Một cột' }, { public_id: 'tpl_two', display_name: 'Hai cột' }] })
    templateMocks.getCvBackgrounds.mockResolvedValue([])
    templateMocks.getCvSampleContents.mockResolvedValue([])
    mocks.switchCvTemplate.mockResolvedValue({
      cv: { title: 'CV thử nghiệm', template_public_id: 'tpl_two', template_renderer_key: 'classic_two_column_v1', template_capabilities: { layout: { item_drag: true, column_resize: { enabled: true, min_percent: 25, max_percent: 75 } } } },
      draft: { ...draft(), lock_version: 1, layout_json: { ...draft().layout_json, regions: [{ id: 'main', width_percent: 68, section_instance_ids: ['summary_1', 'experience_1'] }, { id: 'sidebar', width_percent: 32, section_instance_ids: ['skills_1'] }] }, style_json: { ...draft().style_json, theme_color: '#2255AA' } },
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('edits canonical form data, autosaves with the lock and only creates a version from the save button', async () => {
    renderLegacyEditor()
    const fullName = await screen.findByLabelText('Họ và tên')
    fireEvent.change(fullName, { target: { value: 'Nguyễn Bình' } })
    expect(screen.getByText('Chưa lưu')).toBeInTheDocument()

    await waitFor(() => expect(mocks.updateCvDraft).toHaveBeenCalledWith('cv_1', expect.objectContaining({ content_json: expect.objectContaining({ personal_info: expect.objectContaining({ full_name: 'Nguyễn Bình' }) }) }), 0, expect.any(String)), { timeout: 1500 })
    expect(mocks.saveCvVersion).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Lưu phiên bản' }))
    await waitFor(() => expect(mocks.saveCvVersion).toHaveBeenCalledWith('cv_1', 1))
    expect(screen.getByText('Đã tạo phiên bản 2')).toBeInTheDocument()
  })

  it('queues the newest edit when a previous autosave is still in flight', async () => {
    let resolveFirstSave
    mocks.updateCvDraft.mockImplementationOnce(() => new Promise((resolve) => { resolveFirstSave = resolve })).mockResolvedValueOnce({ lock_version: 2 })
    renderLegacyEditor()
    const fullName = await screen.findByLabelText('Họ và tên')

    fireEvent.change(fullName, { target: { value: 'Bản nháp đầu tiên' } })
    await waitFor(() => expect(mocks.updateCvDraft).toHaveBeenCalledTimes(1), { timeout: 1500 })

    fireEvent.change(fullName, { target: { value: 'Bản nháp mới nhất' } })
    resolveFirstSave({ lock_version: 1 })

    await waitFor(() => expect(mocks.updateCvDraft).toHaveBeenCalledTimes(2), { timeout: 1800 })
    expect(mocks.updateCvDraft).toHaveBeenLastCalledWith('cv_1', expect.objectContaining({
      content_json: expect.objectContaining({ personal_info: expect.objectContaining({ full_name: 'Bản nháp mới nhất' }) }),
    }), 1, expect.any(String))
  })

  it('stops autosave and asks the user to reload on a 409 conflict', async () => {
    mocks.updateCvDraft.mockRejectedValue({ response: { status: 409, data: { current_lock_version: 4 } } })
    renderLegacyEditor()
    fireEvent.change(await screen.findByLabelText('Họ và tên'), { target: { value: 'Tab khác' } })

    await screen.findByText('Bản nháp vừa được sửa ở tab khác', {}, { timeout: 1500 })
    expect(screen.getByRole('button', { name: 'Tải lại bản nháp' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lưu phiên bản' })).toBeDisabled()
  })

  it('keeps stable section and item identities while editing section management controls', async () => {
    renderLegacyEditor()
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
    renderLegacyEditor()
    const fullName = await screen.findByLabelText('Họ và tên')
    fireEvent.change(fullName, { target: { value: 'Nguyễn Hoàn tác' } })
    expect(screen.getByLabelText('Họ và tên')).toHaveValue('Nguyễn Hoàn tác')

    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }))
    expect(screen.getByLabelText('Họ và tên')).toHaveValue('Nguyễn An')
    fireEvent.click(screen.getByRole('button', { name: 'Làm lại' }))
    expect(screen.getByLabelText('Họ và tên')).toHaveValue('Nguyễn Hoàn tác')
  })

  it('switches the published template through V2 while preserving canonical content in the returned draft', async () => {
    renderLegacyEditor()
    await screen.findByLabelText('Họ và tên')
    fireEvent.mouseDown(screen.getByLabelText('Mẫu CV'))
    fireEvent.click(await screen.findByText('Hai cột'))
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng mẫu CV' }))

    await waitFor(() => expect(mocks.switchCvTemplate).toHaveBeenCalledWith('cv_1', 'tpl_two', 0, expect.any(String)))
    expect(screen.getByText(/classic_two_column_v1/)).toBeInTheDocument()
  })

  it('flushes before internal navigation, retries failed autosave, and can restore the server draft', async () => {
    mocks.updateCvDraft.mockRejectedValueOnce({ response: { data: { detail: 'Mất kết nối' } } }).mockResolvedValue({ lock_version: 1 })
    renderLegacyEditor()
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
    renderLegacyEditor()
    await screen.findByLabelText('Họ và tên')
    fireEvent.click(screen.getByRole('button', { name: 'Xuất bản CV' }))
    expect(await screen.findByText('Kiểm tra CV trước khi lưu')).toBeInTheDocument()
    expect(mocks.publishCvVersion).not.toHaveBeenCalled()
  })

  it('publishes through the V2 publish endpoint after the valid draft is current', async () => {
    renderLegacyEditor()
    await screen.findByLabelText('Họ và tên')
    fireEvent.click(screen.getByRole('button', { name: 'Xuất bản CV' }))
    await waitFor(() => expect(mocks.publishCvVersion).toHaveBeenCalledWith('cv_1', 0))
    expect(screen.getByText('Đã xuất bản phiên bản 3')).toBeInTheDocument()
  })

  it('renders the six-tool WYSIWYG shell when the rollout flag is enabled', async () => {
    renderWysiwygEditor()

    expect(await screen.findByLabelText('CV A4 có thể chỉnh sửa')).toBeInTheDocument()
    for (const label of ['Thiết kế & Font', 'Thêm mục', 'Bố cục', 'Đổi mẫu CV', 'Gợi ý viết CV', 'Thư viện CV']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Lưu CV' })).toHaveTextContent('Lưu CV')
    expect(screen.queryByText('Chỉnh sửa bằng biểu mẫu')).not.toBeInTheDocument()
  })

  it('keeps content editing on the canvas without opening a contextual content panel', async () => {
    renderWysiwygEditor()

    const section = await screen.findByLabelText('Mục CV Kinh nghiệm')
    fireEvent.click(section)

    expect(screen.queryByRole('heading', { name: 'Chỉnh sửa nội dung' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('role experience_item_1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thiết kế & Font' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('blocks explicit save until email, address and phone are present', async () => {
    renderWysiwygEditor()

    await screen.findByLabelText('CV A4 có thể chỉnh sửa')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu CV' }))

    expect(await screen.findByRole('dialog', { name: 'Chưa thể lưu CV' })).toBeInTheDocument()
    expect(screen.getByText(/Email, Địa chỉ, Số điện thoại/)).toBeInTheDocument()
    expect(mocks.saveCvVersion).not.toHaveBeenCalled()
  })

  it('warns about incomplete optional sections and commits an immutable version after confirmation', async () => {
    const saveableDraft = draft()
    saveableDraft.content_json.personal_info.email = 'an@example.com'
    saveableDraft.content_json.personal_info.phone = '0909123456'
    saveableDraft.content_json.personal_info.address = 'Hà Nội'
    mocks.getCvDraft.mockResolvedValueOnce(saveableDraft)
    renderWysiwygEditor()

    await screen.findByLabelText('CV A4 có thể chỉnh sửa')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu CV' }))

    expect(await screen.findByRole('dialog', { name: 'Lưu ý' })).toBeInTheDocument()
    expect(screen.getByText(/Vị trí ứng tuyển, Mục tiêu nghề nghiệp, Học vấn, Kinh nghiệm việc làm/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hoàn thiện tiếp' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Lưu CV, tôi sẽ hoàn thiện sau' }))

    expect(await screen.findByText('Lưu CV thành công')).toBeInTheDocument()
    expect(mocks.saveCvVersion).toHaveBeenCalledWith('cv_1', 0)
  })

  it('requires a title for an unnamed CV before continuing the save flow', async () => {
    const saveableDraft = draft()
    saveableDraft.content_json.personal_info.email = 'an@example.com'
    saveableDraft.content_json.personal_info.phone = '0909123456'
    saveableDraft.content_json.personal_info.address = 'Hà Nội'
    mocks.getCv.mockResolvedValueOnce({
      title: 'CV chưa đặt tên', template_public_id: 'tpl_single', template_renderer_key: 'classic_single_column_v1',
      template_capabilities: { layout: { section_drag: true } },
    })
    mocks.getCvDraft.mockResolvedValueOnce(saveableDraft)
    renderWysiwygEditor()

    await screen.findByLabelText('CV A4 có thể chỉnh sửa')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu CV' }))
    expect(await screen.findByRole('dialog', { name: 'Đặt tên cho CV' })).toBeInTheDocument()
    expect(screen.getByText(/Vị trí ứng tuyển, Mục tiêu nghề nghiệp, Học vấn, Kinh nghiệm việc làm/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Tên CV mới'), { target: { value: 'CV Marketing - Nguyễn An' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu và tiếp tục' }))

    await waitFor(() => expect(mocks.renameCv).toHaveBeenCalledWith('cv_1', 'CV Marketing - Nguyễn An'))
    expect(await screen.findByText('Lưu CV thành công')).toBeInTheDocument()
  })

  it('resets CV headings and empty field placeholders to the selected locale without changing user content', async () => {
    renderWysiwygEditor()

    await screen.findByLabelText('CV A4 có thể chỉnh sửa')
    fireEvent.click(screen.getByRole('button', { name: 'Thiết kế & Font' }))
    expect(screen.getByRole('slider', { name: 'Độ đậm và độ sáng của màu' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Chọn màu tùy chỉnh' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tiếng Anh' }))

    expect(screen.getByText('Career objective')).toBeInTheDocument()
    expect(screen.getByText('Skills')).toBeInTheDocument()
    expect(screen.getByText('Work experience')).toBeInTheDocument()
    expect(screen.getByLabelText('role experience_item_1')).toHaveAttribute('aria-placeholder', 'Job title')
    expect(screen.getByLabelText('company experience_item_1')).toHaveAttribute('aria-placeholder', 'Company')
    await waitFor(() => expect(mocks.updateCvDraft).toHaveBeenCalledWith('cv_1', expect.objectContaining({
      content_json: expect.objectContaining({ locale: 'en-US', sections: expect.arrayContaining([expect.objectContaining({ section_key: 'summary', title: 'Career objective' })]) }),
    }), 0, expect.any(String)), { timeout: 1500 })
  })

  it('applies the selected font stack directly to the A4 document surface', async () => {
    renderWysiwygEditor()

    await screen.findByLabelText('CV A4 có thể chỉnh sửa')
    fireEvent.click(screen.getByRole('button', { name: 'Thiết kế & Font' }))
    fireEvent.mouseDown(screen.getByLabelText('Font chữ CV'))
    fireEvent.click(await screen.findByText('Arial'))

    expect(screen.getByLabelText('Xem trước CV classic_single_column_v1 trang 1')).toHaveStyle({ fontFamily: 'Arial, Helvetica, sans-serif' })
  })

  it('sets a skill level from the canvas notches and clears it on a second click', async () => {
    renderWysiwygEditor()
    await screen.findByLabelText('CV A4 có thể chỉnh sửa')

    fireEvent.click(screen.getByRole('button', { name: 'Mức độ 3 trên 5 skills_item_1' }))
    expect(screen.getByRole('button', { name: 'Mức độ 3 trên 5 skills_item_1' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Mức độ 4 trên 5 skills_item_1' })).toHaveAttribute('aria-pressed', 'false')
    await waitFor(() => expect(mocks.updateCvDraft).toHaveBeenCalledWith('cv_1', expect.objectContaining({
      content_json: expect.objectContaining({ sections: expect.arrayContaining([expect.objectContaining({ section_key: 'skills', items: [expect.objectContaining({ level: 3 })] })]) }),
    }), 0, expect.any(String)), { timeout: 1500 })

    fireEvent.click(screen.getByRole('button', { name: 'Mức độ 3 trên 5 skills_item_1' }))
    expect(screen.getByRole('button', { name: 'Mức độ 3 trên 5 skills_item_1' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('inserts the new entry right below the anchor entry from the item toolbar', async () => {
    renderWysiwygEditor()
    await screen.findByLabelText('CV A4 có thể chỉnh sửa')

    fireEvent.click(screen.getByRole('button', { name: 'Thêm nội dung sau experience_item_1' }))
    expect(screen.getByLabelText('role experience_item_2')).toBeInTheDocument()

    // A second "add right after item 1" must land between item 1 and item 2.
    fireEvent.click(screen.getByRole('button', { name: 'Thêm nội dung sau experience_item_1' }))
    expect(within(screen.getByLabelText('Nội dung 2 của Kinh nghiệm')).getByLabelText('role experience_item_3')).toBeInTheDocument()
    expect(within(screen.getByLabelText('Nội dung 3 của Kinh nghiệm')).getByLabelText('role experience_item_2')).toBeInTheDocument()
  })
})
