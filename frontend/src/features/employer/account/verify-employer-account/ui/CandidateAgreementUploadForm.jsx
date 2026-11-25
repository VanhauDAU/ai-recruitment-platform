import {
  DownloadOutlined,
  FileTextOutlined,
  WarningFilled,
} from '@ant-design/icons'
import { Button, Checkbox } from 'antd'
import { CandidateAgreementDocumentLink } from './CandidateAgreementDocumentLink'
import EmployerDocumentUploadBox from './EmployerDocumentUploadBox'
import { settingText, useSiteSettings } from '@/entities/system/site-settings'
import { m } from '@/shared/config/i18n'

// Mặc định là mẫu của ProCV; admin đổi qua cấu hình `employer_dpa_template_url`.
const DPA_TEMPLATE_URL = '/documents/procv-mau-thong-bao-xu-ly-dlcn-ung-vien.docx'
const ACCEPTED_FILE_TYPES = '.docx,.pdf'
const CANDIDATE_AGREEMENT_DOCUMENT_NAME = m.employer_account_dpa_document_name()

export function CandidateAgreementTemplate() {
  const { settings } = useSiteSettings()
  const templateUrl = settingText(settings.employer_dpa_template_url, DPA_TEMPLATE_URL)
  return (
    <aside className="flex flex-col items-center gap-4 text-center">
      <p className="text-sm font-medium text-slate-800">{m.employer_account_dpa_template()}</p>
      <a href={templateUrl} download className="inline-flex items-center gap-2 rounded-md border border-[var(--brand-primary)] px-4 py-2 text-sm font-medium !text-[var(--brand-primary)] transition hover:!text-[var(--brand-primary-hover)] hover:bg-[var(--brand-primary-soft)]"><DownloadOutlined />{m.employer_account_dpa_download_template()}</a>
    </aside>
  )
}

function UploadNotice() {
  return (
    <div className="mt-2 flex gap-2 rounded-lg bg-orange-50 px-3 py-2 text-xs leading-5 text-orange-600">
      <WarningFilled className="mt-0.5 shrink-0" />
      <span>{m.employer_account_dpa_upload_notice()}</span>
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
  siteName,
  uploadState,
}) {
  return (
    <>
      <div className="mt-4 min-w-0 rounded-lg border border-slate-200 p-4 sm:p-6">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-800">{m.employer_account_dpa_agreement_label()} <span className="text-red-500">*</span></h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{m.employer_account_dpa_agreement_desc()}</p>
            {currentDocument && (
              <CandidateAgreementDocumentLink
                ariaLabel={m.employer_account_dpa_current_file({ name: CANDIDATE_AGREEMENT_DOCUMENT_NAME })}
                className="group mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-3 text-sm font-medium !text-slate-700 transition-colors hover:!bg-[var(--brand-primary-soft)] hover:!text-[var(--brand-primary)]"
                document={currentDocument}
                onOpenDocument={onOpenDocument}
                openingDocument={openingDocument}
              >
                <FileTextOutlined className="shrink-0 text-[var(--brand-primary)] transition-colors group-hover:text-[var(--brand-primary)]" />
                {m.employer_account_dpa_current_file({ name: CANDIDATE_AGREEMENT_DOCUMENT_NAME })}
              </CandidateAgreementDocumentLink>
            )}
            <EmployerDocumentUploadBox
              accept={ACCEPTED_FILE_TYPES}
              className="mt-4"
              disabled={submitting}
              files={files}
              multiple={false}
              onFilesChange={onFilesChange}
              onResolvePreview={(file) => file}
              uploadHint={m.employer_account_dpa_upload_hint()}
              uploadState={uploadState}
            />
            <UploadNotice />
          </div>

          <CandidateAgreementTemplate />
        </div>
      </div>

      <Checkbox checked={accepted} onChange={(event) => onAcceptedChange(event.target.checked)} className="!mt-5 !flex !items-start !text-sm !leading-5 !text-slate-500">{m.employer_account_dpa_commitment({ siteName })}</Checkbox>
      <div className="mt-4 grid gap-2 sm:flex sm:justify-end sm:gap-3">
        {onCancel && <Button size="large" disabled={submitting} onClick={onCancel} className="w-full !shadow-none sm:!min-w-[100px] sm:w-auto">{m.employer_account_docs_cancel()}</Button>}
        <Button type="primary" size="large" disabled={!canSave} loading={submitting} onClick={onSave} className="w-full !shadow-none sm:!min-w-[100px] sm:w-auto">{m.employer_account_docs_save()}</Button>
      </div>
    </>
  )
}
