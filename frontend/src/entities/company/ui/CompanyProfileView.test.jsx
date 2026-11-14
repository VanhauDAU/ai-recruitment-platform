import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CompanyProfileView from './CompanyProfileView'

const PROFILE = {
  public_id: 'co_ab12',
  slug: 'fpt-software',
  canonical_path: '/cong-ty/fpt-software',
  indexable: true,
  identity: {
    display_name: 'FPT Software',
    legal_name: 'Công ty TNHH Phần mềm FPT',
    logo_url: 'https://cdn.example/logo.png',
    cover_image_url: 'https://cdn.example/cover.png',
    website_url: 'https://fpt-software.com',
    industries: [
      { id: 1, name: 'Công nghệ thông tin', slug: 'cong-nghe-thong-tin', is_primary: true },
      { id: 2, name: 'Fintech', slug: 'fintech', is_primary: false },
    ],
  },
  stats: {
    active_public_job_count: 12,
    company_size: '100-499',
    company_size_display: '100 - 499 nhân viên',
    founded_year: 2010,
  },
  theme: { accent: { key: 'ocean', primary: '#0b6bcb', hover: '#084f96', soft: '#eef6ff' } },
  sections: [
    { key: 'about', type: 'rich_text', title: 'Giới thiệu công ty', body_html: '<p>Chúng tôi làm phần mềm.</p><script>window.bad = true</script>' },
    { key: 'jobs', type: 'jobs', title: 'Việc làm đang tuyển' },
    { key: 'benefits', type: 'rich_text', title: 'Phúc lợi', body_html: '<ul><li>Bảo hiểm sức khoẻ</li></ul>' },
    { key: 'video', type: 'video', title: 'Video giới thiệu', url: 'https://youtube.com/watch?v=1' },
    {
      key: 'gallery',
      type: 'gallery',
      title: 'Hình ảnh công ty',
      items: [
        { image_url: 'https://cdn.example/office-1.png', caption: 'Văn phòng Hà Nội' },
        { image_url: 'https://cdn.example/office-2.png', caption: '' },
      ],
    },
  ],
  sidebar: [
    {
      key: 'general_info',
      type: 'facts',
      title: 'Thông tin chung',
      items: [
        { key: 'company_size', label: 'Quy mô', value: '100 - 499 nhân viên' },
        { key: 'unknown_fact', label: 'Chứng nhận', value: 'ISO 27001' },
        { key: 'website', label: 'Website', value: 'fpt-software.com', href: 'https://fpt-software.com' },
        { key: 'unsafe', label: 'Liên kết lạ', value: 'bấm vào đây', href: 'javascript:alert(1)' },
      ],
    },
    { key: 'offices', type: 'offices', title: 'Địa điểm', items: [{ label: 'Trụ sở chính', address: '17 Duy Tân, Cầu Giấy, Hà Nội' }] },
    { key: 'social_links', type: 'social_links', title: 'Mạng xã hội', items: [{ network: 'facebook', url: 'https://facebook.com/fpt' }] },
    { key: 'share', type: 'share', title: 'Chia sẻ công ty' },
    { key: 'similar_companies', type: 'similar_companies', title: 'Công ty cùng lĩnh vực' },
  ],
}

const SPARSE_PROFILE = {
  public_id: 'co_sparse',
  slug: 'cua-hang-binh-minh',
  identity: {
    display_name: 'cửa hàng Bình Minh',
    legal_name: '',
    logo_url: '',
    cover_image_url: '',
    website_url: '',
    industries: [{ id: 9, name: 'Bán lẻ', slug: 'ban-le', is_primary: true }],
  },
  stats: { active_public_job_count: 0, company_size: '', company_size_display: '', founded_year: null },
  theme: { accent: { key: 'brand', primary: '#00b14f', hover: '#008a3e', soft: '#f0fbf5' } },
  sections: [{ key: 'jobs', type: 'jobs', title: 'Việc làm đang tuyển' }],
  sidebar: [
    { key: 'general_info', type: 'facts', title: 'Thông tin chung', items: [{ key: 'industries', label: 'Lĩnh vực', value: 'Bán lẻ' }] },
    { key: 'share', type: 'share', title: 'Chia sẻ công ty' },
    { key: 'similar_companies', type: 'similar_companies', title: 'Công ty cùng lĩnh vực' },
  ],
}

