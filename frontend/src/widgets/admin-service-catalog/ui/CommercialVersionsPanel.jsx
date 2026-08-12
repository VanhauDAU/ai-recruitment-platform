import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  RocketOutlined,
} from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from 'antd'
import {
  createAdminPackageVersion,
  deleteAdminPackageVersion,
  getAdminPackageVersions,
  getAdminServiceCapabilities,
  publishAdminPackageVersion,
  updateAdminPackageVersion,
} from '@/entities/service-package'
import { message } from '@/shared/lib/toast'
import ConfirmAction from '@/shared/ui/ConfirmAction'

const VERSION_DEFAULTS = {
  price: 0,
  currency: 'VND',
  activate_within_days: 90,
  items: [{ capability: undefined, quantity: 1, duration_days: 14 }],
}

const STATUS_META = {
  draft: { color: 'gold', label: 'Bản nháp' },
  published: { color: 'green', label: 'Đang phát hành' },
  archived: { color: 'default', label: 'Đã lưu trữ' },
}

function compareText(field) {
  return (left, right) => String(left[field] || '').localeCompare(String(right[field] || ''), 'vi')
}

function compareNumber(field) {
  return (left, right) => Number(left[field] || 0) - Number(right[field] || 0)
}

function configurationValue(item) {
  return item.configuration?.placement || item.configuration?.tone
}

function configurationFor(capability, value) {
  if (capability === 'sponsored_placement') return { placement: value }
  if (capability === 'card_tone') return { tone: value }
  return {}
}

function configurationOptions(capability) {
  if (capability === 'sponsored_placement') {
    return [
      { value: 'search_sponsored', label: 'Cụm tài trợ trong tìm kiếm' },
      { value: 'best_jobs_eligible', label: 'Đủ điều kiện Việc làm tốt nhất' },
    ]
  }
  if (capability === 'card_tone') {
    return [
      { value: 'orange', label: 'Cam nhạt' },
      { value: 'green', label: 'Xanh' },
      { value: 'green_strong', label: 'Xanh nổi bật' },
    ]
  }
  return []
}

