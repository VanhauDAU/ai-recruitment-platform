import {
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  GlobalOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Form, Input, Pagination, Select, Skeleton, Tag } from 'antd'
import { useDeferredValue, useMemo, useState } from 'react'
import {
  adminCompanyDomainClaimKeys,
  decideAdminCompanyDomainClaim,
  DOMAIN_REVIEW_REASONS,
  getAdminCompanyDomainClaimImpact,
  getAdminCompanyDomainClaims,
  getAdminCompanyDomainClaimSummary,
} from '@/entities/company/admin-employer-verification'
import {
  domainClaimStatusPresentation,
  formatDomainClaimDate,
} from '@/entities/account/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import ActionDialog from '@/shared/ui/confirm-action/ActionDialog'
import ImpactFacts from '@/shared/ui/confirm-action/ImpactFacts'
import ReasonField from '@/shared/ui/confirm-action/ReasonField'
import useImpactConfirmation from '@/shared/ui/confirm-action/use-impact-confirmation'
import AdminCompanyDomainDetailDrawer from './AdminCompanyDomainDetailDrawer'
import AdminCompanyDomainSummaryCards from './AdminCompanyDomainSummaryCards'
import { getIntlLocale } from '@/shared/config/i18n'

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'pending', label: 'Đang chờ xử lý' },
  { value: 'verified', label: 'Đã xác minh' },
  { value: 'grace', label: 'Trong thời gian gia hạn' },
  { value: 'rejected', label: 'Bị từ chối' },
  { value: 'revoked', label: 'Đã thu hồi' },
  { value: 'expired', label: 'Đã hết hạn' },
  { value: 'legacy_inferred', label: 'Dữ liệu cũ cần xác minh' },
]
const METHOD_OPTIONS = [
  { value: '', label: 'Tất cả phương thức' },
  { value: 'dns_txt', label: 'DNS TXT' },
  { value: 'admin_manual', label: 'Duyệt thủ công' },
  { value: 'legacy_inferred', label: 'Dữ liệu cũ' },
]
const ACTION_COPY = {
  approve_manual: { title: 'Duyệt xác minh domain thủ công', confirm: 'Duyệt domain', danger: false },
  reject_manual: { title: 'Từ chối xác minh domain', confirm: 'Từ chối domain', danger: true },
  revoke: { title: 'Thu hồi xác minh domain', confirm: 'Thu hồi xác minh', danger: true },
}

const METHOD_LABELS = Object.fromEntries(METHOD_OPTIONS.map((item) => [item.value, item.label]))
const LEGAL_STATUS_LABELS = {
  approved: 'Đã duyệt',
  changes_requested: 'Cần bổ sung',
  draft: 'Chưa gửi',
  in_review: 'Đang duyệt',
  rejected: 'Bị từ chối',
  revoked: 'Đã thu hồi',
  submitted: 'Đã gửi',
}

function ReviewDialog({ review, onClose, onDone }) {
  const [form] = Form.useForm()
  const copy = ACTION_COPY[review?.action] || {}
  const impactState = useImpactConfirmation({
    open: Boolean(review),
    previewKey: review ? `${review.claim.public_id}:${review.action}` : '',
    preview: (values) => getAdminCompanyDomainClaimImpact(review.claim.public_id, review.action, values?.reason || ''),
    confirm: (impact, values) => decideAdminCompanyDomainClaim(
      review.claim.public_id,
      { action: review.action, reason: values.reason.trim(), impactToken: impact.impact_token },
    ),
  })
  const close = () => {
    if (impactState.submitting) return
    form.resetFields()
    onClose()
  }
  const submit = async () => {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    try {
      if (!(await impactState.submit(values))) return
      form.resetFields()
      await onDone()
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể áp dụng quyết định.'))
    }
  }
  const impact = impactState.impact
  return (
    <ActionDialog
      loading={impactState.submitting}
      onCancel={close}
      onSubmit={submit}
      open={Boolean(review)}
      submitLabel={copy.confirm}
      target={review && `${review.claim.domain} · ${review.claim.company_name}`}
      title={copy.title}
      tone={copy.danger ? 'danger' : 'default'}
    >
      <ImpactFacts
        changed={impactState.changed}
        error={impactState.error}
        facts={impact ? [
          { label: 'Tên miền', value: impact.domain },
          { label: 'Trạng thái hiện tại', value: domainClaimStatusPresentation({ status: impact.status }).label || impact.status },
        ] : []}
        loading={impactState.loading}
        onRetry={impactState.reload}
      />
      <Form form={form} layout="vertical" initialValues={{ reason: '' }}>
        <ReasonField
          label="Lý do quyết định"
          maxLength={1000}
          minLength={10}
          presets={DOMAIN_REVIEW_REASONS[review?.action] || []}
        />
      </Form>
    </ActionDialog>
  )
}

