import { expect, test } from '@playwright/test'
import { mockPublicApi } from './helpers'

test('public smoke: home and jobs routes load', async ({ page }, testInfo) => {
  await mockPublicApi(page)
  let currentUserRequestCount = 0
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/auth/me/') {
      currentUserRequestCount += 1
    }
  })
  const sessionProbeResponse = page.waitForResponse((response) => (
    new URL(response.url()).pathname === '/api/auth/refresh/'
    && response.request().headers()['x-session-probe'] === '1'
  ))
  await page.goto('/')
  const sessionProbe = await sessionProbeResponse
  expect(sessionProbe.status()).toBe(204)
  expect(currentUserRequestCount).toBe(0)
  await expect(page.locator('body')).not.toBeEmpty()

  const heroMascot = page.locator('.home-hero-mascot')
  if (testInfo.project.name === 'desktop-chromium') {
    await expect(heroMascot).toBeVisible()
    await expect(heroMascot).toHaveCSS('animation-name', 'homeHeroMascotPatrol')
    expect(await page.locator('#section-header').evaluate((section) => ({
      before: {
        delay: getComputedStyle(section, '::before').animationDelay,
        duration: getComputedStyle(section, '::before').animationDuration,
        name: getComputedStyle(section, '::before').animationName,
      },
      after: {
        delay: getComputedStyle(section, '::after').animationDelay,
        duration: getComputedStyle(section, '::after').animationDuration,
        name: getComputedStyle(section, '::after').animationName,
      },
    }))).toEqual({
      before: { delay: '0s', duration: '12s', name: 'homeHeaderGlowFromLeft' },
      after: { delay: '0s', duration: '12s', name: 'homeHeaderGlowFromRight' },
    })
    const [mascotBox, searchBox] = await Promise.all([
      heroMascot.boundingBox(),
      page.locator('.home-search-stage').boundingBox(),
    ])
    expect(mascotBox.y + mascotBox.height).toBeLessThanOrEqual(searchBox.y + 16)
    await expect(page.locator('.home-search-stage')).toHaveCSS('margin-top', '28px')
  } else {
    await expect(heroMascot).toBeHidden()
  }

  await page.goto('/viec-lam')
  await expect(page.getByRole('heading', { name: /Tuyển dụng/ })).toBeVisible()
})

