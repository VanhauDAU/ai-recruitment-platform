import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Badge, Form, Tabs } from 'antd'
import { useDeferredValue, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { useSession } from '@/entities/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { adminPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import AccountEditModal from './AccountEditModal'
import AccountFilters from './AccountFilters'
import AccountOverview from './AccountOverview'
import AccountQuickDrawer from './AccountQuickDrawer'
import AccountTable from './AccountTable'
import CompanyUpdateQueuePanel from './CompanyUpdateQueuePanel'
import InvitationPanel from './InvitationPanel'
import VerificationQueuePanel from './VerificationQueuePanel'
import '../admin-account-management.css'

const EMPTY_PAGE = { count: 0, results: [] }
const DEFAULT_FILTERS = {
  q: '',
  status: '',
  email_verified: '',
  mfa: '',
  has_active_session: '',
  department: '',
  admin_role: '',
  company: '',
  ordering: '-date_joined',
  created_range: [],
  last_login_range: [],
}

function QueueTabLabel({ children, count }) {
  return <span>{children}<Badge className="ml-2" count={count || 0} overflowCount={999} /></span>
}

function queryParams(tab, filters, search, page) {
  const params = {
    page,
    q: search,
    status: filters.status,
    email_verified: filters.email_verified,
    mfa: filters.mfa,
    has_active_session: filters.has_active_session,
    department: filters.department,
    admin_role: filters.admin_role,
    company: filters.company.trim(),
    ordering: filters.ordering,
  }
  if (tab !== 'all') params.role = tab
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

export default function AdminAccountManagement() {
  const { user } = useSession()
  const { has, isSuperuser } = useAdminAccess(user)
  const canInvite = isSuperuser || has('account.admin.invite')
  const canViewEmployerVerifications = (
    isSuperuser
    || has('employer_verification.view')
  )
  const canViewCompanyUpdates = (
    isSuperuser
    || has('company_update.view')
  )
  const canBrowseAccounts = (
    isSuperuser
    || has('account.view')
    || has('account.admin.view')
  )
  const canReadAccounts = (
    canBrowseAccounts
    || canViewEmployerVerifications
    || canViewCompanyUpdates
  )
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editForm] = Form.useForm()
  const [activeTab, setActiveTab] = useState(() => {
    if (canBrowseAccounts) return 'all'
    if (canViewEmployerVerifications) return 'verification'
    if (canViewCompanyUpdates) return 'company-updates'
    return 'invitations'
  })
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [editingAccount, setEditingAccount] = useState(null)
  const [saving, setSaving] = useState(false)
  const deferredSearch = useDeferredValue(filters.q.trim())
  const params = useMemo(
    () => queryParams(activeTab, filters, deferredSearch, page),
    [activeTab, deferredSearch, filters, page],
  )
  const summaryQuery = useQuery({
    queryKey: adminAccountKeys.summary,
    queryFn: ({ signal }) => getAdminAccountSummary({ signal }),
    enabled: canReadAccounts,
  })
  const accountsQuery = useQuery({
    queryKey: adminAccountKeys.list(params),
    queryFn: ({ signal }) => getAdminAccounts(params, { signal }),
    enabled: !['invitations', 'verification', 'company-updates'].includes(activeTab)
      && canBrowseAccounts,
  })
  const departmentsQuery = useQuery({
    queryKey: adminAccessKeys.departments,
    queryFn: ({ signal }) => getAdminDepartments({ signal }),
    enabled: canBrowseAccounts || canInvite,
  })
  const rolesQuery = useQuery({
    queryKey: adminAccessKeys.roles(''),
    queryFn: ({ signal }) => getAdminRoles('', { signal }),
    enabled: canBrowseAccounts || canInvite,
  })

  const departments = departmentsQuery.data || []
  const roles = rolesQuery.data || []
  const summary = summaryQuery.data || {}
  const accounts = accountsQuery.data || EMPTY_PAGE

  const changeTab = (key) => {
    setActiveTab(key)
    setPage(1)
  }

  const changeFilters = (next) => {
    setFilters(next)
    setPage(1)
  }

  const openDetail = (account, tab = '') => {
    navigate(`${adminPath(`/accounts/${account.public_id}`)}${tab ? `?tab=${tab}` : ''}`)
  }

  const canEdit = (account) => (
    isSuperuser
    || (account.role !== 'admin' && has('account.profile.manage'))
  )
  const canManageSecurity = (account) => (
    isSuperuser
    || (account.role !== 'admin' && has('account.security.manage'))
  )

  const openEdit = (account) => {
    editForm.setFieldsValue({
      full_name: account.full_name,
      phone: account.phone,
    })
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
        onChange={changeFilters}
        onClear={() => changeFilters(DEFAULT_FILTERS)}
      />
      {accountsQuery.isError && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          title="Không thể tải danh sách tài khoản"
          description={getApiErrorMessage(accountsQuery.error)}
        />
      )}
      <AccountTable
        data={accounts}
        loading={accountsQuery.isLoading}
        page={page}
        onPageChange={setPage}
        onQuickView={setSelectedAccount}
        onOpenDetail={openDetail}
        onEdit={openEdit}
        onSecurity={(account) => openDetail(account, 'security')}
        canEdit={canEdit}
        canManageSecurity={canManageSecurity}
      />
    </div>
  )

  const tabs = [
    ...(canBrowseAccounts ? [
      { key: 'all', label: 'Tất cả', children: accountList },
      { key: 'candidate', label: 'Ứng viên', children: accountList },
      { key: 'employer', label: 'Nhà tuyển dụng', children: accountList },
      { key: 'admin', label: 'Admin', children: accountList },
    ] : []),
    ...(canViewEmployerVerifications ? [{
      key: 'verification',
      label: <QueueTabLabel count={summary.employer_verification_pending}>Chờ xác thực NTD</QueueTabLabel>,
      children: (
        <div className="account-management-tab-content">
          <VerificationQueuePanel />
        </div>
      ),
    }] : []),
    ...(canViewCompanyUpdates ? [{
      key: 'company-updates',
      label: <QueueTabLabel count={summary.company_update_pending}>Sửa thông tin công ty</QueueTabLabel>,
      children: (
        <div className="account-management-tab-content">
          <CompanyUpdateQueuePanel />
        </div>
      ),
    }] : []),
    ...(canInvite ? [{
      key: 'invitations',
      label: 'Lời mời Admin',
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
      {canReadAccounts && (
        <AccountOverview
          summary={summary}
          canViewEmployerVerifications={canViewEmployerVerifications}
          canViewCompanyUpdates={canViewCompanyUpdates}
          canInvite={canInvite}
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
