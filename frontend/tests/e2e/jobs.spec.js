import { expect, test } from '@playwright/test'

async function mockJobListDependencies(page) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    let body = {}

    if (path === '/api/site/settings/') body = {}
    if (path === '/api/site/banners/') body = []
    if (path === '/api/jobs/') body = { count: 0, results: [] }
    if (path === '/api/jobs/best/') body = { count: 0, results: [] }
    if (path === '/api/jobs/categories/') body = []
    if (path === '/api/jobs/stats/') body = { demand: [] }
    if (path === '/api/locations/') body = []
    if (path === '/api/employer/industries/') body = []
    if (path === '/api/v2/cv-templates/') body = { count: 0, results: [] }

    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
}

test('job list creates a new ranking seed after browser refresh', async ({ page }) => {
  await mockJobListDependencies(page)
  const firstRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/jobs/' && url.searchParams.has('ranking_seed')
  })

  await page.goto('/viec-lam')
  const firstRequest = await firstRequestPromise
  const firstSeed = new URL(firstRequest.url()).searchParams.get('ranking_seed')
  expect(firstSeed).toMatch(/^[A-Za-z0-9_-]{1,64}$/)

  const reloadedRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/jobs/' && url.searchParams.has('ranking_seed')
  })
  await page.reload()
  const reloadedRequest = await reloadedRequestPromise
  const reloadedSeed = new URL(reloadedRequest.url()).searchParams.get('ranking_seed')

  expect(reloadedSeed).toMatch(/^[A-Za-z0-9_-]{1,64}$/)
  expect(reloadedSeed).not.toBe(firstSeed)
})

test('homepage Best Jobs uses its own rotation seed after browser refresh', async ({ page }) => {
  await mockJobListDependencies(page)
  const firstRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/jobs/best/' && url.searchParams.has('rotation_seed')
  })

  await page.goto('/')
  const firstRequest = await firstRequestPromise
  const firstSeed = new URL(firstRequest.url()).searchParams.get('rotation_seed')
  expect(firstSeed).toMatch(/^[A-Za-z0-9_-]{1,64}$/)
  if (page.viewportSize().width >= 640) {
    await expect(page.getByText('Luân phiên ngẫu nhiên')).toBeVisible()
  }
  await expect(page.getByText(/đủ điều kiện Việc làm tốt nhất được luân phiên/)).toBeVisible()

  const reloadedRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/jobs/best/' && url.searchParams.has('rotation_seed')
  })
  await page.reload()
  const reloadedRequest = await reloadedRequestPromise
  const reloadedSeed = new URL(reloadedRequest.url()).searchParams.get('rotation_seed')

  expect(reloadedSeed).toMatch(/^[A-Za-z0-9_-]{1,64}$/)
  expect(reloadedSeed).not.toBe(firstSeed)
})

test('job list loads after a direct route refresh', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await mockJobListDependencies(page)

  await page.goto('/viec-lam')

  expect(pageErrors).toEqual([])
  await expect(page.getByRole('heading', { name: /Tuyển dụng/ })).toBeVisible()
  await expect(page.getByText('Rất tiếc, chưa tìm thấy công việc phù hợp với tiêu chí của bạn.')).toBeVisible()
})

test('job list requests new results after an advanced filter changes', async ({ page }) => {
  await mockJobListDependencies(page)
  await page.goto('/viec-lam')

  const mobileFilterButton = page.getByRole('button', { name: /Lọc nâng cao/ })
  if (await mobileFilterButton.isVisible()) await mobileFilterButton.click()

  const filteredRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/jobs/' && url.searchParams.get('work_type') === 'remote'
  })

  await page.getByRole('button', { name: 'Từ xa' }).click()
  await filteredRequest
  await expect(page).toHaveURL(/wt=remote/)
})
