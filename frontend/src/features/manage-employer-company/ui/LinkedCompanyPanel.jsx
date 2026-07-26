import { BankOutlined, CheckCircleFilled, EditOutlined, LinkOutlined, SafetyCertificateOutlined, UploadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Avatar, Button, Image, Skeleton, Tag } from 'antd'
import { useState } from 'react'
import { getEmployerCompanyUpdateRequests } from '@/entities/employer-profile'
import { sanitizeHtml } from '@/shared/lib/sanitize-html'
import CompanyForm from './CompanyForm'

const VERIFICATION_STATUS = {
  verified: ['success', 'Đã xác thực'],
  pending: ['processing', 'Đang xác thực'],
  rejected: ['error', 'Bị từ chối'],
  unverified: ['default', 'Chưa xác thực'],
}

const UPDATE_REQUEST_STATUS = {
  pending: ['processing', 'Đang xử lý'],
  approved: ['success', 'Đã duyệt'],
  rejected: ['error', 'Bị từ chối'],
}

const DOCUMENT_LABELS = {
  business_registration: 'Giấy đăng ký doanh nghiệp',
  trade_name_proof: 'Chứng minh tên thương mại',
  authorization_letter: 'Giấy ủy quyền',
  identity_document: 'Giấy tờ định danh (CCCD/hộ chiếu)',
}

