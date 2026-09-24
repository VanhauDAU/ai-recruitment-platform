import { CheckCircleOutlined, GlobalOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Input, Skeleton, Tag } from 'antd'
import { useState } from 'react'
import {
  createEmployerCompanyDomainClaim,
  domainClaimAllows,
  domainClaimStatusPresentation,
  employerProfileKeys,
  formatDomainClaimDate,
  getEmployerCompanyDomainClaims,
  getEmployerProfile,
  requestEmployerCompanyDomainManualReview,
  rotateEmployerCompanyDomainClaim,
  verifyEmployerCompanyDomainClaim,
} from '@/entities/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import ConfirmAction from '@/shared/ui/ConfirmAction'
import DomainClaimDnsValue from './DomainClaimDnsValue'

function withoutChallengeSecret(claim) {
  if (!claim) return claim
  const { txt_value: _txtValue, ...safeClaim } = claim
  return safeClaim
}

function DomainClaimCard({ claim, challenge, busy, onVerify, onRotate, onManualReview }) {
  const [manualOpen, setManualOpen] = useState(false)
  const [reason, setReason] = useState('')
  const status = domainClaimStatusPresentation(claim)
  const canVerify = domainClaimAllows(claim, 'verify')
  const canRotate = domainClaimAllows(claim, 'rotate')
  const canRequestManual = domainClaimAllows(claim, 'request_manual_review')
  const txtValue = challenge?.txt_value

  async function copy(value, label) {
    try {
      await navigator.clipboard.writeText(value)
      message.success(`Đã sao chép ${label}.`)
    } catch {
      message.error(`Không thể sao chép ${label}.`)
    }
  }

  async function submitManualReview() {
    const normalizedReason = reason.trim()
    if (normalizedReason.length < 10) {
      message.error('Vui lòng mô tả lý do ít nhất 10 ký tự.')
      return
    }
    await onManualReview(claim, normalizedReason)
    setReason('')
    setManualOpen(false)
  }

  return (
    <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-900">
            <GlobalOutlined className="shrink-0 text-emerald-600" />
            <span className="break-all">{claim.domain}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Phương thức: {claim.method === 'admin_manual'
              ? 'Quản trị viên duyệt'
              : claim.method === 'legacy_inferred' ? 'Dữ liệu cũ — chưa phải bằng chứng' : 'DNS TXT'}
          </p>
        </div>
        <Tag color={status.color} className="w-fit shrink-0">{status.label}</Tag>
      </div>

      {claim.status === 'verified' && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm leading-5 text-emerald-800">
          <CheckCircleOutlined className="mt-0.5 shrink-0" />
          <span>
            Domain đang được công nhận cho công ty.
            {claim.next_check_at && ` Hệ thống kiểm tra lại vào ${formatDomainClaimDate(claim.next_check_at)}.`}
          </span>
        </div>
      )}

      {claim.method === 'dns_txt' && claim.txt_name && claim.status !== 'verified' && (
        <div className="mt-4 space-y-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 sm:p-4">
          <p className="text-sm leading-6 text-slate-700">
            Thêm bản ghi <strong>TXT</strong> dưới đây tại nhà cung cấp DNS. Việc kiểm tra có thể cần vài phút sau khi DNS cập nhật.
          </p>
          <DomainClaimDnsValue label="Tên bản ghi" value={claim.txt_name} onCopy={copy} />
          {txtValue ? (
            <DomainClaimDnsValue label="Giá trị TXT" value={txtValue} onCopy={copy} />
          ) : (
            <Alert
              type="info"
              showIcon
              title="Giá trị TXT chỉ hiển thị một lần"
              description="Nếu bạn chưa lưu giá trị cũ, hãy tạo lại mã xác minh. Mã cũ sẽ mất hiệu lực."
            />
          )}
          {claim.challenge_expires_at && (
            <p className="text-xs text-slate-500">
              Mã hết hạn: {formatDomainClaimDate(claim.challenge_expires_at)}
            </p>
          )}
        </div>
      )}

      {claim.grace_expires_at && (
        <Alert
          className="mt-4"
          type="warning"
          showIcon
          title="Bản ghi DNS không còn hợp lệ"
          description={`Hãy khôi phục trước ${formatDomainClaimDate(claim.grace_expires_at)} để tránh bị thu hồi xác minh.`}
        />
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {canVerify && (
          <Button
            type="primary"
            icon={<SafetyCertificateOutlined />}
            aria-label="Kiểm tra DNS"
            loading={busy}
            onClick={() => onVerify(claim)}
            className="w-full sm:w-auto"
          >
            Kiểm tra DNS
          </Button>
        )}
        {canRotate && (
          <ConfirmAction
            title="Tạo lại mã xác minh domain"
            description="Mã TXT hiện tại sẽ mất hiệu lực ngay. Bạn cần cập nhật DNS bằng mã mới trước khi kiểm tra lại."
            confirmText="Tạo mã mới"
            cancelText="Đóng"
            onConfirm={() => onRotate(claim)}
            onConfirmError={(error) => message.error(getApiErrorMessage(error, 'Không thể tạo lại mã.'))}
          >
            <Button
              icon={<ReloadOutlined />}
              aria-label="Tạo lại mã TXT"
              disabled={busy}
              className="w-full sm:w-auto"
            >
              Tạo lại mã TXT
            </Button>
          </ConfirmAction>
        )}
        {canRequestManual && !manualOpen && (
          <Button disabled={busy} onClick={() => setManualOpen(true)} className="w-full sm:w-auto">
            Yêu cầu duyệt thủ công
          </Button>
        )}
      </div>

      {manualOpen && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:p-4">
          <label htmlFor={`domain-manual-reason-${claim.public_id}`} className="text-sm font-semibold text-slate-800">
            Lý do không thể xác minh bằng DNS
          </label>
          <Input.TextArea
            id={`domain-manual-reason-${claim.public_id}`}
            className="mt-2"
            value={reason}
            maxLength={1000}
            showCount
            autoSize={{ minRows: 3, maxRows: 6 }}
            placeholder="Ví dụ: Domain do tập đoàn quản lý tập trung, bộ phận tuyển dụng không có quyền cập nhật DNS..."
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button disabled={busy} onClick={() => { setManualOpen(false); setReason('') }}>Đóng</Button>
            <Button type="primary" loading={busy} onClick={submitManualReview}>Gửi yêu cầu</Button>
          </div>
        </div>
      )}
    </article>
  )
}

