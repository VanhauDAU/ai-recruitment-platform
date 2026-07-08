import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJobCategories } from '../../api/jobService'
import { getProvinces } from '../../api/locationService'

// Placeholder groups — chưa có trang thật, link tạm về '#' (title "Sắp ra mắt").
const CV_TEMPLATES = [
  'Mẫu CV', 'Mẫu CV tiếng Anh', 'Mẫu CV IT', 'Mẫu CV Kế toán',
  'Mẫu CV Marketing', 'CV là gì?', 'Cách viết CV xin việc', 'Mẫu Cover Letter',
]
const TOOLS = [
  'Tính lương Gross - Net', 'Tính thuế thu nhập cá nhân', 'Trắc nghiệm tính cách MBTI',
  'Tra cứu mức lương', 'Cẩm nang ngành CNTT', 'Cẩm nang ngành Logistics', 'Cẩm nang ngành Du lịch',
]

// Render Link nếu có `to`, ngược lại là span dạng link (tính năng sắp ra mắt).
function Item({ to, children }) {
  const cls = 'text-gray-600 hover:text-[#00b14f] transition-colors'
  return to ? (
    <Link to={to} className={cls}>{children}</Link>
  ) : (
    <span className={`${cls} cursor-not-allowed`} title="Sắp ra mắt">{children}</span>
  )
}

function Group({ title, items }) {
  if (!items.length) return null
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-800">{title}</h3>
      <div className="flex flex-wrap gap-x-1 gap-y-1.5 text-sm leading-relaxed">
        {items.map((it, i) => (
          <span key={it.label} className="inline-flex items-center">
            <Item to={it.to}>{it.label}</Item>
            {i < items.length - 1 && <span className="ml-1 text-gray-300">·</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function PopularSearches() {
  const [provinces, setProvinces] = useState([])
  const [categories, setCategories] = useState([])

  useEffect(() => {
    getProvinces().then((d) => setProvinces((d || []).slice(0, 16))).catch(() => {})
    getJobCategories().then((d) => setCategories((d || []).slice(0, 16))).catch(() => {})
  }, [])

  const shortName = (n) => n.replace(/^(Thành phố|Tỉnh)\s+/i, '')
  const locationItems = provinces.map((p) => ({ label: `Việc làm ${shortName(p.name)}`, to: `/jobs?location=${p.id}` }))
  const categoryItems = categories.map((c) => ({ label: `Việc làm ${c.name}`, to: `/jobs?category=${c.id}` }))
  const cvItems = CV_TEMPLATES.map((label) => ({ label }))
  const toolItems = TOOLS.map((label) => ({ label }))

  return (
    <section className="border-t border-gray-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <Group title="Việc làm theo khu vực" items={locationItems} />
        <Group title="Việc làm theo ngành nghề" items={categoryItems} />
        <Group title="Mẫu CV & Cẩm nang" items={cvItems} />
        <Group title="Công cụ & Tra cứu" items={toolItems} />
      </div>
    </section>
  )
}
