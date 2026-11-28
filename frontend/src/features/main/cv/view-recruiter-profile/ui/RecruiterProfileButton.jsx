import { EyeOutlined } from '@ant-design/icons'
import { lazy, Suspense, useState } from 'react'
import { m } from '@/shared/config/i18n'

const RecruiterProfileModal = lazy(() => import('./RecruiterProfileModal'))

const VARIANTS = {
  link: 'gap-1.5 bg-transparent p-0 text-xs hover:underline',
  // Nút mềm cao 32px để đứng cùng hàng với nút viền (vd. "Đổi CV" ở sidebar tài khoản).
  pill: 'h-8 gap-1.5 rounded-full bg-[var(--brand-primary-soft)] px-3.5 text-[13px] transition-colors hover:bg-emerald-100',
}

/** Mở hộp thoại "Hồ sơ NTD nhìn thấy" của một CV; hộp thoại tải trễ. */
export default function RecruiterProfileButton({ cv, variant = 'link', className = '' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex cursor-pointer items-center border-0 font-semibold text-[var(--brand-primary-hover)] ${VARIANTS[variant]} ${className}`}
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
