import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import CompanyProfileView from './CompanyProfileView'

const VIDEO = {
  key: 'video',
  type: 'video',
  title: 'Video giới thiệu',
  provider: 'youtube',
  video_id: 'dQw4w9WgXcQ',
  embed_url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
}

function renderProfile({ sections = [], sidebar = [], identity = {} } = {}) {
  return render(
    <CompanyProfileView
      profile={{
        public_id: 'co_1',
        slug: 'acme',
        identity: { display_name: 'ACME', legal_name: '', logo_url: '', cover_image_url: '', website_url: '', industries: [], ...identity },
        stats: { active_public_job_count: 0 },
        theme: {},
        sections,
        sidebar,
      }}
    />,
  )
}

describe('company page section types (CP-6)', () => {
  it('shows the headline under the company name only when present', () => {
    const { rerender } = renderProfile({ identity: { headline: 'Xây phần mềm tử tế' } })
    expect(screen.getByText('Xây phần mềm tử tế')).toHaveClass('company-profile-headline')

    rerender(<CompanyProfileView profile={{ identity: { display_name: 'ACME', industries: [] }, stats: {}, sections: [], sidebar: [] }} />)
    expect(document.querySelector('.company-profile-headline')).toBeNull()
  })

  it('loads the video iframe only after the viewer presses play', async () => {
    const user = userEvent.setup()
    const { container } = renderProfile({ sections: [VIDEO] })

    expect(container.querySelector('iframe')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Phát Video giới thiệu trên YouTube' }))

    const iframe = container.querySelector('iframe')
    expect(iframe).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1')
    expect(iframe).toHaveAttribute('title', 'Video giới thiệu')
    expect(iframe).toHaveAttribute('loading', 'lazy')
  })

  it('hides a video whose embed URL does not match its provider and id', () => {
    renderProfile({ sections: [{ ...VIDEO, embed_url: 'https://evil.example/embed/dQw4w9WgXcQ' }, { ...VIDEO, key: 'v2', provider: 'other' }] })

    expect(screen.queryByRole('heading', { name: 'Video giới thiệu' })).not.toBeInTheDocument()
  })

  it('renders benefit cards with notes, then the rich text, and keeps old rich-text payloads', () => {
    const { rerender } = renderProfile({
      sections: [{
        key: 'benefits',
        type: 'benefits',
        title: 'Phúc lợi',
        items: [
          { name: 'Bảo hiểm sức khoẻ', icon: 'heart', category: 'welfare', note: 'Cho cả gia đình' },
          { name: 'Laptop', icon: '', category: 'equipment', note: '' },
        ],
        body_html: '<p>Thưởng tháng 13</p><script>window.bad = true</script>',
      }],
    })

    const benefits = screen.getByRole('region', { name: 'Phúc lợi' })
    expect(within(benefits).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Bảo hiểm sức khoẻCho cả gia đình', 'Laptop'])
    expect(within(benefits).getByText('Thưởng tháng 13')).toBeVisible()
    expect(benefits.querySelector('script')).toBeNull()

    rerender(<CompanyProfileView profile={{ identity: { display_name: 'ACME', industries: [] }, stats: {}, sections: [{ key: 'benefits', type: 'rich_text', title: 'Phúc lợi', body_html: '<p>Bảo hiểm</p>' }], sidebar: [] }} />)
    expect(screen.getByText('Bảo hiểm')).toBeVisible()
  })

  it('hides an empty benefits section entirely', () => {
    renderProfile({ sections: [{ key: 'benefits', type: 'benefits', title: 'Phúc lợi', items: [], body_html: '<p> </p>' }] })

    expect(screen.queryByRole('heading', { name: 'Phúc lợi' })).not.toBeInTheDocument()
  })

  it('links social networks in a new tab and never renders a javascript: URL as a link', () => {
    renderProfile({
      sidebar: [{
        key: 'social_links',
        type: 'social_links',
        title: 'Mạng xã hội',
        items: [
          { network: 'facebook', label: 'Facebook', url: 'https://facebook.com/acme' },
          { network: 'linkedin', label: 'LinkedIn', url: 'javascript:alert(1)' },
          { network: 'tiktok', label: 'TikTok', url: 'data:text/html,hi' },
        ],
      }],
    })

    const social = screen.getByRole('region', { name: 'Mạng xã hội' })
    const links = within(social).getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAccessibleName('Facebook')
    expect(links[0]).toHaveAttribute('href', 'https://facebook.com/acme')
    expect(links[0]).toHaveAttribute('target', '_blank')
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer nofollow')
    expect(social.querySelector('a[href^="javascript"]')).toBeNull()
  })

  it('hides the social block when no link is safe', () => {
    renderProfile({ sidebar: [{ key: 'social_links', type: 'social_links', title: 'Mạng xã hội', items: [{ network: 'facebook', url: 'javascript:alert(1)' }] }] })

    expect(screen.queryByRole('heading', { name: 'Mạng xã hội' })).not.toBeInTheDocument()
  })

  it('shows the province and marks the headquarters of each office', () => {
    renderProfile({
      sidebar: [{
        key: 'offices',
        type: 'offices',
        title: 'Địa điểm',
        items: [
          { label: 'Văn phòng Hà Nội', address: '17 Duy Tân', province_name: 'Hà Nội', is_headquarters: true },
          { label: 'Chi nhánh', address: '2 Lê Lợi', province_name: 'TP. Hồ Chí Minh', is_headquarters: false },
        ],
      }],
    })

    const [headquarters, branch] = within(screen.getByRole('region', { name: 'Địa điểm' })).getAllByRole('listitem')
    expect(headquarters).toHaveTextContent('Văn phòng Hà NộiTrụ sở chính17 Duy TânHà Nội')
    expect(branch).toHaveTextContent('Chi nhánh2 Lê LợiTP. Hồ Chí Minh')
    expect(branch).not.toHaveTextContent('Trụ sở chính')
  })
})
