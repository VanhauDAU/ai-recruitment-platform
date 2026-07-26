import { Alert, Badge, Card, Checkbox, Empty, Skeleton, Tag, Typography } from 'antd'
import { MODULE_LABELS } from '@/entities/admin-access'

function groupPermissions(permissions) {
  const groups = new Map()
  permissions.forEach((permission) => {
    if (!permission.is_active && !permission.is_granted_to_role) return
    const group = groups.get(permission.module) || []
    group.push(permission)
    groups.set(permission.module, group)
  })
  return [...groups.entries()]
}

export default function PermissionPicker({
  permissions = [],
  value = [],
  onChange,
  loading = false,
  error = null,
  disabled = false,
}) {
  if (loading) {
    return <Skeleton active paragraph={{ rows: 6 }} aria-label="Đang tải danh sách quyền" />
  }
  if (error) {
    return (
      <Alert
        showIcon
        type="error"
        title="Không thể tải danh sách quyền"
        description="Vui lòng đóng hộp thoại và thử lại."
      />
    )
  }

  const selected = new Set(value)
  const groups = groupPermissions(permissions)
  if (!groups.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có quyền nào trong catalog" />
  }

  const toggle = (code, checked) => {
    const next = new Set(selected)
    if (checked) next.add(code)
    else next.delete(code)
    onChange?.([...next].sort())
  }

  return (
    <div className="grid gap-3 md:grid-cols-2" aria-label="Danh sách quyền theo phân hệ">
      {groups.map(([module, items]) => (
        <Card
          key={module}
          size="small"
          title={MODULE_LABELS[module] || module}
          className="h-full"
        >
          <div className="space-y-3">
            {items.map((permission) => {
              const deprecated = !permission.is_active
              return (
                <label
                  key={permission.code}
                  className="flex min-h-11 items-start gap-3 rounded-lg p-2 transition-colors hover:bg-slate-50"
                >
                  <Checkbox
                    checked={selected.has(permission.code)}
                    disabled={disabled || deprecated}
                    onChange={(event) => toggle(permission.code, event.target.checked)}
                    aria-label={permission.label}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <Typography.Text strong>{permission.label}</Typography.Text>
                      {deprecated && (
                        <Badge
                          count="Đã ngừng sử dụng"
                          color="default"
                          title="Quyền này được giữ để hỗ trợ rollback và không thể cấp mới."
                        />
                      )}
                    </span>
                    <Typography.Paragraph type="secondary" className="!mb-0 !mt-1 text-sm">
                      {permission.description || permission.code}
                    </Typography.Paragraph>
                    <Tag className="!mt-1">{permission.code}</Tag>
                  </span>
                </label>
              )
            })}
          </div>
        </Card>
      ))}
    </div>
  )
}
