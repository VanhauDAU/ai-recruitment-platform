import { DisconnectOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Form } from 'antd'
import { useState } from 'react'
import {
  adminAccountKeys,
  getEmployerCompanyUnlinkImpact,
  unlinkEmployerCompany,
} from '@/entities/account/admin-account'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import ActionDialog from '@/shared/ui/confirm-action/ActionDialog'
import ImpactFacts from '@/shared/ui/confirm-action/ImpactFacts'
import ReasonField from '@/shared/ui/confirm-action/ReasonField'
import useImpactConfirmation from '@/shared/ui/confirm-action/use-impact-confirmation'

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

const UNLINK_REASONS = [
  'Nhà tuyển dụng xác nhận đã chọn nhầm công ty',
  'Công ty xác nhận người này không thuộc doanh nghiệp',
]

export default function EmployerCompanyLinkRecovery({ publicId, company, companyRole }) {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [open, setOpen] = useState(false)
  const impactState = useImpactConfirmation({
    open,
    preview: (values) => getEmployerCompanyUnlinkImpact(publicId, values?.reason || ''),
    confirm: (impact, values) => unlinkEmployerCompany(publicId, values.reason, impact.impact_token),
  })

  if (!company) return null
  const close = () => {
    if (impactState.submitting) return
    setOpen(false)
    form.resetFields()
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
      message.success('Đã gỡ liên kết công ty. Nhà tuyển dụng có thể chọn lại công ty.')
      setOpen(false)
      form.resetFields()
      await queryClient.invalidateQueries({ queryKey: adminAccountKeys.all })
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Liên kết đã thay đổi. Vui lòng kiểm tra lại.'))
    }
  }
  const impact = impactState.impact
  const facts = impact ? [
    { label: 'Tin đang tuyển', value: impact.counts.active_jobs, tone: impact.counts.active_jobs ? 'danger' : undefined },
    { label: 'Chiến dịch chưa kết thúc', value: impact.counts.open_campaigns, tone: impact.counts.open_campaigns ? 'danger' : undefined },
    { label: 'Thành viên khác', value: impact.counts.other_members },
    { label: 'Nhu cầu tuyển dụng (giữ lại)', value: impact.counts.recruitment_needs },
  ] : []

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

      <ActionDialog
        loading={impactState.submitting}
        onCancel={close}
        onSubmit={submit}
        open={open}
        submitDisabled={impact?.can_apply === false}
        submitLabel="Gỡ liên kết"
        target={company.name}
        title="Gỡ liên kết công ty"
        tone="danger"
      >
        <p className="action-dialog__lead">Thao tác được ghi nhật ký; không xóa công ty hay dữ liệu lịch sử.</p>
        <ImpactFacts
          blockers={(impact?.blockers || []).map((code) => BLOCKER_LABELS[code] || code)}
          changed={impactState.changed}
          error={impactState.error}
          facts={facts}
          loading={impactState.loading}
          notes={(impact?.withdrawals || []).map((code) => `Tự rút: ${WITHDRAWAL_LABELS[code] || code}`)}
          onRetry={impactState.reload}
        />
        <Form form={form} layout="vertical" initialValues={{ reason: '' }}>
          <ReasonField label="Lý do xử lý" presets={UNLINK_REASONS} />
        </Form>
      </ActionDialog>
    </div>
  )
}
