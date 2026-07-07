import { DownOutlined, LeftOutlined, RightOutlined, SearchOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { Button, Checkbox, Input, Modal } from 'antd'
import { useMemo, useState } from 'react'

// 3-level taxonomy picker: nhóm nghề -> nghề -> vị trí chuyên môn.
// props.value = applied category ids (any level). Internal draft = Set of LEAF ids;
// apply() reduces back to the shortest id list (whole group/nghề when fully selected).
export default function CategoryPicker({ categories, value = [], onChange }) {
  const { groups, childrenOf, leavesUnder } = useMemo(() => {
    const childrenOf = {}
    for (const c of categories) (childrenOf[c.parent ?? 'root'] ||= []).push(c)
    const leavesUnder = (id) =>
      childrenOf[id]?.length ? childrenOf[id].flatMap((c) => leavesUnder(c.id)) : [id]
    return { groups: childrenOf.root || [], childrenOf, leavesUnder }
  }, [categories])

  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState(new Set())
  const [activeId, setActiveId] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false) // mobile drill-down
  const [query, setQuery] = useState('')

  const appliedLeaves = useMemo(
    () => new Set(value.flatMap((id) => leavesUnder(id))),
    [value, leavesUnder],
  )

  function openModal() {
    setSel(new Set(appliedLeaves))
    setActiveId((prev) => prev ?? groups[0]?.id)
    setDetailOpen(false)
    setQuery('')
    setOpen(true)
  }

  const checkState = (id) => {
    const leaves = leavesUnder(id)
    const n = leaves.filter((l) => sel.has(l)).length
    return { checked: n > 0 && n === leaves.length, indeterminate: n > 0 && n < leaves.length }
  }

  function toggle(id) {
    const leaves = leavesUnder(id)
    const all = leaves.every((l) => sel.has(l))
    setSel((prev) => {
      const next = new Set(prev)
      leaves.forEach((l) => (all ? next.delete(l) : next.add(l)))
      return next
    })
  }

  function apply() {
    const ids = []
    for (const g of groups) {
      const gLeaves = leavesUnder(g.id)
      if (gLeaves.every((l) => sel.has(l))) {
        if (gLeaves.length) ids.push(g.id)
        continue
      }
      for (const n of childrenOf[g.id] || []) {
        const nLeaves = leavesUnder(n.id)
        if (nLeaves.every((l) => sel.has(l))) ids.push(n.id)
        else nLeaves.forEach((l) => sel.has(l) && ids.push(l))
      }
    }
    onChange(ids)
    setOpen(false)
  }

  const q = query.trim().toLowerCase()
  const match = (c) => c.name.toLowerCase().includes(q)
  const matchesDeep = (c) => match(c) || (childrenOf[c.id] || []).some(matchesDeep)
  const visibleGroups = q ? groups.filter(matchesDeep) : groups
  const activeGroup = groups.find((g) => g.id === activeId) || visibleGroups[0]
  const visibleJobs = (childrenOf[activeGroup?.id] || []).filter((n) => !q || matchesDeep(n))

  return (
    <>
      <button
        onClick={openModal}
        className="w-full h-10 flex items-center gap-2 border border-gray-300 rounded-lg px-3 bg-white text-left cursor-pointer hover:border-[#00b14f] transition"
      >
        <UnorderedListOutlined className="text-[#00b14f]" />
        <span className="flex-1 truncate text-[#00b14f] font-medium">
          Danh mục Nghề{appliedLeaves.size > 0 && ` (${appliedLeaves.size})`}
        </span>
        <DownOutlined className="text-xs text-gray-400" />
      </button>

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={880}
        styles={{ body: { maxWidth: '100%' } }}
        title="Chọn Nhóm nghề, Nghề hoặc Vị trí chuyên môn"
      >
        <Input
          allowClear
          placeholder="Nhập từ khóa tìm kiếm"
          prefix={<SearchOutlined className="text-gray-400" />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="my-3"
        />
        <div className="md:grid md:grid-cols-[280px_1fr] border border-gray-100 rounded-lg overflow-hidden">
          {/* Cột NHÓM NGHỀ — trên mobile ẩn khi đã mở chi tiết */}
          <div className={`border-r border-gray-100 ${detailOpen ? 'hidden md:block' : 'block'}`}>
            <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 tracking-wide">NHÓM NGHỀ</p>
            <ul className="h-80 md:h-96 overflow-auto">
              {visibleGroups.map((g) => {
                const st = checkState(g.id)
                return (
                  <li
                    key={g.id}
                    onMouseEnter={() => setActiveId(g.id)}
                    onClick={() => { setActiveId(g.id); setDetailOpen(true) }}
                    className={`flex items-center gap-2.5 px-4 py-2.5 cursor-pointer ${
                      activeGroup?.id === g.id ? 'bg-green-50 text-[#00b14f] font-medium' : 'hover:bg-gray-50'
                    }`}
                  >
                    <Checkbox
                      checked={st.checked}
                      indeterminate={st.indeterminate}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggle(g.id)}
                    />
                    <span className="flex-1">{g.name}</span>
                    <RightOutlined className="text-[10px] text-gray-300" />
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Cột NGHỀ | VỊ TRÍ — trên mobile ẩn cho tới khi chọn nhóm */}
          <div className={`${detailOpen ? 'block' : 'hidden'} md:block`}>
            <button
              onClick={() => setDetailOpen(false)}
              className="md:hidden flex items-center gap-1.5 px-4 py-2 text-sm text-[#00b14f] cursor-pointer"
            >
              <LeftOutlined className="text-xs" /> Nhóm nghề
            </button>
            <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] px-4 pt-2 md:pt-3 pb-1 text-xs font-semibold text-gray-400 tracking-wide">
              <span>NGHỀ</span><span className="hidden md:block">VỊ TRÍ CHUYÊN MÔN</span>
            </div>
            <div className="h-80 md:h-96 overflow-auto divide-y divide-gray-50">
              {visibleJobs.map((n) => {
                const st = checkState(n.id)
                return (
                  <div key={n.id} className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-2 md:gap-3 px-4 py-3">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <Checkbox
                        checked={st.checked}
                        indeterminate={st.indeterminate}
                        onChange={() => toggle(n.id)}
                      />
                      <span className={st.checked || st.indeterminate ? 'text-[#00b14f] font-medium' : ''}>
                        {n.name}
                      </span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(childrenOf[n.id] || [])
                        .filter((p) => !q || match(p) || matchesDeep(n))
                        .map((p) => (
                          <button
                            key={p.id}
                            onClick={() => toggle(p.id)}
                            className={`px-3 py-1 rounded-full text-sm cursor-pointer transition ${
                              sel.has(p.id)
                                ? 'bg-[#00b14f] text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-green-50 hover:text-[#00b14f]'
                            }`}
                          >
                            {p.name}
                          </button>
                        ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <Button type="link" className="!px-0" disabled={sel.size === 0} onClick={() => setSel(new Set())}>
            Bỏ chọn tất cả{sel.size > 0 && ` (${sel.size})`}
          </Button>
          <div className="flex gap-2">
            <Button onClick={() => setOpen(false)}>Hủy</Button>
            <Button type="primary" onClick={apply}>Chọn</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
