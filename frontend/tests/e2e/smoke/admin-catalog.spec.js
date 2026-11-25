import { expect, test } from '@playwright/test'
import { API_ROUTE, mockPublicApi, selectTab } from './helpers'

const usage = (jobs, cvs = 0, candidates = 0) => ({ usage: { jobs, cvs, candidates }, usage_total: jobs + cvs + candidates })
const SKILLS = [
  { id: 1, name: 'ReactJS', aliases: ['React.js', 'React', 'ReactJS 18'], group: null, group_name: '', description: '', source: 'employer', is_active: true, created_at: '2026-11-20T03:00:00Z', ...usage(12, 30, 4) },
  { id: 2, name: 'React.js', aliases: [], group: null, group_name: '', description: '', source: 'import', is_active: true, created_at: '2026-11-21T03:00:00Z', ...usage(3) },
  { id: 3, name: 'Django', aliases: ['Django REST'], group: 5, group_name: 'Backend', description: '', source: 'seed', is_active: true, created_at: '2026-11-01T03:00:00Z', ...usage(9, 2) },
  { id: 4, name: 'Kế toán thuế', aliases: ['Tax accounting'], group: 6, group_name: 'Kế toán', description: '', source: 'seed', is_active: true, created_at: '2026-11-01T03:00:00Z', ...usage(21, 8) },
]
const GROUPS = [
  { id: 5, name: 'Backend', parent: null, is_active: true, skill_count: 1, is_system: false },
  { id: 6, name: 'Kế toán', parent: null, is_active: true, skill_count: 1, is_system: false },
  { id: 7, name: 'Phẩm chất cá nhân', parent: null, is_active: true, skill_count: 0, is_system: true },
]

const category = (id, name, category_type, parent, extra = {}) => ({
  id, name, name_en: '', description: '', category_type, parent,
  status: 'active', logo_url: '', logo_preview: null, job_count: 0, child_count: 0, ...extra,
})
const CATEGORIES = [
  category(1, 'Công nghệ thông tin', 'occupation_group', null, { child_count: 1 }),
  category(2, 'Phát triển phần mềm', 'domain', 1, { child_count: 1, job_count: 3 }),
  category(3, 'Lập trình viên Backend', 'specialization', 2, { name_en: 'Backend Developer', job_count: 7 }),
  category(4, 'Kế toán - Kiểm toán', 'occupation_group', null),
]
const BENEFITS = [
  { id: 1, name: 'Ăn trưa', category: 'allowance', is_active: true, sort_order: 0, job_count: 12, company_count: 4 },
  { id: 2, name: 'Laptop', category: 'equipment', is_active: true, sort_order: 1, job_count: 5, company_count: 2 },
]

async function routeCatalogApi(page, { onUpdate, onCategoryCreate } = {}) {
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
      return route.fulfill({ json: { ungrouped: 2, duplicates: 2 } })
    }
    if (path === '/api/admin/skills/groups/') return route.fulfill({ json: GROUPS })
    if (path === '/api/admin/jobs/categories/' && request.method() === 'GET') return route.fulfill({ json: CATEGORIES })
    if (path === '/api/admin/jobs/categories/' && request.method() === 'POST') {
      const payload = request.postDataJSON()
      onCategoryCreate?.(payload)
      return route.fulfill({ status: 201, json: category(9, payload.name, 'specialization', payload.parent) })
    }
    if (path === '/api/admin/jobs/benefits/') return route.fulfill({ json: BENEFITS })
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

test('admin catalog: job category tree and benefits', { tag: '@responsive' }, async ({ page }) => {
  let created
  await routeCatalogApi(page, { onCategoryCreate: (payload) => { created = payload } })
  await page.goto('/admin/app/catalog?tab=categories')
  await expect(page.getByText('Công nghệ thông tin')).toBeVisible()

  await page.getByRole('textbox', { name: 'Tìm ngành nghề…' }).fill('backend')
  await expect(page.getByText('Backend Developer')).toBeVisible()
  await expect(page.getByText('Kế toán - Kiểm toán')).toBeHidden()

  await page.getByRole('button', { name: 'Thêm mục con vào Phát triển phần mềm' }).click()
  const drawer = page.getByRole('dialog', { name: 'Thêm vị trí chuyên môn' })
  await drawer.getByRole('textbox', { name: 'Tên tiếng Việt' }).fill('Lập trình viên Go')
  await drawer.getByRole('textbox', { name: 'Tên tiếng Anh' }).fill('Go Developer')
  await drawer.getByRole('button', { name: 'Lưu' }).click()
  await expect.poll(() => created).toMatchObject({ name: 'Lập trình viên Go', name_en: 'Go Developer', parent: 2, status: 'active' })

  await selectTab(page, 'Phúc lợi')
  await expect(page.getByText('Ăn trưa')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
