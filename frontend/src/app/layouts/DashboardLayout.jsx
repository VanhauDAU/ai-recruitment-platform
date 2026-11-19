import { CloseOutlined } from '@ant-design/icons'
import { useIsMutating, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, ConfigProvider, Drawer, Layout } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { matchPath, Outlet, useLocation, useNavigate } from 'react-router'
import {
  canAccessAdminRoute,
  useAdminAccess,
} from '@/entities/account/admin-access'
import {
  adminAccountKeys,
  getAdminAccountSummary,
} from '@/entities/account/admin-account'
import { adminDashboardKeys, getAdminQueueSummary } from '@/entities/dashboard/admin-dashboard'
import { ANNOUNCEMENT_SURFACES } from '@/entities/content/announcement'
import { useSession } from '@/entities/account/session'
import { BrandLogo } from '@/entities/system/site-settings'
import { adminPath } from '@/shared/config/portals'
import { AnnouncementStrip } from '@/widgets/common/announcement-strip'
import { ADMIN_ROUTES } from '../router/admin/admin-routes.config'
import { ADMIN_NAVIGATION } from '../router/admin/admin-navigation.config'
import {
  buildAdminNavigation,
  findActiveAdminNavigation,
} from '../router/admin/admin-navigation'
import AdminNavigation from './AdminNavigation'
import AdminSidebarFooter from './AdminSidebarFooter'
import AdminTopbar from './AdminTopbar'
import EmployerWorkspaceLayout from './EmployerWorkspaceLayout'
import './admin-dashboard.css'

const { Sider, Content } = Layout

function AdminBrand({ collapsed = false, action = null }) {
  return (
    <div className={`admin-sider__brand ${collapsed ? 'admin-sider__brand--collapsed' : ''}`}>
      <BrandLogo
        className={collapsed ? 'justify-center' : 'min-w-0'}
        imageClassName={collapsed ? 'h-8 w-8 object-contain object-left' : 'h-8 max-w-[148px]'}
        textClassName="text-sm"
      />
      {!collapsed && <span className="admin-sider__product">ProCV - Quản trị</span>}
      {action}
    </div>
  )
}

function hasBadgeKey(nodes, badgeKeys) {
  return nodes.some((node) => (
    badgeKeys.includes(node.badgeKey)
    || (node.children && hasBadgeKey(node.children, badgeKeys))
  ))
}

function attachBadgeCounts(nodes, counts) {
  return nodes.map((node) => {
    const children = node.children
      ? attachBadgeCounts(node.children, counts)
      : undefined
    const own = node.badgeKey ? counts[node.badgeKey] : null
    const sum = (field) => children?.reduce((total, child) => total + Number(child[field] || 0), 0) || 0
    return {
      ...node,
      badgeCount: Number(own?.count || 0) + sum('badgeCount'),
      badgeOverdue: Number(own?.overdue || 0) + sum('badgeOverdue'),
      ...(children ? { children } : {}),
    }
  })
}

function queueBadgeCounts(summary) {
  const counts = Object.fromEntries(
    (summary?.queues || []).map(({ key, count, overdue }) => [key, { count, overdue }]),
  )
  counts.knowledge_overdue = { count: summary?.knowledge_review_overdue || 0, overdue: 0 }
  return counts
}

