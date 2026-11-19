import { EditOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Modal, Radio, Skeleton, Tag } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import {
  employerProfileKeys,
  getEmployerProfile,
  getEmployerCompanyDocuments,
  getEmployerCompanyDocumentContent,
  prepareEmployerUpload,
  uploadEmployerBusinessDocument,
  uploadEmployerCompanyDocument,
} from '@/entities/account/employer-profile'
import { useSiteSettings } from '@/entities/system/site-settings'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { EMPLOYER_COMPANY_SETTINGS_URL } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import {
  currentDocumentSet,
  documentStatus,
  filesFromUploadList,
  replaceCachedDocuments,
  savedDocumentsFromResponse,
  uploadDocumentSet,
} from '../model/business-document-set'
import { EmployerBusinessDocumentCard } from './EmployerBusinessDocumentCard'
import EmployerVerificationLifecycleAlert from './EmployerVerificationLifecycleAlert'
import { m } from '@/shared/config/i18n'

const UPLOAD_GUIDE_URL = 'https://drive.google.com/file/d/1yYXQMXUjW7_vF3dlpsQd0EBo8WinH9K-/view'

const DOCUMENT_STATUS = {
  pending: { color: 'gold', label: m.employer_account_docs_status_pending() },
  changes_requested: { color: 'orange', label: m.employer_account_docs_set_changes_requested() },
  approved: { color: 'green', label: m.employer_account_docs_status_approved() },
  rejected: { color: 'red', label: m.employer_account_docs_set_rejected() },
}

