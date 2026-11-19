import {
  DownloadOutlined,
  FileTextOutlined,
  WarningFilled,
} from '@ant-design/icons'
import { Alert, Button, Tag } from 'antd'
import { useState } from 'react'
import EmployerDocumentUploadBox from './EmployerDocumentUploadBox'
import { m } from '@/shared/config/i18n'

const AUTHORIZATION_TEMPLATE_URL = 'https://docs.google.com/document/d/1_cQDRuVuibU7XP1YPcsjpSYB8jokcqyR/edit?usp=sharing&ouid=111388583364027655585&rtpof=true&sd=true'
const ACCEPTED_FILE_TYPES = '.jpeg,.jpg,.png,.pdf'
const UPLOAD_HINT = m.employer_account_docs_upload_hint()
const MAX_FILES_PER_DOCUMENT_TYPE = 10
const DOCUMENT_STATUS = {
  pending: { color: 'gold', label: m.employer_account_docs_status_pending() },
  changes_requested: { color: 'orange', label: m.employer_account_docs_status_changes_requested() },
  approved: { color: 'green', label: m.employer_account_docs_status_approved() },
  rejected: { color: 'red', label: m.employer_account_docs_status_rejected() },
}
const SAMPLE_IMAGES = {
  business: { src: '/images/employer/business-registration-sample.jpg', alt: m.employer_account_docs_sample_business_alt() },
  authorization: { src: '/images/employer/authorization-sample.jpg', alt: m.employer_account_docs_sample_authorization_alt() },
  identity: { src: '/images/employer/identity-sample.jpg', alt: m.employer_account_docs_sample_identity_alt() },
}

function Illustration({ variant }) {
  const image = SAMPLE_IMAGES[variant]

  return <img src={image.src} alt={image.alt} className="h-[128px] max-w-[176px] rounded border border-slate-200 bg-white object-contain shadow-sm" loading="lazy" />
}

function UploadNotice({ documentName }) {
  return (
    <div className="mt-2 flex gap-2 rounded-lg bg-orange-50 px-3 py-2 text-xs leading-5 text-orange-600">
      <WarningFilled className="mt-0.5 shrink-0" />
      <ul className="list-disc space-y-0.5 pl-3">
        <li>{m.employer_account_docs_notice_complete()}</li>
        {documentName && <li>{m.employer_account_docs_notice_match_before()}{documentName}{m.employer_account_docs_notice_match_after()}</li>}
      </ul>
    </div>
  )
}

