import { EditOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Modal, Radio, Skeleton, Tag } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import {
  employerProfileKeys,
  getEmployerProfile,
  getEmployerCompanyDocuments,
  getEmployerCompanyDocumentContent,
  uploadEmployerBusinessDocument,
  uploadEmployerCompanyDocument,
} from '@/entities/employer-profile'
import { useSiteSettings } from '@/entities/site-settings'
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

const UPLOAD_GUIDE_URL = 'https://drive.google.com/file/d/1yYXQMXUjW7_vF3dlpsQd0EBo8WinH9K-/view'

const DOCUMENT_STATUS = {
  pending: { color: 'gold', label: 'Đang xử lý' },
  changes_requested: { color: 'orange', label: 'Có file cần bổ sung' },
  approved: { color: 'green', label: 'Đã duyệt' },
  rejected: { color: 'red', label: 'Có file bị từ chối' },
}

export default function EmployerBusinessLicenseForm() {
  const [method, setMethod] = useState('business_registration')
  const [businessFiles, setBusinessFiles] = useState([])
  const [authorizationFiles, setAuthorizationFiles] = useState([])
  const [identityFiles, setIdentityFiles] = useState([])
  const [replacementFiles, setReplacementFiles] = useState({})
  const [submissionConfirmed, setSubmissionConfirmed] = useState(false)
  const [editingDocuments, setEditingDocuments] = useState(false)
  const queryClient = useQueryClient()
  const { siteName } = useSiteSettings()
  const profileQuery = useQuery({ queryKey: ['employer', 'profile'], queryFn: getEmployerProfile })
  const documentsQuery = useQuery({
    queryKey: employerProfileKeys.companyDocuments,
    queryFn: getEmployerCompanyDocuments,
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
      if (preserveExisting || replacements.length) {
        const replacementDocuments = []
        for (const { document, file } of replacements) {
          const savedDocument = document.doc_type === 'business_registration'
            ? await uploadEmployerBusinessDocument(file, {
                replaceDocument: document.public_id,
              })
            : await uploadEmployerCompanyDocument(document.doc_type, file, {
                replaceDocument: document.public_id,
                verificationMethod: selectedMethod,
              })
          replacementDocuments.push(savedDocument)
        }
        for (const file of identityFiles) {
          replacementDocuments.push(await uploadEmployerCompanyDocument(
            'identity_document',
            file,
            { append: true },
          ))
        }
        return replacementDocuments
      }
      if (selectedMethod === 'business_registration') {
        return uploadEmployerBusinessDocument(businessFile)
      }
      const authorizationDocuments = await uploadDocumentSet(
        'authorization_letter',
        authorizationFiles,
      )
      const identityDocuments = await uploadDocumentSet(
        'identity_document',
        identityFiles,
        'authorization_and_id',
      )
      return [...authorizationDocuments, ...identityDocuments]
    },
    onSuccess: async (response, {
      selectedMethod,
      replacements,
      preserveExisting,
    }) => {
      const uploadedDocuments = savedDocumentsFromResponse(response)
      queryClient.setQueryData(employerProfileKeys.companyDocuments, (cachedDocuments) => {
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
      })
      setBusinessFiles([])
      setAuthorizationFiles([])
      setIdentityFiles([])
      setReplacementFiles({})
      setEditingDocuments(false)
      setSubmissionConfirmed(true)
      await refreshDashboard()
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, 'Không thể lưu giấy tờ. Vui lòng thử lại.'))
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
      message.error(getApiErrorMessage(error, 'Không thể mở tệp đã nộp. Vui lòng thử lại.'))
    },
  })

  if (profileQuery.isLoading) return <Skeleton active paragraph={{ rows: 10 }} />

  const companyLinked = Boolean(profileQuery.data?.onboarding?.company_linked)
  const documents = Array.isArray(documentsQuery.data) ? documentsQuery.data : []
  const savedDocuments = currentDocumentSet(documents)
  const savedStatus = documentStatus(savedDocuments.documents)
  const savedStatusMeta = savedStatus ? DOCUMENT_STATUS[savedStatus] : null
  const showDocumentForm = !savedStatus || editingDocuments
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
  const hasRequiredFiles = preservingCurrentMethod
    ? Boolean(replacements.length || selectedIdentityFiles.length)
    : method === 'business_registration'
      ? Boolean(businessFile)
      : Boolean(selectedAuthorizationFiles.length && selectedIdentityFiles.length)
  const canSave = companyLinked && hasRequiredFiles && !documentMutation.isPending
  const saveHint = !companyLinked
    ? 'Cần cập nhật thông tin công ty trước khi lưu'
    : !hasRequiredFiles
      ? method === 'business_registration'
        ? 'Chọn giấy đăng ký doanh nghiệp để lưu'
        : 'Chọn đủ giấy ủy quyền và giấy tờ định danh để lưu'
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
      message.error('Trình duyệt đã chặn cửa sổ xem tệp. Hãy cho phép pop-up rồi thử lại.')
      return
    }
    previewWindow.opener = null
    documentPreviewMutation.mutate({ document, previewWindow })
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-800">Thông tin Giấy đăng ký doanh nghiệp</h2>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
          <Tag color={savedStatusMeta?.color || 'default'} className="!m-0 !rounded-full !border-0 !px-3">
            {savedStatusMeta?.label || 'Chưa cập nhật'}
          </Tag>
          {savedStatus && !editingDocuments && (
            <Button
              aria-label="Chỉnh sửa giấy tờ"
              icon={<EditOutlined />}
              onClick={startEditing}
              className="!border-emerald-500 !text-emerald-600 hover:!border-emerald-600 hover:!text-emerald-700"
            >
              Chỉnh sửa
            </Button>
          )}
        </div>
      </div>
      <p className="mt-6 text-sm text-slate-700">Vui lòng lựa chọn phương thức đăng tải, xem hướng dẫn đăng tải <a href={UPLOAD_GUIDE_URL} target="_blank" rel="noreferrer" className="font-medium text-emerald-600 hover:text-emerald-700">Tại đây</a></p>

      {!showDocumentForm && <Radio.Group value={savedDocuments.method} disabled className="!mt-6 !grid !gap-0">
        <Radio value="business_registration" className="!my-3 !mr-0 !text-sm !font-semibold !text-slate-800">Giấy đăng ký doanh nghiệp hoặc Giấy tờ tương đương khác</Radio>
        {savedDocuments.method === 'business_registration' && (
          <div className="mb-4">
            <EmployerBusinessDocumentCard
              label="Giấy đăng ký doanh nghiệp hoặc Giấy tờ tương đương khác"
              variant="business"
              savedDocument={savedDocuments.documents[0]}
              submittedFileLabel="Giấy đăng ký doanh nghiệp"
              onViewDocument={openDocumentInNewTab}
              viewingDocument={documentPreviewMutation.isPending}
            />
          </div>
        )}

        <Radio value="authorization_and_id" className="!my-3 !mr-0 !text-sm !font-semibold !text-slate-800">Giấy ủy quyền và Giấy tờ định danh</Radio>
        {savedDocuments.method === 'authorization_and_id' && (
          <div className="mb-4 mt-1 grid gap-5">
            <EmployerBusinessDocumentCard
              label="Giấy ủy quyền"
              variant="authorization"
              showTemplate
              savedDocuments={savedDocuments.documents.filter((document) => document.doc_type === 'authorization_letter')}
              submittedFileLabel="Giấy ủy quyền"
              onViewDocument={openDocumentInNewTab}
              viewingDocument={documentPreviewMutation.isPending}
            />
            <EmployerBusinessDocumentCard
              label="Giấy tờ định danh (CCCD/ Hộ chiếu)"
              variant="identity"
              savedDocuments={savedDocuments.documents.filter((document) => document.doc_type === 'identity_document')}
              submittedFileLabel="Giấy tờ định danh"
              onViewDocument={openDocumentInNewTab}
              viewingDocument={documentPreviewMutation.isPending}
            />
          </div>
        )}
      </Radio.Group>
      }

      {showDocumentForm && <Radio.Group value={method} onChange={(event) => setMethod(event.target.value)} className="!mt-6 !grid !gap-0">
        <Radio value="business_registration" className="!my-3 !mr-0 !text-sm !font-semibold !text-slate-800">Giấy đăng ký doanh nghiệp hoặc Giấy tờ tương đương khác</Radio>
        {method === 'business_registration' && (
          <div className="mb-4">
            <EmployerBusinessDocumentCard
              label="Giấy đăng ký doanh nghiệp hoặc Giấy tờ tương đương khác"
              files={businessFiles}
              onFilesChange={setBusinessFiles}
              variant="business"
              noticeDocument="Giấy đăng ký doanh nghiệp"
              disabled={documentMutation.isPending}
              savedDocument={preservingCurrentMethod ? savedDocuments.documents[0] : null}
              submittedFileLabel="Giấy đăng ký doanh nghiệp"
              onViewDocument={openDocumentInNewTab}
              viewingDocument={documentPreviewMutation.isPending}
              editing={preservingCurrentMethod}
              replacementFiles={replacementFiles}
              onReplacementFilesChange={updateReplacementFiles}
            />
          </div>
        )}

        <Radio value="authorization_and_id" className="!my-3 !mr-0 !text-sm !font-semibold !text-slate-800">Giấy ủy quyền và Giấy tờ định danh</Radio>
        {method === 'authorization_and_id' && (
          <div className="mb-4 mt-1 grid gap-5">
            <EmployerBusinessDocumentCard
              label="Giấy ủy quyền"
              files={authorizationFiles}
              onFilesChange={setAuthorizationFiles}
              variant="authorization"
              noticeDocument="Giấy ủy quyền"
              showTemplate
              disabled={documentMutation.isPending}
              savedDocuments={preservingCurrentMethod
                ? savedDocuments.documents.filter((document) => document.doc_type === 'authorization_letter')
                : []}
              submittedFileLabel="Giấy ủy quyền"
              onViewDocument={openDocumentInNewTab}
              viewingDocument={documentPreviewMutation.isPending}
              editing={preservingCurrentMethod}
              replacementFiles={replacementFiles}
              onReplacementFilesChange={updateReplacementFiles}
            />
            <EmployerBusinessDocumentCard
              label="Giấy tờ định danh (CCCD/ Hộ chiếu)"
              files={identityFiles}
              onFilesChange={setIdentityFiles}
              variant="identity"
              disabled={documentMutation.isPending}
              savedDocuments={preservingCurrentMethod
                ? savedDocuments.documents.filter((document) => document.doc_type === 'identity_document')
                : []}
              submittedFileLabel="Giấy tờ định danh"
              onViewDocument={openDocumentInNewTab}
              viewingDocument={documentPreviewMutation.isPending}
              editing={preservingCurrentMethod}
              replacementFiles={replacementFiles}
              onReplacementFilesChange={updateReplacementFiles}
              allowNewFiles={preservingCurrentMethod}
            />
          </div>
        )}
      </Radio.Group>
      }

      {showDocumentForm && <div className="mt-5 flex flex-col gap-2 sm:items-end">
        {editingDocuments && <Button disabled={documentMutation.isPending} onClick={cancelEditing} className="w-full !shadow-none sm:!min-w-[100px] sm:w-auto">Hủy</Button>}
        <Button
          type="primary"
          size="large"
          disabled={!canSave}
          loading={documentMutation.isPending}
          title={saveHint}
          className="w-full !shadow-none sm:!min-w-[100px] sm:w-auto"
          onClick={saveDocuments}
        >
          Lưu
        </Button>
        {!companyLinked && <p className="text-left text-xs leading-5 text-slate-500 sm:text-right">Bạn cần <Link to={`${EMPLOYER_COMPANY_SETTINGS_URL}?update=true`} className="font-medium text-emerald-600 hover:text-emerald-700">cập nhật thông tin công ty</Link> trước khi có thể lưu giấy tờ.</p>}
      </div>
      }
      <Modal
        centered
        destroyOnHidden
        open={submissionConfirmed}
        title="Thông báo"
        okText="Đã hiểu"
        onOk={() => setSubmissionConfirmed(false)}
        onCancel={() => setSubmissionConfirmed(false)}
      >
        <p className="text-sm leading-6 text-slate-600">
          {siteName} đã nhận được bộ giấy tờ xác thực của bạn và sẽ kiểm duyệt trong 24 giờ (trừ thứ bảy, chủ nhật, ngày nghỉ lễ, tết theo quy định).
        </p>
      </Modal>
    </div>
  )
}
