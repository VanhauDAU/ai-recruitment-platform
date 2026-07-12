import { FileTextOutlined, HeartOutlined, SendOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { useHideOnScroll } from '@/shared/hooks/use-hide-on-scroll'

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function JobDetailStickyBar({ job, relatedJobs, onApply, onSave }) {
  const headerVisible = useHideOnScroll()
  const [pastHero, setPastHero] = useState(false)

  useEffect(() => {
    function checkPosition() {
      setPastHero(window.scrollY > 320)
    }
    checkPosition()
    window.addEventListener('scroll', checkPosition, { passive: true })
    return () => window.removeEventListener('scroll', checkPosition)
  }, [])

  const visible = pastHero && !headerVisible
  return (
    <div className={`fixed inset-x-0 top-0 z-40 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur transition-transform duration-200 ${visible ? 'translate-y-0' : '-translate-y-full'}`}>
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-3 sm:h-16 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto [scrollbar-width:none]">
          <AnchorButton target="job-detail-content" icon={<FileTextOutlined />}>Chi tiết tuyển dụng</AnchorButton>
          <AnchorButton target="job-description">Mô tả công việc</AnchorButton>
          {job?.workplace_groups?.length > 0 && <AnchorButton target="job-workplaces">Địa điểm làm việc</AnchorButton>}
          {relatedJobs?.length > 0 && <AnchorButton target="related-jobs">Việc làm liên quan</AnchorButton>}
        </div>
        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <button type="button" onClick={onSave} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-emerald-200 text-[var(--brand-primary)] hover:bg-emerald-50" aria-label="Lưu tin"><HeartOutlined /></button>
          <button type="button" onClick={onApply} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-5 text-sm font-bold text-white hover:bg-[var(--brand-primary-hover)]"><SendOutlined /> Ứng tuyển ngay</button>
        </div>
      </div>
    </div>
  )
}

function AnchorButton({ target, icon, children }) {
  return (
    <button type="button" onClick={() => scrollToSection(target)} className="shrink-0 cursor-pointer rounded-full bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-[var(--brand-primary)] sm:px-4 sm:text-sm">
      {icon} {children}
    </button>
  )
}