export default function CommercialVersionsPanel({ packages, canDraft, canPublish }) {
  const [form] = Form.useForm()
  const [capabilities, setCapabilities] = useState([])
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editor, setEditor] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [nextCapabilities, nextVersions] = await Promise.all([
        getAdminServiceCapabilities(),
        getAdminPackageVersions(),
      ])
      setCapabilities(nextCapabilities)
      setVersions(nextVersions)
    } catch {
      message.error('Không thể tải phiên bản gói dịch vụ.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openEditor = (version = null) => {
    const values = version ? {
      ...version,
      items: version.items.map((item) => ({
        ...item,
        configuration_value: configurationValue(item),
      })),
    } : VERSION_DEFAULTS
    form.setFieldsValue(values)
    setEditor(version || { status: 'draft' })
  }

  const closeEditor = () => {
    form.resetFields()
    setEditor(null)
  }

  const save = async () => {
    const values = await form.validateFields()
    const payload = {
      ...values,
      items: values.items.map(({ configuration_value: value, ...item }, order) => ({
        ...item,
        order,
        configuration: configurationFor(item.capability, value),
      })),
    }
    setSaving(true)
    try {
      if (editor.id) await updateAdminPackageVersion(editor.id, payload)
      else await createAdminPackageVersion(payload)
      message.success('Đã lưu phiên bản nháp.')
      closeEditor()
      await load()
    } catch (error) {
      message.error(error?.response?.data?.detail || 'Không thể lưu phiên bản. Kiểm tra lại quyền lợi và cấu hình.')
    } finally {
      setSaving(false)
    }
  }

  const publish = async (version) => {
    try {
      await publishAdminPackageVersion(version.id)
      message.success(`Đã phát hành ${version.package_name} v${version.version_number}.`)
      await load()
    } catch (error) {
      message.error(error?.response?.data?.detail || 'Không thể phát hành phiên bản.')
      throw error
    }
  }

  const remove = async (version) => {
    try {
      await deleteAdminPackageVersion(version.id)
      message.success('Đã xóa phiên bản nháp.')
      await load()
    } catch (error) {
      message.error(error?.response?.data?.detail || 'Chỉ phiên bản nháp mới được xóa.')
      throw error
    }
  }

  const packageOptions = useMemo(
    () => packages.map((item) => ({ value: item.id, label: item.name_vi })),
    [packages],
  )
  const capabilityOptions = capabilities.filter((item) => item.is_active).map((item) => ({
    value: item.code,
    label: item.name_vi,
  }))

  const columns = [
    { title: 'Gói', dataIndex: 'package_name', sorter: compareText('package_name'), width: 190 },
    { title: 'Phiên bản', dataIndex: 'version_number', sorter: compareNumber('version_number'), width: 100, render: (value) => `v${value}` },
    { title: 'Giá', dataIndex: 'price', sorter: compareNumber('price'), width: 150, render: (value, row) => `${Number(value).toLocaleString('vi-VN')} ${row.currency}` },
    { title: 'Kích hoạt trong', dataIndex: 'activate_within_days', sorter: compareNumber('activate_within_days'), width: 140, render: (value) => `${value} ngày` },
    { title: 'Quyền lợi', dataIndex: 'items', sorter: (left, right) => left.items.length - right.items.length, width: 110, render: (items) => `${items.length} mục` },
    { title: 'Trạng thái', dataIndex: 'status', sorter: compareText('status'), width: 140, render: (value) => <Tag color={STATUS_META[value]?.color}>{STATUS_META[value]?.label || value}</Tag> },
    { title: 'Cập nhật', dataIndex: 'updated_at', sorter: compareText('updated_at'), width: 170, render: (value) => new Date(value).toLocaleString('vi-VN') },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 220,
      fixed: 'right',
      render: (_, version) => version.status === 'draft' ? (
        <Space wrap>
          {canDraft && <Button size="small" icon={<EditOutlined />} onClick={() => openEditor(version)}>Sửa</Button>}
          {canPublish && (
            <ConfirmAction
              title="Phát hành phiên bản"
              description={<>Phát hành <strong>{version.package_name} v{version.version_number}</strong>? Phiên bản sẽ bị khóa và thay thế bản đang phát hành.</>}
              confirmText="Phát hành"
              onConfirm={() => publish(version)}
            >
              <Button size="small" type="primary" icon={<RocketOutlined />}>Phát hành</Button>
            </ConfirmAction>
          )}
          {canDraft && (
            <ConfirmAction
              danger
              title="Xóa phiên bản nháp"
              description={<>Xóa <strong>{version.package_name} v{version.version_number}</strong>? Dữ liệu nháp không thể khôi phục.</>}
              confirmText="Xóa"
              onConfirm={() => remove(version)}
            >
              <Button size="small" danger icon={<DeleteOutlined />} aria-label="Xóa phiên bản" />
            </ConfirmAction>
          )}
        </Space>
      ) : 'Chỉ đọc',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Alert
          className="min-w-0 flex-1"
          type="info"
          showIcon
          message="Phiên bản đã phát hành là bất biến"
          description="Mọi thay đổi quyền lợi tạo phiên bản mới; khách đã được cấp lượt giữ nguyên snapshot cũ."
        />
        {canDraft && (
          <Button type="primary" icon={<PlusOutlined />} disabled={!packages.length} onClick={() => openEditor()}>
            Tạo phiên bản
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={versions}
          columns={columns}
          pagination={false}
          scroll={{ x: 1250 }}
          showSorterTooltip={{ target: 'sorter-icon' }}
        />
      </div>

      <Modal
        title={editor?.id ? `Sửa ${editor.package_name} v${editor.version_number}` : 'Tạo phiên bản gói'}
        open={Boolean(editor)}
        onCancel={closeEditor}
        onOk={save}
        okText="Lưu bản nháp"
        cancelText="Đóng"
        confirmLoading={saving}
        width={920}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={VERSION_DEFAULTS}>
          <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-4">
            <Form.Item name="package" label="Gói dịch vụ" rules={[{ required: true }]}>
              <Select disabled={Boolean(editor?.id)} options={packageOptions} placeholder="Chọn gói" />
            </Form.Item>
            <Form.Item name="price" label="Giá" rules={[{ required: true }]}>
              <InputNumber min={0} className="w-full" />
            </Form.Item>
            <Form.Item name="currency" label="Tiền tệ" rules={[{ required: true }]}>
              <Select options={[{ value: 'VND', label: 'VND' }, { value: 'USD', label: 'USD' }]} />
            </Form.Item>
            <Form.Item name="activate_within_days" label="Hạn bắt đầu dùng" rules={[{ required: true }]}>
              <InputNumber min={1} max={3650} addonAfter="ngày" className="w-full" />
            </Form.Item>
          </div>
          <Form.Item name="terms_vi" label="Điều khoản ngắn">
            <Input.TextArea rows={2} maxLength={2000} showCount />
          </Form.Item>
          <Form.List name="items" rules={[{ validator: (_, items) => items?.length ? Promise.resolve() : Promise.reject(new Error('Cần ít nhất một quyền lợi.')) }]}>
            {(fields, { add, remove }, { errors }) => (
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.key} className="rounded-lg border border-slate-200 p-3">
                    <div className="grid gap-x-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Form.Item {...field} name={[field.name, 'capability']} label={`Quyền lợi ${index + 1}`} rules={[{ required: true }]}>
                        <Select options={capabilityOptions} placeholder="Chọn quyền lợi" />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'quantity']} label="Số lượng" rules={[{ required: true }]}>
                        <InputNumber min={1} max={1000} className="w-full" />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'duration_days']} label="Thời gian chạy">
                        <InputNumber min={1} max={3650} addonAfter="ngày" className="w-full" placeholder="Tức thời" />
                      </Form.Item>
                      <Form.Item noStyle shouldUpdate>
                        {({ getFieldValue }) => {
                          const capability = getFieldValue(['items', field.name, 'capability'])
                          const options = configurationOptions(capability)
                          return options.length ? (
                            <Form.Item {...field} name={[field.name, 'configuration_value']} label="Cấu hình" rules={[{ required: true }]}>
                              <Select options={options} />
                            </Form.Item>
                          ) : <div />
                        }}
                      </Form.Item>
                    </div>
                    <Button danger type="text" disabled={fields.length === 1} onClick={() => remove(field.name)}>Xóa quyền lợi</Button>
                  </div>
                ))}
                <Form.ErrorList errors={errors} />
                <Button block type="dashed" icon={<PlusOutlined />} onClick={() => add({ quantity: 1, duration_days: 14 })}>Thêm quyền lợi</Button>
              </div>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  )
}
