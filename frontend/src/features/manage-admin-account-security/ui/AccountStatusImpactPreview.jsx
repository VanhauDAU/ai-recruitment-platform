import { Alert, Descriptions, Space, Tag, Typography } from 'antd'
import { AccountVerificationSummary } from '@/entities/admin-account'
import { effectDescription, operationTitle } from '../model/status-operation'

const STATUS = {
  active: { label: 'Đang hoạt động', color: 'green' },
  inactive: { label: 'Tạm khóa', color: 'orange' },
  banned: { label: 'Đã cấm', color: 'red' },
}

export function StatusTag({ status }) {
  const meta = STATUS[status] || { label: status, color: 'default' }
  return <Tag color={meta.color}>{meta.label}</Tag>
}

function CountRows({ rows = [], emptyLabel = 'Không có dữ liệu bị ảnh hưởng' }) {
  if (!rows.length) return <Typography.Text type="secondary">{emptyLabel}</Typography.Text>
  return (
    <Space wrap size={[6, 6]}>
      {rows.map((row) => (
        <Tag key={`${row.status}-${row.policy_hold || 'none'}`}>
          {row.status}{row.policy_hold ? ` · ${row.policy_hold}` : ''}: {row.count}
        </Tag>
      ))}
    </Space>
  )
}

export default function AccountStatusImpactPreview({ account, operation }) {
  const impact = operation.preview
  const effects = impact.effects || {}
  return (
    <div className="space-y-4">
      {operation.reloaded && (
        <Alert
          showIcon
          type="info"
          title="Tác động vừa được tải lại"
          description="Dữ liệu đã thay đổi sau lần xem trước trước đó. Hãy kiểm tra lại; hệ thống chưa tự thực hiện thao tác."
        />
      )}
      <AccountVerificationSummary account={account} />
      <Alert
        showIcon
        type={operation.status === 'active' ? 'info' : 'warning'}
        title={operationTitle(operation)}
        description={effectDescription(operation, account)}
      />
      <Descriptions bordered size="small" column={1}>
        {operation.kind === 'status' && (
          <>
            <Descriptions.Item label="Trạng thái hiện tại">
              <StatusTag status={account.status} />
            </Descriptions.Item>
            <Descriptions.Item label="Sau thao tác">
              <StatusTag status={operation.status} />
            </Descriptions.Item>
          </>
        )}
        <Descriptions.Item label="Phiên bị thu hồi">
          {impact.active_session_count ?? 0}
        </Descriptions.Item>
        {operation.kind === 'resource-hold' && (
          <>
            <Descriptions.Item label="Chiến dịch gỡ giữ">
              {impact.campaign_count ?? 0}
            </Descriptions.Item>
            <Descriptions.Item label="Tin tuyển dụng gỡ giữ">
              {impact.job_count ?? 0}
            </Descriptions.Item>
          </>
        )}
        {effects.open_application_count !== undefined && (
          <Descriptions.Item label="Hồ sơ đang trong pipeline">
            {effects.open_application_count}
          </Descriptions.Item>
        )}
        {effects.affected_candidate_count !== undefined && (
          <Descriptions.Item label="Ứng viên liên quan">
            {effects.affected_candidate_count}
          </Descriptions.Item>
        )}
        {effects.cv_count !== undefined && (
          <Descriptions.Item label="CV được giữ nguyên">
            {effects.cv_count}
          </Descriptions.Item>
        )}
        {effects.campaigns && (
          <Descriptions.Item label="Chiến dịch">
            <CountRows rows={effects.campaigns} />
          </Descriptions.Item>
        )}
        {effects.jobs && (
          <Descriptions.Item label="Tin tuyển dụng">
            <CountRows rows={effects.jobs} />
          </Descriptions.Item>
        )}
        {effects.applications && (
          <Descriptions.Item label="Hồ sơ ứng tuyển">
            <CountRows rows={effects.applications} />
          </Descriptions.Item>
        )}
      </Descriptions>
      {impact.restoration_policy && (
        <Alert
          showIcon
          type="info"
          title="Quy trình khôi phục"
          description={impact.restoration_policy}
        />
      )}
      {impact.blocked_reasons?.map((reason) => (
        <Alert key={reason} showIcon type="error" title="Chưa thể thực hiện" description={reason} />
      ))}
      <Alert
        showIcon
        type="success"
        title="Cam kết an toàn dữ liệu"
        description="Hệ thống không ghi đè trạng thái nghiệp vụ của tin tuyển dụng, chiến dịch, CV hoặc hồ sơ ứng tuyển."
      />
    </div>
  )
}
