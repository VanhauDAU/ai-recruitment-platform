import { BulbOutlined, CloseOutlined, DownOutlined, FilterOutlined } from '@ant-design/icons'
import { Dropdown } from 'antd'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ArrowButton from '@/shared/ui/ArrowButton'
import BestJobsResults from './BestJobsResults'
import { BEST_JOBS_DIMENSIONS } from '../lib/best-jobs-config'
import useBestJobsData from '../model/use-best-jobs-data'

export default function BestJobs({ categories = [] }) {
  const navigate = useNavigate()
  const [showHint, setShowHint] = useState(true)
  const chipStrip = useRef(null)
  const dragState = useRef({
    active: false,
    startX: 0,
    scrollLeft: 0,
    dragged: false,
    suppressClickUntil: 0,
  })
  const {
    activeChip,
    animKey,
    chips,
    dimension,
    filters,
    jobs,
    loading,
    page,
    totalPages,
    changeDimension,
    setPage,
    setPaused,
    toggleFilter,
  } = useBestJobsData(categories)

  function pickDimension(key) {
    changeDimension(key)
    chipStrip.current?.scrollTo({ left: 0, behavior: 'smooth' })
  }

  function selectChip(chip) {
    if (chip.action === 'openLocations') navigate('/viec-lam')
    else toggleFilter(chip.value)
  }

  function scrollChips(direction) {
    const node = chipStrip.current
    if (!node) return
    node.scrollTo({
      left: direction < 0 ? 0 : node.scrollWidth - node.clientWidth,
      behavior: 'smooth',
    })
  }

  function startChipDrag(event) {
    if (!chipStrip.current) return
    dragState.current = {
      ...dragState.current,
      active: true,
      startX: event.clientX,
      scrollLeft: chipStrip.current.scrollLeft,
      dragged: false,
    }
  }

  function moveChipDrag(event) {
    const node = chipStrip.current
    if (!node || !dragState.current.active) return
    const delta = event.clientX - dragState.current.startX
    if (Math.abs(delta) > 4) dragState.current.dragged = true
    node.scrollLeft = dragState.current.scrollLeft - delta
  }

  function endChipDrag() {
    const dragged = dragState.current.dragged
    dragState.current = {
      ...dragState.current,
      active: false,
      dragged: false,
      suppressClickUntil: dragged ? Date.now() + 140 : 0,
    }
  }

  const dimensionLabel = BEST_JOBS_DIMENSIONS.find((item) => item.key === dimension)?.label
  const activeFilterCount = Object.values(filters).filter(Boolean).length

  return (
    <div
      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-5"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-lg font-bold text-gray-800 md:text-xl">Việc làm tốt nhất</h2>
        <span className="hidden items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-[var(--brand-primary)] sm:inline-flex">
          <BulbOutlined /> Gợi ý bởi AI
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => navigate('/viec-lam')} className="cursor-pointer text-sm text-[var(--brand-primary)] hover:underline">
            Xem tất cả
          </button>
          <ArrowButton dir="left" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} />
          <ArrowButton dir="right" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} />
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Dropdown
          trigger={['click']}
          menu={{
            items: BEST_JOBS_DIMENSIONS.map((item) => ({ key: item.key, label: item.label })),
            onClick: ({ key }) => pickDimension(key),
            selectedKeys: [dimension],
          }}
        >
          <button className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 text-sm text-gray-600 hover:border-[var(--brand-primary)]">
            <FilterOutlined className="text-gray-400" />
            <span className="hidden sm:inline">Lọc theo:</span>
            <span className="font-medium text-[var(--brand-primary)]">{dimensionLabel}</span>
            {activeFilterCount > 0 && (
              <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand-primary)] px-1 text-[10px] font-semibold text-white">
                {activeFilterCount}
              </span>
            )}
            <DownOutlined className="text-[10px] text-gray-400" />
          </button>
        </Dropdown>

        <ArrowButton dir="left" onClick={() => scrollChips(-1)} />
        <div
          ref={chipStrip}
          onPointerDown={startChipDrag}
          onPointerMove={moveChipDrag}
          onPointerUp={endChipDrag}
          onPointerCancel={endChipDrag}
          className="flex flex-1 cursor-grab select-none items-center gap-2 overflow-x-auto scroll-smooth [scrollbar-width:none] active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
        >
          {chips.map((chip) => {
            const active = activeChip === chip.value
            return (
              <button
                key={`${chip.value ?? 'all'}-${chip.label}`}
                onClick={() => {
                  if (Date.now() >= dragState.current.suppressClickUntil) selectChip(chip)
                }}
                className={`h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-4 text-sm transition ${
                  active
                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]'
                }`}
              >
                {chip.label}
              </button>
            )
          })}
        </div>
        <ArrowButton dir="right" onClick={() => scrollChips(1)} />
      </div>

      {showHint && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-[#c3ebd5] bg-[var(--brand-primary-soft)] px-3 py-2 text-sm text-gray-600">
          <BulbOutlined className="text-[var(--brand-primary)]" />
          <span className="flex-1">Gợi ý: Di chuột vào tiêu đề việc làm để xem thêm thông tin chi tiết</span>
          <CloseOutlined className="cursor-pointer text-gray-400 hover:text-gray-600" onClick={() => setShowHint(false)} />
        </div>
      )}

      <BestJobsResults animKey={animKey} jobs={jobs} loading={loading} />

      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-4">
          <ArrowButton dir="left" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} />
          <span className="text-sm text-gray-500">
            <span className="font-semibold text-[var(--brand-primary)]">{page}</span> / {totalPages} trang
          </span>
          <ArrowButton dir="right" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} />
        </div>
      )}
    </div>
  )
}
