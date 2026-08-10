import {
  EditOutlined,
  FileTextOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Checkbox, Skeleton, Tag } from 'antd'
import { useState } from 'react'
import {
  acceptEmployerDpa,
  employerProfileKeys,
  getEmployerCompanyDocumentContent,
  getEmployerCompanyDocuments,
  getEmployerProfile,
  uploadEmployerDataProcessingAgreement,
} from '@/entities/employer-profile'
import { useSiteSettings } from '@/entities/site-settings'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import CandidateAgreementUploadForm, {
  CandidateAgreementTemplate,
} from './CandidateAgreementUploadForm'
import { CandidateAgreementDocumentLink } from './CandidateAgreementDocumentLink'

const CANDIDATE_DPA_GUIDE_URL = 'https://tuyendung.topcv.vn/help/tong-quan/thoa-thuan-xu-ly-du-lieu-ca-nhan-ung-vien/'
const PLATFORM_DPA_URL = 'https://tuyendung.topcv.vn/data-processing-agreement'
const CANDIDATE_AGREEMENT_DOCUMENT_NAME = 'Thỏa thuận xử lý DLCN'
const OFFICE_EXTENSION_BY_TYPE = {
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
}
const DOCUMENT_STATUS = {
  pending: { color: 'gold', label: 'Hệ thống đang xử lý' },
  changes_requested: { color: 'orange', label: 'Cần bổ sung' },
  approved: { color: 'green', label: 'Đã duyệt' },
  rejected: { color: 'red', label: 'Từ chối' },
}

function StatusTag({ completed, completedLabel, pendingLabel, completedColor = 'green' }) {
  return <Tag color={completed ? completedColor : 'default'} className="!m-0 !rounded-full !border-0 !px-3">{completed ? completedLabel : pendingLabel}</Tag>
}

function formatAgreementAcceptedAt(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return null
  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit',
    day: '2-digit', month: '2-digit', year: 'numeric', hour12: false,
  }).formatToParts(new Date(value)).reduce((result, part) => ({ ...result, [part.type]: part.value }), {})
  return `${parts.hour}:${parts.minute}:${parts.second} ${parts.day}/${parts.month}/${parts.year}`
}

function browserCanPreview(contentType) {
  return contentType === 'application/pdf'
    || contentType.startsWith('image/')
    || contentType.startsWith('text/')
}

function documentDownloadName(document, contentType) {
  const name = document?.file_name || CANDIDATE_AGREEMENT_DOCUMENT_NAME
  if (/\.[a-z0-9]+$/i.test(name)) return name
  return `${name}${OFFICE_EXTENSION_BY_TYPE[contentType] || ''}`
}

