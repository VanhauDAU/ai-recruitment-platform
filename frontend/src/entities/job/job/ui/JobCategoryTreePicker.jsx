import {
  CloseCircleFilled,
  DownOutlined,
  LeftOutlined,
  LoadingOutlined,
  RightOutlined,
  SearchOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { Button, Checkbox, Input, Modal } from 'antd'
import { useMemo, useState } from 'react'
import { m } from '@/shared/config/i18n'
import {
  buildCategoryTree,
  nodeCheckState,
  reduceToCategoryIds,
  selectedLeafSet,
  toggleNodeLeaves,
} from '../lib/job-category-tree'

function normalizeSearch(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .trim()
}

export default function JobCategoryTreePicker({
  ariaLabel = m.job_category_picker_label(),
  categories = [],
  className = '',
  disabled = false,
  id,
  loading = false,
  onChange = () => {},
  placeholder = m.job_category_picker_all(),
  showSelectionChips = false,
  value = [],
}) {
  const tree = useMemo(() => buildCategoryTree(categories), [categories])
  const { byId, childrenOf, groups, leavesUnder } = tree
  const selectedIds = useMemo(
    () => [...new Set((Array.isArray(value) ? value : [])
      .map(Number)
      .filter((item) => Number.isInteger(item) && item > 0))],
    [value],
  )
  const appliedLeaves = useMemo(
    () => selectedLeafSet(selectedIds, leavesUnder),
    [leavesUnder, selectedIds],
  )
  const [open, setOpen] = useState(false)
  const [selectedLeaves, setSelectedLeaves] = useState(new Set())
  const [activeId, setActiveId] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [query, setQuery] = useState('')

  function openModal() {
    setSelectedLeaves(new Set(appliedLeaves))
    setActiveId((current) => current ?? groups[0]?.id)
    setDetailOpen(false)
    setQuery('')
    setOpen(true)
  }

  function toggle(idToToggle) {
    setSelectedLeaves((current) => toggleNodeLeaves(idToToggle, current, leavesUnder))
  }

  function apply() {
    onChange(reduceToCategoryIds(selectedLeaves, groups, childrenOf, leavesUnder))
    setOpen(false)
  }

  const normalizedQuery = normalizeSearch(query)
  const matches = (category) => normalizeSearch(category.name).includes(normalizedQuery)
  const matchesDeep = (category) => (
    matches(category) || (childrenOf[category.id] || []).some(matchesDeep)
  )
  const visibleGroups = normalizedQuery ? groups.filter(matchesDeep) : groups
  const activeGroup = visibleGroups.find((group) => group.id === activeId) || visibleGroups[0]
  const visibleJobs = (childrenOf[activeGroup?.id] || [])
    .filter((job) => !normalizedQuery || matchesDeep(job))

  return (
    <div className={className}>
      <div className="relative w-full">
        <button
          id={id}
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={disabled || loading}
          onClick={openModal}
          className={`flex min-h-10 w-full items-center gap-2 rounded-lg border bg-white px-3 text-left transition disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${
            appliedLeaves.size
              ? 'border-[var(--brand-primary)] pr-8'
              : 'border-gray-300 hover:border-[var(--brand-primary)]'
          }`}
        >
          {loading
            ? <LoadingOutlined className="text-[var(--brand-primary)]" />
            : <UnorderedListOutlined className="text-[var(--brand-primary)]" />}
          <span className="min-w-0 flex-1 truncate font-medium text-slate-700">
            {appliedLeaves.size ? m.job_category_picker_selected_count({ count: selectedIds.length }) : placeholder}
          </span>
          {!appliedLeaves.size && !loading && <DownOutlined className="text-xs text-gray-400" />}
        </button>
        {appliedLeaves.size > 0 && !disabled && (
          <button
            type="button"
            aria-label={m.job_category_picker_clear_all()}
            onClick={(event) => {
              event.stopPropagation()
              onChange([])
            }}
            className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center border-0 bg-transparent p-0 text-gray-400 transition hover:text-red-500"
          >
            <CloseCircleFilled className="text-base" />
          </button>
        )}
      </div>

      {showSelectionChips && selectedIds.length > 0 && (
        <div aria-label={m.job_category_picker_selected()} className="mt-2 flex flex-wrap gap-2">
          {selectedIds.map((categoryId) => {
            const label = byId.get(categoryId)?.name || m.job_category_picker_fallback({ id: categoryId })
            return (
              <span key={categoryId} className="inline-flex min-h-7 max-w-full items-center gap-1 rounded-full bg-[var(--brand-primary-soft)] px-2.5 text-xs font-semibold text-[var(--brand-primary-hover)]">
                <span className="min-w-0 truncate">{label}</span>
                <button
                  type="button"
                  aria-label={m.job_category_picker_remove({ label })}
                  onClick={() => onChange(selectedIds.filter((item) => item !== categoryId))}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full border-0 bg-transparent text-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)]"
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
      )}

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={880}
        style={{ maxWidth: 'calc(100vw - 24px)', top: 20 }}
        styles={{ body: { maxWidth: '100%' } }}
        title={m.job_category_picker_title()}
      >
        <Input
          allowClear
          aria-label={m.job_category_picker_search()}
          placeholder={m.job_category_picker_search_placeholder()}
          prefix={<SearchOutlined className="text-gray-400" />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="my-3"
        />
        <div className="overflow-hidden rounded-lg border border-gray-100 md:grid md:grid-cols-[280px_1fr]">
          <div className={`border-r border-gray-100 ${detailOpen ? 'hidden md:block' : 'block'}`}>
            <p className="px-4 pb-1 pt-3 text-xs font-semibold tracking-wide text-gray-400">{m.job_category_picker_groups_heading()}</p>
            <ul className="h-80 overflow-auto md:h-96">
              {visibleGroups.map((group) => {
                const state = nodeCheckState(group.id, selectedLeaves, leavesUnder)
                return (
                  <li
                    key={group.id}
                    onMouseEnter={() => setActiveId(group.id)}
                    className={`flex items-center gap-2.5 pl-4 ${
                      activeGroup?.id === group.id
                        ? 'bg-[var(--brand-primary-soft)] font-medium text-[var(--brand-primary)]'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <Checkbox
                      aria-label={m.job_category_picker_select_group({ name: group.name })}
                      checked={state.checked}
                      indeterminate={state.indeterminate}
                      onChange={() => toggle(group.id)}
                    />
                    <button
                      type="button"
                      aria-label={m.job_category_picker_open_group({ name: group.name })}
                      onClick={() => {
                        setActiveId(group.id)
                        setDetailOpen(true)
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-4 text-left"
                    >
                      <span className="flex-1">{group.name}</span>
                      <RightOutlined className="text-[10px] text-gray-300" />
                    </button>
                  </li>
                )
              })}
              {!visibleGroups.length && (
                <li className="px-4 py-8 text-center text-sm text-slate-500">{m.job_category_picker_empty()}</li>
              )}
            </ul>
          </div>

          <div className={`${detailOpen ? 'block' : 'hidden'} md:block`}>
            <button
              type="button"
              onClick={() => setDetailOpen(false)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-[var(--brand-primary)] md:hidden"
            >
              <LeftOutlined className="text-xs" /> {m.job_category_picker_label()}
            </button>
            <div className="grid grid-cols-1 px-4 pb-1 pt-2 text-xs font-semibold tracking-wide text-gray-400 md:grid-cols-[220px_1fr] md:pt-3">
              <span>{m.job_category_picker_jobs_heading()}</span><span className="hidden md:block">{m.job_category_picker_positions_heading()}</span>
            </div>
            <div className="h-80 divide-y divide-gray-50 overflow-auto md:h-96">
              {visibleJobs.map((job) => {
                const state = nodeCheckState(job.id, selectedLeaves, leavesUnder)
                const positions = (childrenOf[job.id] || []).filter(
                  (position) => !normalizedQuery || matches(job) || matches(position),
                )
                return (
                  <div key={job.id} className="grid grid-cols-1 gap-2 px-4 py-3 md:grid-cols-[220px_1fr] md:gap-3">
                    <label className="flex cursor-pointer items-start gap-2.5">
                      <Checkbox
                        aria-label={m.job_category_picker_select_job({ name: job.name })}
                        checked={state.checked}
                        indeterminate={state.indeterminate}
                        onChange={() => toggle(job.id)}
                      />
                      <span className={state.checked || state.indeterminate ? 'font-medium text-[var(--brand-primary)]' : ''}>
                        {job.name}
                      </span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {positions.map((position) => {
                        const positionState = nodeCheckState(position.id, selectedLeaves, leavesUnder)
                        return (
                          <button
                            key={position.id}
                            type="button"
                            aria-label={m.job_category_picker_select_position({ name: position.name })}
                            aria-pressed={positionState.checked}
                            onClick={() => toggle(position.id)}
                            className={`rounded-full px-3 py-1 text-sm transition ${
                              positionState.checked
                                ? 'bg-[var(--brand-primary)] text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-[var(--brand-primary-soft)] hover:text-[var(--brand-primary)]'
                            }`}
                          >
                            {position.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <Button type="link" className="!px-0" disabled={!selectedLeaves.size} onClick={() => setSelectedLeaves(new Set())}>
            {m.job_category_picker_clear()}{selectedLeaves.size > 0 && ` (${selectedLeaves.size})`}
          </Button>
          <div className="flex gap-2">
            <Button onClick={() => setOpen(false)}>{m.common_action_cancel()}</Button>
            <Button type="primary" onClick={apply}>{m.job_category_picker_apply()}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
