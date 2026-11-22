import { useQueryClient } from '@tanstack/react-query'
import { Form, Select } from 'antd'
import { useState } from 'react'
import {
  adminAccountKeys,
  changeAccountStatus,
  getAccountResourceHoldImpact,
  getAccountSessionsImpact,
  getAccountStatusImpact,
  releaseAccountResourceHolds,
  revokeAccountSessions,
} from '@/entities/account/admin-account'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import ActionDialog from '@/shared/ui/confirm-action/ActionDialog'
import ImpactFacts from '@/shared/ui/confirm-action/ImpactFacts'
import ReasonField from '@/shared/ui/confirm-action/ReasonField'
import useImpactConfirmation from '@/shared/ui/confirm-action/use-impact-confirmation'
import { statusImpactBreakdown, statusImpactFacts } from '../model/status-impact-facts'
import {
  effectDescription,
  operationReasonPresets,
  operationSubmitLabel,
  operationTitle,
  operationTone,
} from '../model/status-operation'

const VIOLATION_OPTIONS = [
  { value: 'security', label: 'An toàn / bảo mật' },
  { value: 'fraud', label: 'Gian lận / giả mạo' },
  { value: 'policy', label: 'Vi phạm chính sách' },
  { value: 'legal', label: 'Yêu cầu pháp lý' },
  { value: 'other', label: 'Khác' },
]

const SUCCESS_MESSAGES = {
  sessions: 'Đã thu hồi toàn bộ phiên đăng nhập.',
  'resource-hold': 'Đã gỡ giữ tài nguyên. Tài khoản vẫn đang tạm khóa.',
}

function auditPayload(values) {
  return {
    reason: values?.reason || '',
    enforcement_evidence: values?.enforcement_evidence || '',
    violation_category: values?.violation_category || '',
  }
}

/**
 * Thao tác trạng thái/phiên của một tài khoản: mỗi thao tác xem trước tác động rồi mới xác nhận.
 * Trả về `available` (thao tác nào dùng được với trạng thái hiện tại), `start` (mở popup của thao tác)
 * và `dialog` để đặt vào cây. Nút và bố cục do nơi dùng quyết định.
 */
export default function useAccountSecurityOperations({
  account,
  allowBan = false,
  allowResourceRelease = false,
}) {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [operation, setOperation] = useState(null)
  const requiresResourceReview = Boolean(account.status_enforcement?.requires_resource_review)

  const close = () => {
    setOperation(null)
    form.resetFields()
  }
  const open = (next) => {
    form.resetFields()
    setOperation({ ...next, beforeStatus: account.status })
  }

  // `values === null` is the open-time preview, before any audit text is typed.
  const preview = (values) => {
    const audit = auditPayload(values)
    if (operation.kind === 'status') {
      return getAccountStatusImpact(account.public_id, { status: operation.status, ...audit })
    }
    if (operation.kind === 'resource-hold') {
      return getAccountResourceHoldImpact(account.public_id, {
        reason: audit.reason,
        enforcement_evidence: audit.enforcement_evidence,
      })
    }
    return getAccountSessionsImpact(account.public_id, audit.reason)
  }

  const confirm = async (impact, values) => {
    const audit = auditPayload(values)
    if (operation.kind === 'status') {
      await changeAccountStatus(account.public_id, { status: operation.status, ...audit }, impact.impact_token)
    } else if (operation.kind === 'resource-hold') {
      await releaseAccountResourceHolds(
        account.public_id,
        { reason: audit.reason, enforcement_evidence: audit.enforcement_evidence },
        impact.impact_token,
      )
    } else {
      await revokeAccountSessions(account.public_id, audit.reason, impact.impact_token)
    }
  }

  const impactState = useImpactConfirmation({
    confirm,
    open: Boolean(operation),
    preview,
    previewKey: operation ? `${operation.kind}:${operation.status || ''}` : '',
  })

  const submit = async () => {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    try {
      if (!(await impactState.submit(values))) return
      message.success(SUCCESS_MESSAGES[operation.kind] || `${operationTitle(operation)} thành công.`)
      close()
      await queryClient.invalidateQueries({ queryKey: adminAccountKeys.all })
    } catch (error) {
      message.error(getApiErrorMessage(error))
    }
  }

  const available = {
    suspend: account.status === 'active',
    reactivate: account.status === 'inactive',
    reactivateBlocked: requiresResourceReview,
    resourceHold: allowResourceRelease && account.status === 'inactive' && requiresResourceReview,
    unban: allowBan && account.status === 'banned',
    ban: allowBan && ['active', 'inactive'].includes(account.status),
    sessions: true,
  }
  const start = {
    suspend: () => open({ kind: 'status', status: 'inactive' }),
    reactivate: () => open({ kind: 'status', status: 'active' }),
    resourceHold: () => open({ kind: 'resource-hold' }),
    unban: () => open({ kind: 'status', status: 'inactive' }),
    ban: () => open({ kind: 'status', status: 'banned' }),
    sessions: () => open({ kind: 'sessions' }),
  }

  const requiresEvidence = operation?.kind === 'resource-hold'
    || operation?.status === 'banned'
    || operation?.beforeStatus === 'banned'
  const { facts, notes, blockers } = statusImpactFacts(operation, impactState.impact)
  const breakdown = statusImpactBreakdown(impactState.impact)

  const dialog = (
    <ActionDialog
      loading={impactState.submitting}
      onCancel={close}
      onSubmit={submit}
      open={Boolean(operation)}
      submitDisabled={impactState.impact?.can_apply === false}
      submitLabel={operationSubmitLabel(operation)}
      target={`${account.full_name || 'Chưa có họ tên'} · ${account.email}`}
      title={operationTitle(operation)}
      tone={operationTone(operation)}
    >
      <p className="action-dialog__lead">{operation && effectDescription(operation, account)}</p>
      <ImpactFacts
        blockers={blockers}
        changed={impactState.changed}
        details={breakdown.length > 0 && (
          <dl className="impact-facts__list">
            {breakdown.map((row) => (
              <div className="impact-facts__item" key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>
            ))}
          </dl>
        )}
        error={impactState.error}
        facts={facts}
        loading={impactState.loading}
        notes={notes}
        onRetry={impactState.reload}
      />
      <Form form={form} layout="vertical" requiredMark initialValues={{ reason: '', enforcement_evidence: '' }}>
        <div className="action-dialog__fields">
          {operation?.status === 'banned' && (
            <Form.Item
              name="violation_category"
              label="Nhóm vi phạm"
              rules={[{ required: true, message: 'Chọn nhóm vi phạm.' }]}
            >
              <Select placeholder="Chọn nhóm vi phạm đã xác minh" options={VIOLATION_OPTIONS} />
            </Form.Item>
          )}
          <ReasonField
            extra="Ghi vào nhật ký quản trị."
            label="Lý do xử lý"
            presets={operationReasonPresets(operation)}
          />
          {requiresEvidence && (
            <ReasonField
              extra="Nguồn đối chiếu, mã ticket hoặc biên bản. Không ghi mật khẩu, mã OTP."
              label="Bằng chứng xử lý"
              minLength={20}
              name="enforcement_evidence"
              rows={3}
            />
          )}
        </div>
      </Form>
    </ActionDialog>
  )

  return { available, start, dialog }
}
