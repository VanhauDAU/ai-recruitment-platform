import { EnvironmentOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Checkbox, Input, Popover, Skeleton } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getProvinces, getWards } from '../api/locationService'

// Selection model: draft[provinceId] = 'ALL' | number[] (specific ward ids).
// Applied value is a flat list of ids — a province id means "all wards of it"
// (the API expands that), a ward id means that single ward.
export default function LocationFilter({ value = [], onChange }) {
  const [open, setOpen] = useState(false)
  const [provinces, setProvinces] = useState([])
  const [wardsCache, setWardsCache] = useState({})
  const [activeId, setActiveId] = useState(null)
  const [loadingWards, setLoadingWards] = useState(false)
  const [draft, setDraft] = useState({})
  const [loose, setLoose] = useState([]) // ward ids from `value` not yet mapped to a province
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

  // Rebuild draft from the applied value whenever the panel opens.
  useEffect(() => {
    if (!open || provinces.length === 0) return
    const nextDraft = {}
    const nextLoose = []
    for (const id of value) {
      if (provinceIds.current.has(id)) nextDraft[id] = 'ALL'
      else nextLoose.push(id)
    }
    setDraft(nextDraft)
    setLoose(nextLoose)
  }, [open, provinces]) // eslint-disable-line react-hooks/exhaustive-deps

  async function openProvince(pid) {
    setActiveId(pid)
    setWardQuery('')
    if (wardsCache[pid]) return
    setLoadingWards(true)
    try {
      const wards = await getWards(pid)
      setWardsCache((prev) => ({ ...prev, [pid]: wards }))
      // Fold any loose ward ids that belong to this province into the draft.
      setLoose((prevLoose) => {
        const ids = wards.map((w) => w.id)
        const belong = prevLoose.filter((id) => ids.includes(id))
        if (belong.length) {
          setDraft((prev) => ({
            ...prev,
            [pid]: belong.length === ids.length ? 'ALL' : belong,
          }))
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

  function clearAll() {
    setDraft({})
    setLoose([])
  }

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
    <div className="w-[560px] max-w-[90vw]">
      <div className="grid grid-cols-2 divide-x divide-gray-100">
        {/* Provinces */}
        <div className="pr-3">
          <Input
            size="small"
            allowClear
            placeholder="Nhập Tỉnh/Thành phố"
            prefix={<SearchOutlined className="text-gray-400" />}
            value={provinceQuery}
            onChange={(e) => setProvinceQuery(e.target.value)}
            className="mb-2"
          />
          <ul className="h-64 overflow-auto pr-1">
            {filteredProvinces.map((p) => {
              const d = draft[p.id]
              return (
                <li
                  key={p.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm ${
                    activeId === p.id ? 'bg-green-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => openProvince(p.id)}
                >
                  <Checkbox
                    checked={d === 'ALL'}
                    indeterminate={Array.isArray(d) && d.length > 0}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleProvince(p.id)}
                  />
                  <span className="flex-1 truncate">{p.name}</span>
                  {wardsCache[p.id] && (
                    <span className="text-xs text-gray-400">{wardsCache[p.id].length}</span>
                  )}
                  <RightOutlined className="text-[10px] text-gray-300" />
                </li>
              )
            })}
          </ul>
        </div>

        {/* Wards of the active province */}
        <div className="pl-3">
          <Input
            size="small"
            allowClear
            placeholder="Nhập Phường/Xã"
            prefix={<SearchOutlined className="text-gray-400" />}
            value={wardQuery}
            onChange={(e) => setWardQuery(e.target.value)}
            className="mb-2"
            disabled={!activeId}
          />
          <ul className="h-64 overflow-auto pr-1">
            {!activeId ? (
              <li className="text-sm text-gray-400 px-2 py-1.5">Chọn Tỉnh/Thành để xem Phường/Xã</li>
            ) : loadingWards ? (
              <li className="px-2"><Skeleton active paragraph={{ rows: 6 }} title={false} /></li>
            ) : (
              <>
                <li className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 text-sm font-medium">
                  <Checkbox
                    checked={allWardsChecked}
                    indeterminate={someWardsChecked}
                    onChange={() => toggleProvince(activeId)}
                  />
                  <span>Tất cả</span>
                </li>
                {activeWards.map((w) => (
                  <li key={w.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 text-sm">
                    <Checkbox
                      checked={allWardsChecked || (Array.isArray(activeDraft) && activeDraft.includes(w.id))}
                      onChange={() => toggleWard(activeId, w.id)}
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
        <Button type="link" className="!px-0" onClick={clearAll} disabled={selectedCount === 0}>
          Bỏ chọn tất cả
        </Button>
        <div className="flex items-center gap-3">
          {selectedCount > 0 && <span className="text-sm text-gray-500">Đã chọn {selectedCount}</span>}
          <Button type="primary" onClick={apply}>Áp dụng</Button>
        </div>
      </div>
    </div>
  )

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomLeft"
      content={panel}
    >
      <button className="w-full flex items-center gap-2 border border-gray-300 rounded-lg px-3 h-8 text-sm text-left hover:border-[#00b14f] transition">
        <EnvironmentOutlined className="text-gray-400" />
        <span className={`flex-1 truncate ${value.length ? 'text-gray-800' : 'text-gray-400'}`}>
          {value.length ? `Đã chọn ${value.length} địa điểm` : 'Tất cả địa điểm'}
        </span>
      </button>
    </Popover>
  )
}
