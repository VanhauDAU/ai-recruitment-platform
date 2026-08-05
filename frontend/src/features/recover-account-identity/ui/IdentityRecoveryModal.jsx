import { useQueryClient } from '@tanstack/react-query'
import { Alert, Descriptions, Form, Input, Modal, Tag, Typography } from 'antd'
import { useEffect, useState } from 'react'
import {
  AccountVerificationSummary,
  adminAccountKeys,
  changeAccountEmail,
  getAccountEmailImpact,
  getAccountMfaResetImpact,
  resetAccountMfa,
} from '@/entities/admin-account'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

const METHOD_LABELS = {
  email: 'Email',
  totp: 'Ứng dụng xác thực',
}

function enabledMfaLabels(methods = {}) {
  const labels = Object.entries(METHOD_LABELS)
    .filter(([key]) => methods[key])
    .map(([, label]) => label)
  if (methods.backup_codes_remaining) {
    labels.push(`${methods.backup_codes_remaining} mã dự phòng`)
  }
  return labels
}

export default function IdentityRecoveryModal({
  account,
  kind,
  onClose,
  onSuccess,
  open,
  publicId,
}) {
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [values, setValues] = useState(null)
  const isEmail = kind === 'email'

  useEffect(() => {
    if (!open) {
      setPreview(null)
      setValues(null)
    }
  }, [open])

  const loadPreview = async (payload) => {
    const next = {
      ...payload,
      reason: payload.reason.trim(),
      verification_evidence: payload.verification_evidence.trim(),
    }
    if (isEmail) next.email = payload.email.trim().toLowerCase()
    setLoading(true)
    try {
      const result = isEmail
        ? await getAccountEmailImpact(publicId, next)
        : await getAccountMfaResetImpact(publicId, next)
      setValues(next)
      setPreview(result)
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể tải tác động khôi phục.'))
    } finally {
      setLoading(false)
    }
  }

  const confirm = async () => {
    setLoading(true)
    try {
      let result
      if (isEmail) {
        result = await changeAccountEmail(publicId, values, preview.impact_token)
        message.success(
          'Đã đổi email, thu hồi phiên/OAuth và vô hiệu hóa mật khẩu cũ. Hãy đặt lại MFA nếu cần rồi gửi liên kết đặt lại mật khẩu.',
        )
      } else {
        result = await resetAccountMfa(publicId, values, preview.impact_token)
        message.success(
          'Đã đặt lại MFA và thu hồi mọi phiên. Hãy gửi lại liên kết đặt lại mật khẩu nếu đang khôi phục danh tính.',
        )
      }
      await queryClient.invalidateQueries({ queryKey: adminAccountKeys.all })
      onSuccess?.(result)
      onClose()
    } catch (error) {
      if (error?.response?.status === 409) {
        message.warning('Dữ liệu đã thay đổi. Đang tải lại tác động để bạn kiểm tra.')
        setPreview(null)
        await loadPreview(values)
      } else {
        message.error(getApiErrorMessage(error, 'Không thể hoàn tất thao tác khôi phục.'))
      }
    } finally {
      setLoading(false)
    }
  }

  const mfaLabels = enabledMfaLabels(
    isEmail ? preview?.mfa_methods : preview?.methods_to_disable,
  )

  return (
    <Modal
      open={open}
      width={760}
      style={{ maxWidth: 'calc(100vw - 24px)' }}
      title={isEmail ? 'Khôi phục email đăng nhập' : 'Đặt lại xác thực đa yếu tố'}
      okText={preview ? 'Xác nhận thực hiện' : 'Xem tác động'}
      cancelText="Hủy"
      confirmLoading={loading}
      okButtonProps={{ danger: true, disabled: preview ? !preview.can_apply : false }}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 220px)',
          overflowY: 'auto',
          paddingRight: 4,
        },
      }}
      onCancel={() => !loading && onClose()}
      onOk={async () => {
        if (preview) await confirm()
        else {
          try {
            await loadPreview(await form.validateFields())
          } catch {
            // Ant Design already renders field-level validation feedback.
          }
        }
      }}
      destroyOnHidden
    >
      <div className="space-y-4">
        <AccountVerificationSummary account={account} />
        {!preview ? (
          <>
          <Alert
            showIcon
            type="warning"
            title="Chỉ thực hiện sau khi đã xác minh danh tính ngoài hệ thống"
            description={isEmail
              ? 'Email cũ, mật khẩu, phiên đăng nhập và mọi liên kết OAuth sẽ không còn dùng được.'
              : 'Mọi phương thức MFA và phiên đăng nhập hiện tại sẽ bị thu hồi; mật khẩu không thay đổi.'}
          />
          <Form form={form} layout="vertical" requiredMark clearOnDestroy>
            {isEmail && (
              <Form.Item
                name="email"
                label="Email đăng nhập mới"
                rules={[
                  { required: true, message: 'Nhập email đăng nhập mới.' },
                  { type: 'email', message: 'Email không hợp lệ.' },
                ]}
              >
                <Input
                  autoFocus
                  size="large"
                  type="email"
                  autoComplete="off"
                  placeholder="email-moi@example.com"
                />
              </Form.Item>
            )}
            <Form.Item
              name="reason"
              label="Lý do khôi phục"
              rules={[
                { required: true, whitespace: true, message: 'Nhập lý do thao tác.' },
                { max: 500, message: 'Lý do không được vượt quá 500 ký tự.' },
              ]}
            >
              <Input.TextArea
                size="large"
                rows={4}
                maxLength={500}
                showCount
                placeholder="Mô tả lý do cần khôi phục quyền truy cập tài khoản."
              />
            </Form.Item>
            <Form.Item
              name="verification_evidence"
              label="Bằng chứng xác minh"
              rules={[
                { required: true, whitespace: true, message: 'Nhập bằng chứng xác minh.' },
                { min: 20, message: 'Bằng chứng xác minh cần có ít nhất 20 ký tự.' },
                { max: 500, message: 'Bằng chứng xác minh không được vượt quá 500 ký tự.' },
              ]}
            >
              <Input.TextArea
                size="large"
                rows={5}
                maxLength={500}
                showCount
                placeholder="Ghi rõ thời điểm, kênh xác minh và ít nhất hai thông tin đã đối chiếu với hồ sơ phía trên."
              />
            </Form.Item>
          </Form>
          </>
        ) : (
          <>
          <Alert
            showIcon
            type="warning"
            title="Kiểm tra kỹ trước khi xác nhận"
            description={isEmail
              ? 'Thao tác này buộc người dùng đặt mật khẩu mới và liên kết lại OAuth.'
              : 'Password reset link đã phát trước bước này cũng sẽ hết hiệu lực.'}
          />
          <Descriptions bordered size="small" column={1}>
            {isEmail && (
              <>
                <Descriptions.Item label="Email hiện tại">
                  {preview.before.email}
                </Descriptions.Item>
                <Descriptions.Item label="Email mới">
                  <Typography.Text strong>{preview.after.email}</Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="Mật khẩu hiện tại">
                  Bị vô hiệu hóa; bắt buộc đặt lại
                </Descriptions.Item>
                <Descriptions.Item label="Xác minh email">
                  Bắt buộc xác minh lại địa chỉ email mới
                </Descriptions.Item>
                <Descriptions.Item label="OAuth bị thu hồi">
                  {preview.oauth_providers_to_revoke.length
                    ? preview.oauth_providers_to_revoke.map((provider) => (
                        <Tag key={provider}>{provider}</Tag>
                      ))
                    : 'Không có'}
                </Descriptions.Item>
              </>
            )}
            <Descriptions.Item label="Phiên bị thu hồi">
              {preview.active_session_count}
            </Descriptions.Item>
            <Descriptions.Item label={isEmail ? 'MFA cần xử lý tiếp' : 'MFA bị xóa'}>
              {mfaLabels.length
                ? `${mfaLabels.join(', ')}${isEmail ? ' — cần reset ở bước kế tiếp' : ''}`
                : 'Không có'}
            </Descriptions.Item>
            {!isEmail && (
              <Descriptions.Item label="Mật khẩu">
                Giữ nguyên, không bị thay đổi
              </Descriptions.Item>
            )}
            {isEmail && !preview.password_reset_available && (
              <Descriptions.Item label="Cảnh báo trạng thái">
                Phải mở lại tài khoản bằng workflow trạng thái trước khi gửi password reset.
              </Descriptions.Item>
            )}
          </Descriptions>
          </>
        )}
      </div>
    </Modal>
  )
}