export default function LinkedCompanyPanel({ profile, catalogs, industries, onRefresh }) {
  const [editing, setEditing] = useState(false)
  const company = profile.company
  const owner = profile.company_role === 'owner'
  const canRequestUpdate = Boolean(company)
  const requestsQuery = useQuery({
    queryKey: ['employer', 'company', 'update-requests'],
    queryFn: getEmployerCompanyUpdateRequests,
    enabled: canRequestUpdate,
  })
  const requests = requestsQuery.data || []
  const latestRequest = requests[0]
  const pendingRequest = requests.find((item) => item.status === 'pending')
  const documentsRequiringAction = (pendingRequest?.documents || []).filter((document) => (
    document.is_current && ['changes_requested', 'rejected'].includes(document.status)
  ))
  const hasDocumentAction = documentsRequiringAction.length > 0
  const [defaultRequestStatusColor, defaultRequestStatusText] = UPDATE_REQUEST_STATUS[latestRequest?.status] || []
  const requestStatusColor = hasDocumentAction ? 'warning' : defaultRequestStatusColor
  const requestStatusText = hasDocumentAction ? 'Cần bổ sung giấy tờ' : defaultRequestStatusText

  if (editing) return <CompanyForm company={company} pendingRequest={pendingRequest} catalogs={catalogs} industries={industries} canManageMedia={owner} onCompleted={async () => { setEditing(false); await onRefresh() }} onCancel={() => setEditing(false)} />
  if (canRequestUpdate && requestsQuery.isLoading) return <Skeleton active paragraph={{ rows: 8 }} />
  const [statusColor, statusText] = VERIFICATION_STATUS[company.verification_status] || VERIFICATION_STATUS.unverified

  return (
    <div className="linked-company-panel">
      <section className="company-update-request" aria-label="Yêu cầu cập nhật thông tin công ty">
        <div>
          <h2>Yêu cầu cập nhật thông tin công ty</h2>
          <p>Ngày gửi gần nhất: {latestRequest ? formatDateTime(latestRequest.updated_at || latestRequest.created_at) : '--:-- --/--/--'}</p>
        </div>
        {canRequestUpdate && (
          <div className="company-update-request__actions">
            {requestStatusText && <Tag color={requestStatusColor}>{requestStatusText}</Tag>}
            <Button
              type="link"
              aria-label={hasDocumentAction ? 'Bổ sung giấy tờ' : undefined}
              icon={hasDocumentAction ? <UploadOutlined /> : <EditOutlined />}
              onClick={() => setEditing(true)}
            >
              {hasDocumentAction ? 'Bổ sung giấy tờ' : pendingRequest ? 'Chỉnh sửa yêu cầu' : 'Tạo yêu cầu'}
            </Button>
          </div>
        )}
      </section>

      {hasDocumentAction && (
        <Alert
          className="company-update-document-request"
          type="warning"
          showIcon
          title="Quản trị viên yêu cầu bổ sung giấy tờ"
          description={(
            <div className="company-update-document-request__content">
              <ul>
                {documentsRequiringAction.map((document) => (
                  <li key={document.public_id || document.id}>
                    <strong>{document.doc_type_label || DOCUMENT_LABELS[document.doc_type] || document.doc_type}</strong>
                    <span>{document.review_note || 'Vui lòng tải lên bản giấy tờ mới rõ ràng và đầy đủ hơn.'}</span>
                  </li>
                ))}
              </ul>
              <Button type="primary" aria-label="Bổ sung giấy tờ ngay" icon={<UploadOutlined />} onClick={() => setEditing(true)}>
                Bổ sung giấy tờ ngay
              </Button>
            </div>
          )}
        />
      )}

      <section className="linked-company-card">
        <header className="linked-company-card__header">
          <Avatar shape="square" size={60} src={company.logo_url || undefined} icon={<BankOutlined />} className="linked-company-card__logo" />
          <div className="min-w-0">
            <div className="linked-company-card__name"><h2>{company.company_name}</h2><Tag color={statusColor} icon={company.verification_status === 'verified' ? <CheckCircleFilled /> : <SafetyCertificateOutlined />}>{statusText}</Tag></div>
            <p>{company.address || 'Địa chỉ chưa cập nhật'} <span aria-hidden="true">|</span> {company.company_size ? `${company.company_size} nhân viên` : 'Quy mô chưa cập nhật'}</p>
            <p className="linked-company-card__fixed-note">Liên kết này là cố định; tài khoản không thể chuyển sang công ty khác.</p>
          </div>
        </header>

        <dl className="linked-company-details">
          <Detail label="Mã số thuế" value={company.tax_code} />
          <Detail label="Website" value={company.has_no_website ? 'Không có website' : company.website_url} link={!company.has_no_website} />
          <Detail label="Lĩnh vực hoạt động" value={(company.industries_detail || []).map((item) => item.name).join(', ')} />
          <Detail label="Lĩnh vực chính" value={(company.industries_detail || []).find((item) => item.is_primary)?.name} />
          <Detail label="Thị trường hoạt động" value={formatValue(company.markets)} />
          <Detail label="Khách hàng mục tiêu" value={formatValue(company.target_customers)} />
          <Detail label="Quy mô" value={company.company_size ? `${company.company_size} nhân viên` : ''} />
          <Detail label="Email" value={company.email} />
          <Detail label="Số điện thoại" value={company.phone} />
          <Detail label="Địa chỉ" value={company.address} />
          <Detail label="Mô tả công ty" html={company.description} />
          <Detail label="Phúc lợi nhân viên" html={company.employee_benefits} />
          <Detail label="Hình ảnh công ty" value={company.images?.length ? null : ''}>
            {company.images?.length > 0 && <div className="linked-company-gallery">{company.images.map((item) => <Image key={item.id} src={item.image_url} alt="Ảnh công ty" />)}</div>}
          </Detail>
        </dl>
      </section>
    </div>
  )
}

function Detail({ label, value, link = false, html, children }) {
  const content = children || (html
    ? <div className="company-rich-output" dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />
    : link && value ? <a href={value} target="_blank" rel="noreferrer" className="company-setting-link"><LinkOutlined /> {value}</a>
      : value || '--')
  return <div className="linked-company-details__row"><dt>{label}:</dt><dd>{content}</dd></div>
}

function formatValue(value) {
  if (Array.isArray(value)) return value.length ? value.join(', ') : '--'
  return value || '--'
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
}