test('public smoke: company directory separates finite featured results from compact infinite search', async ({ page }, testInfo) => {
  await mockPublicApi(page)
  let featuredRequests = 0
  let searchRequests = 0
  const coverDataUri = `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 480">
      <rect width="1024" height="480" fill="#d1fae5" />
      <circle cx="820" cy="120" r="96" fill="#10b981" />
    </svg>
  `)}`
  const company = (publicId, companyName, overrides = {}) => ({
    public_id: publicId,
    slug: publicId,
    company_name: companyName,
    trade_name: '',
    logo_url: '',
    cover_image_url: coverDataUri,
    description_excerpt: 'Môi trường làm việc chuyên nghiệp và nhiều cơ hội phát triển.',
    headquarters: 'Hà Nội',
    active_public_job_count: 5,
    company_size: '100-499',
    company_size_display: '100 - 499 nhân viên',
    industries_detail: [{ id: 1, slug: 'cong-nghe', name: 'Công nghệ' }],
    ...overrides,
  })

  await page.route(/\/api\/companies\/(?:\?.*)?$/, (route) => {
    const url = new URL(route.request().url())
    const query = url.searchParams.get('q')
    if (!query) {
      featuredRequests += 1
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          next: null,
          previous: null,
          results: Array.from(
            { length: 6 },
            (_, index) => company(
              `featured_${featuredRequests}_${index + 1}`,
              `Công ty nổi bật lượt ${featuredRequests}-${index + 1}`,
            ),
          ),
        }),
      })
    }
    searchRequests += 1
    if (query === 'KhongCo') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          count: 0,
          next: null,
          previous: null,
          results: [],
        }),
      })
    }
    if (url.searchParams.get('cursor') === 'page-two') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          count: 19,
          next: null,
          previous: 'http://localhost:8000/api/companies/?q=Beta',
          results: [company('search_page_two', 'Công ty ở trang tìm kiếm thứ hai')],
        }),
      })
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        count: 19,
        next: 'http://localhost:8000/api/companies/?q=Beta&cursor=page-two',
        previous: null,
        results: Array.from(
          { length: 18 },
          (_, index) => company(
            `search_${index + 1}`,
            `Kết quả Beta ${index + 1}`,
            index === 0 ? { headquarters: '' } : {},
          ),
        ),
      }),
    })
  })

  await page.goto('/cong-ty')

  await expect(page.getByRole('heading', { name: 'Khám phá công ty phù hợp với bạn' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Danh sách các công ty nổi bật' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Công ty nổi bật lượt 1-1', exact: true })).toBeVisible()
  expect(featuredRequests).toBe(1)
  expect(searchRequests).toBe(0)
  await expect(page.getByRole('button', { name: 'Tải thêm công ty' })).toHaveCount(0)
  await expect(page.getByText('Bạn đã xem hết kết quả tìm kiếm.')).toHaveCount(0)

  const lazyFeaturedCard = page.getByRole('link', {
    name: 'Xem trang công ty Công ty nổi bật lượt 1-4',
    exact: true,
  })
  const lazyCover = lazyFeaturedCard.locator('.company-directory-cover > img')
  await expect(lazyFeaturedCard.locator('.company-directory-cover')).toHaveCSS('aspect-ratio', '32 / 15')
  await expect(lazyCover).toHaveAttribute('width', '1024')
  await expect(lazyCover).toHaveAttribute('height', '480')
  await expect(lazyCover).toHaveAttribute('loading', 'lazy')
  await expect(lazyCover).toHaveAttribute('decoding', 'async')

  const search = page.getByRole('searchbox', { name: 'Tên công ty' })
  await search.fill('Beta')
  await page.getByRole('button', { name: 'Tìm kiếm' }).click()
  await expect(page).toHaveURL(/\/cong-ty\/tim-kiem\?keyword=Beta$/)
  const searchHeroHeading = page.getByRole('heading', { name: /Tìm kiếm thông tin công ty/ })
  await expect(searchHeroHeading).toBeVisible()
  await expect(page.getByRole('heading', {
    name: 'Tìm thấy 19 công ty phù hợp với yêu cầu của bạn',
  })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Kết quả Beta 1', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Nhà tuyển dụng hàng đầu' })).toBeVisible()
  await expect(page.getByRole('link', {
    name: 'Xem trang công ty Công ty nổi bật lượt 1-1',
    exact: true,
  })).toBeVisible()
  expect(featuredRequests).toBe(1)
  await expect(page.getByTestId('company-directory-hero-visual')).toHaveCount(0)
  const searchHeroImage = page.getByRole('img', {
    name: 'Minh họa kết nối ứng viên với cơ hội việc làm',
  })
  if (testInfo.project.name === 'mobile-chromium') {
    await expect(searchHeroImage).toBeHidden()
    await expect(searchHeroHeading).toHaveCSS('font-size', '18px')
  } else {
    await expect(searchHeroImage).toBeVisible()
    expect((await searchHeroImage.boundingBox()).height).toBeLessThanOrEqual(176)
    await expect(searchHeroHeading).toHaveCSS(
      'font-size',
      testInfo.project.name === 'desktop-chromium' ? '24px' : '20px',
    )
  }
  await expect(page.getByTestId('company-search-results')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)',
  )
  const firstSearchCard = page.getByRole('link', {
    name: 'Xem trang công ty Kết quả Beta 1',
    exact: true,
  })
  await expect(firstSearchCard.getByText('Đang tuyển 5 vị trí')).toBeVisible()
  await expect(firstSearchCard.getByText('Hà Nội')).toHaveCount(0)
  await expect(firstSearchCard.locator('.company-directory-cover')).toHaveCount(0)
  await expect(firstSearchCard.locator('img')).toHaveCount(0)

  const [searchResultsBox, firstSearchCardBox, sidebarBox] = await Promise.all([
    page.getByTestId('company-search-results').boundingBox(),
    firstSearchCard.boundingBox(),
    page.getByTestId('top-employers-sidebar').boundingBox(),
  ])
  if (testInfo.project.name === 'desktop-chromium') {
    expect(searchResultsBox.width).toBeGreaterThan(650)
    expect(sidebarBox.width).toBeGreaterThanOrEqual(350)
    expect(sidebarBox.width).toBeLessThanOrEqual(420)
    expect(sidebarBox.x).toBeGreaterThan(firstSearchCardBox.x + firstSearchCardBox.width)
  } else {
    expect(sidebarBox.y).toBeGreaterThan(firstSearchCardBox.y + firstSearchCardBox.height)
  }

  await page.getByRole('heading', { name: 'Kết quả Beta 18', exact: true }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('heading', { name: 'Công ty ở trang tìm kiếm thứ hai' })).toBeVisible()
  expect(searchRequests).toBe(2)
  await expect(page.getByText('Bạn đã xem hết kết quả tìm kiếm.')).toBeVisible()

  await search.fill('KhongCo')
  await page.getByRole('button', { name: 'Tìm kiếm' }).click()
  await expect(page).toHaveURL(/\/cong-ty\/tim-kiem\?keyword=KhongCo$/)
  await expect(page.getByTestId('company-search-results')).toHaveCount(0)
  await expect(page.getByTestId('top-employers-sidebar')).toHaveCount(0)
  await expect(page.getByTestId('company-search-status')).toHaveClass(/\bsr-only\b/)
  await expect(page.getByTestId('company-search-status')).toHaveText(
    'Không tìm thấy công ty phù hợp với yêu cầu của bạn.',
  )
  expect(searchRequests).toBe(3)

  await search.fill('')
  await page.getByRole('button', { name: 'Tìm kiếm' }).click()
  await expect(page).toHaveURL(/\/cong-ty\/tim-kiem$/)
  await expect(page.getByRole('heading', { name: /Tìm kiếm thông tin công ty/ })).toBeVisible()
  await expect(page.getByTestId('company-search-results')).toHaveCount(0)
  await expect(page.getByTestId('top-employers-sidebar')).toHaveCount(0)
  expect(featuredRequests).toBe(1)
  expect(searchRequests).toBe(3)

  await page.goto('/cong-ty')
  await expect(page.getByRole('heading', { name: 'Công ty nổi bật lượt 2-1', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Công ty nổi bật lượt 1-1', exact: true })).toHaveCount(0)
  expect(featuredRequests).toBe(2)

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Công ty nổi bật lượt 3-1', exact: true })).toBeVisible()
  expect(featuredRequests).toBe(3)

  expect(await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )).toBe(false)
})

test('public smoke: featured companies keep platform stats, the company page link and the logo marquee', async ({ page }) => {
  await mockPublicApi(page)
  const logoDataUri = `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
      <rect width="40" height="40" rx="8" fill="#f97316" />
      <circle cx="20" cy="20" r="10" fill="#ffffff" />
    </svg>
  `)}`
  const featuredCompanies = Array.from({ length: 7 }, (_, index) => ({
    public_id: `company_${index + 1}`,
    company_name: index === 0 ? 'Công ty Alpha & Đối tác' : `Công ty mẫu ${index + 1}`,
    slug: `cong-ty-mau-${index + 1}`,
    logo_url: logoDataUri,
    cover_image_url: logoDataUri,
    industries_detail: [{ id: 1, name: 'Công nghệ', slug: 'cong-nghe' }],
    active_public_job_count: index === 0 ? 12 : index + 1,
  }))
  await page.route(/\/api\/companies\/(?:\?.*)?$/, (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      next: null,
      previous: null,
      results: featuredCompanies,
    }),
  }))
  await page.route(/\/api\/jobs\/stats\/(?:\?.*)?$/, (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      candidates: 690_167,
      employers: 67_740,
      active_jobs: 90_224,
      new_jobs_24h: 19,
      growth: [],
      demand: [],
      salary_demand: [],
      latest_jobs: [],
      featured_employers: [],
    }),
  }))

  await page.goto('/')

  const featuredBlock = page.getByTestId('featured-employers-block')
  await expect(featuredBlock.getByRole('heading', { name: 'Website của chúng tôi có' })).toBeVisible()
  await expect(featuredBlock.getByText('Ứng viên', { exact: true })).toBeVisible()
  await expect(featuredBlock.getByText('Việc làm', { exact: true })).toBeVisible()
  await expect(featuredBlock.getByText('Nhà tuyển dụng', { exact: true })).toBeVisible()
  await expect(featuredBlock.getByText('690.167', { exact: true })).toBeVisible()
  await expect(featuredBlock.getByText('90.224', { exact: true })).toBeVisible()
  await expect(featuredBlock.getByText('67.740', { exact: true })).toBeVisible()
  await expect(featuredBlock.getByRole('heading', { name: 'Công ty nổi bật' })).toBeVisible()

  const firstCompanyCard = featuredBlock.locator('.featured-employer-card').filter({ hasText: 'Công ty Alpha & Đối tác' })
  await expect(firstCompanyCard).toBeVisible()
  await expect(firstCompanyCard.getByText('12 Việc làm', { exact: true })).toBeVisible()
  await expect(featuredBlock.locator('.employer-logo-full-bleed-marquee')).toHaveCSS(
    'animation-name',
    'employerLogoFullBleedMarquee',
  )

  expect(await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )).toBe(false)

  await firstCompanyCard.click()
  await expect(page).toHaveURL(/\/cong-ty\/cong-ty-mau-1$/)
})

