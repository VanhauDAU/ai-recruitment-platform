import { ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Descriptions, Space, Tag, Typography } from 'antd'

const STATUS_META = {
  pending: { color: 'processing', label: 'Đang tra cứu' },
  found: { color: 'green', label: 'Đã tìm thấy' },
  not_found: { color: 'gold', label: 'Không tìm thấy' },
  unavailable: { color: 'orange', label: 'Nguồn không khả dụng' },
  invalid_response: { color: 'red', label: 'Phản hồi không hợp lệ' },
}

const COMPARISON_META = {
  match: { color: 'green', label: 'Khớp' },
  mismatch: { color: 'red', label: 'Khác dữ liệu' },
  unavailable: { color: 'default', label: 'Chưa đối chiếu' },
}

function formatDate(value) {
  if (!value) return 'Chưa hoàn tất'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function ComparisonTag({ value }) {
  const meta = COMPARISON_META[value] || COMPARISON_META.unavailable
  return <Tag color={meta.color}>{meta.label}</Tag>
}

export default function TaxLookupEvidenceCard({
  evidence,
  recruiterCompanyRole,
  canRefresh,
  refreshing,
  onRefresh,
  compact = false,
}) {
  const scopeDescription = recruiterCompanyRole === 'member'
    ? 'Tài khoản này là thành viên của công ty. Kết quả chỉ đối chiếu pháp nhân của công ty trong hồ sơ xác thực quyền đại diện; không có nghĩa người này đã tạo hoặc chỉnh sửa công ty.'
    : 'Kết quả chỉ đối chiếu pháp nhân của công ty trong hồ sơ xác thực quyền đại diện; không phải lịch sử tạo hoặc chỉnh sửa công ty.'
  const extra = canRefresh && (
    <Button
      size="small"
      icon={<ReloadOutlined />}
      loading={refreshing}
      onClick={onRefresh}
    >
      Tra cứu lại
    </Button>
  )

  if (!evidence) {
    return (
      <Card
        size="small"
        title={<Space><SafetyCertificateOutlined />Đối chiếu mã số thuế</Space>}
        extra={extra}
      >
        <Alert
          showIcon
          type="info"
          title="Chưa có dữ liệu đối chiếu VietQR"
          description={`${scopeDescription} Hồ sơ vẫn được xử lý thủ công dựa trên giấy tờ pháp lý.`}
        />
      </Card>
    )
  }

  const status = STATUS_META[evidence.status] || {
    color: 'default',
    label: evidence.status_label || evidence.status,
  }
  const comparison = evidence.comparison || {}
  return (
    <Card
      size="small"
      title={<Space><SafetyCertificateOutlined />Đối chiếu mã số thuế</Space>}
      extra={extra}
      className={compact ? 'company-comparison-tax-lookup' : 'account-detail-card'}
    >
      <Alert
        className="mb-3"
        showIcon
        type="info"
        title="Phạm vi đối chiếu"
        description={`${scopeDescription} Yêu cầu cập nhật thông tin công ty, nếu có, được xử lý ở luồng riêng bên dưới.`}
      />
      <Space wrap className="mb-3">
        <Tag color={status.color}>{status.label}</Tag>
        <Tag>VietQR.io</Tag>
        <Typography.Text type="secondary">
          {`Phiên ${evidence.workflow_revision} · ${formatDate(evidence.completed_at || evidence.created_at)}`}
        </Typography.Text>
      </Space>
      {evidence.provider_description && evidence.status !== 'found' && (
        <Alert
          className="mb-3"
          showIcon
          type={evidence.status === 'invalid_response' ? 'error' : 'warning'}
          title={evidence.provider_description}
          description="Kết quả này chỉ mang tính tham khảo; admin vẫn quyết định dựa trên hồ sơ."
        />
      )}
      <Descriptions bordered size="small" column={{ xs: 1, md: 3 }}>
        <Descriptions.Item label="Thông tin">NTD đã gửi</Descriptions.Item>
        <Descriptions.Item label="VietQR">Dữ liệu đối chiếu</Descriptions.Item>
        <Descriptions.Item label="Kết quả">So khớp</Descriptions.Item>

        <Descriptions.Item label="Mã số thuế">{evidence.tax_code || 'Chưa có'}</Descriptions.Item>
        <Descriptions.Item label="Mã số thuế">{evidence.returned_tax_code || 'Không có dữ liệu'}</Descriptions.Item>
        <Descriptions.Item label="Mã số thuế"><ComparisonTag value={comparison.tax_code} /></Descriptions.Item>

        <Descriptions.Item label="Tên đăng ký">{evidence.submitted_company_name || 'Chưa có'}</Descriptions.Item>
        <Descriptions.Item label="Tên đăng ký">{evidence.registered_name || 'Không có dữ liệu'}</Descriptions.Item>
        <Descriptions.Item label="Tên đăng ký"><ComparisonTag value={comparison.company_name} /></Descriptions.Item>
      </Descriptions>
      {(evidence.international_name || evidence.short_name) && (
        <Typography.Paragraph type="secondary" className="!mb-0 !mt-3">
          {evidence.international_name && `Tên quốc tế: ${evidence.international_name}. `}
          {evidence.short_name && `Tên ngắn: ${evidence.short_name}.`}
        </Typography.Paragraph>
      )}
    </Card>
  )
}
