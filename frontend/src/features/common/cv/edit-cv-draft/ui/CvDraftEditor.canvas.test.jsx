import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { draft, primeEditorMocks, renderWysiwygEditor } from './tests/cv-draft-editor-fixtures'

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

describe('CV draft editor: canvas, save checks and design', () => {
  beforeEach(() => primeEditorMocks(mocks, templateMocks))

  afterEach(() => vi.unstubAllGlobals())

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

  // This exercises the full canvas plus Ant Design's confirmation portal. On
  // constrained CI runners, rendering and committing that portal can exceed
  // Vitest's default 5-second budget even though the workflow is deterministic.
  it('warns about incomplete optional sections and commits an immutable version after confirmation', async () => {
    const saveableDraft = draft()
    saveableDraft.content_json.personal_info.email = 'an@example.com'
    saveableDraft.content_json.personal_info.phone = '0909123456'
    saveableDraft.content_json.personal_info.address = 'Hà Nội'
    mocks.getCvDraft.mockResolvedValueOnce(saveableDraft)
    renderWysiwygEditor()

    await screen.findByLabelText('CV A4 có thể chỉnh sửa')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu CV' }))

    expect(await screen.findByRole('dialog', { name: 'Lưu CV chưa hoàn thiện' })).toBeInTheDocument()
    expect(screen.getByText(/Vị trí ứng tuyển, Mục tiêu nghề nghiệp, Học vấn, Kinh nghiệm việc làm/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hoàn thiện tiếp' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Lưu CV, tôi sẽ hoàn thiện sau' }))

    expect(await screen.findByText('Lưu CV thành công')).toBeInTheDocument()
    expect(mocks.saveCvVersion).toHaveBeenCalledWith('cv_1', 0)
  }, 15_000)

  it('requires a title for an unnamed CV before continuing the save flow', async () => {
    const saveableDraft = draft()
    saveableDraft.content_json.personal_info.email = 'an@example.com'
    saveableDraft.content_json.personal_info.phone = '0909123456'
    saveableDraft.content_json.personal_info.address = 'Hà Nội'
    mocks.getCv.mockResolvedValueOnce({
      title: 'CV chưa đặt tên', template_public_id: 'tpl_single', template_renderer_key: 'single_column_v1',
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
    // Thay đổi chỉ nằm ở bản nháp trên máy cho tới khi người dùng bấm lưu.
    expect(mocks.updateCvDraft).not.toHaveBeenCalled()
  }, 10_000)

  it('applies the selected font stack directly to the A4 document surface', async () => {
    renderWysiwygEditor()

    await screen.findByLabelText('CV A4 có thể chỉnh sửa')
    fireEvent.click(screen.getByRole('button', { name: 'Thiết kế & Font' }))
    fireEvent.mouseDown(screen.getByLabelText('Font chữ CV'))
    fireEvent.click(await screen.findByText('Lora'))

    expect(screen.getByLabelText('Xem trước CV single_column_v1 trang 1')).toHaveStyle({ fontFamily: '"Lora", Georgia, serif' })
  })

  // This mounts the complete sortable canvas; keep its wider budget local to
  // this integration test rather than slowing the unit-test suite globally.
  it('sets a skill level from the canvas notches and clears it on a second click', async () => {
    renderWysiwygEditor()
    await screen.findByLabelText('CV A4 có thể chỉnh sửa')

    fireEvent.click(screen.getByRole('button', { name: 'Mức độ 3 trên 5 skills_item_1' }))
    expect(screen.getByRole('button', { name: 'Mức độ 3 trên 5 skills_item_1' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Mức độ 4 trên 5 skills_item_1' })).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'Mức độ 3 trên 5 skills_item_1' }))
    expect(screen.getByRole('button', { name: 'Mức độ 3 trên 5 skills_item_1' })).toHaveAttribute('aria-pressed', 'false')
  }, 15_000)

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
