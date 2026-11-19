import {
  CheckCircleFilled,
  ClockCircleOutlined,
  StopOutlined,
  UnlockOutlined,
} from '@ant-design/icons'
import { Alert, Button, Card, Checkbox, Form, Tag, Typography } from 'antd'
import { useState } from 'react'
import {
  CASE_DECISION_REASONS,
  changeAdminEmployerVerificationLifecycle,
  decideAdminEmployerVerification,
  getAdminEmployerDecisionImpact,
  getAdminEmployerLifecycleImpact,
  unlockAdminEmployerVerificationResubmission,
  verificationStatusMeta,
} from '@/entities/company/admin-employer-verification'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import ActionDialog from '@/shared/ui/confirm-action/ActionDialog'
import ImpactFacts from '@/shared/ui/confirm-action/ImpactFacts'
import ReasonField from '@/shared/ui/confirm-action/ReasonField'
import useImpactConfirmation from '@/shared/ui/confirm-action/use-impact-confirmation'
import { decisionImpactFacts } from '../model/decision-impact-facts'
import { getTaxReviewState } from '../model/tax-review-state'
import useNextVerificationCase from '../model/use-next-verification-case'

const DECISION_ACTIONS = {
  approved: { label: 'Duyệt hồ sơ', type: 'primary', done: 'Đã duyệt hồ sơ' },
  changes_requested: { label: 'Yêu cầu bổ sung', done: 'Đã yêu cầu bổ sung' },
  rejected: { label: 'Từ chối hồ sơ', danger: true, done: 'Đã từ chối hồ sơ' },
}

const LIFECYCLE_ACTIONS = {
  revoked: { label: 'Thu hồi xác thực', danger: true, icon: <StopOutlined />, done: 'Đã thu hồi xác thực' },
  expired: { label: 'Đánh dấu hết hiệu lực', icon: <ClockCircleOutlined />, done: 'Đã đánh dấu hết hiệu lực' },
}

const UNLOCK_ACTION = { label: 'Mở khóa nộp lại', icon: <UnlockOutlined />, done: 'Đã mở khóa nộp lại' }

function actionMeta(mode) {
  if (mode?.type === 'unlock') return UNLOCK_ACTION
  if (mode?.type === 'lifecycle') return LIFECYCLE_ACTIONS[mode.action]
  return DECISION_ACTIONS[mode?.action]
}

function workflowPayload(mode, values = {}) {
  const reason = (values.reason || '').trim()
  if (mode.type === 'unlock') return { reason, lock_version: mode.lockVersion }
  if (mode.type === 'lifecycle') return { reason }
  return {
    decision: mode.action,
    reason,
    tax_override: Boolean(values.tax_override),
    tax_override_reason: (values.tax_override_reason || '').trim(),
  }
}

function StatusNote({ verificationCase, isResubmissionLocked }) {
  const status = verificationCase.status
  if (status === 'in_review') {
    return <Typography.Text type="secondary">Duyệt từng giấy tờ, rồi ra một quyết định chung cho hồ sơ.</Typography.Text>
  }
  if (status === 'approved') return <Alert showIcon type="success" title="Hồ sơ đang có hiệu lực" />
  if (['revoked', 'expired'].includes(status)) {
    return <Alert showIcon type="warning" title="Xác thực không còn hiệu lực · NTD phải nộp lại để được duyệt lại" />
  }
  if (['changes_requested', 'rejected'].includes(status)) {
    return (
      <Alert
        showIcon
        type="warning"
        title={isResubmissionLocked
          ? 'Đã khóa nộp lại do đạt giới hạn từ chối · NTD vẫn xem lý do và gửi khiếu nại'
          : 'Đang chờ nhà tuyển dụng nộp lại'}
      />
    )
  }
  if (status === 'pending' && verificationCase.revision > 1) {
    return <Alert showIcon type="info" title={`NTD đã nộp lại lần ${verificationCase.revision} · nhận xử lý để ra quyết định`} />
  }
  return <Typography.Text type="secondary">Nhận xử lý hồ sơ trước khi ra quyết định cuối.</Typography.Text>
}

