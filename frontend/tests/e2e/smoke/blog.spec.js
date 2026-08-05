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

test('candidate blog detail: compact speech launcher uses the microphone mascot', async ({ page }) => {
  await mockPublicApi(page)
  await page.route('http://localhost:8000/api/blog/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const body = path === '/api/blog/robot-doc-bai/'
      ? {
          public_id: 'post_robot_speech',
          slug: 'robot-doc-bai',
          title: 'Robot đọc bài viết cùng bạn',
          summary: 'Trải nghiệm nghe nội dung nghề nghiệp cùng ProCV.',
          content: '<h2>Chuẩn bị phỏng vấn</h2><p>Nội dung bài viết dùng cho smoke test.</p>',
          published_at: '2026-08-04T08:00:00Z',
          category: { name: 'Kỹ năng nghề nghiệp', slug: 'ky-nang-nghe-nghiep' },
          tags: [],
          speech_default: null,
          speech_assets: [],
        }
      : path === '/api/blog/categories/'
        ? [{ public_id: 'category_skills', name: 'Kỹ năng nghề nghiệp', slug: 'ky-nang-nghe-nghiep' }]
        : []

    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/blog/robot-doc-bai')

  const launcher = page.getByRole('button', { name: 'Phát bài viết ngay' })
  await expect(launcher).toBeVisible()
  const launcherBox = await page.locator('.blog-speech__rail-shell').boundingBox()
  expect(launcherBox.width).toBeLessThanOrEqual(50)
  expect(launcherBox.height).toBeLessThanOrEqual(50)

  const mascot = launcher.locator('.procv-mascot')
  await expect(mascot).toHaveAttribute('data-pose', 'microphone')
  await expect(mascot.locator('img[src*="robot-prop-microphone.webp"]')).toHaveCount(1)
  await expect(mascot.locator('img[src*="robot-hand-left-grip-front.webp"]')).toHaveCount(1)

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(hasHorizontalOverflow).toBe(false)
})
