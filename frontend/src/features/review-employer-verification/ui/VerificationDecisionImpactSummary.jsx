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

export default function VerificationDecisionImpactSummary({ impact, lifecycle }) {
  const resources = impact.resources || impact.verification_hold_impact || {}
  const rejection = impact.rejection_impact
  return (
    <div className="space-y-3" data-testid="verification-impact-summary">
      <Alert
        showIcon
        type="warning"
        title="Kiểm tra tác động trước khi xác nhận"
        description="Quyết định chỉ áp dụng cho nhà tuyển dụng đang được duyệt; hồ sơ Công ty không thay đổi."
      />
      <Descriptions bordered size="small" column={1}>
        {impact.tax_advisory && (
          <Descriptions.Item label="Đối chiếu mã số thuế">
            <Space wrap>
              <Tag color={impact.tax_advisory.status === 'matched' ? 'green' : 'orange'}>
                {TAX_STATUS_LABELS[impact.tax_advisory.status]
                  || impact.tax_advisory.status}
              </Tag>
              {impact.tax_override && <Tag color="orange">Duyệt thủ công</Tag>}
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
        {rejection && impact.decision === 'rejected' && (
          <Descriptions.Item label="Lượt từ chối cuối">
            <Space wrap>
              <Tag color={rejection.will_lock_resubmission ? 'red' : 'orange'}>
                {`${rejection.next_count}/${rejection.limit}`}
              </Tag>
              <span>
                {rejection.will_lock_resubmission
                  ? 'Xác nhận sẽ khóa nộp lại; tài khoản vẫn xem lý do và gửi khiếu nại.'
                  : 'Chỉ quyết định cuối Từ chối mới tăng bộ đếm.'}
              </span>
            </Space>
          </Descriptions.Item>
        )}
      </Descriptions>
    </div>
  )
}
