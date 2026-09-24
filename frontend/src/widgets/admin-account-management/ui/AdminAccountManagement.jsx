import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Badge, Form, Tabs } from 'antd'
import dayjs from 'dayjs'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  adminAccountKeys,
  getAdminAccounts,
  getAdminAccountSummary,
  updateAdminAccount,
} from '@/entities/admin-account'
import {
  adminAccessKeys,
  getAdminDepartments,
  getAdminRoles,
  useAdminAccess,
} from '@/entities/admin-access'
import {
  adminCompanyDomainClaimKeys,
  getAdminCompanyDomainClaimSummary,
} from '@/entities/admin-employer-verification'
import { useSession } from '@/entities/session'
import { AdminCompanyDomainReview } from '@/features/review-company-domain'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { adminPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import AccountEditModal from './AccountEditModal'
import AccountFilters from './AccountFilters'
import AccountOverview from './AccountOverview'
import AccountQuickDrawer from './AccountQuickDrawer'
import AccountTable from './AccountTable'
import InvitationPanel from './InvitationPanel'
import VerificationQueuePanel from './VerificationQueuePanel'
import '../admin-account-management.css'

const EMPTY_PAGE = { count: 0, results: [] }
const EMPTY_METRICS = { total: 0, active: 0, restricted: 0, unverified: 0 }
const DEFAULT_FILTERS = {
  q: '',
  status: '',
  email_verified: '',
  mfa: '',
  has_active_session: '',
  department: '',
  admin_role: '',
  company: '',
  company_state: '',
  verification_status: '',
  ordering: '-date_joined',
  created_range: [],
  last_login_range: [],
}
const SIMPLE_FILTER_KEYS = [
  'q',
  'status',
  'email_verified',
  'mfa',
  'has_active_session',
  'department',
  'admin_role',
  'company',
  'company_state',
  'verification_status',
  'ordering',
]
const ACCOUNT_QUERY_KEYS = [
  ...SIMPLE_FILTER_KEYS,
  'created_from',
  'created_to',
  'last_login_from',
  'last_login_to',
  'page',
]
const INVITATION_QUERY_KEYS = [
  'invite_q',
  'invite_status',
  'invite_department',
  'invite_role',
  'invite_by',
  'invite_page',
  'invite_ordering',
]
const VERIFICATION_QUERY_KEYS = [
  'verify_q',
  'verify_status',
  'verify_document',
  'verify_phone',
  'verify_age',
  'verify_from',
  'verify_to',
  'verify_page',
  'verify_ordering',
]

function QueueTabLabel({ children, count }) {
  return <span>{children}<Badge className="ml-2" count={count || 0} overflowCount={999} /></span>
}

function rangeFromQuery(searchParams, fromKey, toKey) {
  const from = searchParams.get(fromKey)
  const to = searchParams.get(toKey)
  return from && to ? [dayjs(from), dayjs(to)] : []
}

function filtersFromQuery(searchParams) {
  return {
    ...DEFAULT_FILTERS,
    ...Object.fromEntries(
      SIMPLE_FILTER_KEYS.map((key) => [
        key,
        searchParams.get(key) || DEFAULT_FILTERS[key],
      ]),
    ),
    created_range: rangeFromQuery(searchParams, 'created_from', 'created_to'),
    last_login_range: rangeFromQuery(searchParams, 'last_login_from', 'last_login_to'),
  }
}

function queryParams(scope, tab, filters, search, page) {
  const params = {
    scope,
    page,
    q: search,
    status: filters.status,
    email_verified: filters.email_verified,
    mfa: filters.mfa,
    has_active_session: filters.has_active_session,
    department: filters.department,
    admin_role: filters.admin_role,
    company: filters.company.trim(),
    company_state: filters.company_state,
    verification_status: filters.verification_status,
    ordering: filters.ordering,
  }
  if (scope === 'users' && ['candidate', 'admin'].includes(tab)) params.role = tab
  if (filters.created_range?.length === 2) {
    params.created_from = filters.created_range[0].format('YYYY-MM-DD')
    params.created_to = filters.created_range[1].format('YYYY-MM-DD')
  }
  if (filters.last_login_range?.length === 2) {
    params.last_login_from = filters.last_login_range[0].format('YYYY-MM-DD')
    params.last_login_to = filters.last_login_range[1].format('YYYY-MM-DD')
  }
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value != null),
  )
}