const COMPANY_PAGE_IMAGE = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1152 288">
    <rect width="1152" height="288" fill="#dbeafe" />
    <circle cx="920" cy="96" r="120" fill="#60a5fa" />
  </svg>
`)}`

function companyPageProfile(overrides = {}) {
  return {
    public_id: 'co_ab12',
    slug: 'fpt-software',
    canonical_path: '/cong-ty/fpt-software',
    indexable: true,
    identity: {
      display_name: 'FPT Software',
      legal_name: 'Công ty TNHH Phần mềm FPT',
      logo_url: '',
      cover_image_url: COMPANY_PAGE_IMAGE,
      website_url: 'https://fpt-software.example',
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
      { key: 'about', type: 'rich_text', title: 'Giới thiệu công ty', body_html: '<p>FPT Software cung cấp dịch vụ phần mềm cho khách hàng toàn cầu.</p><ul><li>Hơn 30 quốc gia</li></ul>' },
      { key: 'jobs', type: 'jobs', title: 'Việc làm đang tuyển' },
      { key: 'benefits', type: 'rich_text', title: 'Phúc lợi', body_html: '<ul><li>Bảo hiểm sức khoẻ toàn diện</li><li>Thưởng tháng 13</li></ul>' },
      { key: 'video', type: 'video', title: 'Video giới thiệu', embed_url: 'https://www.youtube-nocookie.com/embed/x' },
      {
        key: 'gallery',
        type: 'gallery',
        title: 'Hình ảnh công ty',
        items: [
          { image_url: COMPANY_PAGE_IMAGE, caption: 'Văn phòng Hà Nội' },
          { image_url: COMPANY_PAGE_IMAGE, caption: '' },
          { image_url: COMPANY_PAGE_IMAGE, caption: '' },
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
          { key: 'industries', label: 'Lĩnh vực', value: 'Công nghệ thông tin, Fintech' },
          { key: 'founded_year', label: 'Năm thành lập', value: '2010' },
          { key: 'website', label: 'Website', value: 'fpt-software.example', href: 'https://fpt-software.example' },
        ],
      },
      { key: 'offices', type: 'offices', title: 'Địa điểm', items: [{ label: 'Trụ sở chính', address: '17 Duy Tân, Cầu Giấy, Hà Nội' }] },
      { key: 'share', type: 'share', title: 'Chia sẻ công ty' },
      { key: 'similar_companies', type: 'similar_companies', title: 'Công ty cùng lĩnh vực' },
    ],
    ...overrides,
  }
}

// Mock đúng contract CP-1: chi tiết theo slug, similar/job-facets theo public_id,
// tin lọc bằng `company=<public_id>`. Trả về danh sách query của request việc làm.
async function mockCompanyPage(page, { profile = companyPageProfile(), jobCount = 12, similar = [] } = {}) {
  const jobRequests = []
  const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
  await page.route(/\/api\/companies\/[^/?]+\/(?:\?.*)?$/, (route) => route.fulfill(
    profile ? json(profile) : json({ detail: 'Không tìm thấy.' }, 404),
  ))
  await page.route(/\/api\/companies\/[^/?]+\/similar\/(?:\?.*)?$/, (route) => route.fulfill(json({ results: similar })))
  await page.route(/\/api\/companies\/[^/?]+\/job-facets\/(?:\?.*)?$/, (route) => route.fulfill(json({
    locations: [{ id: 1, name: 'Hà Nội', count: 7 }, { id: 2, name: 'Đà Nẵng', count: 5 }],
  })))
  await page.route(/\/api\/jobs\/\?.*company=/, (route) => {
    const query = new URL(route.request().url()).searchParams
    jobRequests.push(Object.fromEntries(query))
    const total = query.get('search') === 'khong-co' ? 0 : jobCount
    const pageSize = Number(query.get('page_size')) || 10
    const offset = (Number(query.get('page') || 1) - 1) * pageSize
    return route.fulfill(json({
      count: total,
      results: Array.from({ length: Math.max(0, Math.min(pageSize, total - offset)) }, (_, index) => ({
        public_id: `job_${offset + index + 1}`,
        slug: `ky-su-phan-mem-${offset + index + 1}`,
        title: `Kỹ sư phần mềm cấp cao phụ trách nền tảng dữ liệu ${offset + index + 1}`,
        company_name: 'Công ty TNHH Phần mềm FPT',
        company_slug: 'fpt-software',
        salary_type: 'range',
        salary_min: 20_000_000,
        salary_max: 35_000_000,
        currency: 'VND',
        experience_years: '',
        locations_detail: [{ id: 1, name: 'Hà Nội' }, { id: 2, name: 'Đà Nẵng' }],
        published_at: new Date().toISOString(),
      })),
    }))
  })
  return jobRequests
}

