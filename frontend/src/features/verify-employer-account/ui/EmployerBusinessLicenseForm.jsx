import { CheckCircleFilled, FileProtectOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Result, Skeleton, Tag, Upload } from 'antd'
import { Link } from 'react-router-dom'
import {
  getEmployerCompanyDocuments,
  getEmployerProfile,
  uploadEmployerBusinessDocument,
} from '@/entities/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { EMPLOYER_COMPANY_SETTINGS_URL } from '@/shared/config/portals'

const STATUS = {
  pending: { label: 'Chờ duyệt', color: 'gold' },
  approved: { label: 'Đã duyệt', color: 'green' },
  rejected: { label: 'Từ chối', color: 'red' },
}

export default function EmployerBusinessLicenseForm() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const profileQuery = useQuery({ queryKey: ['employer', 'profile'], queryFn: getEmployerProfile })
  const documentsQuery = useQuery({
    queryKey: ['employer', 'company-documents'],
    queryFn: getEmployerCompanyDocuments,
    enabled: Boolean(profileQuery.data?.onboarding?.company_linked),
  })
  const mutation = useMutation({
    mutationFn: uploadEmployerBusinessDocument,
    onSuccess: async () => {
      message.success('Giấy đăng ký doanh nghiệp đã được gửi và đang chờ duyệt.')
      await Promise.all([
        profileQuery.refetch(),
        documentsQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ['employer-dashboard'] }),
      ])
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể tải giấy tờ lên.')),
  })

  if (profileQuery.isLoading) return <Skeleton active paragraph={{ rows: 8 }} />
  if (!profileQuery.data?.onboarding?.company_linked) {
    return <Alert type="warning" showIcon title="Bạn chưa liên kết công ty" description={<span>Hãy <Link to={`${EMPLOYER_COMPANY_SETTINGS_URL}?update=true`} className="font-bold">tìm hoặc tạo công ty</Link> trước khi cập nhật giấy đăng ký doanh nghiệp.</span>} />
  }

  const documents = (documentsQuery.data || []).filter((item) => item.doc_type === 'business_registration')
  return (
    <div>
      <h2 className="text-xl font-black text-slate-900">Thông tin Giấy đăng ký doanh nghiệp</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">Văn bản cần đầy đủ các mặt, không chỉnh sửa, che hoặc cắt thông tin; dữ liệu phải trùng khớp hồ sơ doanh nghiệp.</p>
      {profileQuery.data.onboarding.business_doc_submitted && (
        <Result status="success" icon={<CheckCircleFilled className="text-emerald-500" />} title="Đã cập nhật giấy đăng ký doanh nghiệp" className="!py-5" />
      )}
      <Upload.Dragger
        accept=".jpg,.jpeg,.png,.pdf"
        maxCount={1}
        showUploadList={false}
        disabled={mutation.isPending}
        beforeUpload={(file) => {
          mutation.mutate(file)
          return Upload.LIST_IGNORE
        }}
        className="!mt-5"
      >
        <FileProtectOutlined className="text-4xl text-emerald-600" />
        <p className="mt-3 font-bold text-slate-800">Chọn hoặc kéo file vào đây</p>
        <p className="mt-1 text-xs text-slate-400">Dung lượng tối đa 5MB, định dạng JPG, PNG hoặc PDF</p>
        <Button icon={<UploadOutlined />} loading={mutation.isPending} className="!mt-4">Chọn file</Button>
      </Upload.Dragger>
      {documents.length > 0 && (
        <div className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">
          {documents.map((item) => {
            const status = STATUS[item.status] || { label: item.status, color: 'default' }
            return <div key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="truncate text-slate-600">{item.file_name || 'Giấy đăng ký doanh nghiệp'}</span><Tag color={status.color}>{status.label}</Tag></div>
          })}
        </div>
      )}
    </div>
  )
}
