import { expect, test } from '@playwright/test'
import { mockPublicApi } from './helpers'

const category = {
  public_id: 'kbc_account',
  name: 'Tài khoản và đăng nhập',
  slug: 'tai-khoan-va-dang-nhap',
  description: 'Đăng ký, đăng nhập và khôi phục tài khoản.',
  order: 1,
  article_count: 2,
}

const loginArticle = {
  public_id: 'kba_login',
  category,
  slug: 'dang-nhap-an-toan',
  article_type: 'FAQ',
  title: 'Làm thế nào để đăng nhập an toàn?',
  excerpt: 'Nhập email và mật khẩu của bạn.',
  order: 1,
  updated_at: '2026-08-05T08:00:00Z',
}

const resetArticle = {
  public_id: 'kba_reset',
  category,
  slug: 'dat-lai-mat-khau',
  article_type: 'GUIDE',
  title: 'Làm thế nào để đặt lại mật khẩu?',
  excerpt: 'Mở trang quên mật khẩu và kiểm tra email.',
  order: 2,
  updated_at: '2026-08-05T08:00:00Z',
}

const securityCategory = {
  public_id: 'kbc_security',
  name: 'Bảo mật và quyền riêng tư',
  slug: 'bao-mat-va-quyen-rieng',
  description: 'Bảo vệ dữ liệu và tài khoản.',
  order: 2,
  article_count: 1,
}

const privacyArticle = {
  public_id: 'kba_privacy',
  category: securityCategory,
  slug: 'bao-ve-du-lieu-ca-nhan',
  article_type: 'FAQ',
  title: 'Dữ liệu cá nhân được bảo vệ thế nào?',
  excerpt: 'Kiểm soát quyền riêng tư và phiên đăng nhập của bạn.',
  order: 1,
  updated_at: '2026-08-05T08:00:00Z',
}

