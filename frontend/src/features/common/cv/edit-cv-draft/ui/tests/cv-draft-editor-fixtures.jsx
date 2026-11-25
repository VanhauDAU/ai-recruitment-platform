import { render } from '@testing-library/react'
import { App } from 'antd'
import { vi } from 'vitest'
import { DEFAULT_SITE_SETTINGS, SiteSettingsContext } from '@/entities/system/site-settings'
import AppToast from '@/shared/ui/toast/AppToast'
import CvDraftEditor from '../CvDraftEditor'

// Dữ liệu và cách dựng chung cho các file test CvDraftEditor.*.test.jsx (tách file để mỗi
// file nằm trong ngân sách thời gian của scripts/ci/check_test_budgets.mjs). vi.mock phải khai
// ở từng file test; file test truyền mock của mình vào primeEditorMocks.

export function draft() {
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

export function renderLegacyEditor() {
  return render(<SiteSettingsContext.Provider value={{ settings: { ...DEFAULT_SITE_SETTINGS, cv_builder_wysiwyg_enabled: false } }}><CvDraftEditor publicId="cv_1" /></SiteSettingsContext.Provider>)
}

export function renderWysiwygEditor(props = {}) {
  return render(<App><AppToast /><SiteSettingsContext.Provider value={{ settings: { ...DEFAULT_SITE_SETTINGS, cv_builder_wysiwyg_enabled: true } }}><CvDraftEditor publicId="cv_1" {...props} /></SiteSettingsContext.Provider></App>)
}

export function primeEditorMocks(mocks, templateMocks) {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    Object.values(mocks).forEach((mock) => mock.mockReset())
    templateMocks.getCvTemplates.mockReset()
    mocks.getCv.mockResolvedValue({
      title: 'CV thử nghiệm', template_public_id: 'tpl_single', template_renderer_key: 'single_column_v1',
      template_capabilities: { layout: { section_drag: true, cross_region_drag: true, item_drag: true, column_resize: { enabled: true, min_percent: 25, max_percent: 75 } } },
    })
    mocks.getCvDraft.mockResolvedValue(draft())
    mocks.updateCvDraft.mockResolvedValue({ lock_version: 1 })
    mocks.saveCvVersion.mockResolvedValue({ public_id: 'version_2', version_number: 2 })
    mocks.publishCvVersion.mockResolvedValue({ public_id: 'version_3', version_number: 3, version_kind: 'published' })
    mocks.renameCv.mockImplementation(async (_publicId, title) => ({ title, template_public_id: 'tpl_single', template_renderer_key: 'single_column_v1' }))
    templateMocks.getCvTemplates.mockResolvedValue({ results: [{ public_id: 'tpl_single', display_name: 'Một cột' }, { public_id: 'tpl_two', display_name: 'Hai cột' }] })
    templateMocks.getCvBackgrounds.mockResolvedValue([])
    templateMocks.getCvSampleContents.mockResolvedValue([])
    mocks.switchCvTemplate.mockResolvedValue({
      cv: { title: 'CV thử nghiệm', template_public_id: 'tpl_two', template_renderer_key: 'sidebar_right_v1', template_capabilities: { layout: { item_drag: true, column_resize: { enabled: true, min_percent: 25, max_percent: 75 } } } },
      draft: { ...draft(), lock_version: 1, layout_json: { ...draft().layout_json, regions: [{ id: 'main', width_percent: 68, section_instance_ids: ['summary_1', 'experience_1'] }, { id: 'sidebar', width_percent: 32, section_instance_ids: ['skills_1'] }] }, style_json: { ...draft().style_json, theme_color: '#2255AA' } },
    })
}
