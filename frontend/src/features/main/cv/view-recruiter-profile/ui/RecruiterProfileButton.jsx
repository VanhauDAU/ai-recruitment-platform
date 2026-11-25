import { EyeOutlined } from '@ant-design/icons'
import { lazy, Suspense, useState } from 'react'
import { m } from '@/shared/config/i18n'

const RecruiterProfileModal = lazy(() => import('./RecruiterProfileModal'))

/** Mở hộp thoại "Hồ sơ NTD nhìn thấy" của một CV; hộp thoại tải trễ. */
export default function RecruiterProfileButton({ cv, className = '' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-xs font-semibold text-[var(--brand-primary-hover)] hover:underline ${className}`}
      >
        <EyeOutlined aria-hidden /> {m.candidate_recruiter_profile_open()}
      </button>
      {open && (
        <Suspense fallback={null}>
          <RecruiterProfileModal cv={cv} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  )
}