export default function EmployerDataProtectionForm() {
  const { siteName } = useSiteSettings()
  const queryClient = useQueryClient()
  const [files, setFiles] = useState([])
  const [candidateAgreementAccepted, setCandidateAgreementAccepted] = useState(false)
  const [editingCandidateAgreement, setEditingCandidateAgreement] = useState(false)
  const [platformAgreementAccepted, setPlatformAgreementAccepted] = useState(false)
  const [uploadState, setUploadState] = useState(null)
  const profileQuery = useQuery({ queryKey: ['employer', 'profile'], queryFn: getEmployerProfile })
  const documentsQuery = useQuery({
    queryKey: employerProfileKeys.companyDocumentList('mine'),
    queryFn: () => getEmployerCompanyDocuments({ scope: 'mine' }),
  })

  async function refresh() {
    await Promise.all([
      profileQuery.refetch(),
      documentsQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ['employer-dashboard'] }),
    ])
  }

  const documentMutation = useMutation({
    mutationFn: ({ file, replaces }) => uploadEmployerDataProcessingAgreement(
      file,
      {
        ...(replaces ? { replaceDocument: replaces } : {}),
        onUploadStateChange: setUploadState,
      },
    ),
    onSuccess: async () => {
      message.success('Thông báo', {
        description: `Cập nhật thành công. ${siteName} đã nhận được giấy tờ của bạn và tiến hành xử lý sớm.`,
      })
      setFiles([])
      setCandidateAgreementAccepted(false)
      setEditingCandidateAgreement(false)
      setUploadState(null)
      await refresh()
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể tải văn bản lên.')),
  })
  const documentPreviewMutation = useMutation({
    mutationFn: async ({ document, previewWindow }) => ({
      document,
      previewWindow,
      content: await getEmployerCompanyDocumentContent(document),
    }),
    onSuccess: ({ content, document, previewWindow }) => {
      const previewUrl = URL.createObjectURL(content)
      if (browserCanPreview(content.type)) {
        previewWindow.location.replace(previewUrl)
      } else {
        previewWindow.close()
        const downloadLink = window.document.createElement('a')
        downloadLink.href = previewUrl
        downloadLink.download = documentDownloadName(document, content.type)
        downloadLink.click()
      }
      window.setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000)
    },
    onError: (error, { previewWindow }) => {
      previewWindow.close()
      message.error(getApiErrorMessage(error, 'Không thể mở tệp đã nộp. Vui lòng thử lại.'))
    },
  })
  const acceptMutation = useMutation({
    mutationFn: (policy) => acceptEmployerDpa(policy),
    onSuccess: async () => {
      message.success(`Đã xác nhận thỏa thuận xử lý dữ liệu với ${siteName}.`)
      setPlatformAgreementAccepted(false)
      await refresh()
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể ghi nhận thỏa thuận.')),
  })

  function openPrivateDocument(document) {
    const previewWindow = window.open('', '_blank')
    if (!previewWindow) {
      message.error('Trình duyệt đã chặn cửa sổ xem tệp. Hãy cho phép pop-up rồi thử lại.')
      return
    }
    previewWindow.opener = null
    documentPreviewMutation.mutate({ document, previewWindow })
  }

  if (profileQuery.isLoading) return <Skeleton active paragraph={{ rows: 12 }} />

  const verification = profileQuery.data?.onboarding || {}
  const dpaPolicy = profileQuery.data?.dpa_policy
  const dpaPolicyAvailable = Boolean(
    dpaPolicy?.available
    && dpaPolicy.policy_version
    && /^[0-9a-f]{64}$/.test(dpaPolicy.document_sha256 || ''),
  )
  const platformDpaUrl = dpaPolicyAvailable ? dpaPolicy.document_url : PLATFORM_DPA_URL
  const currentDpaAccepted = profileQuery.data?.dpa_status
    ? profileQuery.data.dpa_status === 'current'
    : Boolean(verification.dpa_accepted)
  const dpaStatus = profileQuery.data?.dpa_status
  const graceExpiresAt = formatAgreementAcceptedAt(profileQuery.data?.dpa_grace_expires_at)
  const documents = (Array.isArray(documentsQuery.data) ? documentsQuery.data : []).filter(
    (item) => (
      item.doc_type === 'data_processing_agreement'
      && item.is_current !== false
    ),
  )
  const selectedFile = files[0]?.originFileObj || files[0]
  const canSaveCandidateAgreement = Boolean(selectedFile && candidateAgreementAccepted)
  const candidateAgreementDocument = documents[0]
  const candidateAgreementSubmitted = Boolean(verification.candidate_dpa_submitted || candidateAgreementDocument)
  const candidateAgreementStatus = candidateAgreementDocument?.status
    || (verification.candidate_dpa_approved ? 'approved' : candidateAgreementSubmitted ? 'pending' : null)
  const candidateAgreementStatusMeta = DOCUMENT_STATUS[candidateAgreementStatus]
  const showCandidateAgreementForm = !candidateAgreementSubmitted || editingCandidateAgreement
  const agreementAcceptedAt = formatAgreementAcceptedAt(profileQuery.data?.dpa_accepted_at)

  return (
    <div className="space-y-4">
      <section className="min-w-0 rounded-lg border border-slate-200 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Văn bản Thỏa thuận xử lý Dữ liệu cá nhân giữa Ứng viên - Nhà tuyển dụng</h2>
          </div>
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
            <Tag
              color={candidateAgreementStatusMeta?.color || 'default'}
              className="!m-0 !rounded-full !border-0 !px-3"
            >
              {candidateAgreementStatusMeta?.label || 'Chưa cập nhật'}
            </Tag>
            {candidateAgreementSubmitted && !editingCandidateAgreement && <Button aria-label="Chỉnh sửa văn bản" icon={<EditOutlined />} onClick={() => setEditingCandidateAgreement(true)} className="!border-emerald-500 !text-emerald-600 hover:!border-emerald-600 hover:!text-emerald-700">Chỉnh sửa</Button>}
          </div>
        </div>

        <p className="mt-6 text-sm text-slate-500">Xem mục đích sử dụng và hướng dẫn đăng tải <a href={CANDIDATE_DPA_GUIDE_URL} target="_blank" rel="noreferrer" className="font-medium !text-emerald-600 hover:!text-emerald-700">Tại đây</a></p>

        {['rejected', 'changes_requested'].includes(candidateAgreementStatus) && (
          <Alert
            className="mt-4"
            type={candidateAgreementStatus === 'rejected' ? 'error' : 'warning'}
            showIcon
            title={candidateAgreementStatusMeta.label}
            description={candidateAgreementDocument?.review_note || 'Quản trị viên chưa cung cấp lý do.'}
          />
        )}

        {showCandidateAgreementForm ? (
          <CandidateAgreementUploadForm
            accepted={candidateAgreementAccepted}
            canSave={canSaveCandidateAgreement}
            currentDocument={editingCandidateAgreement ? candidateAgreementDocument : null}
            files={files}
            onAcceptedChange={setCandidateAgreementAccepted}
            onCancel={candidateAgreementSubmitted ? () => { setFiles([]); setCandidateAgreementAccepted(false); setEditingCandidateAgreement(false) } : null}
            onFilesChange={setFiles}
            onOpenDocument={openPrivateDocument}
            onSave={() => documentMutation.mutate({
              file: selectedFile,
              replaces: candidateAgreementDocument?.public_id,
            })}
            openingDocument={documentPreviewMutation.isPending}
            siteName={siteName}
            submitting={documentMutation.isPending}
            uploadState={uploadState}
          />
        ) : candidateAgreementDocument ? (
          <div className="mt-4 grid min-w-0 items-center gap-6 rounded-lg border border-slate-200 p-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:p-6">
            <CandidateAgreementDocumentLink
              ariaLabel={CANDIDATE_AGREEMENT_DOCUMENT_NAME}
              className="group flex min-w-0 items-center gap-2 rounded-lg bg-slate-50 px-4 py-3 text-sm !text-slate-700 transition-colors hover:!bg-[var(--brand-primary-soft)] hover:!text-[var(--brand-primary)]"
              document={candidateAgreementDocument}
              onOpenDocument={openPrivateDocument}
              openingDocument={documentPreviewMutation.isPending}
            >
              <FileTextOutlined className="shrink-0 text-emerald-600 transition-colors group-hover:text-[var(--brand-primary)]" />
              <span className="truncate">{CANDIDATE_AGREEMENT_DOCUMENT_NAME}</span>
            </CandidateAgreementDocumentLink>
            <CandidateAgreementTemplate />
          </div>
        ) : <p className="mt-4 text-sm text-slate-500">Hệ thống đang đồng bộ văn bản của bạn.</p>}
      </section>

      <section className="min-w-0 rounded-lg border border-slate-200 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-800">Văn bản Thỏa thuận xử lý Dữ liệu cá nhân giữa {siteName} - Nhà tuyển dụng</h2>
          <StatusTag completed={currentDpaAccepted} completedLabel="Đã xác nhận" pendingLabel="Chưa xác nhận" />
        </div>
        <p className="mt-5 text-sm leading-6 text-slate-600">Nhằm tuân thủ Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15, {siteName} chính thức triển khai Thỏa thuận về xử lý dữ liệu cá nhân trên hệ thống. Thỏa thuận này làm rõ vai trò, trách nhiệm của Quý đơn vị và {siteName} đối với các hồ sơ ứng viên được chuyển vào Không gian làm việc (Workspace) của Quý đơn vị. Vui lòng đọc kỹ và xác nhận đồng ý để đảm bảo tiến trình tuyển dụng diễn ra hợp pháp, minh bạch và không bị gián đoạn.</p>
        <a href={platformDpaUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-medium !text-emerald-600 hover:!text-emerald-700">Xem nội dung đầy đủ của văn bản <LinkOutlined /></a>

        {dpaStatus === 'grace' && (
          <Alert
            className="mt-4"
            type="warning"
            showIcon
            title={graceExpiresAt ? `Cần cập nhật DPA trước ${graceExpiresAt}` : 'DPA đang trong thời gian gia hạn cập nhật'}
            description="Workspace vẫn hoạt động trong thời gian gia hạn. Quyền xem dữ liệu ứng viên và duyệt tin chỉ được mở lại sau khi xác nhận DPA hiện hành."
          />
        )}
        {dpaStatus === 'hold' && (
          <Alert
            className="mt-4"
            type="error"
            showIcon
            title="DPA đã quá hạn cập nhật"
            description="Hãy đọc và xác nhận DPA hiện hành để gỡ giới hạn do DPA. Các giới hạn xác thực khác, nếu có, vẫn được giữ nguyên."
          />
        )}

        {currentDpaAccepted ? (
          <p className="mt-4 text-sm text-emerald-700">{agreementAcceptedAt ? `Bạn đã xác nhận vào ${agreementAcceptedAt}.` : 'Bạn đã xác nhận thỏa thuận này.'}</p>
        ) : (
          <>
            {!dpaPolicyAvailable && (
              <Alert
                className="mt-4"
                type="warning"
                showIcon
                title="Phiên bản thỏa thuận hiện hành chưa sẵn sàng"
                description="Vui lòng tải lại sau. Hệ thống sẽ không ghi nhận xác nhận khi chưa khóa được phiên bản và nội dung văn bản."
              />
            )}
            <div className="mt-4">
              <Checkbox disabled={!dpaPolicyAvailable} checked={platformAgreementAccepted} onChange={(event) => setPlatformAgreementAccepted(event.target.checked)} className="!flex !items-start !text-sm !leading-5 !text-slate-600">Xác nhận đồng ý với các điều khoản của <a href={platformDpaUrl} target="_blank" rel="noreferrer" className="font-medium !text-emerald-600 hover:!text-emerald-700">Thỏa thuận về xử lý Dữ liệu cá nhân</a></Checkbox>
            </div>
            <div className="mt-4 flex justify-stretch sm:justify-end">
              <Button type="primary" size="large" disabled={!dpaPolicyAvailable || !platformAgreementAccepted} loading={acceptMutation.isPending} onClick={() => acceptMutation.mutate(dpaPolicy)} className="w-full !shadow-none sm:!min-w-[112px] sm:w-auto">Xác nhận</Button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
