import { CheckCircleFilled, ClockCircleOutlined, GlobalOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Drawer, Skeleton, Tag, Timeline } from 'antd'
import {
  adminCompanyDomainClaimKeys,
  getAdminCompanyDomainClaim,
} from '@/entities/admin-employer-verification'
import {
  domainClaimStatusPresentation,
  formatDomainClaimDate,
} from '@/entities/employer-profile'

const METHOD_LABELS = {
  dns_txt: 'DNS TXT',
  admin_manual: 'Duyệt thủ công',
  legacy_inferred: 'Dữ liệu cũ',
}
const LEGAL_STATUS_LABELS = {
  draft: 'Chưa nộp',
  pending: 'Chờ duyệt',
  in_review: 'Đang xử lý',
  changes_requested: 'Cần bổ sung',
  rejected: 'Bị từ chối',
  approved: 'Đã xác thực',
  revoked: 'Đã thu hồi',
  expired: 'Hết hiệu lực',
}
const LEGAL_METHOD_LABELS = {
  business_registration: 'Giấy đăng ký doanh nghiệp',
  authorization_and_id: 'Ủy quyền + giấy tờ định danh',
}
const EVENT_LABELS = {
  challenge_created: 'Đã tạo mã DNS',
  challenge_rotated: 'Đã đổi mã DNS',
  dns_check_passed: 'Kiểm tra DNS thành công',
  dns_check_failed: 'Kiểm tra DNS chưa đạt',
  manual_review_requested: 'Đã yêu cầu duyệt thủ công',
  manual_approved: 'Đã duyệt thủ công',
  manual_rejected: 'Đã từ chối duyệt thủ công',
  grace_started: 'Bắt đầu thời gian gia hạn',
  reverified: 'Đã xác minh lại',
  revoked: 'Đã thu hồi',
  expired: 'Đã hết hiệu lực',
}

function Value({ children }) {
  return <dd className="mt-1 break-words text-sm font-semibold text-slate-800">{children || '—'}</dd>
}

function Field({ label, children }) {
  return <div><dt className="text-xs font-medium text-slate-400">{label}</dt><Value>{children}</Value></div>
}

function Section({ title, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">{children}</dl>
    </section>
  )
}

function eventDescription(event) {
  const reason = event.payload?.reason
  return [event.actor_email, reason, formatDomainClaimDate(event.created_at)]
    .filter(Boolean)
    .join(' · ')
}

export default function AdminCompanyDomainDetailDrawer({ publicId, onClose }) {
  const detailQuery = useQuery({
    queryKey: adminCompanyDomainClaimKeys.detail(publicId),
    queryFn: ({ signal }) => getAdminCompanyDomainClaim(publicId, { signal }),
    enabled: Boolean(publicId),
    refetchInterval: publicId ? 10_000 : false,
    refetchOnWindowFocus: 'always',
    staleTime: 0,
  })
  const claim = detailQuery.data
  const status = domainClaimStatusPresentation(claim || {})
  const profile = claim?.requester_profile || {}

  return (
    <Drawer
      open={Boolean(publicId)}
      onClose={onClose}
      size={720}
      title="Chi tiết xác minh tên miền"
      destroyOnHidden
    >
      {detailQuery.isLoading && <Skeleton active paragraph={{ rows: 12 }} />}
      {detailQuery.isError && (
        <Alert
          type="error"
          showIcon
          title="Không tải được chi tiết domain"
          action={<Button onClick={() => detailQuery.refetch()}>Thử lại</Button>}
        />
      )}
      {claim && (
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-900 p-5 text-white">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-lg font-black">
                  <GlobalOutlined className="text-emerald-400" />
                  <span className="break-all">{claim.domain}</span>
                </p>
                <p className="mt-1 text-sm text-slate-300">{claim.company_name}</p>
              </div>
              <Tag color={status.color}>{status.label}</Tag>
            </div>
          </div>

          <Section title="Doanh nghiệp">
            <Field label="Mã công ty">{claim.company}</Field>
            <Field label="Mã số thuế">{claim.company_tax_code}</Field>
            <Field label="Email công ty">{claim.company_email}</Field>
            <Field label="Số điện thoại">{claim.company_phone}</Field>
            <Field label="Website">{claim.company_website_url}</Field>
          </Section>

          <Section title="Người yêu cầu">
            <Field label="Email">{claim.requested_by_email}</Field>
            <Field label="Trạng thái tài khoản">{claim.requested_by_status}</Field>
            <Field label="Email đã xác thực">{claim.requested_by_email_verified ? 'Có' : 'Chưa'}</Field>
            <Field label="Số điện thoại đã xác thực">{profile.phone_verified ? 'Có' : 'Chưa'}</Field>
            <Field label="Mã hồ sơ NTD">{profile.public_id}</Field>
            <Field label="Vai trò công ty">{profile.company_role}</Field>
            <Field label="Hồ sơ pháp lý">{LEGAL_STATUS_LABELS[profile.legal_status] || profile.legal_status}</Field>
            <Field label="Phương thức pháp lý">{LEGAL_METHOD_LABELS[profile.legal_method] || profile.legal_method}</Field>
          </Section>

          <Section title="Bằng chứng và vòng đời">
            <Field label="Phương thức">{METHOD_LABELS[claim.method] || claim.method}</Field>
            <Field label="Tên bản ghi TXT">{claim.txt_name}</Field>
            <Field label="Tạo lúc">{formatDomainClaimDate(claim.created_at)}</Field>
            <Field label="Cập nhật lúc">{formatDomainClaimDate(claim.updated_at)}</Field>
            <Field label="Mã DNS hết hạn">{formatDomainClaimDate(claim.challenge_expires_at)}</Field>
            <Field label="Yêu cầu duyệt thủ công">{formatDomainClaimDate(claim.manual_review_requested_at)}</Field>
            <Field label="Xác minh lúc">{formatDomainClaimDate(claim.verified_at)}</Field>
            <Field label="Kiểm tra gần nhất">{formatDomainClaimDate(claim.last_checked_at)}</Field>
            <Field label="Kiểm tra tiếp theo">{formatDomainClaimDate(claim.next_check_at)}</Field>
            <Field label="Gia hạn đến">{formatDomainClaimDate(claim.grace_expires_at)}</Field>
            <Field label="Hết hiệu lực">{formatDomainClaimDate(claim.expires_at)}</Field>
            <Field label="Phiên bản">{claim.revision} / khóa {claim.lock_version}</Field>
          </Section>

          <Section title="Quyết định gần nhất">
            <Field label="Người duyệt">{claim.reviewer_email}</Field>
            <Field label="Lý do">{claim.review_reason}</Field>
          </Section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-bold text-slate-900">Lịch sử xử lý</h3>
            <Timeline
              className="mt-5"
              items={(claim.events || []).map((event) => ({
                dot: event.event_type.includes('approved') || event.event_type.includes('passed')
                  ? <CheckCircleFilled className="text-emerald-500" />
                  : <ClockCircleOutlined className="text-slate-400" />,
                children: (
                  <div>
                    <p className="font-semibold text-slate-800">{EVENT_LABELS[event.event_type] || event.event_type}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{eventDescription(event)}</p>
                  </div>
                ),
              }))}
            />
            {!claim.events?.length && <p className="text-sm text-slate-500">Chưa có sự kiện audit.</p>}
          </section>
        </div>
      )}
    </Drawer>
  )
}
