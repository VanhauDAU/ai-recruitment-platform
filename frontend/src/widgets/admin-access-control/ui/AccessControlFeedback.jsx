import { Alert, Button, Card, Descriptions, Tag, Typography } from 'antd'

export function ManagementBadge({ managed }) {
  return (
    <Tag color={managed ? 'blue' : 'gold'}>
      {managed ? 'Do hệ thống quản lý' : 'Đã tuỳ chỉnh'}
    </Tag>
  )
}

export function StatusBadge({ active }) {
  return (
    <Tag color={active ? 'green' : 'default'}>
      {active ? 'Đang hoạt động' : 'Đã khoá'}
    </Tag>
  )
}

export function QueryError({ message: errorMessage, onRetry }) {
  return (
    <Alert
      showIcon
      type="error"
      title={errorMessage}
      description={(
        <Button className="mt-3 min-h-11" onClick={onRetry}>
          Tải lại
        </Button>
      )}
    />
  )
}

function PermissionTags({ title, codes = [], color }) {
  if (!codes.length) return null
  return (
    <div>
      <Typography.Text strong>{title}</Typography.Text>
      <div className="mt-2 flex flex-wrap gap-2">
        {codes.map((code) => <Tag color={color} key={code}>{code}</Tag>)}
      </div>
    </div>
  )
}

export function ImpactDetails({ preview, stale }) {
  if (!preview) return null
  const affected = preview.affected_users_preview || []
  const metadata = Object.entries(preview.metadata_changes || {})
  return (
    <div className="space-y-4" aria-live="polite">
      {stale && (
        <Alert
          showIcon
          type="warning"
          title="Dữ liệu đã thay đổi"
          description="Số liệu tác động vừa được tải lại. Vui lòng xem lại trước khi xác nhận."
        />
      )}
      {preview.blocking_reason && (
        <Alert showIcon type="error" title="Không thể áp dụng" description={preview.blocking_reason} />
      )}
      {preview.mfa_warning && (
        <Alert
          showIcon
          type="warning"
          title="Tài khoản chưa bật MFA"
          description="Nhân viên sẽ chưa thể đăng nhập cổng quản trị cho đến khi hoàn tất MFA."
        />
      )}

      <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
        {preview.active_membership_count !== undefined && (
          <Descriptions.Item label="Nhân viên có chức danh">
            {preview.active_membership_count.toLocaleString('vi-VN')}
          </Descriptions.Item>
        )}
        {preview.effective_users_changed_count !== undefined && (
          <Descriptions.Item label="Người đổi quyền hiệu dụng">
            {preview.effective_users_changed_count.toLocaleString('vi-VN')}
          </Descriptions.Item>
        )}
        {preview.replaced_membership && (
          <Descriptions.Item label="Chức danh hiện tại">
            {preview.replaced_membership.role.name} · {preview.replaced_membership.department.name}
          </Descriptions.Item>
        )}
      </Descriptions>

      {preview.will_leave_system_management && (
        <Alert
          showIcon
          type="warning"
          title="Chức danh sẽ chuyển sang trạng thái “Đã tuỳ chỉnh”"
          description="Các lần chạy seed sau sẽ không ghi đè cấu hình quyền này."
        />
      )}
      {preview.will_enter_system_management && (
        <Alert
          showIcon
          type="info"
          title="Bản ghi sẽ trở lại cấu hình mặc định hệ thống"
        />
      )}

      {metadata.length > 0 && (
        <Card size="small" title="Thay đổi thông tin">
          <div className="divide-y divide-slate-100">
            {metadata.map(([field, change]) => (
              <div className="flex items-center justify-between gap-4 py-2" key={field}>
                <Typography.Text code>{field}</Typography.Text>
                <Typography.Text>
                  {String(change.before || '—')} → {String(change.after || '—')}
                </Typography.Text>
              </div>
            ))}
          </div>
        </Card>
      )}

      <PermissionTags title="Quyền được thêm" codes={preview.permissions_added || preview.permissions_gained} color="green" />
      <PermissionTags title="Quyền bị mất" codes={preview.permissions_removed || preview.permissions_lost} color="red" />
      <PermissionTags title="Quyền đã có sẵn" codes={preview.permissions_already_available} />

      {preview.affected_user_count !== undefined && (
        <Card
          size="small"
          title={`${preview.affected_user_count.toLocaleString('vi-VN')} nhân viên bị ảnh hưởng`}
        >
          {affected.length ? (
            <div className="divide-y divide-slate-100">
              {affected.map((affectedUser) => (
                <div
                  className="flex items-center justify-between gap-3 py-2"
                  key={affectedUser.public_id}
                >
                  <div>
                    <Typography.Text strong>
                      {affectedUser.full_name || affectedUser.email}
                    </Typography.Text>
                    {affectedUser.full_name && (
                      <div><Typography.Text type="secondary">{affectedUser.email}</Typography.Text></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Typography.Text type="secondary">Không có người đổi quyền hiệu dụng.</Typography.Text>
          )}
          {preview.has_more && (
            <Typography.Paragraph type="secondary" className="!mb-0 !mt-3">
              Đang hiển thị {preview.preview_limit} tài khoản đầu tiên.
            </Typography.Paragraph>
          )}
        </Card>
      )}
    </div>
  )
}
