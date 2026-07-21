import { EyeOutlined, InfoCircleFilled } from '@ant-design/icons'
import { Link } from 'react-router-dom'

function formatCvDate(value) {
  if (!value) return 'Chưa có thời gian cập nhật'
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CvChoice({ cv, selected, onSelect }) {
  const canEdit = cv.cv_type !== 'uploaded' && cv.is_complete === false
  const statusText = cv.has_unsaved_changes
    ? 'Chưa lưu'
    : cv.is_complete === false
      ? 'CV chưa hoàn thiện'
      : ''

  return (
    <div
      onClick={() => onSelect(cv.public_id)}
      className={[
        'group flex min-h-[60px] cursor-pointer items-center gap-3 rounded-md border px-4 py-2.5 transition',
        selected
          ? 'border-slate-300 bg-slate-50/50'
          : 'border-slate-200 bg-white hover:border-slate-300',
      ].join(' ')}
    >
      <input
        type="radio"
        name="application-cv"
        value={cv.public_id}
        checked={selected}
        onChange={() => onSelect(cv.public_id)}
        onClick={(event) => event.stopPropagation()}
        aria-label={`${cv.title}${cv.is_default ? ' CV chính' : ''}`}
        className="h-5 w-5 shrink-0 accent-[var(--brand-primary)]"
      />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium leading-5 text-slate-700">{cv.title}</span>
        <span className="block text-sm italic leading-5 text-slate-400">
          {cv.cv_type === 'uploaded' ? 'CV tải lên' : 'CV online'} - {formatCvDate(cv.updated_at)}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-2">
        {statusText && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#fde1dc] px-2.5 py-1 text-xs font-medium text-[#d83a2e]">
            <InfoCircleFilled /> {statusText}
          </span>
        )}
        {canEdit && (
          <Link
            to={`/cvs/${cv.public_id}/edit`}
            target="_blank"
            onClick={(event) => event.stopPropagation()}
            className="rounded-full bg-[var(--brand-primary)] px-4 py-1 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
          >
            Sửa CV
          </Link>
        )}
        {!canEdit && (
          <Link
            to={`/cvs/${cv.public_id}/view`}
            target="_blank"
            onClick={(event) => event.stopPropagation()}
            className="pointer-events-none rounded-md px-2 py-1 text-xs font-medium text-slate-400 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 hover:text-[var(--brand-primary)]"
          >
            <EyeOutlined /> Xem
          </Link>
        )}
      </span>
    </div>
  )
}
