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

test('job list loads from the jobs feature after a direct route refresh', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await mockJobListDependencies(page)

  await page.goto('/viec-lam')

  expect(pageErrors).toEqual([])
  await expect(page.getByRole('heading', { name: /Tuyển dụng/ })).toBeVisible()
  await expect(page.getByText('Rất tiếc, chưa tìm thấy công việc phù hợp với tiêu chí của bạn.')).toBeVisible()
})
