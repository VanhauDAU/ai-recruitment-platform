import { BankOutlined, CheckCircleFilled, EditOutlined, LinkOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
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

const FIELD_LABELS = {
  business_type: 'Loại hình', tax_code: 'Mã số thuế', company_name: 'Tên đăng ký',
  trade_name: 'Tên thương mại', website_url: 'Website', email: 'Email', phone: 'Số điện thoại',
  address: 'Địa chỉ', company_size: 'Quy mô', description: 'Mô tả', employee_benefits: 'Phúc lợi',
  markets: 'Thị trường', target_customers: 'Khách hàng mục tiêu', industries: 'Lĩnh vực',
  primary_industry: 'Lĩnh vực chính',
}

export default function LinkedCompanyPanel({ profile, catalogs, industries, onRefresh }) {
  const [editing, setEditing] = useState(false)
  const company = profile.company
  const owner = profile.company_role === 'owner' && profile.membership_status === 'approved'
  // Các liên kết cũ có thể còn trạng thái pending từ trước khi workflow duyệt
  // bị bỏ. Chỉ cần đã có company là tài khoản được tạo yêu cầu cập nhật.
  const canRequestUpdate = Boolean(company)
  const requestsQuery = useQuery({
    queryKey: ['employer', 'company', 'update-requests'],
    queryFn: getEmployerCompanyUpdateRequests,
    enabled: canRequestUpdate,
  })
  const requests = requestsQuery.data || []
  const latestRequest = requests[0]
  const pendingRequest = requests.find((item) => item.status === 'pending')
  const rejectedRequest = requests.find((item) => item.status === 'rejected')

  if (editing) return <CompanyForm company={company} catalogs={catalogs} industries={industries} canManageMedia={owner} onCompleted={async () => { setEditing(false); await onRefresh() }} onCancel={() => setEditing(false)} />
  if (canRequestUpdate && requestsQuery.isLoading) return <Skeleton active paragraph={{ rows: 8 }} />
  const [statusColor, statusText] = VERIFICATION_STATUS[company.verification_status] || VERIFICATION_STATUS.unverified

  return (
    <div className="linked-company-panel">
      {pendingRequest && <Alert className="linked-company-panel__alert" type="warning" showIcon title="Yêu cầu cập nhật đang được xử lý" description={<div className="linked-company-panel__request-tags">{Object.entries(pendingRequest.changes || {}).map(([field, value]) => <Tag key={field}>{FIELD_LABELS[field] || field}: {formatValue(value)}</Tag>)}</div>} />}
      {rejectedRequest && <Alert className="linked-company-panel__alert" type="error" showIcon title="Yêu cầu cập nhật gần nhất bị từ chối" description={rejectedRequest.review_note || 'Quản trị viên chưa cung cấp lý do.'} />}

      <section className="company-update-request" aria-label="Yêu cầu cập nhật thông tin công ty">
        <div>
          <h2>Yêu cầu cập nhật thông tin công ty</h2>
          <p>Ngày yêu cầu gần nhất: {latestRequest ? formatDateTime(latestRequest.created_at) : '--:-- --/--/--'}</p>
        </div>
        {canRequestUpdate && <Button type="link" icon={<EditOutlined />} disabled={Boolean(pendingRequest)} onClick={() => setEditing(true)}>{pendingRequest ? 'Đang xử lý' : 'Tạo yêu cầu'}</Button>}
      </section>

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