async function expectNoHorizontalOverflow(page) {
  expect(await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )).toBe(false)
}

test('public smoke: company page renders from a direct URL with overview, jobs and similar companies', async ({ page }, testInfo) => {
  await mockPublicApi(page)
  // CP-6: phúc lợi dạng thẻ và video nhấp-để-tải; trình phát của nhà cung cấp được mock.
  await page.route(/^https:\/\/(?:i\.ytimg\.com|www\.youtube-nocookie\.com)\//, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>player</title>' }))
  const baseProfile = companyPageProfile()
  const jobRequests = await mockCompanyPage(page, {
    profile: companyPageProfile({
      sections: baseProfile.sections.map((section) => {
        if (section.key === 'benefits') {
          return {
            key: 'benefits',
            type: 'benefits',
            title: 'Phúc lợi',
            items: [
              { name: 'Bảo hiểm sức khoẻ', icon: '', category: 'welfare', note: 'Cho cả gia đình' },
              { name: 'Laptop làm việc', icon: '', category: 'equipment', note: '' },
            ],
            body_html: '<p>Thưởng tháng 13</p>',
          }
        }
        return section.key === 'video'
          ? { ...section, provider: 'youtube', video_id: 'dQw4w9WgXcQ', embed_url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' }
          : section
      }),
    }),
    similar: [{
      public_id: 'co_other',
      slug: 'cmc-global',
      company_name: 'Công ty TNHH CMC Global',
      trade_name: 'CMC Global',
      logo_url: '',
      active_public_job_count: 3,
    }],
  })

  await page.goto('/cong-ty/fpt-software')

  await expect(page.getByRole('heading', { level: 1, name: 'FPT Software' })).toBeVisible()
  await expect(page).toHaveTitle(/^FPT Software tuyển dụng/)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/cong-ty\/fpt-software$/)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow')
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /FPT Software cung cấp dịch vụ phần mềm/)
  expect(await page.locator('script[type="application/ld+json"]').textContent()).toContain('BreadcrumbList')

  const root = page.locator('.company-profile')
  expect(await root.evaluate((element) => element.style.getPropertyValue('--company-accent'))).toBe('#0b6bcb')
  await expect(page.getByRole('heading', { name: 'Giới thiệu công ty' })).toHaveCSS('border-left-color', 'rgb(11, 107, 203)')
  const benefits = page.getByRole('region', { name: 'Phúc lợi' })
  await expect(benefits.locator('.company-profile-benefit')).toHaveCount(2)
  await expect(benefits.getByText('Cho cả gia đình')).toBeVisible()
  await expect(benefits.getByText('Thưởng tháng 13')).toBeVisible()
  const video = page.getByRole('region', { name: 'Video giới thiệu' })
  await expect(video.locator('iframe')).toHaveCount(0)
  await video.getByRole('button', { name: 'Phát Video giới thiệu trên YouTube' }).click()
  await expect(video.locator('iframe[title="Video giới thiệu"]'))
    .toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1')

  const tabs = page.getByRole('navigation', { name: 'Nội dung trang công ty' })
  await expect(tabs.getByRole('link', { name: 'Tổng quan' })).toHaveAttribute('aria-current', 'page')

  const jobs = page.getByRole('region', { name: 'Việc làm đang tuyển' })
  await expect(jobs.getByRole('article')).toHaveCount(5)
  await expect(jobs.getByRole('article').first().getByText('20 - 35 triệu')).toBeVisible()
  await expect(jobs.getByText('Công ty TNHH Phần mềm FPT')).toHaveCount(0)
  expect(jobRequests).toEqual([{ company: 'co_ab12', page: '1', page_size: '10' }])

  await expect(page.getByRole('region', { name: 'Thông tin chung' }).getByRole('link', { name: 'fpt-software.example' }))
    .toHaveAttribute('href', 'https://fpt-software.example')
  await expect(page.getByRole('region', { name: 'Hình ảnh công ty' }).getByRole('img')).toHaveCount(3)
  await expect(page.getByRole('region', { name: 'Công ty cùng lĩnh vực' }).getByRole('link', { name: /CMC Global/ }))
    .toHaveAttribute('href', '/cong-ty/cmc-global')

  const mobileCta = page.getByRole('link', { name: 'Xem việc làm (12)' })
  if (testInfo.project.name === 'desktop-chromium') {
    await expect(mobileCta).toBeHidden()
    await expect(page.getByRole('link', { name: 'Xem việc làm', exact: true })).toBeVisible()
  } else {
    await expect(mobileCta).toBeVisible()
  }
  await expectNoHorizontalOverflow(page)

  await jobs.getByRole('link', { name: 'Xem tất cả việc làm' }).click()
  await expect(page).toHaveURL(/\/cong-ty\/fpt-software\?tab=viec-lam$/)
  await expect(tabs.getByRole('link', { name: 'Việc làm (12)' })).toHaveAttribute('aria-current', 'page')
  await expect(jobs.getByRole('article')).toHaveCount(10)
  await expect(mobileCta).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
})

