import { expect, test } from '@playwright/test'

const category = {
  public_id: 'pcat_career',
  name: 'Kiến thức nghề nghiệp',
  slug: 'kien-thuc-nghe-nghiep',
  description: '',
  seo_title: '',
  order: 1,
  is_active: true,
  post_count: 1,
}

function createPost(allowedActions, editorialState = 'draft') {
  const pending = editorialState.includes('pending')
  const post = {
    public_id: 'ps_other',
    title: 'Bài viết của đồng nghiệp khác',
    slug: 'bai-viet-cua-dong-nghiep',
    thumbnail_url: '',
    category,
    author: { public_id: 'usr_other', name: 'Đồng nghiệp', email: 'other@example.com' },
    editorial_state: editorialState,
    editorial_state_label: pending ? 'Chờ duyệt' : 'Nháp',
    completeness: { score: 80, missing_fields: [] },
    allowed_actions: allowedActions,
    view_count: 12,
    updated_at: '2026-07-27T09:00:00Z',
  }
  return {
    post,
    detail: {
      ...post,
      editable_version: {
        title: post.title,
        slug: post.slug,
        summary: 'Nội dung do một đồng nghiệp khác phụ trách.',
        thumbnail_url: '',
        thumbnail_storage_key: '',
        content: '<h2>Nội dung</h2><p>Thông tin bài viết.</p>',
        category,
        tags: [],
        related_job_category: null,
        seo_title: '',
        seo_description: '',
        status: pending ? 'pending' : 'draft',
        submitted_at: pending ? '2026-07-27T09:00:00Z' : null,
        edit_revision: 1,
        updated_at: post.updated_at,
      },
      published_version: null,
      history: [],
      created_at: post.updated_at,
    },
  }
}

async function mockBlogApi(page, permissions, allowedActions, editorialState = 'draft') {
  const { post, detail } = createPost(allowedActions, editorialState)
  const user = {
    public_id: 'usr_current',
    email: 'current@example.com',
    full_name: 'Nhân viên hiện tại',
    role: 'admin',
    status: 'active',
    admin_access: {
      is_superuser: false,
      permissions,
      memberships: [],
    },
  }
  await page.route('http://localhost:8000/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    let body = {}
    if (path === '/api/auth/refresh/') body = { access: 'e2e-access' }
    else if (path === '/api/auth/me/') body = user
    else if (path === '/api/blog/admin/posts/summary/') {
      body = {
        all: 1,
        draft: editorialState === 'draft' ? 1 : 0,
        pending: editorialState === 'pending' ? 1 : 0,
        published: 0,
        published_with_draft: 0,
        published_with_pending: editorialState === 'published_with_pending' ? 1 : 0,
        archived: 0,
      }
    } else if (path === '/api/blog/admin/posts/') {
      body = { count: 1, next: null, previous: null, results: [post] }
    } else if (path === '/api/blog/admin/posts/ps_other/') body = detail
    else if (path === '/api/blog/admin/categories/') body = [category]
    else if (path === '/api/blog/admin/tags/' || path === '/api/jobs/categories/') body = []
    else if (path === '/api/privacy/consent/') {
      body = { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
}

test('admin blog: publish permission can edit another employee article', async ({ page }) => {
  await mockBlogApi(
    page,
    ['blog.view', 'blog.publish'],
    ['edit', 'submit', 'return', 'publish', 'archive'],
    'pending',
  )

  await page.goto('/admin/app/blog')
  await expect(page.getByText('Bài viết của đồng nghiệp khác').filter({ visible: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tạo bài viết' })).toHaveCount(0)

  await page.goto('/admin/app/blog/ps_other/edit')
  await expect(page.getByLabel('Tiêu đề bài viết')).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Lưu ngay' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Văn bản thường' })).toBeEnabled()
  await page.getByRole('button', { name: 'Gửi duyệt lại' }).click()
  await expect(page.getByRole('dialog', { name: 'Gửi duyệt lại' })).toContainText(
    'Các thay đổi mới nhất sẽ được cập nhật trong hàng chờ duyệt',
  )

  await page.goto('/admin/app/blog/new')
  await expect(page).toHaveURL('/admin/app/access-denied')
})

test('admin blog: view-only permission sees another employee article in read-only mode', async ({ page }) => {
  await mockBlogApi(page, ['blog.view'], [])

  await page.goto('/admin/app/blog')
  await expect(page.getByText('Bài viết của đồng nghiệp khác').filter({ visible: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Không có quyền đổi trạng thái bài/ }).filter({ visible: true })).toBeDisabled()

  await page.goto('/admin/app/blog/ps_other/edit')
  await expect(page.getByText('Chỉ xem nội dung')).toBeVisible()
  await expect(page.getByLabel('Tiêu đề bài viết')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Lưu ngay' })).toHaveCount(0)
})
