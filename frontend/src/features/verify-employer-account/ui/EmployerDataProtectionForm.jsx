import {
  DownloadOutlined,
  EditOutlined,
  FileTextOutlined,
  LinkOutlined,
  UploadOutlined,
  WarningFilled,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Checkbox, Skeleton, Tag, Upload } from 'antd'
import { useState } from 'react'
import {
  acceptEmployerDpa,
  getEmployerCompanyDocuments,
  getEmployerProfile,
  uploadEmployerDataProcessingAgreement,
} from '@/entities/employer-profile'
import { useSiteSettings } from '@/entities/site-settings'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

const CANDIDATE_DPA_GUIDE_URL = 'https://tuyendung.topcv.vn/help/tong-quan/thoa-thuan-xu-ly-du-lieu-ca-nhan-ung-vien/'
const PLATFORM_DPA_URL = 'https://tuyendung.topcv.vn/data-processing-agreement'
const DPA_TEMPLATE_URL = '/documents/topcv-mau-van-ban-thong-bao-dong-y-xu-ly-dlcn.docx'
const ACCEPTED_FILE_TYPES = '.doc,.docx,.pdf'
const CANDIDATE_AGREEMENT_DOCUMENT_NAME = 'Thỏa thuận xử lý DLCN'

function StatusTag({ completed, completedLabel, pendingLabel, completedColor = 'green' }) {
  return <Tag color={completed ? completedColor : 'default'} className="!m-0 !rounded-full !border-0 !px-3">{completed ? completedLabel : pendingLabel}</Tag>
}

function UploadNotice() {
  return (
    <div className="mt-2 flex gap-2 rounded-lg bg-orange-50 px-3 py-2 text-xs leading-5 text-orange-600">
      <WarningFilled className="mt-0.5 shrink-0" />
      <span>Văn bản đăng tải cần đầy đủ các mặt và không có dấu hiệu chỉnh sửa/ che/ cắt thông tin.</span>
    </div>
  )
}