test('public smoke: company page keeps the jobs tab, keyword and location in the URL', async ({ page }) => {
  await mockPublicApi(page)
  const jobRequests = await mockCompanyPage(page, { jobCount: 25 })

  await page.goto('/cong-ty/fpt-software?tab=viec-lam&q=react&location=1&page=2')

  const jobs = page.getByRole('region', { name: 'Việc làm đang tuyển' })
  await expect(jobs.getByRole('article')).toHaveCount(10)
  expect(jobRequests).toEqual([
    { company: 'co_ab12', page: '2', page_size: '10', search: 'react', location: '1' },
  ])
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/cong-ty\/fpt-software$/)
  await expect(jobs.getByRole('status')).toHaveText('Tìm thấy 25 việc làm phù hợp')
  await expect(page.getByRole('heading', { name: 'Giới thiệu công ty' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Thông tin chung' })).toBeVisible()

  const keyword = jobs.getByRole('searchbox', { name: 'Tên việc làm' })
  const location = jobs.getByRole('combobox', { name: 'Địa điểm' })
  await expect(keyword).toHaveValue('react')
  await expect(location).toHaveValue('1')
  await expectNoHorizontalOverflow(page)

  await location.selectOption({ label: 'Đà Nẵng (5)' })
  await expect(page).toHaveURL(/\?tab=viec-lam&q=react&location=2$/)
  await expect(jobs.getByRole('article')).toHaveCount(10)

  await keyword.fill('khong-co')
  await jobs.getByRole('button', { name: 'Tìm kiếm' }).click()
  await expect(page).toHaveURL(/\?tab=viec-lam&q=khong-co&location=2$/)
  await expect(jobs.getByText('Không có việc làm khớp bộ lọc.')).toBeVisible()

  await jobs.getByRole('link', { name: 'Xoá bộ lọc' }).click()
  await expect(page).toHaveURL(/\/cong-ty\/fpt-software\?tab=viec-lam$/)
  await expect(keyword).toHaveValue('')
  await expect(jobs.getByRole('article')).toHaveCount(10)

  await page.getByRole('navigation', { name: 'Nội dung trang công ty' }).getByRole('link', { name: 'Tổng quan' }).click()
  await expect(page).toHaveURL(/\/cong-ty\/fpt-software$/)
  await expect(page.getByRole('heading', { name: 'Giới thiệu công ty' })).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow')
})

test('public smoke: company page stays complete for a sparse company and shows a real 404 state', async ({ page }) => {
  await mockPublicApi(page)
  const sparse = companyPageProfile({
    slug: 'cua-hang-binh-minh',
    canonical_path: '/cong-ty/cua-hang-binh-minh',
    indexable: false,
    identity: {
      display_name: 'Cửa hàng Bình Minh',
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
  })
  await mockCompanyPage(page, { profile: sparse, jobCount: 0 })

  await page.goto('/cong-ty/cua-hang-binh-minh')

  await expect(page.getByRole('heading', { level: 1, name: 'Cửa hàng Bình Minh' })).toBeVisible()
  await expect(page.locator('.company-profile-cover--fallback')).toBeVisible()
  await expect(page.locator('.company-profile-cover img')).toHaveCount(0)
  await expect(page.locator('.company-profile-logo')).toHaveText('C')
  await expect(page.getByText('Công ty chưa có việc làm đang tuyển.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Thông tin chung' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Chia sẻ công ty' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Công ty cùng lĩnh vực' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Xem việc làm/ })).toHaveCount(0)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  await expectNoHorizontalOverflow(page)

  await page.unrouteAll({ behavior: 'ignoreErrors' })
  await mockPublicApi(page)
  await mockCompanyPage(page, { profile: null })
  await page.goto('/cong-ty/khong-ton-tai')

  await expect(page.getByText('Không tìm thấy công ty')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Xem danh sách công ty' })).toHaveAttribute('href', '/cong-ty')
  await expect(page).toHaveTitle(/^Không tìm thấy công ty/)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  await expectNoHorizontalOverflow(page)
})

// Phiên ứng viên đặt sau mockPublicApi: route đăng ký sau được ưu tiên.
async function mockCandidateSession(page) {
  await page.route(/\/api\/auth\/(?:refresh|me)\/$/, (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(route.request().url().endsWith('/refresh/')
      ? { access: 'e2e-access' }
      : {
          public_id: 'candidate_1',
          role: 'candidate',
          email: 'candidate@example.com',
          full_name: 'Nguyễn An',
          email_verified: true,
          job_preferences_configured: true,
        }),
  }))
}

test('public smoke: company page follow asks guests to sign in and toggles for a candidate', async ({ page }, testInfo) => {
  const followRequests = []
  let follow = { following: false, notify_new_jobs: false, follower_count: 12 }
  await mockPublicApi(page)
  await mockCompanyPage(page, {
    profile: companyPageProfile({ stats: { ...companyPageProfile().stats, follower_count: 12 } }),
  })
  await page.route(/\/api\/companies\/co_ab12\/follow\/$/, (route) => {
    const request = route.request()
    followRequests.push(`${request.method()} ${request.postData() || ''}`.trim())
    if (request.method() === 'PUT') {
      follow = {
        following: true,
        notify_new_jobs: request.postDataJSON().notify_new_jobs ?? (follow.following ? follow.notify_new_jobs : true),
        follower_count: follow.following ? follow.follower_count : follow.follower_count + 1,
      }
    }
    if (request.method() === 'DELETE') follow = { following: false, notify_new_jobs: false, follower_count: 12 }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(follow) })
  })

  await page.goto('/cong-ty/fpt-software')
  const hero = page.getByRole('region', { name: 'FPT Software' })
  await expect(hero.getByText('12 người theo dõi')).toBeVisible()
  // Hero (desktop) và thanh CTA dính đáy (màn hẹp) mỗi nơi một nút; chỉ một nút hiển thị.
  const followButton = page.getByRole('button', { name: 'Theo dõi', exact: true })
  await followButton.click()
  await expect(page.getByTestId('login-submit')).toBeVisible()
  expect(followRequests).toEqual([])

  await mockCandidateSession(page)
  await page.reload()
  await followButton.click()
  const following = page.getByRole('button', { name: 'Đang theo dõi' })
  await expect(following).toHaveAttribute('aria-pressed', 'true')
  await expect(hero.getByText('13 người theo dõi')).toBeVisible()

  const notify = page.getByRole('switch', { name: 'Nhận email việc làm mới' })
  await expect(notify).toBeChecked()
  await notify.click()
  await expect(notify).not.toBeChecked()
  await expect(notify).toBeEnabled()
  if (testInfo.project.name !== 'desktop-chromium') {
    const bar = await page.getByRole('link', { name: 'Xem việc làm (12)' }).boundingBox()
    expect(bar.x + bar.width).toBeLessThanOrEqual(page.viewportSize().width)
  }
  await expectNoHorizontalOverflow(page)

  await following.click()
  await expect(followButton).toHaveAttribute('aria-pressed', 'false')
  await expect(hero.getByText('12 người theo dõi')).toBeVisible()
  await expect(notify).toHaveCount(0)
  expect(followRequests).toEqual(['GET', 'PUT {}', 'PUT {"notify_new_jobs":false}', 'DELETE'])
})

