import { expect, test } from '@playwright/test'
import { mockPublicApi } from './helpers'

const jobs = [
  {
    public_id: 'job_compare_1',
    slug: 'frontend-engineer-job_frontend_compare',
    title: 'Frontend Engineer',
    company_name: 'ProCV',
    company_logo_url: '',
    company_verified: true,
    locations_detail: [{ id: 1, name: 'Hà Nội' }],
    job_skills: [],
    work_type: 'hybrid',
    work_types: ['hybrid', 'remote'],
    employment_type: 'full_time',
    experience_years: '2',
    education_level: 'university',
    position_level: 'employee',
    salary_type: 'range',
    salary_min: 25_000_000,
    salary_max: 35_000_000,
    currency: 'VND',
    first_approved_at: '2026-08-12T08:00:00Z',
  },
  {
    public_id: 'job_compare_2',
    slug: 'backend-engineer-job_backend_compare',
    title: 'Backend Engineer',
    company_name: 'Dữ liệu Việt',
    company_logo_url: '',
    company_verified: false,
    locations_detail: [{ id: 2, name: 'TP. Hồ Chí Minh' }],
    job_skills: [],
    work_type: 'onsite',
    work_types: ['onsite'],
    employment_type: 'full_time',
    experience_years: '3',
    education_level: 'university',
    position_level: 'employee',
    salary_type: 'range',
    salary_min: 1_800,
    salary_max: 2_500,
    currency: 'USD',
    first_approved_at: '2026-08-10T08:00:00Z',
  },
  {
    public_id: 'job_compare_3',
    slug: 'data-analyst-job_data_compare',
    title: 'Data Analyst',
    company_name: 'Phân tích Việt',
    company_logo_url: '',
    company_verified: true,
    locations_detail: [{ id: 3, name: 'Đà Nẵng' }],
    job_skills: [],
    work_type: 'remote',
    work_types: ['remote'],
    employment_type: 'full_time',
    experience_years: '1',
    education_level: 'college',
    position_level: 'employee',
    salary_type: 'negotiable',
    salary_min: null,
    salary_max: null,
    currency: 'VND',
    first_approved_at: '2026-08-09T08:00:00Z',
  },
]

function detail(job) {
  return {
    ...job,
    age_min: null,
    age_max: null,
    gender_requirement: 'any',
    number_of_vacancies: job.public_id === 'job_compare_1' ? 3 : null,
    deadline: '2026-09-20',
    application_reasons: ['Lộ trình phát triển rõ ràng'],
    benefit_groups: [],
    benefits: '<p>Làm việc linh hoạt và ngân sách học tập.</p>',
    company_address: job.locations_detail[0].name,
    company_description: 'Môi trường sản phẩm tinh gọn, tập trung vào trải nghiệm người dùng.',
    company_industries: ['Công nghệ thông tin'],
    company_size: '51-100 nhân sự',
    company_website_url: '',
    description: '<p>Xây dựng sản phẩm tuyển dụng rõ ràng, dễ sử dụng.</p>',
    domain_knowledge: [],
    language_requirements: [],
    preferred_skills: [],
    primary_specialization: { id: 1, name: 'Phát triển phần mềm', slug: 'phat-trien-phan-mem' },
    required_skills: job.public_id === 'job_compare_1' ? ['React'] : ['Python'],
    requirements: '<p>Chủ động phối hợp và có tư duy sản phẩm.</p>',
    work_schedules: [],
    workplace_groups: [],
  }
}

async function mockComparisonApi(page) {
  await mockPublicApi(page)
  await page.route(/\/api\/jobs\/(?:\?.*)?$/, (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ count: jobs.length, next: null, previous: null, results: jobs }),
  }))
  for (const job of jobs) {
    await page.route(`**/api/jobs/${job.slug}/`, (route) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(detail(job)),
    }))
  }
}

test('guest selects jobs and opens the responsive public comparison', async ({ page }, testInfo) => {
  await mockComparisonApi(page)
  await page.goto('/viec-lam')

  await page.getByRole('button', { name: 'Thêm Frontend Engineer vào so sánh' }).click()
  await page.getByRole('button', { name: 'Thêm Backend Engineer vào so sánh' }).click()
  await page.getByRole('button', { name: 'Thêm Data Analyst vào so sánh' }).click()
  await expect(page.getByRole('region', { name: /Danh sách so sánh, 3 trên 3 việc làm/ })).toBeVisible()

  if (testInfo.project.name === 'mobile-chromium') {
    await page.getByRole('button', { name: 'So sánh (3/3)' }).click()
  }
  await page.getByRole('link', { name: 'So sánh ngay' }).click()

  await expect(page).toHaveURL(/\/so-sanh-viec-lam\?job=frontend-engineer-job_frontend_compare&job=backend-engineer-job_backend_compare&job=data-analyst-job_data_compare/)
  await expect(page.getByRole('heading', { name: 'So sánh việc làm', level: 1 })).toBeVisible()
  await expect(page.getByText('Đang so sánh 3/3 việc làm')).toBeVisible()
  await expect(page.getByText('Không giới hạn').filter({ visible: true }).first()).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0)

  const table = page.getByRole('table', { name: 'Bảng so sánh việc làm' })
  if (testInfo.project.name === 'desktop-chromium') await expect(table).toBeVisible()
  else await expect(table).toBeHidden()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'So sánh việc làm', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Frontend Engineer' }).filter({ visible: true }).first()).toBeVisible()
})

test('comparison keeps a removed job isolated when another detail is unavailable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium')
  await mockComparisonApi(page)
  await page.route('**/api/jobs/unavailable-job/', (route) => route.fulfill({
    status: 404,
    contentType: 'application/json',
    body: '{}',
  }))

  await page.goto('/so-sanh-viec-lam?job=frontend-engineer-job_frontend_compare&job=unavailable-job')

  await expect(page.getByText('Tin không còn khả dụng').filter({ visible: true }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Frontend Engineer' }).filter({ visible: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Bỏ khỏi so sánh' }).filter({ visible: true }).click()
  await expect(page).toHaveURL('/so-sanh-viec-lam?job=frontend-engineer-job_frontend_compare')
})
