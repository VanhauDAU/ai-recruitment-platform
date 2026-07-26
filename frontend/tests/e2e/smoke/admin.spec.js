import { expect, test } from '@playwright/test'
import { ADMIN_ROUTES } from '../../../src/app/router/admin/admin-routes.config.js'
import { mockPublicApi } from './helpers'

test('admin smoke: login loads and dashboard stays role-protected', async ({ page }) => {
  await mockPublicApi(page)
  await page.goto('/admin/app/login')
  await expect(page.getByRole('heading', { name: 'Đăng nhập quản trị' })).toBeVisible()
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((element) => element.clientWidth),
  )

  for (const route of ADMIN_ROUTES) {
    await page.goto(`/admin/app${route.segment}`)
    await expect(page).toHaveURL(/\/admin\/app\/login\?returnUrl=/)
  }
})

test('admin account management: filters, table actions and quick detail are responsive', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  const adminUser = {
    public_id: 'usr_root',
    email: 'root@example.com',
    full_name: 'System Admin',
    role: 'admin',
    status: 'active',
    admin_access: {
      is_superuser: true,
      permissions: [
        'account.view',
        'account.admin.view',
        'account.admin.invite',
        'account.profile.manage',
        'account.security.manage',
        'account.status.manage',
      ],
      memberships: [],
    },
  }
  const candidate = {
    public_id: 'usr_candidate',
    email: 'candidate@example.com',
    full_name: 'Nguyễn Minh Anh',
    phone: '0901234567',
    avatar_url: '',
    role: 'candidate',
    status: 'active',
    email_verified: true,
    two_factor_enabled: false,
    mfa_methods: { email: false, totp: false, backup_codes_remaining: 0 },
    has_usable_password: true,
    active_session_count: 1,
    last_activity_at: '2026-07-25T08:00:00Z',
    last_login: '2026-07-25T08:00:00Z',
    date_joined: '2026-07-01T08:00:00Z',
    updated_at: '2026-07-25T08:00:00Z',
    context: { kind: 'candidate', current_position: 'Frontend Developer' },
    admin_access: null,
    invitation: null,
  }
  await page.route('http://localhost:8000/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const body = path === '/api/auth/me/'
      ? adminUser
      : path === '/api/admin/accounts/summary/'
        ? { total: 1, active: 1, restricted: 0, unverified: 0, pending_admin: 0 }
        : path === '/api/admin/accounts/'
          ? { count: 1, next: null, previous: null, results: [candidate] }
          : path === '/api/privacy/consent/'
            ? { consent: { necessary: true, preferences: false, analytics: false, marketing: false } }
          : path === '/api/admin/departments/' || path === '/api/admin/roles/'
            ? []
            : {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/admin/app/accounts')
  await expect(page).toHaveURL('/admin/app/accounts')
  await expect.poll(() => pageErrors).toEqual([])
  await expect(page.getByRole('region', { name: 'Tổng quan tài khoản' })).toBeVisible()
  await expect(page.getByPlaceholder('Tìm theo tên, email hoặc mã tài khoản')).toBeVisible()
  await expect(page.getByText('Nguyễn Minh Anh')).toBeVisible()
  await page.getByRole('button', { name: 'Xem nhanh' }).click()
  const quickDrawer = page.getByLabel('Thông tin tài khoản')
  await expect(quickDrawer).toBeVisible()
  await expect(quickDrawer.getByText('Frontend Developer')).toBeVisible()
  const viewport = page.viewportSize()
  await expect.poll(async () => {
    const drawerBox = await quickDrawer.boundingBox()
    return Math.round(drawerBox.x + drawerBox.width)
  }).toBeLessThanOrEqual(viewport.width)
  await page.keyboard.press('Escape')
  await expect(quickDrawer).toBeHidden()
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((element) => element.clientWidth),
  )
})

test('admin invitation acceptance keeps MFA setup as a separate security step', async ({ page }) => {
  await mockPublicApi(page)
  await page.route('**/api/auth/admin-invitations/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const body = path.endsWith('/validate/')
      ? {
          email: 'new-admin@example.com',
          full_name: 'Admin mới',
          target_role: {
            name: 'Nhân viên kiểm duyệt',
            department: { name: 'Kiểm duyệt tin' },
          },
        }
      : {
          user_public_id: 'usr_new_admin',
        }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })

  await page.goto('/admin/app/invitation?token=signed-token')
  await expect(page).toHaveTitle('Hoàn tất tài khoản quản trị | ProCV')
  await expect(page.getByRole('heading', { name: 'Hoàn tất tài khoản quản trị' })).toBeVisible()
  await page.getByLabel('Mật khẩu mới').fill('StrongPass123')
  await page.getByLabel('Xác nhận mật khẩu').fill('StrongPass123')
  await page.getByRole('button', { name: 'Kích hoạt tài khoản' }).click()
  await expect(page.getByText('Tài khoản Admin đã sẵn sàng')).toBeVisible()
  await expect(page.getByText(/bật xác thực hai yếu tố sau trong phần Bảo mật/)).toBeVisible()
  await expect(page.getByText('Mã dự phòng')).toBeHidden()
})

test('admin password reset stays on the Admin portal', async ({ page }) => {
  await mockPublicApi(page)
  await page.route('**/api/auth/password-reset/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === 'GET') {
      expect(url.searchParams.get('portal')).toBe('admin')
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ email: 'moderator@example.com', role: 'admin' }),
      })
      return
    }
    expect(request.postDataJSON()).toMatchObject({
      token: 'admin-reset-token',
      portal: 'admin',
    })
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Đặt lại mật khẩu thành công.', role: 'admin' }),
    })
  })

  await page.goto('/admin/app/reset-password?token=admin-reset-token')
  await expect(page).toHaveTitle('Đặt lại mật khẩu quản trị | ProCV')
  await expect(page.getByRole('heading', { name: 'Đặt lại mật khẩu quản trị' })).toBeVisible()
  await page.getByLabel('Mật khẩu mới').fill('StrongPass123')
  await page.getByLabel('Nhập lại mật khẩu').fill('StrongPass123')
  await page.getByRole('button', { name: 'Đặt lại mật khẩu' }).click()
  await expect(page.getByRole('heading', { name: 'Đã đổi mật khẩu' })).toBeVisible()
  await expect(page.getByText(/xác minh MFA email/i)).toBeVisible()
})
