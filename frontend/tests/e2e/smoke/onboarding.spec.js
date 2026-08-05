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

/** Phụ đề đầy đủ của robot, không phụ thuộc chữ đang chạy dần trong bong bóng. */
function botTranscript(page) {
  return page.locator('.onboarding-chat__sr')
}

test.describe('onboarding trò chuyện với robot', () => {
  test('cả cuộc trò chuyện diễn ra trên một trang rồi chốt bằng nhu cầu vừa lưu', async ({ page }) => {
    await mockOnboardingApi(page)

    await page.goto('/onboard-user')
    await expect(botTranscript(page).first()).toContainText('Chào Nguyễn An!')
    await page.getByRole('button', { name: 'Bắt đầu thôi!' }).click()

    // 1/5 — lĩnh vực: nhiều lựa chọn nên gửi bằng nút gửi của ô soạn.
    await expect(page.getByText('Câu 1/5')).toBeVisible()
    await page.getByRole('button', { name: 'Chọn danh mục vị trí chuyên môn' }).click()
    await page.getByRole('button', { name: 'Lập trình viên' }).click()
    await page.getByRole('button', { name: 'Xác nhận' }).click()
    await page.getByRole('button', { name: 'Gửi', exact: true }).click()

    // 2/5 — kinh nghiệm: một lựa chọn, bấm phát gửi luôn.
    await expect(page.getByText('Câu 2/5')).toBeVisible()
    await page.getByRole('button', { name: '2 năm', exact: true }).click()

    // 3/5 — mức lương: mức gợi ý cũng gửi ngay.
    await expect(page.getByText('Câu 3/5')).toBeVisible()
    await page.getByRole('button', { name: '15 triệu' }).click()

    // 4/5 — địa điểm
    await expect(page.getByText('Câu 4/5')).toBeVisible()
    await page.getByRole('combobox').click()
    await page.getByTitle('Thành phố Đà Nẵng').click()
    await page.getByRole('button', { name: 'Gửi', exact: true }).click()

    // 5/5 — cho phép
    await expect(page.getByText('Câu 5/5')).toBeVisible()
    await page.getByRole('checkbox', { name: /gợi ý việc làm dựa trên nhu cầu/ }).check()
    await page.getByRole('button', { name: 'Hoàn tất' }).click()

    // Không nhảy trang nào trong cả luồng.
    await expect(page).toHaveURL('/onboard-user')
    await expect(botTranscript(page).last()).toContainText('Xong rồi Nguyễn An!', { timeout: 15_000 })
    await expect(botTranscript(page).last()).toContainText('Lập trình viên')
    await expect(botTranscript(page).last()).toContainText('Đà Nẵng')
    await expect(botTranscript(page).last()).toContainText('15 triệu')
    await expect(page.locator('.procv-mascot').first()).toHaveAttribute('data-emotion', 'success')

    // Đáp án cũ vẫn nằm nguyên trong lịch sử hội thoại.
    await expect(page.getByText('15.000.000 VND/tháng')).toBeVisible()
  })

  test('robot nhắc ngay trong hội thoại khi chưa trả lời và cho bỏ qua onboarding', async ({ page }) => {
    await mockOnboardingApi(page)

    await page.goto('/onboard-user')
    await page.getByRole('button', { name: 'Bắt đầu thôi!' }).click()
    await expect(page.getByText('Câu 1/5')).toBeVisible()

    await page.getByRole('button', { name: 'Gửi', exact: true }).click()

    await expect(botTranscript(page).last()).toContainText('ít nhất một vị trí chuyên môn')
    await expect(page.locator('.procv-mascot').first()).toHaveAttribute('data-emotion', 'error')
    await expect(page.getByText('Câu 1/5')).toBeVisible()

    await page.getByRole('button', { name: 'Hoàn thiện sau' }).click()
    await expect(page).toHaveURL('/')
  })

  test('URL onboarding cũ vẫn mở được cuộc trò chuyện', async ({ page }) => {
    await mockOnboardingApi(page)

    await page.goto('/onboard-user-setting')

    await expect(page).toHaveURL('/onboard-user')
    await expect(botTranscript(page).first()).toContainText('Chào Nguyễn An!')
  })
})
