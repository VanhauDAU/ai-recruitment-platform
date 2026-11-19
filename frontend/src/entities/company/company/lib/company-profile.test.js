import { describe, expect, it } from 'vitest'
import { companyProfileSummary } from './company-profile'

describe('companyProfileSummary', () => {
  it('reads the about section as plain text', () => {
    const profile = {
      sections: [
        { key: 'jobs', type: 'jobs', title: 'Việc làm đang tuyển' },
        {
          key: 'about',
          type: 'rich_text',
          body_html: '<p>Công ty  <strong>phần mềm</strong> &amp; dịch vụ.</p><script>alert(1)</script>\n<ul><li>Hà Nội</li></ul>',
        },
      ],
    }

    expect(companyProfileSummary(profile)).toBe('Công ty phần mềm & dịch vụ. Hà Nội')
  })

  it('returns an empty summary without an about rich-text section', () => {
    expect(companyProfileSummary(null)).toBe('')
    expect(companyProfileSummary({ sections: [{ key: 'about', type: 'video' }] })).toBe('')
    expect(companyProfileSummary({ sections: [{ key: 'benefits', type: 'rich_text', body_html: '<p>Bảo hiểm</p>' }] }))
      .toBe('')
  })
})
