import { expect, test } from '@playwright/test'
import { mockPublicApi } from './helpers'

const featuredPosts = [
  {
    public_id: 'post_media',
    slug: 'nganh-truyen-thong-la-gi',
    title: 'Ngành truyền thông là gì? Triển vọng nghề nghiệp và mức lương',
    excerpt: 'Tổng quan ngành truyền thông và những cơ hội nghề nghiệp nổi bật.',
    published_at: '2026-07-27T08:00:00Z',
    thumbnail_url: '',
    category: { name: 'Định hướng nghề nghiệp', slug: 'dinh-huong-nghe-nghiep' },
  },
  {
    public_id: 'post_sales',
    slug: 'nhan-vien-sales-la-gi',
    title: 'Nhân viên kinh doanh/Sales là gì? Từ A đến Z về nghề Sales',
    excerpt: 'Kiến thức cần thiết để bắt đầu và phát triển sự nghiệp Sales.',
    published_at: '2026-07-27T08:00:00Z',
    thumbnail_url: '',
    category: { name: 'Định hướng nghề nghiệp', slug: 'dinh-huong-nghe-nghiep' },
  },
]

test('candidate blog: two featured posts use a balanced sparse layout', async ({ page }) => {
  await mockPublicApi(page)
  await page.route('http://localhost:8000/api/blog/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const body = path === '/api/blog/home/'
      ? { featured: featuredPosts, sections: [] }
      : path === '/api/blog/categories/'
        ? [{ public_id: 'category_career', name: 'Định hướng nghề nghiệp', slug: 'dinh-huong-nghe-nghiep' }]
        : []

    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/blog')

  const featured = page.locator('[data-featured-layout="duo"]')
  await expect(featured).toBeVisible()
  const cards = featured.locator('article')
  await expect(cards).toHaveCount(2)

  const cardBoxes = await cards.evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect()
    return { height: rect.height, width: rect.width }
  }))
  expect(Math.abs(cardBoxes[0].height - cardBoxes[1].height)).toBeLessThanOrEqual(2)
  expect(cardBoxes.every(({ height, width }) => height >= 300 && width > 0)).toBe(true)

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(hasHorizontalOverflow).toBe(false)
})
