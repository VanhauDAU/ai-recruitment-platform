import { expect, test } from '@playwright/test'

test('knowledgebase admin: explicit save, publish, edit and discard a draft', { tag: '@responsive' }, async ({ page }) => {
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
    admin_access: { is_superuser: false },
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
    else if (path === '/api/public/privacy/consent/') body = { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
    else if (path === '/api/admin/knowledgebase/categories/') body = [category]
    else if (path === '/api/admin/knowledgebase/articles/') {
      body = { count: 1, next: null, previous: null, results: [article] }
    } else if (path === '/api/admin/knowledgebase/articles/kba_reset/') body = responseArticle()
    else if (path === '/api/admin/knowledgebase/media/') body = { count: 0, results: [] }
    else if (path === '/api/admin/knowledgebase/articles/kba_reset/revisions/1/') {
      const payload = route.request().postDataJSON()
      Object.assign(article.revisions[0], payload, {
        body_plain_text: payload.body.replace(/<[^>]+>/g, ''),
        updated_at: '2026-08-05T08:00:00Z',
      })
      article.title = payload.title
      article.revision_token += 1
      article.latest_revision.updated_at = article.revisions[0].updated_at
      body = responseArticle()
    } else if (path === '/api/admin/knowledgebase/articles/kba_reset/publish/') {
      const { revision_number: number } = route.request().postDataJSON()
      article.revisions.find((item) => item.number === number).status = 'PUBLISHED'
      article.latest_revision.status = 'PUBLISHED'
      article.published_revision_number = number
      article.first_published_at = '2026-08-05T09:00:00Z'
      article.current_published_at = article.first_published_at
      article.review_due_at = route.request().postDataJSON().review_due_at
      article.revision_token += 1
      category.public_article_count = 1
      body = responseArticle()
    } else if (path === '/api/admin/knowledgebase/articles/kba_reset/revisions/' && route.request().method() === 'POST') {
      const payload = route.request().postDataJSON()
      const source = article.revisions[0]
      const revision = {
        ...source,
        public_id: 'kbr_2',
        number: 2,
        status: 'DRAFT',
        title: payload.title,
        body: payload.body,
        body_plain_text: payload.body.replace(/<[^>]+>/g, ''),
        source_reference: payload.source_reference,
        change_summary: payload.change_summary,
        seo_title: payload.seo_title,
        seo_description: payload.seo_description,
          created_at: '2026-08-05T10:00:00Z',
        updated_at: '2026-08-05T10:00:00Z',
      }
      article.revisions.unshift(revision)
      article.title = payload.title
      article.latest_revision = { number: 2, status: 'DRAFT', updated_at: revision.updated_at }
      article.revision_token += 1
      body = responseArticle()
    } else if (path === '/api/admin/knowledgebase/articles/kba_reset/revisions/2/discard/') {
      article.revisions = article.revisions.filter((item) => item.number !== 2)
      article.title = article.revisions[0].title
      article.latest_revision = { number: 1, status: 'PUBLISHED', updated_at: article.revisions[0].updated_at }
      article.revision_token += 1
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
  await expect(page.getByText('Chưa xuất bản', { exact: true })).toBeVisible()
  const publishButton = page.getByRole('button', { name: /Xuất bản r1/ })
  await expect(publishButton).toBeVisible()
  const title = page.getByLabel('Câu hỏi')
  await expect(title).toHaveValue('Làm thế nào để đặt lại mật khẩu?')
  const [workflowTop, editorTop] = await Promise.all([
    page.locator('.knowledge-article-workspace__workflow').evaluate((element) => element.getBoundingClientRect().top),
    title.evaluate((element) => element.getBoundingClientRect().top),
  ])
  expect(workflowTop).toBeLessThan(editorTop)

  await page.locator('.company-rich-editor__content').evaluate((element) => {
    window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top + 180)
  })
  await page.waitForTimeout(50)
  const stickyStack = await page.evaluate(() => {
    const rect = (selector) => {
      const bounds = document.querySelector(selector).getBoundingClientRect()
      return { bottom: bounds.bottom, left: bounds.left, right: bounds.right, top: bounds.top }
    }
    const action = rect('.knowledge-editor__toolbar')
    const richText = rect('.company-rich-editor__toolbar')
    const topbar = rect('.admin-topbar')
    const ownerAt = ({ left, right, top, bottom }, selector) => (
      document.elementFromPoint((left + right) / 2, (top + bottom) / 2)?.closest(selector) !== null
    )
    return {
      action,
      actionOwnsCenter: ownerAt(action, '.knowledge-editor__toolbar'),
      richText,
      richTextOwnsCenter: ownerAt(richText, '.company-rich-editor__toolbar'),
      topbar,
    }
  })
  expect(stickyStack.action.top).toBeGreaterThanOrEqual(stickyStack.topbar.bottom + 6)
  expect(stickyStack.richText.top).toBeGreaterThanOrEqual(stickyStack.action.bottom + 6)
  expect(stickyStack.actionOwnsCenter).toBe(true)
  expect(stickyStack.richTextOwnsCenter).toBe(true)

  await title.fill('Tôi đặt lại mật khẩu như thế nào?')
  await page.getByRole('button', { name: /Lưu bản nháp/ }).click()
  await expect(page.getByText('Đã lưu bản nháp.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tôi đặt lại mật khẩu như thế nào?' })).toBeVisible()
  await dismissToast()

  await clickWorkflow(publishButton)
  await expect(page.getByRole('dialog', { name: 'Xuất bản bản nháp r1' })).toContainText('hiển thị công khai ngay')
  await clickWorkflow(page.getByRole('dialog').getByRole('button', { name: 'Xuất bản ngay' }))
  await expect(page.getByText('Đã xuất bản nội dung lên trung tâm trợ giúp.')).toBeVisible()
  await expect(page.getByText('Đang công khai r1', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Xuất bản r1/ })).toHaveCount(0)
  await dismissToast()

  // Bài đang công khai vẫn sửa thẳng: lưu lần đầu mở bản nháp r2, bản r1 giữ nguyên.
  await expect(page.getByRole('button', { name: 'Tạo revision mới' })).toHaveCount(0)
  await title.fill('Đặt lại mật khẩu ProCV')
  await expect(page.getByRole('button', { name: /Lưu & xuất bản/ })).toBeVisible()
  await page.getByLabel('Tóm tắt thay đổi', { exact: true }).fill('Bổ sung bước xác minh và ảnh minh họa.')
  await clickWorkflow(page.getByRole('button', { name: /Lưu bản nháp/ }))
  await expect(page.getByText(/Đã tạo bản nháp mới/)).toBeVisible()
  await expect(page.getByText('Bản nháp r2', { exact: true })).toBeVisible()
  await expect(page.getByText('Đang công khai r1', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Xuất bản r2/ })).toBeVisible()
  await dismissToast()

  await clickWorkflow(page.getByRole('button', { name: /Hủy bản nháp/ }))
  await clickWorkflow(page.getByRole('dialog', { name: 'Hủy bản nháp' }).getByRole('button', { name: 'Hủy bản nháp' }))
  await expect(page.getByText('Đã hủy bản nháp. Bài giữ nguyên bản đang công khai.')).toBeVisible()
  await expect(page.getByText('Bản nháp r2', { exact: true })).toHaveCount(0)
  await expect(title).toHaveValue('Tôi đặt lại mật khẩu như thế nào?')
})