test('public knowledgebase: simple browse, detail and hidden-content 404 stay responsive', async ({ page }) => {
  await mockPublicApi(page)
  await page.route(
    (url) => url.pathname === '/api/site/settings/',
    (route) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        brand_primary_color: '#7c3aed',
        knowledgebase_public_enabled: true,
        knowledgebase_search_index_enabled: true,
        seo_robots_index: true,
      }),
    }),
  )
  await page.route(
    (url) => url.pathname.startsWith('/api/knowledgebase/'),
    async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    if (path === '/api/knowledgebase/categories/') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([category, securityCategory]) })
      return
    }
    if (path === '/api/knowledgebase/articles/') {
      let items = [loginArticle, resetArticle, privacyArticle]
      const categoryFilter = url.searchParams.get('category')
      const query = url.searchParams.get('q')?.toLocaleLowerCase('vi-VN')
      if (categoryFilter) items = items.filter((item) => item.category.slug === categoryFilter)
      if (query) {
        items = items.filter((item) => `${item.title} ${item.excerpt}`.toLocaleLowerCase('vi-VN').includes(query))
      }
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ count: items.length, next: null, previous: null, results: items }),
      })
      return
    }
    if (path === '/api/knowledgebase/articles/tai-khoan-va-dang-nhap/dat-lai-mat-khau/') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ...resetArticle,
          body: '<h2>Các bước thực hiện</h2><p>Mở trang quên mật khẩu và nhập email.</p><img src="/favicon-32.png" alt="Minh họa đặt lại mật khẩu">',
          seo_title: 'Đặt lại mật khẩu',
          seo_description: 'Hướng dẫn đặt lại mật khẩu.',
          published_at: '2026-08-01T08:00:00Z',
          related_articles: [loginArticle],
          previous_article: loginArticle,
          next_article: loginArticle,
        }),
      })
      return
    }
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Not found.' }),
    })
    },
  )

  await page.goto('/tro-giup')
  await expect(page.getByRole('heading', { level: 1, name: 'Câu hỏi thường gặp' })).toBeVisible()
  await expect(page.locator('.knowledge-sidebar__eyebrow').first()).toHaveCSS('color', 'rgb(124, 58, 237)')
  await expect(page.getByRole('link', { name: /Làm thế nào để đăng nhập an toàn/ })).toBeVisible()
  const questionFilter = page.getByRole('searchbox', { name: 'Tìm kiếm trong tất cả chuyên mục' })
  await expect(questionFilter).toBeVisible()
  await questionFilter.focus()
  await expect(questionFilter).toHaveCSS('outline-style', 'none')
  await questionFilter.fill('Dữ liệu cá nhân')
  await expect(page).toHaveURL('/tro-giup')
  await expect(page.getByRole('status')).toHaveText('Tìm thấy 1 kết quả cho “Dữ liệu cá nhân”')
  await expect(page.getByRole('link', { name: /Dữ liệu cá nhân được bảo vệ/ })).toBeVisible()
  await expect(page.locator('.knowledge-question mark')).toHaveText('Dữ liệu cá nhân')
  await expect(page.locator('.knowledge-question__category')).toHaveText(securityCategory.name)
  await expect(page.getByText(privacyArticle.excerpt)).toBeVisible()
  await expect(page.locator('.knowledge-question__excerpt')).toHaveCSS('text-overflow', 'ellipsis')
  await expect(page.locator('.knowledge-question__excerpt')).toHaveCSS('white-space', 'nowrap')
  const [categoryBox, titleBox] = await Promise.all([
    page.locator('.knowledge-question__category').boundingBox(),
    page.locator('.knowledge-question__title').boundingBox(),
  ])
  expect(categoryBox.y + categoryBox.height).toBeLessThanOrEqual(titleBox.y)
  await expect(page.getByRole('link', { name: /đăng nhập an toàn/ })).toHaveCount(0)
  await questionFilter.clear()
  await expect(page.getByText('Tất cả chủ đề')).toHaveCount(0)
  await expect(page.locator('h1')).toHaveCount(1)
  const questionItems = page.locator('.knowledge-question-list').first().locator('li')
  await expect(questionItems).toHaveCount(2)
  await expect(page.locator('.knowledge-question-list').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(questionItems.first().getByRole('link')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  const [firstQuestionBox, secondQuestionBox, questionListBox] = await Promise.all([
    questionItems.nth(0).boundingBox(),
    questionItems.nth(1).boundingBox(),
    page.locator('.knowledge-question-list').first().boundingBox(),
  ])
  expect(secondQuestionBox.y - (firstQuestionBox.y + firstQuestionBox.height)).toBeGreaterThanOrEqual(8)
  expect(firstQuestionBox.x - questionListBox.x).toBeGreaterThanOrEqual(11)

  const sidebarBefore = await page.getByRole('complementary', { name: 'Chuyên mục trợ giúp' }).boundingBox()

  await page.getByRole('link', { name: /Làm thế nào để đặt lại mật khẩu/ }).first().click()
  await expect(page).toHaveURL('/tro-giup/tai-khoan-va-dang-nhap/dat-lai-mat-khau')
  await expect(page.getByRole('heading', { level: 1, name: resetArticle.title })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Các bước thực hiện' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Minh họa đặt lại mật khẩu' })).toBeVisible()
  await expect(page.getByText(/Cập nhật/)).toContainText(/\d{2}:\d{2}/)
  await expect(page.getByText('Câu hỏi tiếp')).toBeVisible()
  await expect(page.locator('h1')).toHaveCount(1)

  if ((page.viewportSize()?.width || 0) > 760) {
    const sidebarAfter = await page.getByRole('complementary', { name: 'Chuyên mục trợ giúp' }).boundingBox()
    expect(Math.abs(sidebarAfter.x - sidebarBefore.x)).toBeLessThan(1)
    expect(Math.abs(sidebarAfter.width - sidebarBefore.width)).toBeLessThan(1)
  }

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(hasHorizontalOverflow).toBe(false)

  await page.goto('/tro-giup/tai-khoan-va-dang-nhap/noi-dung-an')
  await expect(page.getByText('Không tìm thấy nội dung trợ giúp')).toBeVisible()
})
