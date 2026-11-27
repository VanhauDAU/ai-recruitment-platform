import { expect, test } from '@playwright/test'
import { APPLICATION_RULES } from './helpers'

const API_ROUTE = /^https?:\/\/[^/]+\/api\/.*$/
// Đặt JOB_FIT_SHOTS=<thư mục> để lưu ảnh chụp các bước (xem lại giao diện).
const SHOTS = process.env.JOB_FIT_SHOTS
// Dưới mức này trang chi tiết tin dùng bố cục điện thoại (`JobDetail.jsx`: max-width 767.98px).
const PHONE_MAX_WIDTH = 768

const JOB = {
  public_id: 'job_fit', slug: 'frontend-developer-jb_fit', title: 'Frontend Developer (ReactJS)', company_name: 'Công ty Mẫu',
  description: '<p>Phát triển giao diện thương mại điện tử.</p>', requirements: '<p>Có 2 năm kinh nghiệm ReactJS.</p>',
  benefits: '', locations_detail: [], requirement_tags: [], benefit_tags: [], domain_knowledge: [], workplace_groups: [],
  work_schedules: [], language_requirements: [], category: null, category_name: '', experience_years: '2',
  salary_type: 'negotiable', work_type: 'office', employment_type: 'full_time', view_count: 0, status: 'active',
}
const RESULT = {
  overall: { score: 74, level: 'high', label: 'Phù hợp', confidence: 'medium' },
  components: [
    { key: 'skills', score: 80, weight: 0.4, status: 'ok', summary: 'Đáp ứng 4/5 kỹ năng tin yêu cầu.' },
    { key: 'experience', score: 66, weight: 0.3, status: 'ok', summary: 'CV có khoảng 2 năm kinh nghiệm, tin yêu cầu 2 năm.' },
    { key: 'education', score: 100, weight: 0.1, status: 'ok', summary: 'Tin yêu cầu đại học trở lên, CV ghi đại học.' },
    { key: 'position_level', score: 100, weight: 0.1, status: 'ok', summary: 'Tin tuyển nhân viên, chức danh gần nhất trong CV tương ứng nhân viên.' },
    { key: 'languages', score: null, weight: 0.1, status: 'not_required', summary: 'Tin không đặt yêu cầu cho tiêu chí này.' },
    { key: 'location', score: null, weight: 0.1, status: 'insufficient_data', summary: 'Chưa có nơi làm việc mong muốn để so sánh.' },
  ],
  skills: {
    matched: [
      { name: 'ReactJS', importance: 'required', match_type: 'exact', similarity: null, evidence: 'Xây dựng trang thanh toán bằng ReactJS và TypeScript.' },
      { name: 'REST API', importance: 'required', match_type: 'semantic', similarity: 0.88, evidence: 'Kết nối giao diện với dịch vụ backend qua API.' },
      { name: 'Jest', importance: 'preferred', match_type: 'exact', similarity: null, evidence: '' },
    ],
    missing: [{ name: 'Next.js', importance: 'required' }, { name: 'Figma', importance: 'preferred' }],
    extra: [],
  },
  requirements: [
    { text: 'Có 2 năm kinh nghiệm ReactJS.', status: 'met', similarity: 0.9, evidence: 'Hai năm phát triển giao diện web bằng ReactJS.' },
    { text: 'Viết test tự động cho giao diện.', status: 'unmet', similarity: 0.5, evidence: '' },
  ],
  suggestions: [
    { code: 'missing_required_skills', priority: 'high', section: 'skills', message: 'Tin yêu cầu Next.js. Nếu bạn đã có, hãy ghi vào mục kỹ năng và kể một việc đã làm với kỹ năng đó ở mục kinh nghiệm hoặc dự án.', params: { skills: ['Next.js'] } },
    { code: 'skills_without_evidence', priority: 'medium', section: 'experience', message: 'CV có ghi Jest nhưng chưa có câu nào kể việc đã dùng. Thêm một dòng mô tả cụ thể ở mục kinh nghiệm hoặc dự án.', params: { skills: ['Jest'] } },
  ],
  flags: { language_mismatch: false, experience_estimated: false, insufficient: ['location'] },
  disclaimer: 'Kết quả là ước lượng tự động dựa trên nội dung CV và tin tuyển dụng, không phải quyết định tuyển dụng.',
  meta: { model_version: 'e5-base-zs-v1', scoring_version: 'hybrid-v1' },
}

