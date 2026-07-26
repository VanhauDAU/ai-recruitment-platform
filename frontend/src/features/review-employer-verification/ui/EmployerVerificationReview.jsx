import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileProtectOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Skeleton,
  Space,
  Tag,
  Timeline,
  Typography,
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import {
  adminEmployerVerificationKeys,
  decideAdminEmployerVerification,
  documentStatusMeta,
  getAdminEmployerDecisionImpact,
  getAdminEmployerDocumentContent,
  getAdminEmployerVerification,
  reviewAdminEmployerDocument,
  startAdminEmployerVerificationReview,
  verificationStatusMeta,
  VERIFICATION_CHECK_LABELS,
} from '@/entities/admin-employer-verification'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import './employer-verification-review.css'

const DECISIONS = [
  { value: 'approved', label: 'Duyệt', tone: 'primary' },
  { value: 'changes_requested', label: 'Yêu cầu bổ sung', tone: 'default' },
  { value: 'rejected', label: 'Từ chối', tone: 'danger' },
]

function formatDate(value) {
  if (!value) return 'Chưa có'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function StatusTag({ status, document = false }) {
  const meta = document ? documentStatusMeta(status) : verificationStatusMeta(status)
  return <Tag color={meta.color}>{meta.label}</Tag>
}

function Checklist({ checks = {} }) {
  return (
    <ol className="verification-checklist" aria-label="Tiến độ xác thực">
      {Object.entries(VERIFICATION_CHECK_LABELS).map(([key, label], index) => {
        const complete = Boolean(checks[key])
        return (
          <li key={key} className={complete ? 'is-complete' : 'is-pending'}>
            <span aria-hidden="true">
              {complete ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
            </span>
            <div>
              <strong>{`${index + 1}. ${label}`}</strong>
              <small>{complete ? 'Đã hoàn tất' : 'Chưa hoàn tất'}</small>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function DocumentPreview({ verificationCase, document, canViewSensitive }) {
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
    enabled: Boolean(document && canViewSensitive),
    staleTime: 0,
    gcTime: 0,
  })
  const [objectUrl, setObjectUrl] = useState('')

  useEffect(() => {
    if (!query.data?.blob) return undefined
    const url = URL.createObjectURL(query.data.blob)
    setObjectUrl(url)
    return () => {
      URL.revokeObjectURL(url)
      setObjectUrl('')
    }
  }, [query.data])

  if (!document) return <Empty description="Chọn giấy tờ để xem" />
  if (!canViewSensitive) {
    return (
      <Alert
        showIcon
        type="warning"
        title="Nội dung giấy tờ đang được bảo vệ"
        description="Cần quyền xem dữ liệu nhạy cảm để preview hoặc tải file."
      />
    )
  }
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

  const previewable = ['application/pdf', 'image/jpeg', 'image/png'].includes(
    document.mime_type,
  )
  if (!previewable) {
    return (
      <Empty
        image={<FileProtectOutlined className="text-4xl text-slate-400" />}
        description="Định dạng này không hỗ trợ preview trực tiếp"
      >
        <Button
          icon={<DownloadOutlined />}
          href={objectUrl}
          download={document.file_name}
          disabled={!objectUrl}
        >
          Tải file bảo mật
        </Button>
      </Empty>
    )
  }
  return (
    <iframe
      className="verification-document-frame"
      src={objectUrl}
      title={`Xem trước ${document.file_name}`}
    />
  )
}

function DecisionModal({ open, title, lockVersion, overall, onClose, onSubmit, loading }) {
  const [form] = Form.useForm()
  const [impact, setImpact] = useState(null)
  const selectedDecision = Form.useWatch('decision', form)

  const reset = () => {
    form.resetFields()
    setImpact(null)
    onClose()
  }

  const submit = async () => {
    const values = await form.validateFields()
    const payload = { ...values, lock_version: lockVersion }
    if (overall && !impact) {
      setImpact(await onSubmit(payload, { preview: true }))
      return
    }
    await onSubmit(
      overall ? { ...values, impact_token: impact.impact_token } : payload,
      { preview: false },
    )
    reset()
  }

  return (
    <Modal
      open={open}
      title={title}
      okText={overall && !impact ? 'Xem tác động' : 'Xác nhận'}
      cancelText="Hủy"
      confirmLoading={loading}
      okButtonProps={{ danger: selectedDecision === 'rejected' }}
      onCancel={reset}
      onOk={submit}
      destroyOnHidden
    >
      {impact ? (
        <div className="space-y-4">
          <Alert
            showIcon
            type={impact.unlocks_employer_capabilities ? 'success' : 'warning'}
            title={impact.unlocks_employer_capabilities
              ? 'Các quyền NTD sẽ được mở'
              : 'Hồ sơ sẽ chưa được mở quyền'}
            description="Quyết định sử dụng phiên bản hồ sơ hiện tại. Nếu dữ liệu thay đổi, hệ thống sẽ yêu cầu tải lại."
          />
          <Checklist checks={impact.checks} />
        </div>
      ) : (
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={{ decision: 'approved', reason: '' }}
          scrollToFirstError={{ focus: true }}
        >
          <Form.Item name="decision" label="Kết quả xử lý" rules={[{ required: true }]}>
            <div className="verification-decision-options">
              {DECISIONS.map((item) => (
                <Button
                  key={item.value}
                  type={selectedDecision === item.value ? 'primary' : 'default'}
                  danger={item.tone === 'danger'}
                  onClick={() => form.setFieldValue('decision', item.value)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </Form.Item>
          <Form.Item
            name="reason"
            label="Lý do / hướng dẫn bổ sung"
            dependencies={['decision']}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (getFieldValue('decision') === 'approved' || value?.trim()) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('Nhập lý do để NTD biết bước tiếp theo.'))
                },
              }),
              { max: 2000, message: 'Tối đa 2.000 ký tự.' },
            ]}
          >
            <Input.TextArea rows={4} maxLength={2000} showCount />
          </Form.Item>
        </Form>
      )}
    </Modal>
  )
}

export default function EmployerVerificationReview({
  casePublicId,
  canReview,
  canViewSensitive,
}) {
  const queryClient = useQueryClient()
  const [selectedDocumentId, setSelectedDocumentId] = useState('')
  const [documentDecision, setDocumentDecision] = useState(null)
  const [caseDecisionOpen, setCaseDecisionOpen] = useState(false)
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
  const selectedDocument = currentDocuments.find(
    (item) => item.public_id === selectedDocumentId,
  ) || currentDocuments[0]

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: adminEmployerVerificationKeys.all,
    })
  }
  const startMutation = useMutation({
    mutationFn: () => startAdminEmployerVerificationReview(casePublicId),
    onSuccess: async () => {
      message.success('Đã nhận xử lý hồ sơ.')
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
    onSuccess: async () => {
      message.success('Đã ghi nhận quyết định giấy tờ.')
      await refresh()
    },
  })
  const caseMutation = useMutation({
    mutationFn: (payload) => decideAdminEmployerVerification(casePublicId, payload),
    onSuccess: async () => {
      message.success('Đã cập nhật kết quả xác thực tài khoản.')
      await refresh()
    },
  })

  if (!casePublicId) {
    return (
      <Empty
        description="Tài khoản này chưa có hồ sơ xác thực"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
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
  return (
    <div className="space-y-5">
      <Card className="account-detail-card">
        <div className="verification-case-heading">
          <div>
            <Space wrap>
              <Tag color={caseMeta.color}>{caseMeta.label}</Tag>
              <Typography.Text code>{verificationCase.public_id}</Typography.Text>
            </Space>
            <Typography.Title level={4} className="!mb-1 !mt-3">
              {verificationCase.company?.name || 'Chưa liên kết công ty'}
            </Typography.Title>
            <Typography.Text type="secondary">
              {`${verificationCase.full_name || 'Chưa cập nhật họ tên'} · ${verificationCase.email}`}
            </Typography.Text>
          </div>
          {canReview && (
            <Space wrap>
              {verificationCase.status === 'pending' && (
                <Button
                  icon={<EyeOutlined />}
                  loading={startMutation.isPending}
                  onClick={() => startMutation.mutate()}
                >
                  Nhận xử lý
                </Button>
              )}
              <Button
                type="primary"
                icon={<FileProtectOutlined />}
                onClick={() => setCaseDecisionOpen(true)}
              >
                Quyết định hồ sơ
              </Button>
            </Space>
          )}
        </div>
        <Descriptions className="mt-5" bordered size="small" column={{ xs: 1, md: 2 }}>
          <Descriptions.Item label="Phương thức">
            {verificationCase.verification_method_label || 'Chưa chọn'}
          </Descriptions.Item>
          <Descriptions.Item label="Phiên hồ sơ">
            {verificationCase.revision}
          </Descriptions.Item>
          <Descriptions.Item label="Nộp gần nhất">
            {formatDate(verificationCase.submitted_at)}
          </Descriptions.Item>
          <Descriptions.Item label="Người xử lý">
            {verificationCase.reviewer_email || 'Chưa phân công'}
          </Descriptions.Item>
          <Descriptions.Item label="Mã số thuế">
            {verificationCase.company?.tax_code || 'Chưa cập nhật'}
          </Descriptions.Item>
          <Descriptions.Item label="Điện thoại">
            {verificationCase.phone_verified ? 'Đã xác minh' : 'Chưa xác minh'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="10 bước xác thực" className="account-detail-card">
        <Checklist checks={verificationCase.checks} />
      </Card>

      <section className="verification-workbench">
        <Card title="Bộ giấy tờ" className="account-detail-card verification-document-list">
          <List
            dataSource={currentDocuments}
            locale={{ emptyText: 'Chưa có giấy tờ hiện hành' }}
            renderItem={(document) => {
              const active = selectedDocument?.public_id === document.public_id
              return (
                <List.Item
                  className={active ? 'is-selected' : ''}
                  onClick={() => setSelectedDocumentId(document.public_id)}
                  actions={canReview ? [
                    <Button
                      key="review"
                      type="link"
                      onClick={(event) => {
                        event.stopPropagation()
                        setDocumentDecision(document)
                      }}
                    >
                      Xử lý
                    </Button>,
                  ] : []}
                >
                  <List.Item.Meta
                    title={(
                      <Space wrap>
                        <span>{document.doc_type_label}</span>
                        <StatusTag status={document.status} document />
                      </Space>
                    )}
                    description={(
                      <span>
                        {`${document.file_name} · v${document.version} · ${formatDate(document.created_at)}`}
                        {document.duplicate_company_count > 0 && (
                          <Tag className="ml-2" color="red" icon={<WarningOutlined />}>
                            Trùng hash công ty khác
                          </Tag>
                        )}
                      </span>
                    )}
                  />
                </List.Item>
              )
            }}
          />
        </Card>
        <Card
          title={selectedDocument ? `Đối chiếu: ${selectedDocument.doc_type_label}` : 'Preview'}
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
            canViewSensitive={canViewSensitive}
          />
        </Card>
      </section>

      <Card title="Lịch sử xử lý" className="account-detail-card">
        <Timeline
          items={(verificationCase.events || []).map((event) => ({
            color: event.event_type === 'rejected' ? 'red' : 'blue',
            children: (
              <div>
                <strong>{event.event_type_label}</strong>
                <p className="mb-0 text-xs text-slate-500">
                  {`${formatDate(event.created_at)} · ${event.actor_email || 'Hệ thống'}`}
                </p>
              </div>
            ),
          }))}
        />
      </Card>

      <DecisionModal
        open={Boolean(documentDecision)}
        title={`Xử lý ${documentDecision?.doc_type_label || 'giấy tờ'}`}
        lockVersion={verificationCase.lock_version}
        loading={documentMutation.isPending}
        onClose={() => setDocumentDecision(null)}
        onSubmit={async (payload) => {
          try {
            await documentMutation.mutateAsync({
              documentId: documentDecision.public_id,
              payload,
            })
          } catch (error) {
            if (error?.response?.status === 409) {
              message.warning('Hồ sơ đã thay đổi. Vui lòng tải lại trước khi xử lý.')
              await refresh()
            } else {
              message.error(getApiErrorMessage(error))
            }
            throw error
          }
        }}
      />
      <DecisionModal
        overall
        open={caseDecisionOpen}
        title="Quyết định toàn bộ hồ sơ"
        lockVersion={verificationCase.lock_version}
        loading={caseMutation.isPending}
        onClose={() => setCaseDecisionOpen(false)}
        onSubmit={async (payload, { preview }) => {
          try {
            if (preview) return await getAdminEmployerDecisionImpact(casePublicId, payload)
            await caseMutation.mutateAsync(payload)
            return null
          } catch (error) {
            if (error?.response?.status === 409) {
              message.warning('Hồ sơ đã thay đổi. Vui lòng tải lại và xem lại tác động.')
              await refresh()
            } else {
              message.error(getApiErrorMessage(error))
            }
            throw error
          }
        }}
      />
    </div>
  )
}
