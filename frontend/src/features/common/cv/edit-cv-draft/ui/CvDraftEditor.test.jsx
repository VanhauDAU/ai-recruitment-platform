import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SITE_SETTINGS, SiteSettingsContext } from '@/entities/system/site-settings'
import CvDraftEditor from './CvDraftEditor'
import { draft, primeEditorMocks, renderLegacyEditor } from './tests/cv-draft-editor-fixtures'

const mocks = vi.hoisted(() => ({
  getCv: vi.fn(), getCvDraft: vi.fn(), updateCvDraft: vi.fn(), saveCvVersion: vi.fn(), publishCvVersion: vi.fn(), switchCvTemplate: vi.fn(), renameCv: vi.fn(),
}))
const templateMocks = vi.hoisted(() => ({ getCvTemplates: vi.fn(), getCvBackgrounds: vi.fn(), getCvSampleContents: vi.fn() }))

vi.mock('@/entities/cv/cv', async (importOriginal) => ({
  ...(await importOriginal()),
  getCv: mocks.getCv,
  getCvDraft: mocks.getCvDraft,
  updateCvDraft: mocks.updateCvDraft,
  saveCvVersion: mocks.saveCvVersion,
  publishCvVersion: mocks.publishCvVersion,
  switchCvTemplate: mocks.switchCvTemplate,
  renameCv: mocks.renameCv,
}))

vi.mock('@/entities/cv/cv-template', async (importOriginal) => ({
  CV_LANGUAGES: (await importOriginal()).CV_LANGUAGES,
  getCvTemplates: templateMocks.getCvTemplates,
  getCvBackgrounds: templateMocks.getCvBackgrounds,
  getCvSampleContents: templateMocks.getCvSampleContents,
}))