export default function EmployerBusinessLicenseForm() {
  const [method, setMethod] = useState('business_registration')
  const [businessFiles, setBusinessFiles] = useState([])
  const [authorizationFiles, setAuthorizationFiles] = useState([])
  const [identityFiles, setIdentityFiles] = useState([])
  const [replacementFiles, setReplacementFiles] = useState({})
  const [submissionConfirmed, setSubmissionConfirmed] = useState(false)
  const [editingDocuments, setEditingDocuments] = useState(false)
  const [uploadState, setUploadState] = useState(null)
  const queryClient = useQueryClient()
  const { siteName } = useSiteSettings()
  const profileQuery = useQuery({ queryKey: ['employer', 'profile'], queryFn: getEmployerProfile })
  const documentsQuery = useQuery({
    queryKey: employerProfileKeys.companyDocumentList('mine'),
    queryFn: () => getEmployerCompanyDocuments({ scope: 'mine' }),
  })

  async function refreshDashboard() {
    await Promise.all([
      profileQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ['employer-dashboard'] }),
    ])
  }

  const documentMutation = useMutation({
    mutationFn: async ({
      selectedMethod,
      businessFile,
      authorizationFiles,
      identityFiles,
      replacements,
      preserveExisting,
    }) => {
      const filesToPrepare = preserveExisting || replacements.length
        ? [...replacements.map(({ file }) => file), ...identityFiles]
        : selectedMethod === 'business_registration'
          ? [businessFile]
          : [...authorizationFiles, ...identityFiles]
      const uploadSessions = new Map(await Promise.all(
        filesToPrepare.filter(Boolean).map(async (file) => [
          file,
          await prepareEmployerUpload(file, 'employer_verification', {
            onStateChange: setUploadState,
          }),
        ]),
      ))
      if (preserveExisting || replacements.length) {
        const replacementDocuments = []
        for (const { document, file } of replacements) {
          const savedDocument = document.doc_type === 'business_registration'
              ? await uploadEmployerBusinessDocument(file, {
                replaceDocument: document.public_id,
                uploadSession: uploadSessions.get(file),
              })
            : await uploadEmployerCompanyDocument(document.doc_type, file, {
                replaceDocument: document.public_id,
                verificationMethod: selectedMethod,
                uploadSession: uploadSessions.get(file),
              })
          replacementDocuments.push(savedDocument)
        }
        for (const file of identityFiles) {
          replacementDocuments.push(await uploadEmployerCompanyDocument(
            'identity_document',
            file,
            { append: true, uploadSession: uploadSessions.get(file) },
          ))
        }
        return replacementDocuments
      }
      if (selectedMethod === 'business_registration') {
        return uploadEmployerBusinessDocument(businessFile, {
          uploadSession: uploadSessions.get(businessFile),
        })
      }
      const authorizationDocuments = await uploadDocumentSet(
        'authorization_letter',
        authorizationFiles,
        undefined,
        { uploadSessions },
      )
      const identityDocuments = await uploadDocumentSet(
        'identity_document',
        identityFiles,
        'authorization_and_id',
        { uploadSessions },
      )
      return [...authorizationDocuments, ...identityDocuments]
    },
    onSuccess: async (response, {
      selectedMethod,
      replacements,
      preserveExisting,
    }) => {
      const uploadedDocuments = savedDocumentsFromResponse(response)
      queryClient.setQueryData(
        employerProfileKeys.companyDocumentList('mine'),
        (cachedDocuments) => {
          if (!preserveExisting) {
            return replaceCachedDocuments(cachedDocuments, uploadedDocuments, selectedMethod)
          }
          const replacedIds = new Set(replacements.flatMap(({ document }) => (
            [document.id, document.public_id].filter(Boolean)
          )))
          const uploadedIds = new Set(uploadedDocuments.flatMap((document) => (
            [document.id, document.public_id].filter(Boolean)
          )))
          return [
            ...uploadedDocuments,
            ...(Array.isArray(cachedDocuments) ? cachedDocuments : []).filter(
              (document) => (
                !replacedIds.has(document.id)
                && !replacedIds.has(document.public_id)
                && !uploadedIds.has(document.id)
                && !uploadedIds.has(document.public_id)
              ),
            ),
          ]
        },
      )
      setBusinessFiles([])
      setAuthorizationFiles([])
      setIdentityFiles([])
      setReplacementFiles({})
      setEditingDocuments(false)
      setUploadState(null)
      setSubmissionConfirmed(true)
      await refreshDashboard()
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, m.employer_account_docs_save_failed()))
    },
  })

  const documentPreviewMutation = useMutation({
    mutationFn: async ({ document, previewWindow }) => ({
      document,
      previewWindow,
      content: await getEmployerCompanyDocumentContent(document),
    }),
    onSuccess: ({ content, previewWindow }) => {
      const documentUrl = URL.createObjectURL(content)
      previewWindow.location.replace(documentUrl)
      window.setTimeout(() => URL.revokeObjectURL(documentUrl), 60_000)
    },
    onError: (error, { previewWindow }) => {
      previewWindow.close()
      message.error(getApiErrorMessage(error, m.employer_account_docs_open_failed()))
    },
  })

  if (profileQuery.isLoading) return <Skeleton active paragraph={{ rows: 10 }} />

  const companyLinked = Boolean(profileQuery.data?.onboarding?.company_linked)
  const verificationCase = profileQuery.data?.verification_case || {}
  const resubmissionLocked = Boolean(verificationCase.resubmission_locked)
  const documents = Array.isArray(documentsQuery.data) ? documentsQuery.data : []
  const savedDocuments = currentDocumentSet(documents)
  const savedStatus = documentStatus(savedDocuments.documents)
  const savedStatusMeta = savedStatus ? DOCUMENT_STATUS[savedStatus] : null
  const showDocumentForm = (!savedStatus || editingDocuments) && !resubmissionLocked
  const businessFile = businessFiles[0]?.originFileObj || businessFiles[0]
  const selectedAuthorizationFiles = filesFromUploadList(authorizationFiles)
  const selectedIdentityFiles = filesFromUploadList(identityFiles)
  const preservingCurrentMethod = Boolean(
    editingDocuments && savedDocuments.method && savedDocuments.method === method,
  )
  const replacements = Object.values(replacementFiles).flatMap((selection) => {
    const file = selection.files?.[0]
    return file
      ? [{ document: selection.document, file: file.originFileObj || file }]
      : []
  })
  const replacementDocumentIds = new Set(replacements.map(({ document }) => (
    document.public_id || document.id
  )))
  const requiredCorrectionDocuments = savedDocuments.documents.filter((document) => (
    ['changes_requested', 'rejected'].includes(document.status)
  ))
  const allRequiredCorrectionsSelected = requiredCorrectionDocuments.every((document) => (
    replacementDocumentIds.has(document.public_id || document.id)
  ))
  const hasRequiredFiles = preservingCurrentMethod
    ? requiredCorrectionDocuments.length
      ? allRequiredCorrectionsSelected
      : Boolean(replacements.length || selectedIdentityFiles.length)
    : method === 'business_registration'
      ? Boolean(businessFile)
      : Boolean(selectedAuthorizationFiles.length && selectedIdentityFiles.length)
  const canSave = !resubmissionLocked
    && companyLinked
    && hasRequiredFiles
    && !documentMutation.isPending
  const saveHint = resubmissionLocked
    ? m.employer_account_docs_hint_locked()
    : !companyLinked
    ? m.employer_account_docs_hint_company()
    : !hasRequiredFiles
      ? preservingCurrentMethod && requiredCorrectionDocuments.length
        ? m.employer_account_docs_hint_replace_all()
        : method === 'business_registration'
          ? m.employer_account_docs_hint_business()
          : m.employer_account_docs_hint_authorization()
      : undefined

  function startEditing() {
    setMethod(savedDocuments.method || 'business_registration')
    setReplacementFiles({})
    setEditingDocuments(true)
  }

  function cancelEditing() {
    setBusinessFiles([])
    setAuthorizationFiles([])
    setIdentityFiles([])
    setReplacementFiles({})
    setEditingDocuments(false)
  }

  function updateReplacementFiles(document, nextFiles) {
    const key = document.public_id || document.id
    setReplacementFiles((current) => ({
      ...current,
      [key]: { document, files: nextFiles },
    }))
  }

  function saveDocuments() {
    documentMutation.mutate({
      selectedMethod: method,
      businessFile,
      authorizationFiles: selectedAuthorizationFiles,
      identityFiles: selectedIdentityFiles,
      replacements,
      preserveExisting: preservingCurrentMethod,
    })
  }

  function openDocumentInNewTab(document) {
    const previewWindow = window.open('', '_blank')
    if (!previewWindow) {
      message.error(m.employer_account_docs_popup_blocked())
      return
    }
    previewWindow.opener = null
    documentPreviewMutation.mutate({ document, previewWindow })
  }

  return (
    <div>
      <EmployerVerificationLifecycleAlert
        className="mb-5"
        verificationCase={verificationCase}
      />
      {resubmissionLocked && (
        <Alert
          className="mb-5"
          showIcon
          type="error"
          title={m.employer_account_docs_locked_title()}
          description={m.employer_account_docs_locked_desc({ count: verificationCase.final_rejection_count || 3, limit: verificationCase.rejection_limit || 3 })}
        />
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-800">{m.employer_account_docs_heading()}</h2>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
          <Tag color={savedStatusMeta?.color || 'default'} className="!m-0 !rounded-full !border-0 !px-3">
            {savedStatusMeta?.label || m.employer_account_docs_not_updated()}
          </Tag>
          {savedStatus && !editingDocuments && (
            <Button
              aria-label={m.employer_account_docs_edit_aria()}
              icon={<EditOutlined />}
              onClick={startEditing}
              disabled={resubmissionLocked}
              className="!border-emerald-500 !text-emerald-600 hover:!border-emerald-600 hover:!text-emerald-700"
            >
              {m.employer_account_docs_edit()}
            </Button>
          )}
        </div>
      </div>
      <p className="mt-6 text-sm text-slate-700">{m.employer_account_docs_choose_method()}<a href={UPLOAD_GUIDE_URL} target="_blank" rel="noreferrer" className="font-medium text-emerald-600 hover:text-emerald-700">{m.employer_account_docs_guide_link()}</a></p>

      {!showDocumentForm && <Radio.Group value={savedDocuments.method} disabled className="!mt-6 !grid !gap-0">
        <Radio value="business_registration" className="!my-3 !mr-0 !text-sm !font-semibold !text-slate-800">{m.employer_account_docs_business_or_equivalent()}</Radio>
        {savedDocuments.method === 'business_registration' && (
          <div className="mb-4">
            <EmployerBusinessDocumentCard
              label={m.employer_account_docs_business_or_equivalent()}
              variant="business"
              savedDocument={savedDocuments.documents[0]}
              submittedFileLabel={m.employer_account_docs_business_registration()}
              onViewDocument={openDocumentInNewTab}
              viewingDocument={documentPreviewMutation.isPending}
            />
          </div>
        )}

        <Radio value="authorization_and_id" className="!my-3 !mr-0 !text-sm !font-semibold !text-slate-800">{m.employer_account_docs_authorization_and_id()}</Radio>
        {savedDocuments.method === 'authorization_and_id' && (
          <div className="mb-4 mt-1 grid gap-5">
            <EmployerBusinessDocumentCard
              label={m.employer_account_docs_authorization_letter()}
              variant="authorization"
              showTemplate
              savedDocuments={savedDocuments.documents.filter((document) => document.doc_type === 'authorization_letter')}
              submittedFileLabel={m.employer_account_docs_authorization_letter()}
              onViewDocument={openDocumentInNewTab}
              viewingDocument={documentPreviewMutation.isPending}
            />
            <EmployerBusinessDocumentCard
              label={m.employer_account_docs_identity_document_full()}
              variant="identity"
              savedDocuments={savedDocuments.documents.filter((document) => document.doc_type === 'identity_document')}
              submittedFileLabel={m.employer_account_docs_identity_document()}
              onViewDocument={openDocumentInNewTab}
              viewingDocument={documentPreviewMutation.isPending}
            />
          </div>
        )}
      </Radio.Group>
      }

      {showDocumentForm && <Radio.Group value={method} onChange={(event) => setMethod(event.target.value)} className="!mt-6 !grid !gap-0">
        <Radio value="business_registration" className="!my-3 !mr-0 !text-sm !font-semibold !text-slate-800">{m.employer_account_docs_business_or_equivalent()}</Radio>
        {method === 'business_registration' && (
          <div className="mb-4">
            <EmployerBusinessDocumentCard
              label={m.employer_account_docs_business_or_equivalent()}
              files={businessFiles}
              onFilesChange={setBusinessFiles}
              variant="business"
              noticeDocument={m.employer_account_docs_business_registration()}
              disabled={documentMutation.isPending}
              savedDocument={preservingCurrentMethod ? savedDocuments.documents[0] : null}
              submittedFileLabel={m.employer_account_docs_business_registration()}
              onViewDocument={openDocumentInNewTab}
              viewingDocument={documentPreviewMutation.isPending}
              editing={preservingCurrentMethod}
              replacementFiles={replacementFiles}
              onReplacementFilesChange={updateReplacementFiles}
              uploadState={uploadState}
            />
          </div>
        )}

        <Radio value="authorization_and_id" className="!my-3 !mr-0 !text-sm !font-semibold !text-slate-800">{m.employer_account_docs_authorization_and_id()}</Radio>
        {method === 'authorization_and_id' && (
          <div className="mb-4 mt-1 grid gap-5">
            <EmployerBusinessDocumentCard
              label={m.employer_account_docs_authorization_letter()}
              files={authorizationFiles}
              onFilesChange={setAuthorizationFiles}
              variant="authorization"
              noticeDocument={m.employer_account_docs_authorization_letter()}
              showTemplate
              disabled={documentMutation.isPending}
              savedDocuments={preservingCurrentMethod
                ? savedDocuments.documents.filter((document) => document.doc_type === 'authorization_letter')
                : []}
              submittedFileLabel={m.employer_account_docs_authorization_letter()}
              onViewDocument={openDocumentInNewTab}
              viewingDocument={documentPreviewMutation.isPending}
              editing={preservingCurrentMethod}
              replacementFiles={replacementFiles}
              onReplacementFilesChange={updateReplacementFiles}
              uploadState={uploadState}
            />
            <EmployerBusinessDocumentCard
              label={m.employer_account_docs_identity_document_full()}
              files={identityFiles}
              onFilesChange={setIdentityFiles}
              variant="identity"
              disabled={documentMutation.isPending}
              savedDocuments={preservingCurrentMethod
                ? savedDocuments.documents.filter((document) => document.doc_type === 'identity_document')
                : []}
              submittedFileLabel={m.employer_account_docs_identity_document()}
              onViewDocument={openDocumentInNewTab}
              viewingDocument={documentPreviewMutation.isPending}
              editing={preservingCurrentMethod}
              replacementFiles={replacementFiles}
              onReplacementFilesChange={updateReplacementFiles}
              allowNewFiles={preservingCurrentMethod}
              uploadState={uploadState}
            />
          </div>
        )}
      </Radio.Group>
      }

      {showDocumentForm && <div className="mt-5 flex flex-col gap-2 sm:items-end">
        {editingDocuments && <Button disabled={documentMutation.isPending} onClick={cancelEditing} className="w-full !shadow-none sm:!min-w-[100px] sm:w-auto">{m.employer_account_docs_cancel()}</Button>}
        <Button
          type="primary"
          size="large"
          disabled={!canSave}
          loading={documentMutation.isPending}
          title={saveHint}
          className="w-full !shadow-none sm:!min-w-[100px] sm:w-auto"
          onClick={saveDocuments}
        >
          {m.employer_account_docs_save()}
        </Button>
        {!companyLinked && <p className="text-left text-xs leading-5 text-slate-500 sm:text-right">{m.employer_account_docs_need_company_before()}<Link to={`${EMPLOYER_COMPANY_SETTINGS_URL}?update=true`} className="font-medium text-emerald-600 hover:text-emerald-700">{m.employer_account_docs_need_company_link()}</Link>{m.employer_account_docs_need_company_after()}</p>}
      </div>
      }
      <Modal
        centered
        destroyOnHidden
        open={submissionConfirmed}
        title={m.employer_account_docs_modal_title()}
        okText={m.employer_account_docs_modal_ok()}
        onOk={() => setSubmissionConfirmed(false)}
        onCancel={() => setSubmissionConfirmed(false)}
      >
        <p className="text-sm leading-6 text-slate-600">
          {m.employer_account_docs_submitted_notice({ siteName })}
        </p>
      </Modal>
    </div>
  )
}