export default function EmployerCompanyDomainVerification({ className = '', companyLinked }) {
  const queryClient = useQueryClient()
  const [challenges, setChallenges] = useState({})
  const profileQuery = useQuery({
    queryKey: employerProfileKeys.profile,
    queryFn: getEmployerProfile,
    enabled: companyLinked == null,
  })
  const hasCompany = companyLinked ?? Boolean(profileQuery.data?.company)
  const claimsQuery = useQuery({
    queryKey: employerProfileKeys.companyDomainClaims,
    queryFn: getEmployerCompanyDomainClaims,
    enabled: hasCompany,
  })

  const updateClaim = (claim) => {
    if (claim?.txt_value) {
      setChallenges((current) => ({ ...current, [claim.public_id]: claim }))
    }
    queryClient.setQueryData(employerProfileKeys.companyDomainClaims, (current = []) => {
      const safeClaim = withoutChallengeSecret(claim)
      const exists = current.some((item) => item.public_id === safeClaim.public_id)
      return exists
        ? current.map((item) => item.public_id === safeClaim.public_id ? safeClaim : item)
        : [safeClaim, ...current]
    })
  }
  const mutationOptions = (successMessage) => ({
    onSuccess: async (claim) => {
      updateClaim(claim)
      message.success(successMessage)
      await queryClient.invalidateQueries({ queryKey: employerProfileKeys.profile })
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể cập nhật xác minh domain.')),
  })
  const createMutation = useMutation({
    mutationFn: createEmployerCompanyDomainClaim,
    ...mutationOptions('Đã tạo mã xác minh domain.'),
  })
  const verifyMutation = useMutation({
    mutationFn: (claim) => verifyEmployerCompanyDomainClaim(claim.public_id),
    ...mutationOptions('Đã kiểm tra trạng thái DNS.'),
  })
  const rotateMutation = useMutation({
    mutationFn: (claim) => rotateEmployerCompanyDomainClaim(claim.public_id, claim.lock_version),
    ...mutationOptions('Đã tạo mã TXT mới.'),
  })
  const manualMutation = useMutation({
    mutationFn: ({ claim, reason }) => requestEmployerCompanyDomainManualReview(
      claim.public_id,
      { lockVersion: claim.lock_version, reason },
    ),
    ...mutationOptions('Đã gửi yêu cầu duyệt thủ công.'),
  })
  const busy = createMutation.isPending
    || verifyMutation.isPending
    || rotateMutation.isPending
    || manualMutation.isPending
  const claims = claimsQuery.data || []
  const canCreateClaim = hasCompany && claimsQuery.isSuccess && claims.length === 0

  return (
    <section className={`min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <GlobalOutlined className="text-emerald-600" /> Xác minh tên miền công ty
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Domain được lấy từ email công việc đã xác thực của bạn. Xác minh DNS giúp ứng viên nhận biết đúng doanh nghiệp đứng sau tin tuyển dụng.
          </p>
        </div>
        {canCreateClaim && (
          <Button
            type="primary"
            disabled={busy}
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="w-full shrink-0 sm:w-auto"
          >
            Tạo mã xác minh
          </Button>
        )}
      </div>

      {profileQuery.isError && companyLinked == null && (
        <Alert className="mt-5" type="error" showIcon title="Không tải được thông tin công ty" />
      )}
      {!profileQuery.isLoading && !hasCompany && (
        <Alert
          className="mt-5"
          type="info"
          showIcon
          title="Hãy liên kết công ty trước khi xác minh domain"
          description="Domain chỉ có thể được cấp cho công ty mà tài khoản của bạn đang đại diện."
        />
      )}
      {hasCompany && claimsQuery.isLoading && <Skeleton className="mt-5" active paragraph={{ rows: 4 }} />}
      {claimsQuery.isError && (
        <Alert
          className="mt-5"
          type="error"
          showIcon
          title="Không tải được trạng thái xác minh domain"
          description="Các thao tác đang được khóa để tránh cập nhật trên dữ liệu cũ."
          action={<Button onClick={() => claimsQuery.refetch()}>Thử lại</Button>}
        />
      )}
      {claimsQuery.isSuccess && claims.length === 0 && (
        <Alert
          className="mt-5"
          type="info"
          showIcon
          title="Tên miền công ty chưa được xác minh"
          description="Hãy tạo mã và nhờ bộ phận quản trị tên miền thêm bản ghi TXT vào DNS."
        />
      )}
      {claimsQuery.isSuccess && claims.length > 0 && (
        <div className="mt-5 grid min-w-0 gap-4">
          {claims.map((claim) => (
            <DomainClaimCard
              key={claim.public_id}
              claim={claim}
              challenge={challenges[claim.public_id]}
              busy={busy}
              onVerify={(item) => verifyMutation.mutate(item)}
              onRotate={(item) => rotateMutation.mutateAsync(item)}
              onManualReview={(item, reason) => manualMutation.mutateAsync({ claim: item, reason })}
            />
          ))}
        </div>
      )}
    </section>
  )
}
