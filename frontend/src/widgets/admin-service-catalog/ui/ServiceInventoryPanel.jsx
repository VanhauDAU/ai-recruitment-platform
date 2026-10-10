import { GiftOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Empty, Form, Input, InputNumber, Modal, Select, Space, Table, Tabs, Tag } from 'antd'
import { getAdminCompanies } from '@/entities/admin-company'
import {
  getAdminPackageVersions,
  getAdminServiceAudit,
  getAdminServiceEntitlements,
  grantAdminServiceEntitlements,
  revokeAdminServiceEntitlement,
} from '@/entities/service-package'
import useDebouncedValue from '@/shared/hooks/use-debounced-value'
import { message } from '@/shared/lib/toast'

const STATUS_META = {
  available: { color: 'green', label: 'Chưa sử dụng' },
  consumed: { color: 'blue', label: 'Đã sử dụng' },
  expired: { color: 'default', label: 'Hết hạn' },
  revoked: { color: 'red', label: 'Đã thu hồi' },
}

const EVENT_LABELS = {
  package_published: 'Phát hành phiên bản',
  unit_granted: 'Cấp lượt',
  unit_revoked: 'Thu hồi lượt',
  unit_expired: 'Lượt hết hạn',
  unit_consumed: 'Sử dụng lượt',
  activation_created: 'Kích hoạt dịch vụ',
  activation_expired: 'Dịch vụ kết thúc',
}

const INVENTORY_COLUMN_ORDER = {
  package: 'package_name',
  status: 'status',
  source: 'source',
  granted_at: 'granted_at',
  activate_by: 'activate_by',
}

const AUDIT_COLUMN_ORDER = {
  event_type: 'event_type',
  package: 'package_name',
  actor: 'actor',
  occurred_at: 'occurred_at',
}

function sortOrder(ordering, field) {
  if (ordering.replace(/^-/, '') !== field) return null
  return ordering.startsWith('-') ? 'descend' : 'ascend'
}

function nextOrdering(sorter, mapping, fallback) {
  const field = mapping[sorter.field]
  if (!field || !sorter.order) return fallback
  return `${sorter.order === 'descend' ? '-' : ''}${field}`
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('vi-VN') : '—'
}

