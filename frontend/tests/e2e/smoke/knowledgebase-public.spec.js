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

test('public knowledgebase: browse, search, detail and hidden-content 404 stay responsive', async ({ page }) => {
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
      const query = url.searchParams.get('q')
      const items = query ? [resetArticle] : [loginArticle, resetArticle]
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
          body: '<h2>Các bước thực hiện</h2><p>Mở trang quên mật khẩu và nhập email.</p>',
          seo_title: 'Đặt lại mật khẩu',
          seo_description: 'Hướng dẫn đặt lại mật khẩu.',
          published_at: '2026-08-01T08:00:00Z',
          related_articles: [loginArticle],
          previous_article: loginArticle,
          next_article: null,
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
  await expect(page.getByRole('heading', { level: 1, name: 'Chúng tôi có thể giúp gì cho bạn?' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Làm thế nào để đăng nhập an toàn/ })).toBeVisible()
  await expect(page.locator('h1')).toHaveCount(1)

  const search = page.getByRole('searchbox', { name: 'Tìm trong trung tâm trợ giúp' })
  await search.fill('mat khau')
  await expect(page).toHaveURL(/q=mat.*khau/)
  await expect(page.getByRole('link', { name: /Làm thế nào để đặt lại mật khẩu/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Làm thế nào để đăng nhập an toàn/ })).toHaveCount(0)

  await page.getByRole('link', { name: /Làm thế nào để đặt lại mật khẩu/ }).first().click()
  await expect(page).toHaveURL('/tro-giup/tai-khoan-va-dang-nhap/dat-lai-mat-khau')
  await expect(page.getByRole('heading', { level: 1, name: resetArticle.title })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Các bước thực hiện' })).toBeVisible()
  await expect(page.locator('h1')).toHaveCount(1)

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(hasHorizontalOverflow).toBe(false)

  await page.goto('/tro-giup/tai-khoan-va-dang-nhap/noi-dung-an')
  await expect(page.getByText('Không tìm thấy nội dung trợ giúp')).toBeVisible()
})
