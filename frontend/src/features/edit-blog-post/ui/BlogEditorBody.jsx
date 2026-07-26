import { Card, Form, Input, Select } from 'antd'
import RichTextEditor from '@/shared/ui/RichTextEditor'

export default function BlogEditorBody({ categories, categoriesLoading, disabled = false, onLoadImages, onUploadImage, slug }) {
  return (
    <div className="blog-editor__card-column min-w-0">
      <Card className="border-slate-200 shadow-sm" styles={{ body: { padding: 0 } }}>
        <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand-primary)]">Thông tin bài viết</p>
          <p className="mt-1 text-sm text-slate-500">Tiêu đề và sapo quyết định cách bài viết xuất hiện trên trang ứng viên.</p>
        </div>
        <div className="space-y-1 px-4 py-5 sm:px-6 sm:py-6">
          <Form.Item
            name="title"
            label="Tiêu đề bài viết"
            extra={slug ? <span>Đường dẫn: <span className="font-medium text-slate-600">/blog/{slug}</span></span> : 'Đường dẫn ngắn gọn được hệ thống tự tạo khi lưu bản nháp.'}
            rules={[{ required: true, whitespace: true, message: 'Nhập tiêu đề bài viết.' }]}
          >
            <Input.TextArea
              className="blog-editor__title-input"
              autoSize={{ minRows: 1, maxRows: 3 }}
              maxLength={255}
              showCount
              placeholder="Ví dụ: Nhân viên Sales là gì? Lộ trình nghề nghiệp từ A đến Z"
            />
          </Form.Item>

          <div className="grid gap-x-4 md:grid-cols-2">
            <Form.Item name="category_public_id" label="Danh mục" rules={[{ required: true, message: 'Chọn danh mục.' }]}>
              <Select
                className="min-h-11"
                loading={categoriesLoading}
                placeholder="Chọn danh mục bài viết"
                options={categories.filter((item) => item.is_active).map((item) => ({ value: item.public_id, label: item.name }))}
              />
            </Form.Item>
          </div>

          <Form.Item
            name="summary"
            label="Sapo / mô tả ngắn"
            extra="Tóm tắt giá trị chính của bài trong 1–3 câu; nội dung này xuất hiện trên card và phần mở đầu."
            rules={[{ required: true, whitespace: true, message: 'Nhập sapo bài viết.' }]}
          >
            <Input.TextArea rows={4} maxLength={500} showCount placeholder="Giúp ứng viên hiểu ngay bài viết sẽ giải đáp điều gì…" />
          </Form.Item>
        </div>
      </Card>

      <Card className="border-slate-200 shadow-sm" styles={{ body: { padding: 0 } }}>
        <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand-primary)]">Nội dung bài viết</p>
              <p className="mt-1 text-sm text-slate-500">Soạn nội dung dài, chèn ảnh, bảng, liên kết và các tiêu đề mục.</p>
              <p className="mt-1 text-xs text-slate-400">Tiêu đề bài viết là H1 duy nhất; trong nội dung hãy dùng H2 cho mục lớn và H3 cho mục con.</p>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">Tự động lưu sau 1,5 giây</span>
          </div>
        </div>
        <div className="px-4 py-5 sm:px-6 sm:py-6">
          <Form.Item name="content" className="mb-0" rules={[{ required: true, message: 'Nhập nội dung bài viết.' }]}>
            <RichTextEditor
              disabled={disabled}
              mode="blog"
              minHeight={560}
              maxLength={100000}
              onLoadImages={onLoadImages}
              onUploadImage={onUploadImage}
              placeholder="Bắt đầu viết nội dung… Dùng H2 cho mục lớn và H3 cho mục con."
            />
          </Form.Item>
        </div>
      </Card>
    </div>
  )
}
