import { useQueryClient } from '@tanstack/react-query'
import { Form, Input } from 'antd'
import { useEffect, useState } from 'react'
import {
  AccountVerificationSummary,
  adminAccountKeys,
  changeAccountEmail,
  getAccountEmailImpact,
} from '@/entities/account/admin-account'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import ActionDialog from '@/shared/ui/confirm-action/ActionDialog'
import ImpactFacts from '@/shared/ui/confirm-action/ImpactFacts'
import ReasonField from '@/shared/ui/confirm-action/ReasonField'
import useImpactConfirmation from '@/shared/ui/confirm-action/use-impact-confirmation'

const RECOVERY_REASONS = [
  'Chủ tài khoản mất quyền truy cập email cũ',
  'Email cũ của nhân viên đã nghỉ việc',
]
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalize(values = {}) {
  return {
    email: (values.email || '').trim().toLowerCase(),
    reason: (values.reason || '').trim(),
    verification_evidence: (values.verification_evidence || '').trim(),
  }
}

/** Waits for typing to pause so the preview does not run on every keystroke. */
function useSettled(value, delay = 400) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}

export default function IdentityRecoveryModal({ account, onClose, onSuccess, open, publicId }) {
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const email = Form.useWatch('email', form) || ''
  const evidence = Form.useWatch('verification_evidence', form) || ''
  const draft = useSettled(`${email.trim().toLowerCase()}\n${evidence.trim()}`)
  const [draftEmail, draftEvidence = ''] = draft.split('\n')
  const ready = EMAIL_PATTERN.test(draftEmail) && draftEvidence.length >= 20

  const impactState = useImpactConfirmation({
    open,
    ready,
    previewKey: draft,
    preview: (values) => getAccountEmailImpact(
      publicId,
      values ? normalize(values) : { email: draftEmail, reason: '', verification_evidence: draftEvidence },
    ),
    confirm: (impact, values) => changeAccountEmail(publicId, normalize(values), impact.impact_token),
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
      message.success('Đã đổi email, thu hồi phiên/OAuth và vô hiệu hóa mật khẩu cũ. Hãy gửi liên kết đặt lại mật khẩu.')
      await queryClient.invalidateQueries({ queryKey: adminAccountKeys.all })
      onSuccess?.()
      form.resetFields()
      onClose()
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể hoàn tất thao tác khôi phục.'))
    }
  }

  const impact = impactState.impact
  const facts = impact ? [
    { label: 'Email mới', value: impact.after.email },
    { label: 'Phiên bị đăng xuất', value: impact.active_session_count, tone: impact.active_session_count ? 'warning' : undefined },
    { label: 'OAuth bị gỡ', value: impact.oauth_providers_to_revoke.join(', ') || 'Không có' },
  ] : []

  return (
    <ActionDialog
      loading={impactState.submitting}
      onCancel={close}
      onSubmit={submit}
      open={open}
      submitDisabled={!ready || impact?.can_apply === false}
      submitLabel="Đổi email"
      target={account?.email}
      title="Khôi phục email đăng nhập"
      tone="danger"
      width={640}
    >
      <AccountVerificationSummary account={account} />
      <Form form={form} layout="vertical" requiredMark clearOnDestroy initialValues={{ reason: '' }}>
        <div className="action-dialog__fields">
          <Form.Item
            name="email"
            label="Email đăng nhập mới"
            rules={[
              { required: true, message: 'Nhập email đăng nhập mới.' },
              { type: 'email', message: 'Email không hợp lệ.' },
            ]}
          >
            <Input autoComplete="off" placeholder="email-moi@example.com…" spellCheck={false} type="email" />
          </Form.Item>
          <ReasonField label="Lý do khôi phục" presets={RECOVERY_REASONS} />
          <ReasonField
            extra="Thời điểm, kênh xác minh và ít nhất hai thông tin đã đối chiếu với hồ sơ."
            label="Bằng chứng xác minh"
            minLength={20}
            name="verification_evidence"
          />
        </div>
      </Form>
      {ready ? (
        <ImpactFacts
          changed={impactState.changed}
          error={impactState.error}
          facts={facts}
          loading={impactState.loading}
          notes={[
            'Mật khẩu hiện tại bị vô hiệu hóa; người dùng phải đặt lại và xác minh email mới.',
            ...(impact && !impact.password_reset_available
              ? ['Phải mở lại tài khoản trước khi gửi liên kết đặt lại mật khẩu.']
              : []),
          ]}
          onRetry={impactState.reload}
        />
      ) : (
        <p className="action-dialog__lead">Nhập email mới và bằng chứng xác minh để xem tác động.</p>
      )}
    </ActionDialog>
  )
}
