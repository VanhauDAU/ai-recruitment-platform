import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Form,
  Input,
  Modal,
  Space,
  Tag,
  Typography,
} from 'antd'
import { useState } from 'react'
import {
  changeAdminEmployerVerificationLifecycle,
  decideAdminEmployerVerification,
  getAdminEmployerDecisionImpact,
  getAdminEmployerLifecycleImpact,
  verificationStatusMeta,
} from '@/entities/admin-employer-verification'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

const DECISION_ACTIONS = {
  approved: { label: 'Duyệt hồ sơ', color: 'primary' },
  changes_requested: { label: 'Yêu cầu bổ sung', color: 'default' },
  rejected: { label: 'Từ chối hồ sơ', danger: true },
}

const LIFECYCLE_ACTIONS = {
  revoked: { label: 'Thu hồi xác thực', danger: true, icon: <StopOutlined /> },
  expired: { label: 'Đánh dấu hết hiệu lực', icon: <ClockCircleOutlined /> },
}

const TAX_STATUS_LABELS = {
  missing: 'Chưa có bằng chứng tra cứu',
  pending: 'Đang chờ tra cứu',
  matched: 'Khớp nguồn tham chiếu',
  mismatch: 'Không khớp',
  not_found: 'Không tìm thấy',
  unavailable: 'Nguồn tra cứu không khả dụng',
  invalid: 'Bằng chứng không hợp lệ',
}

function impactCompanyCopy(impact) {
  if (impact?.company_impact?.will_mark_verified) {
    return 'Công ty sẽ được đánh dấu đã xác thực khi xác nhận.'
  }
  if (impact?.company_impact?.will_downgrade === false) {
    return 'Trạng thái pháp lý của công ty không bị hạ.'
  }
  return 'Không thay đổi trạng thái pháp lý của công ty.'
}

function ImpactSummary({ impact, mode }) {
  const resources = impact.resources || impact.verification_hold_impact || {}
  return (
    <div className="space-y-3" data-testid="verification-impact-summary">
      <Alert
        showIcon
        type="warning"
        title="Kiểm tra tác động trước khi xác nhận"
        description={impactCompanyCopy(impact)}
      />
      <Descriptions bordered size="small" column={1}>
        {impact.tax_advisory && (
          <Descriptions.Item label="Đối chiếu mã số thuế">
            <Space wrap>
              <Tag color={impact.tax_advisory.status === 'matched' ? 'green' : 'orange'}>
                {TAX_STATUS_LABELS[impact.tax_advisory.status]
                  || impact.tax_advisory.status}
              </Tag>
              {impact.tax_override && <Tag color="volcano">Sử dụng override</Tag>}
            </Space>
          </Descriptions.Item>
        )}
        <Descriptions.Item label="Quyền sau quyết định">
          {mode.type === 'lifecycle'
            ? 'Khóa dữ liệu ứng viên và duyệt tin; workspace/tạo/sửa/gửi tin giữ nguyên.'
            : 'Backend sẽ tính lại readiness và quyền sau khi commit.'}
        </Descriptions.Item>
        <Descriptions.Item label="Tài nguyên bị tác động">
          {`${resources.campaign_count || 0} chiến dịch · ${resources.job_count || 0} tin`}
          {Number.isInteger(resources.active_jobs_hidden_from_public)
            && ` · ${resources.active_jobs_hidden_from_public} tin active sẽ bị ẩn`}
          {Number.isInteger(resources.active_jobs_to_unhide)
            && ` · ${resources.active_jobs_to_unhide} tin có thể hiện lại`}
        </Descriptions.Item>
      </Descriptions>
    </div>
  )
}

function workflowPayload(mode, values) {
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
  canTaxOverride,
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
      currentMode.type === 'decision'
        ? decideAdminEmployerVerification(verificationCase.public_id, payload)
        : changeAdminEmployerVerificationLifecycle(
          verificationCase.public_id,
          currentMode.action,
          payload,
        )
    ),
    onSuccess: async () => {
      message.success('Đã ghi nhận quyết định xác thực nhà tuyển dụng.')
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
    setMode({ type, action })
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
  const modalMeta = mode?.type === 'lifecycle'
    ? LIFECYCLE_ACTIONS[mode.action]
    : DECISION_ACTIONS[mode?.action]

  return (
    <Card
      size="small"
      className="account-detail-card verification-final-decision-card"
      title="Quyết định cuối hồ sơ"
      extra={<Tag color={statusMeta.color}>{statusMeta.label}</Tag>}
    >
      {isReviewing && (
        <Alert
          showIcon
          type="info"
          icon={<CheckCircleOutlined />}
          title="Giấy tờ và hồ sơ là hai lớp quyết định độc lập"
          description="Duyệt hết giấy tờ không tự duyệt hồ sơ. Hãy preview tác động trước quyết định cuối."
        />
      )}
      {isApproved && (
        <Alert
          showIcon
          type="success"
          title="Hồ sơ đang có hiệu lực"
          description="Thu hồi hoặc đánh dấu hết hiệu lực không hạ trạng thái pháp lý của công ty."
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
      {!isReviewing && !isApproved && !isInactive && (
        <Typography.Text type="secondary">
          Hồ sơ phải ở trạng thái Đang xử lý trước khi admin đưa ra quyết định cuối.
        </Typography.Text>
      )}

      <Space wrap className="verification-final-actions mt-4">
        {isReviewing && canReview && Object.entries(DECISION_ACTIONS).map(([action, meta]) => (
          <Button
            key={action}
            type={meta.color}
            danger={meta.danger}
            onClick={() => openWorkflow('decision', action)}
          >
            {meta.label}
          </Button>
        ))}
        {isApproved && canRevoke && Object.entries(LIFECYCLE_ACTIONS).map(([action, meta]) => (
          <Button
            key={action}
            danger={meta.danger}
            icon={meta.icon}
            aria-label={meta.label}
            onClick={() => openWorkflow('lifecycle', action)}
          >
            {meta.label}
          </Button>
        ))}
      </Space>

      {verificationCase.decision_reason && (
        <Typography.Paragraph className="!mb-0 !mt-4" type="secondary">
          <strong>Lý do gần nhất:</strong> {verificationCase.decision_reason}
        </Typography.Paragraph>
      )}

      <Modal
        className="verification-final-modal"
        open={Boolean(mode)}
        title={modalMeta?.label || 'Xử lý xác thực'}
        okText={impact ? 'Xác nhận quyết định' : 'Xem tác động'}
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
                  const required = mode?.type === 'lifecycle' || mode?.action !== 'approved'
                  if (!required || value?.trim()) return Promise.resolve()
                  return Promise.reject(new Error('Nhập lý do trước khi tiếp tục.'))
                },
              },
              { max: 2000, message: 'Tối đa 2.000 ký tự.' },
            ]}
          >
            <Input.TextArea rows={3} maxLength={2000} showCount />
          </Form.Item>

          {mode?.type === 'decision' && mode.action === 'approved' && canTaxOverride && (
            <>
              <Form.Item name="tax_override" valuePropName="checked">
                <Checkbox>Cho phép override kết quả tra cứu thuế advisory</Checkbox>
              </Form.Item>
              {taxOverride && (
                <Form.Item
                  name="tax_override_reason"
                  label="Lý do override mã số thuế"
                  rules={[
                    {
                      validator: (_, value) => value?.trim()
                        ? Promise.resolve()
                        : Promise.reject(new Error('Nhập lý do override để lưu audit.')),
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
        {impact && <ImpactSummary impact={impact} mode={mode} />}
      </Modal>
    </Card>
  )
}
