import {
  DownloadOutlined,
  FileTextOutlined,
  WarningFilled,
} from '@ant-design/icons'
import { Button, Checkbox } from 'antd'
import { CandidateAgreementDocumentLink } from './CandidateAgreementDocumentLink'
import EmployerDocumentUploadBox from './EmployerDocumentUploadBox'

const DPA_TEMPLATE_URL = '/documents/topcv-mau-van-ban-thong-bao-dong-y-xu-ly-dlcn.docx'
const ACCEPTED_FILE_TYPES = '.doc,.docx,.pdf'
const CANDIDATE_AGREEMENT_DOCUMENT_NAME = 'Thỏa thuận xử lý DLCN'

export function CandidateAgreementTemplate() {
  return (
    <aside className="flex flex-col items-center gap-4 text-center">
      <p className="text-sm font-medium text-slate-800">Văn bản mẫu</p>
      <a href={DPA_TEMPLATE_URL} download className="inline-flex items-center gap-2 rounded-md border border-emerald-500 px-4 py-2 text-sm font-medium !text-emerald-600 transition hover:!text-emerald-700 hover:bg-emerald-50"><DownloadOutlined />Tải mẫu văn bản</a>
    </aside>
  )
}

function UploadNotice() {
  return (
    <div className="mt-2 flex gap-2 rounded-lg bg-orange-50 px-3 py-2 text-xs leading-5 text-orange-600">
      <WarningFilled className="mt-0.5 shrink-0" />
      <span>Văn bản đăng tải cần đầy đủ các mặt và không có dấu hiệu chỉnh sửa/ che/ cắt thông tin.</span>
    </div>
  )
}

export default function CandidateAgreementUploadForm({
  currentDocument,
  files,
  onFilesChange,
  accepted,
  onAcceptedChange,
  onCancel,
  submitting,
  canSave,
  onSave,
  onOpenDocument,
  openingDocument,
  onPreviewSelectedFile,
  previewingSelectedFile,
  siteName,
}) {
  return (
    <>
      <div className="mt-4 min-w-0 rounded-lg border border-slate-200 p-4 sm:p-6">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-800">Văn bản Thỏa thuận <span className="text-red-500">*</span></h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Văn bản thể hiện việc Ứng viên đồng ý cho phép Nhà tuyển dụng thu thập, lưu trữ và sử dụng dữ liệu cá nhân của Ứng viên để phục vụ mục đích tuyển dụng.</p>
            {currentDocument && (
              <CandidateAgreementDocumentLink
                ariaLabel={`Tệp hiện tại: ${CANDIDATE_AGREEMENT_DOCUMENT_NAME}`}
                className="group mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-3 text-sm font-medium !text-slate-700 transition-colors hover:!bg-[var(--brand-primary-soft)] hover:!text-[var(--brand-primary)]"
                document={currentDocument}
                onOpenDocument={onOpenDocument}
                openingDocument={openingDocument}
              >
                <FileTextOutlined className="shrink-0 text-emerald-600 transition-colors group-hover:text-[var(--brand-primary)]" />
                Tệp hiện tại: {CANDIDATE_AGREEMENT_DOCUMENT_NAME}
              </CandidateAgreementDocumentLink>
            )}
            <EmployerDocumentUploadBox
              accept={ACCEPTED_FILE_TYPES}
              className="mt-4"
              disabled={submitting}
              files={files}
              multiple={false}
              onFilesChange={onFilesChange}
              onResolvePreview={(file) => (
                file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
                  ? file
                  : onPreviewSelectedFile(file)
              )}
              previewing={previewingSelectedFile}
              uploadHint="Dung lượng tối đa 5MB, định dạng: docx, doc, pdf"
            />
            <UploadNotice />
          </div>

          <CandidateAgreementTemplate />
        </div>
      </div>

      <Checkbox checked={accepted} onChange={(event) => onAcceptedChange(event.target.checked)} className="!mt-5 !flex !items-start !text-sm !leading-5 !text-slate-500">Tôi cam đoan văn bản này là tài liệu hợp pháp của doanh nghiệp và chịu hoàn toàn trách nhiệm về tính chính xác, hợp lệ của nội dung. {siteName} chỉ là nền tảng trung gian lưu trữ văn bản này.</Checkbox>
      <div className="mt-4 grid gap-2 sm:flex sm:justify-end sm:gap-3">
        {onCancel && <Button size="large" disabled={submitting} onClick={onCancel} className="w-full !shadow-none sm:!min-w-[100px] sm:w-auto">Hủy</Button>}
        <Button type="primary" size="large" disabled={!canSave} loading={submitting} onClick={onSave} className="w-full !shadow-none sm:!min-w-[100px] sm:w-auto">Lưu</Button>
      </div>
    </>
  )
}
