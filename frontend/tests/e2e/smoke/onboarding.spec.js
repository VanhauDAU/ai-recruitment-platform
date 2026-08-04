import { expect, test } from '@playwright/test'

const CATEGORIES = [
  { id: 1, name: 'Công nghệ thông tin', parent: null, category_type: 'occupation_group' },
  { id: 2, name: 'Phát triển phần mềm', parent: 1, category_type: 'domain' },
  { id: 3, name: 'Lập trình viên', parent: 2, category_type: 'specialization' },
]
const PROVINCES = [{ id: 9, name: 'Thành phố Đà Nẵng', level: 'province' }]

const SAVED_PREFERENCE = {
  ai_recommendation_consent: true,
  desired_position_other: '',
  desired_salary_vnd: 15000000,
  desired_specializations: [{ id: 3, name: 'Lập trình viên' }],
  experience_level: '2',
  job_preferences_configured: true,
  preferred_provinces: [{ id: 9, name: 'Thành phố Đà Nẵng' }],
  recruiter_visibility_consent: false,
  willing_to_relocate: false,
}

async function mockOnboardingApi(page) {
  await page.route('http://localhost:8000/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname

    // Robot im lặng trong smoke test: engine TTS không chạy ở CI, phụ đề vẫn
    // phải hiện đủ nhờ typewriter dự phòng.
    if (path === '/api/speech/sessions/') {
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"unavailable"}' })
      return
    }
    if (path === '/api/candidate/job-preferences/' && request.method() === 'PUT') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(SAVED_PREFERENCE) })
      return
    }

    const body = path === '/api/auth/refresh/'
      ? { access: 'e2e-access' }
      : path === '/api/auth/me/'
        ? {
          public_id: 'candidate_1',
          role: 'candidate',
          email: 'candidate@example.com',
          full_name: 'Nguyễn An',
          email_verified: true,
          job_preferences_configured: false,
        }
        : path === '/api/candidate/job-preferences/'
          ? { desired_specializations: [], preferred_provinces: [], job_preferences_configured: false }
          : path === '/api/jobs/categories/'
            ? { count: CATEGORIES.length, results: CATEGORIES }
            : path === '/api/locations/'
              ? { count: PROVINCES.length, results: PROVINCES }
              : path === '/api/privacy/consent/'
                ? { consent: { necessary: true, preferences: true, analytics: false, marketing: false } }
                : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
}

test.describe('onboarding phỏng vấn bằng robot', () => {
  test('robot dẫn hết năm câu rồi chốt bằng nhu cầu vừa lưu', async ({ page }) => {
    await mockOnboardingApi(page)

    await page.goto('/onboard-user')
    await expect(page.locator('.procv-mascot')).toHaveAttribute('data-pose', 'wave')
    await page.getByRole('button', { name: 'Bắt đầu' }).click()
    await expect(page).toHaveURL('/onboard-user-setting')

    // 1/5 — lĩnh vực
    await expect(page.getByText('Câu 1/5')).toBeVisible()
    await expect(page.locator('.onboarding-stage__sr')).toContainText('Chào Nguyễn An!')
    await page.getByRole('button', { name: 'Chọn danh mục vị trí chuyên môn' }).click()
    await page.getByRole('button', { name: 'Lập trình viên' }).click()
    await page.getByRole('button', { name: 'Xác nhận' }).click()
    await page.getByRole('button', { name: 'Tiếp tục' }).click()

    // 2/5 — kinh nghiệm
    await expect(page.getByText('Câu 2/5')).toBeVisible()
    await page.getByRole('button', { name: '2 năm', exact: true }).click()
    await page.getByRole('button', { name: 'Tiếp tục' }).click()

    // 3/5 — mức lương
    await expect(page.getByText('Câu 3/5')).toBeVisible()
    await page.getByRole('button', { name: '15 triệu' }).click()
    await page.getByRole('button', { name: 'Tiếp tục' }).click()

    // 4/5 — địa điểm
    await expect(page.getByText('Câu 4/5')).toBeVisible()
    await page.getByRole('combobox').click()
    await page.getByTitle('Thành phố Đà Nẵng').click()
    await page.getByRole('button', { name: 'Tiếp tục' }).click()

    // 5/5 — cho phép
    await expect(page.getByText('Câu 5/5')).toBeVisible()
    await page.getByRole('checkbox', { name: /gợi ý việc làm dựa trên nhu cầu/ }).check()
    await page.getByRole('button', { name: 'Hoàn thành' }).click()

    await expect(page.locator('.procv-mascot')).toHaveAttribute('data-emotion', 'thinking')
    await expect(page.locator('.onboarding-stage__sr')).toContainText('Xong rồi Nguyễn An!', { timeout: 15_000 })
    await expect(page.locator('.onboarding-stage__sr')).toContainText('Lập trình viên')
    await expect(page.locator('.onboarding-stage__sr')).toContainText('Đà Nẵng')
    await expect(page.locator('.onboarding-stage__sr')).toContainText('15 triệu')
    await expect(page.locator('.procv-mascot')).toHaveAttribute('data-pose', 'thumbsUp')
  })

  test('chặn qua bước khi chưa trả lời và cho bỏ qua onboarding', async ({ page }) => {
    await mockOnboardingApi(page)

    await page.goto('/onboard-user-setting')
    await expect(page.getByText('Câu 1/5')).toBeVisible()
    await page.getByRole('button', { name: 'Tiếp tục' }).click()

    await expect(page.getByText('Vui lòng chọn ít nhất một vị trí chuyên môn.')).toBeVisible()
    await expect(page.locator('.procv-mascot')).toHaveAttribute('data-emotion', 'error')
    await expect(page.getByText('Câu 1/5')).toBeVisible()

    await page.getByRole('button', { name: 'Tôi sẽ hoàn thiện sau' }).click()
    await expect(page).toHaveURL('/')
  })
})