function ClaimCard({ claim, onReview, onOpenDetail }) {
  const status = domainClaimStatusPresentation(claim)
  const manualPending = claim.status === 'pending'
    && claim.method === 'admin_manual'
    && Boolean(claim.manual_review_requested_at)
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="flex min-w-0 items-center gap-2 text-base font-bold text-slate-900">
            <GlobalOutlined className="shrink-0 text-emerald-600" />
            <span className="break-all">{claim.domain}</span>
          </h3>
          <p className="mt-1 break-words text-sm text-slate-600">{claim.company_name || 'Công ty chưa có tên'}</p>
          <p className="mt-1 break-all text-xs text-slate-500">
            Người yêu cầu: {claim.requested_by_email || claim.requested_by?.email || '—'}
          </p>
        </div>
        <Tag color={status.color} className="w-fit shrink-0">{status.label}</Tag>
      </div>
      <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
        <div><dt className="text-slate-400">Phương thức</dt><dd className="mt-0.5 font-semibold text-slate-700">{METHOD_LABELS[claim.method] || claim.method}</dd></div>
        <div><dt className="text-slate-400">Yêu cầu duyệt</dt><dd className="mt-0.5 font-semibold text-slate-700">{formatDomainClaimDate(claim.manual_review_requested_at) || '—'}</dd></div>
        <div><dt className="text-slate-400">Phiên bản</dt><dd className="mt-0.5 font-semibold text-slate-700">{claim.revision ?? claim.lock_version ?? '—'}</dd></div>
        <div><dt className="text-slate-400">Mã số thuế</dt><dd className="mt-0.5 font-semibold text-slate-700">{claim.company_tax_code || '—'}</dd></div>
        <div><dt className="text-slate-400">Email đã xác thực</dt><dd className="mt-0.5 font-semibold text-slate-700">{claim.requested_by_email_verified ? 'Có' : 'Chưa'}</dd></div>
        <div><dt className="text-slate-400">Hồ sơ pháp lý</dt><dd className="mt-0.5 font-semibold text-slate-700">{LEGAL_STATUS_LABELS[claim.requester_profile?.legal_status] || claim.requester_profile?.legal_status || '—'}</dd></div>
      </dl>
      {claim.review_reason && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600"><strong>Lý do gần nhất:</strong> {claim.review_reason}</p>}
      <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap">
        <Button icon={<EyeOutlined />} onClick={() => onOpenDetail(claim.public_id)}>Xem đầy đủ</Button>
        {manualPending && (
          <>
            <Button type="primary" icon={<CheckOutlined />} onClick={() => onReview(claim, 'approve_manual')}>Duyệt thủ công</Button>
            <Button danger icon={<CloseOutlined />} onClick={() => onReview(claim, 'reject_manual')}>Từ chối</Button>
          </>
        )}
        {claim.status === 'verified' && (
          <Button danger icon={<StopOutlined />} onClick={() => onReview(claim, 'revoke')}>Thu hồi</Button>
        )}
      </div>
    </article>
  )
}

