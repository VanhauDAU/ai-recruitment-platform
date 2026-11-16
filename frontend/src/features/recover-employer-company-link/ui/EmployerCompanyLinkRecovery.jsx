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

// What already took effect for the company, with the step that undoes it.
const BLOCKER_LABELS = {
  COMPANY_OWNER_WITH_MEMBERS: 'Là quản lý công ty còn thành viên khác: chuyển quyền quản lý trước',
  VERIFICATION_APPROVED: 'Xác thực đã được duyệt: thu hồi xác thực trước',
  ACTIVE_JOBS_EXIST: 'Còn tin đang tuyển: đóng các tin trước',
  OPEN_CAMPAIGNS_EXIST: 'Còn chiến dịch chưa kết thúc: hoàn tất hoặc hủy trước',
  COMPLIANCE_HOLDS_EXIST: 'Đang có compliance hold',
}

// Submitted for this company but never approved: withdrawn together with the link.
const WITHDRAWAL_LABELS = {
  VERIFICATION_CASE: 'Hồ sơ xác thực đang xử lý (về trạng thái nháp)',
  VERIFICATION_DOCUMENTS: 'Giấy tờ xác thực chưa duyệt',
  COMPANY_UPDATE_REQUESTS: 'Yêu cầu cập nhật công ty đang chờ (bị hủy)',
}

export default function EmployerCompanyLinkRecovery({
  publicId,
  company,
  companyRole,
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

  if (!company) return null
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
                : 'Cần xử lý các mục dưới đây trước khi gỡ liên kết'}
            />
            {impact.blockers?.length > 0 && (
              <div>
                {impact.blockers.map((code) => (
                  <Tag color="red" key={code}>{BLOCKER_LABELS[code] || code}</Tag>
                ))}
              </div>
            )}
            {impact.withdrawals?.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-medium text-slate-700">Sẽ tự rút khi gỡ liên kết</p>
                {impact.withdrawals.map((code) => (
                  <Tag color="orange" key={code}>{WITHDRAWAL_LABELS[code] || code}</Tag>
                ))}
              </div>
            )}
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="Tin đang tuyển">{impact.counts.active_jobs}</Descriptions.Item>
              <Descriptions.Item label="Chiến dịch chưa kết thúc">{impact.counts.open_campaigns}</Descriptions.Item>
              <Descriptions.Item label="Thành viên khác">{impact.counts.other_members}</Descriptions.Item>
              <Descriptions.Item label="Nhu cầu tuyển dụng (giữ lại)">{impact.counts.recruitment_needs}</Descriptions.Item>
            </Descriptions>
          </Space>
        )}
      </Modal>
    </div>
  )
}
