import { expect, test } from '@playwright/test'

test('admin blog: list is responsive and article slug is server-owned', async ({ page }, testInfo) => {
  const adminTags = [
    { public_id: 'ptag_sales', name: 'Sales', slug: 'sales', is_active: true, post_count: 2, working_copy_count: 0, usage_count: 2 },
    { public_id: 'ptag_business', name: 'Nhân viên kinh doanh', slug: 'nhan-vien-kinh-doanh', is_active: true, post_count: 1, working_copy_count: 0, usage_count: 1 },
    { public_id: 'ptag_experience', name: 'Kinh nghiệm Sales', slug: 'kinh-nghiem-sales', is_active: true, post_count: 0, working_copy_count: 0, usage_count: 0 },
  ]
  const adminPins = [{
    public_id: 'ppin_interview',
    placement: 'support_docs',
    post_public_id: 'ps_interview',
    title: 'Kinh nghiệm phỏng vấn',
    slug: 'kinh-nghiem-phong-van',
    order: 1,
    is_active: true,
  }]
  const adminUser = {
    public_id: 'usr_editor',
    email: 'editor@example.com',
    full_name: 'Biên tập viên',
    role: 'admin',
    status: 'active',
    admin_access: {
      is_superuser: false,
      permissions: ['blog.view', 'blog.manage', 'blog.publish'],
      memberships: [],
    },
  }
  const post = {
    public_id: 'ps_sales',
    title: 'Nhân viên Sales là gì?',
    slug: 'nhan-vien-sales-la-gi',
    thumbnail_url: '',
    category: { public_id: 'pcat_jobs', name: 'Kiến thức nghề nghiệp', slug: 'kien-thuc-nghe-nghiep' },
    author: { public_id: 'usr_editor', name: 'Biên tập viên', email: 'editor@example.com' },
    editorial_state: 'draft',
    editorial_state_label: 'Nháp',
    completeness: { score: 45, missing_fields: [] },
    allowed_actions: ['edit', 'submit', 'archive', 'discard_draft'],
    view_count: 0,
    updated_at: '2026-07-27T08:00:00Z',
  }
  const publishedPost = {
    public_id: 'ps_interview',
    title: 'Kinh nghiệm phỏng vấn giúp bạn tự tin hơn',
    slug: 'kinh-nghiem-phong-van',
    thumbnail_url: '',
    category: post.category,
    author: post.author,
    editorial_state: 'published',
    editorial_state_label: 'Đã xuất bản',
    completeness: { score: 100, missing_fields: [] },
    allowed_actions: ['edit', 'submit', 'archive'],
    view_count: 128,
    updated_at: '2026-07-27T07:00:00Z',
  }
  const adminCategories = [
    { ...post.category, description: '', seo_title: '', order: 1, is_active: true, post_count: 1 },
    { public_id: 'pcat_career', name: 'Định hướng nghề nghiệp', slug: 'dinh-huong-nghe-nghiep', description: '', seo_title: '', order: 2, is_active: true, post_count: 0 },
  ]
  const postDetail = {
    ...post,
    editable_version: {
      title: post.title,
      slug: post.slug,
      summary: 'Tổng quan đầy đủ về nghề Sales và lộ trình phát triển.',
      thumbnail_url: '',
      thumbnail_storage_key: '',
      content: '<h2>Sales là gì?</h2><p>Nội dung bài viết.</p>',
      category: post.category,
      tags: [adminTags[0]],
      related_job_category: null,
      seo_title: '',
      seo_description: '',
      status: 'draft',
      submitted_at: null,
      edit_revision: 1,
      updated_at: post.updated_at,
    },
    published_version: null,
    history: [],
    created_at: post.updated_at,
  }

  await page.route('http://localhost:8000/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    let body = {}
    if (path === '/api/auth/me/') body = adminUser
    else if (path === '/api/blog/admin/posts/summary/') {
      body = {
        all: 2,
        draft: post.editorial_state === 'draft' ? 1 : 0,
        pending: 0,
        published: publishedPost.editorial_state === 'published' ? 1 : 0,
        published_with_draft: 0,
        published_with_pending: 0,
        archived: [post, publishedPost].filter((item) => item.editorial_state === 'archived').length,
      }
    } else if (path === '/api/blog/admin/posts/') {
      body = { count: 2, next: null, previous: null, results: [post, publishedPost] }
    } else if (['/api/blog/admin/posts/ps_sales/archive/', '/api/blog/admin/posts/ps_interview/archive/'].includes(path)) {
      const payload = route.request().postDataJSON()
      expect(payload.note).toBe('Nội dung cần rà soát lại')
      const targetPost = path.includes('ps_sales') ? post : publishedPost
      Object.assign(targetPost, {
        editorial_state: 'archived',
        editorial_state_label: 'Đã gỡ',
        allowed_actions: ['edit', 'restore'],
        updated_at: '2026-07-27T09:00:00Z',
      })
      body = targetPost
    } else if (path === '/api/blog/admin/posts/ps_sales/') {
      body = postDetail
    } else if (path === '/api/blog/admin/categories/reorder/') {
      const ids = route.request().postDataJSON().public_ids
      adminCategories.sort((left, right) => ids.indexOf(left.public_id) - ids.indexOf(right.public_id))
      adminCategories.forEach((category, index) => { category.order = index + 1 })
      body = { public_ids: ids }
      await new Promise((resolve) => setTimeout(resolve, 250))
    } else if (path === '/api/blog/admin/categories/') {
      body = adminCategories
    } else if (path === '/api/blog/admin/tags/') {
      if (route.request().method() === 'POST') {
        const created = { public_id: 'ptag_career_sales', name: 'Nghề Sales', slug: 'nghe-sales', is_active: true, post_count: 0, working_copy_count: 0, usage_count: 0 }
        adminTags.push(created)
        body = created
      } else body = adminTags
    } else if (path === '/api/blog/admin/uploads/') {
      const mediaItem = {
          public_id: 'pmedia_sales',
          url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect width="400" height="300" fill="%23dcfce7"/%3E%3C/svg%3E',
          original_name: 'nghe-sales.webp',
          content_type: 'image/webp',
          size: 15360,
          uploaded_by: 'Biên tập viên',
          created_at: '2026-07-27T08:00:00Z',
      }
      body = route.request().method() === 'POST'
        ? { ...mediaItem, public_id: 'pmedia_new', original_name: 'anh-moi.png', content_type: 'image/png' }
        : { count: 1, next: null, previous: null, results: [mediaItem] }
    } else if (path === '/api/blog/admin/pins/reorder/') {
      const ids = route.request().postDataJSON().public_ids
      adminPins.sort((left, right) => ids.indexOf(left.public_id) - ids.indexOf(right.public_id))
      adminPins.forEach((pin, index) => { pin.order = index + 1 })
      body = { public_ids: ids }
      await new Promise((resolve) => setTimeout(resolve, 250))
    } else if (path === '/api/blog/admin/pins/') {
      if (route.request().method() === 'POST') {
        const payload = route.request().postDataJSON()
        const created = {
          public_id: 'ppin_sales',
          placement: 'support_docs',
          post_public_id: payload.post_public_id,
          title: post.title,
          slug: post.slug,
          order: payload.order,
          is_active: true,
        }
        adminPins.push(created)
        body = created
      } else body = adminPins
    } else if (path === '/api/jobs/categories/') body = []
    else if (path === '/api/privacy/consent/') {
      body = { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/admin/app/blog')
  await expect(page.getByRole('heading', { name: 'Cẩm nang nghề nghiệp' })).toBeVisible()
  await expect(page.getByText('Nhân viên Sales là gì?').filter({ visible: true })).toBeVisible()
  await expect(page.getByText('/blog/nhan-vien-sales-la-gi')).toHaveCount(1)
  await expect(page.getByRole('button', { name: /Đổi trạng thái bài “Kinh nghiệm phỏng vấn/ }).filter({ visible: true })).toBeVisible()
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((element) => element.clientWidth),
  )

  await page.getByRole('checkbox', { name: 'Chọn bài “Nhân viên Sales là gì?”' }).filter({ visible: true }).check()
  await page.getByRole('checkbox', { name: 'Chọn bài “Kinh nghiệm phỏng vấn giúp bạn tự tin hơn”' }).filter({ visible: true }).check()
  await expect(page.getByText('Đã chọn 2 bài viết')).toBeVisible()

  if (testInfo.project.name === 'mobile-chromium') {
    await page.getByRole('button', { name: 'Đổi trạng thái 2 bài' }).click()
    await page.getByRole('menuitem', { name: 'Ẩn bài viết' }).click()
  } else {
    const publishedDragHandle = page.getByRole('button', { name: 'Kéo bài “Kinh nghiệm phỏng vấn giúp bạn tự tin hơn” để đổi trạng thái' }).filter({ visible: true })
    const dragHandleBox = await publishedDragHandle.boundingBox()
    await page.mouse.move(dragHandleBox.x + dragHandleBox.width / 2, dragHandleBox.y + dragHandleBox.height / 2)
    await page.mouse.down()
    const dragPointer = {
      x: dragHandleBox.x + dragHandleBox.width / 2 + 10,
      y: dragHandleBox.y + dragHandleBox.height / 2 + 10,
    }
    await page.mouse.move(dragPointer.x, dragPointer.y, { steps: 4 })
    const dragOverlay = page.getByTestId('post-status-drag-overlay')
    await expect(dragOverlay).toBeVisible()
    await expect(dragOverlay).toContainText('2 bài viết đã chọn')
    const overlayZIndex = await dragOverlay.evaluate((element) => Number(getComputedStyle(element.parentElement).zIndex))
    const dropTrayZIndex = await page.getByTestId('post-status-drop-tray').evaluate((element) => Number(getComputedStyle(element).zIndex))
    expect(overlayZIndex).toBeGreaterThan(dropTrayZIndex)
    await expect.poll(async () => {
      const overlayBox = await dragOverlay.boundingBox()
      return {
        x: Math.round(overlayBox.x + overlayBox.width / 2 - dragPointer.x),
        y: Math.round(overlayBox.y + overlayBox.height / 2 - dragPointer.y),
      }
    }).toEqual({ x: 0, y: 0 })
    const archiveDropZone = page.getByTestId('post-status-drop-archive')
    await expect(archiveDropZone).toBeVisible()
    const archiveDropBox = await archiveDropZone.boundingBox()
    await page.mouse.move(archiveDropBox.x + archiveDropBox.width / 2, archiveDropBox.y + archiveDropBox.height / 2, { steps: 10 })
    await expect(archiveDropZone).toContainText('Thả chuột để chọn')
    await expect(dragOverlay).toContainText('Đã nhận: Ẩn bài viết')
    await page.mouse.up()
  }
  const archiveDialog = page.getByRole('dialog', { name: 'Ẩn bài viết?' })
  await expect(archiveDialog).toBeVisible()
  await expect(archiveDialog).toContainText('2 bài viết đã chọn')
  await expect(archiveDialog).toContainText('Nhân viên Sales là gì?')
  await expect(archiveDialog).toContainText('Kinh nghiệm phỏng vấn giúp bạn tự tin hơn')
  await expect(archiveDialog).toContainText('Đã gỡ')
  await archiveDialog.getByLabel('Lý do').fill('Nội dung cần rà soát lại')
  await archiveDialog.getByRole('button', { name: 'Ẩn bài viết' }).click()
  await expect(page.getByText('Đã ẩn 2 bài viết.')).toBeVisible()
  await expect(page.getByText('Đã gỡ', { exact: true }).filter({ visible: true }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Tạo bài viết' }).click()
  await expect(page).toHaveURL('/admin/app/blog/new')
  await expect(page.getByLabel('Tiêu đề bài viết')).toBeVisible()
  await expect(page.getByLabel('Slug URL')).toHaveCount(0)
  await expect(page.getByText(/Đường dẫn ngắn gọn được hệ thống tự tạo/)).toBeVisible()
  await expect(page.getByText('Tiêu đề bài viết là H1 duy nhất')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Văn bản thường' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tiêu đề cấp 2' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tiêu đề cấp 3' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tiêu đề cấp 1' })).toHaveCount(0)
  await expect(page.locator('.company-rich-editor__toolbar')).toHaveCSS('position', 'sticky')
  await page.getByRole('button', { name: 'Chèn ảnh từ kho' }).click()
  await expect(page.getByRole('dialog', { name: 'Chèn hình ảnh' })).toBeVisible()
  await expect(page.getByText('nghe-sales.webp')).toBeVisible()
  await page.getByRole('option', { name: /nghe-sales.webp/ }).click()
  await page.getByLabel('Mô tả ảnh (alt text)').fill('Minh họa nghề Sales')
  await page.getByRole('button', { name: 'Chèn vào bài viết' }).click()
  const contentImage = page.locator('.company-rich-editor__content img')
  await expect(contentImage).toHaveAttribute('alt', 'Minh họa nghề Sales')
  await contentImage.click()
  await expect(page.getByRole('toolbar', { name: 'Tùy chỉnh hình ảnh đang chọn' })).toBeVisible()
  await page.getByRole('button', { name: '50%' }).click()
  await expect(contentImage).toHaveAttribute('data-width', '50%')
  await page.getByRole('button', { name: 'Thay ảnh' }).click()
  await page.getByRole('tab', { name: 'Tải ảnh mới' }).click()
  await page.locator('.rich-image-library-modal input[type="file"]').setInputFiles({ name: 'anh-moi.png', mimeType: 'image/png', buffer: Buffer.from('mock-image') })
  await expect(page.getByText('Đã tải ảnh lên kho hình ảnh.')).toBeVisible()
  await expect(page.getByRole('option', { name: /anh-moi\.png/ })).toBeVisible()
  await page.getByRole('button', { name: 'Chèn vào bài viết' }).click()
  await page.getByRole('button', { name: 'Chèn bảng tùy chỉnh' }).click()
  await page.getByLabel('Số hàng').fill('4')
  await page.getByLabel('Số cột').fill('5')
  await page.getByRole('button', { name: 'Chèn bảng 4 × 5' }).click()
  const contentTable = page.locator('.company-rich-editor__content table')
  await expect(contentTable.locator('tr')).toHaveCount(4)
  await expect(contentTable.locator('tr').first().locator('th, td')).toHaveCount(5)
  await contentTable.locator('th, td').first().click()
  await expect(page.getByRole('toolbar', { name: 'Tùy chỉnh bảng đang chọn' })).toBeVisible()
  await page.getByRole('button', { name: 'Thêm hàng phía dưới' }).click()
  await expect(contentTable.locator('tr')).toHaveCount(5)
  await page.getByRole('button', { name: 'Thêm cột bên phải' }).click()
  await expect(contentTable.locator('tr').first().locator('th, td')).toHaveCount(6)
  await page.getByRole('button', { name: 'Tạo bản nháp' }).click()
  await expect(page.getByText(/Vui lòng hoàn thiện:/)).toBeVisible()
  const tagPicker = page.getByLabel('Thẻ bài viết')
  await tagPicker.fill('nghề sales')
  await expect(page.getByText('Sales', { exact: true }).last()).toBeVisible()
  await expect(page.getByText('Nhân viên kinh doanh', { exact: true })).toBeVisible()
  await page.getByText('Tạo thẻ mới “Nghề Sales”').click()
  await expect(page.locator('.ant-select-selection-item-content').filter({ hasText: /^Nghề Sales$/ })).toBeVisible()

  await page.goto('/admin/app/blog')
  await page.getByRole('tab', { name: 'Thẻ' }).click()
  await expect(page).toHaveURL('/admin/app/blog?tab=tags')
  await expect(page.getByRole('heading', { name: 'Quản lý thẻ bài viết' })).toBeVisible()
  await expect(page.getByText('Kinh nghiệm Sales', { exact: true }).filter({ visible: true })).toBeVisible()

  await page.getByRole('tab', { name: 'Danh mục' }).click()
  const categoryPanel = page.getByRole('tabpanel', { name: 'Danh mục' })
  await expect(categoryPanel.getByRole('button', { name: /Kéo để sắp xếp danh mục/ })).toHaveCount(2)
  await expect(categoryPanel.getByRole('button', { name: /Đưa danh mục (lên|xuống)/ })).toHaveCount(0)
  const firstCategoryHandle = categoryPanel.getByRole('button', { name: 'Kéo để sắp xếp danh mục Kiến thức nghề nghiệp' })
  const secondCategoryHandle = categoryPanel.getByRole('button', { name: 'Kéo để sắp xếp danh mục Định hướng nghề nghiệp' })
  const sourceBox = await firstCategoryHandle.boundingBox()
  const targetBox = await secondCategoryHandle.boundingBox()
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 8 })
  await expect(page.getByTestId('category-drag-overlay')).toBeVisible()
  await page.mouse.up()
  await expect(categoryPanel.locator('tbody tr').first()).toContainText('Định hướng nghề nghiệp')
  await expect(categoryPanel.locator('.ant-spin-spinning')).toHaveCount(0)
  await expect(page.getByText('Đã cập nhật thứ tự danh mục.')).toBeVisible()

  await page.getByRole('tab', { name: 'Bài ghim' }).click()
  await expect(page).toHaveURL('/admin/app/blog?tab=pins')
  const pinPanel = page.getByRole('tabpanel', { name: 'Bài ghim' })
  const pinSelect = pinPanel.getByRole('combobox')
  await pinSelect.fill('Nhân viên Sales là gì?')
  await pinSelect.press('Enter')
  await page.getByRole('button', { name: 'Ghim bài' }).click()
  await expect(page.getByText('Đã ghim bài viết.')).toBeVisible()
  await expect(pinPanel.getByRole('cell', { name: 'Nhân viên Sales là gì?', exact: true })).toBeVisible()
  await expect(pinPanel.getByRole('button', { name: /Kéo để sắp xếp bài ghim/ })).toHaveCount(2)
  await expect(pinPanel.getByRole('button', { name: /Đưa bài ghim (lên|xuống)/ })).toHaveCount(0)
  const firstPinHandle = pinPanel.getByRole('button', { name: 'Kéo để sắp xếp bài ghim Kinh nghiệm phỏng vấn' })
  const secondPinHandle = pinPanel.getByRole('button', { name: 'Kéo để sắp xếp bài ghim Nhân viên Sales là gì?' })
  const firstPinBox = await firstPinHandle.boundingBox()
  const secondPinBox = await secondPinHandle.boundingBox()
  await page.mouse.move(firstPinBox.x + firstPinBox.width / 2, firstPinBox.y + firstPinBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(secondPinBox.x + secondPinBox.width / 2, secondPinBox.y + secondPinBox.height / 2, { steps: 8 })
  await expect(page.getByTestId('pin-drag-overlay')).toBeVisible()
  await page.mouse.up()
  await expect(pinPanel.locator('tbody tr').first()).toContainText('Nhân viên Sales là gì?')
  await expect(pinPanel.locator('.ant-spin-spinning')).toHaveCount(0)
  await expect(page.getByText('Đã cập nhật thứ tự bài ghim.')).toBeVisible()

  await page.goto('/admin/app/blog/ps_sales/edit')
  await expect(page.getByText('/blog/nhan-vien-sales-la-gi', { exact: true }).first()).toBeVisible()
  await expect(page.locator('#admin-main').getByText('Biên tập viên', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Sapo / mô tả ngắn')).toHaveValue('Tổng quan đầy đủ về nghề Sales và lộ trình phát triển.')
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((element) => element.clientWidth),
  )
})
