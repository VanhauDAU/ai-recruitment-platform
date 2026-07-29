import { Alert, Descriptions, Form, Input, Select } from 'antd'
import { AccountVerificationSummary } from '@/entities/admin-account'
import { effectDescription, operationTitle } from '../model/status-operation'
import { StatusTag } from './AccountStatusImpactPreview'

const VIOLATION_OPTIONS = [
  { value: 'security', label: 'An toàn / bảo mật' },
  { value: 'fraud', label: 'Gian lận / giả mạo' },
  { value: 'policy', label: 'Vi phạm chính sách' },
  { value: 'legal', label: 'Yêu cầu pháp lý' },
  { value: 'other', label: 'Khác' },
]

export default function AccountStatusActionForm({
  account,
  form,
  operation,
  requiresEvidence,
}) {
  return (
    <div className="space-y-4">
      <AccountVerificationSummary account={account} />
      <Alert
        showIcon
        type={operation?.status === 'banned' ? 'error' : 'warning'}
        title={operationTitle(operation)}
        description={effectDescription(operation, account)}
      />
      <Form
        form={form}
        layout="vertical"
        requiredMark
        initialValues={{
          reason: '',
          enforcement_evidence: '',
          violation_category: '',
        }}
        scrollToFirstError={{ focus: true }}
      >
        {operation?.kind === 'status' && (
          <Descriptions bordered size="small" column={2} className="mb-4">
            <Descriptions.Item label="Hiện tại">
              <StatusTag status={account.status} />
            </Descriptions.Item>
            <Descriptions.Item label="Sau thao tác">
              <StatusTag status={operation.status} />
            </Descriptions.Item>
          </Descriptions>
        )}
        {operation?.status === 'banned' && (
          <Form.Item
            name="violation_category"
            label="Nhóm vi phạm"
            rules={[{ required: true, message: 'Chọn nhóm vi phạm.' }]}
          >
            <Select
              placeholder="Chọn nhóm vi phạm đã được xác minh"
              options={VIOLATION_OPTIONS}
            />
          </Form.Item>
        )}
        <Form.Item
          name="reason"
          label="Lý do xử lý"
          extra="Nêu quyết định vận hành ngắn gọn; nội dung này được ghi vào audit log."
          rules={[
            { required: true, whitespace: true, message: 'Nhập lý do thao tác.' },
            { max: 500, message: 'Tối đa 500 ký tự.' },
          ]}
        >
          <Input.TextArea
            rows={4}
            maxLength={500}
            showCount
            placeholder="Ví dụ: Tạm khóa theo yêu cầu chủ tài khoản sau khi phát hiện phiên đăng nhập bất thường."
          />
        </Form.Item>
        {requiresEvidence && (
          <Form.Item
            name="enforcement_evidence"
            label="Bằng chứng xác minh / xử lý"
            extra="20–500 ký tự. Không đưa mật khẩu, token, mã OTP hoặc bí mật vào đây."
            rules={[
              { required: true, whitespace: true, message: 'Nhập bằng chứng xử lý.' },
              { min: 20, message: 'Cần ít nhất 20 ký tự.' },
              { max: 500, message: 'Tối đa 500 ký tự.' },
            ]}
          >
            <Input.TextArea
              rows={5}
              minLength={20}
              maxLength={500}
              showCount
              placeholder="Ghi nguồn đối chiếu, mã ticket/biên bản và kết quả xác minh ngoài hệ thống."
            />
          </Form.Item>
        )}
      </Form>
    </div>
  )
}
