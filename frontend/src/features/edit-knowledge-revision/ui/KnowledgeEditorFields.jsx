import {
  CheckCircleFilled,
  ClockCircleOutlined,
  EyeOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import { Button, Card, Form, Input, InputNumber, Select, Space, Tag } from 'antd'
import {
  KNOWLEDGE_ARTICLE_TYPES,
  getAdminKnowledgeMedia,
  uploadAdminKnowledgeMedia,
} from '@/entities/knowledgebase'
import RichTextEditor from '@/shared/ui/RichTextEditor'

const KNOWLEDGE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function MainFields({ article, canEdit, type }) {
  return (
    <main className="knowledge-editor__main">
      <Card className="knowledge-editor__card" title="Nội dung bài viết">
        <Form.Item name="title" label={type === 'GUIDE' ? 'Tiêu đề hướng dẫn' : 'Câu hỏi'} rules={[{ required: true, whitespace: true, message: 'Nhập tiêu đề.' }]}>
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={240} showCount disabled={!canEdit} placeholder="Viết theo ngôn ngữ người dùng thường tìm kiếm…" />
        </Form.Item>
        <Form.Item
          name="body"
          label="Nội dung trả lời"
          rules={[{
            validator: (_, value) => value?.replace(/<[^>]+>/g, '').trim()
              ? Promise.resolve()
              : Promise.reject(new Error('Nhập nội dung trả lời.')),
          }]}
        >
          <RichTextEditor
            mode="blog"
            minHeight={430}
            maxLength={30000}
            disabled={!canEdit}
            placeholder="Trình bày ngắn gọn, dùng các bước và hình minh họa khi cần…"
            onLoadImages={getAdminKnowledgeMedia}
            onUploadImage={uploadAdminKnowledgeMedia}
            acceptedImageTypes={KNOWLEDGE_IMAGE_TYPES}
            imageUploadHint="JPG, PNG hoặc WebP · tối đa 5 MB · tối đa 1600 × 1600 px"
          />
        </Form.Item>
      </Card>

      <Card className="knowledge-editor__card" title="Nguồn và ghi chú biên tập">
        <Form.Item name="source_reference" label="Nguồn tham chiếu" extra="URL, tài liệu nội bộ hoặc mô tả nguồn đã kiểm chứng." rules={[{ required: true, whitespace: true, message: 'Nhập nguồn tham chiếu.' }]}>
          <Input.TextArea rows={2} maxLength={500} showCount disabled={!canEdit} />
        </Form.Item>
        <Form.Item name="change_summary" label="Tóm tắt thay đổi" rules={article?.first_published_at ? [{ required: true, whitespace: true, message: 'Bài đã xuất bản cần mô tả thay đổi.' }] : []}>
          <Input.TextArea rows={2} maxLength={500} showCount disabled={!canEdit} placeholder="Điểm mới hoặc lý do cập nhật revision này…" />
        </Form.Item>
      </Card>

      <Card className="knowledge-editor__card" title="Hiển thị trên công cụ tìm kiếm">
        <Form.Item name="seo_title" label="SEO title">
          <Input maxLength={200} showCount disabled={!canEdit} placeholder="Mặc định sử dụng tiêu đề bài viết" />
        </Form.Item>
        <Form.Item name="seo_description" label="SEO description">
          <Input.TextArea rows={3} maxLength={300} showCount disabled={!canEdit} placeholder="Mô tả ngắn giúp người dùng hiểu nội dung bài…" />
        </Form.Item>
      </Card>
    </main>
  )
}

function Settings({ article, canEdit, categories, completion, dirty, conflict, saving, onPreview, onSave }) {
  return (
    <aside className="knowledge-editor__sidebar">
      <Card className="knowledge-editor__card knowledge-editor__sticky" title="Thiết lập & chất lượng">
        <Form.Item name="category_public_id" label="Chuyên mục" rules={[{ required: true, message: 'Chọn chuyên mục.' }]}>
          <Select disabled={!canEdit || Boolean(article?.first_published_at)} options={(categories || []).map((category) => ({ value: category.public_id, label: category.name, disabled: !category.is_active }))} />
        </Form.Item>
        <Form.Item name="type" label="Loại nội dung" rules={[{ required: true }]}>
          <Select disabled={!canEdit || Boolean(article?.first_published_at)} options={KNOWLEDGE_ARTICLE_TYPES} />
        </Form.Item>
        {article && <Form.Item name="slug" label="Slug"><Input disabled={!canEdit || Boolean(article.first_published_at)} /></Form.Item>}
        <Form.Item name="order" label="Thứ tự trong chuyên mục">
          <InputNumber className="w-full" min={0} precision={0} disabled={!canEdit} />
        </Form.Item>

        <div className="knowledge-readiness">
          <div className="knowledge-readiness__heading">
            <strong>Mức độ hoàn thiện</strong>
            <Tag color={completion.completed === completion.checks.length ? 'success' : 'processing'}>{completion.completed}/{completion.checks.length}</Tag>
          </div>
          {completion.checks.map((check) => (
            <div className={check.done ? 'is-done' : ''} key={check.key}>
              <CheckCircleFilled /><span>{check.label}</span>
            </div>
          ))}
        </div>

        <Space direction="vertical" className="knowledge-editor__actions">
          <Button icon={<EyeOutlined />} block onClick={onPreview}>Xem trước</Button>
          {canEdit && (
            <Button type="primary" icon={<SaveOutlined />} block loading={saving} disabled={!dirty || conflict} onClick={onSave}>
              {article ? 'Lưu bản nháp' : 'Tạo bài viết'}
            </Button>
          )}
          <div className="knowledge-editor__save-state"><ClockCircleOutlined />{dirty ? 'Có thay đổi chưa lưu' : 'Đã đồng bộ với máy chủ'}</div>
        </Space>
      </Card>
    </aside>
  )
}

export default function KnowledgeEditorFields(props) {
  return (
    <div className="knowledge-editor__layout">
      <MainFields article={props.article} canEdit={props.canEdit} type={props.type} />
      <Settings {...props} />
    </div>
  )
}
