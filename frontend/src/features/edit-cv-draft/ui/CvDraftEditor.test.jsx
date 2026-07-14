import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CvDraftEditor from './CvDraftEditor'

const mocks = vi.hoisted(() => ({
  getCv: vi.fn(), getCvDraft: vi.fn(), updateCvDraft: vi.fn(), saveCvVersion: vi.fn(),
}))

vi.mock('@/entities/cv', async (importOriginal) => ({
  ...(await importOriginal()),
  getCv: mocks.getCv,
  getCvDraft: mocks.getCvDraft,
  updateCvDraft: mocks.updateCvDraft,
  saveCvVersion: mocks.saveCvVersion,
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
    mocks.getCv.mockResolvedValue({ title: 'CV thử nghiệm', template_renderer_key: 'classic_single_column_v1' })
    mocks.getCvDraft.mockResolvedValue(draft())
    mocks.updateCvDraft.mockResolvedValue({ lock_version: 1 })
    mocks.saveCvVersion.mockResolvedValue({ public_id: 'version_2', version_number: 2 })
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
})
