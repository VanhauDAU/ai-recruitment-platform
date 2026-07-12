export async function mockPublicApi(page) {
  await page.route('http://localhost:8000/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const body = path === '/api/jobs/'
      ? { count: 0, results: [] }
      : ['/api/jobs/categories/', '/api/locations/', '/api/employer/industries/'].includes(path)
        ? []
        : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
}
