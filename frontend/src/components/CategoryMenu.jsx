import { RightOutlined } from '@ant-design/icons'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function CategoryMenu({ categories, banner }) {
  const navigate = useNavigate()
  const { parents, childrenByParent } = useMemo(() => {
    const parents = []
    const childrenByParent = {}
    for (const c of categories) {
      if (c.parent == null) parents.push(c)
      else (childrenByParent[c.parent] ||= []).push(c)
    }
    return { parents, childrenByParent }
  }, [categories])

  const [activeId, setActiveId] = useState(null)
  const activeParent = parents.find((p) => p.id === activeId)
  const children = activeId != null ? childrenByParent[activeId] || [] : []
  const go = (id) => navigate(`/jobs?category=${id}`)

  if (parents.length === 0) return banner || null

  return (
    <div
      className="flex bg-white rounded-lg border border-gray-200 overflow-hidden min-h-[320px]"
      onMouseLeave={() => setActiveId(null)}
    >
      <ul className="w-full md:w-72 py-2 shrink-0 border-r border-gray-100">
        {parents.map((p) => (
          <li key={p.id}>
            <button
              onMouseEnter={() => setActiveId(p.id)}
              onClick={() => go(p.id)}
              className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-left cursor-pointer transition ${
                activeId === p.id
                  ? 'bg-green-50 text-[#00b14f] font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="truncate">{p.name}</span>
              <RightOutlined className="text-[10px] shrink-0" />
            </button>
          </li>
        ))}
      </ul>

      <div className="hidden md:block flex-1 p-5">
        {activeId != null ? (
          <>
            <p className="text-sm font-semibold text-[#00b14f] mb-3">{activeParent?.name}</p>
            <div className="flex flex-wrap gap-2">
              {children.map((c) => (
                <button
                  key={c.id}
                  onClick={() => go(c.id)}
                  className="px-3 py-1.5 text-sm text-gray-700 bg-gray-50 rounded-full cursor-pointer hover:bg-green-50 hover:text-[#00b14f] transition"
                >
                  {c.name}
                </button>
              ))}
              {children.length === 0 && (
                <span className="text-sm text-gray-400">Chưa có danh mục con.</span>
              )}
            </div>
          </>
        ) : (
          banner
        )}
      </div>
    </div>
  )
}
