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
    name: 'Xem việc làm tại Công ty nổi bật lượt 1-4',
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
    name: 'Xem việc làm tại Công ty nổi bật lượt 1-1',
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
    name: 'Xem việc làm tại Kết quả Beta 1',
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

test('public smoke: featured companies keep platform stats, company search and the logo marquee', async ({ page }) => {
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
  await expect.poll(() => {
    const url = new URL(page.url())
    return {
      pathname: url.pathname,
      search: url.searchParams.get('search'),
      searchBy: url.searchParams.get('search_by'),
    }
  }).toEqual({
    pathname: '/viec-lam',
    search: 'Công ty Alpha & Đối tác',
    searchBy: 'company',
  })
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
  let speechRequests = 0
  await page.route('http://localhost:8000/api/site/settings/', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ speech_chatbot_enabled: true }),
  }))
  await page.route('http://localhost:8000/api/speech/sessions/', (route) => {
    speechRequests += 1
    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'speech_unavailable', detail: 'Speech unavailable.' }),
    })
  })
  await page.goto('/')

  const launcher = page.getByRole('button', { name: 'Mở trợ lý ProCV' })
  await expect(launcher).toBeVisible()
  await launcher.click()

  const panel = page.getByRole('dialog', { name: 'Trợ lý ProCV' })
  await expect(panel).toBeVisible()
  await expect(panel.getByText('Trợ lý đang trong giai đoạn thử nghiệm, câu trả lời là mẫu có sẵn.')).toBeVisible()
  expect(speechRequests).toBe(0)
  await panel.getByRole('button', { name: 'Nghe tin nhắn' }).first().click()
  await expect.poll(() => speechRequests).toBe(1)
  await expect(panel.getByText(/Chào bạn/)).toBeVisible()

  await panel.getByRole('textbox', { name: 'Nhập câu hỏi cho trợ lý' }).fill('Làm sao để tạo CV đẹp?')
  await panel.getByRole('button', { name: 'Gửi câu hỏi' }).click()
  await expect(panel.getByRole('status', { name: 'Trợ lý đang trả lời' })).toBeVisible()
  const progressiveReplies = panel.locator('.assistant-message__bubble--bot [aria-hidden="true"]')
  await expect(progressiveReplies).toHaveCount(1)
  const progressiveReply = progressiveReplies.last()
  await expect(progressiveReply).toBeVisible()
  await expect(progressiveReply.locator('.assistant-message__caret')).toBeVisible()
  // TTS chỉ được gọi từ click phía trên; chữ vẫn tự đánh máy đến hết khi lỗi.
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
        ? { ...card, preview_url: '', renderer: { key: 'classic_single_column_v1', version: '1', schema_version: 1, capabilities: {} }, sections: [] }
        : path === '/api/v2/cv-templates/modern/related/'
          ? []
          : path === '/api/v2/cv-position-options/'
            ? [
                { public_id: 'jobcat_customer_service', name_vi: 'Nhân viên CSKH' },
                { public_id: 'jobcat_frontend', name_vi: 'Frontend Developer' },
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
                        : 'Nhân viên CSKH',
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
                  renderer: { key: 'classic_single_column_v1', version: '1', schema_version: 1, capabilities: {} },
                  revision: `revision-${locale}`,
                }
                })()
          : path === '/api/v2/cv-categories/' || path === '/api/v2/cv-sample-contents/'
            ? []
            : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

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
  await expect(page.getByRole('heading', { name: 'Modern' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tạo CV', exact: true })).toBeVisible()
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
          template_renderer_key: 'classic_single_column_v1',
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
  await expect(page.getByLabel('Xem trước CV classic_single_column_v1 trang 1')).toBeVisible()
})
