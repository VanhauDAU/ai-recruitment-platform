import { BulbFilled, CloseOutlined, DownOutlined, FilterOutlined } from '@ant-design/icons'
import { Dropdown } from 'antd'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { m } from '@/shared/config/i18n'
import ArrowButton from '@/shared/ui/ArrowButton'
import BestJobsResults from './BestJobsResults'
import { BEST_JOBS_DIMENSIONS, BEST_JOBS_ROTATE_MS } from '../lib/best-jobs-config'
import useBestJobsData from '../model/use-best-jobs-data'
import './best-jobs.css'

export default function BestJobs({ categories = [], pageSize }) {
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
    jobs,
    loading,
    page,
    paused,
    totalPages,
    changeDimension,
    nextPage,
    setPage,
    setPaused,
    toggleFilter,
  } = useBestJobsData(categories, pageSize)

  function pickDimension(key) {
    changeDimension(key)
    chipStrip.current?.scrollTo({ left: 0, behavior: 'smooth' })
  }

  function scrollChips(direction) {
    const node = chipStrip.current
    if (!node) return
    node.scrollBy({ left: direction * node.clientWidth * 0.8, behavior: 'smooth' })
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
  const goPrev = () => setPage((current) => Math.max(1, current - 1))
  const goNext = () => setPage((current) => Math.min(totalPages, current + 1))

  return (
    <div
      className="best-jobs"
      data-paused={paused}
      style={{ '--bj-rotate': `${BEST_JOBS_ROTATE_MS}ms` }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mb-3 flex items-center gap-3">
        <h2 className="best-jobs__title">{m.candidate_best_jobs_title()}</h2>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/viec-lam" className="best-jobs__see-all mr-1">{m.candidate_best_jobs_see_all()}</Link>
          <ArrowButton dir="left" aria-label={m.candidate_best_jobs_prev_page()} disabled={page <= 1} onClick={goPrev} />
          <ArrowButton dir="right" aria-label={m.candidate_best_jobs_next_page()} disabled={page >= totalPages} onClick={goNext} />
        </div>
      </div>

      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center">
        <Dropdown
          trigger={['click']}
          menu={{
            items: BEST_JOBS_DIMENSIONS.map((item) => ({ key: item.key, label: item.label })),
            onClick: ({ key }) => pickDimension(key),
            selectedKeys: [dimension],
          }}
        >
          <button type="button" className="best-jobs__filter">
            <FilterOutlined />
            <span>{m.candidate_best_jobs_filter_by()}</span>
            <strong className="flex-1 text-left">{dimensionLabel}</strong>
            <DownOutlined className="text-xs" />
          </button>
        </Dropdown>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <ArrowButton dir="left" aria-label={m.candidate_best_jobs_scroll_left()} className="max-md:hidden" onClick={() => scrollChips(-1)} />
          <div
            ref={chipStrip}
            onPointerDown={startChipDrag}
            onPointerMove={moveChipDrag}
            onPointerUp={endChipDrag}
            onPointerCancel={endChipDrag}
            className="best-jobs__chips"
          >
            {chips.map((chip) => (
              <button
                key={`${chip.value ?? 'all'}-${chip.label}`}
                type="button"
                aria-pressed={activeChip === chip.value}
                onClick={() => {
                  if (Date.now() >= dragState.current.suppressClickUntil) toggleFilter(chip.value)
                }}
                className="best-jobs__chip"
              >
                {chip.label}
                {chip.count != null && <span className="best-jobs__chip-count">{chip.count}</span>}
              </button>
            ))}
          </div>
          <ArrowButton dir="right" aria-label={m.candidate_best_jobs_scroll_right()} className="max-md:hidden" onClick={() => scrollChips(1)} />
        </div>
      </div>

      {showHint && (
        <div className="best-jobs__hint mb-2 max-md:hidden">
          <BulbFilled className="best-jobs__hint-icon" />
          <span className="flex-1">
            <strong>{m.candidate_best_jobs_hint_label()}</strong> {m.candidate_best_jobs_hint()}
          </span>
          <button type="button" aria-label={m.candidate_best_jobs_hide_hint()} className="best-jobs__hint-close" onClick={() => setShowHint(false)}>
            <CloseOutlined className="text-xs" />
          </button>
        </div>
      )}

      {/* Thanh chạy hết thì sang trang; key theo lượt dữ liệu để chạy lại từ đầu. */}
      {totalPages > 1 && (
        <div className="best-jobs__progress mb-3" aria-hidden="true">
          <div key={animKey} className="best-jobs__progress-bar" onAnimationEnd={nextPage} />
        </div>
      )}

      <BestJobsResults animKey={animKey} jobs={jobs} loading={loading} pageSize={pageSize} />

      {totalPages > 1 && (
        <div className="best-jobs__pager mt-4 flex items-center justify-center gap-4">
          <ArrowButton dir="left" aria-label={m.candidate_best_jobs_prev_page()} disabled={page <= 1} onClick={goPrev} />
          <span aria-live="polite">
            <strong>{page}</strong> {m.candidate_best_jobs_page_total({ total: totalPages })}
          </span>
          <ArrowButton dir="right" aria-label={m.candidate_best_jobs_next_page()} disabled={page >= totalPages} onClick={goNext} />
        </div>
      )}
    </div>
  )
}
