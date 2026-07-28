import {
  CheckCircleFilled,
  DeleteOutlined,
  FileImageOutlined,
  LinkOutlined,
  MinusCircleOutlined,
  SearchOutlined,
  TagsOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { Button, Card, Divider, Form, Image, Input, Progress, Select, Space, Tag, Timeline, Upload } from 'antd'
import { EDITOR_COMPLETION_ITEMS } from '../model/editor-completion'
import { stateColor } from '../model/editor-options'
import BlogTagPicker from './BlogTagPicker'

function CompletionList({ checks }) {
  return (
    <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
      {EDITOR_COMPLETION_ITEMS.map((item) => (
        <li key={item.key} className={`flex min-w-0 items-center gap-2 ${checks[item.key] ? 'text-slate-700' : 'text-slate-400'}`}>
          {checks[item.key] ? <CheckCircleFilled className="shrink-0 text-emerald-500" /> : <MinusCircleOutlined className="shrink-0" />}
          <span className="truncate">{item.label}</span>
        </li>
      ))}
    </ul>
  )
}

function SeoPreview({ values, slug }) {
  const title = values.seo_title?.trim() || values.title?.trim() || 'Tiêu đề bài viết'
  const description = values.seo_description?.trim() || values.summary?.trim() || 'Mô tả bài viết sẽ xuất hiện tại đây.'
  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3" aria-label="Xem trước kết quả tìm kiếm">
      <p className="truncate text-xs text-emerald-700">website.vn › blog › {slug || 'duong-dan-tu-dong'}</p>
      <p className="mt-1 line-clamp-1 text-base font-medium text-blue-700">{title}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{description}</p>
    </div>
  )
}

