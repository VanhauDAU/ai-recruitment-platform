import {
  DownloadOutlined,
  EyeOutlined,
  FileProtectOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Collapse,
  Empty,
  Form,
  Skeleton,
  Space,
  Tag,
  Timeline,
  Typography,
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { adminCompanyKeys } from '@/entities/company/admin-company'
import {
  adminEmployerVerificationKeys,
  DOCUMENT_REVIEW_REASONS,
  downloadAdminEmployerDocument,
  getAdminEmployerDocumentContent,
  getAdminEmployerVerification,
  refreshAdminEmployerTaxLookup,
  reviewAdminEmployerDocument,
  startAdminEmployerVerificationReview,
  verificationStatusMeta,
} from '@/entities/company/admin-employer-verification'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import ActionDialog from '@/shared/ui/confirm-action/ActionDialog'
import ReasonField from '@/shared/ui/confirm-action/ReasonField'
import {
  documentPreviewKind,
  resolveDocumentMimeType,
} from '../model/document-preview'
import { buildVerificationTimeline } from '../model/event-timeline'
import CompanyUpdateReviewPanel from './CompanyUpdateReviewPanel'
import DocumentImageViewer from './DocumentImageViewer'
import TaxLookupEvidenceCard from './TaxLookupEvidenceCard'
import VerificationDocumentBoard from './VerificationDocumentBoard'
import VerificationFinalDecisionPanel from './VerificationFinalDecisionPanel'
import VerificationJourney from './VerificationJourney'
import './employer-verification-review.css'
import { formatDateTime } from '@/shared/lib/date-time'

const DOCUMENT_DECISION_LABELS = {
  changes_requested: 'Yêu cầu bổ sung',
  rejected: 'Từ chối giấy tờ',
}

const formatDate = (value) => formatDateTime(value, { fallback: 'Chưa có' })

function DocumentPreview({ verificationCase, document }) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: adminEmployerVerificationKeys.document(
      verificationCase.public_id,
      document?.public_id,
    ),
    queryFn: ({ signal }) => getAdminEmployerDocumentContent(
      verificationCase.public_id,
      document.public_id,
      { signal },
    ),
    enabled: Boolean(document),
    staleTime: 60_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const [objectUrl, setObjectUrl] = useState('')
  const [imageError, setImageError] = useState(false)
  const [textContent, setTextContent] = useState('')
  const [textError, setTextError] = useState(false)
  const [textLoading, setTextLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const contentType = resolveDocumentMimeType({
    responseMimeType: query.data?.contentType,
    storedMimeType: document?.mime_type,
    fileName: document?.file_name,
  })
  const previewKind = documentPreviewKind(contentType)

  useEffect(() => {
    if (!query.data?.blob) return undefined
    const url = URL.createObjectURL(query.data.blob)
    setObjectUrl(url)
    return () => {
      URL.revokeObjectURL(url)
      setObjectUrl('')
    }
  }, [query.data])

  useEffect(() => {
    if (!query.data?.blob) return
    queryClient.invalidateQueries({
      queryKey: adminEmployerVerificationKeys.detail(verificationCase.public_id),
      exact: true,
    })
  }, [query.data?.blob, queryClient, verificationCase.public_id])

  useEffect(() => {
    setImageError(false)
  }, [document?.public_id, contentType])

  useEffect(() => {
    let active = true
    setTextContent('')
    setTextError(false)
    setTextLoading(false)
    if (previewKind !== 'text' || !query.data?.blob) return undefined
    setTextLoading(true)
    query.data.blob.text()
      .then((value) => {
        if (active) {
          setTextContent(value.slice(0, 1_000_000))
          setTextLoading(false)
        }
      })
      .catch(() => {
        if (active) {
          setTextError(true)
          setTextLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [previewKind, query.data])

  if (!document) return <Empty description="Chọn giấy tờ để xem" />
  if (query.isLoading) return <Skeleton active paragraph={{ rows: 8 }} />
  if (query.isError) {
    return (
      <Alert
        showIcon
        type="error"
        title="Không thể mở giấy tờ"
        description={getApiErrorMessage(query.error)}
      />
    )
  }
  if (!objectUrl) return <Skeleton active paragraph={{ rows: 8 }} />

  const downloadDocument = async () => {
    setDownloading(true)
    try {
      const result = await downloadAdminEmployerDocument(
        verificationCase.public_id,
        document.public_id,
      )
      const url = URL.createObjectURL(result.blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = document.file_name
      link.click()
      URL.revokeObjectURL(url)
      await queryClient.invalidateQueries({
        queryKey: adminEmployerVerificationKeys.detail(verificationCase.public_id),
        exact: true,
      })
    } catch (error) {
      message.error(getApiErrorMessage(error))
    } finally {
      setDownloading(false)
    }
  }

  const actions = (
    <div className="verification-preview-actions" aria-label="Thao tác với giấy tờ">
      {previewKind !== 'download' && (
        <Button
          icon={<EyeOutlined />}
          href={objectUrl}
          target="_blank"
          rel="noreferrer"
          disabled={!objectUrl}
        >
          Mở bản gốc
        </Button>
      )}
      <Button
        icon={<DownloadOutlined />}
        loading={downloading}
        disabled={!objectUrl || downloading}
        onClick={downloadDocument}
      >
        Tải xuống
      </Button>
    </div>
  )

  if (previewKind === 'image' && !imageError) {
    return (
      <div className="verification-preview-shell">
        {actions}
        <DocumentImageViewer
          src={objectUrl}
          alt={`Bản xem trước ${document.doc_type_label}: ${document.file_name}`}
          contentType={contentType}
          onError={() => setImageError(true)}
        />
      </div>
    )
  }

  if (previewKind === 'pdf') {
    return (
      <div className="verification-preview-shell">
        {actions}
        <iframe
          className="verification-document-frame"
          src={objectUrl}
          title={`Xem trước ${document.file_name}`}
        />
      </div>
    )
  }

  if (previewKind === 'text' && !textError) {
    return (
      <div className="verification-preview-shell">
        {actions}
        {textLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : (
          <pre className="verification-document-text" tabIndex={0}>
            {textContent || 'Tệp không có nội dung văn bản.'}
          </pre>
        )}
      </div>
    )
  }

  if (previewKind === 'download' || imageError || textError) {
    return (
      <Empty
        image={<FileProtectOutlined className="text-4xl text-slate-400" />}
        description={imageError
          ? `Trình duyệt không giải mã được ảnh ${contentType}.`
          : 'Định dạng này cần mở bằng ứng dụng chuyên dụng.'}
      >
        {actions}
      </Empty>
    )
  }

  return null
}

function DocumentReasonDialog({ state, loading, onClose, onSubmit }) {
  const [form] = Form.useForm()
  const decision = state?.decision
  const submit = async () => {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    await onSubmit(values.reason.trim())
    form.resetFields()
  }

  return (
    <ActionDialog
      loading={loading}
      onCancel={() => {
        form.resetFields()
        onClose()
      }}
      onSubmit={submit}
      open={Boolean(state)}
      submitLabel={DOCUMENT_DECISION_LABELS[decision]}
      target={state?.document?.doc_type_label}
      title={decision === 'rejected' ? 'Từ chối giấy tờ' : 'Yêu cầu bổ sung giấy tờ'}
      tone={decision === 'rejected' ? 'danger' : 'default'}
    >
      <Form form={form} layout="vertical" requiredMark={false} initialValues={{ reason: '' }}>
        <ReasonField
          extra="Nhà tuyển dụng sẽ thấy nội dung này để biết cần làm gì tiếp."
          label="Lý do / hướng dẫn"
          maxLength={2000}
          presets={DOCUMENT_REVIEW_REASONS[decision] || []}
        />
      </Form>
    </ActionDialog>
  )
}

export default function EmployerVerificationReview({
  casePublicId,
  companyPublicId,
  companyUpdateRequestPublicId,
  companyUpdateRequesterPublicId,
}) {
  const queryClient = useQueryClient()
  const [selectedDocumentId, setSelectedDocumentId] = useState('')
  const [documentDecision, setDocumentDecision] = useState(null)
  const query = useQuery({
    queryKey: adminEmployerVerificationKeys.detail(casePublicId),
    queryFn: ({ signal }) => getAdminEmployerVerification(casePublicId, { signal }),
    enabled: Boolean(casePublicId),
  })
  const verificationCase = query.data
  const currentDocuments = useMemo(
    () => (verificationCase?.documents || []).filter((item) => item.is_current),
    [verificationCase],
  )
  const timelineEvents = useMemo(
    () => buildVerificationTimeline(
      verificationCase?.events || [],
      verificationCase?.documents || [],
    ),
    [verificationCase],
  )
  const selectedDocument = currentDocuments.find(
    (item) => item.public_id === selectedDocumentId,
  ) || currentDocuments[0]

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: adminEmployerVerificationKeys.detail(casePublicId),
        exact: true,
      }),
      queryClient.invalidateQueries({
        queryKey: adminCompanyKeys.summary,
        exact: true,
      }),
      queryClient.invalidateQueries({
        predicate: ({ queryKey }) => (
          queryKey[0] === adminEmployerVerificationKeys.all[0]
          && queryKey[1] === 'list'
        ),
      }),
    ])
  }
  const startMutation = useMutation({
    mutationFn: () => startAdminEmployerVerificationReview(casePublicId),
    onSuccess: async () => {
      message.success('Đã nhận xử lý hồ sơ.')
      await refresh()
    },
    onError: (error) => message.error(getApiErrorMessage(error)),
  })
  const taxLookupMutation = useMutation({
    mutationFn: () => refreshAdminEmployerTaxLookup(casePublicId),
    onSuccess: async () => {
      message.success('Đã tạo yêu cầu tra cứu lại mã số thuế.')
      await refresh()
    },
    onError: (error) => message.error(getApiErrorMessage(error)),
  })
  const documentMutation = useMutation({
    mutationFn: ({ documentId, payload }) => reviewAdminEmployerDocument(
      casePublicId,
      documentId,
      payload,
    ),
    onSuccess: async (_, { payload }) => {
      message.success(payload.decision === 'approved' ? 'Đã duyệt giấy tờ.' : 'Đã ghi nhận quyết định giấy tờ.')
      await refresh()
    },
  })
  // Approving needs no reason, so it saves straight from the card; asking for
  // changes or rejecting opens the reason dialog.
  const reviewDocument = async (document, decision, reason = '') => {
    try {
      await documentMutation.mutateAsync({
        documentId: document.public_id,
        payload: { decision, reason, lock_version: verificationCase.lock_version },
      })
      return true
    } catch (error) {
      if (error?.response?.status === 409) {
        message.warning('Hồ sơ vừa thay đổi. Dữ liệu đã được tải lại, hãy kiểm tra rồi thao tác lại.')
        await refresh()
      } else {
        message.error(getApiErrorMessage(error))
      }
      return false
    }
  }
  if (!casePublicId) {
    return (
      <div className="verification-review-layout">
        <Empty
          description="Tài khoản này chưa có hồ sơ xác thực"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
        <CompanyUpdateReviewPanel
          companyPublicId={companyPublicId}
          requestPublicId={companyUpdateRequestPublicId}
          requesterPublicId={companyUpdateRequesterPublicId}
        />
      </div>
    )
  }
  if (query.isLoading) return <Skeleton active paragraph={{ rows: 12 }} />
  if (query.isError || !verificationCase) {
    return (
      <Alert
        showIcon
        type="error"
        title="Không thể tải hồ sơ xác thực"
        description={getApiErrorMessage(query.error)}
      />
    )
  }

  const caseMeta = verificationStatusMeta(verificationCase.status)
  const pendingDocumentCount = currentDocuments.filter(
    (document) => document.status === 'pending',
  ).length
  const canReviewDocuments = verificationCase.status === 'in_review'
  return (
    <div className="verification-review-layout">
      <Card size="small" className="account-detail-card verification-overview-card">
        <div className="verification-case-heading">
          <div>
            <Space wrap>
              <Tag color={caseMeta.color}>{caseMeta.label}</Tag>
              {verificationCase.revision > 1 && (
                <Tag>{`Phiên nộp lại ${verificationCase.revision}`}</Tag>
              )}
              {pendingDocumentCount > 0 && (
                <Tag>{`${pendingDocumentCount} giấy tờ chờ duyệt`}</Tag>
              )}
            </Space>
            <Typography.Title level={4} className="!mb-1 !mt-3">
              {verificationCase.company?.name || 'Chưa liên kết công ty'}
            </Typography.Title>
            <Typography.Text type="secondary">
              {`${verificationCase.full_name || 'Chưa cập nhật họ tên'} · ${verificationCase.email}`}
            </Typography.Text>
          </div>
          <Space wrap>
            {verificationCase.status === 'pending' && (
              <Button
                type="primary"
                icon={<EyeOutlined />}
                loading={startMutation.isPending}
                onClick={() => startMutation.mutate()}
              >
                {verificationCase.revision > 1 ? 'Nhận xử lý lại' : 'Nhận xử lý'}
              </Button>
            )}
          </Space>
        </div>
        <dl className="verification-case-facts">
          <div>
            <dt>Nộp gần nhất</dt>
            <dd>{formatDate(verificationCase.submitted_at)}</dd>
          </div>
          <div>
            <dt>Người xử lý</dt>
            <dd>{verificationCase.reviewer_email || 'Chưa phân công'}</dd>
          </div>
          <div>
            <dt>Mã số thuế</dt>
            <dd>{verificationCase.company?.tax_code || 'Chưa cập nhật'}</dd>
          </div>
          <div>
            <dt>Điện thoại</dt>
            <dd>{verificationCase.phone_verified ? 'Đã xác minh' : 'Chưa xác minh'}</dd>
          </div>
        </dl>
        {verificationCase.company?.duplicate_tax_code_company_count > 0 && (
          <Alert
            className="mt-4"
            showIcon
            type="warning"
            title={`MST trùng với ${verificationCase.company.duplicate_tax_code_company_count} hồ sơ công ty khác · kiểm tra NTD đã chọn đúng công ty`}
          />
        )}
        {verificationCase.status === 'pending' && verificationCase.revision > 1 && (
          <Alert
            className="mt-4"
            showIcon
            type="info"
            title="NTD đã thay đủ giấy tờ bị yêu cầu sửa · chọn Nhận xử lý lại để duyệt vòng mới"
          />
        )}
      </Card>

      <CompanyUpdateReviewPanel
        companyPublicId={verificationCase.company?.public_id || companyPublicId}
        requestPublicId={companyUpdateRequestPublicId}
        requesterPublicId={companyUpdateRequesterPublicId}
        onChanged={refresh}
      />

      <section className="verification-review-workspace">
        <div className="verification-review-main">
          <section className="verification-workbench">
            <Card
              size="small"
              title={`1. Xử lý giấy tờ (${currentDocuments.length})`}
              className="account-detail-card verification-document-board-card"
              extra={canReviewDocuments && (
                <Typography.Text type="secondary" className="verification-board-hint">
                  Bấm Duyệt trên giấy tờ đạt, hoặc dùng menu để yêu cầu bổ sung
                </Typography.Text>
              )}
            >
              <VerificationDocumentBoard
                documents={currentDocuments}
                selectedDocumentId={selectedDocument?.public_id}
                canReview={canReviewDocuments}
                savingDocumentId={documentMutation.isPending ? documentMutation.variables?.documentId : ''}
                onSelect={setSelectedDocumentId}
                onDecision={(document, decision) => {
                  if (decision === 'approved') reviewDocument(document, decision)
                  else setDocumentDecision({ document, decision })
                }}
              />
            </Card>
            <Card
              size="small"
              title={selectedDocument ? `Đối chiếu: ${selectedDocument.doc_type_label}` : 'Bản xem trước'}
              className="account-detail-card verification-preview"
              extra={selectedDocument && (
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => queryClient.invalidateQueries({
                    queryKey: adminEmployerVerificationKeys.document(
                      casePublicId,
                      selectedDocument.public_id,
                    ),
                  })}
                >
                  Tải lại
                </Button>
              )}
            >
              <DocumentPreview
                verificationCase={verificationCase}
                document={selectedDocument}
              />
            </Card>
          </section>

          <TaxLookupEvidenceCard
            evidence={verificationCase.tax_lookup_evidence}
            recruiterCompanyRole={verificationCase.recruiter?.company_role}
            canRefresh
            refreshing={taxLookupMutation.isPending}
            onRefresh={() => taxLookupMutation.mutate()}
          />
        </div>

        <aside className="verification-review-rail" aria-label="Điều kiện và quyết định hồ sơ">
          <VerificationFinalDecisionPanel
            verificationCase={verificationCase}
            taxEvidence={verificationCase.tax_lookup_evidence}
            onChanged={refresh}
          />

          <Collapse
            className="verification-secondary-collapse"
            items={[{
              key: 'conditions',
              label: 'Xem điều kiện xác thực',
              children: <VerificationJourney checks={verificationCase.checks} />,
            }]}
          />
        </aside>
      </section>

      <Collapse
        className="verification-secondary-collapse verification-history-collapse"
        destroyOnHidden
        items={[{
          key: 'history',
          label: `Lịch sử xử lý (${timelineEvents.length})`,
          children: (
            <div
              className="verification-timeline-scroll"
              role="region"
              aria-label="Danh sách lịch sử xử lý"
              tabIndex={0}
            >
              <Timeline
                items={timelineEvents.map((event) => ({
                  color: event.event_type === 'rejected' ? 'red' : 'gray',
                  content: (
                    <div>
                      <strong>
                        {event.title}
                        {event.count > 1 && (
                          <span className="verification-timeline-count">
                            {`${event.count} lượt`}
                          </span>
                        )}
                      </strong>
                      {event.documentLabel && (
                        <p className="verification-timeline-document">
                          {event.documentLabel}
                        </p>
                      )}
                      <p className="mb-0 text-xs text-slate-500">
                        {`${formatDate(event.created_at)} · ${event.actor_email || 'Hệ thống'}`}
                      </p>
                    </div>
                  ),
                }))}
              />
            </div>
          ),
        }]}
      />

      <DocumentReasonDialog
        state={documentDecision}
        loading={documentMutation.isPending}
        onClose={() => setDocumentDecision(null)}
        onSubmit={async (reason) => {
          if (await reviewDocument(documentDecision.document, documentDecision.decision, reason)) {
            setDocumentDecision(null)
          }
        }}
      />
    </div>
  )
}
