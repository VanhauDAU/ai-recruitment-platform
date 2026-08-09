import { Alert, Descriptions, Space, Tag } from 'antd'

const TAX_STATUS_LABELS = {
  missing: 'Chưa có bằng chứng tra cứu',
  pending: 'Đang chờ tra cứu',
  matched: 'Khớp nguồn tham chiếu',
  mismatch: 'Không khớp',
  not_found: 'Không tìm thấy',
  unavailable: 'Nguồn tra cứu không khả dụng',
  invalid: 'Bằng chứng không hợp lệ',
}

function companyImpactCopy(impact) {
  if (impact?.company_impact?.will_mark_verified) {
    return 'Công ty sẽ được đánh dấu đã xác thực khi xác nhận.'
  }
  if (impact?.company_impact?.will_downgrade === false) {
    return 'Trạng thái pháp lý của công ty không bị hạ.'
  }
  return 'Không thay đổi trạng thái pháp lý của công ty.'
}

export default function VerificationDecisionImpactSummary({ impact, lifecycle }) {
  const resources = impact.resources || impact.verification_hold_impact || {}
  return (
    <div className="space-y-3" data-testid="verification-impact-summary">
      <Alert
        showIcon
        type="warning"
        title="Kiểm tra tác động trước khi xác nhận"
        description={companyImpactCopy(impact)}
      />
      <Descriptions bordered size="small" column={1}>
        {impact.tax_advisory && (
          <Descriptions.Item label="Đối chiếu mã số thuế">
            <Space wrap>
              <Tag color={impact.tax_advisory.status === 'matched' ? 'green' : 'orange'}>
                {TAX_STATUS_LABELS[impact.tax_advisory.status]
                  || impact.tax_advisory.status}
              </Tag>
              {impact.tax_override && <Tag color="volcano">Sử dụng override</Tag>}
            </Space>
          </Descriptions.Item>
        )}
        <Descriptions.Item label="Quyền sau quyết định">
          {lifecycle
            ? 'Khóa dữ liệu ứng viên và duyệt tin; workspace/tạo/sửa/gửi tin giữ nguyên.'
            : 'Backend sẽ tính lại readiness và quyền sau khi commit.'}
        </Descriptions.Item>
        <Descriptions.Item label="Tài nguyên bị tác động">
          {`${resources.campaign_count || 0} chiến dịch · ${resources.job_count || 0} tin`}
          {Number.isInteger(resources.active_jobs_hidden_from_public)
            && ` · ${resources.active_jobs_hidden_from_public} tin active sẽ bị ẩn`}
          {Number.isInteger(resources.active_jobs_to_unhide)
            && ` · ${resources.active_jobs_to_unhide} tin có thể hiện lại`}
        </Descriptions.Item>
      </Descriptions>
    </div>
  )
}
