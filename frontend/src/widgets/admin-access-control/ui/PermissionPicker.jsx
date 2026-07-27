import { SearchOutlined } from '@ant-design/icons'
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Empty,
  Input,
  Skeleton,
  Space,
  Tag,
  Typography,
} from 'antd'
import { useState } from 'react'
import { MODULE_LABELS } from '@/entities/admin-access'

const PERMISSION_DEPENDENCIES = {
  'blog.manage': ['blog.view'],
  'blog.publish': ['blog.view'],
  'company_update.review': ['company_update.view'],
  'consultation_lead.manage': ['consultation_lead.view'],
  'employer_verification.review': ['employer_verification.view'],
  'job_moderation.approve': ['job_moderation.view'],
  'job_moderation.reject': ['job_moderation.view'],
  'service_catalog.manage': ['service_catalog.view'],
  'site_setting.manage': ['site_setting.view'],
}

function availablePermissions(permissions) {
  return permissions.filter((permission) => (
    permission.is_active || permission.is_granted_to_role
  ))
}

function groupPermissions(permissions, search) {
  const normalizedSearch = search.trim().toLocaleLowerCase('vi-VN')
  const groups = new Map()
  availablePermissions(permissions).forEach((permission) => {
    const moduleLabel = MODULE_LABELS[permission.module] || permission.module
    const searchable = [
      permission.label,
      permission.code,
      permission.description,
      moduleLabel,
    ].filter(Boolean).join(' ').toLocaleLowerCase('vi-VN')
    if (normalizedSearch && !searchable.includes(normalizedSearch)) return
    const group = groups.get(permission.module) || []
    group.push(permission)
    groups.set(permission.module, group)
  })
  return [...groups.entries()].sort(([left], [right]) => (
    (MODULE_LABELS[left] || left).localeCompare(MODULE_LABELS[right] || right, 'vi')
  ))
}

function addDependencies(selection, code, permissionByCode) {
  const pending = [code]
  while (pending.length) {
    const current = pending.pop()
    if (selection.has(current)) continue
    selection.add(current)
    const dependencies = PERMISSION_DEPENDENCIES[current] || []
    dependencies.forEach((requiredCode) => {
      if (permissionByCode.get(requiredCode)?.is_active) pending.push(requiredCode)
    })
  }
}

function removeDependents(selection, removedCodes) {
  let changed = true
  while (changed) {
    changed = false
    Object.entries(PERMISSION_DEPENDENCIES).forEach(([code, requirements]) => {
      if (
        selection.has(code)
        && requirements.some((requiredCode) => removedCodes.has(requiredCode))
      ) {
        selection.delete(code)
        removedCodes.add(code)
        changed = true
      }
    })
  }
}

export default function PermissionPicker({
  permissions = [],
  value = [],
  onChange,
  loading = false,
  error = null,
  disabled = false,
}) {
  const [search, setSearch] = useState('')

  if (loading) {
    return <Skeleton active paragraph={{ rows: 8 }} aria-label="Đang tải danh sách quyền" />
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

  const available = availablePermissions(permissions)
  if (!available.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có quyền nào trong catalog" />
  }

  const selected = new Set(value)
  const permissionByCode = new Map(permissions.map((permission) => [permission.code, permission]))
  const groups = groupPermissions(permissions, search)
  const visibleActive = groups.flatMap(([, items]) => items.filter((item) => item.is_active))
  const activeCount = permissions.filter((permission) => permission.is_active).length
  const selectedActiveCount = permissions.filter((permission) => (
    permission.is_active && selected.has(permission.code)
  )).length
  const hasCompanyUpdatePermissions = permissions.some((permission) => (
    permission.code === 'company_update.review'
  ))

  const commit = (codes, checked) => {
    const next = new Set(selected)
    if (checked) {
      codes.forEach((code) => addDependencies(next, code, permissionByCode))
    } else {
      const removedCodes = new Set(codes)
      codes.forEach((code) => next.delete(code))
      removeDependents(next, removedCodes)
    }
    onChange?.([...next].sort())
  }

  return (
    <div className="space-y-4" aria-label="Danh sách quyền theo phân hệ">
      {hasCompanyUpdatePermissions && (
        <Alert
          showIcon
          type="info"
          title="Quyền duyệt sửa công ty đã được tách riêng"
          description="Cấp “Xem yêu cầu sửa công ty” để xem hàng chờ. Khi chọn “Duyệt sửa thông tin công ty”, hệ thống tự chọn kèm quyền xem."
        />
      )}

      <div className="sticky top-0 z-10 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Input
            allowClear
            size="large"
            prefix={<SearchOutlined />}
            placeholder="Tìm theo tên, mã hoặc phân hệ"
            aria-label="Tìm quyền"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="flex shrink-0 items-center justify-between gap-3 md:justify-end">
            <Typography.Text strong>{`${selectedActiveCount}/${activeCount} quyền đã chọn`}</Typography.Text>
            <Space size={4}>
              <Button
                size="small"
                disabled={disabled || !visibleActive.length}
                onClick={() => commit(visibleActive.map((item) => item.code), true)}
              >
                Chọn tất cả
              </Button>
              <Button
                size="small"
                disabled={disabled || !visibleActive.some((item) => selected.has(item.code))}
                onClick={() => commit(visibleActive.map((item) => item.code), false)}
              >
                Bỏ chọn
              </Button>
            </Space>
          </div>
        </div>
        {search && (
          <Typography.Text type="secondary" className="!mt-2 !block !text-xs">
            {`${visibleActive.length} quyền phù hợp với “${search}”`}
          </Typography.Text>
        )}
      </div>

      {!groups.length ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không tìm thấy quyền phù hợp" />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {groups.map(([module, items]) => {
            const moduleLabel = MODULE_LABELS[module] || module
            const activeItems = items.filter((item) => item.is_active)
            const selectedCount = activeItems.filter((item) => selected.has(item.code)).length
            return (
              <Card
                key={module}
                size="small"
                className="h-full border-slate-200"
                title={(
                  <Checkbox
                    checked={Boolean(activeItems.length && selectedCount === activeItems.length)}
                    indeterminate={selectedCount > 0 && selectedCount < activeItems.length}
                    disabled={disabled || !activeItems.length}
                    aria-label={`Chọn toàn bộ ${moduleLabel}`}
                    onChange={(event) => commit(
                      activeItems.map((item) => item.code),
                      event.target.checked,
                    )}
                  >
                    <span className="font-semibold text-slate-800">{moduleLabel}</span>
                  </Checkbox>
                )}
                extra={<Tag color={selectedCount ? 'blue' : 'default'}>{`${selectedCount}/${activeItems.length}`}</Tag>}
              >
                <div className="space-y-2">
                  {items.map((permission) => {
                    const deprecated = !permission.is_active
                    const checked = selected.has(permission.code)
                    const inputId = `permission-${permission.code.replaceAll('.', '-')}`
                    return (
                      <div
                        key={permission.code}
                        className={`flex min-h-11 items-start gap-3 rounded-lg border p-3 transition-colors ${checked ? 'border-blue-200 bg-blue-50/70' : 'border-transparent hover:bg-slate-50'}`}
                      >
                        <Checkbox
                          id={inputId}
                          checked={checked}
                          disabled={disabled || deprecated}
                          onChange={(event) => commit([permission.code], event.target.checked)}
                          aria-label={permission.label}
                        />
                        <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
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
                          <Typography.Text code className="!mt-2 !inline-block !text-xs">
                            {permission.code}
                          </Typography.Text>
                        </label>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
