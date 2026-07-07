import { EnvironmentOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Checkbox, Input, Popover, Skeleton } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getProvinces, getWards } from '../api/locationService'

// Selection model: draft[provinceId] = 'ALL' | number[] (specific ward ids).
// Applied value (props.value) is a flat id list — a province id means the whole
// province, a ward id means that single ward. Regrouping ids back into draft
// uses provinces + wardsCache (kept across open/close so re-opening restores checkboxes).
export default function LocationFilter({ value = [], onChange, size = 'middle' }) {
  const [open, setOpen] = useState(false)
  const [provinces, setProvinces] = useState([])
  const [wardsCache, setWardsCache] = useState({})
  const [activeId, setActiveId] = useState(null)
  const [loadingWards, setLoadingWards] = useState(false)
  const [draft, setDraft] = useState({})
  const [loose, setLoose] = useState([]) // ward ids whose province is not in wardsCache yet
  const [provinceQuery, setProvinceQuery] = useState('')
  const [wardQuery, setWardQuery] = useState('')
  const provinceIds = useRef(new Set())

  useEffect(() => {
    getProvinces()
      .then((data) => {
        setProvinces(data)
        provinceIds.current = new Set(data.map((p) => p.id))
      })
      .catch(() => {})
  }, [])

  function groupValue(ids) {
    const draft = {}
    const loose = []
    for (const id of ids) {
      if (provinceIds.current.has(id)) {
        draft[id] = 'ALL'
      } else {
        const pid = Object.keys(wardsCache).find((p) => wardsCache[p].some((w) => w.id === id))
        if (pid && draft[pid] !== 'ALL') (draft[pid] ||= []).push(id)
        else if (!pid) loose.push(id)
      }
    }
    return { draft, loose }
  }

  // Rebuild draft from the applied value whenever the panel opens.
  useEffect(() => {
    if (!open || provinces.length === 0) return
    const grouped = groupValue(value)
    setDraft(grouped.draft)
    setLoose(grouped.loose)
  }, [open, provinces]) // eslint-disable-line react-hooks/exhaustive-deps

  async function openProvince(pid) {
    setActiveId(pid)
    setWardQuery('')
    if (wardsCache[pid]) return
    setLoadingWards(true)
    try {
      const wards = await getWards(pid)
      setWardsCache((prev) => ({ ...prev, [pid]: wards }))
      // Fold loose ward ids belonging to this province into the draft.
      setLoose((prevLoose) => {
        const ids = wards.map((w) => w.id)
        const belong = prevLoose.filter((id) => ids.includes(id))
        if (belong.length) {
          setDraft((prev) => ({ ...prev, [pid]: belong.length === ids.length ? 'ALL' : belong }))
        }
        return prevLoose.filter((id) => !ids.includes(id))
      })
    } finally {
      setLoadingWards(false)
    }
  }

  function toggleProvince(pid) {
    setDraft((prev) => {
      const next = { ...prev }
      if (next[pid]) delete next[pid]
      else next[pid] = 'ALL'
      return next
    })
  }

  function toggleWard(pid, wid) {
    const all = (wardsCache[pid] || []).map((w) => w.id)
    setDraft((prev) => {
      const current = prev[pid]
      const set = new Set(current === 'ALL' ? all : Array.isArray(current) ? current : [])
      if (set.has(wid)) set.delete(wid)
      else set.add(wid)
      const next = { ...prev }
      if (set.size === 0) delete next[pid]
      else if (set.size === all.length) next[pid] = 'ALL'
      else next[pid] = [...set]
      return next
    })
  }

  const selectedCount = useMemo(
    () => Object.values(draft).reduce((n, v) => n + (v === 'ALL' ? 1 : v.length), 0) + loose.length,
    [draft, loose],
  )

  function apply() {
    const ids = [...loose]
    for (const [pid, v] of Object.entries(draft)) {
      if (v === 'ALL') ids.push(Number(pid))
      else ids.push(...v)
    }
    onChange(ids)
    setOpen(false)
  }

  // Trigger label: "Hà Nội (Tất cả)", "Hà Nội (3 phường/xã)", plus "+n" for extra provinces.
  const shortName = (name) => name.replace(/^Thành phố |^Tỉnh /, '')
  const triggerLabel = useMemo(() => {
    if (!value.length) return null
    if (provinces.length === 0) return `Đã chọn ${value.length} địa điểm`
    const grouped = groupValue(value)
    const pids = Object.keys(grouped.draft)
    if (!pids.length) return `Đã chọn ${value.length} địa điểm`
    const first = provinces.find((p) => p.id === Number(pids[0]))
    const d = grouped.draft[pids[0]]
    const detail = d === 'ALL' ? 'Tất cả' : `${d.length} phường/xã`
    const others = pids.length - 1 + (grouped.loose.length ? 1 : 0)
    return `${shortName(first.name)} (${detail})${others > 0 ? ` +${others}` : ''}`
  }, [value, provinces, wardsCache]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredProvinces = provinces.filter((p) =>
    p.name.toLowerCase().includes(provinceQuery.trim().toLowerCase()),
  )
  const activeWards = (wardsCache[activeId] || []).filter((w) =>
    w.name.toLowerCase().includes(wardQuery.trim().toLowerCase()),
  )
  const activeDraft = draft[activeId]
  const allWardsChecked = activeDraft === 'ALL'
  const someWardsChecked = Array.isArray(activeDraft) && activeDraft.length > 0

  const panel = (
    <div className="w-[640px] max-w-[92vw]">
      <div className="grid grid-cols-2 divide-x divide-gray-100">
        {/* Provinces */}
        <div className="pr-3">
          <Input
            allowClear
            placeholder="Nhập Tỉnh/Thành phố"
            prefix={<SearchOutlined className="text-gray-400" />}
            value={provinceQuery}
            onChange={(e) => setProvinceQuery(e.target.value)}
            className="mb-2"
          />
          <ul className="h-80 overflow-auto pr-1">
            {filteredProvinces.map((p) => {
              const d = draft[p.id]
              return (
                <li
                  key={p.id}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded cursor-pointer ${
                    activeId === p.id ? 'bg-green-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    toggleProvince(p.id)
                    openProvince(p.id)
                  }}
                >
                  <Checkbox
                    className="pointer-events-none"
                    checked={d === 'ALL'}
                    indeterminate={Array.isArray(d) && d.length > 0}
                  />
                  <span className="flex-1 truncate">{p.name}</span>
                  <RightOutlined
                    className="text-[10px] text-gray-300 p-1 -m-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      openProvince(p.id)
                    }}
                  />
                </li>
              )
            })}
          </ul>
        </div>

        {/* Wards of the active province */}
        <div className="pl-3">
          <Input
            allowClear
            placeholder="Nhập Phường/Xã"
            prefix={<SearchOutlined className="text-gray-400" />}
            value={wardQuery}
            onChange={(e) => setWardQuery(e.target.value)}
            className="mb-2"
            disabled={!activeId}
          />
          <ul className="h-80 overflow-auto pr-1">
            {!activeId ? (
              <li className="text-gray-400 px-3 py-2">Chọn Tỉnh/Thành để xem Phường/Xã</li>
            ) : loadingWards ? (
              <li className="px-3"><Skeleton active paragraph={{ rows: 7 }} title={false} /></li>
            ) : (
              <>
                <li
                  className="flex items-center gap-2.5 px-3 py-2 rounded cursor-pointer hover:bg-gray-50 font-medium"
                  onClick={() => toggleProvince(activeId)}
                >
                  <Checkbox
                    className="pointer-events-none"
                    checked={allWardsChecked}
                    indeterminate={someWardsChecked}
                  />
                  <span>Tất cả</span>
                </li>
                {activeWards.map((w) => (
                  <li
                    key={w.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleWard(activeId, w.id)}
                  >
                    <Checkbox
                      className="pointer-events-none"
                      checked={allWardsChecked || (Array.isArray(activeDraft) && activeDraft.includes(w.id))}
                    />
                    <span className="truncate">{w.name}</span>
                  </li>
                ))}
              </>
            )}
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <Button type="link" className="!px-0" onClick={() => { setDraft({}); setLoose([]) }} disabled={selectedCount === 0}>
          Bỏ chọn tất cả
        </Button>
        <div className="flex items-center gap-3">
          {selectedCount > 0 && <span className="text-gray-500">Đã chọn {selectedCount}</span>}
          <Button type="primary" onClick={apply}>Áp dụng</Button>
        </div>
      </div>
    </div>
  )

  return (
    <Popover open={open} onOpenChange={setOpen} trigger="click" placement="bottomLeft" content={panel}>
      <button
        className={`w-full flex items-center gap-2 border border-gray-300 rounded-lg px-3 text-left bg-white cursor-pointer hover:border-[#00b14f] transition ${
          size === 'large' ? 'h-10 text-base' : 'h-8 text-sm'
        }`}
      >
        <EnvironmentOutlined className="text-gray-400" />
        <span className={`flex-1 truncate ${triggerLabel ? 'text-gray-800' : 'text-gray-400'}`}>
          {triggerLabel || 'Tất cả địa điểm'}
        </span>
        <RightOutlined className="text-[10px] text-gray-300 rotate-90" />
      </button>
    </Popover>
  )
}