export default function ServiceInventoryPanel({ canViewAudit, canManage }) {
  const [grantForm] = Form.useForm()
  const [revokeForm] = Form.useForm()
  const [companies, setCompanies] = useState([])
  const [companySearch, setCompanySearch] = useState('')
  const [companyPublicId, setCompanyPublicId] = useState()
  const [publishedVersions, setPublishedVersions] = useState([])
  const [inventory, setInventory] = useState({ count: 0, results: [] })
  const [audit, setAudit] = useState({ count: 0, results: [] })
  const [inventoryQuery, setInventoryQuery] = useState({ page: 1, page_size: 20, ordering: '-created_at' })
  const [auditQuery, setAuditQuery] = useState({ page: 1, page_size: 20, ordering: '-occurred_at' })
  const [loadingInventory, setLoadingInventory] = useState(false)
  const [loadingAudit, setLoadingAudit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [grantOpen, setGrantOpen] = useState(false)
  const [revokeUnit, setRevokeUnit] = useState(null)
  const debouncedCompanySearch = useDebouncedValue(companySearch.trim(), 350)

  const searchCompanies = useCallback(async (query = '') => {
    try {
      const data = await getAdminCompanies({ q: query, page: 1, page_size: 20 })
      setCompanies(data.results || [])
    } catch {
      message.error('Không thể tải danh sách doanh nghiệp.')
    }
  }, [])

  useEffect(() => {
    getAdminPackageVersions({ status: 'published' })
      .then(setPublishedVersions)
      .catch(() => message.error('Không thể tải phiên bản đang phát hành.'))
  }, [])
  useEffect(() => { searchCompanies(debouncedCompanySearch) }, [debouncedCompanySearch, searchCompanies])

  const loadInventory = useCallback(async () => {
    if (!companyPublicId) return
    setLoadingInventory(true)
    try {
      setInventory(await getAdminServiceEntitlements({
        company_public_id: companyPublicId,
        ...inventoryQuery,
      }))
    } catch {
      message.error('Không thể tải kho lượt dịch vụ.')
    } finally {
      setLoadingInventory(false)
    }
  }, [companyPublicId, inventoryQuery])

  const loadAudit = useCallback(async () => {
    if (!companyPublicId || !canViewAudit) return
    setLoadingAudit(true)
    try {
      setAudit(await getAdminServiceAudit({
        company_public_id: companyPublicId,
        ...auditQuery,
      }))
    } catch {
      message.error('Không thể tải lịch sử dịch vụ.')
    } finally {
      setLoadingAudit(false)
    }
  }, [auditQuery, canViewAudit, companyPublicId])

  useEffect(() => { loadInventory() }, [loadInventory])
  useEffect(() => { loadAudit() }, [loadAudit])

  const refresh = async () => Promise.all([loadInventory(), loadAudit()])

  const grant = async () => {
    const values = await grantForm.validateFields()
    setSaving(true)
    try {
      await grantAdminServiceEntitlements({ company_public_id: companyPublicId, ...values })
      message.success('Đã cấp lượt dịch vụ cho doanh nghiệp.')
      setGrantOpen(false)
      grantForm.resetFields()
      await refresh()
    } catch (error) {
      message.error(error?.response?.data?.detail || 'Không thể cấp lượt dịch vụ.')
    } finally {
      setSaving(false)
    }
  }

  const revoke = async () => {
    const { reason } = await revokeForm.validateFields()
    setSaving(true)
    try {
      await revokeAdminServiceEntitlement(revokeUnit.public_id, reason)
      message.success('Đã thu hồi lượt dịch vụ.')
      setRevokeUnit(null)
      revokeForm.resetFields()
      await refresh()
    } catch (error) {
      message.error(error?.response?.data?.detail || 'Không thể thu hồi lượt dịch vụ.')
    } finally {
      setSaving(false)
    }
  }

  const selectedCompany = companies.find((item) => item.public_id === companyPublicId)
  const companyOptions = useMemo(() => companies.map((company) => ({
    value: company.public_id,
    label: `${company.company_name} · ${company.public_id}`,
  })), [companies])
  const versionOptions = publishedVersions.map((version) => ({
    value: version.id,
    label: `${version.package_name} v${version.version_number} · ${Number(version.price).toLocaleString('vi-VN')} ${version.currency}`,
  }))

  const inventoryColumns = [
    { title: 'Gói', dataIndex: 'package_name', key: 'package', sorter: true, sortOrder: sortOrder(inventoryQuery.ordering, 'package_name'), width: 190, render: (value, row) => <div><div className="font-medium">{value}</div><div className="text-xs text-slate-500">v{row.version_number} · lượt {row.unit_number}</div></div> },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', sorter: true, sortOrder: sortOrder(inventoryQuery.ordering, 'status'), width: 140, render: (value) => <Tag color={STATUS_META[value]?.color}>{STATUS_META[value]?.label || value}</Tag> },
    { title: 'Nguồn', dataIndex: 'source', key: 'source', sorter: true, sortOrder: sortOrder(inventoryQuery.ordering, 'source'), width: 130, render: (value) => value === 'compensation' ? 'Bù dịch vụ' : 'Cấp thủ công' },
    { title: 'Ngày cấp', dataIndex: 'granted_at', key: 'granted_at', sorter: true, sortOrder: sortOrder(inventoryQuery.ordering, 'granted_at'), width: 170, render: formatDate },
    { title: 'Hạn kích hoạt', dataIndex: 'activate_by', key: 'activate_by', sorter: true, sortOrder: sortOrder(inventoryQuery.ordering, 'activate_by'), width: 170, render: formatDate },
    { title: 'Mã cấp', dataIndex: 'grant_key', key: 'grant_key', sorter: false, width: 180, ellipsis: true },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, unit) => canManage && unit.status === 'available' ? (
        <Button size="small" danger icon={<StopOutlined />} onClick={() => setRevokeUnit(unit)}>Thu hồi</Button>
      ) : '—',
    },
  ]

  const auditColumns = [
    { title: 'Sự kiện', dataIndex: 'event_type', key: 'event_type', sorter: true, sortOrder: sortOrder(auditQuery.ordering, 'event_type'), width: 180, render: (value) => EVENT_LABELS[value] || value },
    { title: 'Gói', dataIndex: 'package_name', key: 'package', sorter: true, sortOrder: sortOrder(auditQuery.ordering, 'package_name'), width: 180, render: (value) => value || '—' },
    { title: 'Người thực hiện', dataIndex: 'actor_email', key: 'actor', sorter: true, sortOrder: sortOrder(auditQuery.ordering, 'actor'), width: 220, render: (value) => value || 'Hệ thống' },
    { title: 'Thời gian', dataIndex: 'occurred_at', key: 'occurred_at', sorter: true, sortOrder: sortOrder(auditQuery.ordering, 'occurred_at'), width: 180, render: formatDate },
    { title: 'Lượt dịch vụ', dataIndex: 'unit_public_id', key: 'unit', sorter: false, width: 180, render: (value) => value || '—' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Select
          showSearch
          filterOption={false}
          className="w-full lg:max-w-xl"
          placeholder="Tìm và chọn doanh nghiệp"
          options={companyOptions}
          value={companyPublicId}
          onSearch={setCompanySearch}
          onChange={(value) => {
            setCompanyPublicId(value)
            setInventoryQuery((current) => ({ ...current, page: 1 }))
            setAuditQuery((current) => ({ ...current, page: 1 }))
          }}
        />
        <Space wrap>
          <Button icon={<ReloadOutlined />} disabled={!companyPublicId} onClick={refresh}>Làm mới</Button>
          {canManage && <Button type="primary" icon={<GiftOutlined />} disabled={!companyPublicId || !publishedVersions.length} onClick={() => setGrantOpen(true)}>Cấp lượt</Button>}
        </Space>
      </div>

      {!companyPublicId ? <Empty description="Chọn doanh nghiệp để xem kho lượt và lịch sử" /> : (
        <Tabs items={[
          {
            key: 'inventory',
            label: `Kho lượt (${inventory.count || 0})`,
            children: (
              <div className="overflow-x-auto">
                <Table
                  rowKey="public_id"
                  loading={loadingInventory}
                  dataSource={inventory.results || []}
                  columns={inventoryColumns}
                  scroll={{ x: 1200 }}
                  showSorterTooltip={{ target: 'sorter-icon' }}
                  pagination={{ current: inventoryQuery.page, pageSize: inventoryQuery.page_size, total: inventory.count, showSizeChanger: true }}
                  onChange={(pagination, _, sorter) => setInventoryQuery((current) => ({
                    ...current,
                    page: pagination.current,
                    page_size: pagination.pageSize,
                    ordering: nextOrdering(sorter, INVENTORY_COLUMN_ORDER, '-created_at'),
                  }))}
                />
              </div>
            ),
          },
          ...(canViewAudit ? [{
            key: 'audit',
            label: `Lịch sử (${audit.count || 0})`,
            children: (
              <div className="overflow-x-auto">
                <Table
                  rowKey="public_id"
                  loading={loadingAudit}
                  dataSource={audit.results || []}
                  columns={auditColumns}
                  scroll={{ x: 1000 }}
                  showSorterTooltip={{ target: 'sorter-icon' }}
                  pagination={{ current: auditQuery.page, pageSize: auditQuery.page_size, total: audit.count, showSizeChanger: true }}
                  onChange={(pagination, _, sorter) => setAuditQuery((current) => ({
                    ...current,
                    page: pagination.current,
                    page_size: pagination.pageSize,
                    ordering: nextOrdering(sorter, AUDIT_COLUMN_ORDER, '-occurred_at'),
                  }))}
                />
              </div>
            ),
          }] : []),
        ]} />
      )}

      <Modal
        title={`Cấp lượt${selectedCompany ? ` · ${selectedCompany.company_name}` : ''}`}
        open={grantOpen}
        onCancel={() => { setGrantOpen(false); grantForm.resetFields() }}
        onOk={grant}
        okText="Xác nhận cấp"
        cancelText="Đóng"
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={grantForm} layout="vertical" initialValues={{ quantity: 1, source: 'manual_grant' }}>
          <Form.Item name="package_version" label="Phiên bản đang phát hành" rules={[{ required: true }]}>
            <Select options={versionOptions} placeholder="Chọn gói" />
          </Form.Item>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Form.Item name="quantity" label="Số lượt độc lập" rules={[{ required: true }]}>
              <InputNumber min={1} max={1000} className="w-full" />
            </Form.Item>
            <Form.Item name="source" label="Nguồn cấp" rules={[{ required: true }]}>
              <Select options={[{ value: 'manual_grant', label: 'Xác nhận ngoài hệ thống' }, { value: 'compensation', label: 'Bù dịch vụ' }]} />
            </Form.Item>
          </div>
          <Form.Item name="grant_key" label="Mã biên nhận / khóa chống cấp trùng" rules={[{ required: true }, { max: 100 }]}>
            <Input placeholder="VD: bank-20260812-001" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Thu hồi lượt dịch vụ"
        open={Boolean(revokeUnit)}
        onCancel={() => { setRevokeUnit(null); revokeForm.resetFields() }}
        onOk={revoke}
        okText="Thu hồi"
        okButtonProps={{ danger: true }}
        cancelText="Đóng"
        confirmLoading={saving}
        destroyOnHidden
      >
        <p className="mb-4 break-words text-slate-600">Lượt <strong>{revokeUnit?.public_id}</strong> sẽ không thể kích hoạt sau khi thu hồi.</p>
        <Form form={revokeForm} layout="vertical">
          <Form.Item name="reason" label="Lý do thu hồi" rules={[{ required: true }, { max: 500 }]}>
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
