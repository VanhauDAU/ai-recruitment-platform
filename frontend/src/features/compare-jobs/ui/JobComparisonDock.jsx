import { CloseOutlined, DeleteOutlined, SwapOutlined } from '@ant-design/icons'
import { Drawer } from 'antd'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useConsent } from '@/entities/consent'
import { companyInitial } from '@/entities/job'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { useVisualViewportBottomInset } from '@/shared/hooks/use-visual-viewport-bottom-inset'
import { buildJobComparisonPath } from '../model/comparison-url'
import useJobComparison from '../model/use-job-comparison'

const JOB_ROUTE_PATTERN = /^\/(?:viec-lam(?:\/|$)|jobs(?:\/|$)|viec-lam-da-luu\/?$)/

function useDockBottom(pathname) {
  const { isDecided, isEnabled } = useConsent()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const visualViewportInset = useVisualViewportBottomInset()
  const [cookieHeight, setCookieHeight] = useState(0)
  const cookieVisible = isEnabled && !isDecided
  const jobDetailMobile = isMobile && /^\/viec-lam\/[^/]+\/?$/.test(pathname)

  useEffect(() => {
    if (!cookieVisible) {
      setCookieHeight(0)
      return undefined
    }
    const banner = document.querySelector('.cookie-consent-banner')
    const update = () => setCookieHeight(Math.ceil(banner?.getBoundingClientRect().height || 144))
    update()
    const observer = banner && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    observer?.observe(banner)
    window.addEventListener('resize', update)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [cookieVisible])

  const base = cookieVisible ? cookieHeight + 16 : jobDetailMobile ? 84 : 16
  return `calc(${base}px + ${visualViewportInset}px + env(safe-area-inset-bottom, 0px))`
}

function JobLogo({ item }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white text-sm font-bold text-[var(--brand-primary)]">
      {item.companyLogoUrl
        ? <img src={item.companyLogoUrl} alt="" className="h-full w-full object-contain p-1" />
        : companyInitial(item.companyName)}
    </span>
  )
}

function SelectedJob({ item, onRemove, compact = false }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 ${compact ? 'p-3' : 'px-3 py-2'}`}>
      <JobLogo item={item} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800">{item.title}</p>
        <p className="truncate text-xs text-slate-500">{item.companyName || 'Chưa cập nhật công ty'}</p>
      </div>
      <button
        type="button"
        onClick={() => onRemove(item)}
        aria-label={`Bỏ ${item.title} khỏi so sánh`}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
      >
        <CloseOutlined aria-hidden="true" />
      </button>
    </div>
  )
}

export default function JobComparisonDock() {
  const { pathname } = useLocation()
  const {
    announcement,
    canCompare,
    clearJobs,
    items,
    maxJobs,
    openPreferenceSettings,
    persistence,
    removeJob,
  } = useJobComparison()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const visible = items.length > 0 && JOB_ROUTE_PATTERN.test(pathname) && pathname !== '/so-sanh-viec-lam'
  const bottom = useDockBottom(pathname)

  useEffect(() => setDrawerOpen(false), [pathname])

  if (!visible) return null

  const comparePath = buildJobComparisonPath(items)
  return (
    <>
      <div
        role="region"
        aria-label={`Danh sách so sánh, ${items.length} trên ${maxJobs} việc làm`}
        className="fixed inset-x-0 z-50 px-3 md:px-6"
        style={{ bottom }}
      >
        <div className="mx-auto hidden max-w-5xl rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_16px_40px_rgba(15,23,42,0.16)] md:block">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg text-[var(--brand-primary)]">
              <SwapOutlined aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: maxJobs }).map((_, index) => {
                  const item = items[index]
                  return item
                    ? <SelectedJob key={item.publicId} item={item} onRemove={removeJob} />
                    : <div key={index} className="flex min-h-14 items-center justify-center rounded-xl border border-dashed border-slate-200 px-3 text-xs text-slate-400">Chọn thêm việc làm</div>
                })}
              </div>
              {persistence === 'memory' && (
                <p className="mt-2 text-xs text-slate-500">
                  Danh sách chỉ được giữ trong tab này.{' '}
                  <button type="button" onClick={openPreferenceSettings} className="font-semibold text-[var(--brand-primary)] hover:underline">Bật cookie Sở thích</button>
                  {' '}để lưu trên trình duyệt.
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              {canCompare ? (
                <Link to={comparePath} className="inline-flex h-10 items-center justify-center rounded-lg !bg-[var(--brand-primary)] px-5 text-sm font-bold !text-white transition hover:!bg-[var(--brand-primary-hover)]">So sánh ngay</Link>
              ) : (
                <button type="button" disabled className="h-10 rounded-lg bg-slate-100 px-5 text-sm font-semibold text-slate-400">Chọn thêm 1 việc</button>
              )}
              <button type="button" onClick={clearJobs} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700"><DeleteOutlined /> Xóa tất cả</button>
            </div>
          </div>
        </div>

        <div className="flex justify-center md:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex h-12 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-bold text-slate-800 shadow-[0_12px_28px_rgba(15,23,42,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
          >
            <SwapOutlined className="text-[var(--brand-primary)]" />
            So sánh ({items.length}/{maxJobs})
          </button>
        </div>
      </div>
      <div aria-hidden="true" style={{ height: '88px' }} />
      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>

      <Drawer
        placement="bottom"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        size="auto"
        title={`Danh sách so sánh (${items.length}/${maxJobs})`}
        className="[&_.ant-drawer-content]:!rounded-t-2xl"
      >
        <div className="space-y-3 pb-[env(safe-area-inset-bottom,0px)]">
          {items.map((item) => <SelectedJob key={item.publicId} item={item} onRemove={removeJob} compact />)}
          {persistence === 'memory' && (
            <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              Danh sách chỉ được giữ trong tab này.{' '}
              <button type="button" onClick={openPreferenceSettings} className="font-semibold text-[var(--brand-primary)] hover:underline">Bật cookie Sở thích</button>
              {' '}để lưu trên trình duyệt.
            </div>
          )}
          <div className="grid grid-cols-[auto_1fr] gap-2 pt-1">
            <button type="button" onClick={clearJobs} className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600">Xóa tất cả</button>
            {canCompare ? (
              <Link onClick={() => setDrawerOpen(false)} to={comparePath} className="inline-flex h-11 items-center justify-center rounded-lg !bg-[var(--brand-primary)] px-4 text-sm font-bold !text-white">So sánh ngay</Link>
            ) : (
              <button type="button" disabled className="h-11 rounded-lg bg-slate-100 px-4 text-sm font-semibold text-slate-400">Chọn thêm 1 việc làm</button>
            )}
          </div>
        </div>
      </Drawer>
    </>
  )
}
