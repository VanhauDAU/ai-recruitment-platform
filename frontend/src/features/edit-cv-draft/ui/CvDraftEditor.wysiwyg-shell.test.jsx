import { render, screen } from '@testing-library/react'
import { App } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SITE_SETTINGS, SiteSettingsContext } from '@/entities/site-settings'
import CvDraftEditor from './CvDraftEditor'

const mocks = vi.hoisted(() => ({ getCv: vi.fn(), getCvDraft: vi.fn() }))

vi.mock('@/entities/cv', async (importOriginal) => ({
  ...(await importOriginal()),
  getCv: mocks.getCv,
  getCvDraft: mocks.getCvDraft,
}))

// The rollout smoke test verifies the editor shell. The editable canvas has
// dedicated interaction tests and initializes DnD for every item, which makes
// this otherwise small assertion flaky under coverage on two-core CI runners.
vi.mock('./canvas/CvEditableCanvas', () => ({
  default: () => <div aria-label="CV A4 có thể chỉnh sửa" />,
}))

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }) => children,
  DragOverlay: ({ children }) => children,
  KeyboardSensor: class {},
  PointerSensor: class {},
  TouchSensor: class {},
  closestCenter: () => null,
  useSensor: () => null,
  useSensors: () => [],
}))

vi.mock('@dnd-kit/sortable', () => ({ sortableKeyboardCoordinates: () => null }))

function draft() {
  return {
    schema_version: 1,
    lock_version: 0,
    content_json: {
      schema_version: 1,
      locale: 'vi-VN',
      custom_fields: {},
      personal_info: { full_name: 'Nguyễn An', headline: '', email: '', phone: '', address: '', avatar_asset_id: null, links: [] },
      sections: [],
    },
    layout_json: { schema_version: 1, page: { size: 'A4', margin_mm: 12 }, regions: [{ id: 'main', width_percent: 100, section_instance_ids: [] }] },
    style_json: { schema_version: 1, theme_color: '#00A66A', font_family: 'Roboto', font_scale: 1, line_height: 1.4, background_asset_id: null, section_overrides: {} },
  }
}

describe('CV draft editor WYSIWYG shell', () => {
  beforeEach(() => {
    mocks.getCv.mockReset()
    mocks.getCvDraft.mockReset()
    mocks.getCv.mockResolvedValue({
      title: 'CV thử nghiệm',
      template_public_id: 'tpl_single',
      template_renderer_key: 'classic_single_column_v1',
      template_capabilities: {},
    })
    mocks.getCvDraft.mockResolvedValue(draft())
  })

  it('renders the six-tool shell when the rollout flag is enabled', async () => {
    render(
      <App>
        <SiteSettingsContext.Provider value={{ settings: { ...DEFAULT_SITE_SETTINGS, cv_builder_wysiwyg_enabled: true } }}>
          <CvDraftEditor publicId="cv_1" />
        </SiteSettingsContext.Provider>
      </App>,
    )

    expect(await screen.findByLabelText('CV A4 có thể chỉnh sửa')).toBeInTheDocument()
    for (const label of ['Thiết kế & Font', 'Thêm mục', 'Bố cục', 'Đổi mẫu CV', 'Gợi ý viết CV', 'Thư viện CV']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Lưu CV' })).toHaveTextContent('Lưu CV')
    expect(screen.queryByText('Chỉnh sửa bằng biểu mẫu')).not.toBeInTheDocument()
  })
})
