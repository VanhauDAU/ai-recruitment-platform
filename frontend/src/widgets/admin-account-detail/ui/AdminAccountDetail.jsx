import {
  ArrowLeftOutlined,
  EditOutlined,
  KeyOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Avatar,
  Button,
  Card,
  Descriptions,
  Skeleton,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  adminAccountKeys,
  formatAdminDate,
  getAdminAccount,
  getAdminAccountActivity,
  getAdminAccountProfile,
  getAdminAccountResource,
  getAdminAccountSessions,
  resendAdminAccountVerification,
  sendAdminAccountPasswordReset,
  updateAdminAccountProfile,
} from '@/entities/admin-account'
import { useAdminAccess } from '@/entities/admin-access'
import { useSession } from '@/entities/session'
import { AdminAccountProfileModal } from '@/features/edit-admin-account-profile'
import { AdminAccountSecurityActions } from '@/features/manage-admin-account-security'
import { EmployerVerificationReview } from '@/features/review-employer-verification'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { adminPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import AccountProfilePanel from './AccountProfilePanel'
import '../admin-account-detail.css'
import { resolveActiveAdminAccountTab } from '../model/tab-state'
import AdminAccountAccessPanel from './AdminAccountAccessPanel'

const ROLE_META = {
  candidate: { label: 'Ứng viên', color: 'blue' },
  employer: { label: 'Nhà tuyển dụng', color: 'purple' },
  admin: { label: 'Admin', color: 'gold' },
}

const STATUS_META = {
  active: { label: 'Đang hoạt động', color: 'green' },
  pending: { label: 'Chờ kích hoạt', color: 'gold' },
  inactive: { label: 'Tạm khóa', color: 'orange' },
  banned: { label: 'Đã cấm', color: 'red' },
}

function StatusTag({ value, role = false }) {
  const meta = (role ? ROLE_META : STATUS_META)[value] || {
    label: value || 'Chưa xác định',
    color: 'default',
  }
  return <Tag color={meta.color}>{meta.label}</Tag>
}

function ResourceTable({ publicId, resource, columns, rowKey = 'public_id' }) {
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: adminAccountKeys.resource(publicId, resource, page),
    queryFn: ({ signal }) => getAdminAccountResource(publicId, resource, page, { signal }),
  })
  if (query.isError) {
    return <Alert showIcon type="error" title="Không thể tải dữ liệu" description={getApiErrorMessage(query.error)} />
  }
  return (
    <div className="overflow-x-auto">
      <Table
        rowKey={rowKey}
        loading={query.isLoading}
        dataSource={query.data?.results || []}
        columns={columns}
        scroll={{ x: 900 }}
        pagination={{
          current: page,
          pageSize: 20,
          total: query.data?.count || 0,
          showSizeChanger: false,
          onChange: setPage,
        }}
      />
    </div>
  )
}

