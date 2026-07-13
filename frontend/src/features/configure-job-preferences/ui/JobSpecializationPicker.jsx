import { CheckOutlined, CloseCircleFilled, DownOutlined, SearchOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { Button, Checkbox, Input, Modal } from 'antd'
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
  const jobs = normalizedQuery
    ? visibleGroups.flatMap((group) => taxonomy.childrenByParent.get(group.id) || []).filter(matchesDeep)
    : taxonomy.childrenByParent.get(activeGroup?.id) || []

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
    <div>
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
        <DownOutlined className={`shrink-0 text-xs transition ${open ? 'rotate-180 text-slate-500' : 'text-slate-400'}`} />
      </div>

      {open && (
        <Modal
          open
          footer={null}
          onCancel={() => setOpen(false)}
          title={<div><span>Chọn vị trí chuyên môn</span><span className="ml-2 text-sm font-normal text-slate-400">Tối đa {MAX_DESIRED_SPECIALIZATIONS} vị trí</span></div>}
          width={900}
          style={{ maxWidth: 'calc(100vw - 24px)', top: 12 }}
          className="[&_.ant-modal-body]:!p-0"
        >
          <div className="flex max-h-[calc(100dvh-130px)] flex-col">
            <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
              <Input allowClear autoFocus value={query} onChange={(event) => setQuery(event.target.value)} prefix={<SearchOutlined className="text-slate-400" />} placeholder="Tìm theo nhóm nghề, nghề hoặc vị trí chuyên môn" className="!h-10 !rounded-xl" />
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
              {!normalizedQuery && (
                <div className="mb-5">
                  <p className="mb-2 text-xs font-semibold tracking-wide text-slate-400">NHÓM NGHỀ</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {visibleGroups.map((group) => (
                      <button key={group.id} type="button" onClick={() => setActiveGroupId(group.id)} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition ${activeGroup?.id === group.id ? 'border-emerald-600 bg-emerald-50 font-medium text-emerald-700' : 'border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700'}`}>{group.name}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-3">
                {jobs.map((job) => {
                  const ids = taxonomy.specializationsUnder(job.id)
                  const state = selectionState(ids, selectedIds)
                  const disabledJob = !state.checked && !canSelect(ids)
                  const specializations = (taxonomy.childrenByParent.get(job.id) || []).filter((item) => item.category_type === 'specialization' && (!normalizedQuery || normalize(item.name).includes(normalizedQuery)))
                  return (
                    <section key={job.id} className="rounded-xl border border-slate-200 p-3 sm:p-4">
                      <label className="flex cursor-pointer items-start gap-2.5 text-sm font-semibold text-slate-700">
                        <Checkbox checked={state.checked} indeterminate={state.indeterminate} disabled={disabledJob} onChange={() => toggleSpecializations(ids)} />
                        <span>{job.name}</span>
                      </label>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {specializations.map((specialization) => {
                          const selected = selectedIds.has(specialization.id)
                          const disabledSpecialization = !selected && selectedIds.size >= MAX_DESIRED_SPECIALIZATIONS
                          return <button key={specialization.id} type="button" disabled={disabledSpecialization} onClick={() => toggleSpecializations([specialization.id])} className={`rounded-lg border px-3 py-2 text-left text-sm transition ${selected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700'} disabled:cursor-not-allowed disabled:opacity-40`}>{selected && <CheckOutlined className="mr-1.5 text-xs" />}{specialization.name}</button>
                        })}
                      </div>
                    </section>
                  )
                })}
                {!jobs.length && <p className="py-10 text-center text-sm text-slate-500">Không tìm thấy vị trí chuyên môn phù hợp.</p>}
              </div>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <Button type="link" disabled={!selectedIds.size} onClick={() => setSelectedIds(new Set())}>Bỏ chọn tất cả</Button>
              <div className="flex items-center justify-between gap-3 sm:justify-end"><span className="text-sm text-slate-500">Đã chọn {selectedIds.size}/{MAX_DESIRED_SPECIALIZATIONS}</span><div className="flex gap-2"><Button onClick={() => setOpen(false)}>Hủy</Button><Button type="primary" onClick={apply}>Xác nhận</Button></div></div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
