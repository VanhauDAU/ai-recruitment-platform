import { SearchOutlined } from '@ant-design/icons'

// Chèn giữa danh sách kết quả (kiểu TopCV "Ứng viên cũng tìm kiếm"): các từ
// khóa cùng nhánh nghề với danh mục đang lọc; bấm là chạy tìm kiếm ngay.
export default function RelatedSearchesCard({ terms, onSelect }) {
  if (!terms.length) return null
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-bold text-gray-800">Ứng viên ProCV cũng tìm kiếm</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {terms.map((term) => (
          <button
            key={term}
            type="button"
            onClick={() => onSelect(term)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3.5 py-1.5 text-sm text-gray-700 transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
          >
            <SearchOutlined className="text-xs" />
            {term.toLowerCase()}
          </button>
        ))}
      </div>
    </div>
  )
}
