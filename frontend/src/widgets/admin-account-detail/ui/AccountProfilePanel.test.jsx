import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AccountProfilePanel from './AccountProfilePanel'

const { getAdminAccountProfile } = vi.hoisted(() => ({
  getAdminAccountProfile: vi.fn(),
}))

vi.mock('@/entities/admin-account', async (importOriginal) => ({
  ...(await importOriginal()),
  getAdminAccountProfile,
}))

const PROFILE = {
  employer: {
    company_role: 'owner',
    gender: 'male',
    contact_phone: '***8150',
    company: {
      public_id: 'co_1',
      slug: 'fpt-software',
      legal_name: 'FPT Software',
      trade_name: 'FPT Software',
      trade_name_same_as_registered: true,
      business_type: 'enterprise',
      company_size: '500-1000',
      primary_industry: 'Agency (Design/Development)',
      logo_url: 'http://localhost:8000/media/employers/fpt/logo.png',
      cover_image_url: 'http://localhost:8000/media/employers/fpt/cover.png',
      has_no_logo: false,
      website_url: 'https://fpt.example/cong-ty',
      has_no_website: false,
      markets: ['domestic', 'asia'],
      target_customers: ['b2b'],
      has_brand_page: true,
      industries: [{ name: 'Agency (Design/Development)' }],
      description: '<p><strong>Tập đoàn SMBC</strong></p><script>alert(1)</script>',
      employee_benefits: '',
      created_by_email: 'founder@fpt.example',
      created_by_public_id: 'usr_founder',
      created_at: '2026-07-01T08:00:00Z',
      updated_at: '2026-07-27T00:00:00Z',
      images: [
        {
          id: 1,
          image_url: 'http://localhost:8000/media/employers/fpt/office.png',
          caption: 'Văn phòng Đà Nẵng',
        },
      ],
    },
  },
}

function renderPanel(section = 'profile') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <App>
      <QueryClientProvider client={queryClient}>
        <AccountProfilePanel
          publicId="usr_1"
          account={{ role: 'employer' }}
          canReveal
          section={section}
        />
      </QueryClientProvider>
    </App>,
  )
}

describe('AccountProfilePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAdminAccountProfile.mockResolvedValue(PROFILE)
  })

  it('renders recruiter enums in Vietnamese and keeps the company card out', async () => {
    renderPanel('profile')

    await waitFor(() => expect(screen.getByText('Người tạo công ty')).toBeInTheDocument())
    expect(screen.getByText('Nam')).toBeInTheDocument()
    expect(screen.queryByText('Thông tin công ty')).not.toBeInTheDocument()
  })

  it('renders only the company card in the company section', async () => {
    renderPanel('company')

    await waitFor(() => expect(screen.getByText('Thông tin công ty')).toBeInTheDocument())
    expect(screen.queryByText('Hồ sơ nhà tuyển dụng')).not.toBeInTheDocument()
    expect(screen.getByText('Doanh nghiệp')).toBeInTheDocument()
    expect(screen.getByText('500 - 1000 nhân viên')).toBeInTheDocument()
    // Mảng từng bị lọc bỏ vì `typeof value === 'object'`.
    expect(screen.getByText('Nội địa, Châu Á')).toBeInTheDocument()
    expect(screen.getByText('B2B')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Logo FPT Software' })).toHaveAttribute('src', PROFILE.employer.company.logo_url)
    expect(screen.getByRole('img', { name: 'Ảnh bìa FPT Software' })).toHaveAttribute('src', PROFILE.employer.company.cover_image_url)
    expect(screen.getByRole('img', { name: 'Văn phòng Đà Nẵng' })).toHaveAttribute('src', PROFILE.employer.company.images[0].image_url)
    expect(screen.getByText('founder@fpt.example')).toBeInTheDocument()
  })

  it('renders company rich text as sanitized markup instead of raw tags', async () => {
    const { container } = renderPanel('company')

    await waitFor(() => expect(screen.getByText('Thông tin công ty')).toBeInTheDocument())
    const body = container.querySelector('.account-profile__richtext-body')
    expect(body.querySelector('strong')).toHaveTextContent('Tập đoàn SMBC')
    expect(body.querySelector('script')).toBeNull()
    expect(body.textContent).not.toContain('<p>')
  })

  it('hides the rejection reason unless the company was rejected', async () => {
    renderPanel('company')

    await waitFor(() => expect(screen.getByText('Thông tin công ty')).toBeInTheDocument())
    expect(screen.queryByText('Lý do từ chối')).not.toBeInTheDocument()
  })
})
