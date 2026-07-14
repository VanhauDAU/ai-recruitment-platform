import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CvDocumentPreview from './CvDocumentPreview'

const document = {
  content_json: {
    personal_info: { full_name: 'Nguyễn An', headline: 'Front-end Developer', email: 'an@example.com', phone: '', address: '' },
    sections: [
      { instance_id: 'summary_1', section_key: 'summary', title: 'Mục tiêu nghề nghiệp', enabled: true, items: [{ item_id: 'summary_item_1', value: 'Xây sản phẩm hữu ích' }] },
      { instance_id: 'skills_1', section_key: 'skills', title: 'Kỹ năng', enabled: true, items: [{ item_id: 'skills_item_1', name: 'React' }] },
    ],
  },
  layout_json: { regions: [{ id: 'main', width_percent: 70, section_instance_ids: ['summary_1'] }, { id: 'sidebar', width_percent: 30, section_instance_ids: ['skills_1'] }] },
  style_json: { theme_color: '#00A66A', font_family: 'Inter', font_scale: 1, line_height: 1.4 },
}

describe('CV document preview', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders canonical content in the two-column A4 renderer without template-specific content conversion', () => {
    render(<CvDocumentPreview document={document} rendererKey="classic_two_column_v1" />)

    expect(screen.getByLabelText('Xem trước CV classic_two_column_v1 trang 1')).toBeInTheDocument()
    expect(screen.getByText('Nguyễn An')).toBeInTheDocument()
    expect(screen.getByText('Xây sản phẩm hữu ích')).toBeInTheDocument()
    expect(screen.getByText('React')).toBeInTheDocument()
  })

  it('exposes A4 page breaks and warns when the final rendered page overflows', () => {
    const longDocument = JSON.parse(JSON.stringify(document))
    longDocument.content_json.sections.push(...Array.from({ length: 6 }, (_, index) => ({
      instance_id: `project_${index + 1}`,
      section_key: 'projects',
      title: 'Dự án',
      enabled: true,
      items: [{ item_id: `project_item_${index + 1}`, name: `Dự án ${index + 1}`, description: { format: 'rich_text_v1', content: [{ type: 'paragraph', text: 'Nội dung dài '.repeat(50) }] } }],
    })))
    longDocument.layout_json.regions[0].section_instance_ids.push(...longDocument.content_json.sections.filter((section) => section.section_key === 'projects').map((section) => section.instance_id))
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(10)

    render(<CvDocumentPreview document={longDocument} rendererKey="classic_two_column_v1" />)

    expect(screen.getByLabelText('Xem trước CV classic_two_column_v1 trang 2')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Nội dung có thể bị tràn ở trang')
  })
})
