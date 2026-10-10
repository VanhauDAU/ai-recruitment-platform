import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
} from 'antd'
import { useAdminAccess } from '@/entities/admin-access'
import { useSession } from '@/entities/session'
import {
  createAdminServiceCategory,
  createAdminServicePackage,
  deleteAdminServiceCategory,
  deleteAdminServicePackage,
  getAdminServiceCategories,
  getAdminServicePackages,
  updateAdminServiceCategory,
  updateAdminServicePackage,
} from '@/entities/service-package'
import { message } from '@/shared/lib/toast'
import ConfirmAction from '@/shared/ui/ConfirmAction'
import { AdminDataActions, AdminPanel } from '@/shared/ui/admin'
import CommercialVersionsPanel from './CommercialVersionsPanel'
import ServiceActivationsPanel from './ServiceActivationsPanel'
import ServiceInventoryPanel from './ServiceInventoryPanel'

const CATEGORY_DEFAULTS = { order: 0, is_active: true }
const PACKAGE_DEFAULTS = { currency: 'VND', cta_type: 'contact', order: 0, is_active: true, is_highlight: false }

function lines(value) {
  return typeof value === 'string' ? value.split('\n').map((item) => item.trim()).filter(Boolean) : []
}

function compareText(field) {
  return (left, right) => String(left[field] || '').localeCompare(
    String(right[field] || ''),
    'vi',
  )
}

function compareNumber(field) {
  return (left, right) => Number(left[field] || 0) - Number(right[field] || 0)
}