test('public smoke: company page report submits a reason with its section and explains a duplicate', async ({ page }) => {
  const reportPayloads = []
  await mockPublicApi(page)
  await mockCandidateSession(page)
  await mockCompanyPage(page)
  await page.route(/\/api\/companies\/co_ab12\/reports\/$/, (route) => {
    reportPayloads.push(route.request().postDataJSON())
    return route.fulfill(reportPayloads.length === 1
      ? { status: 201, contentType: 'application/json', body: JSON.stringify({ public_id: 'crp_1', status: 'pending' }) }
      : {
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Bạn đã có một báo cáo đang chờ xử lý cho công ty này.' }),
        })
  })

  await page.goto('/cong-ty/fpt-software')
  const report = page.getByRole('button', { name: 'Báo cáo thông tin sai' })
  await report.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Báo cáo thông tin công ty' })).toBeVisible()
  await expect(dialog.getByText('FPT Software')).toBeVisible()

  await dialog.getByRole('button', { name: 'Gửi báo cáo' }).click()
  await expect(dialog.getByText('Chọn lý do báo cáo.')).toBeVisible()
  await dialog.getByRole('radio', { name: 'Mạo danh doanh nghiệp khác' }).check()
  await dialog.getByRole('combobox', { name: 'Phần thông tin liên quan' }).click()
  const sectionOptions = page.locator('.ant-select-item-option-content')
  await expect(sectionOptions.filter({ hasText: 'Chia sẻ công ty' })).toHaveCount(0)
  await sectionOptions.filter({ hasText: 'Thông tin chung' }).click()
  await dialog.getByRole('textbox', { name: 'Mô tả chi tiết' }).fill('Trang dùng tên và logo của doanh nghiệp khác.')
  await expectNoHorizontalOverflow(page)
  await dialog.getByRole('button', { name: 'Gửi báo cáo' }).click()

  await expect(dialog).toBeHidden()
  expect(reportPayloads).toEqual([{
    reason: 'impersonation',
    section_key: 'general_info',
    detail: 'Trang dùng tên và logo của doanh nghiệp khác.',
  }])

  await report.click()
  await dialog.getByRole('radio', { name: 'Dấu hiệu lừa đảo' }).check()
  await dialog.getByRole('button', { name: 'Gửi báo cáo' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Bạn đã có một báo cáo đang chờ xử lý cho công ty này.')
  await expect(dialog).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('public smoke: reapproval keeps the original posted date on job cards and detail', async ({ page }) => {
  await mockPublicApi(page)
  const latestApproval = new Date()
  const firstApproval = new Date(latestApproval.getTime() - 2 * 86_400_000)
  await page.route(/\/api\/jobs\/(?:\?.*)?$/, (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      count: 1,
      next: null,
      previous: null,
      results: [{
        public_id: 'job_reapproved',
        slug: 'backend-engineer-job-reapproved',
        title: 'Backend Engineer duyệt lại',
        company_name: 'ProCV',
        company_logo_url: '',
        company_verified: false,
        locations_detail: [],
        job_skills: [],
        tier: 'standard',
        first_approved_at: firstApproval.toISOString(),
        published_at: latestApproval.toISOString(),
      }],
    }),
  }))
  await page.route(/\/api\/jobs\/backend-engineer-job-reapproved\/$/, (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      public_id: 'job_reapproved',
      slug: 'backend-engineer-job-reapproved',
      title: 'Backend Engineer duyệt lại',
      company_name: 'ProCV',
      company_logo_url: '',
      company_verified: false,
      locations_detail: [],
      job_locations: [],
      work_schedules: [],
      language_requirements: [],
      application_reasons: [],
      salary_type: 'negotiable',
      currency: 'VND',
      view_count: 0,
      first_approved_at: firstApproval.toISOString(),
      published_at: latestApproval.toISOString(),
    }),
  }))

  await page.goto('/viec-lam')

  await expect(page.getByRole('link', { name: 'Backend Engineer duyệt lại' })).toBeVisible()
  await expect(page.getByText('Đăng 2 ngày trước')).toBeVisible()
  await expect(page.getByText('Đăng hôm nay')).toHaveCount(0)

  await page.goto('/viec-lam/backend-engineer-job-reapproved')

  await expect(page.getByRole('heading', { name: 'Backend Engineer duyệt lại' })).toBeVisible()
  await expect(page.getByText('Đăng 2 ngày trước')).toBeVisible()
  await expect(page.getByText('Đăng hôm nay')).toHaveCount(0)
})

