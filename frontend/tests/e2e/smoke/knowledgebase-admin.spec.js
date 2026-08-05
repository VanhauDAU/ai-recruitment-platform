import { expect, test } from '@playwright/test'

test('knowledgebase admin: explicit save, review and publish workflow', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  const category = {
    public_id: 'kbc_account',
    name: 'Tài khoản và đăng nhập',
    slug: 'tai-khoan-va-dang-nhap',
    description: 'Hỗ trợ tài khoản ứng viên',
    order: 1,
    is_active: true,
    review_interval_days: 180,
    revision_token: 1,
    article_count: 1,
    public_article_count: 0,
  }
  const article = {
    public_id: 'kba_reset',
    category,
    slug: 'lam-the-nao-de-dat-lai-mat-khau',
    article_type: 'FAQ',
    title: 'Làm thế nào để đặt lại mật khẩu?',
    order: 1,
    lifecycle_state: 'ACTIVE',
    latest_revision: { number: 1, status: 'DRAFT', updated_at: '2026-08-05T07:00:00Z' },
    published_revision_number: null,
    revision_token: 1,
    review_due_at: null,
    first_published_at: null,
    current_published_at: null,
    created_at: '2026-08-05T07:00:00Z',
    updated_at: '2026-08-05T07:00:00Z',
    revisions: [{
      public_id: 'kbr_1',
      number: 1,
      status: 'DRAFT',
      title: 'Làm thế nào để đặt lại mật khẩu?',
      body: '<p>Chọn Quên mật khẩu trên trang đăng nhập.</p>',
      body_plain_text: 'Chọn Quên mật khẩu trên trang đăng nhập.',
      seo_title: '',
      seo_description: '',
      change_summary: '',
      source_reference: '/forgot-password',
      review_note: '',
      created_by: { public_id: 'usr_editor', name: 'Biên tập viên' },
      created_at: '2026-08-05T07:00:00Z',
      updated_at: '2026-08-05T07:00:00Z',
    }],
    audit_events: [],
  }
  const adminUser = {
    public_id: 'usr_editor',
    email: 'editor@example.com',
    full_name: 'Biên tập viên',
    role: 'admin',
    status: 'active',
    admin_access: {
      is_superuser: false,
      permissions: [
        'knowledgebase.view',
        'knowledgebase.manage',
        'knowledgebase.review',
        'knowledgebase.publish',
      ],
      memberships: [],
    },
  }

  const responseArticle = () => JSON.parse(JSON.stringify(article))
  const clickWorkflow = async (locator) => {
    await locator.scrollIntoViewIfNeeded()
    if (page.viewportSize().width < 600) await locator.evaluate((button) => button.click())
    else await locator.click()
  }
  const dismissToast = async () => {
    const toast = page.locator('[data-sonner-toast]').first()
    if (await toast.isVisible()) await toast.getByRole('button').evaluate((button) => button.click())
  }
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    let body = {}
    if (path === '/api/auth/refresh/') body = { access: 'e2e-access' }
    else if (path === '/api/auth/me/') body = adminUser
    else if (path === '/api/privacy/consent/') body = { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
    else if (path === '/api/knowledgebase/admin/categories/') body = [category]
    else if (path === '/api/knowledgebase/admin/articles/') {
      body = { count: 1, next: null, previous: null, results: [article] }
    } else if (path === '/api/knowledgebase/admin/articles/kba_reset/') body = responseArticle()
    else if (path === '/api/knowledgebase/admin/media/') body = { count: 0, results: [] }
    else if (path === '/api/knowledgebase/admin/articles/kba_reset/revisions/1/') {
      const payload = route.request().postDataJSON()
      Object.assign(article.revisions[0], payload, {
        body_plain_text: payload.body.replace(/<[^>]+>/g, ''),
        updated_at: '2026-08-05T08:00:00Z',
      })
      article.title = payload.title
      article.revision_token += 1
      article.latest_revision.updated_at = article.revisions[0].updated_at
      body = responseArticle()
    } else if (path === '/api/knowledgebase/admin/articles/kba_reset/revisions/1/submit/') {
      article.revisions[0].status = 'IN_REVIEW'
      article.latest_revision.status = 'IN_REVIEW'
      article.revision_token += 1
      body = responseArticle()
    } else if (path === '/api/knowledgebase/admin/articles/kba_reset/revisions/1/approve/') {
      article.revisions[0].status = 'APPROVED'
      article.latest_revision.status = 'APPROVED'
      article.revision_token += 1
      body = responseArticle()
    } else if (path === '/api/knowledgebase/admin/articles/kba_reset/publish/') {
      article.published_revision_number = 1
      article.first_published_at = '2026-08-05T09:00:00Z'
      article.current_published_at = article.first_published_at
      article.review_due_at = route.request().postDataJSON().review_due_at
      article.revision_token += 1
      category.public_article_count = 1
      body = responseArticle()
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/admin/app/knowledgebase')
  await page.waitForTimeout(300)
  expect(pageErrors).toEqual([])
  expect(page.url()).toContain('/admin/app/knowledgebase')
  await expect(page.getByRole('heading', { name: 'Trung tâm FAQ & hướng dẫn' })).toBeVisible()
  await expect(page.getByText('Làm thế nào để đặt lại mật khẩu?', { exact: true })).toBeVisible()
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', await page.locator('html').evaluate((element) => element.clientWidth))

  await page.getByRole('button', { name: 'Làm thế nào để đặt lại mật khẩu?', exact: true }).click()
  await expect(page).toHaveURL('/admin/app/knowledgebase/kba_reset')
  const title = page.getByLabel('Câu hỏi')
  await expect(title).toHaveValue('Làm thế nào để đặt lại mật khẩu?')
  await title.fill('Tôi đặt lại mật khẩu như thế nào?')
  await page.getByRole('button', { name: /Lưu bản nháp/ }).click()
  await expect(page.getByText('Đã lưu bản nháp.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tôi đặt lại mật khẩu như thế nào?' })).toBeVisible()
  await dismissToast()

  const submitButton = page.getByRole('button', { name: /Gửi duyệt/ })
  await submitButton.scrollIntoViewIfNeeded()
  if (page.viewportSize().width < 600) {
    const geometry = await submitButton.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const covering = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
      return {
        covering: covering?.textContent?.trim(),
        position: getComputedStyle(document.querySelector('.knowledge-editor__sticky')).position,
        rect: { bottom: rect.bottom, top: rect.top },
        scrollY: window.scrollY,
      }
    })
    expect(geometry.covering).toContain('Gửi duyệt')
  }
  await clickWorkflow(submitButton)
  await clickWorkflow(page.getByRole('dialog').getByRole('button', { name: 'Gửi duyệt', exact: true }))
  await expect(page.getByText('Đã gửi revision đi duyệt.')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await dismissToast()
  await clickWorkflow(page.getByRole('button', { name: /Duyệt revision/ }))
  await clickWorkflow(page.getByRole('dialog').getByRole('button', { name: 'Duyệt', exact: true }))
  await expect(page.getByText('Đã duyệt revision.')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await dismissToast()

  await clickWorkflow(page.getByRole('button', { name: /Xuất bản r1/ }))
  await clickWorkflow(page.getByRole('dialog').getByRole('button', { name: 'Xuất bản ngay' }))
  await expect(page.getByText('Đã xuất bản nội dung lên trung tâm trợ giúp.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Xuất bản r1/ })).toHaveCount(0)
})
