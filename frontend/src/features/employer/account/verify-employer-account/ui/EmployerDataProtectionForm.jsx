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
} from '@/entities/account/employer-profile'
import { settingText, useSiteSettings } from '@/entities/system/site-settings'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import CandidateAgreementUploadForm, {
  CandidateAgreementTemplate,
} from './CandidateAgreementUploadForm'
import { CandidateAgreementDocumentLink } from './CandidateAgreementDocumentLink'
import EmployerVerificationLifecycleAlert from './EmployerVerificationLifecycleAlert'
import { getIntlLocale, m } from '@/shared/config/i18n'

const CANDIDATE_AGREEMENT_DOCUMENT_NAME = m.employer_account_dpa_document_name()
const OFFICE_EXTENSION_BY_TYPE = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
}
const DOCUMENT_STATUS = {
  pending: { color: 'gold', label: m.employer_account_dpa_status_pending() },
  changes_requested: { color: 'orange', label: m.employer_account_docs_status_changes_requested() },
  approved: { color: 'green', label: m.employer_account_docs_status_approved() },
  rejected: { color: 'red', label: m.employer_account_docs_status_rejected() },
}

function StatusTag({ completed, completedLabel, pendingLabel, completedColor = 'green' }) {
  return <Tag color={completed ? completedColor : 'default'} className="!m-0 !rounded-full !border-0 !px-3">{completed ? completedLabel : pendingLabel}</Tag>
}

