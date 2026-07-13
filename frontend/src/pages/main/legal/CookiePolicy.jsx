import { Link } from 'react-router-dom'

const COOKIE_ROWS = [
  ['procv_consent', 'Cookie ký số, HttpOnly', 'Ghi nhớ lựa chọn đồng ý cookie', 'Thiết yếu', '180 ngày'],
  ['color-scheme', 'localStorage', 'Ghi nhớ giao diện sáng/tối', 'Tùy chọn', 'Đến khi rút đồng ý hoặc xóa dữ liệu'],
  ['search_history', 'localStorage', 'Gợi ý tìm kiếm gần đây', 'Tùy chọn', 'Đến khi rút đồng ý hoặc xóa dữ liệu'],
  ['procv_viewer_id', 'Cookie ký số, HttpOnly', 'Chống đếm trùng lượt xem tin tuyển dụng', 'Hiệu năng', '365 ngày'],
]

export default function CookiePolicy() {
  return (
    <div className="bg-slate-50 py-10 sm:py-14">
      <article className="mx-auto max-w-4xl rounded-2xl bg-white px-5 py-8 shadow-sm ring-1 ring-slate-200 sm:px-10 sm:py-12">
        <p className="text-sm font-bold uppercase tracking-wider text-[var(--brand-primary)]">ProCV</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Chính sách cookie</h1>
        <p className="mt-3 text-sm text-slate-500">Phiên bản 1 · Cập nhật ngày 14/07/2026</p>

        <div className="mt-8 space-y-7 text-sm leading-6 text-slate-700">
          <section>
            <h2 className="text-lg font-bold text-slate-900">Cookie là gì?</h2>
            <p className="mt-2">Cookie và browser storage là các dữ liệu nhỏ giúp ProCV vận hành ổn định, ghi nhớ lựa chọn của bạn và – khi bạn cho phép – đo lường hiệu quả sản phẩm.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-slate-900">Các loại dữ liệu chúng tôi sử dụng</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[680px] w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-100 text-slate-700"><tr>{['Tên', 'Cơ chế', 'Mục đích', 'Nhóm', 'Thời hạn'].map((label) => <th key={label} className="px-3 py-3 font-bold">{label}</th>)}</tr></thead>
                <tbody>{COOKIE_ROWS.map((row) => <tr key={row[0]} className="border-t border-slate-200">{row.map((cell) => <td key={cell} className="px-3 py-3 align-top">{cell}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </section>
          <section>
            <h2 className="text-lg font-bold text-slate-900">Lượt xem tin tuyển dụng</h2>
            <p className="mt-2">Khi bạn bật cookie hiệu năng, ProCV có thể tạo một mã ngẫu nhiên không chứa email, tên hoặc nội dung hồ sơ. Mã này giúp giới hạn một lượt xem cho mỗi tin trong 24 giờ, nhằm giảm số liệu trùng lặp.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-slate-900">Thay đổi lựa chọn</h2>
            <p className="mt-2">Bạn có thể mở <span className="font-semibold">Cài đặt cookie</span> ở chân trang bất cứ lúc nào để bật, tắt hoặc rút lại sự đồng ý. Việc tắt nhóm hiệu năng sẽ xóa mã định danh lượt xem của trình duyệt.</p>
          </section>
        </div>
        <Link to="/" className="mt-9 inline-flex font-semibold text-[var(--brand-primary)] hover:underline">← Quay về trang chủ</Link>
      </article>
    </div>
  )
}
