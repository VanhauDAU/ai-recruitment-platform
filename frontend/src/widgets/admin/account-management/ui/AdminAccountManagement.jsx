import {
  AuditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DisconnectOutlined,
  LockOutlined,
  MailOutlined,
  SyncOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Form, Tabs } from 'antd'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  adminAccountKeys,
  getAdminAccounts,
  getAdminAccountSummary,
  updateAdminAccount,
} from '@/entities/account/admin-account'
import { useAdminAccess } from '@/entities/account/admin-access'
import {
  adminCompanyDomainClaimKeys,
  getAdminCompanyDomainClaimSummary,
} from '@/entities/company/admin-employer-verification'
import { useSession } from '@/entities/account/session'
import { AdminCompanyDomainReview } from '@/features/admin/company/review-company-domain'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { getIntlLocale, m } from '@/shared/config/i18n'
import { adminPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import AccountEditModal from './AccountEditModal'
import AccountList from './AccountList'
import AccountQuickDrawer from './AccountQuickDrawer'
import InvitationPanel from './InvitationPanel'
import VerificationQueuePanel from './VerificationQueuePanel'
import {
  ACCOUNT_QUERY_KEYS,
  DEFAULT_FILTERS,
  filtersFromQuery,
  INVITATION_QUERY_KEYS,
  PAGE_SIZES,
  pageSizeFromQuery,
  queryParams,
  SIMPLE_FILTER_KEYS,
  VERIFICATION_QUERY_KEYS,
} from '../model/account-query'
import { activeRecruiterSegment, applyRecruiterSegment, RECRUITER_SEGMENTS } from '../model/recruiter-segments'
import '../admin-account-management.css'

const EMPTY_PAGE = { count: 0, results: [] }
const formatCount = (value) => Number(value || 0).toLocaleString(getIntlLocale())

const SEGMENT_ICONS = {
  all: <TeamOutlined />,
  admin_queue: <AuditOutlined />,
  overdue: <ClockCircleOutlined />,
  resubmission: <SyncOutlined />,
  companyless: <DisconnectOutlined />,
  restricted: <LockOutlined />,
}
const USER_TILES = [
  { value: 'all', label: m.admin_account_list_tile_total(), metric: 'total', icon: <TeamOutlined /> },
  { value: 'active', label: m.admin_account_list_tile_active(), metric: 'active', icon: <CheckCircleOutlined /> },
  { value: 'restricted', label: m.admin_account_list_tile_restricted(), metric: 'restricted', icon: <LockOutlined /> },
  { value: 'unverified', label: m.admin_account_list_tile_unverified(), metric: 'unverified', icon: <MailOutlined /> },
]
// Quick chips: user chips each set one filter; recruiter chips pick a next action.
const USER_CHIPS = [
  { value: 'pending', label: m.admin_account_list_chip_pending(), tone: 'sky', filters: { status: 'pending' } },
  { value: 'session', label: m.admin_account_list_chip_session(), tone: 'emerald', filters: { has_active_session: 'true' } },
]
const RECRUITER_CHIPS = [
  { value: 'verification_review', label: m.admin_recruiter_list_chip_review(), tone: 'amber' },
  { value: 'awaiting_submission', label: m.admin_recruiter_list_chip_submission(), tone: 'slate' },
  { value: 'awaiting_onboarding', label: m.admin_recruiter_list_chip_onboarding(), tone: 'slate' },
]

function userTile(filters) {
  if (filters.status === 'active' && !filters.email_verified) return 'active'
  if (filters.status === 'inactive,banned') return 'restricted'
  if (filters.email_verified === 'false' && !filters.status) return 'unverified'
  return filters.status || filters.email_verified ? '' : 'all'
}

function QueueTabLabel({ children, count }) {
  return <span>{children}<Badge className="ml-2" count={count || 0} overflowCount={999} /></span>
}

export default function AdminAccountManagement({ scope = 'accounts' }) {
  const recruiterScope = scope === 'recruiters'
  const apiScope = recruiterScope ? 'recruiters' : 'users'
  const { user } = useSession()
  const { isSuperuser } = useAdminAccess(user)
  // Tài khoản quản trị và lời mời quản trị chỉ dành cho superuser.
  const canManageAdmins = !recruiterScope && isSuperuser
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [editForm] = Form.useForm()

  const accountTabs = useMemo(() => {
    if (recruiterScope) return ['employer']
    return canManageAdmins ? ['all', 'candidate', 'admin'] : ['candidate']
  }, [canManageAdmins, recruiterScope])
  const requestedTab = searchParams.get('tab') || accountTabs[0]
  const allowedTabs = [
    ...accountTabs,
    ...(recruiterScope ? ['verification', 'domain-verification'] : []),
    ...(canManageAdmins ? ['invitations'] : []),
  ]
  const activeTab = allowedTabs.includes(requestedTab) ? requestedTab : accountTabs[0]

  const [filters, setFilters] = useState(() => filtersFromQuery(searchParams))
  const page = Number(searchParams.get('page') || 1)
  const pageSize = pageSizeFromQuery(searchParams)
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [editingAccount, setEditingAccount] = useState(null)
  const [saving, setSaving] = useState(false)
  const deferredSearch = useDeferredValue(filters.q.trim())
  const params = useMemo(
    () => queryParams(apiScope, activeTab, filters, deferredSearch, page, pageSize),
    [activeTab, apiScope, deferredSearch, filters, page, pageSize],
  )
  const summaryParams = useMemo(() => ({ scope: apiScope }), [apiScope])
  const summaryQuery = useQuery({
    queryKey: adminAccountKeys.summary(summaryParams),
    queryFn: ({ signal }) => getAdminAccountSummary(summaryParams, { signal }),
  })
  const domainSummaryQuery = useQuery({
    queryKey: adminCompanyDomainClaimKeys.summary,
    queryFn: ({ signal }) => getAdminCompanyDomainClaimSummary({ signal }),
    enabled: recruiterScope,
    refetchInterval: 10_000,
    refetchOnWindowFocus: 'always',
    staleTime: 0,
  })
  const accountsQuery = useQuery({
    queryKey: adminAccountKeys.list(params),
    queryFn: ({ signal }) => getAdminAccounts(params, { signal }),
    enabled: accountTabs.includes(activeTab),
    // Keep the rows on screen while the next page, filter or order loads.
    placeholderData: keepPreviousData,
  })

  const summary = summaryQuery.data || {}
  const accounts = accountsQuery.data || EMPTY_PAGE
  const metrics = activeTab === 'all' ? summary.totals : summary.by_role?.[activeTab]
  const tileCount = (value) => (summaryQuery.data ? formatCount(value) : undefined)

  useEffect(() => {
    const defaultTab = accountTabs[0]
    if (requestedTab === activeTab || (!searchParams.get('tab') && activeTab === defaultTab)) {
      return
    }
    const next = new URLSearchParams(searchParams)
    if (activeTab === defaultTab) next.delete('tab')
    else next.set('tab', activeTab)
    setSearchParams(next, { replace: true })
  }, [
    accountTabs,
    activeTab,
    requestedTab,
    searchParams,
    setSearchParams,
  ])

  useEffect(() => {
    setFilters(filtersFromQuery(searchParams))
  }, [searchParams])

  const syncQuery = (tab, nextFilters, nextPage, { replace = false } = {}) => {
    const next = new URLSearchParams(searchParams)
    if (tab === accountTabs[0]) next.delete('tab')
    else next.set('tab', tab)
    SIMPLE_FILTER_KEYS.forEach((key) => {
      const value = typeof nextFilters[key] === 'string'
        ? nextFilters[key].trim()
        : nextFilters[key]
      if (
        value === ''
        || value == null
        || (key === 'ordering' && value === DEFAULT_FILTERS.ordering)
      ) next.delete(key)
      else next.set(key, String(value))
    })
    const rangePairs = [
      ['created_range', 'created_from', 'created_to'],
      ['last_login_range', 'last_login_from', 'last_login_to'],
    ]
    rangePairs.forEach(([filterKey, fromKey, toKey]) => {
      const range = nextFilters[filterKey]
      if (range?.length === 2) {
        next.set(fromKey, range[0].format('YYYY-MM-DD'))
        next.set(toKey, range[1].format('YYYY-MM-DD'))
      } else {
        next.delete(fromKey)
        next.delete(toKey)
      }
    })
    if (nextPage > 1) next.set('page', String(nextPage))
    else next.delete('page')
    setSearchParams(next, { replace })
  }

  const changeTab = (key) => {
    const next = new URLSearchParams(searchParams)
    if (key === accountTabs[0]) next.delete('tab')
    else next.set('tab', key)
    if (!accountTabs.includes(key)) ACCOUNT_QUERY_KEYS.forEach((queryKey) => next.delete(queryKey))
    if (key !== 'invitations') {
      INVITATION_QUERY_KEYS.forEach((queryKey) => next.delete(queryKey))
    }
    if (key !== 'verification') {
      VERIFICATION_QUERY_KEYS.forEach((queryKey) => next.delete(queryKey))
      next.delete('company')
    }
    setSearchParams(next)
  }

  const changeFilters = (next) => {
    setFilters(next)
    syncQuery(activeTab, next, 1)
  }

  const selectSegment = (key) => changeFilters(applyRecruiterSegment(filters, key))

  const quickValue = recruiterScope
    ? (RECRUITER_CHIPS.some((chip) => chip.value === filters.next_action) ? filters.next_action : '')
    : USER_CHIPS.find((chip) => Object.entries(chip.filters).every(([key, value]) => filters[key] === value))?.value || ''
  const selectQuick = (value) => {
    if (recruiterScope) return changeFilters({ ...filters, next_action: value })
    const cleared = {
      ...filters,
      has_active_session: '',
      status: filters.status === 'pending' ? '' : filters.status,
    }
    return changeFilters({ ...cleared, ...USER_CHIPS.find((chip) => chip.value === value)?.filters })
  }

  const changePageSize = (size) => {
    const next = new URLSearchParams(searchParams)
    if (size === PAGE_SIZES[0]) next.delete('page_size')
    else next.set('page_size', String(size))
    next.delete('page')
    setSearchParams(next)
  }

  const listOrigin = {
    origin: {
      pathname: location.pathname,
      search: location.search,
      label: recruiterScope ? 'Danh sách nhà tuyển dụng' : 'Danh sách người dùng',
    },
  }
  const stepQuickView = (offset) => {
    const rows = accounts.results
    const index = rows.findIndex((row) => row.public_id === selectedAccount?.public_id)
    const next = rows[(index + offset + rows.length) % rows.length]
    if (next) setSelectedAccount(next)
  }

  const applyUserTile = (kind) => {
    const next = {
      ...filters,
      status: '',
      email_verified: '',
      company_state: '',
    }
    if (kind === 'active') next.status = 'active'
    if (kind === 'restricted') next.status = 'inactive,banned'
    if (kind === 'unverified') next.email_verified = 'false'
    changeFilters(next)
  }

  const openDetail = (account, tab = '') => {
    const recruiter = recruiterScope || account.role === 'employer'
    const base = recruiter ? '/recruiters' : '/accounts'
    navigate(`${adminPath(`${base}/${account.public_id}`)}${tab ? `?tab=${tab}` : ''}`, {
      state: listOrigin,
    })
  }

  const canManageAccount = (account) => isSuperuser || account.role !== 'admin'
  const openEdit = (account) => {
    editForm.setFieldsValue({ full_name: account.full_name, phone: account.phone })
    setEditingAccount(account)
  }
  const saveEdit = async () => {
    const values = await editForm.validateFields()
    setSaving(true)
    try {
      const updated = await updateAdminAccount(editingAccount.public_id, values)
      message.success('Đã cập nhật hồ sơ tài khoản.')
      setEditingAccount(null)
      setSelectedAccount((current) => (
        current?.public_id === updated.public_id ? updated : current
      ))
      await queryClient.invalidateQueries({ queryKey: adminAccountKeys.all })
    } catch (error) {
      if (!error?.errorFields) {
        message.error(getApiErrorMessage(error, 'Không thể cập nhật tài khoản.'))
      }
    } finally {
      setSaving(false)
    }
  }

  const tiles = recruiterScope
    ? {
        ariaLabel: m.admin_recruiter_list_tiles_aria(),
        value: activeRecruiterSegment(filters),
        onChange: selectSegment,
        items: RECRUITER_SEGMENTS.map((segment) => ({
          key: segment.key,
          value: segment.key,
          label: segment.label,
          icon: SEGMENT_ICONS[segment.key],
          count: tileCount(segment.count(summary)),
        })),
      }
    : {
        ariaLabel: m.admin_account_list_tiles_aria(),
        value: userTile(filters),
        onChange: applyUserTile,
        items: USER_TILES.map((tile) => ({ ...tile, key: tile.value, count: tileCount(metrics?.[tile.metric]) })),
      }

  const accountList = (
    <AccountList
      recruiterOnly={recruiterScope}
      tiles={tiles}
      toolbar={{
        filters,
        quickItems: recruiterScope ? RECRUITER_CHIPS : USER_CHIPS,
        quickValue,
        onQuick: selectQuick,
        onChange: changeFilters,
        onClear: () => changeFilters(DEFAULT_FILTERS),
      }}
      query={accountsQuery}
      page={page}
      pageSize={pageSize}
      onPageChange={(nextPage) => syncQuery(activeTab, filters, nextPage)}
      onPageSizeChange={recruiterScope ? changePageSize : undefined}
      originState={listOrigin}
      actions={{
        onQuickView: setSelectedAccount,
        onOpenDetail: openDetail,
        onEdit: openEdit,
        onSecurity: (account) => openDetail(account, 'security'),
        canEdit: canManageAccount,
        canManageSecurity: canManageAccount,
      }}
    />
  )
  const queuePanel = (content) => (
    <section className="admin-panel">
      <div className="account-management-tab-content">{content}</div>
    </section>
  )

  const pendingInvitations = summary.queues?.pending_admin_invitations || 0
  const tabs = [
    ...(accountTabs.includes('all') ? [{
      key: 'all',
      label: `Tất cả người dùng (${summary.totals?.total || 0})`,
      children: accountList,
    }] : []),
    ...(accountTabs.includes('candidate') ? [{
      key: 'candidate',
      label: `Ứng viên (${summary.by_role?.candidate?.total || 0})`,
      children: accountList,
    }] : []),
    ...(accountTabs.includes('admin') ? [{
      key: 'admin',
      label: `Quản trị viên (${summary.by_role?.admin?.total || 0})`,
      children: accountList,
    }] : []),
    ...(accountTabs.includes('employer') ? [{
      key: 'employer',
      label: `Danh sách NTD (${summary.totals?.total || 0})`,
      children: accountList,
    }] : []),
    ...(recruiterScope ? [{
      key: 'verification',
      label: (
        <QueueTabLabel count={summary.verification?.pending}>
          Chờ xác thực NTD
        </QueueTabLabel>
      ),
      children: queuePanel(<VerificationQueuePanel />),
    }] : []),
    ...(recruiterScope ? [{
      key: 'domain-verification',
      label: (
        <QueueTabLabel count={domainSummaryQuery.data?.manual_pending}>
          Xác minh domain
        </QueueTabLabel>
      ),
      children: queuePanel(<AdminCompanyDomainReview />),
    }] : []),
    ...(canManageAdmins ? [{
      key: 'invitations',
      label: <QueueTabLabel count={pendingInvitations}>Lời mời quản trị</QueueTabLabel>,
      children: queuePanel(<InvitationPanel />),
    }] : []),
  ]

  return (
    <section className="account-workspace">
      <Tabs
        activeKey={activeTab}
        items={tabs.map(({ children: _children, ...tab }) => tab)}
        onChange={changeTab}
      />
      {tabs.find((tab) => tab.key === activeTab)?.children}

      <AccountQuickDrawer
        account={selectedAccount}
        open={Boolean(selectedAccount)}
        onClose={() => setSelectedAccount(null)}
        onOpenDetail={openDetail}
        onStep={recruiterScope && accounts.results.length > 1 ? stepQuickView : undefined}
        originState={listOrigin}
        recruiterScope={recruiterScope}
      />
      <AccountEditModal
        account={editingAccount}
        form={editForm}
        loading={saving}
        onClose={() => setEditingAccount(null)}
        onSave={saveEdit}
      />
    </section>
  )
}
