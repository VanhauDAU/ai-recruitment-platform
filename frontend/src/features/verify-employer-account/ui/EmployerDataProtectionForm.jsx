import { CheckCircleFilled, FileProtectOutlined, SafetyCertificateOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Checkbox, Modal, Result, Skeleton, Tag, Upload } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  acceptEmployerDpa,
  getEmployerCompanyDocuments,
  getEmployerProfile,
  uploadEmployerDataProcessingAgreement,
} from '@/entities/employer-profile'
import { useSiteSettings } from '@/entities/site-settings'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { EMPLOYER_COMPANY_SETTINGS_URL } from '@/shared/config/portals'

const STATUS = {
  pending: { label: 'Chờ duyệt', color: 'gold' },
  approved: { label: 'Đã duyệt', color: 'green' },
  rejected: { label: 'Từ chối', color: 'red' },
}

export default function EmployerDataProtectionForm() {
  const { siteName } = useSiteSettings()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [agreementOpen, setAgreementOpen] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const profileQuery = useQuery({ queryKey: ['employer', 'profile'], queryFn: getEmployerProfile })
  const documentsQuery = useQuery({
    queryKey: ['employer', 'company-documents'],
    queryFn: getEmployerCompanyDocuments,
    enabled: Boolean(profileQuery.data?.onboarding?.company_linked),
  })
  async function refresh() {
    await Promise.all([
      profileQuery.refetch(),
      documentsQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ['employer-dashboard'] }),
    ])
  }
  const documentMutation = useMutation({
    mutationFn: uploadEmployerDataProcessingAgreement,
    onSuccess: async () => {
      message.success('Văn bản xử lý dữ liệu ứng viên đã được gửi.')
      await refresh()
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể tải văn bản lên.')),
  })
  const acceptMutation = useMutation({
    mutationFn: acceptEmployerDpa,
    onSuccess: async () => {
      message.success(`Đã xác nhận thỏa thuận xử lý dữ liệu với ${siteName}.`)
      setAgreementOpen(false)
      await refresh()
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể ghi nhận thỏa thuận.')),
  })

  if (profileQuery.isLoading) return <Skeleton active paragraph={{ rows: 12 }} />
  if (!profileQuery.data?.onboarding?.company_linked) {
    return <Alert type="warning" showIcon title="Bạn chưa liên kết công ty" description={<span>Hãy <Link to={`${EMPLOYER_COMPANY_SETTINGS_URL}?update=true`} className="font-bold">tìm hoặc tạo công ty</Link> trước khi cập nhật văn bản pháp lý.</span>} />
  }
  const verification = profileQuery.data.onboarding || {}
  const documents = (documentsQuery.data || []).filter((item) => item.doc_type === 'data_processing_agreement')

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-black text-slate-900">Văn bản xử lý DLCN giữa Ứng viên – Nhà tuyển dụng</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Đăng tải văn bản thể hiện ứng viên đồng ý cho phép doanh nghiệp thu thập, lưu trữ và sử dụng dữ liệu cá nhân cho mục đích tuyển dụng.</p></div><Tag color={verification.candidate_dpa_submitted ? 'green' : 'gold'}>{verification.candidate_dpa_submitted ? 'Đã cập nhật' : 'Chưa cập nhật'}</Tag></div>
        <Upload.Dragger
          accept=".doc,.docx,.pdf"
          maxCount={1}
          showUploadList={false}
          disabled={documentMutation.isPending}
          beforeUpload={(file) => {
            documentMutation.mutate(file)
            return Upload.LIST_IGNORE
          }}
          className="!mt-5"
        >
          <FileProtectOutlined className="text-4xl text-emerald-600" />
          <p className="mt-3 font-bold text-slate-800">Chọn hoặc kéo văn bản vào đây</p>
          <p className="mt-1 text-xs text-slate-400">Dung lượng tối đa 5MB, định dạng DOC, DOCX hoặc PDF</p>
          <Button icon={<UploadOutlined />} loading={documentMutation.isPending} className="!mt-4">Chọn file</Button>
        </Upload.Dragger>
        {documents.map((item) => {
          const status = STATUS[item.status] || { label: item.status, color: 'default' }
          return <div key={item.id} className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm"><span className="truncate">{item.file_name || 'Văn bản DLCN ứng viên'}</span><Tag color={status.color}>{status.label}</Tag></div>
        })}
      </section>

      <section className="rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-black text-slate-900">Thỏa thuận xử lý DLCN giữa {siteName} – Nhà tuyển dụng</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Thỏa thuận làm rõ vai trò, trách nhiệm của doanh nghiệp và nền tảng đối với hồ sơ ứng viên được chuyển vào workspace.</p></div><Tag color={verification.dpa_accepted ? 'green' : 'gold'}>{verification.dpa_accepted ? 'Đã xác nhận' : 'Chưa xác nhận'}</Tag></div>
        {verification.dpa_accepted ? (
          <Result status="success" icon={<CheckCircleFilled className="text-emerald-500" />} title="Bạn đã đồng ý thỏa thuận" className="!py-5" />
        ) : (
          <Button type="primary" icon={<SafetyCertificateOutlined />} onClick={() => setAgreementOpen(true)} className="!mt-5">Đọc và xác nhận thỏa thuận</Button>
        )}
      </section>

      <Modal open={agreementOpen} onCancel={() => setAgreementOpen(false)} footer={null} title={`Thỏa thuận xử lý dữ liệu với ${siteName}`} width={720}>
        <div className="max-h-72 overflow-y-auto rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          <p>Doanh nghiệp cam kết chỉ xử lý dữ liệu ứng viên cho mục đích tuyển dụng hợp pháp, giới hạn quyền truy cập theo nhiệm vụ và áp dụng biện pháp bảo mật phù hợp.</p>
          <p className="mt-3">Doanh nghiệp chịu trách nhiệm về tính hợp pháp của việc thu thập, lưu trữ, sử dụng và xóa dữ liệu; đồng thời phối hợp với {siteName} khi có yêu cầu của chủ thể dữ liệu hoặc cơ quan có thẩm quyền.</p>
        </div>
        <Checkbox checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="!mt-5">Tôi đã đọc và đồng ý với các điều khoản của thỏa thuận.</Checkbox>
        <Button type="primary" size="large" block disabled={!agreed} loading={acceptMutation.isPending} onClick={() => acceptMutation.mutate()} className="!mt-5">Xác nhận</Button>
      </Modal>
    </div>
  )
}
