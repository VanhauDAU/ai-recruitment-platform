import {
  ClockCircleOutlined,
  StopOutlined,
  UnlockOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Modal,
  Tag,
  Typography,
} from 'antd'
import { useState } from 'react'
import {
  changeAdminEmployerVerificationLifecycle,
  decideAdminEmployerVerification,
  getAdminEmployerDecisionImpact,
  getAdminEmployerLifecycleImpact,
  unlockAdminEmployerVerificationResubmission,
  verificationStatusMeta,
} from '@/entities/admin-employer-verification'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { getTaxReviewState } from '../model/tax-review-state'
import VerificationDecisionImpactSummary from './VerificationDecisionImpactSummary'

const DECISION_ACTIONS = {
  approved: { label: 'Duyệt hồ sơ', color: 'primary' },
  changes_requested: { label: 'Yêu cầu bổ sung', color: 'default' },
  rejected: { label: 'Từ chối hồ sơ', danger: true },
}

const LIFECYCLE_ACTIONS = {
  revoked: { label: 'Thu hồi xác thực', danger: true, icon: <StopOutlined /> },
  expired: { label: 'Đánh dấu hết hiệu lực', icon: <ClockCircleOutlined /> },
}

function workflowPayload(mode, values) {
  if (mode.type === 'unlock') {
    return {
      reason: values.reason.trim(),
      lock_version: mode.lockVersion,
    }
  }
  if (mode.type === 'lifecycle') return { reason: values.reason.trim() }
  return {
    decision: mode.action,
    reason: values.reason?.trim() || '',
    tax_override: Boolean(values.tax_override),
    tax_override_reason: values.tax_override_reason?.trim() || '',
  }
}

