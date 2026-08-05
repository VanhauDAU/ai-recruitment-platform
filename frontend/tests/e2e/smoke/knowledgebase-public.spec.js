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

test('public knowledgebase: simple browse, detail and hidden-content 404 stay responsive', async ({ page }) => {
  await mockPublicApi(page)
  await page.route(
    (url) => url.pathname.startsWith('/api/knowledgebase/'),
    async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    if (path === '/api/knowledgebase/categories/') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([category]) })
      return
    }
    if (path === '/api/knowledgebase/articles/') {
      const items = [loginArticle, resetArticle]
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
  await expect(page.getByRole('link', { name: /Làm thế nào để đăng nhập an toàn/ })).toBeVisible()
  const questionFilter = page.getByRole('searchbox', { name: 'Tìm trong danh sách câu hỏi' })
  await expect(questionFilter).toBeVisible()
  await questionFilter.focus()
  await expect(questionFilter).toHaveCSS('outline-style', 'none')
  await questionFilter.fill('đặt lại')
  await expect(page.getByRole('link', { name: /đặt lại mật khẩu/ })).toBeVisible()
  await expect(page.locator('.knowledge-question mark')).toHaveText('đặt lại')
  await expect(page.getByText(resetArticle.excerpt)).toBeVisible()
  await expect(page.locator('.knowledge-question__excerpt')).toHaveCSS('text-overflow', 'ellipsis')
  await expect(page.locator('.knowledge-question__excerpt')).toHaveCSS('white-space', 'nowrap')
  await expect(page.getByRole('link', { name: /đăng nhập an toàn/ })).toHaveCount(0)
  await questionFilter.clear()
  await expect(page.getByText('Tất cả chủ đề')).toHaveCount(0)
  await expect(page.locator('h1')).toHaveCount(1)

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
