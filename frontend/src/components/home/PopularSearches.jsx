import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getLinkGroups } from '../../api/siteService'

// Render Link nếu có url thật, ngược lại là span dạng link (tính năng sắp ra mắt).
function Item({ url, children }) {
  const cls = 'text-gray-600 hover:text-[#00b14f] transition-colors'
  return url ? (
    <Link to={url} className={cls}>{children}</Link>
  ) : (
    <span className={`${cls} cursor-not-allowed`} title="Sắp ra mắt">{children}</span>
  )
}

function Group({ title, items }) {
  if (!items?.length) return null
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-800">{title}</h3>
      <div className="flex flex-wrap gap-x-1 gap-y-1.5 text-sm leading-relaxed">
        {items.map((it, i) => (
          <span key={`${it.label}-${i}`} className="inline-flex items-center">
            <Item url={it.url}>{it.label}</Item>
            {i < items.length - 1 && <span className="ml-1 text-gray-300">·</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function PopularSearches() {
  const [groups, setGroups] = useState([])

  useEffect(() => {
    getLinkGroups('footer_seo').then(setGroups).catch(() => {})
  }, [])

  if (!groups.length) return null

  return (
    <section className="border-t border-gray-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {groups.map((g) => (
          <Group key={g.key} title={g.title} items={g.items} />
        ))}
      </div>
    </section>
  )
}