test('public smoke: tablet header taps open top-level submenus', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'tablet-chromium')
  await mockPublicApi(page)
  await page.goto('/')

  const navigation = page.locator('header nav')
  await navigation.getByRole('button', { name: /Việc làm/ }).click()
  await expect(page.getByText('Việc làm theo vị trí', { exact: true })).toBeVisible()
  await expect(page).toHaveURL('/')

  await navigation.getByRole('button', { name: /Tạo CV/ }).click()
  await expect(page.getByText('Mẫu CV theo style', { exact: true })).toBeVisible()
  await expect(page).toHaveURL('/')
})

test('public smoke: tablet floating actions stay inside the visual viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'tablet-chromium')
  await page.addInitScript(() => {
    const viewport = new EventTarget()
    Object.assign(viewport, {
      height: 1112,
      offsetLeft: 0,
      offsetTop: 0,
      pageLeft: 0,
      pageTop: 0,
      scale: 1,
      width: 834,
    })
    viewport.setGeometry = (height, offsetTop) => {
      viewport.height = height
      viewport.offsetTop = offsetTop
      viewport.dispatchEvent(new Event('resize'))
    }
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: viewport,
    })
  })
  await mockPublicApi(page)
  await page.goto('/')

  const assistant = page.getByTestId('candidate-assistant')
  const support = page.getByTestId('floating-actions')
  const initialAssistantBottom = await assistant.evaluate((element) => Number.parseFloat(getComputedStyle(element).bottom))
  const initialSupportBottom = await support.evaluate((element) => Number.parseFloat(getComputedStyle(element).bottom))

  await page.evaluate(() => window.visualViewport.setGeometry(880, 24))
  await expect.poll(
    () => assistant.evaluate((element) => Number.parseFloat(getComputedStyle(element).bottom)),
  ).toBeGreaterThan(initialAssistantBottom + 200)
  await expect.poll(
    () => support.evaluate((element) => Number.parseFloat(getComputedStyle(element).bottom)),
  ).toBeGreaterThan(initialSupportBottom + 200)
})

test('public smoke: candidate assistant opens, replies and stays responsive', async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/')

  const launcher = page.getByRole('button', { name: 'Mở trợ lý ProCV' })
  await expect(launcher).toBeVisible()
  await launcher.click()

  const panel = page.getByRole('dialog', { name: 'Trợ lý ProCV' })
  await expect(panel).toBeVisible()
  await expect(panel.getByText('Trợ lý đang trong giai đoạn thử nghiệm, câu trả lời là mẫu có sẵn.')).toBeVisible()
  await expect(panel.getByText(/Chào bạn/)).toBeVisible()

  await panel.getByRole('textbox', { name: 'Nhập câu hỏi cho trợ lý' }).fill('Làm sao để tạo CV đẹp?')
  await panel.getByRole('button', { name: 'Gửi câu hỏi' }).click()
  await expect(panel.getByRole('status', { name: 'Trợ lý đang trả lời' })).toBeVisible()
  const progressiveReplies = panel.locator('.assistant-message__bubble--bot [aria-hidden="true"]')
  await expect(progressiveReplies).toHaveCount(1)
  const progressiveReply = progressiveReplies.last()
  await expect(progressiveReply).toBeVisible()
  await expect(progressiveReply.locator('.assistant-message__caret')).toBeVisible()
  await expect(progressiveReply).toHaveText(/Bạn có thể chọn mẫu CV/, { timeout: 8000 })
  await expect(progressiveReply.locator('.assistant-message__caret')).toBeHidden()

  // Response kế tiếp cũng phải khởi tạo typewriter mới, không kế thừa trạng
  // thái completed/error của câu đầu tiên.
  await panel.getByRole('textbox', { name: 'Nhập câu hỏi cho trợ lý' }).fill('Tôi muốn ứng tuyển')
  await panel.getByRole('button', { name: 'Gửi câu hỏi' }).click()
  await expect(progressiveReplies).toHaveCount(2)
  const secondReply = progressiveReplies.last()
  await expect(secondReply.locator('.assistant-message__caret')).toBeVisible()
  await expect(secondReply.locator('.assistant-message__caret')).toBeHidden({ timeout: 8000 })
  const messagesPinnedToBottom = await panel.locator('.assistant-panel__messages').evaluate(
    (element) => element.scrollHeight - element.scrollTop - element.clientHeight < 2,
  )
  expect(messagesPinnedToBottom).toBe(true)

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(hasHorizontalOverflow).toBe(false)
})