export default function AdminAccountManagement({ scope = 'accounts' }) {
  const recruiterScope = scope === 'recruiters'
  const apiScope = recruiterScope ? 'recruiters' : 'users'
  const { user } = useSession()
  const { has, isSuperuser } = useAdminAccess(user)
  const canViewCandidates = !recruiterScope && (isSuperuser || has('account.view'))
  const canViewAdmins = !recruiterScope && (isSuperuser || has('account.admin.view'))
  const canInvite = !recruiterScope && (isSuperuser || has('account.admin.invite'))
  const canBrowseRecruiters = recruiterScope && (
    isSuperuser || has('account.employer.view') || has('account.view')
  )
  const canViewEmployerVerifications = recruiterScope && (
    isSuperuser || has('employer_verification.view')
  )
  const canViewDomainClaims = recruiterScope && (
    isSuperuser || has('employer_domain.view')
  )
  const canReviewDomainClaims = isSuperuser || has('employer_domain.review')
  const canRevokeDomainClaims = isSuperuser || has('employer_domain.revoke')
  const canBrowseAccounts = recruiterScope
    ? canBrowseRecruiters
    : canViewCandidates || canViewAdmins
  // Domain review has its own endpoint and permission boundary. Do not call
  // the account summary API for a domain-only operator because that endpoint
  // intentionally does not accept `employer_domain.view`.
  const canReadAccounts = canBrowseAccounts || canViewEmployerVerifications || canInvite
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [editForm] = Form.useForm()

  const accountTabs = useMemo(() => {
    if (recruiterScope) return canBrowseRecruiters ? ['employer'] : []
    return [
      ...(canViewCandidates && canViewAdmins ? ['all'] : []),
      ...(canViewCandidates ? ['candidate'] : []),
      ...(canViewAdmins ? ['admin'] : []),
    ]
  }, [
    canBrowseRecruiters,
    canViewAdmins,
    canViewCandidates,
    recruiterScope,
  ])
  const fallbackTab = (
    accountTabs[0]
    || (canViewEmployerVerifications ? 'verification' : '')
    || (canViewDomainClaims ? 'domain-verification' : '')
    || (canInvite ? 'invitations' : '')
  )
  const requestedTab = searchParams.get('tab') || (
    recruiterScope ? 'employer' : accountTabs[0]
  )
  const allowedTabs = [
    ...accountTabs,
    ...(canViewEmployerVerifications ? ['verification'] : []),
    ...(canViewDomainClaims ? ['domain-verification'] : []),
    ...(canInvite ? ['invitations'] : []),
  ]
  const activeTab = allowedTabs.includes(requestedTab) ? requestedTab : fallbackTab

  const [filters, setFilters] = useState(() => filtersFromQuery(searchParams))
  const page = Number(searchParams.get('page') || 1)
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [editingAccount, setEditingAccount] = useState(null)
  const [saving, setSaving] = useState(false)
  const deferredSearch = useDeferredValue(filters.q.trim())
  const params = useMemo(
    () => queryParams(apiScope, activeTab, filters, deferredSearch, page),
    [activeTab, apiScope, deferredSearch, filters, page],
  )
  const summaryParams = useMemo(() => ({ scope: apiScope }), [apiScope])
  const summaryQuery = useQuery({
    queryKey: adminAccountKeys.summary(summaryParams),
    queryFn: ({ signal }) => getAdminAccountSummary(summaryParams, { signal }),
    enabled: canReadAccounts,
  })
  const domainSummaryQuery = useQuery({
    queryKey: adminCompanyDomainClaimKeys.summary,
    queryFn: ({ signal }) => getAdminCompanyDomainClaimSummary({ signal }),
    enabled: canViewDomainClaims,
    refetchInterval: 10_000,
    refetchOnWindowFocus: 'always',
    staleTime: 0,
  })
  const accountsQuery = useQuery({
    queryKey: adminAccountKeys.list(params),
    queryFn: ({ signal }) => getAdminAccounts(params, { signal }),
    enabled: accountTabs.includes(activeTab),
  })
  const needsAdminLookups = ['admin', 'invitations'].includes(activeTab)
  const departmentsQuery = useQuery({
    queryKey: adminAccessKeys.departments,
    queryFn: ({ signal }) => getAdminDepartments({ signal }),
    enabled: !recruiterScope && needsAdminLookups,
  })
  const rolesQuery = useQuery({
    queryKey: adminAccessKeys.roles(''),
    queryFn: ({ signal }) => getAdminRoles('', { signal }),
    enabled: !recruiterScope && needsAdminLookups,
  })

  const departments = departmentsQuery.data || []
  const roles = rolesQuery.data || []
  const summary = summaryQuery.data || {}
  const accounts = accountsQuery.data || EMPTY_PAGE
  const metrics = recruiterScope
    ? summary.totals || EMPTY_METRICS
    : activeTab === 'all'
      ? summary.totals || EMPTY_METRICS
      : summary.by_role?.[activeTab] || EMPTY_METRICS

  useEffect(() => {
    if (!activeTab) return
    const defaultTab = recruiterScope ? 'employer' : accountTabs[0]
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
    recruiterScope,
    requestedTab,
    searchParams,
    setSearchParams,
  ])

  useEffect(() => {
    setFilters(filtersFromQuery(searchParams))
  }, [searchParams])

  const syncQuery = (tab, nextFilters, nextPage, { replace = false } = {}) => {
    const next = new URLSearchParams(searchParams)
    const defaultTab = recruiterScope ? 'employer' : accountTabs[0]
    if (tab === defaultTab) next.delete('tab')
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
    let nextFilters = filters
    if (!recruiterScope && key === 'candidate') {
      nextFilters = { ...filters, department: '', admin_role: '' }
    }
    setFilters(nextFilters)
    const next = new URLSearchParams(searchParams)
    const defaultTab = recruiterScope ? 'employer' : accountTabs[0]
    if (key === defaultTab) next.delete('tab')
    else next.set('tab', key)
    if (!accountTabs.includes(key)) ACCOUNT_QUERY_KEYS.forEach((queryKey) => next.delete(queryKey))
    if (key !== 'invitations') {
      INVITATION_QUERY_KEYS.forEach((queryKey) => next.delete(queryKey))
    }
    if (key !== 'verification') {
      VERIFICATION_QUERY_KEYS.forEach((queryKey) => next.delete(queryKey))
      next.delete('company')
    }
    if (key === 'candidate') {
      next.delete('department')
      next.delete('admin_role')
    }
    setSearchParams(next)
  }

  const changeFilters = (next) => {
    setFilters(next)
    syncQuery(activeTab, next, 1)
  }

  const applyOverviewFilter = (kind) => {
    const next = {
      ...filters,
      status: '',
      email_verified: '',
      company_state: '',
    }
    if (kind === 'active') next.status = 'active'
    if (kind === 'restricted') next.status = 'inactive,banned'
    if (kind === 'unverified') next.email_verified = 'false'
    if (kind === 'companyless') next.company_state = 'missing'
    changeFilters(next)
  }

  const openDetail = (account, tab = '') => {
    const recruiter = recruiterScope || account.role === 'employer'
    const base = recruiter ? '/recruiters' : '/accounts'
    navigate(`${adminPath(`${base}/${account.public_id}`)}${tab ? `?tab=${tab}` : ''}`, {
      state: {
        origin: {
          pathname: location.pathname,
          search: location.search,
          label: recruiter ? 'Danh sách nhà tuyển dụng' : 'Danh sách người dùng',
        },
      },
    })
  }

  const canEdit = (account) => (
    isSuperuser || (account.role !== 'admin' && has('account.profile.manage'))
  )
  const canManageSecurity = (account) => (
    isSuperuser || (account.role !== 'admin' && has('account.security.manage'))
  )
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

  const accountList = (
    <div className="account-management-tab-content">
      <AccountFilters
        filters={filters}
        departments={departments}
        roles={roles}
        total={accounts.count}
        loading={accountsQuery.isLoading}
        recruiterOnly={recruiterScope}
        onChange={changeFilters}
        onClear={() => changeFilters(DEFAULT_FILTERS)}
      />
      {accountsQuery.isError && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          title={recruiterScope
            ? 'Không thể tải danh sách nhà tuyển dụng'
            : 'Không thể tải danh sách người dùng'}
          description={getApiErrorMessage(accountsQuery.error)}
        />
      )}
      <AccountTable
        data={accounts}
        loading={accountsQuery.isLoading}
        page={page}
        ordering={filters.ordering}
        recruiterOnly={recruiterScope}
        onPageChange={(nextPage) => syncQuery(activeTab, filters, nextPage)}
        onOrderingChange={(ordering) => changeFilters({ ...filters, ordering })}
        onQuickView={setSelectedAccount}
        onOpenDetail={openDetail}
        onEdit={openEdit}
        onSecurity={(account) => openDetail(account, 'security')}
        canEdit={canEdit}
        canManageSecurity={canManageSecurity}
        resultLabel={recruiterScope ? 'nhà tuyển dụng' : 'người dùng'}
      />
    </div>
  )

  const pendingInvitations = summary.queues?.pending_admin_invitations || 0
  const tabs = [
    ...(!recruiterScope && accountTabs.includes('all') ? [{
      key: 'all',
      label: `Tất cả người dùng (${summary.totals?.total || 0})`,
      children: accountList,
    }] : []),
    ...(!recruiterScope && accountTabs.includes('candidate') ? [{
      key: 'candidate',
      label: `Ứng viên (${summary.by_role?.candidate?.total || 0})`,
      children: accountList,
    }] : []),
    ...(!recruiterScope && accountTabs.includes('admin') ? [{
      key: 'admin',
      label: `Quản trị viên (${summary.by_role?.admin?.total || 0})`,
      children: accountList,
    }] : []),
    ...(recruiterScope && accountTabs.includes('employer') ? [{
      key: 'employer',
      label: `Danh sách NTD (${summary.totals?.total || 0})`,
      children: accountList,
    }] : []),
    ...(canViewEmployerVerifications ? [{
      key: 'verification',
      label: (
        <QueueTabLabel count={summary.verification?.pending}>
          Chờ xác thực NTD
        </QueueTabLabel>
      ),
      children: <div className="account-management-tab-content"><VerificationQueuePanel /></div>,
    }] : []),
    ...(canViewDomainClaims ? [{
      key: 'domain-verification',
      label: (
        <QueueTabLabel count={domainSummaryQuery.data?.manual_pending}>
          Xác minh domain
        </QueueTabLabel>
      ),
      children: (
        <div className="account-management-tab-content">
          <AdminCompanyDomainReview
            canReview={canReviewDomainClaims}
            canRevoke={canRevokeDomainClaims}
          />
        </div>
      ),
    }] : []),
    ...(canInvite ? [{
      key: 'invitations',
      label: <QueueTabLabel count={pendingInvitations}>Lời mời quản trị</QueueTabLabel>,
      children: (
        <div className="account-management-tab-content">
          <InvitationPanel
            departments={departments}
            roles={roles}
            isSuperuser={isSuperuser}
          />
        </div>
      ),
    }] : []),
  ]

  return (
    <div className="min-w-0 space-y-5">
      {!['invitations'].includes(activeTab) && canReadAccounts && (
        <AccountOverview
          metrics={metrics}
          recruiterSummary={recruiterScope ? summary : null}
          pendingInvitations={pendingInvitations}
          canInvite={canInvite}
          onApplyFilter={applyOverviewFilter}
          onOpenQueue={changeTab}
        />
      )}

      <section className="admin-panel account-management-panel">
        <Tabs
          activeKey={activeTab}
          items={tabs}
          onChange={changeTab}
          destroyOnHidden={false}
        />
      </section>

      <AccountQuickDrawer
        account={selectedAccount}
        open={Boolean(selectedAccount)}
        onClose={() => setSelectedAccount(null)}
        onOpenDetail={openDetail}
      />
      <AccountEditModal
        account={editingAccount}
        form={editForm}
        loading={saving}
        onClose={() => setEditingAccount(null)}
        onSave={saveEdit}
      />
    </div>
  )
}
