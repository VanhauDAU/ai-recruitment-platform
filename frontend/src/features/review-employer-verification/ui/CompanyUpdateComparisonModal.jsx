import { FileSearchOutlined } from '@ant-design/icons'
import { Alert, Button, Descriptions, Image, List, Modal, Space, Tag, Typography } from 'antd'
import { sanitizeHtml } from '@/shared/lib/sanitize-html'
import TaxLookupEvidenceCard from './TaxLookupEvidenceCard'

const FIELD_LABELS = {
  business_type: 'Loại hình',
  tax_code: 'Mã số thuế',
  company_name: 'Tên đăng ký',
  trade_name: 'Tên thương mại',
  trade_name_same_as_registered: 'Tên thương mại trùng tên đăng ký',
  website_url: 'Website',
  has_no_website: 'Không có website',
  email: 'Email',
  phone: 'Số điện thoại',
  address: 'Địa chỉ',
  company_size: 'Quy mô',
  description: 'Mô tả',
  employee_benefits: 'Phúc lợi',
  markets: 'Thị trường',
  target_customers: 'Khách hàng mục tiêu',
  industries: 'Lĩnh vực',
  primary_industry: 'Lĩnh vực chính',
  founded_year: 'Năm thành lập',
  logo_url: 'Logo công ty',
  logo_pending: 'Logo công ty',
  cover_image_url: 'Ảnh bìa công ty',
  cover_pending: 'Ảnh bìa công ty',
  gallery_additions: 'Ảnh thư viện thêm mới',
  gallery_deletions: 'Ảnh thư viện xóa',
  gallery_pending: 'Ảnh thư viện',
}

const VALUE_LABELS = {
  business_type: { enterprise: 'Doanh nghiệp', household: 'Hộ kinh doanh' },
  company_size: {
    '1-9': '1 - 9 nhân viên',
    '10-24': '10 - 24 nhân viên',
    '25-99': '25 - 99 nhân viên',
    '100-499': '100 - 499 nhân viên',
    '500-1000': '500 - 1000 nhân viên',
    '1000+': '1000+ nhân viên',
    '3000+': '3000+ nhân viên',
    '5000+': '5000+ nhân viên',
    '10000+': '10000+ nhân viên',
  },
  markets: {
    domestic: 'Nội địa', asia: 'Châu Á', europe: 'Châu Âu', africa: 'Châu Phi',
    america: 'Châu Mỹ', australia: 'Châu Úc',
  },
  target_customers: { b2b: 'B2B', b2c: 'B2C', b2g: 'B2G' },
}

const HTML_FIELDS = new Set(['description', 'employee_benefits'])
const MEDIA_FIELDS = new Set(['logo_url', 'cover_image_url'])
const PENDING_MEDIA_FIELDS = new Set(['logo_pending', 'cover_pending', 'gallery_pending'])

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

function ComparisonValue({ field, value, industryLabels, mediaPreviews, proposed = false }) {
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
  documentLoading,
  requestLoading,
  taxLookupLoading,
  onClose,
  onOpenDocument,
  onReviewDocument,
  onRejectRequest,
  onApproveRequest,
  onRefreshTaxLookup,
}) {
  if (!updateRequest) return null
  const changes = Object.entries(updateRequest.changes || {})
  const currentDocuments = (updateRequest.documents || []).filter((document) => document.is_current)
  const documentsRequiringAction = currentDocuments.filter((document) => (
    document.status === 'changes_requested' || document.status === 'rejected'
  ))
  const industryLabels = updateRequest.industry_labels || {}
  const mediaPreviews = updateRequest.media_previews || {}

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
          <Button key="reject" danger onClick={onRejectRequest}>Từ chối yêu cầu</Button>,
          <Button
            key="approve"
            type="primary"
            disabled={!canApply}
            title={canApply ? undefined : 'Duyệt đủ giấy tờ chứng minh trước khi áp dụng.'}
            loading={requestLoading}
            onClick={onApproveRequest}
          >
            Duyệt và áp dụng
          </Button>,
        ] : []),
      ]}
    >
      <div className="company-comparison-layout">
        <Descriptions bordered size="small" column={{ xs: 1, md: 3 }}>
          <Descriptions.Item label="Công ty">{updateRequest.company?.name || 'Chưa có'}</Descriptions.Item>
          <Descriptions.Item label="Người gửi">{updateRequest.requested_by_email}</Descriptions.Item>
          <Descriptions.Item label="Cập nhật lúc">{formatDate(updateRequest.updated_at)}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái"><Tag color="gold">Chờ duyệt</Tag></Descriptions.Item>
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
                  />
                </div>
                <div className="company-comparison-grid__value is-proposed" role="cell">
                  <span className="company-comparison-mobile-label">Đề xuất mới</span>
                  <ComparisonValue
                    field={field}
                    value={proposedValue}
                    industryLabels={industryLabels}
                    mediaPreviews={mediaPreviews}
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
            <List
              className="company-comparison-documents"
              dataSource={currentDocuments}
              renderItem={(document) => (
                <List.Item
                  actions={[
                    <Button key="open" type="link" disabled={!canViewSensitive && !document.source_url} onClick={() => onOpenDocument(document)}>Mở</Button>,
                    ...(canReview ? [
                      <Button key="approve" type="link" disabled={document.status === 'approved'} loading={documentLoading} onClick={() => onReviewDocument(document, 'approved')}>{document.status === 'approved' ? 'Đã duyệt' : 'Duyệt'}</Button>,
                      <Button key="changes" type="link" disabled={document.status === 'changes_requested'} onClick={() => onReviewDocument(document, 'changes_requested')}>{document.status === 'changes_requested' ? 'Đã yêu cầu bổ sung' : 'Bổ sung'}</Button>,
                      <Button key="reject" type="link" danger disabled={document.status === 'rejected'} onClick={() => onReviewDocument(document, 'rejected')}>{document.status === 'rejected' ? 'Đã từ chối' : 'Từ chối'}</Button>,
                    ] : []),
                  ]}
                >
                  <List.Item.Meta
                    avatar={<FileSearchOutlined />}
                    title={document.doc_type_label}
                    description={(
                      <div className="company-comparison-document-meta">
                        <span>{`${document.file_name} · v${document.version}`}</span>
                        {document.review_note && (
                          <span className="company-comparison-document-note">
                            <strong>Lý do:</strong> {document.review_note}
                          </span>
                        )}
                      </div>
                    )}
                  />
                  <Space><Tag color={document.status === 'approved' ? 'green' : document.status === 'rejected' ? 'red' : 'gold'}>{document.status_label}</Tag></Space>
                </List.Item>
              )}
            />
          </section>
        )}
      </div>
    </Modal>
  )
}