function formatAgreementAcceptedAt(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return null
  const parts = new Intl.DateTimeFormat(getIntlLocale(), {
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
  const { settings, siteName } = useSiteSettings()
  const guideUrl = settingText(settings.employer_dpa_guide_url)
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
      message.success(m.employer_account_docs_modal_title(), {
        description: m.employer_account_dpa_upload_success({ siteName }),
      })
      setFiles([])
      setCandidateAgreementAccepted(false)
      setEditingCandidateAgreement(false)
      setUploadState(null)
      await refresh()
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_account_dpa_upload_failed())),
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
      message.error(getApiErrorMessage(error, m.employer_account_docs_open_failed()))
    },
  })
  const acceptMutation = useMutation({
    mutationFn: (policy) => acceptEmployerDpa(policy),
    onSuccess: async () => {
      message.success(m.employer_account_dpa_accept_success({ siteName }))
      setPlatformAgreementAccepted(false)
      await refresh()
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_account_dpa_accept_failed())),
  })

  function openPrivateDocument(document) {
    const previewWindow = window.open('', '_blank')
    if (!previewWindow) {
      message.error(m.employer_account_docs_popup_blocked())
      return
    }
    previewWindow.opener = null
    documentPreviewMutation.mutate({ document, previewWindow })
  }

  if (profileQuery.isLoading) return <Skeleton active paragraph={{ rows: 12 }} />

  const verification = profileQuery.data?.onboarding || {}
  const verificationCase = profileQuery.data?.verification_case || {}
  const dpaPolicy = profileQuery.data?.dpa_policy
  const dpaPolicyAvailable = Boolean(
    dpaPolicy?.available
    && dpaPolicy.policy_version
    && /^[0-9a-f]{64}$/.test(dpaPolicy.document_sha256 || ''),
  )
  // DPA chính thức do máy chủ cấp (khớp mã băm); chưa cấu hình thì không có link.
  const platformDpaUrl = dpaPolicyAvailable ? dpaPolicy.document_url : ''
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
      <EmployerVerificationLifecycleAlert verificationCase={verificationCase} />
      <section className="min-w-0 rounded-lg border border-slate-200 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-800">{m.employer_account_dpa_candidate_heading()}</h2>
          </div>
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
            <Tag
              color={candidateAgreementStatusMeta?.color || 'default'}
              className="!m-0 !rounded-full !border-0 !px-3"
            >
              {candidateAgreementStatusMeta?.label || m.employer_account_docs_not_updated()}
            </Tag>
            {candidateAgreementSubmitted && !editingCandidateAgreement && <Button aria-label={m.employer_account_dpa_edit_aria()} icon={<EditOutlined />} onClick={() => setEditingCandidateAgreement(true)} className="!border-[var(--brand-primary)] !text-[var(--brand-primary)] hover:!border-[var(--brand-primary)] hover:!text-[var(--brand-primary-hover)]">{m.employer_account_docs_edit()}</Button>}
          </div>
        </div>

        {guideUrl && <p className="mt-6 text-sm text-slate-500">{m.employer_account_dpa_guide_intro()}<a href={guideUrl} target="_blank" rel="noreferrer" className="font-medium !text-[var(--brand-primary)] hover:!text-[var(--brand-primary-hover)]">{m.employer_account_docs_guide_link()}</a></p>}

        {['rejected', 'changes_requested'].includes(candidateAgreementStatus) && (
          <Alert
            className="mt-4"
            type={candidateAgreementStatus === 'rejected' ? 'error' : 'warning'}
            showIcon
            title={candidateAgreementStatusMeta.label}
            description={candidateAgreementDocument?.review_note || m.employer_account_docs_no_review_note()}
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
              <FileTextOutlined className="shrink-0 text-[var(--brand-primary)] transition-colors group-hover:text-[var(--brand-primary)]" />
              <span className="truncate">{CANDIDATE_AGREEMENT_DOCUMENT_NAME}</span>
            </CandidateAgreementDocumentLink>
            <CandidateAgreementTemplate />
          </div>
        ) : <p className="mt-4 text-sm text-slate-500">{m.employer_account_dpa_syncing()}</p>}
      </section>

      <section className="min-w-0 rounded-lg border border-slate-200 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-800">{m.employer_account_dpa_platform_heading({ siteName })}</h2>
          <StatusTag completed={currentDpaAccepted} completedLabel={m.employer_account_dpa_confirmed()} pendingLabel={m.employer_account_dpa_not_confirmed()} />
        </div>
        <p className="mt-5 text-sm leading-6 text-slate-600">{m.employer_account_dpa_platform_intro({ siteName })}</p>
        {platformDpaUrl && <a href={platformDpaUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-medium !text-[var(--brand-primary)] hover:!text-[var(--brand-primary-hover)]">{m.employer_account_dpa_view_full()} <LinkOutlined /></a>}

        {dpaStatus === 'grace' && (
          <Alert
            className="mt-4"
            type="warning"
            showIcon
            title={graceExpiresAt ? m.employer_account_dpa_grace_until({ date: graceExpiresAt }) : m.employer_account_dpa_grace()}
            description={m.employer_account_dpa_grace_desc()}
          />
        )}
        {dpaStatus === 'hold' && (
          <Alert
            className="mt-4"
            type="error"
            showIcon
            title={m.employer_account_dpa_hold_title()}
            description={m.employer_account_dpa_hold_desc()}
          />
        )}

        {currentDpaAccepted ? (
          <p className="mt-4 text-sm text-[var(--brand-primary-hover)]">{agreementAcceptedAt ? m.employer_account_dpa_accepted_at({ date: agreementAcceptedAt }) : m.employer_account_dpa_accepted()}</p>
        ) : (
          <>
            {!dpaPolicyAvailable && (
              <Alert
                className="mt-4"
                type="warning"
                showIcon
                title={m.employer_account_dpa_policy_unavailable_title()}
                description={m.employer_account_dpa_policy_unavailable_desc()}
              />
            )}
            <div className="mt-4">
              <Checkbox disabled={!dpaPolicyAvailable} checked={platformAgreementAccepted} onChange={(event) => setPlatformAgreementAccepted(event.target.checked)} className="!flex !items-start !text-sm !leading-5 !text-slate-600">{m.employer_account_dpa_agree_before()}{platformDpaUrl ? <a href={platformDpaUrl} target="_blank" rel="noreferrer" className="font-medium !text-[var(--brand-primary)] hover:!text-[var(--brand-primary-hover)]">{m.employer_account_dpa_agree_link()}</a> : m.employer_account_dpa_agree_link()}</Checkbox>
            </div>
            <div className="mt-4 flex justify-stretch sm:justify-end">
              <Button type="primary" size="large" disabled={!dpaPolicyAvailable || !platformAgreementAccepted} loading={acceptMutation.isPending} onClick={() => acceptMutation.mutate(dpaPolicy)} className="w-full !shadow-none sm:!min-w-[112px] sm:w-auto">{m.employer_account_dpa_confirm()}</Button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
