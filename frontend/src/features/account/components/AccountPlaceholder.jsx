import { ToolOutlined } from '@ant-design/icons'

// Trang giữ chỗ cho các mục chưa xây trong layout tài khoản. Khi đào sâu từng
// trang, tạo component thật trong `pages/main/candidate/pages/` rồi thay
// element tương ứng ở MainRoutes — không cần sửa layout hay sidebar.
export default function AccountPlaceholder({ title }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      <div className="mt-10 flex flex-col items-center gap-3 pb-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-primary-soft)] text-2xl text-[var(--brand-primary)]">
          <ToolOutlined />
        </span>
        <p className="text-sm font-semibold text-slate-700">Trang đang được xây dựng</p>
        <p className="max-w-sm text-sm text-slate-500">
          Nội dung của mục "{title}" sẽ sớm có mặt tại đây.
        </p>
      </div>
    </section>
  )
}
