import { EditOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Modal, Radio, Skeleton, Tag, message } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getEmployerProfile,
  getEmployerCompanyDocuments,
  getEmployerCompanyDocumentContent,
  uploadEmployerBusinessDocument,
  uploadEmployerCompanyDocument,
} from '@/entities/employer-profile'
import { useSiteSettings } from '@/entities/site-settings'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { EMPLOYER_COMPANY_SETTINGS_URL } from '@/shared/config/portals'
import { EmployerBusinessDocumentCard } from './EmployerBusinessDocumentCard'

const UPLOAD_GUIDE_URL = 'https://drive.google.com/file/d/1yYXQMXUjW7_vF3dlpsQd0EBo8WinH9K-/view'

const DOCUMENT_STATUS = {
  pending: { color: 'gold', label: 'Chờ duyệt' },
  approved: { color: 'green', label: 'Đã duyệt' },
  rejected: { color: 'red', label: 'Từ chối' },
}

const COMPANY_DOCUMENTS_QUERY_KEY = ['employer', 'company-documents']

function savedDocumentsFromResponse(response) {
  return (Array.isArray(response) ? response : [response]).filter(Boolean)
}

function replaceCachedDocuments(cachedDocuments, savedDocuments, selectedMethod) {
  const savedIds = new Set(savedDocuments.map((document) => document.id))
  const savedTypes = new Set(selectedMethod
    ? ['business_registration', 'authorization_letter', 'identity_document']
    : savedDocuments.map((document) => document.doc_type))
  const currentDocuments = Array.isArray(cachedDocuments) ? cachedDocuments : []

  return [
    ...savedDocuments,
    ...currentDocuments.filter(
      (document) => document.update_request || (
        !savedIds.has(document.id) && !savedTypes.has(document.doc_type)
      ),
    ),
  ]
}

function currentDocumentSet(documents) {
  const verificationDocuments = documents.filter((document) => !document.update_request)
  const business = verificationDocuments.find((document) => document.doc_type === 'business_registration')
  if (business) return { method: 'business_registration', documents: [business] }

  const authorization = verificationDocuments.find((document) => document.doc_type === 'authorization_letter')
  const identity = verificationDocuments.find((document) => document.doc_type === 'identity_document')
  return authorization && identity
    ? { method: 'authorization_and_id', documents: [authorization, identity] }
    : { method: null, documents: [] }
}

function documentStatus(documents) {
  if (!documents.length) return null
  if (documents.some((document) => document.status === 'pending')) return 'pending'
  if (documents.some((document) => document.status === 'rejected')) return 'rejected'
  return 'approved'
}

