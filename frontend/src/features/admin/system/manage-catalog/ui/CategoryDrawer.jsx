import { DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Drawer, Form, Input, Select, Switch, Upload } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import {
  adminCatalogKeys,
  createAdminJobCategory,
  updateAdminJobCategory,
  uploadAdminCategoryIcon,
} from '@/entities/system/admin-catalog'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import { apiFieldErrors } from '../model/catalog'
import { CATEGORY_TYPES, parentOptions } from '../model/category-tree'

const FIELDS = ['name', 'name_en', 'parent', 'description', 'logo_url']

/**
 * Ngăn kéo thêm/sửa ngành nghề. `category` là `{ parent }` khi thêm mới: cấp của mục
 * do mục cha quyết định, nên form không hỏi loại.
 */
export default function CategoryDrawer({ category, categories, onClose }) {
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const editing = Boolean(category?.id)
  const parent = categories.find((item) => item.id === category?.parent)
  const type = editing ? category.category_type : parent ? CATEGORY_TYPES[parent.category_type].child : 'occupation_group'
  const [preview, setPreview] = useState(null)
  const initialValues = useMemo(() => ({
    name: category?.name ?? '',
    name_en: category?.name_en ?? '',
    parent: category?.parent ?? null,
    description: category?.description ?? '',
    active: category ? category.status !== 'inactive' : true,
    logo_url: category?.logo_url ?? '',
  }), [category])

  useEffect(() => {
    if (!category) return
    form.resetFields()
    setPreview(category.logo_preview ?? null)
  }, [form, category, initialValues])

  const save = useMutation({
    mutationFn: ({ active, ...values }) => {
      const payload = { ...values, status: active ? 'active' : 'inactive' }
      if (type !== 'occupation_group') delete payload.logo_url
      return editing ? updateAdminJobCategory(category.id, payload) : createAdminJobCategory(payload)
    },
    onSuccess: (saved) => {
      message.success(m.admin_catalog_item_saved({ name: saved.name }))
      queryClient.invalidateQueries({ queryKey: adminCatalogKeys.categories })
      onClose()
    },
    onError: (error) => {
      const fields = apiFieldErrors(error, FIELDS)
      if (fields.length) form.setFields(fields)
      else message.error(getApiErrorMessage(error, m.admin_catalog_action_failed()))
    },
  })
  const upload = useMutation({
    mutationFn: (file) => uploadAdminCategoryIcon(file),
    onSuccess: ({ path, url }) => {
      form.setFieldValue('logo_url', path)
      setPreview(url)
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.admin_catalog_icon_failed())),
  })
  const title = editing
    ? m.admin_catalog_edit_item({ name: category.name })
    : m.admin_catalog_add_type({ type: CATEGORY_TYPES[type].label().toLowerCase() })

  return (
    <Drawer
      open={Boolean(category)}
      size="min(420px, 100vw)"
      title={title}
      onClose={onClose}
      destroyOnHidden
      footer={(
        <div className="skill-drawer__footer">
          <span className="skill-drawer__spacer" />
          <Button type="primary" loading={save.isPending} onClick={() => form.submit()}>{m.admin_catalog_save()}</Button>
        </div>
      )}
    >
      {!editing && parent && <p className="skill-drawer__meta">{m.admin_catalog_child_of({ name: parent.name })}</p>}
      {editing && <p className="skill-drawer__meta">{CATEGORY_TYPES[type].label()} · {m.admin_catalog_category_jobs({ count: category.job_count })}</p>}
      <Form form={form} layout="vertical" requiredMark={false} initialValues={initialValues} onFinish={(values) => save.mutate(values)}>
        <Form.Item name="name" label={m.admin_catalog_name_vi()} validateTrigger="onBlur" rules={[{ required: true, whitespace: true, message: m.admin_catalog_name_required() }]}>
          <Input maxLength={255} autoFocus={!editing} />
        </Form.Item>
        <Form.Item name="name_en" label={m.admin_catalog_name_en()} extra={m.admin_catalog_name_en_help()}>
          <Input maxLength={255} />
        </Form.Item>
        {editing && type !== 'occupation_group' ? (
          <Form.Item name="parent" label={m.admin_catalog_group_parent()} extra={m.admin_catalog_parent_help()}>
            <Select options={parentOptions(categories, category)} showSearch={{ optionFilterProp: 'label' }} />
          </Form.Item>
        ) : (
          <Form.Item name="parent" hidden><Input /></Form.Item>
        )}
        {type === 'occupation_group' && (
          <Form.Item label={m.admin_catalog_icon()} extra={m.admin_catalog_icon_help()}>
            <Form.Item name="logo_url" hidden><Input /></Form.Item>
            <div className="catalog-icon-field">
              {preview && <img src={preview} alt="" className="catalog-icon-field__preview" />}
              <Upload accept="image/png,image/jpeg,image/webp" showUploadList={false} beforeUpload={(file) => { upload.mutate(file); return false }}>
                <Button icon={<UploadOutlined />} loading={upload.isPending}>{preview ? m.admin_catalog_icon_replace() : m.admin_catalog_icon_upload()}</Button>
              </Upload>
              {preview && (
                <Button
                  type="text"
                  icon={<DeleteOutlined />}
                  aria-label={m.admin_catalog_icon_remove()}
                  onClick={() => {
                    form.setFieldValue('logo_url', '')
                    setPreview(null)
                  }}
                />
              )}
            </div>
          </Form.Item>
        )}
        <Form.Item name="description" label={m.admin_catalog_description()}>
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} />
        </Form.Item>
        <Form.Item name="active" label={m.admin_catalog_col_active()} valuePropName="checked" extra={m.admin_catalog_category_active_help()}>
          <Switch />
        </Form.Item>
      </Form>
    </Drawer>
  )
}