export default function BlogEditorSidebar({
  allowedActions,
  completion,
  disabled = false,
  jobs,
  jobsLoading,
  onAction,
  onUploadThumbnail,
  post,
  slug,
  tags,
  tagsError,
  tagsLoading,
  values,
}) {
  return (
    <aside className="blog-editor__card-column min-w-0 xl:sticky xl:top-24 xl:self-start">
      <Card className="border-slate-200 shadow-sm" title="Xuất bản">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-500">Trạng thái</span>
          <Tag color={post ? stateColor(post.editorial_state) : 'blue'}>{post?.editorial_state_label || 'Bản nháp mới'}</Tag>
        </div>
        <Divider className="my-4" />
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-slate-700">Mức độ hoàn thiện</span>
          <span className="text-sm font-bold tabular-nums text-slate-900">{completion.score}%</span>
        </div>
        <Progress percent={completion.score} showInfo={false} status={completion.score === 100 ? 'success' : 'active'} />
        <CompletionList checks={completion.checks} />
        <p className="mt-4 text-xs leading-5 text-slate-500">Tiêu đề, danh mục, sapo và nội dung là bắt buộc. Các mục còn lại giúp bài hiển thị tốt hơn.</p>
      </Card>

      <Card className="border-slate-200 shadow-sm" title={<span><TagsOutlined className="mr-2 text-[var(--brand-primary)]" />Phân loại & liên kết</span>}>
        <Form.Item name="tag_public_ids" label="Thẻ bài viết" extra="Tìm thẻ hiện có hoặc nhập tên để tạo nhanh mà không rời trang.">
          <BlogTagPicker tags={tags} loading={tagsLoading} error={tagsError} disabled={disabled} />
        </Form.Item>
        <Form.Item name="related_job_category_id" label="Việc làm liên quan" extra="Hiển thị khối việc làm phù hợp ở cuối bài.">
          <Select
            allowClear
            disabled={disabled}
            showSearch
            optionFilterProp="label"
            loading={jobsLoading}
            placeholder="Chọn nhóm việc làm"
            options={jobs.map((item) => ({ value: item.id, label: item.name }))}
          />
        </Form.Item>
      </Card>

      <Card className="border-slate-200 shadow-sm" title={<span><FileImageOutlined className="mr-2 text-[var(--brand-primary)]" />Ảnh đại diện</span>}>
        {values.thumbnail_url
          ? <Image src={values.thumbnail_url} alt={`Ảnh đại diện ${values.title || 'bài viết'}`} className="aspect-video w-full rounded-xl object-cover" />
          : <div className="grid aspect-video place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-400">Ảnh ngang tỷ lệ 16:9<br />khuyến nghị tối thiểu 1200×675 px</div>}
        <Upload disabled={disabled} className="block w-full" accept="image/jpeg,image/png,image/webp" showUploadList={false} beforeUpload={onUploadThumbnail}>
          <Button block disabled={disabled} className="mt-3 min-h-11" icon={<UploadOutlined />}>{values.thumbnail_url ? 'Thay ảnh đại diện' : 'Tải ảnh đại diện'}</Button>
        </Upload>
      </Card>

      <Card className="border-slate-200 shadow-sm" title={<span><SearchOutlined className="mr-2 text-[var(--brand-primary)]" />Tối ưu tìm kiếm</span>}>
        <SeoPreview values={values} slug={slug} />
        <Form.Item name="seo_title" label="SEO title" extra="Nếu để trống, hệ thống dùng tiêu đề bài viết.">
          <Input maxLength={200} showCount placeholder="Tiêu đề hiển thị trên Google" />
        </Form.Item>
        <Form.Item name="seo_description" label="SEO description" extra="Nếu để trống, hệ thống dùng sapo.">
          <Input.TextArea rows={4} maxLength={300} showCount placeholder="Mô tả ngắn khuyến khích người đọc nhấp vào bài" />
        </Form.Item>
      </Card>

      {post && (
        <Card className="border-slate-200 shadow-sm" title={<span><LinkOutlined className="mr-2 text-[var(--brand-primary)]" />Thông tin bài viết</span>}>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-slate-400">Đường dẫn</dt><dd className="mt-1 break-all font-medium text-slate-700">/blog/{slug}</dd></div>
            <div><dt className="text-slate-400">Tác giả</dt><dd className="mt-1 font-medium text-slate-700">{post.author?.name || 'Không xác định'}</dd></div>
            <div><dt className="text-slate-400">Cập nhật gần nhất</dt><dd className="mt-1 font-medium text-slate-700">{new Date(post.updated_at).toLocaleString('vi-VN')}</dd></div>
          </dl>
        </Card>
      )}

      {post?.history?.length > 0 && (
        <Card className="border-slate-200 shadow-sm" title="Lịch sử duyệt">
          <Timeline items={post.history.slice(0, 8).map((item) => ({ children: <div><p className="font-medium text-slate-700">{item.action}</p><p className="text-xs text-slate-500">{item.actor_name} · {new Date(item.created_at).toLocaleString('vi-VN')}</p>{item.note && <p className="mt-1 text-sm text-slate-600">{item.note}</p>}</div> }))} />
        </Card>
      )}

      {post && allowedActions.some((action) => ['return', 'restore', 'discard_draft', 'archive'].includes(action)) && (
        <Card className="border-slate-200 shadow-sm" title="Thao tác khác">
          <Space orientation="vertical" className="w-full" style={{ width: '100%' }}>
            {allowedActions.includes('return') && <Button block onClick={() => onAction('return')}>Trả về chỉnh sửa</Button>}
            {/* Bài đã gỡ làm form chỉ đọc; action workflow này phải thoát disabled context của Form. */}
            {allowedActions.includes('restore') && <Button block disabled={false} onClick={() => onAction('restore')}>Khôi phục về nháp</Button>}
            {allowedActions.includes('discard_draft') && <Button block danger icon={<DeleteOutlined />} onClick={() => onAction('discard-draft')}>Hủy bản nháp</Button>}
            {allowedActions.includes('archive') && <Button block danger onClick={() => onAction('archive')}>Gỡ bài viết</Button>}
          </Space>
        </Card>
      )}
    </aside>
  )
}