export default function DashboardLayout() {
  const { user, logout } = useSession()
  const adminAccess = useAdminAccess(user)
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const mainRef = useRef(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarPeek, setSidebarPeek] = useState(false)
  const [sidebarPeekGroup, setSidebarPeekGroup] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const availableRoutes = useMemo(() => user?.role === 'admin'
    ? ADMIN_ROUTES
      .filter(
        (route) => canAccessAdminRoute(route, adminAccess),
      )
      .map((route) => ({
        ...route,
        path: adminPath(route.segment),
      }))
    : [], [adminAccess, user?.role])
  const items = useMemo(
    () => availableRoutes.filter((route) => route.showInNav),
    [availableRoutes],
  )
  const navigation = useMemo(
    () => buildAdminNavigation(ADMIN_NAVIGATION, ADMIN_ROUTES, adminAccess),
    [adminAccess],
  )
  const usersSummaryParams = useMemo(() => ({ scope: 'users' }), [])
  const needsUsersSummary = hasBadgeKey(navigation, ['admin_invitations'])
  const usersSummary = useQuery({
    queryKey: adminAccountKeys.summary(usersSummaryParams),
    queryFn: ({ signal }) => getAdminAccountSummary(usersSummaryParams, { signal }),
    enabled: user?.role === 'admin' && needsUsersSummary,
    refetchInterval: 30_000,
    refetchOnWindowFocus: 'always',
    staleTime: 10_000,
  })
  const queueSummary = useQuery({
    queryKey: adminDashboardKeys.queues,
    queryFn: ({ signal }) => getAdminQueueSummary({ signal }),
    enabled: user?.role === 'admin',
    refetchInterval: 30_000,
    refetchOnWindowFocus: 'always',
    staleTime: 10_000,
  })
  // Approving or rejecting anything should update the badges right away, not
  // on the next poll: refresh the queue counts whenever writes settle.
  const queryClient = useQueryClient()
  const mutating = useIsMutating()
  const wasMutating = useRef(false)
  useEffect(() => {
    if (wasMutating.current && !mutating) {
      queryClient.invalidateQueries({ queryKey: adminDashboardKeys.queues })
    }
    wasMutating.current = mutating > 0
  }, [mutating, queryClient])
  const navigationWithBadges = useMemo(() => attachBadgeCounts(navigation, {
    ...queueBadgeCounts(queueSummary.data),
    admin_invitations: { count: usersSummary.data?.queues?.pending_admin_invitations, overdue: 0 },
  }), [navigation, queueSummary.data, usersSummary.data])
  const currentRoute = [...availableRoutes]
    .sort((left, right) => right.path.length - left.path.length)
    .find((item) => matchPath({ path: item.path, end: true }, pathname))
  const activeLeaf = findActiveAdminNavigation(navigation, pathname, search)
  const currentTitle = currentRoute?.segment.includes(':')
    ? currentRoute.title
    : activeLeaf?.label || currentRoute?.title
  const breadcrumb = !activeLeaf
    ? []
    : currentTitle === activeLeaf.label
      ? activeLeaf.breadcrumb.slice(0, -1)
      : activeLeaf.breadcrumb
  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true })
    setMobileNavOpen(false)
    setSidebarPeek(false)
  }, [pathname])

  if (user?.role === 'employer') return <EmployerWorkspaceLayout />

  return (
    <ConfigProvider
      theme={{
        token: {
          borderRadius: 10,
          colorText: '#0f172a',
          colorTextSecondary: '#64748b',
          colorBorder: '#e2e8f0',
          controlHeight: 40,
        },
      }}
    >
      <Layout className="admin-shell">
        <a className="admin-skip-link" href="#admin-main">Bỏ qua điều hướng</a>
        <Sider
          className="admin-sider"
          width={280}
          collapsedWidth={80}
          collapsed={sidebarCollapsed}
          trigger={null}
          onMouseEnter={() => sidebarCollapsed && setSidebarPeek(true)}
          onFocusCapture={() => sidebarCollapsed && setSidebarPeek(true)}
        >
          <AdminBrand collapsed={sidebarCollapsed} />
          <AdminNavigation
            navigation={navigationWithBadges}
            pathname={pathname}
            search={search}
            navigate={navigate}
            collapsed={sidebarCollapsed}
            onRequestExpand={(key) => {
              setSidebarPeekGroup(key)
              setSidebarPeek(true)
            }}
          />
          {sidebarCollapsed && sidebarPeek && (
            <div
              className="admin-sider__peek"
              onMouseLeave={() => setSidebarPeek(false)}
            >
              <AdminNavigation
                navigation={navigationWithBadges}
                pathname={pathname}
                search={search}
                navigate={navigate}
                requestedOpenKey={sidebarPeekGroup}
                onNavigate={() => setSidebarPeek(false)}
              />
            </div>
          )}
          <AdminSidebarFooter user={user} logout={logout} collapsed={sidebarCollapsed} />
        </Sider>

        <Drawer
          open={mobileNavOpen}
          placement="left"
          size={320}
          closable={false}
          onClose={() => setMobileNavOpen(false)}
          styles={{ body: { padding: 0, background: '#ffffff' } }}
        >
          <div className="admin-sider admin-sider--drawer">
            <AdminBrand
              action={(
                <Button
                  aria-label="Đóng điều hướng"
                  className="admin-sider__close"
                  icon={<CloseOutlined />}
                  onClick={() => setMobileNavOpen(false)}
                  type="text"
                />
              )}
            />
            <AdminNavigation
              navigation={navigationWithBadges}
              pathname={pathname}
              search={search}
              navigate={navigate}
              mobile
              onNavigate={() => setMobileNavOpen(false)}
            />
            <AdminSidebarFooter user={user} logout={logout} onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </Drawer>

        <Layout className="!min-w-0 !bg-transparent">
          <AdminTopbar
            user={user}
            isSuperuser={Boolean(adminAccess?.isSuperuser)}
            breadcrumb={breadcrumb}
            title={currentTitle}
            queueSummary={queueSummary.data}
            sidebarCollapsed={sidebarCollapsed}
            onOpenMobileNav={() => setMobileNavOpen(true)}
            onToggleSidebar={() => {
              setSidebarPeek(false)
              setSidebarCollapsed((value) => !value)
            }}
          />
          <AnnouncementStrip
            surface={ANNOUNCEMENT_SURFACES.ADMIN_WORKSPACE}
            path={pathname}
            stickyOffset="var(--admin-topbar-height)"
          />
          <Content>
            <div id="admin-main" ref={mainRef} tabIndex={-1} className="admin-main">
              <Outlet context={{ availableRoutes: items, adminAccess }} />
            </div>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  )
}