export default function AdminServiceCatalog() {
  const { user } = useSession()
  const access = useAdminAccess(user)
  const [searchParams, setSearchParams] = useSearchParams()
  const canManageCatalog = access.has('service_catalog.manage')
  const canDraft = access.has('service_catalog.draft.manage')
  const canPublish = access.has('service_catalog.publish')
  const canViewInventory = access.has('service_entitlement.view')
  const canManageInventory = access.has('service_entitlement.manage')
  const canViewAudit = access.has('service_audit.view')
  const requestedTab = searchParams.get('tab') || 'categories'
  const allowedTabs = [
    'categories',
    'packages',
    'versions',
    ...(canViewInventory ? ['activations', 'inventory'] : []),
  ]
  const activeTab = allowedTabs.includes(requestedTab) ? requestedTab : 'categories'
  const rawQuery = searchParams.get('q') || ''
  const query = rawQuery.trim().toLocaleLowerCase('vi')
  const [searchDraft, setSearchDraft] = useState(rawQuery)
  const [form] = Form.useForm()
  const [categories, setCategories] = useState([])
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editor, setEditor] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [nextCategories, nextPackages] = await Promise.all([getAdminServiceCategories(), getAdminServicePackages()])
      setCategories(nextCategories)
      setPackages(nextPackages)
    } catch {
      message.error('Không thể tải danh mục dịch vụ.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { setSearchDraft(rawQuery) }, [rawQuery])
  useEffect(() => {
    if (!editor) return
    const defaults = editor.type === 'category' ? CATEGORY_DEFAULTS : PACKAGE_DEFAULTS
    const values = editor.row ? { ...editor.row } : defaults
    if (editor.type === 'package' && editor.row) {
      values.benefits_vi_text = (editor.row.benefits_vi || []).join('\n')
      values.benefits_en_text = (editor.row.benefits_en || []).join('\n')
    }
    form.setFieldsValue(values)
  }, [editor, form])

  const openEditor = (type, row = null) => {
    setEditor({ type, row })
  }

  const closeEditor = () => {
    form.resetFields()
    setEditor(null)
  }

  const save = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      if (editor.type === 'category') {
        const operation = editor.row ? updateAdminServiceCategory(editor.row.id, values) : createAdminServiceCategory(values)
        await operation
      } else {
        const payload = { ...values, benefits_vi: lines(values.benefits_vi_text), benefits_en: lines(values.benefits_en_text) }
        delete payload.benefits_vi_text
        delete payload.benefits_en_text
        const operation = editor.row ? updateAdminServicePackage(editor.row.id, payload) : createAdminServicePackage(payload)
        await operation
      }
      message.success('Đã lưu dữ liệu dịch vụ.')
      closeEditor()
      await load()
    } catch (error) {
      if (!error?.errorFields) message.error(error?.response?.data?.detail || 'Không thể lưu dữ liệu. Vui lòng kiểm tra các trường.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (type, id) => {
    try {
      await (type === 'category' ? deleteAdminServiceCategory(id) : deleteAdminServicePackage(id))
      message.success('Đã xoá dữ liệu dịch vụ.')
      await load()
    } catch (error) {
      message.error(error?.response?.data?.detail || 'Không thể xoá dữ liệu này.')
      throw error
    }
  }

  const actionColumn = (type) => ({
    title: 'Thao tác',
    width: 150,
    fixed: 'right',
    render: (_, row) => canManageCatalog ? (
      <Space>
        <Button icon={<EditOutlined />} size="small" onClick={() => openEditor(type, row)}>
          Sửa
        </Button>
        <ConfirmAction
          confirmText="Xoá"
          danger
          description={<>Bạn có chắc muốn xoá <strong>{row.name_vi}</strong>? Bạn sẽ không thể khôi phục {type === 'category' ? 'danh mục' : 'gói dịch vụ'} này sau khi xoá.</>}
          onConfirm={() => remove(type, row.id)}
          title={type === 'category' ? 'Xoá danh mục' : 'Xoá gói dịch vụ'}
        >
          <Button icon={<DeleteOutlined />} size="small" danger>Xoá</Button>
        </ConfirmAction>
      </Space>
    ) : 'Chỉ đọc',
  })

  const categoryColumns = [
    { title: 'Thứ tự', dataIndex: 'order', width: 80, sorter: compareNumber('order') },
    { title: 'Mã', dataIndex: 'key', width: 150, sorter: compareText('key') },
    { title: 'Tên tiếng Việt', dataIndex: 'name_vi', width: 220, sorter: compareText('name_vi') },
    { title: 'Tên tiếng Anh', dataIndex: 'name_en', width: 220, sorter: compareText('name_en'), render: (value) => value || '—' },
    { title: 'Mô tả', dataIndex: 'description_vi', width: 260, sorter: compareText('description_vi'), ellipsis: true, render: (value) => value || '—' },
    { title: 'Số gói', dataIndex: 'packages_count', width: 90, sorter: compareNumber('packages_count') },
    { title: 'Trạng thái', dataIndex: 'is_active', width: 110, sorter: compareNumber('is_active'), render: (value) => <Tag color={value ? 'green' : 'default'}>{value ? 'Hiển thị' : 'Đã ẩn'}</Tag> },
    actionColumn('category'),
  ]
  const packageColumns = [
    { title: 'Thứ tự', dataIndex: 'order', width: 80, sorter: compareNumber('order') },
    { title: 'Gói', dataIndex: 'name_vi', width: 190, sorter: compareText('name_vi') },
    { title: 'Nhóm', dataIndex: 'category_key', width: 150, sorter: compareText('category_key') },
    { title: 'Giá', dataIndex: 'price', width: 150, sorter: compareNumber('price'), render: (value) => value == null ? 'Liên hệ' : `${Number(value).toLocaleString('vi-VN')} ₫` },
    { title: 'Quyền lợi', key: 'benefits', width: 110, sorter: (left, right) => (left.benefits_vi?.length || 0) - (right.benefits_vi?.length || 0), render: (_, row) => `${row.benefits_vi?.length || 0} mục` },
    { title: 'CTA', dataIndex: 'cta_type', width: 100, sorter: compareText('cta_type'), render: (value) => value === 'register' ? 'Đăng ký' : 'Tư vấn' },
    { title: 'Nổi bật', dataIndex: 'is_highlight', width: 90, sorter: compareNumber('is_highlight'), render: (value) => value ? <Tag color="green">Có</Tag> : '—' },
    { title: 'Trạng thái', dataIndex: 'is_active', width: 110, sorter: compareNumber('is_active'), render: (value) => <Tag color={value ? 'green' : 'default'}>{value ? 'Hiển thị' : 'Đã ẩn'}</Tag> },
    actionColumn('package'),
  ]
  const filteredCategories = categories.filter((item) => !query || [
    item.key,
    item.name_vi,
    item.name_en,
    item.description_vi,
  ].some((value) => String(value || '').toLocaleLowerCase('vi').includes(query)))
  const filteredPackages = packages.filter((item) => !query || [
    item.slug,
    item.name_vi,
    item.name_en,
    item.category_key,
    item.tagline_vi,
  ].some((value) => String(value || '').toLocaleLowerCase('vi').includes(query)))

  const updateSearch = (value) => {
    const next = new URLSearchParams(searchParams)
    const normalized = value.trim()
    if (normalized) next.set('q', normalized)
    else next.delete('q')
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="space-y-5">
      <AdminPanel>
        <Tabs activeKey={activeTab} onChange={(tab) => {
          const next = new URLSearchParams(searchParams)
          if (tab === 'categories') next.delete('tab')
          else next.set('tab', tab)
          setSearchParams(next)
        }} items={[
          {
            key: 'categories',
            label: `Danh mục (${categories.length})`,
            children: (
              <div>
                <div className="admin-list-toolbar" data-print-hide="true">
                  <Input.Search
                    allowClear
                    className="w-full sm:w-80"
                    value={searchDraft}
                    placeholder="Tìm mã, tên hoặc mô tả danh mục"
                    onChange={(event) => setSearchDraft(event.target.value)}
                    onSearch={updateSearch}
                  />
                  <Space wrap>
                    <AdminDataActions
                      compact
                      columns={[
                        { key: 'key', label: 'Mã danh mục' },
                        { key: 'name_vi', label: 'Tên tiếng Việt' },
                        { key: 'name_en', label: 'Tên tiếng Anh' },
                        { key: 'description_vi', label: 'Mô tả' },
                        { key: 'packages_count', label: 'Số gói' },
                        { key: 'is_active', label: 'Đang hiển thị' },
                      ]}
                      exportLabel="Xuất CSV"
                      exportScopeLabel={`Xuất ${filteredCategories.length} danh mục đang hiển thị`}
                      filename="danh-muc-dich-vu-ntd"
                      onRefresh={load}
                      refreshing={loading}
                      rows={filteredCategories}
                    />
                    {canManageCatalog && <Button icon={<PlusOutlined />} type="primary" onClick={() => openEditor('category')}>Thêm danh mục</Button>}
                  </Space>
                </div>
                <div className="overflow-x-auto"><Table rowKey="id" loading={loading} dataSource={filteredCategories} columns={categoryColumns} pagination={false} scroll={{ x: 1300 }} showSorterTooltip={{ target: 'sorter-icon' }} /></div>
              </div>
            ),
          },
          {
            key: 'packages',
            label: `Gói dịch vụ (${packages.length})`,
            children: (
              <div>
                <div className="admin-list-toolbar" data-print-hide="true">
                  <Input.Search
                    allowClear
                    className="w-full sm:w-80"
                    value={searchDraft}
                    placeholder="Tìm tên, slug hoặc nhóm dịch vụ"
                    onChange={(event) => setSearchDraft(event.target.value)}
                    onSearch={updateSearch}
                  />
                  <Space wrap>
                    <AdminDataActions
                      compact
                      columns={[
                        { key: 'slug', label: 'Slug' },
                        { key: 'name_vi', label: 'Tên gói' },
                        { key: 'category_key', label: 'Nhóm' },
                        { key: 'price', label: 'Giá' },
                        { key: 'currency', label: 'Tiền tệ' },
                        { label: 'Số quyền lợi', value: (row) => row.benefits_vi?.length || 0 },
                        { key: 'cta_type', label: 'CTA' },
                        { key: 'is_highlight', label: 'Nổi bật' },
                        { key: 'is_active', label: 'Đang hiển thị' },
                      ]}
                      exportLabel="Xuất CSV"
                      exportScopeLabel={`Xuất ${filteredPackages.length} gói đang hiển thị`}
                      filename="goi-dich-vu-ntd"
                      onRefresh={load}
                      refreshing={loading}
                      rows={filteredPackages}
                    />
                    {canManageCatalog && <Button icon={<PlusOutlined />} type="primary" disabled={!categories.length} onClick={() => openEditor('package')}>Thêm gói dịch vụ</Button>}
                  </Space>
                </div>
                <div className="overflow-x-auto"><Table rowKey="id" loading={loading} dataSource={filteredPackages} columns={packageColumns} pagination={false} scroll={{ x: 1300 }} showSorterTooltip={{ target: 'sorter-icon' }} /></div>
              </div>
            ),
          },
          {
            key: 'versions',
            label: 'Phiên bản vận hành',
            children: (
              <CommercialVersionsPanel
                packages={packages}
                canDraft={canDraft}
                canPublish={canPublish}
              />
            ),
          },
          ...(canViewInventory ? [{
            key: 'activations',
            label: 'Dịch vụ đang chạy',
            children: <ServiceActivationsPanel canManage={canManageInventory} />,
          }] : []),
          ...(canViewInventory ? [{
            key: 'inventory',
            label: 'Kho lượt & lịch sử',
            children: (
              <ServiceInventoryPanel
                canManage={canManageInventory}
                canViewAudit={canViewAudit}
              />
            ),
          }] : []),
        ]} />
      </AdminPanel>

      <Modal title={editor?.type === 'category' ? `${editor?.row ? 'Sửa' : 'Thêm'} danh mục` : `${editor?.row ? 'Sửa' : 'Thêm'} gói dịch vụ`} open={Boolean(editor)} onCancel={closeEditor} onOk={save} okText="Lưu" cancelText="Hủy" confirmLoading={saving} width={editor?.type === 'package' ? 860 : 680} destroyOnHidden>
        {editor && (editor.type === 'category' ? (
          <Form form={form} layout="vertical" initialValues={CATEGORY_DEFAULTS}>
            <div className="grid gap-x-4 sm:grid-cols-2"><Form.Item name="key" label="Mã danh mục" rules={[{ required: true }]}><Input placeholder="featured-jobs" disabled={Boolean(editor.row)} /></Form.Item><Form.Item name="icon" label="Tên icon"><Input placeholder="ThunderboltOutlined" /></Form.Item><Form.Item name="name_vi" label="Tên tiếng Việt" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="name_en" label="Tên tiếng Anh"><Input /></Form.Item></div>
            <Form.Item name="description_vi" label="Mô tả tiếng Việt"><Input.TextArea rows={3} /></Form.Item><Form.Item name="description_en" label="Mô tả tiếng Anh"><Input.TextArea rows={3} /></Form.Item>
            <div className="grid gap-x-4 sm:grid-cols-2"><Form.Item name="order" label="Thứ tự"><InputNumber min={0} className="w-full" /></Form.Item><Form.Item name="is_active" label="Hiển thị" valuePropName="checked"><Switch /></Form.Item></div>
          </Form>
        ) : (
          <Form form={form} layout="vertical" initialValues={PACKAGE_DEFAULTS}>
            <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3"><Form.Item name="category" label="Danh mục" rules={[{ required: true }]}><Select options={categories.map((item) => ({ value: item.id, label: item.name_vi }))} /></Form.Item><Form.Item name="slug" label="Slug" rules={[{ required: true }]}><Input disabled={Boolean(editor.row)} /></Form.Item><Form.Item name="order" label="Thứ tự"><InputNumber min={0} className="w-full" /></Form.Item></div>
            <div className="grid gap-x-4 sm:grid-cols-2"><Form.Item name="name_vi" label="Tên tiếng Việt" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="name_en" label="Tên tiếng Anh"><Input /></Form.Item><Form.Item name="tagline_vi" label="Tagline tiếng Việt"><Input /></Form.Item><Form.Item name="tagline_en" label="Tagline tiếng Anh"><Input /></Form.Item></div>
            <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3"><Form.Item name="price" label="Giá (để trống = Liên hệ)"><InputNumber min={0} className="w-full" /></Form.Item><Form.Item name="currency" label="Tiền tệ"><Input /></Form.Item><Form.Item name="cta_type" label="Loại CTA"><Select options={[{ value: 'contact', label: 'Liên hệ tư vấn' }, { value: 'register', label: 'Đăng ký tài khoản' }]} /></Form.Item><Form.Item name="unit_vi" label="Đơn vị tiếng Việt"><Input /></Form.Item><Form.Item name="unit_en" label="Đơn vị tiếng Anh"><Input /></Form.Item><Form.Item name="badge_vi" label="Nhãn nổi bật tiếng Việt"><Input /></Form.Item><Form.Item name="badge_en" label="Nhãn nổi bật tiếng Anh"><Input /></Form.Item></div>
            <div className="grid gap-x-4 sm:grid-cols-2"><Form.Item name="vat_note_vi" label="Ghi chú VAT tiếng Việt"><Input /></Form.Item><Form.Item name="vat_note_en" label="Ghi chú VAT tiếng Anh"><Input /></Form.Item><Form.Item name="benefits_vi_text" label="Quyền lợi tiếng Việt (mỗi dòng một mục)"><Input.TextArea rows={6} /></Form.Item><Form.Item name="benefits_en_text" label="Quyền lợi tiếng Anh (mỗi dòng một mục)"><Input.TextArea rows={6} /></Form.Item></div>
            <Space size="large"><Form.Item name="is_active" label="Hiển thị" valuePropName="checked"><Switch /></Form.Item><Form.Item name="is_highlight" label="Gói nổi bật" valuePropName="checked"><Switch /></Form.Item></Space>
          </Form>
        ))}
      </Modal>
    </div>
  )
}