describe('CV draft editor', () => {
  beforeEach(() => primeEditorMocks(mocks, templateMocks))

  afterEach(() => vi.unstubAllGlobals())

  it.each([true, false])('sends an uploaded CV to its read-only view instead of editing it (wysiwyg %s)', async (wysiwyg) => {
    mocks.getCv.mockResolvedValue({ public_id: 'cv_1', cv_type: 'uploaded', title: 'CV.pdf' })
    render(
      <App>
        <SiteSettingsContext.Provider value={{ settings: { ...DEFAULT_SITE_SETTINGS, cv_builder_wysiwyg_enabled: wysiwyg } }}>
          <MemoryRouter initialEntries={['/cvs/cv_1/edit']}>
            <Routes>
              <Route path="/cvs/:publicId/edit" element={<CvDraftEditor publicId="cv_1" />} />
              <Route path="/cvs/:publicId/view" element={<p>Trang xem CV</p>} />
            </Routes>
          </MemoryRouter>
        </SiteSettingsContext.Provider>
      </App>,
    )

    expect(await screen.findByText('Trang xem CV')).toBeInTheDocument()
  })

  it('never autosaves; the save button persists the draft with the lock and then creates a version', async () => {
    renderLegacyEditor()
    const fullName = await screen.findByLabelText('Họ và tên')
    fireEvent.change(fullName, { target: { value: 'Nguyễn Bình' } })
    expect(screen.getByText('Chưa lưu')).toBeInTheDocument()

    await new Promise((resolve) => { setTimeout(resolve, 900) })
    expect(mocks.updateCvDraft).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Lưu phiên bản' }))
    await waitFor(() => expect(mocks.saveCvVersion).toHaveBeenCalledWith('cv_1', 1))
    expect(mocks.updateCvDraft).toHaveBeenCalledWith('cv_1', expect.objectContaining({ content_json: expect.objectContaining({ personal_info: expect.objectContaining({ full_name: 'Nguyễn Bình' }) }) }), 0, expect.any(String))
    expect(screen.getByText('Đã tạo phiên bản 2')).toBeInTheDocument()
  })

  it('stops saving and asks the user to reload on a 409 conflict', async () => {
    mocks.updateCvDraft.mockRejectedValue({ response: { status: 409, data: { current_lock_version: 4 } } })
    renderLegacyEditor()
    fireEvent.change(await screen.findByLabelText('Họ và tên'), { target: { value: 'Tab khác' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu phiên bản' }))

    await screen.findByText('Bản nháp vừa được sửa ở tab khác')
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
    fireEvent.click(screen.getByRole('button', { name: 'Lưu phiên bản' }))

    await waitFor(() => expect(mocks.updateCvDraft).toHaveBeenCalledWith('cv_1', expect.objectContaining({
      content_json: expect.objectContaining({ sections: expect.arrayContaining([
        expect.objectContaining({ instance_id: 'experience_1', title: 'Kinh nghiệm nổi bật', items: [expect.objectContaining({ item_id: 'experience_item_1' }), expect.objectContaining({ item_id: 'experience_item_2' })] }),
      ]) }),
      layout_json: expect.objectContaining({ item_orders: expect.objectContaining({ experience_1: ['experience_item_2', 'experience_item_1'] }) }),
    }), 0, expect.any(String)))
  })

  it('undoes and redoes edits locally without saving them as history commands', async () => {
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
    expect(screen.getByText(/sidebar_right_v1/)).toBeInTheDocument()
  })

  it('asks before leaving with unsaved edits, retries a failed save, and can restore the server draft', async () => {
    mocks.updateCvDraft.mockRejectedValueOnce({ response: { data: { detail: 'Mất kết nối' } } }).mockResolvedValue({ lock_version: 1 })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    renderLegacyEditor()
    fireEvent.change(await screen.findByLabelText('Họ và tên'), { target: { value: 'Chưa lưu' } })

    const beforeUnload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(beforeUnload)
    expect(beforeUnload.defaultPrevented).toBe(true)

    const destination = document.createElement('a')
    destination.href = '/viec-lam'
    document.body.append(destination)
    const stay = new MouseEvent('click', { bubbles: true, cancelable: true })
    destination.dispatchEvent(stay)
    expect(stay.defaultPrevented).toBe(true)
    const leave = new MouseEvent('click', { bubbles: true, cancelable: true })
    leave.preventDefault = vi.fn()
    destination.dispatchEvent(leave)
    expect(leave.preventDefault).not.toHaveBeenCalled()
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(mocks.updateCvDraft).not.toHaveBeenCalled()
    destination.remove()

    fireEvent.click(screen.getByRole('button', { name: 'Lưu phiên bản' }))
    await screen.findByText('Không thể lưu bản nháp')
    fireEvent.click(screen.getByRole('button', { name: 'Thử lưu lại' }))
    await waitFor(() => expect(mocks.updateCvDraft).toHaveBeenCalledTimes(2))

    mocks.updateCvDraft.mockRejectedValueOnce({ response: { data: { detail: 'Mất kết nối lần nữa' } } })
    fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: 'Cần khôi phục' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu phiên bản' }))
    await screen.findByText('Không thể lưu bản nháp')
    fireEvent.click(screen.getByRole('button', { name: 'Khôi phục bản nháp đã lưu' }))
    await waitFor(() => expect(mocks.getCvDraft).toHaveBeenCalledTimes(2))
    confirm.mockRestore()
  })

  it('returns to the saved draft state when retrying after version creation fails', async () => {
    mocks.saveCvVersion.mockRejectedValueOnce({
      response: { data: { detail: 'Không thể tạo phiên bản' } },
    })
    renderLegacyEditor()
    await screen.findByLabelText('Họ và tên')

    fireEvent.click(screen.getByRole('button', { name: 'Lưu phiên bản' }))
    await screen.findByText('Không thể lưu bản nháp')
    expect(mocks.updateCvDraft).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Thử lưu lại' }))

    await screen.findByText('Đã lưu')
    expect(mocks.updateCvDraft).not.toHaveBeenCalled()
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
})
