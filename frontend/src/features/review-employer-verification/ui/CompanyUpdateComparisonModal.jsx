import { FileSearchOutlined } from '@ant-design/icons'
import { Alert, Button, Descriptions, Image, Modal, Space, Tag, Typography } from 'antd'
import { sanitizeHtml } from '@/shared/lib/sanitize-html'
import {
  FIELD_LABELS,
  HTML_FIELDS,
  MEDIA_FIELDS,
  PENDING_MEDIA_FIELDS,
  PREVIEW_LIST_FIELDS,
  SOCIAL_LABELS,
  VALUE_LABELS,
} from '../model/company-update-fields'
import TaxLookupEvidenceCard from './TaxLookupEvidenceCard'

function formatDate(value) {
  if (!value) return 'Chưa có'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function displayValue(field, value, industryLabels) {
  if (value === null || value === undefined || value === '') return 'Chưa có'
  if (field === 'industries') {
    return (value || []).map((item) => industryLabels[String(item)] || item).join(', ') || 'Chưa có'
  }
  if (field === 'primary_industry') return industryLabels[String(value)] || String(value)
  if (MEDIA_FIELDS.has(field)) return value ? 'Có tệp hình ảnh' : 'Chưa có'
  if (PENDING_MEDIA_FIELDS.has(field)) return value ? 'Có tệp mới chờ xử lý' : 'Không có'
  if (field === 'gallery_additions' || field === 'gallery_deletions') {
    return `${Array.isArray(value) ? value.length : 0} ảnh`
  }
  if (Array.isArray(value)) {
    return value.map((item) => VALUE_LABELS[field]?.[item] || item).join(', ') || 'Chưa có'
  }
  if (typeof value === 'boolean') return value ? 'Có' : 'Không'
  if (value && typeof value === 'object') return JSON.stringify(value)
  return VALUE_LABELS[field]?.[value] || String(value)
}

function MediaPreview({ field, urls }) {
  const label = field === 'gallery_additions' ? 'ảnh mới' : 'ảnh đề xuất'
  return (
    <div className="company-comparison-media">
      <Typography.Text className="company-comparison-media__hint" type="secondary">
        {`${urls.length} ${label} · Nhấn vào ảnh để xem lớn`}
      </Typography.Text>
      <Image.PreviewGroup>
        <div className="company-comparison-gallery">
          {urls.map((url, index) => (
            <Image
              key={`${url}-${index}`}
              src={url}
              alt={`${FIELD_LABELS[field]} ${index + 1}`}
              fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='120'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2364758b' font-size='13'%3EKhông tải được ảnh%3C/text%3E%3C/svg%3E"
            />
          ))}
        </div>
      </Image.PreviewGroup>
    </div>
  )
}

function listItemText(field, item) {
  if (field === 'benefits') return [item.name, item.note].filter(Boolean).join(' — ')
  const place = [item.address, item.province_name].filter(Boolean).join(', ')
  return `${item.label ? `${item.label}: ` : ''}${place}${item.is_headquarters ? ' (trụ sở chính)' : ''}`
}

function ListValue({ field, items }) {
  if (!Array.isArray(items) || items.length === 0) return <span>Chưa có</span>
  return (
    <ul className="company-comparison-list">
      {items.map((item, index) => <li key={index}>{listItemText(field, item)}</li>)}
    </ul>
  )
}

function SocialValue({ value }) {
  const links = Object.entries(value || {}).filter(([, url]) => url)
  if (links.length === 0) return <span>Chưa có</span>
  return (
    <ul className="company-comparison-list">
      {links.map(([network, url]) => <li key={network}>{`${SOCIAL_LABELS[network] || network}: ${url}`}</li>)}
    </ul>
  )
}

function ComparisonValue({ field, value, industryLabels, mediaPreviews, listPreviews, proposed = false }) {
  if (PREVIEW_LIST_FIELDS.has(field)) return <ListValue field={field} items={proposed ? listPreviews[field] : value} />
  if (field === 'social_links') return <SocialValue value={value} />
  const previewValue = mediaPreviews[field]
  const previewUrls = Array.isArray(previewValue) ? previewValue : previewValue ? [previewValue] : []
  if (proposed && previewUrls.length > 0) {
    return <MediaPreview field={field} urls={previewUrls} />
  }
  if (HTML_FIELDS.has(field) && value) {
    return (
      <div
        className="company-comparison-rich-text"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(String(value)) }}
      />
    )
  }
  return <span>{displayValue(field, value, industryLabels)}</span>
}