export default function EmployerBusinessLicenseForm() {
  const [method, setMethod] = useState('business_registration')
  const [businessFiles, setBusinessFiles] = useState([])
  const [authorizationFiles, setAuthorizationFiles] = useState([])
  const [identityFiles, setIdentityFiles] = useState([])
  const [submissionConfirmed, setSubmissionConfirmed] = useState(false)
  const [editingDocuments, setEditingDocuments] = useState(false)
  const queryClient = useQueryClient()
  const { siteName } = useSiteSettings()
  const profileQuery = useQuery({ queryKey: ['employer', 'profile'], queryFn: getEmployerProfile })
  const documentsQuery = useQuery({
    queryKey: COMPANY_DOCUMENTS_QUERY_KEY,
    queryFn: getEmployerCompanyDocuments,
  })

  async function refreshDashboard() {
    await Promise.all([
      profileQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ['employer-dashboard'] }),
    ])
  }

  const documentMutation = useMutation({
    mutationFn: async ({ selectedMethod, businessFile, authorizationFile, identityFile }) => {
      if (selectedMethod === 'business_registration') {
        return uploadEmployerBusinessDocument(businessFile)
      }
      const authorizationDocument = await uploadEmployerCompanyDocument(
        'authorization_letter',
        authorizationFile,
      )
      const identityDocument = await uploadEmployerCompanyDocument(
        'identity_document',
        identityFile,
        { verificationMethod: 'authorization_and_id' },
      )
      return [authorizationDocument, identityDocument]
    },
    onSuccess: async (response, { selectedMethod }) => {
      const savedDocuments = savedDocumentsFromResponse(response)
      queryClient.setQueryData(COMPANY_DOCUMENTS_QUERY_KEY, (cachedDocuments) => (
        replaceCachedDocuments(cachedDocuments, savedDocuments, selectedMethod)
      ))
      setBusinessFiles([])
      setAuthorizationFiles([])
      setIdentityFiles([])
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
  const rejectedDocument = savedDocuments.documents.find(
    (document) => document.status === 'rejected' && document.review_note,
  )
  const showDocumentForm = !savedStatus || editingDocuments
  const businessFile = businessFiles[0]?.originFileObj || businessFiles[0]
  const authorizationFile = authorizationFiles[0]?.originFileObj || authorizationFiles[0]
  const identityFile = identityFiles[0]?.originFileObj || identityFiles[0]
  const hasRequiredFiles = method === 'business_registration'
    ? Boolean(businessFile)
    : Boolean(authorizationFile && identityFile)
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
    setEditingDocuments(true)
  }

  function cancelEditing() {
    setBusinessFiles([])
    setAuthorizationFiles([])
    setIdentityFiles([])
    setEditingDocuments(false)
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
              savedDocument={savedDocuments.documents.find((document) => document.doc_type === 'authorization_letter')}
              submittedFileLabel="Giấy ủy quyền"
              onViewDocument={openDocumentInNewTab}
              viewingDocument={documentPreviewMutation.isPending}
            />
            <EmployerBusinessDocumentCard
              label="Giấy tờ định danh (CCCD/ Hộ chiếu)"
              variant="identity"
              savedDocument={savedDocuments.documents.find((document) => document.doc_type === 'identity_document')}
              submittedFileLabel="Giấy tờ định danh"
              onViewDocument={openDocumentInNewTab}
              viewingDocument={documentPreviewMutation.isPending}
            />
          </div>
        )}

        {savedStatus === 'rejected' && (
          <Alert
            className="mt-4"
            type="error"
            showIcon
            message="Giấy tờ bị từ chối"
            description={rejectedDocument?.review_note || 'Quản trị viên chưa cung cấp lý do.'}
          />
        )}
      </Radio.Group>
      }

      {showDocumentForm && <Radio.Group value={method} onChange={(event) => setMethod(event.target.value)} className="!mt-6 !grid !gap-0">
        <Radio value="business_registration" className="!my-3 !mr-0 !text-sm !font-semibold !text-slate-800">Giấy đăng ký doanh nghiệp hoặc Giấy tờ tương đương khác</Radio>
        {method === 'business_registration' && <div className="mb-4"><EmployerBusinessDocumentCard label="Giấy đăng ký doanh nghiệp hoặc Giấy tờ tương đương khác" files={businessFiles} onFilesChange={setBusinessFiles} variant="business" noticeDocument="Giấy đăng ký doanh nghiệp" disabled={documentMutation.isPending} /></div>}

        <Radio value="authorization_and_id" className="!my-3 !mr-0 !text-sm !font-semibold !text-slate-800">Giấy ủy quyền và Giấy tờ định danh</Radio>
        {method === 'authorization_and_id' && (
          <div className="mb-4 mt-1 grid gap-5">
            <EmployerBusinessDocumentCard label="Giấy ủy quyền" files={authorizationFiles} onFilesChange={setAuthorizationFiles} variant="authorization" noticeDocument="Giấy ủy quyền" showTemplate disabled={documentMutation.isPending} />
            <EmployerBusinessDocumentCard label="Giấy tờ định danh (CCCD/ Hộ chiếu)" files={identityFiles} onFilesChange={setIdentityFiles} variant="identity" disabled={documentMutation.isPending} />
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
          onClick={() => documentMutation.mutate({
            selectedMethod: method,
            businessFile,
            authorizationFile,
            identityFile,
          })}
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
          {siteName} đã nhận được Giấy đăng ký doanh nghiệp của bạn và sẽ kiểm duyệt trong 24 giờ (trừ thứ bảy, chủ nhật, ngày nghỉ lễ, tết theo quy định).
        </p>
      </Modal>
    </div>
  )
}
