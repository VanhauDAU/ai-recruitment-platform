import { BankOutlined, CheckCircleFilled, EditOutlined, LinkOutlined, SafetyCertificateOutlined, UploadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Avatar, Button, Image, Skeleton, Tag } from 'antd'
import { useState } from 'react'
import {
  employerProfileKeys,
  getEmployerCompanyUpdateRequests,
} from '@/entities/employer-profile'
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
  in_review: ['processing', 'Đang thẩm định'],
  changes_requested: ['warning', 'Cần chỉnh sửa'],
  approved: ['success', 'Đã duyệt'],
  rejected: ['error', 'Bị từ chối'],
  withdrawn: ['default', 'Đã rút'],
  cancelled: ['default', 'Đã hủy'],
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
  const mineQuery = useQuery({
    queryKey: employerProfileKeys.companyUpdateRequestList('mine'),
    queryFn: () => getEmployerCompanyUpdateRequests({ scope: 'mine' }),
    enabled: canRequestUpdate,
  })
  const mineRequests = mineQuery.data || []
  const latestRequest = mineRequests[0]
  const pendingRequest = mineRequests.find((item) => item.status === 'pending')
  const documentsRequiringAction = (pendingRequest?.documents || []).filter((document) => (
    document.is_current && ['changes_requested', 'rejected'].includes(document.status)
  ))
  const hasDocumentAction = documentsRequiringAction.length > 0
  const [defaultRequestStatusColor, defaultRequestStatusText] = UPDATE_REQUEST_STATUS[latestRequest?.status] || []
  const requestStatusColor = hasDocumentAction ? 'warning' : defaultRequestStatusColor
  const requestStatusText = hasDocumentAction ? 'Cần bổ sung giấy tờ' : defaultRequestStatusText
  const requestQueryHasError = mineQuery.isError
  const requestQueryFetching = mineQuery.isFetching
  const writeLocked = requestQueryHasError
    || !mineQuery.isSuccess
    || requestQueryFetching

  const retryRequestQuery = () => mineQuery.refetch()

  const requestError = requestQueryHasError && (
    <Alert
      type="error"
      showIcon
      title="Không tải được dữ liệu yêu cầu chỉnh sửa"
      description="Thao tác tạo hoặc chỉnh sửa tạm khóa để tránh ghi đè dữ liệu chưa được đồng bộ."
      action={<Button loading={requestQueryFetching} onClick={retryRequestQuery}>Thử lại</Button>}
    />
  )

  if (editing) {
    return (
      <div className="linked-company-panel">
        {requestError}
        <CompanyForm
          company={company}
          pendingRequest={pendingRequest}
          catalogs={catalogs}
          industries={industries}
          canManageMedia={owner}
          disabled={writeLocked}
          onCompleted={async () => { setEditing(false); await onRefresh() }}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  const [statusColor, statusText] = VERIFICATION_STATUS[company.verification_status] || VERIFICATION_STATUS.unverified
  const latestSubmittedAt = formatDateTime(latestRequest?.submitted_at)

  return (
    <div className="linked-company-panel">
      {requestError}

      <section className="company-update-request" aria-label="Yêu cầu của tôi" aria-busy={mineQuery.isLoading || undefined}>
        {mineQuery.isLoading ? (
          <Skeleton className="company-update-request__skeleton" active paragraph={{ rows: 1 }} />
        ) : (
          <>
            <div>
              <h2>Yêu cầu của tôi</h2>
              {mineQuery.isError && <p>Không thể xác định trạng thái yêu cầu hiện tại.</p>}
              {!mineQuery.isError && latestSubmittedAt && <p>Ngày gửi gần nhất: {latestSubmittedAt}</p>}
            </div>
            {!mineQuery.isError && canRequestUpdate && (
              <div className="company-update-request__actions">
                {requestStatusText && <Tag color={requestStatusColor}>{requestStatusText}</Tag>}
                <Button
                  type="link"
                  disabled={writeLocked}
                  aria-label={hasDocumentAction ? 'Bổ sung giấy tờ' : undefined}
                  icon={hasDocumentAction ? <UploadOutlined /> : <EditOutlined />}
                  onClick={() => setEditing(true)}
                >
                  {hasDocumentAction ? 'Bổ sung giấy tờ' : pendingRequest ? 'Chỉnh sửa yêu cầu' : 'Tạo yêu cầu'}
                </Button>
              </div>
            )}
          </>
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
              <Button type="primary" disabled={writeLocked} aria-label="Bổ sung giấy tờ ngay" icon={<UploadOutlined />} onClick={() => setEditing(true)}>
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
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}