function documentUrl(document) {
  const fileUrl = document?.file_url || ''
  if (!/\.(doc|docx)(?:$|[?#])/i.test(fileUrl)) return fileUrl

  try {
    const url = new URL(fileUrl, window.location.origin)
    const isPublicExternalHttps = url.protocol === 'https:' && url.hostname !== window.location.hostname
    return isPublicExternalHttps
      ? `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`
      : fileUrl
  } catch {
    return fileUrl
  }
}

function formatAgreementAcceptedAt(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return null
  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit',
    day: '2-digit', month: '2-digit', year: 'numeric', hour12: false,
  }).formatToParts(new Date(value)).reduce((result, part) => ({ ...result, [part.type]: part.value }), {})
  return `${parts.hour}:${parts.minute}:${parts.second} ${parts.day}/${parts.month}/${parts.year}`
}

function CandidateAgreementTemplate() {
  return (
    <aside className="flex flex-col items-center gap-4 text-center">
      <p className="text-sm font-medium text-slate-800">Văn bản mẫu</p>
      <a href={DPA_TEMPLATE_URL} download className="inline-flex items-center gap-2 rounded-md border border-emerald-500 px-4 py-2 text-sm font-medium !text-emerald-600 transition hover:!text-emerald-700 hover:bg-emerald-50"><DownloadOutlined />Tải mẫu văn bản</a>
    </aside>
  )
}

function CandidateAgreementUploadForm({ currentDocument, files, onFilesChange, accepted, onAcceptedChange, onCancel, submitting, canSave, onSave, siteName }) {
  return (
    <>
      <div className="mt-4 rounded-lg border border-slate-200 p-5 sm:p-6">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-800">Văn bản Thỏa thuận <span className="text-red-500">*</span></h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Văn bản thể hiện việc Ứng viên đồng ý cho phép Nhà tuyển dụng thu thập, lưu trữ và sử dụng dữ liệu cá nhân của Ứng viên để phục vụ mục đích tuyển dụng.</p>
            {currentDocument && <a aria-label={`Tệp hiện tại: ${CANDIDATE_AGREEMENT_DOCUMENT_NAME}`} href={documentUrl(currentDocument)} target="_blank" rel="noreferrer" className="group mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-3 text-sm font-medium !text-slate-700 transition-colors hover:!bg-[var(--brand-primary-soft)] hover:!text-[var(--brand-primary)]"><FileTextOutlined className="shrink-0 text-emerald-600 transition-colors group-hover:text-[var(--brand-primary)]" />Tệp hiện tại: {CANDIDATE_AGREEMENT_DOCUMENT_NAME}</a>}
            <Upload.Dragger
              accept={ACCEPTED_FILE_TYPES}
              beforeUpload={() => false}
              fileList={files}
              maxCount={1}
              multiple={false}
              disabled={submitting}
              showUploadList={false}
              onChange={({ fileList }) => onFilesChange(fileList.slice(-1))}
              onRemove={() => onFilesChange([])}
              className="!mt-4 !rounded-lg !border-dashed !border-slate-300 !bg-white !px-4 !py-2 hover:!border-emerald-500"
            >
              <p className="mb-1 text-sm font-medium text-slate-600">Chọn hoặc kéo file vào đây</p>
              <p className="mb-2 text-xs text-slate-500">Dung lượng tối đa 5MB, định dạng: docx, doc, pdf</p>
              <Button type="text" icon={<UploadOutlined />} className="!h-8 !border !border-emerald-100 !bg-emerald-50 !text-emerald-600">Chọn file</Button>
              {files[0] && <p className="mb-0 mt-3 truncate text-xs font-medium text-emerald-700">Tệp mới: {files[0].name}</p>}
            </Upload.Dragger>
            <UploadNotice />
          </div>

          <CandidateAgreementTemplate />
        </div>
      </div>

      <Checkbox checked={accepted} onChange={(event) => onAcceptedChange(event.target.checked)} className="!mt-5 !flex !items-start !text-sm !leading-5 !text-slate-500">Tôi cam đoan văn bản này là tài liệu hợp pháp của doanh nghiệp và chịu hoàn toàn trách nhiệm về tính chính xác, hợp lệ của nội dung. {siteName} chỉ là nền tảng trung gian lưu trữ văn bản này.</Checkbox>
      <div className="mt-4 flex justify-end gap-3">
        {onCancel && <Button size="large" disabled={submitting} onClick={onCancel} className="!min-w-[100px] !shadow-none">Hủy</Button>}
        <Button type="primary" size="large" disabled={!canSave} loading={submitting} onClick={onSave} className="!min-w-[100px] !shadow-none">Lưu</Button>
      </div>
    </>
  )
}

export default function EmployerDataProtectionForm() {
  const { siteName } = useSiteSettings()
  const queryClient = useQueryClient()
  const [files, setFiles] = useState([])
  const [candidateAgreementAccepted, setCandidateAgreementAccepted] = useState(false)
  const [editingCandidateAgreement, setEditingCandidateAgreement] = useState(false)
  const [platformAgreementAccepted, setPlatformAgreementAccepted] = useState(false)
  const profileQuery = useQuery({ queryKey: ['employer', 'profile'], queryFn: getEmployerProfile })
  const documentsQuery = useQuery({
    queryKey: ['employer', 'company-documents'],
    queryFn: getEmployerCompanyDocuments,
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
      message.success('Thông báo', {
        description: `Cập nhật thành công. ${siteName} đã nhận được giấy tờ của bạn và tiến hành xử lý sớm.`,
      })
      setFiles([])
      setCandidateAgreementAccepted(false)
      setEditingCandidateAgreement(false)
      await refresh()
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể tải văn bản lên.')),
  })
  const acceptMutation = useMutation({
    mutationFn: acceptEmployerDpa,
    onSuccess: async () => {
      message.success(`Đã xác nhận thỏa thuận xử lý dữ liệu với ${siteName}.`)
      setPlatformAgreementAccepted(false)
      await refresh()
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể ghi nhận thỏa thuận.')),
  })

  if (profileQuery.isLoading) return <Skeleton active paragraph={{ rows: 12 }} />

  const verification = profileQuery.data?.onboarding || {}
  const documents = (Array.isArray(documentsQuery.data) ? documentsQuery.data : []).filter(
    (item) => item.doc_type === 'data_processing_agreement',
  )
  const selectedFile = files[0]?.originFileObj || files[0]
  const canSaveCandidateAgreement = Boolean(selectedFile && candidateAgreementAccepted)
  const candidateAgreementDocument = documents[0]
  const candidateAgreementSubmitted = Boolean(verification.candidate_dpa_submitted || candidateAgreementDocument)
  const showCandidateAgreementForm = !candidateAgreementSubmitted || editingCandidateAgreement
  const agreementAcceptedAt = formatAgreementAcceptedAt(profileQuery.data?.dpa_accepted_at)

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Văn bản Thỏa thuận xử lý Dữ liệu cá nhân giữa Ứng viên - Nhà tuyển dụng</h2>
          </div>
          <div className="flex items-center gap-3">
            <StatusTag completed={candidateAgreementSubmitted} completedColor="gold" completedLabel="Hệ thống đang xử lý" pendingLabel="Chưa cập nhật" />
            {candidateAgreementSubmitted && !editingCandidateAgreement && <Button aria-label="Chỉnh sửa văn bản" icon={<EditOutlined />} onClick={() => setEditingCandidateAgreement(true)} className="!border-emerald-500 !text-emerald-600 hover:!border-emerald-600 hover:!text-emerald-700">Chỉnh sửa</Button>}
          </div>
        </div>

        <p className="mt-6 text-sm text-slate-500">Xem mục đích sử dụng và hướng dẫn đăng tải <a href={CANDIDATE_DPA_GUIDE_URL} target="_blank" rel="noreferrer" className="font-medium !text-emerald-600 hover:!text-emerald-700">Tại đây</a></p>

        {showCandidateAgreementForm ? (
          <CandidateAgreementUploadForm
            accepted={candidateAgreementAccepted}
            canSave={canSaveCandidateAgreement}
            currentDocument={editingCandidateAgreement ? candidateAgreementDocument : null}
            files={files}
            onAcceptedChange={setCandidateAgreementAccepted}
            onCancel={candidateAgreementSubmitted ? () => { setFiles([]); setCandidateAgreementAccepted(false); setEditingCandidateAgreement(false) } : null}
            onFilesChange={setFiles}
            onSave={() => documentMutation.mutate(selectedFile)}
            siteName={siteName}
            submitting={documentMutation.isPending}
          />
        ) : candidateAgreementDocument ? (
          <div className="mt-4 grid items-center gap-6 rounded-lg border border-slate-200 p-5 sm:grid-cols-[minmax(0,1fr)_220px] sm:p-6">
            <a aria-label={CANDIDATE_AGREEMENT_DOCUMENT_NAME} href={documentUrl(candidateAgreementDocument)} target="_blank" rel="noreferrer" className="group flex min-w-0 items-center gap-2 rounded-lg bg-slate-50 px-4 py-3 text-sm !text-slate-700 transition-colors hover:!bg-[var(--brand-primary-soft)] hover:!text-[var(--brand-primary)]">
              <FileTextOutlined className="shrink-0 text-emerald-600 transition-colors group-hover:text-[var(--brand-primary)]" /><span className="truncate">{CANDIDATE_AGREEMENT_DOCUMENT_NAME}</span>
            </a>
            <CandidateAgreementTemplate />
          </div>
        ) : <p className="mt-4 text-sm text-slate-500">Hệ thống đang đồng bộ văn bản của bạn.</p>}
      </section>

      <section className="rounded-lg border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-800">Văn bản Thỏa thuận xử lý Dữ liệu cá nhân giữa {siteName} - Nhà tuyển dụng</h2>
          <StatusTag completed={verification.dpa_accepted} completedLabel="Đã xác nhận" pendingLabel="Chưa xác nhận" />
        </div>
        <p className="mt-5 text-sm leading-6 text-slate-600">Nhằm tuân thủ Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15, {siteName} chính thức triển khai Thỏa thuận về xử lý dữ liệu cá nhân trên hệ thống. Thỏa thuận này làm rõ vai trò, trách nhiệm của Quý đơn vị và {siteName} đối với các hồ sơ ứng viên được chuyển vào Không gian làm việc (Workspace) của Quý đơn vị. Vui lòng đọc kỹ và xác nhận đồng ý để đảm bảo tiến trình tuyển dụng diễn ra hợp pháp, minh bạch và không bị gián đoạn.</p>
        <a href={PLATFORM_DPA_URL} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-medium !text-emerald-600 hover:!text-emerald-700">Xem nội dung đầy đủ của văn bản <LinkOutlined /></a>

        {verification.dpa_accepted ? (
          <p className="mt-4 text-sm text-emerald-700">{agreementAcceptedAt ? `Bạn đã xác nhận vào ${agreementAcceptedAt}.` : 'Bạn đã xác nhận thỏa thuận này.'}</p>
        ) : (
          <>
            <div className="mt-4">
              <Checkbox checked={platformAgreementAccepted} onChange={(event) => setPlatformAgreementAccepted(event.target.checked)} className="!flex !items-start !text-sm !leading-5 !text-slate-600">Xác nhận đồng ý với các điều khoản của <a href={PLATFORM_DPA_URL} target="_blank" rel="noreferrer" className="font-medium !text-emerald-600 hover:!text-emerald-700">Thỏa thuận về xử lý Dữ liệu cá nhân</a></Checkbox>
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="primary" size="large" disabled={!platformAgreementAccepted} loading={acceptMutation.isPending} onClick={() => acceptMutation.mutate()} className="!min-w-[112px] !shadow-none">Xác nhận</Button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