test('public smoke: CV template colors change preview and detail offers the create flow', async ({ page }) => {
  await mockPublicApi(page)
  const card = {
    public_id: 'tpl_modern',
    slug: 'modern',
    display_name: 'Modern',
    description: 'Bố cục hiện đại',
    thumbnail_url: '',
    is_premium: false,
    theme_color: '#00A66A',
    colors: [
      { public_id: 'green', slug: 'green', name: 'Xanh', hex_code: '#00A66A', preview_url: '/green.png', is_default: true },
      { public_id: 'blue', slug: 'blue', name: 'Xanh dương', hex_code: '#2255AA', preview_url: '/blue.png', is_default: false },
    ],
    categories: [{ public_id: 'cat_style', slug: 'modern', name: 'Hiện đại', type: 'style' }],
    tags: [{ public_id: 'cat_ats', slug: 'ats', name: 'Thân thiện ATS', type: 'feature' }],
  }
  await page.route('http://localhost:8000/api/v2/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const body = path === '/api/v2/cv-templates/'
      ? { count: 1, results: [card] }
      : path === '/api/v2/cv-templates/modern/'
        ? { ...card, preview_url: '', renderer: { key: 'single_column_v1', version: '1', schema_version: 1, capabilities: {} }, sections: [] }
        : path === '/api/v2/cv-templates/modern/related/'
          ? []
          : path === '/api/v2/cv-position-options/'
            ? [
                { public_id: 'jobcat_customer_service', slug: 'nhan-vien-cskh', name_vi: 'Nhân viên CSKH', display_name: 'Nhân viên CSKH' },
                { public_id: 'jobcat_frontend', slug: 'frontend-developer', name_vi: 'Frontend Developer', display_name: 'Frontend Developer' },
              ]
            : path === '/api/v2/cv-position-preview/'
              ? (() => {
                  const locale = url.searchParams.get('locale')
                  const content = {
                    schema_version: 1,
                    locale,
                    personal_info: {
                      full_name: '',
                      headline: locale === 'en-US'
                        ? 'Customer Service Representative'
                        : url.searchParams.get('position_public_id') === 'jobcat_frontend' ? 'Frontend Developer' : 'Nhân viên CSKH',
                      email: '', phone: '', address: '', avatar_asset_id: null, links: [],
                    },
                    sections: [],
                    custom_fields: {},
                  }
                  return {
                  position_public_id: url.searchParams.get('position_public_id'),
                  name_vi: 'Nhân viên CSKH',
                  locale,
                  source: 'blueprint',
                  content_json: content,
                  document: {
                    schema_version: 1,
                    content_json: content,
                    layout_json: {
                      schema_version: 1,
                      page: { size: 'A4', margin_mm: 12 },
                      regions: [{ id: 'main', width_percent: 100, section_instance_ids: [] }],
                    },
                    style_json: {
                      schema_version: 1, theme_color: '#00A66A', font_family: 'Roboto',
                      font_scale: 1, line_height: 1.4, background_asset_id: null, section_overrides: {},
                    },
                  },
                  renderer: { key: 'single_column_v1', version: '1', schema_version: 1, capabilities: {} },
                  revision: `revision-${locale}`,
                }
                })()
          : path === '/api/v2/cv-categories/' || path === '/api/v2/cv-sample-contents/'
            ? []
            : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  // Ảnh mẫu theo màu (ảnh lỗi sẽ được thay bằng khung minh họa).
  await page.route('**/*.png', (route) => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64') }))
  await page.goto('/mau-cv')
  await expect(page.getByRole('heading', { name: /Mẫu CV xin việc/ })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Xem trước Modern' })).toHaveAttribute('src', '/green.png')
  await page.getByRole('radio', { name: 'Xanh dương' }).hover()
  await expect(page.getByRole('img', { name: 'Xem trước Modern' })).toHaveAttribute('src', '/blue.png')
  const cardText = page.getByText('Modern', { exact: true })
  await cardText.hover()
  const useTemplateButton = page.getByRole('button', { name: 'Dùng mẫu' })
  // Nút nằm trong overlay có transition CSS (opacity/translate) khi hover;
  // đợi nó thực sự visible trước khi click để tránh click rơi giữa lúc
  // transition chưa ổn định (nguồn gốc flaky trước đây khi dùng force click).
  await expect(useTemplateButton).toBeVisible()
  await useTemplateButton.click()
  await expect(page.getByText('Mẫu CV Modern')).toBeVisible()
  await expect(page.getByText('Bạn muốn tạo CV từ?')).toBeVisible()
  await page.getByRole('button', { name: /Nội dung CV mẫu/ }).click()
  await expect(page.getByText('Nhân viên CSKH', { exact: true }).first()).toBeVisible()
  await page.getByRole('combobox').click()
  await page.getByRole('combobox').fill('Frontend')
  await expect(page.getByRole('option', { name: 'Frontend Developer' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Tiếng Anh' }).click()
  await expect(page.getByText('Customer Service Representative')).toBeVisible()

  await page.goto('/mau-cv/chi-tiet/modern')
  await expect(page.getByRole('heading', { level: 1, name: 'Mẫu CV Nhân viên CSKH tiếng Việt - Modern' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tạo CV', exact: true })).toBeVisible()
  await expect(page.locator('[data-cv-page="1"]')).toBeVisible()
  // Vị trí mặc định không ghi lên URL; chọn vị trí khác thì URL, H1, <title> đổi theo.
  await expect(page).toHaveURL(/\/mau-cv\/chi-tiet\/modern$/)
  const mobileSheet = page.getByRole('button', { name: /Nhân viên CSKH/ })
  if (await mobileSheet.isVisible()) await mobileSheet.click()
  const options = page.getByRole('dialog', { name: 'Bạn muốn tạo CV từ?' }).or(page.locator('aside'))
  await options.getByRole('combobox').click()
  await page.getByRole('option', { name: 'Frontend Developer' }).click()
  await expect(page).toHaveURL(/vi-tri=frontend-developer/)
  await expect(page.getByRole('heading', { level: 1, name: /Frontend Developer/ })).toBeVisible()
  await expect(page).toHaveTitle(/Mẫu CV Frontend Developer tiếng Việt - Modern/)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: /Frontend Developer/ })).toBeVisible()
  const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
  expect(noHorizontalScroll).toBe(true)
})

test('public smoke: a shared CV link renders its immutable version', async ({ page }) => {
  await mockPublicApi(page)
  await page.route('http://localhost:8000/api/v2/cvs/shares/share-token/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        cv: { title: 'CV được chia sẻ', language: 'vi-VN' },
        version: {
          public_id: 'cvv_shared', version_number: 1, schema_version: 1,
          template_renderer_key: 'single_column_v1',
          content_json: {
            personal_info: { full_name: 'Nguyễn Chia sẻ', headline: 'Designer', email: '', phone: '', address: '' },
            sections: [],
          },
          layout_json: { regions: [{ id: 'main', width_percent: 100, section_instance_ids: [] }] },
          style_json: { theme_color: '#00A66A', font_family: 'Roboto', font_scale: 1, line_height: 1.4 },
        },
      }),
    })
  })

  await page.goto('/cv/share/share-token')
  await expect(page.getByRole('heading', { name: 'CV được chia sẻ' })).toBeVisible()
  await expect(page.getByText('Nguyễn Chia sẻ')).toBeVisible()
  await expect(page.getByLabel('Xem trước CV single_column_v1 trang 1')).toBeVisible()
})
