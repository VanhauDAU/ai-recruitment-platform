export async function mockPublicApi(page) {
  const servicePackages = [{
    key: 'featured-jobs', name_vi: 'Tin tuyển dụng nổi bật', name_en: 'Featured job postings',
    description_vi: 'Tăng độ phủ cho vị trí cần tuyển nhanh.', description_en: 'Increase reach for priority roles.',
    packages: [{
      slug: 'top-max', name_vi: 'TOP MAX', name_en: 'TOP MAX', tagline_vi: 'Phủ sóng tối đa', tagline_en: 'Maximum reach',
      price: '7500000', currency: 'VND', unit_vi: '/ tin 30 ngày', unit_en: '/ posting, 30 days',
      vat_note_vi: 'Giá chưa bao gồm VAT', vat_note_en: 'Price excludes VAT',
      benefits_vi: ['Ưu tiên hiển thị', 'AI gợi ý ứng viên'], benefits_en: ['Priority display', 'AI recommendations'],
      badge_vi: 'Hiệu quả nhất', badge_en: 'Best value', is_highlight: true, cta_type: 'contact',
    }],
  }]
  await page.route('http://localhost:8000/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/me/' || path === '/api/auth/refresh/') {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Authentication credentials were not provided.' }),
      })
      return
    }
    const body = path === '/api/jobs/'
      ? { count: 0, results: [] }
      : path === '/api/privacy/consent/'
        // Consent đã quyết định -> banner cookie không che các nút trong smoke test.
        ? { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
        : path === '/api/services/packages/'
          ? servicePackages
        : path === '/api/dashboard/employer/'
          ? {
              account: {
                recruiter_public_id: 'rec_test', company_name: 'Công ty Acme',
                company_verification_status: 'unverified', company_size: '25-99', work_location_name: 'Hà Nội',
                verification: { email_verified: true, phone_verified: false, company_linked: false, business_doc_submitted: false, candidate_dpa_submitted: false, dpa_accepted: false, first_job_posted: false },
              },
              summary: { jobs_total: 0, jobs_active: 0, jobs_pending: 0, jobs_draft: 0, job_views: 0, applications_total: 0, applications_new: 0, applications_shortlisted: 0, applications_interviewed: 0 },
              application_activity: Array.from({ length: 7 }, (_, index) => ({ date: `2026-07-${String(12 + index).padStart(2, '0')}`, count: 0 })),
              recruitment_need: null, recent_jobs: [], recent_applications: [],
            }
        : path === '/api/locations/'
          ? [{ id: 1, name: 'Hà Nội', level: 'province' }, { id: 2, name: 'TP. Hồ Chí Minh', level: 'province' }]
          : ['/api/jobs/categories/', '/api/employer/industries/'].includes(path)
            ? []
          : path === '/api/auth/sessions/'
            ? []
            : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
}