export default function CompanyUpdateComparisonModal({
  open,
  updateRequest,
  canReview,
  canViewSensitive,
  canApply,
  requestConflict,
  documentLoading,
  requestLoading,
  taxLookupLoading,
  onClose,
  onOpenDocument,
  onReviewDocument,
  onRejectRequest,
  onRequestChanges,
  onApproveRequest,
  onRefreshTaxLookup,
}) {
  if (!updateRequest) return null
  const changes = Object.entries(updateRequest.changes || {})
  const currentDocuments = (updateRequest.documents || []).filter((document) => document.is_current)
  const documentsRequiringAction = currentDocuments.filter(({ status }) => ['changes_requested', 'rejected'].includes(status))
  const industryLabels = updateRequest.industry_labels || {}
  const mediaPreviews = updateRequest.media_previews || {}
  const listPreviews = updateRequest.previews || {}

  return (
    <Modal
      open={open}
      width={1120}
      title="Đối chiếu yêu cầu sửa thông tin công ty"
      className="company-comparison-modal"
      onCancel={onClose}
      destroyOnHidden
      footer={[
        <Button key="close" onClick={onClose}>Đóng</Button>,
        ...(canReview ? [
          <Button key="changes" onClick={onRequestChanges}>Yêu cầu chỉnh sửa</Button>,
          <Button key="reject" danger onClick={onRejectRequest}>Từ chối yêu cầu</Button>,
          <Button
            key="approve"
            type="primary"
            disabled={!canApply || Boolean(requestConflict)}
            title={
              requestConflict
                ? 'Dữ liệu nền đã thay đổi. Vui lòng tải lại trước khi duyệt.'
                : canApply
                  ? undefined
                  : 'Duyệt đủ giấy tờ chứng minh trước khi áp dụng.'
            }
            loading={requestLoading && !requestConflict}
            onClick={onApproveRequest}
          >
            Duyệt và áp dụng
          </Button>,
        ] : []),
      ]}
    >
      <div className="company-comparison-layout">
        {requestConflict && (
          <Alert
            showIcon
            type="error"
            title="Không thể duyệt và áp dụng"
            description={requestConflict}
          />
        )}

        <Descriptions bordered size="small" column={{ xs: 1, md: 3 }}>
          <Descriptions.Item label="Công ty">{updateRequest.company?.name || 'Chưa có'}</Descriptions.Item>
          <Descriptions.Item label="Người gửi">{updateRequest.requested_by_email}</Descriptions.Item>
          <Descriptions.Item label="Cập nhật lúc">{formatDate(updateRequest.updated_at)}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            <Tag color={updateRequest.status === 'in_review' ? 'blue' : 'gold'}>
              {updateRequest.status_label || updateRequest.status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Phiên yêu cầu">{`Lần gửi ${updateRequest.revision}`}</Descriptions.Item>
          <Descriptions.Item label="Số thay đổi">{`${changes.length} mục`}</Descriptions.Item>
        </Descriptions>

        {updateRequest.is_sensitive && (
          <Alert
            showIcon
            type="warning"
            title="Thay đổi thông tin pháp lý cần đối chiếu giấy tờ"
            description={`${updateRequest.reason || 'Không có lý do'} · ${updateRequest.proof_type_label || 'Chưa chọn loại giấy tờ'}`}
          />
        )}

        {updateRequest.is_sensitive && (
          <TaxLookupEvidenceCard
            compact
            evidence={updateRequest.tax_lookup_evidence}
            canRefresh={canReview}
            refreshing={taxLookupLoading}
            onRefresh={onRefreshTaxLookup}
          />
        )}

        <section className="company-comparison-section" aria-labelledby="company-comparison-title">
          <div className="company-comparison-section__heading">
            <div>
              <Typography.Title id="company-comparison-title" level={5}>So sánh thông tin</Typography.Title>
              <Typography.Text type="secondary">Đối chiếu từng trường trước khi áp dụng thay đổi.</Typography.Text>
            </div>
            <Tag color="blue">{`${changes.length} mục thay đổi`}</Tag>
          </div>
          <div className="company-comparison-grid" role="table" aria-label="So sánh thông tin công ty">
            <div className="company-comparison-grid__header" role="row">
              <strong role="columnheader">Thông tin</strong>
              <strong role="columnheader">Hiện tại</strong>
              <strong role="columnheader">Đề xuất mới</strong>
            </div>
            {changes.map(([field, proposedValue]) => (
              <div className="company-comparison-grid__row" role="row" key={field}>
                <strong className="company-comparison-grid__field" role="rowheader">{FIELD_LABELS[field] || field}</strong>
                <div className="company-comparison-grid__value is-current" role="cell">
                  <span className="company-comparison-mobile-label">Hiện tại</span>
                  <ComparisonValue
                    field={field}
                    value={updateRequest.current_values?.[field]}
                    industryLabels={industryLabels}
                    mediaPreviews={mediaPreviews}
                    listPreviews={listPreviews}
                  />
                </div>
                <div className="company-comparison-grid__value is-proposed" role="cell">
                  <span className="company-comparison-mobile-label">Đề xuất mới</span>
                  <ComparisonValue
                    field={field}
                    value={proposedValue}
                    industryLabels={industryLabels}
                    mediaPreviews={mediaPreviews}
                    listPreviews={listPreviews}
                    proposed
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {currentDocuments.length > 0 && (
          <section className="company-comparison-section" aria-labelledby="company-proof-title">
            <Typography.Title id="company-proof-title" level={5}>Giấy tờ chứng minh</Typography.Title>
            {documentsRequiringAction.length > 0 && (
              <Alert
                className="company-comparison-document-alert"
                showIcon
                type="warning"
                title={`${documentsRequiringAction.length} giấy tờ đang chờ nhà tuyển dụng bổ sung`}
                description="Lý do bên dưới được hiển thị trên trang thông tin công ty của nhà tuyển dụng."
              />
            )}
            <div className="company-comparison-documents">
              {currentDocuments.map((document) => (
                <article className="company-comparison-document" key={document.public_id || document.id}>
                  <div className="company-comparison-document__main">
                    <FileSearchOutlined className="company-comparison-document__icon" />
                    <div>
                      <Typography.Text strong>{document.doc_type_label}</Typography.Text>
                      <div className="company-comparison-document-meta">
                        <span>{`${document.file_name} · v${document.version}`}</span>
                        {document.review_note && (
                          <span className="company-comparison-document-note">
                            <strong>Lý do:</strong> {document.review_note}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Space wrap>
                    <Tag color={document.status === 'approved' ? 'green' : document.status === 'rejected' ? 'red' : 'gold'}>{document.status_label}</Tag>
                    <Button type="link" disabled={!canViewSensitive && !document.source_url} onClick={() => onOpenDocument(document)}>Mở</Button>
                    {canReview && (
                      <>
                        <Button type="link" disabled={document.status === 'approved'} loading={documentLoading} onClick={() => onReviewDocument(document, 'approved')}>{document.status === 'approved' ? 'Đã duyệt' : 'Duyệt'}</Button>
                        <Button type="link" disabled={document.status === 'changes_requested'} onClick={() => onReviewDocument(document, 'changes_requested')}>{document.status === 'changes_requested' ? 'Đã yêu cầu bổ sung' : 'Bổ sung'}</Button>
                        <Button type="link" danger disabled={document.status === 'rejected'} onClick={() => onReviewDocument(document, 'rejected')}>{document.status === 'rejected' ? 'Đã từ chối' : 'Từ chối'}</Button>
                      </>
                    )}
                  </Space>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </Modal>
  )
}
