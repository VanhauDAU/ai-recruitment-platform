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

  it('exposes A4 page breaks without showing an overflow warning to the reader', () => {
    const longDocument = JSON.parse(JSON.stringify(document))
    longDocument.content_json.sections.push(...Array.from({ length: 6 }, (_, index) => ({
      instance_id: `project_${index + 1}`,
      section_key: 'projects',
      title: 'Dự án',
      enabled: true,
      items: [{ item_id: `project_item_${index + 1}`, name: `Dự án ${index + 1}`, description: { format: 'rich_text_v1', content: [{ type: 'paragraph', text: 'Nội dung dài '.repeat(50) }] } }],
    })))
    longDocument.layout_json.regions[0].section_instance_ids.push(...longDocument.content_json.sections.filter((section) => section.section_key === 'projects').map((section) => section.instance_id))
    render(<CvDocumentPreview document={longDocument} rendererKey="classic_two_column_v1" />)

    expect(screen.getByLabelText('Xem trước CV classic_two_column_v1 trang 2')).toBeInTheDocument()
    expect(screen.queryByText(/Nội dung có thể bị tràn ở trang/)).not.toBeInTheDocument()
  })

  it('wraps contact details by group and keeps long skill names readable', () => {
    const responsiveDocument = JSON.parse(JSON.stringify(document))
    responsiveDocument.content_json.personal_info.email = 'nguyen.an.frontend.engineer@example.com'
    responsiveDocument.content_json.personal_info.phone = '0909 123 456'
    responsiveDocument.content_json.sections[1].items[0].name = 'Thiết kế và triển khai hệ thống giao diện phức tạp'

    render(<CvDocumentPreview document={responsiveDocument} rendererKey="classic_two_column_v1" />)

    expect(screen.getByText('nguyen.an.frontend.engineer@example.com')).toHaveClass('break-words')
    expect(screen.getByText('Thiết kế và triển khai hệ thống giao diện phức tạp')).not.toHaveClass('truncate')
  })

  it('keeps the plain-text fallback when an empty rich-text description is present', () => {
    const fallbackDocument = JSON.parse(JSON.stringify(document))
    fallbackDocument.content_json.sections[0].items[0] = {
      ...fallbackDocument.content_json.sections[0].items[0],
      value: 'Mục tiêu vẫn phải xuất hiện trong Preview',
      description: { format: 'rich_text_v1', content: [] },
    }

    render(<CvDocumentPreview document={fallbackDocument} rendererKey="classic_two_column_v1" />)

    expect(screen.getByText('Mục tiêu vẫn phải xuất hiện trong Preview')).toBeInTheDocument()
  })

  it('omits empty sections and empty personal placeholders in read-only preview', () => {
    const blankDocument = JSON.parse(JSON.stringify(document))
    blankDocument.content_json.personal_info = {}
    blankDocument.content_json.sections = [{
      instance_id: 'summary_1',
      section_key: 'summary',
      title: 'Mục tiêu nghề nghiệp',
      enabled: true,
      items: [{ item_id: 'summary_item_1', value: '', description: { format: 'rich_text_v1', content: [] } }],
    }]
    blankDocument.layout_json.regions = [{ id: 'main', width_percent: 100, section_instance_ids: ['summary_1'] }]

    render(<CvDocumentPreview document={blankDocument} rendererKey="classic_two_column_v1" />)

    expect(screen.queryByText('Mục tiêu nghề nghiệp')).not.toBeInTheDocument()
    expect(screen.queryByText('Họ và tên')).not.toBeInTheDocument()
  })

  it('uses the same avatar crop and size stored by the canvas editor', () => {
    const avatarDocument = JSON.parse(JSON.stringify(document))
    avatarDocument.content_json.personal_info.avatar_asset_id = 'avatar_1'
    avatarDocument.content_json.personal_info.avatar_position = { x: 20, y: 75 }
    avatarDocument.content_json.personal_info.avatar_size_mm = 36
    avatarDocument.content_json.personal_info.avatar_zoom = 1.6
    avatarDocument.content_json.sections.push({
      instance_id: 'avatar_1',
      section_key: 'avatar',
      title: 'Ảnh đại diện',
      enabled: true,
      items: [],
    })
    avatarDocument.layout_json.regions[1].section_instance_ids.unshift('avatar_1')

    render(<CvDocumentPreview document={avatarDocument} rendererKey="classic_two_column_v1" assets={{ avatar_1: { url: '/avatar.jpg' } }} />)

    const avatar = screen.getByRole('img', { name: 'Tải ảnh' })
    expect(avatar).toHaveStyle({
      objectPosition: '20% 75%',
      transform: 'scale(1.6)',
    })
    expect(avatar.parentElement).toHaveStyle({ width: '36mm', height: '36mm' })
  })
})
