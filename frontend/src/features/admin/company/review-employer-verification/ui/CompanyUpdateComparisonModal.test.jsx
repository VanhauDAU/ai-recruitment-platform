import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CompanyUpdateComparisonModal from './CompanyUpdateComparisonModal'

const REQUEST = {
  company: { name: 'ACME' },
  requested_by_email: 'hr@acme.vn',
  status: 'submitted',
  revision: 1,
  changes: {
    headline: 'Xây phần mềm tử tế',
    culture: '<p>Cởi mở</p><script>window.bad = true</script>',
    video_url: 'https://youtu.be/dQw4w9WgXcQ',
    social_links: { facebook: 'https://facebook.com/acme', linkedin: '' },
    benefits: [{ benefit_id: 7, note: 'Cho cả gia đình' }],
    offices: [{ label: 'Trụ sở chính', address_line: '1 Duy Tân', province_id: 1, is_headquarters: true }],
  },
  current_values: {
    headline: '',
    culture: '',
    video_url: '',
    social_links: {},
    benefits: [{ name: 'Laptop', note: '' }],
    offices: [],
  },
  previews: {
    benefits: [{ name: 'Bảo hiểm sức khoẻ', note: 'Cho cả gia đình' }],
    offices: [{ label: 'Trụ sở chính', address: '1 Duy Tân', province_name: 'Hà Nội', is_headquarters: true }],
  },
  documents: [],
}

function row(label) {
  return screen.getByRole('rowheader', { name: label }).closest('[role="row"]')
}

describe('CompanyUpdateComparisonModal page content fields', () => {
  it('labels and renders headline, culture, video, social links, benefits and offices', () => {
    render(<CompanyUpdateComparisonModal open updateRequest={REQUEST} onClose={vi.fn()} />)

    expect(within(row('Khẩu hiệu')).getByText('Xây phần mềm tử tế')).toBeInTheDocument()
    expect(within(row('Video giới thiệu')).getByText('https://youtu.be/dQw4w9WgXcQ')).toBeInTheDocument()

    const culture = row('Văn hoá công ty')
    expect(within(culture).getByText('Cởi mở')).toBeInTheDocument()
    expect(culture.querySelector('script')).toBeNull()

    const social = row('Mạng xã hội')
    expect(within(social).getByText('Facebook: https://facebook.com/acme')).toBeInTheDocument()
    expect(within(social).queryByText(/LinkedIn/)).not.toBeInTheDocument()

    const benefits = row('Phúc lợi dạng thẻ')
    expect(within(benefits).getByText('Laptop')).toBeInTheDocument()
    expect(within(benefits).getByText('Bảo hiểm sức khoẻ — Cho cả gia đình')).toBeInTheDocument()
    expect(within(benefits).queryByText(/benefit_id/)).not.toBeInTheDocument()

    const offices = row('Văn phòng')
    expect(within(offices).getByText('Chưa có')).toBeInTheDocument()
    expect(within(offices).getByText('Trụ sở chính: 1 Duy Tân, Hà Nội (trụ sở chính)')).toBeInTheDocument()
  })
})