function headings() {
  return screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
}

describe('CompanyProfileView', () => {
  it('renders the hero and every known section type in the order the server sent', () => {
    const { container } = render(<CompanyProfileView profile={PROFILE} />)

    expect(screen.getByRole('heading', { level: 1, name: 'FPT Software' })).toBeVisible()
    expect(screen.getByText('Công ty TNHH Phần mềm FPT')).toBeVisible()
    expect(within(screen.getByRole('list', { name: 'Lĩnh vực hoạt động' })).getAllByRole('listitem')
      .map((item) => item.textContent)).toEqual(['Công nghệ thông tin', 'Fintech'])
    expect(screen.getByText('12 việc làm đang tuyển')).toBeVisible()
    expect(container.querySelector('.company-profile-cover > img')).toHaveAttribute('src', 'https://cdn.example/cover.png')
    expect(container.querySelector('.company-profile-cover')).not.toHaveClass('company-profile-cover--fallback')
    expect(screen.getByRole('link', { name: /Website$/ })).toHaveAttribute('href', 'https://fpt-software.com')

    // `jobs`/`similar_companies` cần slot của nơi dùng; video thiếu URL nhúng chuẩn bị ẩn.
    expect(headings()).toEqual([
      'Giới thiệu công ty',
      'Phúc lợi',
      'Hình ảnh công ty',
      'Thông tin chung',
      'Địa điểm',
      'Mạng xã hội',
      'Chia sẻ công ty',
    ])
    expect(screen.getByText('Chúng tôi làm phần mềm.')).toBeVisible()
    expect(container.querySelector('script')).toBeNull()
    expect(screen.getByText('Bảo hiểm sức khoẻ')).toBeVisible()
    expect(screen.getByRole('img', { name: 'Văn phòng Hà Nội' })).toHaveAttribute('src', 'https://cdn.example/office-1.png')
    expect(screen.getByRole('img', { name: 'Hình ảnh công ty 2' })).toBeInTheDocument()
    expect(screen.getByText('17 Duy Tân, Cầu Giấy, Hà Nội')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Sao chép đường dẫn' })).toBeVisible()
  })

  it('renders facts generically and only links http(s) targets', () => {
    render(<CompanyProfileView profile={PROFILE} />)

    const facts = screen.getByRole('region', { name: 'Thông tin chung' })
    expect(within(facts).getByText('ISO 27001')).toBeVisible()
    expect(within(facts).getByRole('link', { name: 'fpt-software.com' })).toHaveAttribute('href', 'https://fpt-software.com')
    expect(within(facts).getByRole('link', { name: 'fpt-software.com' })).toHaveAttribute('rel', 'noopener noreferrer nofollow')
    expect(within(facts).getByText('bấm vào đây').closest('a')).toBeNull()
  })

  it('scopes the accent to CSS variables on the profile root and falls back to the brand', () => {
    const { container, rerender } = render(<CompanyProfileView profile={PROFILE} />)
    const root = container.querySelector('.company-profile')

    expect(root.style.getPropertyValue('--company-accent')).toBe('#0b6bcb')
    expect(root.style.getPropertyValue('--company-accent-hover')).toBe('#084f96')
    expect(root.style.getPropertyValue('--company-accent-soft')).toBe('#eef6ff')

    rerender(<CompanyProfileView profile={{ ...PROFILE, theme: { accent: { primary: 'red; background: url(x)' } } }} />)
    expect(root.style.getPropertyValue('--company-accent')).toBe('var(--brand-primary)')
    expect(root.style.getPropertyValue('--company-accent-hover')).toBe('var(--brand-primary-hover)')
    expect(root.style.getPropertyValue('--company-accent-soft')).toBe('var(--brand-primary-soft)')
  })

  it('fills slot-only blocks from the consumer and hides them when the slot is empty', () => {
    render(
      <CompanyProfileView
        profile={PROFILE}
        heroActions={<a href="/cong-ty/fpt-software?tab=viec-lam">Xem việc làm</a>}
        navigation={<nav aria-label="Nội dung trang công ty" />}
        slots={{ jobs: <p>5 tin đầu tiên</p>, similar_companies: null }}
      />,
    )

    expect(screen.getByRole('link', { name: 'Xem việc làm' })).toBeVisible()
    expect(screen.getByRole('navigation', { name: 'Nội dung trang công ty' })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Việc làm đang tuyển' })).getByText('5 tin đầu tiên')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Công ty cùng lĩnh vực' })).not.toBeInTheDocument()
    expect(headings().indexOf('Việc làm đang tuyển')).toBe(headings().indexOf('Giới thiệu công ty') + 1)
  })

  it('narrows the main column to one section type while keeping the sidebar', () => {
    render(<CompanyProfileView profile={PROFILE} focusType="jobs" slots={{ jobs: <p>Danh sách có bộ lọc</p> }} />)

    expect(headings()).toEqual(['Việc làm đang tuyển', 'Thông tin chung', 'Địa điểm', 'Mạng xã hội', 'Chia sẻ công ty'])
    expect(screen.getByText('Danh sách có bộ lọc')).toBeVisible()
  })

  it('keeps a sparse company complete with the accent band and an initial-letter logo', () => {
    const { container } = render(
      <CompanyProfileView
        profile={SPARSE_PROFILE}
        slots={{ jobs: <p>Công ty chưa có việc làm đang tuyển.</p>, similar_companies: <p>Công ty Sao Mai</p> }}
      />,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'cửa hàng Bình Minh' })).toBeVisible()
    expect(container.querySelector('.company-profile-cover')).toHaveClass('company-profile-cover--fallback')
    expect(container.querySelector('.company-profile-cover img')).toBeNull()
    expect(container.querySelector('.company-profile-logo')).toHaveTextContent('C')
    expect(container.querySelector('.company-profile-logo img')).toBeNull()
    expect(screen.getByText('Chưa có việc làm đang tuyển')).toBeVisible()
    expect(screen.queryByRole('link', { name: /Website/ })).not.toBeInTheDocument()
    expect(headings()).toEqual([
      'Việc làm đang tuyển',
      'Thông tin chung',
      'Chia sẻ công ty',
      'Công ty cùng lĩnh vực',
    ])
  })

  it('never leaves an orphan heading for a section without content', () => {
    render(
      <CompanyProfileView
        profile={{
          ...SPARSE_PROFILE,
          sections: [
            { key: 'about', type: 'rich_text', title: 'Giới thiệu công ty', body_html: '<p> &nbsp; </p><script>alert(1)</script>' },
            { key: 'culture', type: 'rich_text', title: 'Văn hoá' },
            { key: 'gallery', type: 'gallery', title: 'Hình ảnh công ty', items: [] },
            { key: 'jobs', type: 'jobs', title: 'Việc làm đang tuyển' },
          ],
          sidebar: [
            { key: 'general_info', type: 'facts', title: 'Thông tin chung', items: [] },
            { key: 'offices', type: 'offices', title: 'Địa điểm' },
            { key: 'similar_companies', type: 'similar_companies', title: 'Công ty cùng lĩnh vực' },
          ],
        }}
        slots={{ similar_companies: false }}
      />,
    )

    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0)
  })

  it('shows the follower count in the hero only when the company has followers', () => {
    const withFollowers = { ...PROFILE, stats: { ...PROFILE.stats, follower_count: 1234 } }
    const { rerender } = render(<CompanyProfileView profile={withFollowers} />)
    expect(screen.getByText('1.234 người theo dõi')).toBeVisible()

    rerender(<CompanyProfileView profile={{ ...PROFILE, stats: { ...PROFILE.stats, follower_count: 0 } }} />)
    expect(screen.queryByText(/người theo dõi/)).not.toBeInTheDocument()

    rerender(<CompanyProfileView profile={PROFILE} />)
    expect(screen.queryByText(/người theo dõi/)).not.toBeInTheDocument()
  })

  it('places the consumer footer under the sidebar blocks', () => {
    render(<CompanyProfileView profile={PROFILE} sidebarFooter={<button type="button">Báo cáo thông tin sai</button>} />)

    const sidebar = screen.getByRole('complementary')
    expect(sidebar.lastElementChild).toBe(within(sidebar).getByRole('button', { name: 'Báo cáo thông tin sai' }))
  })

  it('renders an embedded preview without claiming the page h1 or sharing the host URL', () => {
    render(<CompanyProfileView profile={PROFILE} preview />)

    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'FPT Software' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Chia sẻ công ty' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sao chép đường dẫn' })).not.toBeInTheDocument()
  })
})
