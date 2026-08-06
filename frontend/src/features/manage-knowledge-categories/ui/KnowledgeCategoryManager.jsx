import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Drawer, Empty, Form, Input, InputNumber, Modal, Space, Switch, Tag } from 'antd'
import { useState } from 'react'
import {
  adminKnowledgeKeys,
  createAdminKnowledgeCategory,
  getAdminKnowledgeCategories,
  knowledgeErrorMessage,
  reorderAdminKnowledgeCategories,
  setAdminKnowledgeCategoryActive,
  updateAdminKnowledgeCategory,
} from '@/entities/knowledgebase'
import { message } from '@/shared/lib/toast'
import './knowledge-category-manager.css'

function categoryPayload(values) {
  return {
    name: values.name.trim(),
    slug: values.slug.trim(),
    description: values.description?.trim() || '',
    review_interval_days: values.review_interval_days,
    seo_title: values.seo_title?.trim() || '',
    seo_description: values.seo_description?.trim() || '',
  }
}

export default function KnowledgeCategoryManager({ open, onClose, canManage, canPublish }) {
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(null)
  const categoriesQuery = useQuery({
    queryKey: adminKnowledgeKeys.categories,
    queryFn: getAdminKnowledgeCategories,
    enabled: open,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: adminKnowledgeKeys.root })

  const saveMutation = useMutation({
    mutationFn: (values) => editing
      ? updateAdminKnowledgeCategory(editing.public_id, {
        ...categoryPayload(values),
        revision_token: editing.revision_token,
      })
      : createAdminKnowledgeCategory(categoryPayload(values)),
    onSuccess: () => {
      message.success(editing ? 'Đã cập nhật chuyên mục.' : 'Đã tạo chuyên mục.')
      setEditing(null)
      form.resetFields()
      refresh()
    },
    onError: (error) => message.error(knowledgeErrorMessage(error)),
  })

  const stateMutation = useMutation({
    mutationFn: ({ category, active }) => setAdminKnowledgeCategoryActive(
      category.public_id,
      active,
      category.revision_token,
    ),
    onSuccess: () => {
      message.success('Đã cập nhật trạng thái chuyên mục.')
      refresh()
    },
    onError: (error) => message.error(knowledgeErrorMessage(error)),
  })

  const reorderMutation = useMutation({
    mutationFn: reorderAdminKnowledgeCategories,
    onSuccess: () => {
      message.success('Đã cập nhật thứ tự chuyên mục.')
      refresh()
    },
    onError: (error) => message.error(knowledgeErrorMessage(error)),
  })

  const startEdit = (category) => {
    setEditing(category)
    form.setFieldsValue(category)
  }
  const cancelEdit = () => {
    setEditing(null)
    form.resetFields()
  }
  const move = (index, direction) => {
    const ids = (categoriesQuery.data || []).map((item) => item.public_id)
    const target = index + direction
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    reorderMutation.mutate(ids)
  }

  return (
    <Drawer
      className="knowledge-category-drawer"
      width={720}
      open={open}
      title="Quản lý chuyên mục"
      extra={<Button onClick={onClose}>Đóng</Button>}
      onClose={onClose}
    >
      <div className="knowledge-category-drawer__intro">
        <div>
          <strong>Cấu trúc trung tâm trợ giúp</strong>
          <p>Sắp xếp cách người dùng khám phá nội dung và đặt chu kỳ rà soát mặc định.</p>
        </div>
        {canManage && !editing && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => form.resetFields()}>
            Thêm chuyên mục
          </Button>
        )}
      </div>

      {canManage && (
        <Form
          className="knowledge-category-form"
          form={form}
          layout="vertical"
          initialValues={{ review_interval_days: 180 }}
          onFinish={(values) => saveMutation.mutate(values)}
        >
          <div className="knowledge-category-form__heading">
            <strong>{editing ? `Sửa “${editing.name}”` : 'Tạo chuyên mục mới'}</strong>
            {editing && <Button type="link" onClick={cancelEdit}>Hủy chỉnh sửa</Button>}
          </div>
          <div className="knowledge-category-form__grid">
            <Form.Item name="name" label="Tên chuyên mục" rules={[{ required: true, message: 'Nhập tên chuyên mục.' }]}>
              <Input maxLength={120} placeholder="Ví dụ: Tài khoản và đăng nhập" />
            </Form.Item>
            <Form.Item name="slug" label="Slug" rules={[{ required: true, message: 'Nhập slug.' }, { pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, message: 'Slug chỉ gồm chữ thường, số và dấu gạch ngang.' }]}>
              <Input maxLength={160} placeholder="tai-khoan-va-dang-nhap" />
            </Form.Item>
          </div>
          <Form.Item name="description" label="Mô tả ngắn">
            <Input.TextArea rows={2} maxLength={300} showCount />
          </Form.Item>
          <div className="knowledge-category-form__grid">
            <Form.Item name="review_interval_days" label="Rà soát lại sau (ngày)" rules={[{ required: true }]}>
              <InputNumber min={30} max={365} className="w-full" />
            </Form.Item>
            <Form.Item name="seo_title" label="SEO title">
              <Input maxLength={200} showCount />
            </Form.Item>
          </div>
          <Form.Item name="seo_description" label="SEO description">
            <Input.TextArea rows={2} maxLength={300} showCount />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>
            {editing ? 'Lưu thay đổi' : 'Tạo chuyên mục'}
          </Button>
        </Form>
      )}

      <div className="knowledge-category-list" aria-label="Danh sách chuyên mục">
        {(categoriesQuery.data || []).map((category, index) => (
          <article className="knowledge-category-card" key={category.public_id}>
            <div className="knowledge-category-card__order">{index + 1}</div>
            <div className="knowledge-category-card__main">
              <div className="knowledge-category-card__title">
                <strong>{category.name}</strong>
                <Tag color={category.is_active ? 'success' : 'default'}>
                  {category.is_active ? 'Đang hiển thị' : 'Đang ẩn'}
                </Tag>
              </div>
              <p>{category.description || 'Chưa có mô tả chuyên mục.'}</p>
              <div className="knowledge-category-card__meta">
                <span>{category.article_count} bài viết</span>
                <span>{category.public_article_count} công khai</span>
                <span>Rà soát mỗi {category.review_interval_days} ngày</span>
              </div>
            </div>
            <Space direction="vertical" size={6}>
              {canManage && (
                <Button size="small" icon={<EditOutlined />} onClick={() => startEdit(category)}>
                  Sửa
                </Button>
              )}
              {canManage && (
                <Space.Compact>
                  <Button aria-label={`Đưa ${category.name} lên`} size="small" icon={<ArrowUpOutlined />} disabled={index === 0 || reorderMutation.isPending} onClick={() => move(index, -1)} />
                  <Button aria-label={`Đưa ${category.name} xuống`} size="small" icon={<ArrowDownOutlined />} disabled={index === (categoriesQuery.data?.length || 0) - 1 || reorderMutation.isPending} onClick={() => move(index, 1)} />
                </Space.Compact>
              )}
              {canPublish && (
                <Switch
                  checked={category.is_active}
                  checkedChildren="Bật"
                  unCheckedChildren="Ẩn"
                  loading={stateMutation.isPending}
                  onChange={(active) => {
                    if (!active && category.public_article_count) {
                      Modal.confirm({
                        title: `Ẩn chuyên mục “${category.name}”?`,
                        content: `${category.public_article_count} bài công khai sẽ không còn xuất hiện trong trung tâm trợ giúp.`,
                        okText: 'Ẩn chuyên mục',
                        okButtonProps: { danger: true },
                        cancelText: 'Giữ hiển thị',
                        onOk: () => stateMutation.mutate({ category, active }),
                      })
                    } else stateMutation.mutate({ category, active })
                  }}
                />
              )}
            </Space>
          </article>
        ))}
        {!categoriesQuery.isLoading && !categoriesQuery.data?.length && (
          <Empty description="Chưa có chuyên mục" />
        )}
      </div>
    </Drawer>
  )
}
