import { EyeOutlined, SwapOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Form, Input, Modal, Skeleton, Space, Tag, Typography } from 'antd'
import { useEffect, useState } from 'react'
import {
  adminEmployerVerificationKeys,
  getAdminCompanyUpdateDocumentContent,
  getAdminCompanyUpdateRequests,
  refreshAdminCompanyUpdateTaxLookup,
  reviewAdminCompanyUpdateDocument,
  reviewAdminCompanyUpdateRequest,
} from '@/entities/admin-employer-verification'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import CompanyUpdateComparisonModal from './CompanyUpdateComparisonModal'

function ReviewReasonModal({ state, loading, onCancel, onSubmit }) {
  const [form] = Form.useForm()
  return (
    <Modal
      open={Boolean(state)}
      title={state?.title}
      confirmLoading={loading}
      onCancel={onCancel}
      onOk={async () => {
        const values = await form.validateFields()
        await onSubmit(values.reason || '')
        form.resetFields()
      }}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="reason"
          label="Lý do"
          rules={[{ required: true, whitespace: true, message: 'Nhập lý do để nhà tuyển dụng biết cách xử lý.' }]}
        >
          <Input.TextArea rows={4} maxLength={2000} showCount />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default function CompanyUpdateReviewPanel({
  companyPublicId,
  canReview,
  canViewSensitive,
  onChanged,
}) {
  const queryClient = useQueryClient()
  const [reasonState, setReasonState] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [requestConflict, setRequestConflict] = useState('')
  const params = { company: companyPublicId, status: 'pending' }
  const query = useQuery({
    queryKey: adminEmployerVerificationKeys.companyUpdates(params),
    queryFn: ({ signal }) => getAdminCompanyUpdateRequests(params, { signal }),
    enabled: Boolean(companyPublicId),
  })
  const updateRequest = query.data?.results?.[0]

  useEffect(() => {
    setRequestConflict('')
  }, [updateRequest?.public_id, updateRequest?.lock_version])

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: adminEmployerVerificationKeys.companyUpdates(params),
      exact: true,
    })
    await onChanged?.()
  }
  const documentMutation = useMutation({
    mutationFn: ({ document, decision, reason = '' }) => reviewAdminCompanyUpdateDocument(
      updateRequest.public_id,
      document.public_id,
      {
        decision,
        reason,
        lock_version: updateRequest.lock_version,
      },
    ),
    onSuccess: async (_, variables) => {
      message.success(
        variables.decision === 'changes_requested'
          ? 'Đã yêu cầu nhà tuyển dụng bổ sung giấy tờ. Lý do đã được hiển thị cho họ.'
          : variables.decision === 'rejected'
            ? 'Đã từ chối giấy tờ và lưu lý do.'
            : 'Đã duyệt giấy tờ.',
      )
      setReasonState(null)
      await refresh()
    },
    onError: (error) => message.error(getApiErrorMessage(error)),
  })
  const requestMutation = useMutation({
    mutationFn: ({ decision, note = '' }) => reviewAdminCompanyUpdateRequest(
      updateRequest.public_id,
      {
        decision,
        note,
        lock_version: updateRequest.lock_version,
      },
    ),
    onSuccess: async (_, variables) => {
      setRequestConflict('')
      message.success(variables.decision === 'approved' ? 'Đã áp dụng thay đổi công ty.' : 'Đã từ chối yêu cầu cập nhật.')
      setReasonState(null)
      setDetailsOpen(false)
      await refresh()
    },
    onError: (error) => {
      const errorMessage = getApiErrorMessage(error)
      if (
        error.response?.status === 409
        && error.response?.data?.code === 'company_tax_code_conflict'
      ) {
        setRequestConflict(errorMessage)
      }
      message.error(errorMessage)
    },
  })
  const taxLookupMutation = useMutation({
    mutationFn: () => refreshAdminCompanyUpdateTaxLookup(updateRequest.public_id),
    onSuccess: async () => {
      message.success('Đã tạo yêu cầu tra cứu lại mã số thuế.')
      await refresh()
    },
    onError: (error) => message.error(getApiErrorMessage(error)),
  })

  async function openDocument(document) {
    if (document.source_url) {
      window.open(document.source_url, '_blank', 'noopener,noreferrer')
      return
    }
    try {
      const blob = await getAdminCompanyUpdateDocumentContent(
        updateRequest.public_id,
        document.public_id,
      )
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể mở giấy tờ.'))
    }
  }

  if (!companyPublicId) return null
  if (query.isLoading) return <Card size="small" title="Yêu cầu sửa thông tin công ty"><Skeleton active /></Card>
  if (query.isError) {
    return <Alert showIcon type="error" title="Không tải được yêu cầu sửa công ty" description={getApiErrorMessage(query.error)} />
  }
  if (!updateRequest) return null

  const currentDocuments = (updateRequest.documents || []).filter((document) => document.is_current)
  const approvedDocumentTypes = new Set(
    currentDocuments
      .filter((document) => document.status === 'approved')
      .map((document) => document.doc_type),
  )
  const canApply = !updateRequest.is_sensitive || (
    updateRequest.proof_type === 'business_registration'
      ? approvedDocumentTypes.has('business_registration')
      : approvedDocumentTypes.has('authorization_letter')
        && approvedDocumentTypes.has('identity_document')
  )

  const reviewDocument = (document, decision) => {
    if (decision === 'approved') {
      documentMutation.mutate({ document, decision })
      return
    }
    const action = decision === 'rejected' ? 'Từ chối' : 'Yêu cầu bổ sung'
    setReasonState({
      kind: 'document',
      document,
      decision,
      title: `${action} ${document.doc_type_label}`,
    })
  }

  return (
    <>
      <Card size="small" className="account-detail-card company-update-review-card">
        <div className="company-update-review-summary">
          <span className="company-update-review-summary__icon" aria-hidden="true"><SwapOutlined /></span>
          <div className="company-update-review-summary__content">
            <Typography.Title level={5}>Yêu cầu sửa thông tin công ty</Typography.Title>
            <Typography.Text type="secondary">
              {`${Object.keys(updateRequest.changes || {}).length} mục thay đổi · gửi bởi ${updateRequest.requested_by_email}`}
            </Typography.Text>
            <Space wrap size={[6, 6]} className="mt-2">
              <Tag color="gold">Chờ duyệt</Tag>
              <Tag>{`Lần gửi ${updateRequest.revision}`}</Tag>
              {updateRequest.is_sensitive && <Tag color="orange">Có thay đổi pháp lý</Tag>}
            </Space>
          </div>
          <Button icon={<EyeOutlined />} onClick={() => setDetailsOpen(true)}>
            Xem chi tiết và đối chiếu
          </Button>
        </div>
      </Card>
      <CompanyUpdateComparisonModal
        open={detailsOpen}
        updateRequest={updateRequest}
        canReview={canReview}
        canViewSensitive={canViewSensitive}
        canApply={canApply}
        requestConflict={requestConflict}
        documentLoading={documentMutation.isPending}
        requestLoading={requestMutation.isPending}
        taxLookupLoading={taxLookupMutation.isPending}
        onClose={() => setDetailsOpen(false)}
        onOpenDocument={openDocument}
        onReviewDocument={reviewDocument}
        onRejectRequest={() => setReasonState({ kind: 'request', decision: 'rejected', title: 'Từ chối yêu cầu sửa công ty' })}
        onApproveRequest={() => requestMutation.mutate({ decision: 'approved' })}
        onRefreshTaxLookup={() => taxLookupMutation.mutate()}
      />
      <ReviewReasonModal
        state={reasonState}
        loading={documentMutation.isPending || requestMutation.isPending}
        onCancel={() => setReasonState(null)}
        onSubmit={(reason) => (
          reasonState.kind === 'document'
            ? documentMutation.mutateAsync({
                document: reasonState.document,
                decision: reasonState.decision,
                reason,
              })
            : requestMutation.mutateAsync({
                decision: reasonState.decision,
                note: reason,
              })
        )}
      />
    </>
  )
}
