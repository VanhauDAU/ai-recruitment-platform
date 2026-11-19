import { DesktopOutlined, MobileOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Grid, Segmented, Switch } from 'antd'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { CompanyLayoutPreview } from '@/entities/company/company'
import { getJobBenefits, jobKeys } from '@/entities/job/job'
import { m } from '@/shared/config/i18n'

// Bề rộng ảo của khung xem trước; khung được thu nhỏ cho vừa chỗ trống.
const FRAME_WIDTH = { desktop: 1120, mobile: 390 }
const DEVICE_OPTIONS = [
  { value: 'desktop', label: m.employer_company_preview_desktop(), icon: <DesktopOutlined /> },
  { value: 'mobile', label: m.employer_company_preview_mobile(), icon: <MobileOutlined /> },
]
const PLACEHOLDER = 'text-sm text-slate-500'
const NO_BENEFITS = []

/**
 * Bản xem trước trực tiếp theo bố cục nháp. Bộ hiển thị dùng breakpoint theo
 * viewport nên chế độ máy tính chỉ đúng khi viewport từ `lg`: dưới mức đó khung
 * luôn ở bố cục di động và không có nút đổi bề rộng. Khi có yêu cầu đang chờ
 * duyệt, `showPending` phủ nội dung chờ duyệt lên bản xem trước.
 */
export default function CompanyPagePreview({
  content,
  layout,
  registry,
  pinnedJobs,
  contentForm,
  showPending,
  onShowPendingChange,
  defaultDevice = 'desktop',
}) {
  const { lg } = Grid.useBreakpoint()
  const pending = contentForm?.pending
  const overlay = Boolean(pending && showPending)
  // Phúc lợi chờ duyệt chỉ có `benefit_id`: cần danh mục để hiện tên.
  const benefitsQuery = useQuery({
    queryKey: jobKeys.benefits,
    queryFn: getJobBenefits,
    enabled: overlay && Object.hasOwn(pending, 'benefits'),
    staleTime: 10 * 60_000,
  })
  const benefits = Array.isArray(benefitsQuery.data) ? benefitsQuery.data : NO_BENEFITS
  const pendingContent = useMemo(() => (overlay ? { contentForm, benefits } : undefined), [overlay, contentForm, benefits])
  const [device, setDevice] = useState(defaultDevice)
  const viewportRef = useRef(null)
  const [available, setAvailable] = useState(0)
  const width = lg ? FRAME_WIDTH[device] : undefined

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.width))
    observer.observe(viewportRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="employer-company-preview">
      <div className="employer-company-preview__bar">
        <h2 className="employer-company-preview__title">{m.employer_company_preview_title()}</h2>
        {pending && (
          <label className="employer-company-preview__toggle">
            <Switch size="small" checked={overlay} onChange={onShowPendingChange} />
            {m.employer_company_preview_show_pending()}
          </label>
        )}
        {lg && (
          <Segmented size="small" aria-label={m.employer_company_preview_width()} options={DEVICE_OPTIONS} value={device} onChange={setDevice} />
        )}
      </div>
      <div ref={viewportRef} className="employer-company-preview__viewport">
        <div
          className="employer-company-preview__frame"
          style={width && { width, zoom: available ? Math.min(1, available / width) : 1 }}
        >
          <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-slate-100" aria-label={m.employer_company_preview_loading()} />}>
            <CompanyLayoutPreview
              content={content}
              layout={layout}
              registry={registry}
              pendingContent={pendingContent}
              narrow={!lg || device === 'mobile'}
              slots={{
                jobs: (
                  <>
                    {pinnedJobs.length > 0 && (
                      <ul className="employer-company-preview__pinned" aria-label={m.employer_company_preview_pinned()}>
                        {pinnedJobs.map((job) => (
                          <li key={job.public_id}><span>{m.employer_company_preview_featured()}</span> {job.title}</li>
                        ))}
                      </ul>
                    )}
                    <p className={PLACEHOLDER}>{m.employer_company_preview_jobs_placeholder()}</p>
                  </>
                ),
                similar_companies: <p className={PLACEHOLDER}>{m.employer_company_preview_similar_placeholder()}</p>,
              }}
            />
          </Suspense>
        </div>
      </div>
      <p className="employer-company-preview__note">{m.employer_company_preview_note()}</p>
    </div>
  )
}