function SecurityPanel({ publicId, account, canManage, isSuperuser }) {
  const sessions = useQuery({
    queryKey: adminAccountKeys.sessions(publicId),
    queryFn: ({ signal }) => getAdminAccountSessions(publicId, { signal }),
  })
  const [sending, setSending] = useState(false)
  const send = async (kind) => {
    setSending(true)
    try {
      if (kind === 'password') await sendAdminAccountPasswordReset(publicId)
      else await resendAdminAccountVerification(publicId)
      message.success('Đã xếp lịch gửi email bảo mật.')
    } catch (error) {
      message.error(getApiErrorMessage(error))
    } finally {
      setSending(false)
    }
  }
  return (
    <div className="space-y-5">
      <Card title="Xác thực & quyền truy cập">
        <Descriptions bordered size="small" column={{ xs: 1, md: 2 }}>
          <Descriptions.Item label="Email">
            <Tag color={account.email_verified ? 'green' : 'orange'}>
              {account.email_verified ? 'Đã xác minh' : 'Chưa xác minh'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="MFA">
            <Tag color={account.two_factor_enabled ? 'green' : 'default'}>
              {account.two_factor_enabled ? 'Đang bật' : 'Chưa bật'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="MFA email">
            {account.mfa_methods.email ? 'Đang bật' : 'Chưa bật'}
          </Descriptions.Item>
          <Descriptions.Item label="MFA TOTP">
            {account.mfa_methods.totp ? 'Đang bật' : 'Chưa bật'}
          </Descriptions.Item>
          <Descriptions.Item label="Mã dự phòng">
            {account.mfa_methods.backup_codes_remaining}
          </Descriptions.Item>
          <Descriptions.Item label="Phiên hoạt động">
            {account.active_session_count}
          </Descriptions.Item>
        </Descriptions>
        {canManage && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button loading={sending} icon={<KeyOutlined />} onClick={() => send('password')}>
              Gửi đặt lại mật khẩu
            </Button>
            {!account.email_verified && (
              <Button loading={sending} icon={<MailOutlined />} onClick={() => send('verify')}>
                Gửi lại xác minh email
              </Button>
            )}
            {/* Backend (`ensure_account_write_allowed`) cho superuser đổi trạng
                thái tài khoản admin; UI phải mở tương ứng, nếu không một admin
                bị cấm sẽ không còn đường mở lại từ giao diện. */}
            <AdminAccountSecurityActions
              account={account}
              allowStatus={account.role !== 'admin' || isSuperuser}
            />
          </div>
        )}
      </Card>
      <Card title="Danh sách phiên">
        <Table
          rowKey="id"
          loading={sessions.isLoading}
          dataSource={sessions.data || []}
          pagination={false}
          scroll={{ x: 760 }}
          columns={[
            { title: 'Thiết bị', dataIndex: 'device_label', render: (value) => value || 'Không xác định' },
            { title: 'Cổng', dataIndex: 'portal' },
            { title: 'Phương thức', dataIndex: 'auth_method' },
            { title: 'IP', dataIndex: 'ip_address', render: (value) => value || '—' },
            { title: 'Hoạt động gần nhất', dataIndex: 'last_seen_at', render: formatAdminDate },
            {
              title: 'Trạng thái',
              key: 'status',
              render: (_, row) => (
                <Tag color={row.revoked_at ? 'default' : 'green'}>
                  {row.revoked_at ? 'Đã thu hồi' : 'Hoạt động'}
                </Tag>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}

function ActivityPanel({ publicId }) {
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: adminAccountKeys.activity(publicId, page),
    queryFn: ({ signal }) => getAdminAccountActivity(publicId, page, { signal }),
  })
  return (
    <Table
      rowKey="public_id"
      loading={query.isLoading}
      dataSource={query.data?.results || []}
      scroll={{ x: 800 }}
      pagination={{
        current: page,
        pageSize: 20,
        total: query.data?.count || 0,
        showSizeChanger: false,
        onChange: setPage,
      }}
      columns={[
        { title: 'Thời gian', dataIndex: 'created_at', render: formatAdminDate },
        {
          title: 'Hành động',
          dataIndex: 'action',
          render: (value) => ({
            update_account_profile: 'Cập nhật hồ sơ',
            change_account_status: 'Thay đổi trạng thái tài khoản',
            revoke_account_sessions: 'Thu hồi phiên đăng nhập',
            reveal_account_sensitive_profile: 'Xem dữ liệu nhạy cảm',
            view_employer_verification_document: 'Xem giấy tờ xác thực',
          })[value] || 'Thao tác quản trị',
        },
        {
          title: 'Người thực hiện',
          key: 'actor',
          render: (_, row) => row.actor_email || row.actor_identifier || 'Hệ thống',
        },
        {
          title: 'Đối tượng',
          dataIndex: 'target_type',
          render: (value) => ({
            user: 'Tài khoản',
            employer_verification: 'Hồ sơ xác thực NTD',
            employer_verification_document: 'Giấy tờ xác thực',
          })[value] || 'Dữ liệu quản trị',
        },
      ]}
    />
  )
}

function Overview({ account }) {
  const verification = account.context?.verification
  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <Card title="Thông tin tài khoản">
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="Họ và tên">{account.full_name || 'Chưa cập nhật'}</Descriptions.Item>
          <Descriptions.Item label="Email">{account.email}</Descriptions.Item>
          <Descriptions.Item label="Số điện thoại">{account.phone || 'Chưa cập nhật'}</Descriptions.Item>
          <Descriptions.Item label="Vai trò"><StatusTag role value={account.role} /></Descriptions.Item>
          <Descriptions.Item label="Trạng thái"><StatusTag value={account.status} /></Descriptions.Item>
          <Descriptions.Item label="Xác minh email">
            {account.email_verified ? 'Đã xác minh' : 'Chưa xác minh'}
          </Descriptions.Item>
          {verification && (
            <Descriptions.Item label="Xác thực NTD">
              <Tag color={verification.status === 'approved' ? 'green' : 'gold'}>
                {verification.status_label}
              </Tag>
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Ngày tạo">{formatAdminDate(account.date_joined)}</Descriptions.Item>
          <Descriptions.Item label="Mã tài khoản">
            <Typography.Text copyable code>{account.public_id}</Typography.Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="Hoạt động và dữ liệu liên quan">
        <div className="account-detail-counts">
          <div><span>Đăng nhập gần nhất</span><strong>{formatAdminDate(account.last_login)}</strong></div>
          <div><span>Phiên hoạt động</span><strong>{account.active_session_count}</strong></div>
          {Object.entries(account.section_counts || {})
            .filter(([key]) => key !== 'active_sessions')
            .map(([key, value]) => (
              <div key={key}>
                <span>{({
                  activity: 'Sự kiện audit',
                  cvs: 'CV',
                  applications: 'Đơn ứng tuyển',
                  consents: 'Quyết định consent',
                  recruitment_needs: 'Nhu cầu tuyển dụng',
                  jobs: 'Tin tuyển dụng',
                  campaigns: 'Chiến dịch',
                  verification_documents: 'Giấy tờ xác thực',
                })[key] || 'Dữ liệu'}</span>
                <strong>{value}</strong>
              </div>
            ))}
        </div>
      </Card>
    </div>
  )
}

function CandidateTabs({ publicId, profilePanel, security, activity }) {
  return [
    { key: 'overview', label: 'Tổng quan' },
    { key: 'profile', label: 'Hồ sơ cá nhân', children: profilePanel },
    { key: 'preferences', label: 'Nhu cầu tìm việc', children: profilePanel },
    {
      key: 'cvs',
      label: 'CV',
      children: <ResourceTable publicId={publicId} resource="cvs" columns={[
        { title: 'Tiêu đề', dataIndex: 'title' },
        { title: 'Nguồn', dataIndex: 'source_label' },
        { title: 'Template', dataIndex: 'template_name', render: (value) => value || 'Không áp dụng' },
        { title: 'Xử lý', dataIndex: 'processing_status_label' },
        { title: 'Phát hành', dataIndex: 'lifecycle_status_label' },
        { title: 'Hiển thị', dataIndex: 'visibility_label' },
        { title: 'Mặc định', dataIndex: 'is_default', render: (value) => value ? 'Có' : 'Không' },
        { title: 'Cập nhật', dataIndex: 'updated_at', render: formatAdminDate },
      ]}
      />,
    },
    {
      key: 'applications',
      label: 'Đơn ứng tuyển',
      children: <ResourceTable publicId={publicId} resource="applications" columns={[
        { title: 'Tin tuyển dụng', dataIndex: 'job_title' },
        { title: 'Công ty', dataIndex: 'company_name' },
        { title: 'CV đã nộp', dataIndex: 'submitted_cv_title' },
        { title: 'Trạng thái', dataIndex: 'status_label' },
        { title: 'Nguồn', dataIndex: 'source_label' },
        { title: 'Ngày ứng tuyển', dataIndex: 'applied_at', render: formatAdminDate },
      ]}
      />,
    },
    {
      key: 'consents',
      label: 'Consent & quyền riêng tư',
      children: <ResourceTable publicId={publicId} resource="consents" rowKey="consent_type" columns={[
        { title: 'Mục đích', dataIndex: 'consent_type_label' },
        { title: 'Quyết định', dataIndex: 'decision_label' },
        { title: 'Phiên bản chính sách', dataIndex: 'policy_version' },
        { title: 'Quyết định lúc', dataIndex: 'decided_at', render: formatAdminDate },
      ]}
      />,
    },
    { key: 'security', label: 'Bảo mật', children: security },
    { key: 'activity', label: 'Hoạt động', children: activity },
  ]
}

function EmployerRecruitment({ publicId }) {
  return (
    <Tabs
      items={[
        {
          key: 'needs',
          label: 'Nhu cầu tuyển dụng',
          children: <ResourceTable publicId={publicId} resource="recruitment-needs" columns={[
            { title: 'Chuyên môn', dataIndex: 'position_category_name' },
            { title: 'Cấp bậc', dataIndex: 'position_level_label' },
            { title: 'Số lượng', dataIndex: 'headcount' },
            { title: 'Nguồn ngân sách', dataIndex: 'budget_source_label' },
            { title: 'Trạng thái', dataIndex: 'is_active', render: (value) => value ? 'Đang tuyển' : 'Đã đóng' },
          ]}
          />,
        },
        {
          key: 'jobs',
          label: 'Tin tuyển dụng',
          children: <ResourceTable publicId={publicId} resource="jobs" columns={[
            { title: 'Tiêu đề', dataIndex: 'title' },
            { title: 'Chiến dịch', dataIndex: 'campaign_name', render: (value) => value || 'Không thuộc chiến dịch' },
            { title: 'Trạng thái', dataIndex: 'status_label' },
            { title: 'Hồ sơ nhận được', dataIndex: 'application_count' },
            { title: 'Hạn nộp', dataIndex: 'deadline' },
            { title: 'Cập nhật', dataIndex: 'updated_at', render: formatAdminDate },
          ]}
          />,
        },
        {
          key: 'campaigns',
          label: 'Chiến dịch',
          children: <ResourceTable publicId={publicId} resource="campaigns" columns={[
            { title: 'Tên chiến dịch', dataIndex: 'name' },
            { title: 'Chuyên môn', dataIndex: 'position_category_name' },
            { title: 'Trạng thái', dataIndex: 'status_label' },
            { title: 'Tin tuyển dụng', dataIndex: 'job_count' },
            { title: 'Hồ sơ nhận được', dataIndex: 'application_count' },
            { title: 'Cập nhật', dataIndex: 'updated_at', render: formatAdminDate },
          ]}
          />,
        },
      ]}
    />
  )
}

export default function AdminAccountDetail({ publicId, routeScope = 'users' }) {
  const { user } = useSession()
  const { has, isSuperuser } = useAdminAccess(user)
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [editState, setEditState] = useState(null)
  const query = useQuery({
    queryKey: adminAccountKeys.detail(publicId),
    queryFn: ({ signal }) => getAdminAccount(publicId, { signal }),
  })
  const account = query.data
  const updateMutation = useMutation({
    mutationFn: (payload) => updateAdminAccountProfile(publicId, payload),
    onSuccess: async () => {
      message.success('Đã cập nhật hồ sơ tài khoản.')
      setEditState(null)
      await queryClient.invalidateQueries({ queryKey: adminAccountKeys.all })
    },
    onError: (error) => message.error(getApiErrorMessage(error)),
  })

  const canEdit = isSuperuser || has('account.profile.manage')
  const canReveal = isSuperuser || has('account.sensitive.view')
  const canSecurity = isSuperuser || has('account.security.manage') || has('account.admin.manage')
  const canViewVerification = isSuperuser || has('employer_verification.view')
  const canReviewVerification = isSuperuser || has('employer_verification.review')
  const canViewCompanyUpdates = isSuperuser || has('company_update.view')
  const canReviewCompanyUpdates = isSuperuser || has('company_update.review')
  const canViewSensitiveDocument = canReveal
  const activeTab = searchParams.get('tab') || 'overview'
  const fallbackPath = adminPath(routeScope === 'recruiters' ? '/recruiters' : '/accounts')
  const origin = location.state?.origin
  const safeOrigin = (
    origin?.pathname?.startsWith(adminPath('/'))
    && !origin.pathname.includes(`/${publicId}`)
  ) ? origin : null
  const backTarget = safeOrigin
    ? `${safeOrigin.pathname}${safeOrigin.search || ''}`
    : fallbackPath
  const backLabel = safeOrigin?.label || (
    routeScope === 'recruiters' ? 'Danh sách nhà tuyển dụng' : 'Danh sách người dùng'
  )

  const profilePanel = account && (
    <AccountProfilePanel
      publicId={publicId}
      account={account}
      canReveal={canReveal}
      onEdit={canEdit ? setEditState : null}
    />
  )
  const companyPanel = account && (
    <AccountProfilePanel
      publicId={publicId}
      account={account}
      canReveal={canReveal}
      section="company"
    />
  )
  const security = account && (
    <SecurityPanel
      publicId={publicId}
      account={account}
      canManage={canSecurity}
      isSuperuser={isSuperuser}
    />
  )
  const activity = <ActivityPanel publicId={publicId} />
  const tabs = (() => {
    if (!account) return []
    if (account.role === 'candidate') {
      return CandidateTabs({ publicId, profilePanel, security, activity })
    }
    if (account.role === 'employer') {
      return [
        { key: 'overview', label: 'Tổng quan' },
        { key: 'profile', label: 'Hồ sơ NTD', children: profilePanel },
        { key: 'company', label: 'Công ty', children: companyPanel },
        ...((canViewVerification || canReviewVerification || canViewCompanyUpdates || canReviewCompanyUpdates) ? [{
          key: 'verification',
          label: 'Xác thực',
          children: (
            <EmployerVerificationReview
              casePublicId={account.context?.verification?.public_id}
              companyPublicId={account.context?.company?.public_id}
              canViewVerification={canViewVerification}
              canReviewVerification={canReviewVerification}
              canViewCompanyUpdates={canViewCompanyUpdates}
              canReviewCompanyUpdates={canReviewCompanyUpdates}
              canViewSensitive={canViewSensitiveDocument}
            />
          ),
        }] : []),
        {
          key: 'recruitment',
          label: 'Hoạt động tuyển dụng',
          children: <EmployerRecruitment publicId={publicId} />,
        },
        { key: 'security', label: 'Bảo mật', children: security },
        { key: 'activity', label: 'Nhật ký hoạt động', children: activity },
      ]
    }
    return [
      { key: 'overview', label: 'Tổng quan' },
      {
        key: 'access',
        label: 'Quyền truy cập',
        children: <AdminAccountAccessPanel account={account} />,
      },
      { key: 'security', label: 'Bảo mật', children: security },
      { key: 'activity', label: 'Hoạt động', children: activity },
    ]
  })()
  const currentTabs = account ? tabs.map((item) => (
    item.key === 'overview' ? { ...item, children: <Overview account={account} /> } : item
  )) : tabs
  const validActiveTab = resolveActiveAdminAccountTab(currentTabs, activeTab)
  const canonicalScope = account?.role === 'employer' ? 'recruiters' : 'accounts'
  const currentScope = routeScope === 'recruiters' ? 'recruiters' : 'accounts'
  const hasCanonicalMismatch = Boolean(account && canonicalScope !== currentScope)

  useEffect(() => {
    if (!account) return
    if (canonicalScope === currentScope) return
    navigate(
      `${adminPath(`/${canonicalScope}/${publicId}`)}${location.search}`,
      { replace: true, state: location.state },
    )
  }, [
    account,
    canonicalScope,
    currentScope,
    location.search,
    location.state,
    navigate,
    publicId,
  ])

  useEffect(() => {
    if (!account || hasCanonicalMismatch || activeTab === validActiveTab) return
    const next = new URLSearchParams(searchParams)
    if (validActiveTab === 'overview') next.delete('tab')
    else next.set('tab', validActiveTab)
    setSearchParams(next, { replace: true })
  }, [
    account,
    activeTab,
    hasCanonicalMismatch,
    searchParams,
    setSearchParams,
    validActiveTab,
  ])

  if (query.isLoading) return <Card><Skeleton active paragraph={{ rows: 12 }} /></Card>
  if (query.isError || !account) {
    return (
      <Alert
        showIcon
        type="error"
        title="Không thể tải tài khoản"
        description={getApiErrorMessage(query.error)}
        action={<Button onClick={() => navigate(backTarget)}>{backLabel}</Button>}
      />
    )
  }

  return (
    <div className="space-y-5">
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(backTarget)}>
        {backLabel}
      </Button>
      <section className="account-detail-hero">
        <div className="account-detail-hero__identity">
          <Avatar size={72} src={account.avatar_url || undefined} icon={<UserOutlined />} />
          <div className="min-w-0">
            <Typography.Title level={2} ellipsis className="!mb-1 !text-2xl">
              {account.full_name || 'Chưa cập nhật họ tên'}
            </Typography.Title>
            <Typography.Text type="secondary" ellipsis className="!block">
              {account.email}
            </Typography.Text>
            <Space wrap className="mt-3">
              <StatusTag role value={account.role} />
              <StatusTag value={account.status} />
              {account.email_verified && <Tag color="green">Email đã xác minh</Tag>}
              {account.context?.verification && (
                <Tag icon={<SafetyCertificateOutlined />}>
                  {account.context.verification.status_label}
                </Tag>
              )}
            </Space>
          </div>
        </div>
        {canEdit && (
          <Button
            icon={<EditOutlined />}
            onClick={async () => {
              try {
                const profile = await getAdminAccountProfile(publicId)
                setEditState(profile)
              } catch (error) {
                message.error(getApiErrorMessage(error))
              }
            }}
          >
            Sửa hồ sơ
          </Button>
        )}
      </section>
      <section className="admin-panel account-detail-tabs">
        <Tabs
          activeKey={validActiveTab}
          items={currentTabs}
          onChange={(tab) => {
            const next = new URLSearchParams(searchParams)
            if (tab === 'overview') next.delete('tab')
            else next.set('tab', tab)
            setSearchParams(next)
          }}
          tabBarGutter={22}
        />
      </section>
      <AdminAccountProfileModal
        account={account}
        profile={editState}
        open={Boolean(editState)}
        loading={updateMutation.isPending}
        onCancel={() => setEditState(null)}
        onSubmit={(payload) => updateMutation.mutate(payload)}
      />
    </div>
  )
}
