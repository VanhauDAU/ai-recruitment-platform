import { DisconnectOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Descriptions, Form, Input, Modal, Space, Tag } from 'antd'
import { useState } from 'react'
import {
  adminAccountKeys,
  getEmployerCompanyUnlinkImpact,
  unlinkEmployerCompany,
} from '@/entities/admin-account'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

const BLOCKER_LABELS = {
  COMPANY_OWNER_LINK: 'Tài khoản là chủ sở hữu công ty',
  VERIFICATION_CASE_NOT_CLEAN: 'Hồ sơ xác thực đã bắt đầu xử lý',
  COMPANY_DOCUMENTS_EXIST: 'Đã có giấy tờ công ty/xác thực',
  COMPANY_UPDATE_REQUESTS_EXIST: 'Đã có yêu cầu cập nhật công ty',
  RECRUITMENT_NEEDS_EXIST: 'Đã có nhu cầu tuyển dụng',
  CAMPAIGNS_EXIST: 'Đã có chiến dịch tuyển dụng',
  JOBS_EXIST: 'Đã có tin tuyển dụng',
  COMPLIANCE_HOLDS_EXIST: 'Đang có compliance hold',
  VERIFICATION_HISTORY_EXISTS: 'Đã có lịch sử xác thực',
  TAX_EVIDENCE_EXISTS: 'Đã có bằng chứng tra cứu thuế',
}

export default function EmployerCompanyLinkRecovery({
  publicId,
  company,
  companyRole,
  enabled,
}) {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [open, setOpen] = useState(false)
  const [impact, setImpact] = useState(null)

  const previewMutation = useMutation({
    mutationFn: ({ reason }) => getEmployerCompanyUnlinkImpact(publicId, reason),
    onSuccess: setImpact,
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể kiểm tra liên kết.')),
  })
  const confirmMutation = useMutation({
    mutationFn: ({ reason }) => unlinkEmployerCompany(
      publicId,
      reason,
      impact.impact_token,
    ),
    onSuccess: async () => {
      message.success('Đã gỡ liên kết công ty. Nhà tuyển dụng có thể chọn lại công ty.')
      setOpen(false)
      setImpact(null)
      form.resetFields()
      await queryClient.invalidateQueries({ queryKey: adminAccountKeys.all })
    },
    onError: (error) => {
      setImpact(null)
      message.error(getApiErrorMessage(error, 'Liên kết đã thay đổi. Vui lòng kiểm tra lại.'))
    },
  })

  if (!enabled || !company) return null
  const close = () => {
    if (previewMutation.isPending || confirmMutation.isPending) return
    setOpen(false)
    setImpact(null)
    form.resetFields()
  }
  const submit = async () => {
    const values = await form.validateFields()
    if (impact?.can_apply) confirmMutation.mutate(values)
    else previewMutation.mutate(values)
  }

  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-bold text-slate-900">Khôi phục liên kết công ty chọn nhầm</div>
          <div className="mt-1 text-sm leading-6 text-slate-600">
            Chỉ gỡ được member chưa phát sinh giấy tờ, hồ sơ xác thực hoặc dữ liệu tuyển dụng.
          </div>
        </div>
        <Button
          danger
          icon={<DisconnectOutlined />}
          disabled={companyRole !== 'member'}
          onClick={() => setOpen(true)}
        >
          Gỡ liên kết
        </Button>
      </div>

      <Modal
        title="Gỡ liên kết công ty"
        open={open}
        onCancel={close}
        onOk={submit}
        okText={impact?.can_apply ? 'Xác nhận gỡ liên kết' : 'Xem tác động'}
        okButtonProps={{ danger: Boolean(impact?.can_apply) }}
        confirmLoading={previewMutation.isPending || confirmMutation.isPending}
        destroyOnHidden
      >
        <Alert
          className="mb-4"
          type="warning"
          showIcon
          icon={<SafetyCertificateOutlined />}
          title={`Tài khoản đang liên kết với ${company.name}`}
          description="Thao tác được audit và không xóa công ty hay dữ liệu lịch sử."
        />
        <Form form={form} layout="vertical" onValuesChange={() => setImpact(null)}>
          <Form.Item
            name="reason"
            label="Lý do xử lý"
            rules={[{ required: true, message: 'Nhập lý do gỡ liên kết' }]}
          >
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
        </Form>
        {impact && (
          <Space orientation="vertical" size="middle" className="w-full">
            <Alert
              type={impact.can_apply ? 'success' : 'error'}
              showIcon
              title={impact.can_apply
                ? 'Liên kết đủ điều kiện gỡ an toàn'
                : 'Liên kết đã phát sinh dữ liệu và bị khóa gỡ tự động'}
            />
            {impact.blockers?.length > 0 && (
              <div>
                {impact.blockers.map((code) => (
                  <Tag color="red" key={code}>{BLOCKER_LABELS[code] || code}</Tag>
                ))}
              </div>
            )}
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="Giấy tờ">{impact.counts.company_documents}</Descriptions.Item>
              <Descriptions.Item label="Yêu cầu cập nhật">{impact.counts.company_update_requests}</Descriptions.Item>
              <Descriptions.Item label="Chiến dịch">{impact.counts.campaigns}</Descriptions.Item>
              <Descriptions.Item label="Tin tuyển dụng">{impact.counts.jobs}</Descriptions.Item>
            </Descriptions>
          </Space>
        )}
      </Modal>
    </div>
  )
}