export default function AdminCompanyDomainReview() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState({ status: '', method: '', search: '', page: 1 })
  const [review, setReview] = useState(null)
  const [selectedClaimId, setSelectedClaimId] = useState('')
  const deferredSearch = useDeferredValue(filters.search.trim())
  const params = useMemo(() => Object.fromEntries(Object.entries({
    status: filters.status,
    method: filters.method,
    search: deferredSearch,
    page: filters.page,
  }).filter(([, value]) => value !== '' && value != null && value !== 1)), [deferredSearch, filters])
  const claimsQuery = useQuery({
    queryKey: adminCompanyDomainClaimKeys.list(params),
    queryFn: ({ signal }) => getAdminCompanyDomainClaims(params, { signal }),
    refetchInterval: 10_000,
    refetchOnWindowFocus: 'always',
    staleTime: 0,
  })
  const summaryQuery = useQuery({
    queryKey: adminCompanyDomainClaimKeys.summary,
    queryFn: ({ signal }) => getAdminCompanyDomainClaimSummary({ signal }),
    refetchInterval: 10_000,
    refetchOnWindowFocus: 'always',
    staleTime: 0,
  })
  const result = claimsQuery.data || { count: 0, results: [] }
  const refreshAll = () => Promise.all([claimsQuery.refetch(), summaryQuery.refetch()])

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900">Quản lý xác minh tên miền</h2>
          <p className="mt-1 text-sm text-slate-500">
            Tổng {Number(summaryQuery.data?.total || 0).toLocaleString(getIntlLocale())} domain · tự làm mới mỗi 10 giây
          </p>
        </div>
        <Button
          icon={<ReloadOutlined />}
          loading={claimsQuery.isFetching || summaryQuery.isFetching}
          onClick={refreshAll}
        >
          Cập nhật ngay
        </Button>
      </div>
      <AdminCompanyDomainSummaryCards
        summary={summaryQuery.data}
        onFilter={(next) => setFilters((current) => ({ ...current, ...next, page: 1 }))}
      />
      {summaryQuery.data?.oldest_manual_pending_at && (
        <Alert
          type="warning"
          showIcon
          title={`Yêu cầu thủ công cũ nhất: ${formatDomainClaimDate(summaryQuery.data.oldest_manual_pending_at)}`}
        />
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_210px_210px]">
        <Input.Search
          allowClear
          value={filters.search}
          placeholder="Tìm domain, công ty hoặc email"
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))}
        />
        <Select value={filters.status} options={STATUS_OPTIONS} onChange={(status) => setFilters((current) => ({ ...current, status, page: 1 }))} />
        <Select value={filters.method} options={METHOD_OPTIONS} onChange={(method) => setFilters((current) => ({ ...current, method, page: 1 }))} />
      </div>
      {claimsQuery.isLoading && <Skeleton active paragraph={{ rows: 8 }} />}
      {claimsQuery.isError && <Alert type="error" showIcon title="Không tải được hàng đợi xác minh domain" action={<Button onClick={() => claimsQuery.refetch()}>Thử lại</Button>} />}
      {claimsQuery.isSuccess && result.results.length === 0 && <Alert type="info" showIcon title="Không có domain phù hợp bộ lọc" />}
      <div className="grid gap-4">
        {result.results.map((claim) => (
          <ClaimCard
            key={claim.public_id}
            claim={claim}
            onReview={(item, action) => setReview({ claim: item, action })}
            onOpenDetail={setSelectedClaimId}
          />
        ))}
      </div>
      {result.count > 0 && (
        <div className="flex justify-end overflow-x-auto pt-1">
          <Pagination current={filters.page} total={result.count} showSizeChanger={false} onChange={(page) => setFilters((current) => ({ ...current, page }))} />
        </div>
      )}
      <ReviewDialog
        review={review}
        onClose={() => setReview(null)}
        onDone={async () => {
          message.success('Đã cập nhật xác minh domain.')
          setReview(null)
          await queryClient.invalidateQueries({ queryKey: adminCompanyDomainClaimKeys.all })
        }}
      />
      <AdminCompanyDomainDetailDrawer
        publicId={selectedClaimId}
        onClose={() => setSelectedClaimId('')}
      />
    </div>
  )
}
