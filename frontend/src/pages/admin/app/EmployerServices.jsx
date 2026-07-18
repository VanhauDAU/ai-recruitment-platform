import { useCallback, useEffect, useState } from 'react'
import {
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
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

const CATEGORY_DEFAULTS = { order: 0, is_active: true }
const PACKAGE_DEFAULTS = { currency: 'VND', cta_type: 'contact', order: 0, is_active: true, is_highlight: false }

function lines(value) {
  return typeof value === 'string' ? value.split('\n').map((item) => item.trim()).filter(Boolean) : []
}

export default function AdminEmployerServices() {
  const { message } = App.useApp()
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
  }, [message])

  useEffect(() => { load() }, [load])

  const openEditor = (type, row = null) => {
    setEditor({ type, row })
    const defaults = type === 'category' ? CATEGORY_DEFAULTS : PACKAGE_DEFAULTS
    const values = row ? { ...row } : defaults
    if (type === 'package' && row) {
      values.benefits_vi_text = (row.benefits_vi || []).join('\n')
      values.benefits_en_text = (row.benefits_en || []).join('\n')
    }
    form.setFieldsValue(values)
  }

  const closeEditor = () => {
    setEditor(null)
    form.resetFields()
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
    }
  }

  const actionColumn = (type) => ({
    title: 'Thao tác',
    width: 150,
    fixed: 'right',
    render: (_, row) => <Space><Button size="small" onClick={() => openEditor(type, row)}>Sửa</Button><Popconfirm title="Xác nhận xoá?" onConfirm={() => remove(type, row.id)}><Button size="small" danger>Xoá</Button></Popconfirm></Space>,
  })

  const categoryColumns = [
    { title: 'Thứ tự', dataIndex: 'order', width: 80 },
    { title: 'Mã', dataIndex: 'key', width: 150 },
    { title: 'Tên tiếng Việt', dataIndex: 'name_vi', width: 220 },
    { title: 'Tên tiếng Anh', dataIndex: 'name_en', width: 220, render: (value) => value || '—' },
    { title: 'Số gói', dataIndex: 'packages_count', width: 90 },
    { title: 'Trạng thái', dataIndex: 'is_active', width: 110, render: (value) => <Tag color={value ? 'green' : 'default'}>{value ? 'Hiển thị' : 'Đã ẩn'}</Tag> },
    actionColumn('category'),
  ]
  const packageColumns = [
    { title: 'Thứ tự', dataIndex: 'order', width: 80 },
    { title: 'Gói', dataIndex: 'name_vi', width: 190 },
    { title: 'Nhóm', dataIndex: 'category_key', width: 150 },
    { title: 'Giá', dataIndex: 'price', width: 150, render: (value) => value == null ? 'Liên hệ' : `${Number(value).toLocaleString('vi-VN')} ₫` },
    { title: 'CTA', dataIndex: 'cta_type', width: 100, render: (value) => value === 'register' ? 'Đăng ký' : 'Tư vấn' },
    { title: 'Nổi bật', dataIndex: 'is_highlight', width: 90, render: (value) => value ? <Tag color="green">Có</Tag> : '—' },
    { title: 'Trạng thái', dataIndex: 'is_active', width: 110, render: (value) => <Tag color={value ? 'green' : 'default'}>{value ? 'Hiển thị' : 'Đã ẩn'}</Tag> },
    actionColumn('package'),
  ]

  return (
    <div>
      <Typography.Title level={2}>Dịch vụ nhà tuyển dụng</Typography.Title>
      <Typography.Paragraph type="secondary">Quản lý nhóm dịch vụ, giá, quyền lợi và CTA hiển thị trên trang báo giá công khai.</Typography.Paragraph>
      <Tabs items={[
        { key: 'categories', label: 'Danh mục', children: <><div className="mb-4 flex justify-end"><Button type="primary" onClick={() => openEditor('category')}>Thêm danh mục</Button></div><div className="overflow-x-auto"><Table rowKey="id" loading={loading} dataSource={categories} columns={categoryColumns} pagination={false} scroll={{ x: 1000 }} /></div></> },
        { key: 'packages', label: 'Gói dịch vụ', children: <><div className="mb-4 flex justify-end"><Button type="primary" disabled={!categories.length} onClick={() => openEditor('package')}>Thêm gói dịch vụ</Button></div><div className="overflow-x-auto"><Table rowKey="id" loading={loading} dataSource={packages} columns={packageColumns} pagination={false} scroll={{ x: 1100 }} /></div></> },
      ]} />

      <Modal title={editor?.type === 'category' ? `${editor?.row ? 'Sửa' : 'Thêm'} danh mục` : `${editor?.row ? 'Sửa' : 'Thêm'} gói dịch vụ`} open={Boolean(editor)} onCancel={closeEditor} onOk={save} confirmLoading={saving} width={editor?.type === 'package' ? 860 : 680} destroyOnHidden>
        {editor?.type === 'category' ? (
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
        )}
      </Modal>
    </div>
  )
}