async function mockApi(page) {
  let polls = 0
  await page.route(API_ROUTE, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const analysis = (status) => ({
      public_id: 'ma_1', status, job: JOB.slug, cv: { public_id: 'cv_1', title: 'CV Frontend' },
      overall_score: status === 'succeeded' ? 74 : null, result: status === 'succeeded' ? RESULT : null,
      error_code: '', cached: false, created_at: '2026-11-18T08:00:00Z', completed_at: status === 'succeeded' ? '2026-11-18T08:00:02Z' : null,
    })
    let body = {}
    if (path === '/api/auth/refresh/') body = { access: 'e2e-access' }
    else if (path === '/api/auth/me/') body = { id: 1, role: 'candidate', email_verified: true, job_preferences_configured: true }
    else if (path === '/api/public/privacy/consent/') body = request.method() === 'POST' ? { necessary: true } : { consent: null }
    else if (path === '/api/public/site/settings/') body = { ai_job_match_enabled: true }
    else if (path === `/api/public/jobs/${JOB.slug}/`) body = JOB
    else if (path === '/api/public/jobs/') body = { count: 0, results: [] }
    else if (path === '/api/public/jobs/categories/' || path === '/api/public/locations/') body = []
    else if (path === '/api/public/applications/rules/') body = APPLICATION_RULES
    else if (path === '/api/candidate/applications/') body = { results: [] }
    else if (path === '/api/candidate/cvs/') {
      body = { results: [{ public_id: 'cv_1', title: 'CV Frontend', is_default: true, cv_type: 'builder', is_complete: true, updated_at: '2026-11-18T08:00:00Z' }] }
    } else if (path === '/api/candidate/matching/analyses/' && request.method() === 'GET') body = []
    else if (path === '/api/candidate/matching/analyses/') body = analysis('queued')
    else if (path === '/api/candidate/matching/analyses/ma_1/') {
      polls += 1
      // Hai lượt poll đầu còn đang xử lý để thấy màn hình phân tích.
      body = analysis(polls <= 2 ? 'processing' : 'succeeded')
    }
    await route.fulfill({ status: path === '/api/candidate/matching/analyses/' && request.method() === 'POST' ? 202 : 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
}

test('candidate smoke: job fit analyses a CV and explains the result with evidence', { tag: '@responsive' }, async ({ page }, testInfo) => {
  await mockApi(page)
  await page.goto(`/viec-lam/${JOB.slug}`)
  await page.getByRole('button', { name: 'Chỉ thiết yếu' }).click()

  // Mỗi màn hình đúng một thẻ: cột phải từ 1024 px, dưới thông tin tin trên máy tính
  // bảng, nút nổi trên điện thoại.
  const trigger = page.getByRole('button', { name: /Xem độ phù hợp với CV của bạn/ })
  await expect(trigger).toHaveCount(1)
  await expect(trigger).toBeVisible()
  const { width } = page.viewportSize()
  const placement = width >= 1024 ? /jf-trigger--sidebar/ : width >= PHONE_MAX_WIDTH ? /jf-trigger--inline/ : /jf-fab/
  await expect(trigger).toHaveClass(placement)
  await trigger.scrollIntoViewIfNeeded()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${testInfo.project.name}-1-trigger.png` })
  await trigger.click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('radio', { name: /CV Frontend/ })).toBeChecked()
  await dialog.getByRole('button', { name: 'Xem độ phù hợp', exact: true }).click()

  await expect(dialog.getByText(/AI đang phân tích CV/)).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${testInfo.project.name}-2-progress.png` })

  await expect(dialog.getByRole('img', { name: '74 điểm, mức Phù hợp' })).toBeVisible()
  await expect(dialog.getByText(/không phải quyết định tuyển dụng/)).toBeVisible()
  await expect(dialog.getByText('Mô hình AI: e5-base-zs-v1')).toBeVisible()
  // Hộp thoại nằm trọn trong màn hình ở mọi cỡ: chỉ phần nội dung tab cuộn.
  const frame = await dialog.locator('.ant-modal-container').boundingBox()
  const viewport = page.viewportSize()
  expect(frame.y).toBeGreaterThanOrEqual(0)
  expect(frame.y + frame.height).toBeLessThanOrEqual(viewport.height + 1)
  expect(frame.x + frame.width).toBeLessThanOrEqual(viewport.width + 1)
  await dialog.getByRole('tab', { name: /Kỹ năng/ }).click()
  await expect(dialog.getByText('Xây dựng trang thanh toán bằng ReactJS và TypeScript.')).toBeVisible()
  await expect(dialog.getByText('chỉ liệt kê')).toBeVisible()
  await page.waitForTimeout(1000)
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${testInfo.project.name}-3-skills.png` })
    await dialog.getByRole('tab', { name: /Yêu cầu/ }).click()
    await page.screenshot({ path: `${SHOTS}/${testInfo.project.name}-4-requirements.png` })
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
