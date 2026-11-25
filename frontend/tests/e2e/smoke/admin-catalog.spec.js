import { expect, test } from '@playwright/test'
import { API_ROUTE, mockPublicApi } from './helpers'

const usage = (jobs, cvs = 0, candidates = 0) => ({ usage: { jobs, cvs, candidates }, usage_total: jobs + cvs + candidates })
const SKILLS = [
  { id: 1, name: 'ReactJS', slug: 'reactjs', aliases: ['React.js', 'React', 'ReactJS 18'], group: null, group_name: '', description: '', source: 'employer', is_active: true, created_at: '2026-11-20T03:00:00Z', ...usage(12, 30, 4) },
  { id: 2, name: 'React.js', slug: 'react-js', aliases: [], group: null, group_name: '', description: '', source: 'import', is_active: true, created_at: '2026-11-21T03:00:00Z', ...usage(3) },
  { id: 3, name: 'Django', slug: 'django', aliases: ['Django REST'], group: 5, group_name: 'Backend', description: '', source: 'seed', is_active: true, created_at: '2026-11-01T03:00:00Z', ...usage(9, 2) },
  { id: 4, name: 'Kế toán thuế', slug: 'ke-toan-thue', aliases: ['Tax accounting'], group: 6, group_name: 'Kế toán', description: '', source: 'seed', is_active: true, created_at: '2026-11-01T03:00:00Z', ...usage(21, 8) },
]
const GROUPS = [
  { id: 5, name: 'Backend', slug: 'backend', parent: null, is_active: true, skill_count: 1, is_system: false },
  { id: 6, name: 'Kế toán', slug: 'ke-toan', parent: null, is_active: true, skill_count: 1, is_system: false },
  { id: 7, name: 'Phẩm chất cá nhân', slug: 'pham-chat-ca-nhan', parent: null, is_active: true, skill_count: 0, is_system: true },
]

async function routeCatalogApi(page, { onUpdate } = {}) {
  await mockPublicApi(page)
  await page.route(API_ROUTE, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    if (path === '/api/auth/refresh/') return route.fulfill({ json: { access: 'e2e-access' } })
    if (path === '/api/auth/me/') {
      return route.fulfill({
        json: { public_id: 'usr_admin', email: 'admin@example.com', full_name: 'System Admin', role: 'admin', email_verified: true, admin_access: { is_superuser: true } },
      })
    }
    if (path === '/api/admin/skills/summary/') {
      return route.fulfill({ json: { total: 4, ungrouped: 2, duplicates: 2, employer: 1, hidden: 0 } })
    }
    if (path === '/api/admin/skills/groups/') return route.fulfill({ json: GROUPS })
    if (path === '/api/admin/skills/') {
      const ungrouped = url.searchParams.get('ungrouped') === 'true'
      const results = ungrouped ? SKILLS.filter((skill) => !skill.group) : SKILLS
      return route.fulfill({ json: { count: results.length, next: null, previous: null, results } })
    }
    const detail = path.match(/^\/api\/admin\/skills\/(\d+)\/$/)
    if (detail && request.method() === 'PATCH') {
      const payload = request.postDataJSON()
      onUpdate?.(payload)
      return route.fulfill({ json: { ...SKILLS.find((skill) => skill.id === Number(detail[1])), ...payload } })
    }
    return route.fallback()
  })
}

test('admin catalog: clean up skills from the cleanup strip and the drawer', { tag: '@responsive' }, async ({ page }) => {
  let updated
  await routeCatalogApi(page, { onUpdate: (payload) => { updated = payload } })
  await page.goto('/admin/app/catalog')
  await expect(page.getByRole('heading', { name: 'Danh mục dữ liệu' })).toBeVisible()
  await expect(page.getByText('Kế toán thuế')).toBeVisible()

  await page.getByRole('button', { name: '2 chưa có nhóm' }).click()
  await expect(page.getByText('Kế toán thuế')).toBeHidden()

  await page.getByRole('button', { name: 'ReactJS', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Sửa kỹ năng' })
  await expect(drawer.getByText('12 tin · 30 CV · 4 nhu cầu tìm việc', { exact: false })).toBeVisible()
  await drawer.getByRole('textbox', { name: 'Mô tả' }).fill('Thư viện giao diện')
  await drawer.getByRole('button', { name: 'Lưu & tiếp' }).click()
  await expect.poll(() => updated).toMatchObject({ name: 'ReactJS', description: 'Thư viện giao diện' })
  await expect(page.getByRole('dialog', { name: 'Sửa kỹ năng' }).getByRole('textbox', { name: 'Tên' })).toHaveValue('React.js')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