export function EmployerBusinessDocumentCard({
  label,
  files,
  onFilesChange,
  variant,
  noticeDocument,
  showTemplate = false,
  disabled,
  savedDocument,
  savedDocuments,
  submittedFileLabel,
  onViewDocument,
  viewingDocument,
  editing = false,
  replacementFiles = {},
  onReplacementFilesChange,
  allowNewFiles = false,
  uploadState,
}) {
  const [expandedReplacements, setExpandedReplacements] = useState({})
  const [addingFiles, setAddingFiles] = useState(false)
  const submittedDocuments = savedDocuments?.length
    ? savedDocuments
    : savedDocument
      ? [savedDocument]
      : []
  const supportsMultipleFiles = variant === 'identity'

  return (
    <section className="min-w-0 rounded-lg border border-slate-200 p-4 sm:p-6">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          {submittedDocuments.length > 0 ? (
            <>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">{label} <span className="text-red-500">*</span></h3>
              <div className="grid gap-1">
                {submittedDocuments.map((document, index) => {
                  const documentKey = document.public_id || document.id
                  const displayedFileName = submittedFileLabel
                    ? `${submittedFileLabel}${submittedDocuments.length > 1 ? ` ${index + 1}` : ''}`
                    : document.file_name || `${label} ${index + 1}`
                  const statusMeta = DOCUMENT_STATUS[document.status] || DOCUMENT_STATUS.pending
                  const needsCorrection = ['rejected', 'changes_requested'].includes(document.status)
                  const replacementSelected = Boolean(
                    replacementFiles[documentKey]?.files?.length
                    || replacementFiles[documentKey]?.length,
                  )
                  const replacementExpanded = Boolean(
                    needsCorrection
                    || replacementSelected
                    || expandedReplacements[documentKey],
                  )
                  return (
                    <div key={documentKey} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          aria-label={m.employer_account_docs_view_submitted_aria({ fileName: displayedFileName })}
                          disabled={viewingDocument}
                          onClick={() => onViewDocument(document)}
                          className="inline-flex min-w-0 max-w-full cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1 text-sm font-medium text-slate-700 transition hover:border-emerald-100 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:bg-emerald-100 disabled:cursor-wait disabled:opacity-60"
                        >
                          <FileTextOutlined className="shrink-0 text-emerald-600" />
                          <span className="truncate">
                            {viewingDocument ? m.employer_account_docs_opening_file() : displayedFileName}
                          </span>
                        </button>
                        <Tag color={statusMeta.color} className="!m-0 !rounded-full !border-0">
                          {statusMeta.label}
                        </Tag>
                      </div>
                      {needsCorrection && (
                        <Alert
                          className="mt-2"
                          type={document.status === 'rejected' ? 'error' : 'warning'}
                          showIcon
                          title={document.review_note || m.employer_account_docs_no_review_note()}
                        />
                      )}
                      {editing && (
                        <div className="mt-3">
                          {!replacementExpanded ? (
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2">
                              <span className="text-xs text-slate-500">{m.employer_account_docs_file_kept()}</span>
                              <Button
                                size="small"
                                onClick={() => setExpandedReplacements((current) => ({
                                  ...current,
                                  [documentKey]: true,
                                }))}
                              >
                                {m.employer_account_docs_replace_file()}
                              </Button>
                            </div>
                          ) : (
                            <>
                              {!needsCorrection && !replacementSelected && (
                                <Button
                                  type="link"
                                  size="small"
                                  className="!mb-1 !px-0"
                                  onClick={() => setExpandedReplacements((current) => ({
                                    ...current,
                                    [documentKey]: false,
                                  }))}
                                >
                                  {m.employer_account_docs_keep_file()}
                                </Button>
                              )}
                              <EmployerDocumentUploadBox
                                accept={ACCEPTED_FILE_TYPES}
                                disabled={disabled}
                                files={
                                  replacementFiles[documentKey]?.files
                                  || replacementFiles[documentKey]
                                  || []
                                }
                                label={m.employer_account_docs_replacement_for({ fileName: displayedFileName })}
                                maxCount={1}
                                onFilesChange={(nextFiles) => onReplacementFilesChange(
                                  document,
                                  nextFiles,
                                )}
                                uploadHint={UPLOAD_HINT}
                                uploadState={uploadState}
                              />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {editing && allowNewFiles && submittedDocuments.length < MAX_FILES_PER_DOCUMENT_TYPE && (
                <div className="mt-4">
                  {!addingFiles && !(files || []).length ? (
                    <Button onClick={() => setAddingFiles(true)}>
                      {m.employer_account_docs_add_identity_images()}
                    </Button>
                  ) : (
                    <>
                      {!(files || []).length && (
                        <Button
                          type="link"
                          size="small"
                          className="!mb-1 !px-0"
                          onClick={() => setAddingFiles(false)}
                        >
                          {m.employer_account_docs_skip_add_file()}
                        </Button>
                      )}
                      <EmployerDocumentUploadBox
                        accept={ACCEPTED_FILE_TYPES}
                        label={m.employer_account_docs_add_label({ label })}
                        files={files}
                        onFilesChange={onFilesChange}
                        disabled={disabled}
                        maxCount={MAX_FILES_PER_DOCUMENT_TYPE - submittedDocuments.length}
                        multiple
                        uploadHint={m.employer_account_docs_upload_hint_max({ max: MAX_FILES_PER_DOCUMENT_TYPE })}
                        uploadState={uploadState}
                      />
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <EmployerDocumentUploadBox
                accept={ACCEPTED_FILE_TYPES}
                label={label}
                files={files}
                onFilesChange={onFilesChange}
                disabled={disabled}
                maxCount={MAX_FILES_PER_DOCUMENT_TYPE}
                multiple={supportsMultipleFiles}
                uploadHint={supportsMultipleFiles
                  ? m.employer_account_docs_upload_hint_max({ max: MAX_FILES_PER_DOCUMENT_TYPE })
                  : UPLOAD_HINT}
                uploadState={uploadState}
              />
              <UploadNotice documentName={noticeDocument} />
            </>
          )}
        </div>
        <aside className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm font-medium text-slate-800">{m.employer_account_docs_sample()}</p>
          <Illustration variant={variant} />
          {showTemplate && <a href={AUTHORIZATION_TEMPLATE_URL} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-emerald-500 px-4 py-2 text-center text-sm font-medium text-emerald-600 transition hover:bg-emerald-50 sm:w-auto"><DownloadOutlined />{m.employer_account_docs_download_authorization_template()}</a>}
        </aside>
      </div>
    </section>
  )
}
