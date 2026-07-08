import { RightOutlined } from '@ant-design/icons'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ArrowButton from '../ui/ArrowButton'

const GROUPS_PER_PAGE = 6

export default function CategoryMenu({ categories, banner }) {
  const navigate = useNavigate()
  const { parents, childrenOf } = useMemo(() => {
    const childrenOf = {}
    for (const c of categories) (childrenOf[c.parent ?? 'root'] ||= []).push(c)
    return { parents: childrenOf.root || [], childrenOf }
  }, [categories])

  const [activeId, setActiveId] = useState(null)
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(parents.length / GROUPS_PER_PAGE)
  const pageParents = parents.slice(page * GROUPS_PER_PAGE, page * GROUPS_PER_PAGE + GROUPS_PER_PAGE)
  const jobs = activeId != null ? childrenOf[activeId] || [] : []
  const go = (id) => navigate(`/viec-lam?cat=${id}`)

  function changePage(next) {
    setPage(next)
    setActiveId(null)
  }

  if (parents.length === 0) return banner || null

  return (
    <div
      className="flex bg-white rounded-lg border border-gray-200 overflow-hidden min-h-[360px]"
      onMouseLeave={() => setActiveId(null)}
    >
      {/* Cột 1: NHÓM NGHỀ */}
      <div className="w-full md:w-64 shrink-0 border-r border-gray-100 flex flex-col">
        <ul className="flex-1 py-2">
          {pageParents.map((p) => (
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

        {totalPages > 1 && (
          <div className="flex items-center px-4 py-3 border-t border-gray-100">
            <span className="text-sm font-medium text-gray-500">
              <span className="text-[#00b14f]">{page + 1}</span>/{totalPages}
            </span>
            <div className="ml-auto flex gap-2">
              <ArrowButton dir="left" disabled={page === 0} onClick={() => changePage(page - 1)} />
              <ArrowButton dir="right" disabled={page === totalPages - 1} onClick={() => changePage(page + 1)} />
            </div>
          </div>
        )}
      </div>

      {/* Cột 2 + 3: NGHỀ | VỊ TRÍ CHUYÊN MÔN (hiện khi hover nhóm nghề) */}
      <div className="hidden md:flex flex-1 flex-col">
        {activeId != null ? (
          <>
            <div className="grid grid-cols-[200px_1fr] gap-3 px-5 pt-4 pb-2 text-xs font-semibold text-gray-400 tracking-wide border-b border-gray-50">
              <span>NGHỀ</span>
              <span>VỊ TRÍ CHUYÊN MÔN</span>
            </div>
            {jobs.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-400">Chưa có danh mục con.</p>
            ) : (
              <div className="overflow-auto max-h-[320px] divide-y divide-gray-50">
                {jobs.map((j) => (
                  <div key={j.id} className="grid grid-cols-[200px_1fr] gap-3 px-5 py-3">
                    <button
                      onClick={() => go(j.id)}
                      className="text-left text-sm font-medium text-gray-800 hover:text-[#00b14f] cursor-pointer"
                    >
                      {j.name}
                    </button>
                    <div className="flex flex-wrap gap-2 content-start">
                      {(childrenOf[j.id] || []).map((p) => (
                        <button
                          key={p.id}
                          onClick={() => go(p.id)}
                          className="px-3 py-1 text-sm text-gray-600 bg-gray-50 rounded-full cursor-pointer hover:bg-green-50 hover:text-[#00b14f] transition"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 p-3">{banner}</div>
        )}
      </div>
    </div>
  )
}