export default function VerificationFinalDecisionPanel({ verificationCase, taxEvidence, onChanged }) {
  const [form] = Form.useForm()
  const [mode, setMode] = useState(null)
  const [unlocking, setUnlocking] = useState(false)
  const [decided, setDecided] = useState(null)
  const taxOverride = Form.useWatch('tax_override', form)
  const caseId = verificationCase.public_id
  const taxReview = getTaxReviewState(taxEvidence)
  const needsTaxConfirm = mode?.type === 'decision' && mode.action === 'approved'
    && taxReview.requiresManualApproval
  const meta = actionMeta(mode)

  const impactState = useImpactConfirmation({
    open: Boolean(mode) && mode.type !== 'unlock',
    ready: !needsTaxConfirm || Boolean(taxOverride),
    previewKey: `${mode?.type}:${mode?.action}:${taxOverride ? 1 : 0}`,
    preview: (values) => {
      const payload = workflowPayload(mode, values || { tax_override: taxOverride })
      return mode.type === 'decision'
        ? getAdminEmployerDecisionImpact(caseId, payload)
        : getAdminEmployerLifecycleImpact(caseId, mode.action, payload)
    },
    confirm: (impact, values) => {
      const payload = { ...workflowPayload(mode, values), impact_token: impact.impact_token }
      return mode.type === 'decision'
        ? decideAdminEmployerVerification(caseId, payload)
        : changeAdminEmployerVerificationLifecycle(caseId, mode.action, payload)
    },
  })
  const nextCase = useNextVerificationCase(caseId, {
    enabled: decided?.caseId === caseId && decided.type === 'decision',
  })

  const close = () => {
    if (impactState.submitting || unlocking) return
    setMode(null)
    form.resetFields()
  }
  const openWorkflow = (type, action) => {
    form.resetFields()
    setMode({ type, action, lockVersion: verificationCase.lock_version })
  }

  const submit = async () => {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    try {
      if (mode.type === 'unlock') {
        setUnlocking(true)
        await unlockAdminEmployerVerificationResubmission(caseId, workflowPayload(mode, values))
      } else if (!(await impactState.submit(values))) {
        return
      }
      message.success(`${meta.done}.`)
      setDecided({ caseId, type: mode.type, label: meta.done })
      setMode(null)
      form.resetFields()
      await onChanged?.()
    } catch (error) {
      const stale = error?.response?.status === 409
      message.error(stale
        ? 'Hồ sơ vừa thay đổi. Dữ liệu đã được tải lại, hãy kiểm tra rồi thao tác lại.'
        : getApiErrorMessage(error))
      if (stale) await onChanged?.()
    } finally {
      setUnlocking(false)
    }
  }

  const statusMeta = verificationStatusMeta(verificationCase.status)
  const isReviewing = verificationCase.status === 'in_review'
  const isApproved = verificationCase.status === 'approved'
  const isResubmissionLocked = Boolean(verificationCase.resubmission_locked_at)
  const rejectionCount = Number(verificationCase.final_rejection_count || 0)
  const rejectionLimit = Number(verificationCase.rejection_limit || 3)
  const reasonRequired = mode?.type !== 'decision' || mode.action !== 'approved'
  const { facts, notes } = decisionImpactFacts(impactState.impact, { lifecycle: mode?.type === 'lifecycle' })
  const showNext = decided?.caseId === caseId && decided.type === 'decision'

  return (
    <Card
      size="small"
      className="account-detail-card verification-final-decision-card"
      title="2. Quyết định hồ sơ"
      extra={<Tag color={statusMeta.color}>{statusMeta.label}</Tag>}
    >
      {showNext && (
        <div className="verification-next-case" role="status">
          <span className="verification-next-case__done">
            <CheckCircleFilled aria-hidden="true" /> {decided.label}
          </span>
          {nextCase.next ? (
            <Button type="primary" onClick={nextCase.goNext}>
              {`Hồ sơ tiếp theo (còn ${nextCase.remaining})`}
            </Button>
          ) : (
            <Typography.Text type="secondary">
              {nextCase.loading ? 'Đang tìm hồ sơ tiếp theo…' : 'Đã hết hồ sơ chờ duyệt'}
            </Typography.Text>
          )}
        </div>
      )}
      <StatusNote verificationCase={verificationCase} isResubmissionLocked={isResubmissionLocked} />
      {rejectionCount > 0 && (
        <div className="verification-rejection-meter">
          <Typography.Text strong>Số quyết định từ chối cuối</Typography.Text>
          <Tag color={isResubmissionLocked ? 'red' : 'orange'}>{`${rejectionCount}/${rejectionLimit}`}</Tag>
        </div>
      )}

      <div className="verification-final-actions mt-4">
        {isReviewing && Object.entries(DECISION_ACTIONS).map(([action, item]) => (
          <Button
            key={action}
            className={`verification-final-action is-${action}`}
            type={item.type}
            danger={item.danger}
            disabled={action === 'approved' && taxReview.blocksApproval}
            title={action === 'approved' && taxReview.blocksApproval ? taxReview.message : undefined}
            onClick={() => openWorkflow('decision', action)}
          >
            {item.label}
          </Button>
        ))}
        {isApproved && Object.entries(LIFECYCLE_ACTIONS).map(([action, item]) => (
          <Button
            key={action}
            className={`verification-final-action is-${action}`}
            danger={item.danger}
            icon={item.icon}
            aria-label={item.label}
            onClick={() => openWorkflow('lifecycle', action)}
          >
            {item.label}
          </Button>
        ))}
        {isResubmissionLocked && (
          <Button
            className="verification-final-action is-unlock"
            icon={<UnlockOutlined />}
            onClick={() => openWorkflow('unlock', 'unlock')}
          >
            Mở khóa nộp lại
          </Button>
        )}
      </div>

      {verificationCase.decision_reason && (
        <Typography.Paragraph className="!mb-0 !mt-4" type="secondary">
          <strong>Lý do gần nhất:</strong> {verificationCase.decision_reason}
        </Typography.Paragraph>
      )}

      <ActionDialog
        loading={impactState.submitting || unlocking}
        onCancel={close}
        onSubmit={submit}
        open={Boolean(mode)}
        submitDisabled={impactState.impact?.can_apply === false}
        submitLabel={meta?.label}
        target={[verificationCase.full_name || verificationCase.email, verificationCase.company?.name]
          .filter(Boolean).join(' · ')}
        title={meta?.label || 'Xử lý xác thực'}
        tone={meta?.danger ? 'danger' : 'default'}
      >
        <Form form={form} layout="vertical" requiredMark={false} initialValues={{ tax_override: false }}>
          <div className="action-dialog__fields">
            {needsTaxConfirm && (
              <>
                <Alert showIcon type="warning" title={`${taxReview.message} Chỉ duyệt khi đã đối chiếu giấy tờ gốc.`} />
                <Form.Item
                  name="tax_override"
                  valuePropName="checked"
                  rules={[{
                    validator: (_, value) => value
                      ? Promise.resolve()
                      : Promise.reject(new Error('Xác nhận đã đối chiếu giấy tờ gốc trước khi duyệt.')),
                  }]}
                >
                  <Checkbox>Tôi đã đối chiếu giấy tờ gốc và chịu trách nhiệm duyệt thủ công</Checkbox>
                </Form.Item>
                {taxOverride && (
                  <ReasonField label="Căn cứ duyệt thủ công" maxLength={2000} name="tax_override_reason" />
                )}
              </>
            )}
            <ReasonField
              label={reasonRequired ? 'Lý do' : 'Ghi chú (không bắt buộc)'}
              maxLength={2000}
              presets={CASE_DECISION_REASONS[mode?.action] || []}
              required={reasonRequired}
            />
          </div>
        </Form>
        {mode?.type !== 'unlock' && (
          <ImpactFacts
            changed={impactState.changed}
            error={impactState.error}
            facts={facts}
            loading={impactState.loading}
            notes={notes}
            onRetry={impactState.reload}
          />
        )}
      </ActionDialog>
    </Card>
  )
}