export default function VerificationFinalDecisionPanel({
  verificationCase,
  canReview,
  canRevoke,
  canUnlockResubmission,
  canTaxOverride,
  taxEvidence,
  onChanged,
}) {
  const [form] = Form.useForm()
  const [mode, setMode] = useState(null)
  const [impact, setImpact] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const taxOverride = Form.useWatch('tax_override', form)

  const close = () => {
    if (previewMutation.isPending || confirmMutation.isPending) return
    setMode(null)
    setImpact(null)
    setErrorMessage('')
    form.resetFields()
  }

  const previewMutation = useMutation({
    mutationFn: ({ currentMode, payload }) => (
      currentMode.type === 'decision'
        ? getAdminEmployerDecisionImpact(verificationCase.public_id, payload)
        : getAdminEmployerLifecycleImpact(
          verificationCase.public_id,
          currentMode.action,
          payload,
        )
    ),
    onSuccess: (result) => {
      setErrorMessage('')
      setImpact(result)
    },
    onError: (error) => {
      setImpact(null)
      setErrorMessage(getApiErrorMessage(error))
    },
  })

  const confirmMutation = useMutation({
    mutationFn: ({ currentMode, payload }) => (
      currentMode.type === 'unlock'
        ? unlockAdminEmployerVerificationResubmission(
          verificationCase.public_id,
          payload,
        )
        : currentMode.type === 'decision'
        ? decideAdminEmployerVerification(verificationCase.public_id, payload)
        : changeAdminEmployerVerificationLifecycle(
          verificationCase.public_id,
          currentMode.action,
          payload,
        )
    ),
    onSuccess: async () => {
      message.success(mode?.type === 'unlock'
        ? 'Đã mở khóa để nhà tuyển dụng có thể nộp lại hồ sơ.'
        : 'Đã ghi nhận quyết định xác thực nhà tuyển dụng.')
      setMode(null)
      setImpact(null)
      setErrorMessage('')
      form.resetFields()
      await onChanged?.()
    },
    onError: async (error) => {
      const stale = error?.response?.status === 409
        && error.response?.data?.code === 'admin_resource_changed'
      setImpact(null)
      setErrorMessage(stale
        ? 'Hồ sơ hoặc tài nguyên đã thay đổi. Dữ liệu đã được tải lại; vui lòng xem tác động lần nữa.'
        : getApiErrorMessage(error))
      if (stale) await onChanged?.()
    },
  })

  const openWorkflow = (type, action) => {
    setMode({ type, action, lockVersion: verificationCase.lock_version })
    setImpact(null)
    setErrorMessage('')
    form.setFieldsValue({
      reason: '',
      tax_override: false,
      tax_override_reason: '',
    })
  }

  const submit = async () => {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    const payload = workflowPayload(mode, values)
    if (mode.type === 'unlock') {
      confirmMutation.mutate({ currentMode: mode, payload })
      return
    }
    if (!impact) {
      previewMutation.mutate({ currentMode: mode, payload })
      return
    }
    confirmMutation.mutate({
      currentMode: mode,
      payload: { ...payload, impact_token: impact.impact_token },
    })
  }

  const statusMeta = verificationStatusMeta(verificationCase.status)
  const isReviewing = verificationCase.status === 'in_review'
  const isApproved = verificationCase.status === 'approved'
  const isInactive = ['revoked', 'expired'].includes(verificationCase.status)
  const isAwaitingResubmission = ['changes_requested', 'rejected'].includes(
    verificationCase.status,
  )
  const isResubmittedPending = verificationCase.status === 'pending'
    && verificationCase.revision > 1
  const isResubmissionLocked = Boolean(verificationCase.resubmission_locked_at)
  const rejectionCount = Number(verificationCase.final_rejection_count || 0)
  const rejectionLimit = Number(verificationCase.rejection_limit || 3)
  const taxReview = getTaxReviewState(taxEvidence)
  const manualApprovalUnavailable = taxReview.requiresManualApproval && !canTaxOverride
  const approvalUnavailable = taxReview.blocksApproval || manualApprovalUnavailable
  const modalMeta = mode?.type === 'unlock'
    ? { label: 'Mở khóa nộp lại', icon: <UnlockOutlined /> }
    : mode?.type === 'lifecycle'
    ? LIFECYCLE_ACTIONS[mode.action]
    : DECISION_ACTIONS[mode?.action]

  return (
    <Card
      size="small"
      className="account-detail-card verification-final-decision-card"
      title="2. Quyết định hồ sơ"
      extra={<Tag color={statusMeta.color}>{statusMeta.label}</Tag>}
    >
      {isReviewing && (
        <Typography.Paragraph className="!mb-0" type="secondary">
          Duyệt từng giấy tờ trước, sau đó ra một quyết định chung cho hồ sơ.
        </Typography.Paragraph>
      )}
      {isApproved && (
        <Alert
          showIcon
          type="success"
          title="Hồ sơ đang có hiệu lực"
          description="Quyết định này áp dụng riêng cho nhà tuyển dụng đang được duyệt."
        />
      )}
      {isInactive && (
        <Alert
          showIcon
          type="warning"
          icon={<WarningOutlined />}
          title="Xác thực recruiter không còn hiệu lực"
          description="Recruiter phải bổ sung và nộp lại; admin nhận xử lý trước khi có thể duyệt lại."
        />
      )}
      {isAwaitingResubmission && (
        <Alert
          showIcon
          type="warning"
          icon={<WarningOutlined />}
          title="Đang chờ nhà tuyển dụng nộp lại"
          description={isResubmissionLocked
            ? 'Hồ sơ đã đạt giới hạn từ chối cuối và đang khóa nộp lại. Nhà tuyển dụng vẫn đăng nhập, xem lý do và có thể gửi khiếu nại; chỉ người có quyền rủi ro cao mới được mở khóa.'
            : 'Khi mọi giấy tờ bị yêu cầu sửa hoặc từ chối đã được thay, hồ sơ sẽ tự chuyển về Chờ xử lý với một phiên mới. Admin có thể nhận xử lý và ra quyết định cuối lần nữa.'}
        />
      )}
      {rejectionCount > 0 && (
        <div className="verification-rejection-meter">
          <Typography.Text strong>Số quyết định từ chối cuối</Typography.Text>
          <Tag color={isResubmissionLocked ? 'red' : 'orange'}>
            {`${rejectionCount}/${rejectionLimit}`}
          </Tag>
        </div>
      )}
      {isResubmittedPending && (
        <Alert
          showIcon
          type="info"
          title={`Nhà tuyển dụng đã nộp lại hồ sơ lần ${verificationCase.revision}`}
          description="Hãy nhận xử lý lại ở phần đầu trang. Sau khi đối chiếu giấy tờ, các quyết định cuối sẽ được mở lại."
        />
      )}
      {!isReviewing && !isApproved && !isInactive && !isAwaitingResubmission
        && !isResubmittedPending && (
        <Typography.Text type="secondary">
          Hồ sơ phải ở trạng thái Đang xử lý trước khi admin đưa ra quyết định cuối.
        </Typography.Text>
      )}

      <div className="verification-final-actions mt-4">
        {isReviewing && canReview && Object.entries(DECISION_ACTIONS).map(([action, meta]) => (
          <Button
            key={action}
            className={`verification-final-action is-${action}`}
            type={meta.color}
            danger={meta.danger}
            disabled={action === 'approved' && approvalUnavailable}
            title={action === 'approved' && approvalUnavailable
              ? taxReview.blocksApproval
                ? taxReview.message
                : 'Bạn không có quyền duyệt thủ công khi nguồn thuế chưa xác nhận được hồ sơ.'
              : undefined}
            onClick={() => openWorkflow('decision', action)}
          >
            {meta.label}
          </Button>
        ))}
        {isApproved && canRevoke && Object.entries(LIFECYCLE_ACTIONS).map(([action, meta]) => (
          <Button
            key={action}
            className={`verification-final-action is-${action}`}
            danger={meta.danger}
            icon={meta.icon}
            aria-label={meta.label}
            onClick={() => openWorkflow('lifecycle', action)}
          >
            {meta.label}
          </Button>
        ))}
        {isResubmissionLocked && canUnlockResubmission && (
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

      <Modal
        className="verification-final-modal"
        open={Boolean(mode)}
        title={modalMeta?.label || 'Xử lý xác thực'}
        okText={mode?.type === 'unlock'
          ? 'Xác nhận mở khóa'
          : impact
            ? mode?.action === 'approved' ? 'Xác nhận duyệt hồ sơ' : 'Xác nhận quyết định'
            : mode?.action === 'approved' ? 'Kiểm tra trước khi duyệt' : 'Xem tác động'}
        cancelText="Hủy"
        okButtonProps={{ danger: Boolean(modalMeta?.danger) }}
        confirmLoading={previewMutation.isPending || confirmMutation.isPending}
        onCancel={close}
        onOk={submit}
        destroyOnHidden
        width={680}
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          onValuesChange={() => {
            setImpact(null)
            setErrorMessage('')
          }}
        >
          <Form.Item
            name="reason"
            label="Lý do / ghi chú audit"
            rules={[
              {
                validator: (_, value) => {
                  const required = mode?.type === 'lifecycle'
                    || mode?.type === 'unlock'
                    || mode?.action !== 'approved'
                  if (!required || value?.trim()) return Promise.resolve()
                  return Promise.reject(new Error('Nhập lý do trước khi tiếp tục.'))
                },
              },
              { max: 2000, message: 'Tối đa 2.000 ký tự.' },
            ]}
          >
            <Input.TextArea rows={3} maxLength={2000} showCount />
          </Form.Item>

          {mode?.type === 'decision'
            && mode.action === 'approved'
            && taxReview.requiresManualApproval && (
            <>
              <Alert
                className="mb-4"
                showIcon
                type="warning"
                title="Cần xác nhận duyệt thủ công"
                description={`${taxReview.message} Chỉ tiếp tục nếu bạn đã đối chiếu giấy tờ pháp lý gốc và chịu trách nhiệm về quyết định này.`}
              />
              <Form.Item
                name="tax_override"
                valuePropName="checked"
                rules={[{
                  validator: (_, value) => value
                    ? Promise.resolve()
                    : Promise.reject(new Error('Xác nhận đã đối chiếu giấy tờ gốc trước khi tiếp tục.')),
                }]}
              >
                <Checkbox>Tôi đã đối chiếu giấy tờ gốc và muốn tiếp tục duyệt</Checkbox>
              </Form.Item>
              {taxOverride && (
                <Form.Item
                  name="tax_override_reason"
                  label="Lý do duyệt thủ công"
                  rules={[
                    {
                      validator: (_, value) => value?.trim()
                        ? Promise.resolve()
                        : Promise.reject(new Error('Nhập căn cứ duyệt thủ công để lưu audit.')),
                    },
                    { max: 2000, message: 'Tối đa 2.000 ký tự.' },
                  ]}
                >
                  <Input.TextArea rows={3} maxLength={2000} showCount />
                </Form.Item>
              )}
            </>
          )}
        </Form>

        {errorMessage && (
          <Alert className="mb-3" showIcon type="error" title={errorMessage} />
        )}
        {impact && (
          <VerificationDecisionImpactSummary
            impact={impact}
            lifecycle={mode.type === 'lifecycle'}
          />
        )}
      </Modal>
    </Card>
  )
}
