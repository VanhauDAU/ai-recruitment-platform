import { CloseCircleFilled, DownOutlined, RightOutlined, SearchOutlined, UnorderedListOutlined, UpOutlined } from '@ant-design/icons'
import { Button, Checkbox, Input } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import {
  buildJobPreferenceTaxonomy,
  MAX_DESIRED_SPECIALIZATIONS,
  selectionState,
} from '../model/specialization-limit'

function normalize(value) {
  return String(value || '').toLocaleLowerCase('vi-VN')
}

export default function JobSpecializationPicker({ categories, disabled, onChange, value = [] }) {
  const taxonomy = useMemo(() => buildJobPreferenceTaxonomy(categories), [categories])
  const [open, setOpen] = useState(false)
  const [activeGroupId, setActiveGroupId] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [query, setQuery] = useState('')

  const selectedSet = useMemo(() => new Set(value), [value])
  const selectedSpecializations = categories.filter(
    (category) => category.category_type === 'specialization' && selectedSet.has(category.id),
  )
  const normalizedQuery = normalize(query.trim())
  const matchesDeep = (category) => normalize(category.name).includes(normalizedQuery)
    || (taxonomy.childrenByParent.get(category.id) || []).some(matchesDeep)
  const visibleGroups = normalizedQuery
    ? taxonomy.groups.filter(matchesDeep)
    : taxonomy.groups
  const activeGroup = visibleGroups.find((group) => group.id === activeGroupId) || visibleGroups[0]
  const jobs = (taxonomy.childrenByParent.get(activeGroup?.id) || []).filter(
    (job) => !normalizedQuery || matchesDeep(job),
  )

  useEffect(() => {
    if (!open) return
    setSelectedIds(new Set(value))
    setActiveGroupId(taxonomy.groups[0]?.id ?? null)
    setQuery('')
  }, [open, taxonomy.groups, value])

  function canSelect(ids) {
    const nextIds = new Set(selectedIds)
    ids.forEach((id) => nextIds.add(id))
    return nextIds.size <= MAX_DESIRED_SPECIALIZATIONS
  }

  function toggleSpecializations(ids) {
    if (!ids.length) return
    setSelectedIds((current) => {
      const allSelected = ids.every((id) => current.has(id))
      const next = new Set(current)
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)))
      if (!allSelected && next.size > MAX_DESIRED_SPECIALIZATIONS) return current
      return next
    })
  }

  function apply() {
    onChange?.([...selectedIds])
    setOpen(false)
  }

  return (
    <div className="relative">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Chọn danh mục vị trí chuyên môn"
        aria-expanded={open}
        onClick={() => !disabled && setOpen(true)}
        onKeyDown={(event) => {
          if (!disabled && (event.key === 'Enter' || event.key === ' ')) setOpen(true)
        }}
        className="flex min-h-12 w-full cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-left text-sm transition hover:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:bg-slate-50"
      >
        <UnorderedListOutlined className="shrink-0 text-[var(--brand-primary)]" />
        {selectedSpecializations.length ? (
          <div className="flex flex-1 flex-wrap gap-1.5">
            {selectedSpecializations.map((specialization) => (
              <span key={specialization.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                {specialization.name}
                <button
                  type="button"
                  aria-label={`Bỏ chọn ${specialization.name}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onChange?.(value.filter((id) => id !== specialization.id))
                  }}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <CloseCircleFilled />
                </button>
              </span>
            ))}
          </div>
        ) : <span className="flex-1 text-slate-400">Chọn vị trí chuyên môn từ danh mục</span>}
        {selectedSet.size > 0 && (
          <button
            type="button"
            aria-label="Xóa vị trí chuyên môn đã chọn"
            onClick={(event) => {
              event.stopPropagation()
              onChange?.([])
            }}
            className="shrink-0 text-slate-400 hover:text-red-500"
          >
            <CloseCircleFilled />
          </button>
        )}
        {open ? <UpOutlined className="shrink-0 text-xs text-slate-500" /> : <DownOutlined className="shrink-0 text-xs text-slate-400" />}
      </div>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-3 w-full overflow-hidden rounded-[22px] border border-slate-100 bg-white shadow-2xl shadow-slate-900/15">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
            <h2 className="text-base font-bold text-slate-700">Chọn Vị trí chuyên môn</h2>
            <button type="button" aria-label="Đóng danh mục vị trí chuyên môn" onClick={() => setOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><CloseCircleFilled /></button>
          </div>
          <div className="px-4 pb-3 pt-2 sm:px-5">
            <Input allowClear value={query} onChange={(event) => setQuery(event.target.value)} prefix={<SearchOutlined className="text-slate-400" />} placeholder="Nhập từ khoá để tìm Vị trí chuyên môn" className="!h-9 !rounded-full" />
          </div>
          <div className="grid grid-cols-[minmax(180px,30%)_1fr] border-y border-slate-100">
            <div className="border-r border-slate-100">
              <p className="px-4 pb-2 pt-3 text-xs font-semibold tracking-wide text-slate-400">NHÓM NGHỀ</p>
              <ul className="max-h-72 overflow-auto">
                {visibleGroups.map((group) => {
                  const ids = taxonomy.specializationsUnder(group.id)
                  const state = selectionState(ids, selectedIds)
                  const disabledGroup = !state.checked && !canSelect(ids)
                  return (
                    <li key={group.id} onMouseEnter={() => setActiveGroupId(group.id)} className={`flex cursor-pointer items-center gap-2.5 px-4 py-2.5 ${activeGroup?.id === group.id ? 'bg-emerald-50 font-medium text-[var(--brand-primary)]' : 'hover:bg-slate-50'}`}>
                      <Checkbox checked={state.checked} indeterminate={state.indeterminate} disabled={disabledGroup} onChange={() => toggleSpecializations(ids)} />
                      <span className="flex-1">{group.name}</span>
                      <RightOutlined className="text-[10px] text-slate-400" />
                    </li>
                  )
                })}
              </ul>
            </div>
            <div>
              <div className="grid grid-cols-[minmax(180px,35%)_1fr] gap-3 px-4 pb-2 pt-3 text-xs font-semibold tracking-wide text-slate-400">
                <span>NGHỀ</span><span>VỊ TRÍ CHUYÊN MÔN</span>
              </div>
              <div className="max-h-72 divide-y divide-slate-100 overflow-auto">
                {jobs.map((job) => {
                  const ids = taxonomy.specializationsUnder(job.id)
                  const state = selectionState(ids, selectedIds)
                  const disabledJob = !state.checked && !canSelect(ids)
                  return (
                    <div key={job.id} className="grid grid-cols-[minmax(180px,35%)_1fr] gap-3 px-4 py-3">
                      <label className="flex cursor-pointer items-start gap-2.5">
                        <Checkbox checked={state.checked} indeterminate={state.indeterminate} disabled={disabledJob} onChange={() => toggleSpecializations(ids)} />
                        <span className={state.checked || state.indeterminate ? 'font-medium text-[var(--brand-primary)]' : ''}>{job.name}</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {(taxonomy.childrenByParent.get(job.id) || []).filter((item) => item.category_type === 'specialization' && (!normalizedQuery || normalize(item.name).includes(normalizedQuery))).map((specialization) => {
                          const selected = selectedIds.has(specialization.id)
                          const disabledSpecialization = !selected && selectedIds.size >= MAX_DESIRED_SPECIALIZATIONS
                          return <button key={specialization.id} type="button" disabled={disabledSpecialization} onClick={() => toggleSpecializations([specialization.id])} className={`rounded-full px-3 py-1 text-sm transition ${selected ? 'bg-[var(--brand-primary)] text-white' : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-[var(--brand-primary)]'} disabled:cursor-not-allowed disabled:opacity-50`}>{specialization.name}</button>
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3 sm:px-5">
            <Button type="link" disabled={!selectedIds.size} onClick={() => setSelectedIds(new Set())}>Bỏ chọn tất cả ({selectedIds.size})</Button>
            <div className="flex gap-2"><Button shape="round" onClick={() => setOpen(false)}>Hủy</Button><Button type="primary" shape="round" onClick={apply}>Chọn ({selectedIds.size}/{MAX_DESIRED_SPECIALIZATIONS})</Button></div>
          </div>
        </div>
      )}
    </div>
  )
}
