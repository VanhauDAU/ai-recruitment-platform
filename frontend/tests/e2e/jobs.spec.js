import { expect, test } from '@playwright/test'

async function mockJobListDependencies(page) {
  await page.route('http://localhost:8000/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    let body = {}

    if (path === '/api/site/settings/') body = {}
    if (path === '/api/jobs/') body = { count: 0, results: [] }
    if (path === '/api/jobs/categories/') body = []
    if (path === '/api/jobs/stats/') body = { demand: [] }
    if (path === '/api/locations/') body = []
    if (path === '/api/employer/industries/') body = []

    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
}

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
